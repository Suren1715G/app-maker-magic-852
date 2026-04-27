
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS google_business_account_id text,
  ADD COLUMN IF NOT EXISTS google_business_location_id text,
  ADD COLUMN IF NOT EXISTS google_business_location_name text,
  ADD COLUMN IF NOT EXISTS google_business_owner_user_id uuid;

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  google_review_id text,
  reviewer_name text,
  reviewer_photo_url text,
  rating int NOT NULL DEFAULT 5,
  comment text,
  reply_text text,
  reply_updated_at timestamptz,
  posted_at timestamptz NOT NULL DEFAULT now(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'google',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, google_review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_company_posted
  ON public.reviews (company_id, posted_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their company reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins update reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  );

CREATE POLICY "Company admins delete reviews"
  ON public.reviews FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  );

CREATE POLICY "Admins manage all reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
