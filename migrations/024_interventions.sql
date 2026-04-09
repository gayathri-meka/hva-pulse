-- Remove old case tables and create the new learning_interventions table

DROP TABLE IF EXISTS public.learning_cases CASCADE;
DROP TABLE IF EXISTS public.learning_case_categories CASCADE;

-- ── Interventions ─────────────────────────────────────────────────────────────

CREATE TABLE public.learning_interventions (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  learner_id text NOT NULL,
  opened_by  uuid,

  -- open → in_progress (step 1 saved) → monitoring (step 2 saved) → closed
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'monitoring', 'closed')),

  -- Step 1: Root cause
  root_cause_category text CHECK (root_cause_category IN (
    'Life circumstance', 'Content difficulty',
    'Motivation / confidence', 'External commitments', 'Other'
  )),
  root_cause_notes   text,
  step1_completed_at timestamptz,

  -- Step 2: Action plan
  -- Each item: { "description": text, "owner": text, "due_date": text | null }
  action_items       jsonb NOT NULL DEFAULT '[]',
  step2_completed_at timestamptz,

  -- Step 3: Monitor
  resurface_date   date,
  last_reviewed_at timestamptz,

  -- Close
  outcome      text CHECK (outcome IN ('resolved', 'dropped', 'other')),
  outcome_note text,
  closed_at    timestamptz,
  closed_by    uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT learning_interventions_pkey         PRIMARY KEY (id),
  CONSTRAINT learning_interventions_learner_fkey FOREIGN KEY (learner_id)
    REFERENCES public.learners(learner_id) ON DELETE CASCADE,
  CONSTRAINT learning_interventions_opener_fkey  FOREIGN KEY (opened_by)
    REFERENCES public.users(id),
  CONSTRAINT learning_interventions_closer_fkey  FOREIGN KEY (closed_by)
    REFERENCES public.users(id)
);

-- One active intervention per learner at a time (enforced at DB level)
CREATE UNIQUE INDEX learning_interventions_active_idx
  ON public.learning_interventions(learner_id)
  WHERE status != 'closed';

CREATE INDEX learning_interventions_status_idx
  ON public.learning_interventions(status);

-- Fast lookup for resurface date highlighting on the dashboard
CREATE INDEX learning_interventions_resurface_idx
  ON public.learning_interventions(resurface_date)
  WHERE status = 'monitoring';
