-- Add "opportunity" to the sentiment check constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_sentiment_check;
ALTER TABLE leads ADD CONSTRAINT leads_sentiment_check
  CHECK (sentiment IN ('interested', 'opportunity', 'negative', 'neutral'));
