CREATE OR REPLACE FUNCTION public.company_set_line_google(_line_id uuid, _owner_user_id uuid, _calendar_id text, _calendar_summary text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _owner_company uuid;
BEGIN
  _company_id := public._assert_company_owns_line(_line_id);

  IF _calendar_id IS NULL OR length(trim(_calendar_id)) = 0 THEN
    RAISE EXCEPTION 'calendar_id required';
  END IF;

  IF _owner_user_id = _line_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
      RAISE EXCEPTION 'That line has not connected its Google account';
    END IF;
  ELSE
    SELECT company_id INTO _owner_company FROM public.profiles WHERE user_id = _owner_user_id;
    IF _owner_company IS NULL OR _owner_company <> _company_id THEN
      RAISE EXCEPTION 'Calendar owner must be a member of this company';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
      RAISE EXCEPTION 'That team member has not connected their Google account';
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_line_google(_line_id uuid, _owner_user_id uuid, _calendar_id text, _calendar_summary text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _owner_company uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT company_id INTO _company_id FROM public.company_phone_numbers WHERE id = _line_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Line not found';
  END IF;

  IF _calendar_id IS NULL OR length(trim(_calendar_id)) = 0 THEN
    RAISE EXCEPTION 'calendar_id required';
  END IF;

  IF _owner_user_id = _line_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
      RAISE EXCEPTION 'That line has not connected its Google account';
    END IF;
  ELSE
    SELECT company_id INTO _owner_company FROM public.profiles WHERE user_id = _owner_user_id;
    IF _owner_company IS NULL OR _owner_company <> _company_id THEN
      RAISE EXCEPTION 'Owner must be a member of this company';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = _owner_user_id) THEN
      RAISE EXCEPTION 'That team member has not connected their Google account';
    END IF;
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
$function$;