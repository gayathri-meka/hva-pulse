'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import type { UIMessage } from '@/lib/ask-pulse/types'

interface Message extends UIMessage {
  id: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm Pulse AI. Ask me anything about learners, placements, companies, or job outreach.\n\n" +
    'Try: *"How many learners have been hired?"* or *"Show me the pipeline for Batch 10."*',
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

/** Render inline markdown: **bold**, *italic*, `code`. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2])
      parts.push(
        <strong key={match.index} className="font-semibold text-zinc-900">
          {match[2]}
        </strong>,
      )
    else if (match[3])
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      )
    else if (match[4])
      parts.push(
        <code key={match.index} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.8em] text-zinc-700">
          {match[4]}
        </code>,
      )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Parse a markdown table row into cell strings. */
function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1) // drop empty strings from leading/trailing pipes
    .map((cell) => cell.trim())
}

/** True if a line is a markdown table separator (e.g. `| --- | :---: |`). */
function isTableSeparator(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim())
}

type Block =
  | { type: 'table'; rows: string[][] }
  | { type: 'line'; content: string }

/** Group lines into table blocks and individual line blocks. */
function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Filter out separator rows, parse the rest into cell arrays.
      const rows = tableLines
        .filter((l) => !isTableSeparator(l))
        .map(parseTableRow)
      if (rows.length > 0) blocks.push({ type: 'table', rows })
    } else {
      blocks.push({ type: 'line', content: lines[i] })
      i++
    }
  }
  return blocks
}

function MarkdownTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {head.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {body.map((row, ri) => (
            <tr key={ri} className="hover:bg-zinc-50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-zinc-700">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarkdownText({ content }: { content: string }) {
  const blocks = toBlocks(content.split('\n'))
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-700">
      {blocks.map((block, i) => {
        if (block.type === 'table') {
          return <MarkdownTable key={i} rows={block.rows} />
        }
        const line = block.content
        if (line.startsWith('### '))
          return <p key={i} className="font-semibold text-zinc-800">{line.slice(4)}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-bold text-zinc-900">{line.slice(3)}</p>
        if (line.startsWith('# '))
          return <p key={i} className="text-base font-bold text-zinc-900">{line.slice(2)}</p>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="pl-3 text-zinc-700">• {renderInline(line.slice(2))}</p>
        if (line.trim() === '' || line.trim() === '---')
          return <div key={i} className="h-1" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#5BAE5B] px-4 py-2.5 text-sm text-white shadow-sm">
        {content}
      </div>
    </div>
  )
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-3.5 w-3.5 text-[#5BAE5B]"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  )
}

function AssistantBubble({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm">
        <SparklesIcon />
      </div>
      <div className="min-w-0 flex-1">
        {content ? (
          <div className="pt-0.5">
            <MarkdownText content={content} />
            {isStreaming && <span className="ml-0.5 animate-pulse text-[#5BAE5B]">▋</span>}
          </div>
        ) : (
          <div className="flex h-6 items-center">
            <ThinkingDots />
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:300ms]" />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AskPulsePage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    // Exclude the static welcome message from the API history.
    const history: UIMessage[] = messages
      .filter((m) => m.id !== 'welcome')
      .map(({ role, content }) => ({ role, content }))
    const apiHistory: UIMessage[] = [...history, { role: 'user', content: text }]

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ask-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiHistory }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Please try again.' }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 112px)' }}>
      {/* Card */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-zinc-100 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm">
            <SparklesIcon />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Ask Pulse</h1>
            <p className="text-xs text-zinc-400">AI-powered queries over all Pulse data</p>
          </div>
        </div>

        {/* Messages — this is the only scrolling region */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <UserBubble key={m.id} content={m.content} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  content={m.content}
                  isStreaming={isLoading && i === messages.length - 1}
                />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-zinc-100 px-5 py-3">
          <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 focus-within:border-zinc-400 focus-within:bg-white transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about placements, learners, or companies…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-transparent text-sm leading-5 text-zinc-800 placeholder-zinc-400 outline-none disabled:opacity-50"
                style={{ maxHeight: '8rem', overflowY: 'auto' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#5BAE5B] text-white transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-center text-xs text-zinc-400">
              Enter to send · Shift+Enter for new line
            </p>
          </form>
        </div>

      </div>
    </div>
  )
}
