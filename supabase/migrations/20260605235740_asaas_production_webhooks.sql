-- ================================================================
-- NeuroFinance Asaas production webhooks
--
-- Goals:
-- - Align financial account statuses with the Asaas-only UI/runtime.
-- - Track production/sandbox environment and latest Asaas event metadata.
-- - Store enough webhook metadata for subaccount/payment/payout auditing.
-- - Keep webhook payloads service-role only.
-- ================================================================

-- Financial accounts now use Asaas lifecycle states instead of Stripe-only states.
ALTER TABLE IF EXISTS public.financial_accounts
  DROP CONSTRAINT IF EXISTS financial_accounts_status_check;

UPDATE public.financial_accounts
SET status = CASE
  WHEN status IN ('approved', 'ACTIVE') THEN 'active'
  WHEN status IN ('review', 'awaiting_approval') THEN 'pending_review'
  WHEN status IS NULL THEN 'pending'
  ELSE 'pending_review'
END
WHERE status IS NULL
   OR status NOT IN (
    'not_started',
    'pending',
    'onboarding',
    'pending_review',
    'active',
    'restricted',
    'disabled',
    'account_missing'
   );

ALTER TABLE IF EXISTS public.financial_accounts
  ADD CONSTRAINT financial_accounts_status_check
  CHECK (
    status IN (
      'not_started',
      'pending',
      'onboarding',
      'pending_review',
      'active',
      'restricted',
      'disabled',
      'account_missing'
    )
  );

ALTER TABLE IF EXISTS public.financial_accounts
  ADD COLUMN IF NOT EXISTS asaas_onboarding_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_environment TEXT NOT NULL DEFAULT 'production'
    CHECK (asaas_environment IN ('production', 'sandbox')),
  ADD COLUMN IF NOT EXISTS last_asaas_event_type TEXT,
  ADD COLUMN IF NOT EXISTS last_asaas_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_balance_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

UPDATE public.financial_accounts
SET
  provider = COALESCE(provider, 'asaas'),
  asaas_environment = COALESCE(asaas_environment, 'production')
WHERE provider IS NULL
   OR asaas_environment IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_accounts_asaas_environment
  ON public.financial_accounts(asaas_environment);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_last_asaas_event
  ON public.financial_accounts(last_asaas_event_at DESC)
  WHERE last_asaas_event_at IS NOT NULL;

-- Webhook event table: store generic event/object/account metadata.
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  asaas_account_id TEXT,
  provider_object_id TEXT,
  provider_object_type TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  event_received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS public.asaas_webhook_events
  ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_object_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_object_type TEXT,
  ADD COLUMN IF NOT EXISTS event_received_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_account
  ON public.asaas_webhook_events(asaas_account_id)
  WHERE asaas_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_provider_object
  ON public.asaas_webhook_events(provider_object_type, provider_object_id)
  WHERE provider_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_received
  ON public.asaas_webhook_events(event_received_at DESC);

ALTER TABLE IF EXISTS public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on asaas_webhook_events"
  ON public.asaas_webhook_events;

CREATE POLICY "Service role full access on asaas_webhook_events"
  ON public.asaas_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON COLUMN public.financial_accounts.asaas_environment
  IS 'Asaas runtime environment used for this subaccount: production or sandbox.';

COMMENT ON COLUMN public.financial_accounts.last_asaas_event_at
  IS 'Last Asaas webhook event timestamp observed by NeuroFinance.';

COMMENT ON COLUMN public.asaas_webhook_events.provider_object_id
  IS 'Asaas object id associated with the webhook event, such as payment or transfer id.';
