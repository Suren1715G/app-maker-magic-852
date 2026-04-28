-- Referrals tracking table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'qualified'
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can see referrals they made
CREATE POLICY "Users view own referrals"
ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = referrer_user_id);

-- Admins manage all
CREATE POLICY "Admins manage all referrals"
ON public.referrals FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function called from handle_new_user trigger to record referral attribution
CREATE OR REPLACE FUNCTION public.record_referral(_referred_user_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer uuid;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN;
  END IF;

  SELECT user_id INTO _referrer
  FROM public.referral_codes
  WHERE code = upper(trim(_code))
  LIMIT 1;

  IF _referrer IS NULL OR _referrer = _referred_user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (_referrer, _referred_user_id, upper(trim(_code)), 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;
END;
$$;

-- Admin-only RPC to mark a referral as qualified (called from Stripe webhook on website later)
CREATE OR REPLACE FUNCTION public.mark_referral_qualified(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.referrals
    SET status = 'qualified', qualified_at = now()
    WHERE referred_user_id = _referred_user_id AND status <> 'qualified';

  RETURN FOUND;
END;
$$;

-- Update handle_new_user to also capture referral_code from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _company_id uuid;
  _provider text;
  _ref_code text;
BEGIN
  _code := NEW.raw_user_meta_data ->> 'access_code';
  _provider := NEW.raw_app_meta_data ->> 'provider';
  _ref_code := NEW.raw_user_meta_data ->> 'referral_code';

  IF _code IS NOT NULL AND length(_code) > 0 THEN
    _company_id := public.redeem_access_code(_code, NEW.id);
  ELSIF _provider IS NULL OR _provider = 'email' THEN
    RAISE EXCEPTION 'An access code is required to sign up';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, business_name, company_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    NEW.raw_user_meta_data ->> 'business_name',
    _company_id
  );

  IF _company_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'company_admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Record referral attribution if a code was provided
  IF _ref_code IS NOT NULL AND length(trim(_ref_code)) > 0 THEN
    PERFORM public.record_referral(NEW.id, _ref_code);
  END IF;

  RETURN NEW;
END;
$$;