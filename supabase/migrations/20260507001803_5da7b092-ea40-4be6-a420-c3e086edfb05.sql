CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  type text NOT NULL DEFAULT 'Custom',
  audience text NOT NULL DEFAULT 'All Customers',
  message_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  phone text,
  email text,
  name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_company ON public.campaigns(company_id, created_at DESC);
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view their company campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins create campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Company admins update campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Company admins delete campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Admins manage all campaign recipients" ON public.campaign_recipients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view their company recipients" ON public.campaign_recipients FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins create recipients" ON public.campaign_recipients FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Company admins update recipients" ON public.campaign_recipients FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE POLICY "Company admins delete recipients" ON public.campaign_recipients FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    AND has_role(auth.uid(), 'company_admin'::app_role)
  );

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
