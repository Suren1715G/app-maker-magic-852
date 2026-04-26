-- Allow company admins to create access codes for their own company
CREATE POLICY "Company admins create access codes"
ON public.access_codes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'company_admin'::app_role)
  AND company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND used_by IS NULL
);

-- Allow company admins to view access codes they created (so they can see pending invites)
CREATE POLICY "Company admins view their company access codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'company_admin'::app_role)
  AND company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Allow company admins to delete (revoke) unused invites they created
CREATE POLICY "Company admins delete unused access codes"
ON public.access_codes
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'company_admin'::app_role)
  AND company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND used_by IS NULL
);