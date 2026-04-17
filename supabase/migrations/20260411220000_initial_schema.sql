-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE lead_source AS ENUM ('cold_call', 'linkedin', 'networking', 'instantly');
CREATE TYPE lead_status AS ENUM ('new', 'booked', 'qualified', 'proposal', 'won', 'lost');

-- ============================================================
-- Leads
-- ============================================================
CREATE TABLE public.leads (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT        NOT NULL,
  company           TEXT        NOT NULL DEFAULT '',
  email             TEXT        NOT NULL,
  phone             TEXT,
  title             TEXT,
  source            lead_source NOT NULL DEFAULT 'instantly',
  status            lead_status NOT NULL DEFAULT 'new',
  notes             TEXT,
  linkedin_url      TEXT,
  value             NUMERIC,
  tags              TEXT[],
  instantly_id      TEXT,
  campaign_name     TEXT,
  sub_account       TEXT,
  workspace_id      TEXT,
  last_contacted    TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_unique        UNIQUE (email),
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

-- ============================================================
-- Email Threads
-- Each lead can have one thread (their Instantly conversation).
-- Messages are stored as a JSONB array:
-- [{ "id": "...", "sender": "them|us", "body": "...", "sent_at": "ISO8601" }]
-- ============================================================
CREATE TABLE public.email_threads (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID    NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  instantly_thread_id TEXT    UNIQUE,
  subject             TEXT,
  messages            JSONB   NOT NULL DEFAULT '[]'::jsonb,
  last_message_at     TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public email_threads access" ON public.email_threads FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX email_threads_lead_id_idx ON public.email_threads(lead_id);

-- ============================================================
-- Follow-up Logs
-- Records every templated follow-up sent from the CRM.
-- ============================================================
CREATE TABLE public.follow_up_logs (
  id            UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID    NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_name TEXT,
  message       TEXT    NOT NULL,
  sent_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public follow_up_logs access" ON public.follow_up_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX follow_up_logs_lead_id_idx ON public.follow_up_logs(lead_id);
