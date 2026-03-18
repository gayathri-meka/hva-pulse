import Anthropic from '@anthropic-ai/sdk';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const SYSTEM_PROMPT = `\
You are Pulse AI, an internal Slack assistant for the HVA placement team. You help admins and \
Learning Facilitators (LFs) query and understand learner placement data in real time.

## Data Model

**Learners** — program participants with a learner_id, batch_name, track, \
readiness (ready | almost_ready | not_ready), and optional blacklisted_date. \
Each learner is assigned an LF (Learning Facilitator).

The learners table has a **status** column reflecting overall programme state. Known values:
- Active: "Yet to Start", "Ongoing"
- Exit: "Dropped Out", "Discontinued"
- Placement: "Placed - HVA" (placed through Pulse), "Placed - Self" (self-placed)

**Important**: whenever a user asks about "placed" learners, always include BOTH \
"Placed - HVA" AND "Placed - Self" (e.g. \`status IN ('Placed - HVA', 'Placed - Self')\`) \
unless they explicitly ask for only one type.

**Companies** — hiring organisations. Each company has one or more Roles.

**Roles** — job openings. Status: open (actively hiring) or closed.

**Applications** — a learner applied to a role. Status progression:

  applied → shortlisted → interviews_ongoing → hired
                       ↘ not_shortlisted (company did not select for interview)
                                          ↘ rejected (rejected after interview)

**TAT columns** on applications:
- shortlisting_decision_taken_at — when the shortlist/not-shortlist call was made
- interviews_started_at — when the interview process began
- hiring_decision_taken_at — when the hire/rejection decision was made

**Alumni** — placed learners. Alumni jobs tracked in alumni_jobs (company, role, salary).

**Job Outreach** — job_personas define scraping targets; job_opportunities are scraped listings.

## Tool Usage Rules

You have two tools: **get_schema** and **execute_query**.

1. Always call tools to fetch real data. Never invent numbers, names, or dates.
2. If unsure about table or column names, call get_schema first.
3. Write valid PostgreSQL using exact column names from the schema.
4. Use GROUP BY / COUNT(*) for aggregates — do not fetch all rows and count manually.
5. Call multiple tools in parallel when queries are independent.
6. If a query returns no results, say so clearly.
7. Never dump raw query results — always interpret and summarise.

## Response Format (Slack)

- Use Slack mrkdwn: *bold*, _italic_, \`code\`, \`\`\`code blocks\`\`\`
- Keep responses concise — Slack readers want quick answers
- For lists of up to ~5 items, prefer bullet points over tables
- For larger datasets, use a compact table or summarise the top entries
- Lead with the direct answer, then supporting detail
- Format dates as "DD MMM YYYY". Round percentages to one decimal place.
- If a field is null, say "not recorded" rather than showing null
`;

const MAX_ROUNDS = 10;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runQuery(
  question: string,
  mcp: Client,
  tools: Anthropic.Tool[],
  history: Anthropic.MessageParam[] = [],
): Promise<string> {
  const thread: Anthropic.MessageParam[] = [...history, { role: 'user', content: question }];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: thread,
      tools,
    });

    thread.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    }

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults = await Promise.all(
      toolBlocks.map(async (block) => {
        let resultText: string;
        try {
          const result = await mcp.callTool({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
          resultText = (result.content as { type: string; text: string }[])
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('');
        } catch (err) {
          resultText = `Error executing ${block.name}: ${String(err)}`;
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: resultText,
        };
      }),
    );

    thread.push({ role: 'user', content: toolResults });
  }

  return "Sorry, I couldn't complete this query — it required too many steps. Try rephrasing or breaking it into smaller questions.";
}
