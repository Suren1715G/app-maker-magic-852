-- Add a column to remember which of the company's own phone numbers a call came in on / went out from
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS to_number text;

-- Backfill existing Twilio rows from the stored webhook metadata.
UPDATE public.calls
   SET to_number = COALESCE(
     metadata #>> '{twilio,To}',
     metadata #>> '{twilio,From}'
   )
 WHERE source = 'twilio' AND to_number IS NULL;

-- Helpful index for filtering a company's calls by which of its lines was used.
CREATE INDEX IF NOT EXISTS calls_company_to_number_idx
  ON public.calls (company_id, to_number);