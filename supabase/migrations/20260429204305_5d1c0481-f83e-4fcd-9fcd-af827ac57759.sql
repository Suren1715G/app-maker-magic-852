
-- 1. Booking provider fields on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS booking_provider text NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS calendly_access_token text,
  ADD COLUMN IF NOT EXISTS calendly_user_uri text,
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri text,
  ADD COLUMN IF NOT EXISTS calendly_scheduling_url text,
  ADD COLUMN IF NOT EXISTS acuity_user_id text,
  ADD COLUMN IF NOT EXISTS acuity_api_key text,
  ADD COLUMN IF NOT EXISTS acuity_appointment_type_id text,
  ADD COLUMN IF NOT EXISTS acuity_scheduling_url text;

-- Constrain provider values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_booking_provider_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_booking_provider_check
      CHECK (booking_provider IN ('google','calendly','acuity'));
  END IF;
END $$;

-- 2. Pending admin Google OAuth flows (state -> company_id)
CREATE TABLE IF NOT EXISTS public.pending_admin_google_oauth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  admin_user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz
);

ALTER TABLE public.pending_admin_google_oauth ENABLE ROW LEVEL SECURITY;

-- Only admins can see / manage pending flows
CREATE POLICY "Admins manage pending admin oauth"
  ON public.pending_admin_google_oauth
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Admin-only RPC: save Google tokens against an arbitrary company.
-- The "owner" user is a synthetic per-company id stored in user_google_tokens
-- so existing get_company_calendar_connection() keeps working unchanged.
-- We use the company_id itself as the user_id key (uuids are the same shape).
CREATE OR REPLACE FUNCTION public.admin_save_company_google_tokens(
  _company_id uuid,
  _google_email text,
  _access_token text,
  _refresh_token text,
  _expires_at timestamptz,
  _scope text,
  _calendar_id text,
  _calendar_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _synthetic_user uuid := _company_id;  -- reuse company id as the token row key
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_google_tokens
    (user_id, google_email, access_token, refresh_token, expires_at, scope)
  VALUES
    (_synthetic_user, _google_email, _access_token, _refresh_token, _expires_at, _scope)
  ON CONFLICT (user_id) DO UPDATE SET
    google_email  = EXCLUDED.google_email,
    access_token  = EXCLUDED.access_token,
    refresh_token = COALESCE(EXCLUDED.refresh_token, public.user_google_tokens.refresh_token),
    expires_at    = EXCLUDED.expires_at,
    scope         = EXCLUDED.scope,
    updated_at    = now();

  UPDATE public.companies
     SET booking_provider              = 'google',
         shared_calendar_id            = _calendar_id,
         shared_calendar_summary       = _calendar_summary,
         shared_calendar_owner_user_id = _synthetic_user,
         updated_at                    = now()
   WHERE id = _company_id;
END;
$$;

-- 4. Admin RPC: set Calendly config for a company
CREATE OR REPLACE FUNCTION public.admin_set_company_calendly(
  _company_id uuid,
  _access_token text,
  _user_uri text,
  _event_type_uri text,
  _scheduling_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
     SET booking_provider          = 'calendly',
         calendly_access_token     = _access_token,
         calendly_user_uri         = _user_uri,
         calendly_event_type_uri   = _event_type_uri,
         calendly_scheduling_url   = _scheduling_url,
         updated_at                = now()
   WHERE id = _company_id;
END;
$$;

-- 5. Admin RPC: set Acuity config for a company
CREATE OR REPLACE FUNCTION public.admin_set_company_acuity(
  _company_id uuid,
  _user_id text,
  _api_key text,
  _appointment_type_id text,
  _scheduling_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
     SET booking_provider           = 'acuity',
         acuity_user_id             = _user_id,
         acuity_api_key             = _api_key,
         acuity_appointment_type_id = _appointment_type_id,
         acuity_scheduling_url      = _scheduling_url,
         updated_at                 = now()
   WHERE id = _company_id;
END;
$$;

-- 6. Admin RPC: clear booking integration
CREATE OR REPLACE FUNCTION public.admin_clear_company_booking(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT shared_calendar_owner_user_id INTO _owner
  FROM public.companies WHERE id = _company_id;

  UPDATE public.companies
     SET booking_provider              = 'google',
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         calendly_access_token         = NULL,
         calendly_user_uri             = NULL,
         calendly_event_type_uri       = NULL,
         calendly_scheduling_url       = NULL,
         acuity_user_id                = NULL,
         acuity_api_key                = NULL,
         acuity_appointment_type_id    = NULL,
         acuity_scheduling_url         = NULL,
         updated_at                    = now()
   WHERE id = _company_id;

  -- If we were holding admin-managed Google tokens (user_id == company_id), drop them.
  IF _owner IS NOT NULL AND _owner = _company_id THEN
    DELETE FROM public.user_google_tokens WHERE user_id = _company_id;
  END IF;
END;
$$;
