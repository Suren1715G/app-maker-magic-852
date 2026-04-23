-- Add AI customization fields to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ai_system_prompt text,
  ADD COLUMN IF NOT EXISTS ai_first_message text,
  ADD COLUMN IF NOT EXISTS ai_voice_id text;

-- Allow company admins to update their own company's AI settings
CREATE POLICY "Company admins can update their company"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin')
)
WITH CHECK (
  id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND public.has_role(auth.uid(), 'company_admin')
);