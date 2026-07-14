'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertQuestion, deleteQuestion, upsertRubric } from '../cockpit-actions'
import type { InterviewQuestion, InterviewRubric } from '@/lib/interviewCockpit'
import { roundLabel } from '@/lib/interviews'

const ROUND_LABEL = (r: 1 | 2 | null) => (r === null ? 'Both rounds' : roundLabel(r))

const inputCls = 'w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[#5BAE5B] focus:outline-none'
const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'

export default function QuestionsEditor({ questions, rubrics }: { questions: InterviewQuestion[]; rubrics: InterviewRubric[] }) {
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [addingRubric, setAddingRubric] = useState(false)
  const nextQOrder = questions.length ? Math.max(...questions.map((q) => q.ordering)) + 1 : 1
  const nextROrder = rubrics.length ? Math.max(...rubrics.map((r) => r.ordering)) + 1 : 1

  return (
    <div className="mt-6 space-y-8">
      {/* Rubrics */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Rubrics</h2>
            <p className="text-xs text-zinc-400">Each is scored 1–4 in the cockpit — 1 weakest, 4 strongest.</p>
          </div>
          {!addingRubric && (
            <button onClick={() => setAddingRubric(true)} className="shrink-0 rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e]">
              + Add rubric
            </button>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {addingRubric && <RubricCard rubric={null} nextOrder={nextROrder} onDone={() => setAddingRubric(false)} />}
          {rubrics.length === 0 && !addingRubric && (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">No rubrics yet.</p>
          )}
          {rubrics.map((r) => <RubricCard key={r.key} rubric={r} />)}
        </div>
      </section>

      {/* Questions */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Question bank</h2>
          {!addingQuestion && (
            <button onClick={() => setAddingQuestion(true)} className="shrink-0 rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e]">
              + Add question
            </button>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {addingQuestion && <QuestionCard question={null} nextOrder={nextQOrder} onDone={() => setAddingQuestion(false)} />}
          {questions.length === 0 && !addingQuestion && (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">No questions yet.</p>
          )}
          {questions.map((q) => <QuestionCard key={q.id} question={q} />)}
        </div>
      </section>
    </div>
  )
}

// Weakest → strongest gradient for the 1–4 anchors.
const LEVEL_TONE = [
  { n: 'bg-red-100 text-red-700', bg: 'bg-red-50', tag: 'weakest' },
  { n: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50', tag: '' },
  { n: 'bg-orange-100 text-orange-700', bg: 'bg-orange-50', tag: '' },
  { n: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50', tag: 'strongest' },
] as const

// ── Rubric card (view + inline edit) ────────────────────────────────────────
function RubricCard({ rubric, nextOrder, onDone }: { rubric: InterviewRubric | null; nextOrder?: number; onDone?: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(!rubric)
  const [key, setKey] = useState(rubric?.key ?? '')
  const [label, setLabel] = useState(rubric?.label ?? '')
  const [levels, setLevels] = useState<[string, string, string, string]>(rubric?.levels ?? ['', '', '', ''])
  const [lookingFor, setLookingFor] = useState<[string, string, string, string]>(rubric?.lookingFor ?? ['', '', '', ''])
  const [examples, setExamples] = useState<[string, string, string, string]>(rubric?.examples ?? ['', '', '', ''])
  const [active, setActive] = useState(rubric?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const isNew = !rubric

  function save() {
    setError(null)
    start(async () => {
      const r = await upsertRubric({ key, label, ordering: rubric?.ordering ?? nextOrder ?? 0, levels, lookingFor, examples, active })
      if (!r.ok) { setError(r.error); return }
      setEditing(false)
      onDone?.()
      router.refresh()
    })
  }

  if (!editing && rubric) {
    return (
      <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${rubric.active ? '' : 'opacity-60'}`}>
        <div className="flex items-start justify-between">
          <span className="text-sm font-semibold text-zinc-800">{rubric.label}{!rubric.active && <span className="ml-2 text-[11px] font-normal text-zinc-400">(inactive)</span>}</span>
          <button onClick={() => setEditing(true)} className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-600">Edit</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rubric.levels.map((lv, i) => (
            <div key={i} className={`rounded-lg border border-zinc-100 ${LEVEL_TONE[i].bg} p-2.5`}>
              <div className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${LEVEL_TONE[i].n}`}>{i + 1}</span>
                {LEVEL_TONE[i].tag && <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">{LEVEL_TONE[i].tag}</span>}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-zinc-600">{lv || <span className="text-zinc-300">—</span>}</p>
              {rubric.lookingFor[i]?.trim() && (
                <p className="mt-1 text-[11px] leading-snug text-zinc-500"><span className="text-zinc-400">Looking for: </span>{rubric.lookingFor[i]}</p>
              )}
              {rubric.examples[i]?.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-[11px] italic leading-snug text-zinc-400">e.g. {rubric.examples[i]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Key {isNew && <span className="font-normal normal-case text-zinc-300">(unique, e.g. drive)</span>}</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} disabled={!isNew} placeholder="drive" className={`${inputCls} mt-1 ${!isNew ? 'bg-zinc-50 text-zinc-400' : ''}`} />
        </div>
        <div>
          <label className={labelCls}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Drive" className={`${inputCls} mt-1`} />
        </div>
      </div>
      <div className="mt-4">
        <label className={labelCls}>Score levels <span className="font-normal normal-case text-zinc-400">— per score: what it means, what to look for, example quotes</span></label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {levels.map((lv, i) => (
            <div key={i} className={`rounded-lg border border-zinc-100 ${LEVEL_TONE[i].bg} p-2`}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${LEVEL_TONE[i].n}`}>{i + 1}</span>
                {LEVEL_TONE[i].tag && <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">{LEVEL_TONE[i].tag}</span>}
              </div>
              <textarea
                value={lv}
                onChange={(e) => { const n = [...levels] as [string, string, string, string]; n[i] = e.target.value; setLevels(n) }}
                rows={2}
                placeholder={`What a ${i + 1} means…`}
                className="w-full resize-y rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] focus:border-[#5BAE5B] focus:outline-none"
              />
              <textarea
                value={lookingFor[i]}
                onChange={(e) => { const n = [...lookingFor] as [string, string, string, string]; n[i] = e.target.value; setLookingFor(n) }}
                rows={2}
                placeholder="What to look for at this score…"
                className="mt-1 w-full resize-y rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] focus:border-[#5BAE5B] focus:outline-none"
              />
              <textarea
                value={examples[i]}
                onChange={(e) => { const n = [...examples] as [string, string, string, string]; n[i] = e.target.value; setExamples(n) }}
                rows={2}
                placeholder="Example quotes (one per line)…"
                className="mt-1 w-full resize-y rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] italic text-zinc-600 focus:border-[#5BAE5B] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        {error && <span className="text-xs text-red-600">{error}</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setEditing(false); onDone?.() }} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={pending || !key.trim() || !label.trim()} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Question card (view + inline edit) ──────────────────────────────────────
function QuestionCard({ question, nextOrder, onDone }: { question: InterviewQuestion | null; nextOrder?: number; onDone?: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(!question)
  const [round, setRound] = useState<1 | 2 | null>(question?.round ?? null)
  const [section, setSection] = useState(question?.section ?? '')
  const [ordering, setOrdering] = useState(question?.ordering ?? nextOrder ?? 0)
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [purpose, setPurpose] = useState(question?.purpose ?? '')
  const [strong, setStrong] = useState(question?.strongAnswer ?? '')
  const [weak, setWeak] = useState(question?.weakAnswer ?? '')
  const [probe, setProbe] = useState(question?.probe ?? '')
  const [active, setActive] = useState(question?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const isNew = !question

  function save() {
    setError(null)
    start(async () => {
      const r = await upsertQuestion({
        id: question?.id, round, section, ordering, prompt,
        purpose, strongAnswer: strong, weakAnswer: weak, probe, active,
      })
      if (!r.ok) { setError(r.error); return }
      setEditing(false)
      onDone?.()
      router.refresh()
    })
  }
  function remove() {
    if (!question) return
    if (!confirm('Delete this question? Notes already recorded against it will be removed.')) return
    start(async () => {
      const r = await deleteQuestion(question.id)
      if (!r.ok) { setError(r.error); return }
      router.refresh()
    })
  }

  if (!editing && question) {
    return (
      <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${question.active ? '' : 'opacity-60'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">{ROUND_LABEL(question.round)}</span>
            {question.section && <span className="ml-1.5 rounded bg-[#5BAE5B]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#5BAE5B]">{question.section}</span>}
            {!question.active && <span className="ml-2 text-[11px] text-zinc-400">(inactive)</span>}
            <p className="mt-1.5 text-sm font-medium text-zinc-900">{question.prompt}</p>
            {question.purpose && <p className="mt-1 text-[12px] text-zinc-500">{question.purpose}</p>}
          </div>
          <button onClick={() => setEditing(true)} className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-600">Edit</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Round</label>
          <select value={round === null ? 'both' : String(round)} onChange={(e) => setRound(e.target.value === 'both' ? null : (Number(e.target.value) as 1 | 2))} className={`${inputCls} mt-1`}>
            <option value="both">Both rounds</option>
            <option value="1">{roundLabel(1)}</option>
            <option value="2">{roundLabel(2)}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Section</label>
          <input value={section} onChange={(e) => setSection(e.target.value)} list="interview-sections" placeholder="e.g. Drive" className={`${inputCls} mt-1 w-40`} />
          <datalist id="interview-sections">
            <option value="General" /><option value="Drive" /><option value="Need" /><option value="Time & Commitment" /><option value="Program Alignment" />
          </datalist>
        </div>
        <div className="w-20">
          <label className={labelCls}>Order</label>
          <input type="number" value={ordering} onChange={(e) => setOrdering(Number(e.target.value))} className={`${inputCls} mt-1`} />
        </div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
      </div>
      <div className="mt-3 space-y-2.5">
        <div>
          <label className={labelCls}>Question prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className={`${inputCls} mt-1 resize-y`} placeholder="What do you want to ask?" />
        </div>
        <div>
          <label className={labelCls}>What we&apos;re assessing</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputCls} mt-1`} placeholder="e.g. Resilience and ownership" />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Strong answer looks like</label>
            <textarea value={strong} onChange={(e) => setStrong(e.target.value)} rows={2} className={`${inputCls} mt-1 resize-y`} />
          </div>
          <div>
            <label className={labelCls}>Weak answer looks like</label>
            <textarea value={weak} onChange={(e) => setWeak(e.target.value)} rows={2} className={`${inputCls} mt-1 resize-y`} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Probe / follow-up</label>
          <input value={probe} onChange={(e) => setProbe(e.target.value)} className={`${inputCls} mt-1`} placeholder="Optional follow-up to dig deeper" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {!isNew && <button onClick={remove} disabled={pending} className="text-xs font-medium text-zinc-400 hover:text-red-600 disabled:opacity-50">Delete</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setEditing(false); onDone?.() }} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={pending || !prompt.trim()} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  )
}
