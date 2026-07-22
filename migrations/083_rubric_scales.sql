-- 083: Flexible rubric scales + round-scoped rubrics.
--
-- Rubrics move from fixed levels 1..4 (integer scores) to a variable `levels`
-- list — each level carries its own score, so scales can be fractional and uneven
-- (Articulation = 1,2,2.5,3,3.5,4) and needn't start at 1 (Reading Comprehension
-- starts at 2). Scores become numeric. Rubrics are round-scoped like questions.

-- Columns: variable levels (jsonb array of {score, descriptor, looking_for, example}),
-- the round it applies to, and a per-rubric interviewer note.
ALTER TABLE public.interview_rubrics
  ADD COLUMN IF NOT EXISTS levels jsonb,
  ADD COLUMN IF NOT EXISTS round smallint CHECK (round IN (1, 2)),
  ADD COLUMN IF NOT EXISTS note text;

-- Existing rubrics are all Motivation (round 1). toRubric falls back to the legacy
-- level_1..4 columns when `levels` is null, so untouched rubrics keep working.
UPDATE public.interview_rubrics SET round = 1 WHERE round IS NULL;

-- Scores become fractional-capable.
ALTER TABLE public.interview_scores DROP CONSTRAINT IF EXISTS interview_scores_score_check;
ALTER TABLE public.interview_scores ALTER COLUMN score TYPE numeric USING score::numeric;

-- ── Articulation — Motivation (replace with the 6-point scale) ───────────────
UPDATE public.interview_rubrics SET
  label = 'Articulation',
  round = 1,
  note = 'Check this mainly through open-ended questions. Mention clearly whether the difficulty is with the learner''s comprehension or the difficulty level of a few questions.',
  levels = '[
    {"score": 1,   "descriptor": "Speaks only in their mother tongue or is unable to respond."},
    {"score": 2,   "descriptor": "Tries to speak in English but needs frequent nudging. Uses mostly words or unclear phrases and is difficult to understand."},
    {"score": 2.5, "descriptor": "Forms short sentences but switches to their mother tongue for complex answers. Uses incomplete sentences and needs probing to explain clearly."},
    {"score": 3,   "descriptor": "Can express basic ideas in English but may get stuck, sound very casual, or make several grammar and pronunciation mistakes. The overall meaning is understandable."},
    {"score": 3.5, "descriptor": "Expresses thoughts clearly using complete sentences. May make minor grammar mistakes but communicates without much difficulty."},
    {"score": 4,   "descriptor": "Communicates clearly, confidently, and professionally at the level expected in an interview."}
  ]'::jsonb
WHERE key = 'articulation';

-- ── Comprehension → Listening Comprehension — Motivation (5-point) ────────────
UPDATE public.interview_rubrics SET
  label = 'Listening Comprehension',
  round = 1,
  note = 'Check this mainly through open-ended questions. Mention clearly whether the difficulty is with the learner''s comprehension or the difficulty level of a few questions.',
  levels = '[
    {"score": 1,   "descriptor": "Cannot understand questions in English and needs translation into their mother tongue."},
    {"score": 2,   "descriptor": "Understands only after repeated simplification and examples. The answer may still be different from what is asked."},
    {"score": 3,   "descriptor": "Understands partly but may not listen carefully, clarify doubts, or give a relevant answer. Needs probing for complex questions."},
    {"score": 3.5, "descriptor": "Understands on the first attempt, asks for clarification when needed, thinks before answering, and gives relevant examples."},
    {"score": 4,   "descriptor": "Understands all questions clearly without repetition, simplification, or examples."}
  ]'::jsonb
WHERE key = 'comprehension';

-- ── Reading Comprehension — Coding (round 2, new; 4-point starting at 2) ──────
INSERT INTO public.interview_rubrics (key, label, round, ordering, note, levels, active)
VALUES (
  'reading_comprehension', 'Reading Comprehension', 2, 1, NULL,
  '[
    {"score": 2,   "descriptor": "Struggles to understand the question, even after explanation."},
    {"score": 3,   "descriptor": "Understands only after repeated explanation or nudges, but still misses important instructions. May not ask relevant questions."},
    {"score": 3.5, "descriptor": "Understands most of the question with small clarification, but may assume, rush, or miss details. May need minor nudges."},
    {"score": 4,   "descriptor": "Took enough time, understands the question and instructions clearly and proceeds correctly."}
  ]'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, round = EXCLUDED.round, note = EXCLUDED.note, levels = EXCLUDED.levels, active = true;
