ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS business_hours_always_on boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_hours_open time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_hours_close time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS business_hours_timezone text NOT NULL DEFAULT 'America/New_York';