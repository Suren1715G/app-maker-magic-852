-- Add label + status to company_phone_numbers so customers can self-serve add locations
ALTER TABLE public.company_phone_numbers
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Prevent the same number being added twice
CREATE UNIQUE INDEX IF NOT EXISTS company_phone_numbers_phone_unique
  ON public.company_phone_numbers (phone_number);

-- Status must be one of these values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_phone_numbers_status_check'
  ) THEN
    ALTER TABLE public.company_phone_numbers
      ADD CONSTRAINT company_phone_numbers_status_check
      CHECK (status IN ('pending', 'active', 'disabled'));
  END IF;
END $$;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_company_phone_numbers_updated_at ON public.company_phone_numbers;
CREATE TRIGGER update_company_phone_numbers_updated_at
  BEFORE UPDATE ON public.company_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow company admins to add their own locations (status forced to 'pending' via policy check)
DROP POLICY IF EXISTS "Company admins add phone numbers" ON public.company_phone_numbers;
CREATE POLICY "Company admins add phone numbers"
  ON public.company_phone_numbers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND status = 'pending'
  );

-- Allow company admins to rename / disable their own locations (cannot self-promote to 'active')
DROP POLICY IF EXISTS "Company admins update their phone numbers" ON public.company_phone_numbers;
CREATE POLICY "Company admins update their phone numbers"
  ON public.company_phone_numbers
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND status IN ('pending', 'disabled')
  );

-- Allow company admins to remove their pending locations
DROP POLICY IF EXISTS "Company admins delete pending phone numbers" ON public.company_phone_numbers;
CREATE POLICY "Company admins delete pending phone numbers"
  ON public.company_phone_numbers
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND status = 'pending'
  );