-- Create source enum
CREATE TYPE public.call_source AS ENUM ('elevenlabs', 'twilio', 'manual');

-- Create calls table
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source public.call_source NOT NULL,
  external_id TEXT,
  caller TEXT,
  phone TEXT,
  direction TEXT,
  status TEXT NOT NULL DEFAULT 'answered',
  tag TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  transcript JSONB,
  recording_url TEXT,
  metadata JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_company_started ON public.calls (company_id, started_at DESC);
CREATE UNIQUE INDEX idx_calls_source_external ON public.calls (source, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Members of a company can view their company's calls
CREATE POLICY "Members view their company's calls"
ON public.calls
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Company admins can update / delete their calls (e.g. retag, mark)
CREATE POLICY "Company admins update calls"
ON public.calls
FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin')
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin')
);

CREATE POLICY "Company admins delete calls"
ON public.calls
FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin')
);

-- Platform admins can manage everything
CREATE POLICY "Admins manage all calls"
ON public.calls
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- NOTE: No INSERT policy for end users. Inserts happen via edge functions
-- using the service role key (bypasses RLS), so webhooks from
-- ElevenLabs and Twilio are the only writers.

-- Updated_at trigger
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- ===========================================================
-- Webhook routing: map provider IDs / phone numbers -> company
-- ===========================================================
CREATE TABLE public.company_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'twilio',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their company numbers"
ON public.company_phone_numbers
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins manage phone numbers"
ON public.company_phone_numbers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.company_elevenlabs_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_elevenlabs_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their company agents"
ON public.company_elevenlabs_agents
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins manage elevenlabs agents"
ON public.company_elevenlabs_agents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));