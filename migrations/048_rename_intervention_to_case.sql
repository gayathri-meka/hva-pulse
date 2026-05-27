-- 048: Rename the "intervention" concept to "case" everywhere it appears at
-- the schema level, and rename the inner JSONB column action_items →
-- interventions (the new term for what sits inside a case).
--
-- Old vocabulary: an Intervention contained action_items.
-- New vocabulary: a Case contains interventions.
--
-- No data shape changes — only names. Existing rows / JSON contents are kept.

-- ── Table rename ───────────────────────────────────────────────────────────────
ALTER TABLE public.interventions RENAME TO cases;

-- ── Constraint renames ─────────────────────────────────────────────────────────
ALTER TABLE public.cases RENAME CONSTRAINT interventions_pkey         TO cases_pkey;
ALTER TABLE public.cases RENAME CONSTRAINT interventions_learner_fkey TO cases_learner_fkey;
ALTER TABLE public.cases RENAME CONSTRAINT interventions_opener_fkey TO cases_opener_fkey;
ALTER TABLE public.cases RENAME CONSTRAINT interventions_closer_fkey TO cases_closer_fkey;
ALTER TABLE public.cases RENAME CONSTRAINT interventions_status_check TO cases_status_check;

-- ── Index renames ──────────────────────────────────────────────────────────────
ALTER INDEX public.interventions_active_idx    RENAME TO cases_active_idx;
ALTER INDEX public.interventions_status_idx    RENAME TO cases_status_idx;
ALTER INDEX public.interventions_resurface_idx RENAME TO cases_decision_idx;

-- ── Column rename: action_items → interventions ───────────────────────────────
ALTER TABLE public.cases RENAME COLUMN action_items TO interventions;

-- ── Settings key rename ────────────────────────────────────────────────────────
-- The `intervention_checklist_items` row in `settings` holds the configurable
-- "What's wrong?" checklist. Rename the key to match the new vocabulary so the
-- Learning Settings UI keeps reading the existing config.
UPDATE public.settings
   SET key = 'case_checklist_items'
 WHERE key = 'intervention_checklist_items';

-- RLS policy `staff_all` is generic and re-applies to the renamed table; no
-- policy rename needed.
