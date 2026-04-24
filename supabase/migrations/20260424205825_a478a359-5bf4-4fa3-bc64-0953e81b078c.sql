CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  body text,
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_company_id_idx ON public.notes(company_id);
CREATE INDEX notes_due_at_idx ON public.notes(due_at) WHERE due_at IS NOT NULL AND done = false;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their company notes"
  ON public.notes FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins create notes"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Company admins update their notes"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Company admins delete their notes"
  ON public.notes FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Admins manage all notes"
  ON public.notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();