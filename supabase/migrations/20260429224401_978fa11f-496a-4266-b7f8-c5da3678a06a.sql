-- Allow service-role (auth.uid() is null) to call admin RPCs from trusted edge functions.
-- Authenticated callers must still be admins.

CREATE OR REPLACE FUNCTION public.admin_save_company_google_tokens(
  _company_id uuid, _google_email text, _access_token text, _refresh_token text,
  _expires_at timestamp with time zone, _scope text, _calendar_id text, _calendar_summary text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _synthetic_user uuid := _company_id;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
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
         acuity_user_id                = NULL,
         acuity_api_key                = NULL,
         acuity_appointment_type_id    = NULL,
         acuity_scheduling_url         = NULL,
         updated_at                    = now()
   WHERE id = _company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_company_acuity(
  _company_id uuid, _user_id text, _api_key text, _appointment_type_id text, _scheduling_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prev_owner uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT shared_calendar_owner_user_id INTO _prev_owner
  FROM public.companies WHERE id = _company_id;

  UPDATE public.companies
     SET booking_provider              = 'acuity',
         acuity_user_id                = _user_id,
         acuity_api_key                = _api_key,
         acuity_appointment_type_id    = _appointment_type_id,
         acuity_scheduling_url         = _scheduling_url,
         shared_calendar_id            = NULL,
         shared_calendar_summary       = NULL,
         shared_calendar_owner_user_id = NULL,
         updated_at                    = now()
   WHERE id = _company_id;

  IF _prev_owner IS NOT NULL AND _prev_owner = _company_id THEN
    DELETE FROM public.user_google_tokens WHERE user_id = _company_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_clear_company_booking(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
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

  IF _owner IS NOT NULL AND _owner = _company_id THEN
    DELETE FROM public.user_google_tokens WHERE user_id = _company_id;
  END IF;
END;
$function$;