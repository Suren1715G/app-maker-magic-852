
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'company_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add company_id to profiles BEFORE policies that reference it
ALTER TABLE public.profiles
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Now the policy that references profiles.company_id can be created
CREATE POLICY "Members view their company"
  ON public.companies FOR SELECT TO authenticated
  USING (
    id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 4. Access codes
CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_access_codes_code ON public.access_codes(code);

CREATE POLICY "Admins manage access codes"
  ON public.access_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Redeem function
CREATE OR REPLACE FUNCTION public.redeem_access_code(_code text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id
  FROM public.access_codes
  WHERE code = _code AND used_by IS NULL
  FOR UPDATE;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already used access code';
  END IF;

  UPDATE public.access_codes
    SET used_by = _user_id, used_at = now()
    WHERE code = _code;

  RETURN _company_id;
END;
$$;

-- 6. Replace handle_new_user to require + consume a code for email signup
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
BEGIN
  _code := NEW.raw_user_meta_data ->> 'access_code';
  _provider := NEW.raw_app_meta_data ->> 'provider';

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Post-signup claim function for Google users who didn't have a code at OAuth time
CREATE OR REPLACE FUNCTION public.claim_access_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _existing uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO _existing FROM public.profiles WHERE user_id = _user_id;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'You are already linked to a company';
  END IF;

  _company_id := public.redeem_access_code(_code, _user_id);

  UPDATE public.profiles SET company_id = _company_id WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'company_admin')
  ON CONFLICT DO NOTHING;

  RETURN _company_id;
END;
$$;
