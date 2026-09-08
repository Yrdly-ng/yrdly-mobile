ALTER TABLE public.safety_alerts
  ADD COLUMN is_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN resolved_at timestamptz;
