import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { join } from 'node:path'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SYSTEM_PROMPT } from '@/lib/ask-pulse/system-prompt'
import type { UIMessage } from '@/lib/ask-pulse/types'

// Max tool-call rounds before giving up.
const MAX_ROUNDS = 5

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email!)
    .single()

  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'staff' && appUser.role !== 'guest')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let messages: UIMessage[]
  try {
    const body = await request.json()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Spawn MCP server subprocess ───────────────────────────────────────────
  // The MCP server (mcp/dist/server.js) must be built before the Next.js app
  // starts. Run `cd mcp && npm run build` once before `npm run dev`.
  const transport = new StdioClientTransport({
    command: process.execPath, // same Node binary as the parent process
    args: [join(process.cwd(), 'mcp/dist/server.js')],
    env: Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
    ),
  })

  const mcp = new Client({ name: 'pulse-api', version: '1.0.0' })

  try {
    await mcp.connect(transport)
  } catch (err) {
    console.error('[ask-pulse] MCP connect failed:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  // ── Fetch tools from MCP, convert to Anthropic format ────────────────────
  const { tools: mcpTools } = await mcp.listTools()
  const anthropicTools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }))

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const thread: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // ── Streaming response ────────────────────────────────────────────────────
  // The agentic loop runs inside the stream's start() so tool-call rounds
  // and the final text round are all part of the same response stream.
  //
  // Streaming works as follows:
  //   - anthropic.messages.stream() emits 'text' events for each token
  //   - We pipe those directly to the response stream → words appear as generated
  //   - ToolUseBlocks are buffered (we need the complete JSON to execute them)
  //   - After each tool round, we execute via MCP and continue to the next round
  //   - The stream closes when Claude stops calling tools (stop_reason = 'end_turn')
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const msgStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: thread,
            tools: anthropicTools,
          })

          // Forward each text token to the client immediately
          msgStream.on('text', (text) => {
            controller.enqueue(encoder.encode(text))
          })

          // finalMessage() resolves once the full response is buffered —
          // ToolUseBlocks have their complete JSON input by this point.
          const message = await msgStream.finalMessage()

          if (message.stop_reason !== 'tool_use') {
            // No more tool calls — stream is complete.
            break
          }

          // Add assistant turn (with tool calls) to the thread
          thread.push({ role: 'assistant', content: message.content })

          // Execute all tool calls via MCP in parallel
          const toolBlocks = message.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )

          const toolResults = await Promise.all(
            toolBlocks.map(async (block) => {
              let resultText: string
              try {
                const result = await mcp.callTool({
                  name: block.name,
                  arguments: block.input as Record<string, unknown>,
                })
                resultText = (result.content as { type: string; text: string }[])
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text)
                  .join('')
              } catch (err) {
                console.error(`[ask-pulse] tool error — ${block.name}:`, err)
                resultText = `Error executing ${block.name}: ${String(err)}`
              }
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: resultText,
              }
            }),
          )

          thread.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        console.error('[ask-pulse] stream error:', err)
        controller.enqueue(
          encoder.encode('Sorry, something went wrong. Please try again.'),
        )
      } finally {
        controller.close()
        await mcp.close().catch(() => {})
      }
    },
  })

  return new Response(responseStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
