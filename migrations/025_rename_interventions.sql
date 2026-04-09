-- Rename learning_interventions → interventions

ALTER TABLE public.learning_interventions RENAME TO interventions;

ALTER TABLE public.interventions RENAME CONSTRAINT learning_interventions_pkey         TO interventions_pkey;
ALTER TABLE public.interventions RENAME CONSTRAINT learning_interventions_learner_fkey TO interventions_learner_fkey;
ALTER TABLE public.interventions RENAME CONSTRAINT learning_interventions_opener_fkey  TO interventions_opener_fkey;
ALTER TABLE public.interventions RENAME CONSTRAINT learning_interventions_closer_fkey  TO interventions_closer_fkey;

ALTER INDEX public.learning_interventions_active_idx   RENAME TO interventions_active_idx;
ALTER INDEX public.learning_interventions_status_idx   RENAME TO interventions_status_idx;
ALTER INDEX public.learning_interventions_resurface_idx RENAME TO interventions_resurface_idx;
