
CREATE TABLE public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_requests_created ON public.feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_company ON public.feature_requests(company_id);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all feature requests"
  ON public.feature_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company admins submit feature requests"
  ON public.feature_requests FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Members view their company feature requests"
  ON public.feature_requests FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
