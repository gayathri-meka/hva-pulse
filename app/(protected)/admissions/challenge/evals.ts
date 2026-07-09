'use server'

import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/auth'
import { validateEvalInput, type GradingEval, type EvalVerdict } from '@/lib/evals'

// Grading-eval store ops. Program-agnostic (keyed by `context`); first exposed in
// Admissions → Challenge by-question view, reusable by other programs later.

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase()

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

/** Upsert the team's label on one grading event (single-rater, latest attempt). */
export async function setGradingEval(input: {
  context: string
  questionId: string
  learnerEmail: string
  attemptAt: string
  verdict: EvalVerdict
  symptoms: string[]
  comment?: string
  aiScore?: string | null
  aiFeedback?: string | null
  scorecardSnapshot?: string | null
}): Promise<Ok<GradingEval> | Err> {
  const user = await requireStaff()
  const questionId = input.questionId?.trim()
  const learnerEmail = norm(input.learnerEmail)
  const context = input.context?.trim()
  const attemptAt = (input.attemptAt ?? '').trim()
  if (!context || !questionId || !learnerEmail) return { ok: false, error: 'Missing grading event.' }

  const valid = validateEvalInput({ verdict: input.verdict, symptoms: input.symptoms })
  if (!valid.ok) return valid

  const symptoms = input.verdict === 'incorrect' ? input.symptoms : []
  const { data, error } = await adminClient()
    .from('sensai_grading_evals')
    .upsert(
      {
        context,
        question_id: questionId,
        learner_email: learnerEmail,
        attempt_at: attemptAt,
        verdict: input.verdict,
        symptoms,
        comment: input.comment?.trim() || null,
        ai_score: input.aiScore ?? null,
        ai_feedback: input.aiFeedback ?? null,
        scorecard_snapshot: input.scorecardSnapshot ?? null,
        labeled_by: user.email,
        labeled_by_name: user.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'context,question_id,learner_email,attempt_at' },
    )
    .select('question_id, learner_email, attempt_at, verdict, symptoms, comment, labeled_by_name, updated_at')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: rowToEval(data) }
}

/** The current label for one graded attempt, or null if not yet reviewed. */
export async function getGradingEval(
  context: string,
  questionId: string,
  learnerEmail: string,
  attemptAt: string,
): Promise<GradingEval | null> {
  await requireStaff()
  const { data } = await adminClient()
    .from('sensai_grading_evals')
    .select('question_id, learner_email, attempt_at, verdict, symptoms, comment, labeled_by_name, updated_at')
    .eq('context', context.trim())
    .eq('question_id', questionId.trim())
    .eq('learner_email', norm(learnerEmail))
    .eq('attempt_at', (attemptAt ?? '').trim())
    .maybeSingle()
  return data ? rowToEval(data) : null
}

/** Labels for one question (for the cross-learner by-question view). */
export async function getQuestionEvals(context: string, questionId: string): Promise<GradingEval[]> {
  await requireStaff()
  const { data } = await adminClient()
    .from('sensai_grading_evals')
    .select('question_id, learner_email, attempt_at, verdict, symptoms, comment, labeled_by_name, updated_at')
    .eq('context', context.trim())
    .eq('question_id', questionId.trim())
  return (data ?? []).map(rowToEval)
}

/** All labels for a context (for accuracy + per-question stats). */
export async function getGradingEvals(context: string): Promise<GradingEval[]> {
  await requireStaff()
  const { data } = await adminClient()
    .from('sensai_grading_evals')
    .select('question_id, learner_email, attempt_at, verdict, symptoms, comment, labeled_by_name, updated_at')
    .eq('context', context.trim())
  return (data ?? []).map(rowToEval)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEval(r: any): GradingEval {
  return {
    questionId: r.question_id,
    learnerEmail: r.learner_email,
    attemptAt: r.attempt_at ?? '',
    verdict: r.verdict,
    symptoms: r.symptoms ?? [],
    comment: r.comment ?? null,
    labeledByName: r.labeled_by_name ?? null,
    updatedAt: r.updated_at,
  }
}
