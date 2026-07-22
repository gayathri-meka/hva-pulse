'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireInterviewer, requireStaff } from '@/lib/auth'
import type { CriterionResult } from '@/lib/challengeReview'
import { intakeDossierFields, type IntakeGroup } from '@/lib/challengeIntakeDisplay'
import { rubricsForRound, isValidScoreForRubric, isValidRecommendation, type InterviewQuestion, type InterviewRubric, type RubricLevel, type Recommendation } from '@/lib/interviewCockpit'
import { chatJSON } from '@/lib/openai'
import {
  buildNotesReviewUserPrompt,
  parseNotesReview,
  isNotesOptional,
  NOTES_REVIEW_SYSTEM,
  type NotesReviewInput,
  type NotesReviewResult,
} from '@/lib/interviewNotesReview'

// Cockpit ops for conducting an interview. requireInterviewer allows admin/staff +
// dedicated interviewers; a dedicated interviewer may only touch their OWN interview.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase()

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQuestion(r: any): InterviewQuestion {
  return { id: r.id, round: r.round ?? null, section: r.section ?? null, ordering: r.ordering, prompt: r.prompt, purpose: r.purpose ?? null, strongAnswer: r.strong_answer ?? null, weakAnswer: r.weak_answer ?? null, probe: r.probe ?? null, active: r.active }
}
// Normalise a rubric row → variable levels. Prefers the new `levels` jsonb; falls
// back to the legacy level_1..4 columns (scores 1–4) for rows not yet migrated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLevels(r: any): RubricLevel[] {
  if (Array.isArray(r.levels) && r.levels.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (r.levels as any[])
      .map((l) => ({
        score: Number(l.score),
        descriptor: (l.descriptor ?? '').toString(),
        lookingFor: (l.looking_for ?? l.lookingFor ?? '').toString(),
        example: (l.example ?? '').toString(),
      }))
      .filter((l) => Number.isFinite(l.score))
      .sort((a, b) => a.score - b.score)
  }
  return [1, 2, 3, 4]
    .map((s) => ({
      score: s,
      descriptor: (r[`level_${s}`] ?? '').toString(),
      lookingFor: (r[`looking_for_${s}`] ?? '').toString(),
      example: (r[`example_${s}`] ?? '').toString(),
    }))
    .filter((l) => l.descriptor.trim() !== '')
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRubric(r: any): InterviewRubric {
  return {
    key: r.key,
    label: r.label,
    round: (r.round as 1 | 2 | null) ?? null,
    ordering: r.ordering,
    note: r.note ?? null,
    levels: toLevels(r),
    active: r.active,
  }
}

/** Load the interview + verify the caller may conduct it. Returns the row or an error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOwnedInterview(interviewId: string): Promise<{ ok: false; error: string } | { ok: true; iv: any; user: Awaited<ReturnType<typeof requireInterviewer>> }> {
  const user = await requireInterviewer()
  const { data: iv } = await admin().from('interviews').select('*').eq('id', interviewId).maybeSingle()
  if (!iv) return { ok: false, error: 'Interview not found.' }
  const isStaff = user.role === 'admin' || user.role === 'staff'
  if (!isStaff && norm(iv.interviewer_email) !== norm(user.email)) return { ok: false, error: 'Not your interview.' }
  return { ok: true, iv, user }
}

export type CockpitData = {
  interview: { id: string; candidateEmail: string; candidateName: string | null; round: 1 | 2; scheduledAt: string; status: string; meetLink: string | null; recommendation: Recommendation | null; summary: string | null; assessedAt: string | null }
  dossier: CriterionResult[]
  intake: IntakeGroup[] // raw challenge-intake answers (Motivation/round-1 dossier)
  questions: InterviewQuestion[]
  rubrics: InterviewRubric[]
  notes: Record<string, string> // questionId → note
  scores: Record<string, number> // rubricKey → score
}

export async function getCockpit(interviewId: string): Promise<Ok<CockpitData> | Err> {
  const res = await loadOwnedInterview(interviewId)
  if (!res.ok) return { ok: false, error: res.error }
  const { iv } = res
  const a = admin()

  const [{ data: prospect }, { data: decision }, { data: qs }, { data: rs }, { data: ns }, { data: sc }] = await Promise.all([
    a.from('prospects').select('name').eq('email', iv.candidate_email).maybeSingle(),
    a.from('challenge_decisions').select('criteria_snapshot').eq('email', iv.candidate_email).maybeSingle(),
    a.from('interview_questions').select('*').eq('active', true).order('ordering'),
    a.from('interview_rubrics').select('*').eq('active', true).order('ordering'),
    a.from('interview_notes').select('question_id, note').eq('interview_id', interviewId),
    a.from('interview_scores').select('rubric_key, score').eq('interview_id', interviewId),
  ])

  const round = iv.round as 1 | 2
  const questions = (qs ?? []).map(toQuestion).filter((q) => q.round === null || q.round === round)

  // Motivation (round 1) dossier: the candidate's raw challenge-intake answers.
  let intake: IntakeGroup[] = []
  if (round === 1) {
    const { data: intakeSrc } = await a.from('metric_sources').select('id').eq('bq_table', 'pulse_challenge_intake').maybeSingle()
    if (intakeSrc) {
      const { data: r } = await a
        .from('metric_raw_rows')
        .select('dimensions')
        .eq('source_id', intakeSrc.id)
        .eq('learner_id', (iv.candidate_email as string).trim().toLowerCase())
        .maybeSingle()
      intake = intakeDossierFields((r?.dimensions ?? {}) as Record<string, string>)
    }
  }

  return {
    ok: true,
    data: {
      interview: {
        id: iv.id, candidateEmail: iv.candidate_email, candidateName: (prospect?.name as string) ?? null,
        round, scheduledAt: iv.scheduled_at, status: iv.status, meetLink: iv.meet_link ?? null,
        recommendation: iv.recommendation ?? null, summary: iv.summary ?? null, assessedAt: iv.assessed_at ?? null,
      },
      dossier: (decision?.criteria_snapshot ?? []) as CriterionResult[],
      intake,
      questions,
      rubrics: rubricsForRound((rs ?? []).map(toRubric), round),
      notes: Object.fromEntries((ns ?? []).map((n) => [n.question_id, n.note ?? ''])),
      scores: Object.fromEntries((sc ?? []).map((s) => [s.rubric_key, Number(s.score)])),
    },
  }
}

export async function saveNote(interviewId: string, questionId: string, note: string): Promise<Ok<null> | Err> {
  const res = await loadOwnedInterview(interviewId)
  if (!res.ok) return { ok: false, error: res.error }
  const { error } = await admin()
    .from('interview_notes')
    .upsert({ interview_id: interviewId, question_id: questionId, note, updated_at: new Date().toISOString() }, { onConflict: 'interview_id,question_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

export async function saveScore(interviewId: string, rubricKey: string, score: number): Promise<Ok<null> | Err> {
  const res = await loadOwnedInterview(interviewId)
  if (!res.ok) return { ok: false, error: res.error }
  // Validate the score against the rubric's own scale (fractional / uneven).
  const { data: rub } = await admin().from('interview_rubrics').select('*').eq('key', rubricKey).maybeSingle()
  if (!rub || !isValidScoreForRubric(score, toRubric(rub)))
    return { ok: false, error: 'That score isn’t on this rubric’s scale.' }
  const { error } = await admin()
    .from('interview_scores')
    .upsert({ interview_id: interviewId, rubric_key: rubricKey, score, updated_at: new Date().toISOString() }, { onConflict: 'interview_id,rubric_key' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

export async function submitAssessment(input: {
  interviewId: string
  recommendation: string
  summary: string
}): Promise<Ok<null> | Err> {
  if (!isValidRecommendation(input.recommendation)) return { ok: false, error: 'Pick a recommendation.' }
  const res = await loadOwnedInterview(input.interviewId)
  if (!res.ok) return { ok: false, error: res.error }
  const { user } = res
  const { error } = await admin()
    .from('interviews')
    .update({
      recommendation: input.recommendation,
      summary: input.summary?.trim() || null,
      assessed_at: new Date().toISOString(),
      assessed_by: user.email,
      assessed_by_name: user.name ?? null,
      // Completing the assessment also closes the interview out.
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.interviewId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews')
  revalidatePath(`/admissions/interviews/notes/${input.interviewId}`)
  return { ok: true, data: null }
}

// ── Scores table (Interviews → Notes tab) ────────────────────────────────────
export type ScoreRow = {
  interviewId: string
  candidateName: string | null
  candidateEmail: string
  round: 1 | 2
  interviewerName: string | null
  recommendation: Recommendation | null
  scores: Record<string, number> // rubricKey → 1–4
  hasNotes: boolean
}

/** One row per (non-cancelled) interview with its rubric scores + decision, plus
 *  the rubric column list. Powers the Notes tab table. */
export async function getInterviewScores(): Promise<{ rubrics: { key: string; label: string }[]; rows: ScoreRow[] }> {
  await requireStaff()
  const a = admin()
  const [{ data: ivs }, { data: rubricRows }, { data: scoreRows }, { data: noteRows }] = await Promise.all([
    a.from('interviews').select('id, candidate_email, round, interviewer_email, recommendation').neq('status', 'cancelled').order('scheduled_at', { ascending: false }),
    a.from('interview_rubrics').select('key, label, ordering').eq('active', true).order('ordering'),
    a.from('interview_scores').select('interview_id, rubric_key, score'),
    a.from('interview_notes').select('interview_id, note'),
  ])
  const interviews = ivs ?? []
  const rubrics = (rubricRows ?? []).map((r) => ({ key: r.key as string, label: r.label as string }))

  const [{ data: prospects }, { data: users }] = await Promise.all([
    a.from('prospects').select('email, name').in('email', [...new Set(interviews.map((r) => r.candidate_email as string))]),
    a.from('users').select('email, name').in('email', [...new Set(interviews.map((r) => r.interviewer_email as string))]),
  ])
  const candName = new Map((prospects ?? []).map((p) => [p.email, p.name as string | null]))
  const ivrName = new Map((users ?? []).map((u) => [u.email, u.name as string | null]))

  const scoresByIv = new Map<string, Record<string, number>>()
  for (const s of scoreRows ?? []) {
    const m = scoresByIv.get(s.interview_id) ?? {}
    m[s.rubric_key] = Number(s.score)
    scoresByIv.set(s.interview_id, m)
  }
  const noted = new Set<string>()
  for (const n of noteRows ?? []) if ((n.note ?? '').trim()) noted.add(n.interview_id)

  const rows: ScoreRow[] = interviews.map((r) => ({
    interviewId: r.id as string,
    candidateName: candName.get(r.candidate_email as string) ?? null,
    candidateEmail: r.candidate_email as string,
    round: r.round as 1 | 2,
    interviewerName: ivrName.get(r.interviewer_email as string) ?? null,
    recommendation: (r.recommendation as Recommendation) ?? null,
    scores: scoresByIv.get(r.id as string) ?? {},
    hasNotes: noted.has(r.id as string) || scoresByIv.has(r.id as string) || !!r.recommendation,
  }))
  return { rubrics, rows }
}

// ── AI review of an interview's notes (OpenAI) ───────────────────────────────
export type { NotesReviewResult } from '@/lib/interviewNotesReview'

/** Have the LLM QA one interview's notes: overall quality, per-question gaps,
 *  and whether the notes justify the interviewer's rubric scores. Staff-only. */
export async function reviewInterviewNotes(interviewId: string): Promise<Ok<NotesReviewResult> | Err> {
  await requireStaff()
  const a = admin()

  const { data: iv } = await a.from('interviews').select('*').eq('id', interviewId).maybeSingle()
  if (!iv) return { ok: false, error: 'Interview not found.' }

  const [{ data: prospect }, { data: qs }, { data: rs }, { data: ns }, { data: sc }] = await Promise.all([
    a.from('prospects').select('name').eq('email', iv.candidate_email).maybeSingle(),
    a.from('interview_questions').select('*').eq('active', true).order('ordering'),
    a.from('interview_rubrics').select('*').eq('active', true).order('ordering'),
    a.from('interview_notes').select('question_id, note').eq('interview_id', interviewId),
    a.from('interview_scores').select('rubric_key, score').eq('interview_id', interviewId),
  ])

  const round = iv.round as 1 | 2
  const questions = (qs ?? []).map(toQuestion).filter((q) => q.round === null || q.round === round)
  const noteBy = new Map((ns ?? []).map((n) => [n.question_id, (n.note ?? '') as string]))
  const scoreBy = new Map((sc ?? []).map((s) => [s.rubric_key, Number(s.score)]))

  // Nothing to review if the interviewer wrote no notes and left no scores.
  const anyNotes = questions.some((q) => (noteBy.get(q.id) ?? '').trim()) || (iv.summary ?? '').trim()
  if (!anyNotes && scoreBy.size === 0) {
    return { ok: false, error: 'No notes or scores to review yet.' }
  }

  const input: NotesReviewInput = {
    candidateName: (prospect?.name as string) ?? (iv.candidate_email as string),
    round,
    questions: questions.map((q, i) => ({
      n: i + 1,
      section: q.section,
      prompt: q.prompt,
      note: noteBy.get(q.id) ?? '',
      notesOptional: isNotesOptional(q.prompt),
    })),
    rubrics: rubricsForRound((rs ?? []).map(toRubric), round).map((r) => ({
      label: r.label,
      levels: r.levels.map((l) => ({ score: l.score, descriptor: l.descriptor, lookingFor: l.lookingFor })),
      score: scoreBy.get(r.key) ?? null,
    })),
    summary: (iv.summary as string) ?? '',
    recommendation: (iv.recommendation as string) ?? null,
  }

  try {
    const raw = await chatJSON({ system: NOTES_REVIEW_SYSTEM, user: buildNotesReviewUserPrompt(input) })
    return { ok: true, data: parseNotesReview(raw) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'AI review failed.' }
  }
}

// ── Admin config: question bank + rubrics ─────────────────────────────────────
export async function getInterviewContent(): Promise<{ questions: InterviewQuestion[]; rubrics: InterviewRubric[] }> {
  await requireStaff()
  const a = admin()
  const [{ data: qs }, { data: rs }] = await Promise.all([
    a.from('interview_questions').select('*').order('ordering'),
    a.from('interview_rubrics').select('*').order('ordering'),
  ])
  return { questions: (qs ?? []).map(toQuestion), rubrics: (rs ?? []).map(toRubric) }
}

export async function upsertQuestion(input: {
  id?: string
  round: 1 | 2 | null
  section?: string
  ordering: number
  prompt: string
  purpose?: string
  strongAnswer?: string
  weakAnswer?: string
  probe?: string
  active?: boolean
}): Promise<Ok<null> | Err> {
  await requireStaff()
  if (!input.prompt?.trim()) return { ok: false, error: 'A question prompt is required.' }
  const row = {
    ...(input.id ? { id: input.id } : {}),
    round: input.round, section: input.section?.trim() || null, ordering: input.ordering, prompt: input.prompt.trim(),
    purpose: input.purpose?.trim() || null, strong_answer: input.strongAnswer?.trim() || null,
    weak_answer: input.weakAnswer?.trim() || null, probe: input.probe?.trim() || null,
    active: input.active ?? true, updated_at: new Date().toISOString(),
  }
  const { error } = await admin().from('interview_questions').upsert(row)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews/questions')
  return { ok: true, data: null }
}

export async function deleteQuestion(id: string): Promise<Ok<null> | Err> {
  await requireStaff()
  const { error } = await admin().from('interview_questions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews/questions')
  return { ok: true, data: null }
}

export async function upsertRubric(input: {
  key: string
  label: string
  round: 1 | 2 | null
  ordering: number
  note?: string
  levels: { score: number; descriptor: string; lookingFor?: string; example?: string }[]
  active?: boolean
}): Promise<Ok<null> | Err> {
  await requireStaff()
  if (!input.key?.trim() || !input.label?.trim()) return { ok: false, error: 'Rubric key and label are required.' }
  // Keep only levels with a real descriptor, normalise + sort by score.
  const levels = input.levels
    .filter((l) => Number.isFinite(l.score) && (l.descriptor ?? '').trim() !== '')
    .map((l) => ({
      score: l.score,
      descriptor: l.descriptor.trim(),
      looking_for: l.lookingFor?.trim() || null,
      example: l.example?.trim() || null,
    }))
    .sort((a, b) => a.score - b.score)
  if (!levels.length) return { ok: false, error: 'Add at least one score level.' }
  if (new Set(levels.map((l) => l.score)).size !== levels.length)
    return { ok: false, error: 'Each level needs a distinct score.' }

  const { error } = await admin().from('interview_rubrics').upsert({
    key: input.key.trim(),
    label: input.label.trim(),
    round: input.round,
    ordering: input.ordering,
    note: input.note?.trim() || null,
    levels,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews/questions')
  return { ok: true, data: null }
}
