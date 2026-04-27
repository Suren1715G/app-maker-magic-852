-- 1. New columns on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS shared_calendar_id text,
  ADD COLUMN IF NOT EXISTS shared_calendar_summary text,
  ADD COLUMN IF NOT EXISTS shared_calendar_owner_user_id uuid;

-- 2. Allow ANY company member (not just admins) to update the shared-calendar fields
--    on their own company. Existing admin-only update policy stays for everything else.
CREATE POLICY "Members set shared calendar"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- 3. Security-definer helper used by the google-calendar edge function to resolve
--    the owner's Google tokens for a company. Restricted: caller must be a member
--    of that company.
CREATE OR REPLACE FUNCTION public.get_company_calendar_connection(_company_id uuid)
RETURNS TABLE (
  calendar_id text,
  calendar_summary text,
  owner_user_id uuid,
  owner_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must belong to the company, OR be a global admin,
  -- OR be the service role (auth.uid() is null).
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE user_id = auth.uid() AND company_id = _company_id
     )
  THEN
    RAISE EXCEPTION 'Not authorized for this company';
  END IF;

  RETURN QUERY
  SELECT
    c.shared_calendar_id,
    c.shared_calendar_summary,
    c.shared_calendar_owner_user_id,
    t.google_email,
    t.access_token,
    t.refresh_token,
    t.expires_at
  FROM public.companies c
  LEFT JOIN public.user_google_tokens t
    ON t.user_id = c.shared_calendar_owner_user_id
  WHERE c.id = _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_calendar_connection(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_company_calendar_connection(uuid) TO authenticated, service_role;