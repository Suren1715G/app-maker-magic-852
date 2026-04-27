
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notes_due_pending
  ON public.notes (due_at)
  WHERE done = false AND reminded_at IS NULL AND due_at IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
