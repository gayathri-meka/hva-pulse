-- 073: Refresh the interview rubrics to the calibrated 6-rubric set.
--
-- Migration 072's original seed only had 4 rubrics; anyone who applied it before
-- the seed was updated is missing Program Alignment + Time Commitment and has the
-- old anchor text. This re-runs the upsert so every environment converges on the
-- same six rubrics. Idempotent (ON CONFLICT DO UPDATE) — safe to re-apply.

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
  active = true,
  updated_at = now();
