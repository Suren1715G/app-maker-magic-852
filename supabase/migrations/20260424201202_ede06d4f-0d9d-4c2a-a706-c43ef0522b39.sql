CREATE TABLE public.location_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  location_name text NOT NULL,
  locations_wanted int NOT NULL DEFAULT 1,
  note text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'scheduled', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all location requests"
  ON public.location_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view their company's location requests"
  ON public.location_requests FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins create location requests"
  ON public.location_requests FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND requested_by = auth.uid()
  );

CREATE TRIGGER update_location_requests_updated_at
  BEFORE UPDATE ON public.location_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_location_requests_company ON public.location_requests(company_id);
CREATE INDEX idx_location_requests_status ON public.location_requests(status);