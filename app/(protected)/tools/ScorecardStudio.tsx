'use client'

import { useState } from 'react'
import { inspectScorecard, rewriteScorecard, generateScorecard, testScorecard } from './actions'
import type { InspectResult, TestRun } from '@/lib/tools/scorecard'

type TabId = 'generate' | 'inspect' | 'test'

const TABS: { id: TabId; label: string; blurb: string }[] = [
  { id: 'generate', label: 'Generate', blurb: 'Describe what you want graded and get a scorecard built on the six principles.' },
  { id: 'inspect', label: 'Inspect', blurb: 'Paste a scorecard and see whether the AI can grade it the same way every time.' },
  { id: 'test', label: 'Test', blurb: 'Run a scorecard against a sample answer to see the score it produces — and whether it holds.' },
]

const GREEN = '#5BAE5B'

// ── Shared bits ───────────────────────────────────────────────────────────────
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-zinc-700">
      {children}
      {hint && <span className="ml-2 text-xs font-normal text-zinc-400">{hint}</span>}
    </label>
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none focus:ring-1 focus:ring-[#5BAE5B]"
    />
  )
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-lg bg-[#5BAE5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch {}
      }}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

function ScorecardPre({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-[13px] leading-relaxed text-zinc-800">
      {text}
    </pre>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function ScorecardStudio() {
  const [tab, setTab] = useState<TabId>('generate')
  const active = TABS.find((t) => t.id === tab)!

  return (
    <div>
      <div className="mb-5 border-b border-zinc-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2 text-sm font-medium ${
                tab === t.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#5BAE5B]" />}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-zinc-500">{active.blurb}</p>

      {tab === 'generate' && <GenerateTab />}
      {tab === 'inspect' && <InspectTab />}
      {tab === 'test' && <TestTab />}

      <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
        These tools grade the grader, not the learner. A high score means the AI will apply the scorecard consistently —
        pair it with your own spot-check before going live. The Test tab uses an approximation of SensAI&apos;s grading
        prompt (not the production prompt yet).
      </p>
    </div>
  )
}

// ── Tab: Generate (a) ───────────────────────────────────────────────────────────
function GenerateTab() {
  const [question, setQuestion] = useState('')
  const [expectation, setExpectation] = useState('')
  const [examples, setExamples] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const ready = question.trim() && expectation.trim()

  async function run() {
    if (!ready) return
    setLoading(true); setError(''); setOutput('')
    const res = await generateScorecard({ question, expectation, examples })
    setLoading(false)
    if (res.ok) setOutput(res.data)
    else setError(res.error)
  }

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <Label>Question</Label>
        <TextArea rows={3} placeholder="e.g. Name two causes of inflation and explain one of them." value={question} onChange={(e) => setQuestion(e.target.value)} />

        <div className="mt-4">
          <Label>What should this scorecard check?</Label>
          <TextArea rows={3} placeholder={'Describe the grading intent in plain words.\ne.g. Grade correctness against the expected answer on a 4-point scale. Ignore grammar and format.'} value={expectation} onChange={(e) => setExpectation(e.target.value)} />
        </div>

        <div className="mt-4">
          <Label hint="optional — these become the anchors for each level">Example answers</Label>
          <TextArea rows={4} placeholder={'One per line: the answer, then the score it should get.\ne.g. Two correct causes + a solid explanation → 4\nOnly one cause → 2\nBlank or off-topic → 1'} value={examples} onChange={(e) => setExamples(e.target.value)} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton onClick={run} disabled={!ready || loading}>{loading ? 'Generating…' : 'Generate scorecard'}</PrimaryButton>
          {!ready && <span className="text-xs text-zinc-400">Add a question and what to check.</span>}
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      {output && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Generated scorecard</h2>
            <CopyButton text={output} />
          </div>
          <ScorecardPre text={output} />
          <p className="mt-3 text-xs text-zinc-400">Switch to <strong>Inspect</strong> to score it, or <strong>Test</strong> to run it on a sample answer.</p>
        </div>
      )}
    </>
  )
}

// ── Tab: Inspect (b) ────────────────────────────────────────────────────────────
const RATING = {
  strong: { cls: 'bg-emerald-50 text-emerald-700', label: 'Strong' },
  partial: { cls: 'bg-amber-50 text-amber-700', label: 'Partial' },
  weak: { cls: 'bg-red-50 text-red-700', label: 'Weak' },
}
function verdictColor(score: number) {
  return score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
}

function InspectTab() {
  const [question, setQuestion] = useState('')
  const [scorecard, setScorecard] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InspectResult | null>(null)
  const [error, setError] = useState('')
  const [rwLoading, setRwLoading] = useState(false)
  const [rewrite, setRewrite] = useState('')

  async function run() {
    if (!scorecard.trim()) return
    setLoading(true); setError(''); setResult(null); setRewrite('')
    const res = await inspectScorecard({ question, scorecard })
    setLoading(false)
    if (res.ok) setResult(res.data)
    else setError(res.error)
  }

  async function doRewrite() {
    setRwLoading(true); setRewrite('')
    const res = await rewriteScorecard({ question, scorecard })
    setRwLoading(false)
    if (res.ok) setRewrite(res.data)
    else setError(res.error)
  }

  const score = result?.score ?? 0

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <Label hint="optional, but improves the check">Question it grades</Label>
        <TextArea rows={2} placeholder="e.g. Explain the difference between supervised and unsupervised learning with one example each." value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div className="mt-4">
          <Label>Scorecard / rubric</Label>
          <TextArea rows={7} placeholder="Paste the scorecard exactly as an admin would upload it." value={scorecard} onChange={(e) => setScorecard(e.target.value)} />
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={run} disabled={!scorecard.trim() || loading}>{loading ? 'Inspecting…' : 'Inspect scorecard'}</PrimaryButton>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`text-xl font-bold ${verdictColor(score)}`}>{result.verdict}</div>
              <div className="mt-1 text-sm text-zinc-500">{result.summary}</div>
            </div>
            <div className={`shrink-0 text-4xl font-bold ${verdictColor(score)}`}>
              {score}
              <span className="text-base font-medium text-zinc-400">/100</span>
            </div>
          </div>
          {/* Meter */}
          <div className="relative mt-4 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg,#dc2626 0%,#d97706 52%,${GREEN} 100%)` }}>
            <div className="absolute -top-1 h-0 w-0" style={{ left: `${score}%`, transform: 'translateX(-50%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '8px solid #3f3f46' }} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-400">
            <span>Too vague</span><span>Needs tightening</span><span>Ready</span>
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">What it checks</h2>
          <div className="divide-y divide-zinc-100">
            {result.dimensions.map((d) => {
              const r = RATING[d.rating] ?? RATING.partial
              return (
                <div key={d.name} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 sm:grid-cols-[170px_70px_1fr]">
                  <div className="text-sm font-medium text-zinc-700">{d.name}</div>
                  <span className={`justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.cls}`}>{r.label}</span>
                  <div className="col-span-2 text-xs text-zinc-500 sm:col-span-1">{d.note}</div>
                </div>
              )
            })}
          </div>

          {result.issues.length > 0 ? (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Flagged spots</h2>
              <div className="space-y-3">
                {result.issues.map((it, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 border-l-2 border-l-amber-400 bg-zinc-50 p-3">
                    <div className="mb-2 rounded bg-amber-50 px-2 py-1 font-mono text-[12px] text-zinc-700">“{it.snippet}”</div>
                    <div className="text-sm text-zinc-800">{it.problem}</div>
                    <div className="mt-1 text-sm text-emerald-700"><span className="mr-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase">Fix</span>{it.fix}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">No major problems flagged — this one reads as AI-gradeable.</div>
          )}

          <div className="mt-5">
            <button onClick={doRewrite} disabled={rwLoading} className="rounded-lg border border-[#5BAE5B] bg-white px-4 py-2 text-sm font-semibold text-[#4e9c4e] hover:bg-emerald-50 disabled:opacity-50">
              {rwLoading ? 'Rewriting…' : 'Rewrite it tighter'}
            </button>
          </div>
          {rewrite && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Tightened version</div>
                <CopyButton text={rewrite} />
              </div>
              <ScorecardPre text={rewrite} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Tab: Test (c) ─────────────────────────────────────────────────────────────
function TestTab() {
  const [question, setQuestion] = useState('')
  const [scorecard, setScorecard] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [runs, setRuns] = useState<TestRun[] | null>(null)
  const [error, setError] = useState('')

  const ready = scorecard.trim() && answer.trim()

  async function run() {
    if (!ready) return
    setLoading(true); setError(''); setRuns(null)
    const res = await testScorecard({ question, scorecard, answer })
    setLoading(false)
    if (res.ok) setRuns(res.data)
    else setError(res.error)
  }

  const scores = runs ? runs.map((r) => r.score) : []
  const consistent = runs ? scores.every((s) => s === scores[0]) : false

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <Label hint="optional but recommended">Question</Label>
        <TextArea rows={2} placeholder="The question the learner was answering." value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div className="mt-4">
          <Label>Scorecard</Label>
          <TextArea rows={6} placeholder="Paste the scorecard the AI should apply." value={scorecard} onChange={(e) => setScorecard(e.target.value)} />
        </div>
        <div className="mt-4">
          <Label>Sample learner response</Label>
          <TextArea rows={4} placeholder="A real or made-up answer to grade. Try a borderline one — that's where vague scorecards break." value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton onClick={run} disabled={!ready || loading}>{loading ? 'Grading 3×…' : 'Run test'}</PrimaryButton>
          <span className="text-xs text-zinc-400">Grades it three times to check the score holds.</span>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      {runs && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
          <div className={`rounded-lg px-3 py-2.5 text-sm ${consistent ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            <strong>{consistent ? 'Consistent' : 'Inconsistent'}</strong>
            {consistent
              ? ' — same score across all three runs. This scorecard grades this answer reliably.'
              : ' — same answer, different scores. The scorecard leaves room for interpretation; tighten it in Inspect.'}
          </div>

          <div className="mt-4 flex gap-3">
            {runs.map((r, i) => (
              <div key={i} className={`flex-1 rounded-lg border bg-zinc-50 p-3 text-center ${consistent ? 'border-emerald-200' : 'border-red-200'}`}>
                <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">Run {i + 1}</div>
                <div className={`text-3xl font-bold ${consistent ? 'text-emerald-700' : 'text-red-700'}`}>{r.score}</div>
                {r.scale && <div className="text-[11px] text-zinc-400">of {r.scale}</div>}
              </div>
            ))}
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Feedback &amp; reasoning</h2>
          <div className="space-y-2">
            {runs.map((r, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                <span className="mr-2 rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-600">Run {i + 1}</span>
                {r.feedback && <span className="text-zinc-800">{r.feedback}</span>}
                {r.reasoning && <div className="mt-1 text-xs text-zinc-500">{r.reasoning}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
