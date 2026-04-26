DROP INDEX IF EXISTS public.calls_source_external_id_key;
DROP INDEX IF EXISTS public.sms_messages_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS calls_source_external_id_key
  ON public.calls (source, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_external_id_key
  ON public.sms_messages (external_id);