-- Cleanup: remove placeholder location rows from the old approval flow
DELETE FROM public.company_phone_numbers WHERE phone_number LIKE 'pending:%';

-- Reopen the matching location requests so the owner can approve them again
-- using the new "enter Twilio number" dialog.
UPDATE public.location_requests
  SET status = 'new'
  WHERE status = 'scheduled' AND company_id IN (
    SELECT company_id FROM public.location_requests WHERE status = 'scheduled'
  );