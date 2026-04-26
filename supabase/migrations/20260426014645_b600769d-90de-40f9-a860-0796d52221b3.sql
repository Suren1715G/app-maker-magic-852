-- Add missing unique constraints required by webhook upserts
-- Use partial unique indexes to ignore rows where external_id is null
CREATE UNIQUE INDEX IF NOT EXISTS calls_source_external_id_key
  ON public.calls (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_external_id_key
  ON public.sms_messages (external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sms_threads_company_phone_key
  ON public.sms_threads (company_id, phone);