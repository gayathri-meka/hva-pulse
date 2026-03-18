# Pulse Slack Bot

A Slack bot that answers natural-language questions about the Pulse placement database.
It connects to the same MCP server used by the Pulse web UI, so answers always reflect live data.

---

## How it works

```
User message / @mention
       ↓
Slack Bolt (Socket Mode)
       ↓
Anthropic Claude (claude-sonnet-4-6) — agentic loop
       ↓
MCP server subprocess (mcp/dist/server.js)
       ↓
pulse_mcp_ro role → Supabase Postgres (read-only)
```

---

## 1. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Give it a name (e.g. *Pulse AI*) and pick your workspace.

---

## 2. Configure OAuth Scopes

Under **OAuth & Permissions → Scopes → Bot Token Scopes**, add:

| Scope | Purpose |
|---|---|
| `app_mentions:read` | Receive @mentions in channels |
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `im:history` | Read DMs sent to the bot |
| `chat:write` | Post and update messages |

Then click **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-...`).

---

## 3. Enable Socket Mode

1. **Socket Mode** (left sidebar) → toggle **Enable Socket Mode** on.
2. Under **Basic Information → App-Level Tokens** → **Generate Token and Scopes**:
   - Name: `socket-mode`
   - Scope: `connections:write`
   - Copy the `xapp-...` token.

---

## 4. Subscribe to Events

Under **Event Subscriptions**:

1. Toggle **Enable Events** on.
2. Under **Subscribe to Bot Events**, add:
   - `app_mention` — @mentions in channels
   - `message.im` — direct messages to the bot

Save Changes.

---

## 5. Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `SLACK_BOT_TOKEN` | OAuth & Permissions → Bot User OAuth Token |
| `SLACK_APP_TOKEN` | Basic Information → App-Level Tokens |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `MCP_DATABASE_URL` | Supabase session-pooler URL for `pulse_mcp_ro` (see below) |

### MCP_DATABASE_URL format

Use the **session pooler** URL (not the direct host — the direct host may resolve to IPv6):

```
postgresql://pulse_mcp_ro.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Find your project ref and region in **Supabase → Project Settings → Database**.

---

## 6. Build the MCP server

The bot spawns the MCP server as a subprocess. Build it first:

```bash
cd mcp
npm install
npm run build   # outputs to mcp/dist/server.js
cd ..
```

---

## 7. Install dependencies and run

```bash
cd slack-bot
npm install

# Development (tsx, no compile step)
npm run dev

# Production
npm run build
npm start
```

The bot prints `[pulse-bot] Running in Socket Mode — waiting for messages` when ready.

---

## Usage

**In a channel** — @mention the bot with any question:
```
@Pulse AI How many learners are currently shortlisted?
```

**Via DM** — send a message directly to the bot:
```
Which companies have hired the most learners this year?
```

The bot replies with "⏳ Thinking…" immediately, then replaces that with the real answer once Claude has queried the database.

---

## Permissions note

The bot uses the `pulse_mcp_ro` read-only Postgres role. It can only run `SELECT` queries. Write operations (INSERT, UPDATE, DELETE, DROP, etc.) are blocked both at the SQL validator level and at the database role level.
