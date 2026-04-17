-- Add "follow_up" to the leads sentiment CHECK constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_sentiment_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_sentiment_check
  CHECK (sentiment IN ('interested', 'follow_up', 'opportunity', 'negative', 'neutral'));
