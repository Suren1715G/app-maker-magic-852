CREATE TABLE public.sms_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer text,
  phone text NOT NULL,
  unread integer NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, phone)
);

CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
  direction text NOT NULL,
  body text NOT NULL,
  delivered boolean NOT NULL DEFAULT true,
  external_id text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_threads_company_last ON public.sms_threads(company_id, last_message_at DESC);
CREATE INDEX idx_sms_messages_company_sent ON public.sms_messages(company_id, sent_at DESC);
CREATE INDEX idx_sms_messages_thread_sent ON public.sms_messages(thread_id, sent_at ASC);
CREATE UNIQUE INDEX idx_sms_messages_external_id ON public.sms_messages(external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.sms_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all sms threads"
ON public.sms_threads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view their company sms threads"
ON public.sms_threads
FOR SELECT
TO authenticated
USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Company admins create sms threads"
ON public.sms_threads
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE POLICY "Company admins update sms threads"
ON public.sms_threads
FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
)
WITH CHECK (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE POLICY "Company admins delete sms threads"
ON public.sms_threads
FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE POLICY "Admins manage all sms messages"
ON public.sms_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view their company sms messages"
ON public.sms_messages
FOR SELECT
TO authenticated
USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Company admins create sms messages"
ON public.sms_messages
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE POLICY "Company admins update sms messages"
ON public.sms_messages
FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
)
WITH CHECK (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE POLICY "Company admins delete sms messages"
ON public.sms_messages
FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin'::app_role)
);

CREATE TRIGGER update_sms_threads_updated_at
BEFORE UPDATE ON public.sms_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_messages_updated_at
BEFORE UPDATE ON public.sms_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;