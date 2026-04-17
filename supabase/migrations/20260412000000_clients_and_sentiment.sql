-- Clients table (one per Instantly account / customer)
CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  instantly_api_key text NOT NULL,
  color      text DEFAULT 'primary',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_clients" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Add client_id and sentiment to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral'
  CHECK (sentiment IN ('interested', 'negative', 'neutral'));

-- Seed aimlogic client
INSERT INTO clients (name, instantly_api_key, color)
VALUES ('AimLogic', 'YzY4OTc0NjUtOGI4Mi00N2EzLWJhMTMtM2FkMDhkYzg0ZjljOkFWdGR1dHRvUWxZbw==', 'blue')
ON CONFLICT DO NOTHING;
