
ALTER TABLE public.pending_admin_google_oauth
  ADD COLUMN IF NOT EXISTS line_id uuid NULL;

CREATE OR REPLACE FUNCTION public.admin_save_line_google_tokens(
  _line_id uuid,
  _google_email text,
  _access_token text,
  _refresh_token text,
  _expires_at timestamp with time zone,
  _scope text,
  _calendar_id text,
  _calendar_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _synthetic_user uuid := _line_id;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT company_id INTO _company_id
  FROM public.company_phone_numbers WHERE id = _line_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Line not found';
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

  UPDATE public.company_phone_numbers
     SET booking_provider              = 'google',
         shared_calendar_id            = _calendar_id,
         shared_calendar_summary       = _calendar_summary,
         shared_calendar_owner_user_id = _synthetic_user,
         acuity_appointment_type_id    = NULL,
         updated_at                    = now()
   WHERE id = _line_id;
END;
$function$;
