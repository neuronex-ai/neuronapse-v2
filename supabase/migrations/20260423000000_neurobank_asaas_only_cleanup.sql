-- ================================================================
-- Migration: NeuroBank Asaas-only cleanup (remove Stripe legacy)
-- Date: 2026-04-23
--
-- Goals:
-- - Remove Stripe-only artifacts (tables/columns) from the schema
-- - Stop reusing `stripe_*` columns to store Asaas IDs
-- - Introduce provider-neutral columns (`provider_*`) for IDs/references
-- - Keep Asaas-specific columns already in use (asaas_account_id, etc.)
--
-- Safety:
-- - Uses IF EXISTS / IF NOT EXISTS
-- - Assumes sandbox-only data (user confirmed)
-- ================================================================

-- 0) Stripe-only embedded onboarding table
DROP TABLE IF EXISTS public.financial_requirement_snapshots CASCADE;

-- 1) financial_onboarding_sessions: provider-neutral account id
ALTER TABLE IF EXISTS public.financial_onboarding_sessions
  ADD COLUMN IF NOT EXISTS provider_account_id TEXT;

UPDATE public.financial_onboarding_sessions
SET provider_account_id = COALESCE(provider_account_id, stripe_account_id)
WHERE provider_account_id IS NULL
  AND stripe_account_id IS NOT NULL;

ALTER TABLE IF EXISTS public.financial_onboarding_sessions
  DROP COLUMN IF EXISTS stripe_account_id;

-- 2) nb_payments: provider-neutral payment refs
ALTER TABLE IF EXISTS public.nb_payments
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_checkout_id TEXT;

UPDATE public.nb_payments
SET
  provider_payment_id = COALESCE(
    provider_payment_id,
    stripe_payment_intent_id,
    (metadata->>'asaas_payment_id')
  ),
  provider_checkout_id = COALESCE(
    provider_checkout_id,
    stripe_checkout_session_id
  )
WHERE provider_payment_id IS NULL
   OR provider_checkout_id IS NULL;

ALTER TABLE IF EXISTS public.nb_payments
  DROP COLUMN IF EXISTS stripe_payment_intent_id,
  DROP COLUMN IF EXISTS stripe_checkout_session_id;

-- Helpful indexes for provider lookups (idempotency / webhook matching)
CREATE INDEX IF NOT EXISTS idx_nb_payments_provider_payment_id
  ON public.nb_payments(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- 3) nb_payouts: provider-neutral payout refs
ALTER TABLE IF EXISTS public.nb_payouts
  ADD COLUMN IF NOT EXISTS provider_payout_id TEXT;

UPDATE public.nb_payouts
SET provider_payout_id = COALESCE(
  provider_payout_id,
  stripe_payout_id,
  (metadata->>'asaas_transfer_id')
)
WHERE provider_payout_id IS NULL;

ALTER TABLE IF EXISTS public.nb_payouts
  DROP COLUMN IF EXISTS stripe_payout_id;

CREATE INDEX IF NOT EXISTS idx_nb_payouts_provider_payout_id
  ON public.nb_payouts(provider_payout_id)
  WHERE provider_payout_id IS NOT NULL;

-- 4) ledger_entries: provider-neutral object id
ALTER TABLE IF EXISTS public.ledger_entries
  ADD COLUMN IF NOT EXISTS provider_object_id TEXT;

UPDATE public.ledger_entries
SET provider_object_id = COALESCE(provider_object_id, stripe_object_id)
WHERE provider_object_id IS NULL
  AND stripe_object_id IS NOT NULL;

ALTER TABLE IF EXISTS public.ledger_entries
  DROP COLUMN IF EXISTS stripe_object_id;

CREATE INDEX IF NOT EXISTS idx_ledger_entries_provider_object_id
  ON public.ledger_entries(provider_object_id)
  WHERE provider_object_id IS NOT NULL;

-- 5) financial_accounts: drop Stripe account id column (kept during earlier migrations)
ALTER TABLE IF EXISTS public.financial_accounts
  DROP COLUMN IF EXISTS stripe_account_id;

-- Ensure columns used by Asaas sync exist
ALTER TABLE IF EXISTS public.financial_accounts
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- 6) financial_events was a Stripe-specific webhook mirror; Asaas uses asaas_webhook_events
DROP TABLE IF EXISTS public.financial_events CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Asaas-only cleanup complete: removed Stripe embedded onboarding table + stripe_* columns; added provider_* columns.';
END
$$;
