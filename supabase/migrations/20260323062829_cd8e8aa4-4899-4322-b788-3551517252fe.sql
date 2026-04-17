
CREATE TYPE lead_source AS ENUM ('cold_call', 'linkedin', 'networking', 'instantly');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  source lead_source NOT NULL DEFAULT 'instantly',
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  linkedin_url TEXT,
  value NUMERIC,
  tags TEXT[],
  instantly_id TEXT,
  campaign_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_contacted TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_unique UNIQUE (email),
  CONSTRAINT leads_instantly_id_unique UNIQUE (instantly_id)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public leads access" ON public.leads FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
