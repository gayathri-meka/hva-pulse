// TODO: swap OpenAI for Anthropic (claude-sonnet-4-6) once the tool-calling integration is ready.
// The handler shape stays the same — swap the client and model string.

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SYSTEM_PROMPT } from '@/lib/ask-pulse/system-prompt'
import { TOOLS, type ToolName } from '@/lib/ask-pulse/tools'
import { executeToolCall } from '@/lib/ask-pulse/tool-handlers'
import type { UIMessage } from '@/lib/ask-pulse/types'

// Max tool-call rounds before giving up and returning an error message.
const MAX_ROUNDS = 5

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Use createServerSupabaseClient() directly — React cache() doesn't work in
  // route handlers, so getAppUser() is intentionally avoided here.
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

  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'LF')) {
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

  // ── Build OpenAI message thread ───────────────────────────────────────────
  const thread: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  // ── Agentic tool-call loop ────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let finalText = 'Sorry, I was unable to produce a response. Please try again.'

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: thread,
      tools: TOOLS,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    // Add the assistant turn to the thread so subsequent rounds have context.
    thread.push(choice.message as ChatCompletionMessageParam)

    if (choice.finish_reason !== 'tool_calls') {
      // No more tool calls — we have the final text response.
      finalText = choice.message.content ?? finalText
      break
    }

    // Execute all tool calls in this round in parallel.
    const toolCalls = (choice.message.tool_calls ?? []).filter((tc) => tc.type === 'function')
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        // tc.type === 'function' is guaranteed by the filter above.
        const fn = (tc as { id: string; type: 'function'; function: { name: string; arguments: string } }).function
        let result: unknown
        try {
          const args = JSON.parse(fn.arguments) as Record<string, unknown>
          result = await executeToolCall(fn.name as ToolName, args, supabase)
        } catch (err) {
          console.error(`[ask-pulse] tool error — ${fn.name}:`, err)
          result = { error: String(err) }
        }
        return {
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        }
      }),
    )

    thread.push(...toolResults)
  }

  // ── Stream the final text back ─────────────────────────────────────────────
  // We stream the final answer in chunks so the UI can render progressively.
  // The tool-call rounds above are non-streaming (we need complete JSON to parse
  // tool arguments); only the finished text output is streamed to the client.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalText))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
