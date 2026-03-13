CREATE TABLE public.settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (key, value) VALUES
  ('placement_thresholds', '{"demand_target": 10, "engagement_target": 5, "conversion_target": 0.5}');
