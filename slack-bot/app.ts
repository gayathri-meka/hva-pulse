import Bolt from '@slack/bolt';
const { App } = Bolt;
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type Anthropic from '@anthropic-ai/sdk';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQuery } from './claude.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Path to the pre-built MCP server (run `cd mcp && npm run build` first)
const MCP_SERVER_PATH = join(__dirname, '..', 'mcp', 'dist', 'server.js');

// ── Env validation ────────────────────────────────────────────────────────────

const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET', 'ANTHROPIC_API_KEY', 'MCP_DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Slack app ─────────────────────────────────────────────────────────────────

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
});

// ── MCP singleton ─────────────────────────────────────────────────────────────
// Spawned once at startup and reused for all requests.
// If the subprocess dies, it is recreated on the next request.

let mcpClient: Client | null = null;
let anthropicTools: Anthropic.Tool[] = [];

async function getMcp(): Promise<{ mcp: Client; tools: Anthropic.Tool[] }> {
  if (mcpClient) return { mcp: mcpClient, tools: anthropicTools };

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER_PATH],
    env: Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
    ),
  });

  const client = new Client({ name: 'pulse-slack-bot', version: '1.0.0' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }));

  mcpClient = client;
  console.log('[pulse-bot] MCP connected, tools:', anthropicTools.map((t) => t.name).join(', '));
  return { mcp: client, tools: anthropicTools };
}

// ── Markdown → Slack mrkdwn ───────────────────────────────────────────────────

function toMrkdwn(text: string): string {
  return (
    text
      // Headings → bold
      .replace(/^#{1,3} (.+)$/gm, '*$1*')
      // **bold** → *bold*  (do this before touching single asterisks)
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      // Truncate if too long (Slack block text limit is ~3000 chars in practice)
      .slice(0, 3000) + (text.length > 3000 ? '\n\n_…truncated_' : '')
  );
}

// ── Core handler ─────────────────────────────────────────────────────────────

async function handleMessage({
  userText,
  channel,
  threadTs,          // reply thread anchor (undefined = start new thread for mentions, none for DMs)
  replyInThread,     // true for channel mentions, false for DMs
  client,
}: {
  userText: string;
  channel: string;
  threadTs: string;
  replyInThread: boolean;
  client: InstanceType<typeof App>['client'];
}) {
  // Post "Thinking…" immediately so the user knows the bot received their message
  const thinking = await client.chat.postMessage({
    channel,
    ...(replyInThread ? { thread_ts: threadTs } : {}),
    text: ':hourglass_flowing_sand: _Thinking…_',
    mrkdwn: true,
  });

  let responseText: string;
  try {
    const { mcp, tools } = await getMcp();
    responseText = toMrkdwn(await runQuery(userText, mcp, tools));
  } catch (err) {
    console.error('[pulse-bot] error:', err);
    responseText = `Sorry, something went wrong. ${err instanceof Error ? err.message : String(err)}`;
    mcpClient = null; // force reconnect on next request
  }

  // Replace the "Thinking…" message with the real answer
  await client.chat.update({
    channel,
    ts: thinking.ts as string,
    text: responseText,
    mrkdwn: true,
  });
}

// ── Event: @mention in a channel ─────────────────────────────────────────────

slack.event('app_mention', async ({ event, client }) => {
  // Strip the @mention tag(s) to get the actual question
  const userText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!userText) return;

  // If already in a thread, reply there; otherwise start a new thread from this message
  const threadTs = (event as unknown as { thread_ts?: string }).thread_ts ?? event.ts;

  await handleMessage({
    userText,
    channel: event.channel,
    threadTs,
    replyInThread: true,
    client,
  });
});

// ── Event: DM to the bot ─────────────────────────────────────────────────────

slack.message(async ({ message, client }) => {
  // Only handle direct messages (channel messages are handled by app_mention)
  const msg = message as {
    channel_type?: string;
    text?: string;
    ts: string;
    channel: string;
    bot_id?: string;
    subtype?: string;
  };

  if (msg.channel_type !== 'im') return;
  if (msg.bot_id || msg.subtype === 'bot_message') return; // ignore own messages

  const userText = (msg.text ?? '').trim();
  if (!userText) return;

  await handleMessage({
    userText,
    channel: msg.channel,
    threadTs: msg.ts,
    replyInThread: false, // DMs: just post inline, no nested thread
    client,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

// Connect to MCP at startup so the first request isn't slow
await getMcp();

await slack.start();
console.log('[pulse-bot] Running in Socket Mode — waiting for messages');

process.on('SIGINT', async () => {
  if (mcpClient) await mcpClient.close().catch(() => {});
  await slack.stop();
  process.exit(0);
});
