-- 051: Attendance tracking.
-- Two tables mirror the two tabs of the HVA Meet Logs spreadsheet:
--   Meet Codes      -> calls
--   Attendance Logs -> attendance_records (only present rows; absences are
--                      inferred at query time from learners.batch_name).
-- Synced daily via /api/sync-attendance (Vercel cron, 06:00 IST).

CREATE TABLE IF NOT EXISTS public.calls (
  meeting_code  text         PRIMARY KEY,
  name          text         NOT NULL,
  type          text         NOT NULL,
  batch         text,
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                bigserial    PRIMARY KEY,
  meeting_code      text         NOT NULL REFERENCES public.calls(meeting_code) ON DELETE CASCADE,
  participant_email text         NOT NULL,
  participant_name  text,
  call_date         date         NOT NULL,
  call_time         time,
  duration_minutes  numeric,
  organizer_email   text,
  synced_at         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_meet_email_unique UNIQUE (meeting_code, participant_email)
);

CREATE INDEX IF NOT EXISTS idx_attendance_email  ON public.attendance_records (participant_email);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON public.attendance_records (call_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_meet   ON public.attendance_records (meeting_code);
CREATE INDEX IF NOT EXISTS idx_calls_batch       ON public.calls (batch);

ALTER TABLE public.calls               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON public.calls;
CREATE POLICY staff_all ON public.calls
  FOR ALL USING (auth_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS staff_all ON public.attendance_records;
CREATE POLICY staff_all ON public.attendance_records
  FOR ALL USING (auth_role() IN ('admin', 'staff'));
