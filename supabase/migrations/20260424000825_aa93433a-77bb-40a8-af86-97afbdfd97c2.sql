-- 1. Table to hold one unique referral code per user
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_codes_code ON public.referral_codes (code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own code
CREATE POLICY "Users view own referral code"
ON public.referral_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all codes
CREATE POLICY "Admins view all referral codes"
ON public.referral_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies for users — codes are managed by triggers/functions only.

-- 2. Helper to generate a random short alphanumeric code (no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(
        alphabet,
        1 + floor(random() * length(alphabet))::int,
        1
      );
    END LOOP;

    -- Ensure uniqueness; retry on collision
    PERFORM 1 FROM public.referral_codes WHERE code = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;

    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after % attempts', attempts;
    END IF;
  END LOOP;
END;
$$;

-- 3. Trigger function: assign a referral code whenever a profile is inserted
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.user_id, public.generate_referral_code())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_referral_code ON public.profiles;
CREATE TRIGGER profiles_assign_referral_code
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_referral_code();

-- 4. Backfill: give every existing profile a referral code if missing
INSERT INTO public.referral_codes (user_id, code)
SELECT p.user_id, public.generate_referral_code()
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE rc.user_id IS NULL;

-- 5. Public lookup helper: resolve a referral code to a user id (for signup attribution)
-- Returns NULL if code not found. Does not expose any other user data.
CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.referral_codes WHERE code = upper(_code) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated;