-- 072: Interview cockpit — question bank, rubrics, notes, scores, assessment.
--
-- The interviewer conducts an interview at /admissions/interviews/conduct/[id]:
-- reads the candidate dossier, takes notes per question, and rates the candidate on
-- rubrics (1–4). Question bank + rubrics are admin-editable config (seeded here with
-- editable drafts). Notes/scores/assessment are per-interview.

-- ── Question bank (admin-editable) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round         smallint CHECK (round IN (1, 2)),   -- NULL = asked in both rounds
  ordering      integer NOT NULL DEFAULT 0,
  prompt        text NOT NULL,
  purpose       text,
  strong_answer text,
  weak_answer   text,
  probe         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Rubrics (admin-editable; 1–4 anchored) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_rubrics (
  key        text PRIMARY KEY,          -- 'need' | 'drive' | 'articulation' | ...
  label      text NOT NULL,
  ordering   integer NOT NULL DEFAULT 0,
  level_1    text,                      -- anchor descriptions for scores 1..4
  level_2    text,
  level_3    text,
  level_4    text,
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Per-interview notes (one per question) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
  note         text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, question_id)
);

-- ── Per-interview rubric scores (1–4) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  rubric_key   text NOT NULL,
  score        smallint NOT NULL CHECK (score BETWEEN 1 AND 4),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, rubric_key)
);

-- ── Overall assessment on the interview ─────────────────────────────────────
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS recommendation text CHECK (recommendation IN ('advance', 'borderline', 'no')),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS assessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS assessed_by text,
  ADD COLUMN IF NOT EXISTS assessed_by_name text;

-- ── RLS — admin/staff manage; interviewer reads/writes via the service-role
-- client in cockpit actions (scoped to their own interview). ─────────────────
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_rubrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scores    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['interview_questions','interview_rubrics','interview_notes','interview_scores'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON public.%I', tbl);
    EXECUTE format('CREATE POLICY staff_all ON public.%I USING (public.auth_role() = ANY (ARRAY[''admin''::text, ''staff''::text]))', tbl);
  END LOOP;
END; $$;

-- ── Seed: the 6 interview rubrics (calibrated; editable in the UI) ───────────
-- Upsert so re-running this block refreshes the anchors even if the rows exist.
INSERT INTO public.interview_rubrics (key, label, ordering, level_1, level_2, level_3, level_4) VALUES
  ('need', 'Need', 1,
   'Low Need: No real financial pressure evident. Family is stable. Has strong alternative paths — good placements, family support, other programs. HVA is a convenience, not a necessity.',
   'Moderate Need: Some financial pressure but not urgent. Situation is manageable without HVA. Alternatives exist but are not strong. Wants HVA but doesn''t critically need it.',
   'High Need: Clear financial pressure with specific consequences named. Limited alternatives. HVA fills a real gap. Minor inconsistencies but the overall picture is genuine.',
   'Very High Need: Immediate financial urgency with specific family members and obligations named. No realistic alternative path. HVA is genuinely the only viable option. Consistent and specific throughout.'),
  ('drive', 'Drive', 2,
   'No evidence: No past instance of ownership or self-initiated action. Blank, vague, or entirely dependent on others for direction.',
   'Reactive: Takes responsibility only when asked, forced by circumstance, or when no one else was available. Low stakes, no real cost.',
   'Proactive: Self-initiated ownership in at least one real context without being told. Can explain why they stepped up. Some cost or effort involved. Specific and verifiable.',
   'Sustained: A pattern of ownership across multiple contexts over time. Acted against circumstances, real personal cost, intrinsically motivated.'),
  ('program_alignment', 'Program Alignment', 3,
   'Misaligned: Unrealistic expectations, indifferent between tech and non-tech, significant parallel commitments that will conflict, or doesn''t understand what HVA involves.',
   'Partially aligned: Some understanding of HVA and tech commitment, but concerning gaps — unrealistic salary expectations, strong Plan B, parallel commitments that may conflict.',
   'Mostly aligned: Understands what HVA involves, committed to tech, realistic expectations, minor concerns around parallel commitments or timeline.',
   'Fully aligned: Clear understanding of HVA''s demands, strong tech commitment with specific reasons, realistic expectations, no significant parallel commitments, willing to make tradeoffs.'),
  ('time_commitment', 'Time Commitment', 4,
   'High risk: Significant blockers that will clearly interrupt consistency — internship, parallel course, frequent travel, unclear schedule, or claimed hours don''t match actual schedule.',
   'Moderate risk: Some manageable blockers but concerning — exam periods with full shutdown, frequent home travel, parallel commitments that partially conflict.',
   'Low risk: Schedule is mostly clear; minor disruptions anticipated but the learner has thought about how to manage them.',
   'Very low risk: Clear schedule, realistic hours, no significant disruptions anticipated, honest about constraints and has a plan to manage them.'),
  ('articulation', 'Articulation', 5,
   'Cannot understand: Incomprehensible speech.',
   'Partly understands: Comprehensible but lots of grammatical mistakes, poor pronunciation.',
   'Mostly understands: Comprehensible with minimal grammatical mistakes, decent pronunciation.',
   'Fully understands: Clear communication with negligible grammatical mistakes, good pronunciation.'),
  ('comprehension', 'Comprehension', 6,
   'Does not comprehend: Consistently answers something different from what was asked. No awareness of having misunderstood.',
   'Partial comprehension: Understands the surface of the question but misses the intent. Answers only part of what was asked.',
   'Good comprehension: Understands what is being asked and answers it correctly. May occasionally need the question rephrased but gets it on the second attempt.',
   'Strong comprehension: Immediately grasps what is being asked including nuance. Never needs rephrasing. Sometimes anticipates the intent behind the question.')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, ordering = EXCLUDED.ordering,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2,
  level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  updated_at = now();

-- ── Seed: example questions (editable drafts) ───────────────────────────────
INSERT INTO public.interview_questions (round, ordering, prompt, purpose, strong_answer, weak_answer, probe) VALUES
  (NULL, 1, 'Walk us through a real setback you''ve faced. What happened, and what did you do about it?',
   'Resilience, ownership, and drive.',
   'A specific situation, takes ownership, concrete actions, and a clear learning.',
   'Vague, blames others/circumstances, no reflection or takeaway.',
   'What would you do differently now? What did it teach you?'),
  (NULL, 2, 'Why do you want to join HVA, and what would getting in change for you?',
   'Motivation and genuine need.',
   'Specific and personal; ties to their own situation and goals.',
   'Generic ("it''s a good course"); no personal stake.',
   'What happens for you if this doesn''t work out?'),
  (NULL, 3, 'Pick something you learned in the challenge and explain it to us simply.',
   'Comprehension and articulation.',
   'Clear, structured, accurate; adapts to the listener; gives an example.',
   'Jargon-heavy or muddled; inaccurate; can''t give an example.',
   'Can you give a concrete example? Where might this be used?')
ON CONFLICT DO NOTHING;
