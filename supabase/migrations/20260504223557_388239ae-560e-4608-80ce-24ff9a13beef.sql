-- ============================================================
-- Per-line (per phone number) booking config
-- ============================================================

ALTER TABLE public.company_phone_numbers
  ADD COLUMN IF NOT EXISTS booking_provider text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS shared_calendar_id text,
  ADD COLUMN IF NOT EXISTS shared_calendar_summary text,
  ADD COLUMN IF NOT EXISTS shared_calendar_owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS acuity_appointment_type_id text;

ALTER TABLE public.company_phone_numbers
  DROP CONSTRAINT IF EXISTS company_phone_numbers_booking_provider_check;
ALTER TABLE public.company_phone_numbers
  ADD CONSTRAINT company_phone_numbers_booking_provider_check
  CHECK (booking_provider IN ('none','google','acuity'));

-- ============================================================
-- Helpers
-- ============================================================

-- Internal: assert caller is company_admin AND the line belongs to caller's company.
CREATE OR REPLACE FUNCTION public._assert_company_owns_line(_line_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _caller_company uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'company_admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT company_id INTO _company_id FROM public.company_phone_numbers WHERE id = _line_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Line not found';
  END IF;
  SELECT company_id INTO _caller_company FROM public.profiles WHERE user_id = auth.uid();
  IF _caller_company IS NULL OR _caller_company <> _company_id THEN
    RAISE EXCEPTION 'Line does not belong to your company';
  END IF;
  RETURN _company_id;
END;
$$;

-- ============================================================
-- Company admin RPCs (line-scoped)
-- ============================================================

-- Set Google calendar on a line. _owner_user_id must have a row in user_google_tokens
-- and must belong to the same company as the line.
CREATE OR REPLACE FUNCTION public.company_set_line_google(
  _line_id uuid,
  _owner_user_id uuid,
  _calendar_id text,
  _calendar_summary text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _owner_company uuid;
BEGIN
  _company_id := public._assert_company_owns_line(_line_id);
  IF _calendar_id IS NULL OR length(trim(_calendar_id)) = 0 THEN
    RAISE EXCEPTION 'calendar_id required';
  END IF;
  SELECT company_id INTO _owner_company FROM public.profiles WHERE user_id = _owner_user_id;
  IF _owner_company IS NULL OR _owner_company <> _company_id THEN
    RAISE EXCEPTION 'Calendar owner must be a member of this company';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
    RAISE EXCEPTION 'That team member has not connected their Google account';
  END IF;

  UPDATE public.company_phone_numbers
     SET booking_provider              = 'google',
         shared_calendar_id            = _calendar_id,
         shared_calendar_summary       = _calendar_summary,
         shared_calendar_owner_user_id = _owner_user_id,
         acuity_appointment_type_id    = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

-- Set Acuity appointment type on a line. Company must have Acuity creds at the
-- company level (we share creds across lines, only the appointment type differs).
CREATE OR REPLACE FUNCTION public.company_set_line_acuity(
  _line_id uuid,
  _appointment_type_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _has_acuity boolean;
BEGIN
  _company_id := public._assert_company_owns_line(_line_id);
  IF _appointment_type_id IS NULL OR length(trim(_appointment_type_id)) = 0 THEN
    RAISE EXCEPTION 'appointment_type_id required';
  END IF;
  SELECT (acuity_user_id IS NOT NULL AND acuity_api_key IS NOT NULL)
    INTO _has_acuity FROM public.companies WHERE id = _company_id;
  IF NOT COALESCE(_has_acuity, false) THEN
    RAISE EXCEPTION 'Connect your company Acuity account first';
  END IF;

  UPDATE public.company_phone_numbers
     SET booking_provider              = 'acuity',
         acuity_appointment_type_id    = _appointment_type_id,
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.company_clear_line_booking(_line_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  _company_id := public._assert_company_owns_line(_line_id);
  UPDATE public.company_phone_numbers
     SET booking_provider              = 'none',
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         acuity_appointment_type_id    = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

-- ============================================================
-- Master admin RPCs (line-scoped)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_line_google(
  _line_id uuid,
  _owner_user_id uuid,
  _calendar_id text,
  _calendar_summary text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _owner_company uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT company_id INTO _company_id FROM public.company_phone_numbers WHERE id = _line_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF _calendar_id IS NULL OR length(trim(_calendar_id)) = 0 THEN
    RAISE EXCEPTION 'calendar_id required';
  END IF;
  SELECT company_id INTO _owner_company FROM public.profiles WHERE user_id = _owner_user_id;
  IF _owner_company IS NULL OR _owner_company <> _company_id THEN
    RAISE EXCEPTION 'Owner must be a member of this company';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
    RAISE EXCEPTION 'That team member has not connected their Google account';
  END IF;

  UPDATE public.company_phone_numbers
     SET booking_provider              = 'google',
         shared_calendar_id            = _calendar_id,
         shared_calendar_summary       = _calendar_summary,
         shared_calendar_owner_user_id = _owner_user_id,
         acuity_appointment_type_id    = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_line_acuity(
  _line_id uuid,
  _appointment_type_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _has_acuity boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT company_id INTO _company_id FROM public.company_phone_numbers WHERE id = _line_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF _appointment_type_id IS NULL OR length(trim(_appointment_type_id)) = 0 THEN
    RAISE EXCEPTION 'appointment_type_id required';
  END IF;
  SELECT (acuity_user_id IS NOT NULL AND acuity_api_key IS NOT NULL)
    INTO _has_acuity FROM public.companies WHERE id = _company_id;
  IF NOT COALESCE(_has_acuity, false) THEN
    RAISE EXCEPTION 'Company has no Acuity account connected';
  END IF;

  UPDATE public.company_phone_numbers
     SET booking_provider              = 'acuity',
         acuity_appointment_type_id    = _appointment_type_id,
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_line_booking(_line_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.company_phone_numbers
     SET booking_provider              = 'none',
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         acuity_appointment_type_id    = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$$;

-- ============================================================
-- Resolver used by the AI receptionist (and the assistant booking edge fn).
-- Returns the line's booking config — NO company-level fallback.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_line_booking_config(_line_id uuid)
RETURNS TABLE(
  line_id uuid,
  company_id uuid,
  provider text,
  calendar_id text,
  calendar_summary text,
  owner_user_id uuid,
  owner_email text,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  acuity_user_id text,
  acuity_api_key text,
  acuity_appointment_type_id text,
  acuity_scheduling_url text,
  business_hours_timezone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT pn.company_id INTO _company_id FROM public.company_phone_numbers pn WHERE pn.id = _line_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Line not found';
  END IF;
  -- Authorization: service role (auth.uid is null), admin, or member of the company.
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id = _company_id
     )
  THEN
    RAISE EXCEPTION 'Not authorized for this line';
  END IF;

  RETURN QUERY
  SELECT
    pn.id,
    pn.company_id,
    pn.booking_provider,
    pn.shared_calendar_id,
    pn.shared_calendar_summary,
    pn.shared_calendar_owner_user_id,
    t.google_email,
    t.access_token,
    t.refresh_token,
    t.expires_at,
    c.acuity_user_id,
    c.acuity_api_key,
    pn.acuity_appointment_type_id,
    c.acuity_scheduling_url,
    c.business_hours_timezone
  FROM public.company_phone_numbers pn
  JOIN public.companies c ON c.id = pn.company_id
  LEFT JOIN public.user_google_tokens t ON t.user_id = pn.shared_calendar_owner_user_id
  WHERE pn.id = _line_id;
END;
$$;