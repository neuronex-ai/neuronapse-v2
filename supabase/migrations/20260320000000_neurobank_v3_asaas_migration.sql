-- NeuroBank v3 Migration: Stripe Connect → Asaas White-Label
-- This migration adds Asaas-specific fields to existing tables.
-- Safe to run alongside existing Stripe fields for gradual migration.

-- 1. Add Asaas fields to financial_accounts
ALTER TABLE IF EXISTS financial_accounts 
ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'asaas';

-- Create index for Asaas account lookup
CREATE INDEX IF NOT EXISTS idx_financial_accounts_asaas_account_id 
ON financial_accounts (asaas_account_id) WHERE asaas_account_id IS NOT NULL;

-- 2. Add provider field to nb_payments
ALTER TABLE IF EXISTS nb_payments 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'asaas';

-- 3. Add provider field to nb_payouts  
ALTER TABLE IF EXISTS nb_payouts
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'asaas';

-- 4. Create webhook events table for Asaas idempotency
CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,  -- composite key for dedup: event_type + asaas_payment_id
    payload JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_event_id 
ON asaas_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_status 
ON asaas_webhook_events (status) WHERE status = 'pending';

-- 5. Enable RLS on new table
ALTER TABLE asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events (no user access needed)
CREATE POLICY "Service role full access on asaas_webhook_events" 
ON asaas_webhook_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 6. Add comment for documentation
COMMENT ON TABLE asaas_webhook_events IS 'Tracks Asaas webhook events for idempotency (at-least-once delivery deduplication)';
COMMENT ON COLUMN financial_accounts.asaas_account_id IS 'Asaas sub-account ID';
COMMENT ON COLUMN financial_accounts.asaas_wallet_id IS 'Asaas wallet ID for the sub-account';
COMMENT ON COLUMN financial_accounts.provider IS 'Payment provider: asaas or stripe';
