-- Add sub_account and workspace tracking to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sub_account TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- Add booked status to the lead_status enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'booked'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'booked';
  END IF;
END
$$;
