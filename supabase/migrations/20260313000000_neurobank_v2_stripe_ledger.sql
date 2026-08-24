-- NeuroBank v2 Migration: C6 Bank → Stripe Connect + Internal Ledger
-- This migration creates the complete financial schema for NeuroBank v2.
-- 
-- Tables created:
--   1. financial_accounts     — Stripe Connect account + status
--   2. ledger_accounts        — Logical sub-accounts per user
--   3. ledger_entries         — Immutable financial journal (the ledger)
--   4. ledger_balances        — Materialized balances for fast reads
--   5. payments               — Charges/payments (Pix, Card, Boleto)
--   6. payouts                — Payouts to psychologist bank accounts
--   7. financial_onboarding_sessions — Onboarding flow tracking
--   8. financial_events       — Webhook event mirror for idempotency
--   9. invoice_automation     — Fiscal automation config per user
--
-- Principles:
--   - Ledger entries are IMMUTABLE (no UPDATE/DELETE)
--   - All webhook processing is IDEMPOTENT
--   - Balance is derived from ledger, materialized for reads
--   - RLS enabled on all tables

-- ═══════════════════════════════════════════════════════════════
-- 1. FINANCIAL ACCOUNTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'onboarding', 'active', 'restricted', 'disabled')),
    provider TEXT NOT NULL DEFAULT 'stripe',
    stripe_account_id TEXT UNIQUE,
    onboarding_started_at TIMESTAMPTZ,
    onboarding_completed_at TIMESTAMPTZ,
    charges_enabled BOOLEAN DEFAULT FALSE,
    payouts_enabled BOOLEAN DEFAULT FALSE,
    details_submitted BOOLEAN DEFAULT FALSE,
    default_currency TEXT DEFAULT 'brl',
    bank_account_last4 TEXT,
    bank_name TEXT,
    pix_enabled BOOLEAN DEFAULT TRUE,
    card_enabled BOOLEAN DEFAULT TRUE,
    platform_fee_percent NUMERIC(5,2) DEFAULT 4.90,
    platform_fee_fixed INTEGER DEFAULT 50, -- in centavos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT financial_accounts_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_user ON public.financial_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_stripe ON public.financial_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_status ON public.financial_accounts(status);

-- ═══════════════════════════════════════════════════════════════
-- 2. LEDGER ACCOUNTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL CHECK (account_type IN ('main', 'pending', 'available', 'reserved', 'fees')),
    currency TEXT DEFAULT 'brl',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ledger_accounts_user_type_unique UNIQUE (user_id, account_type)
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user ON public.ledger_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_financial ON public.ledger_accounts(financial_account_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. LEDGER ENTRIES (The core truth table - IMMUTABLE)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'payment_received', 'fee', 'payout', 'refund', 
        'adjustment', 'invoice_issued', 'reserve', 'release'
    )),
    amount INTEGER NOT NULL CHECK (amount >= 0), -- in centavos, always positive
    currency TEXT DEFAULT 'brl',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'cancelled')),
    reference_type TEXT CHECK (reference_type IN (
        'payment', 'payout', 'invoice', 'patient', 
        'appointment', 'adjustment'
    )),
    reference_id UUID,
    stripe_object_id TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No UPDATE or DELETE should ever happen on ledger_entries
-- Corrections should be done via compensatory entries

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON public.ledger_entries(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type ON public.ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON public.ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference ON public.ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_stripe ON public.ledger_entries(stripe_object_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_occurred ON public.ledger_entries(occurred_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. LEDGER BALANCES (Materialized view for fast reads)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ledger_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    available_balance INTEGER DEFAULT 0, -- centavos
    pending_balance INTEGER DEFAULT 0,
    reserved_balance INTEGER DEFAULT 0,
    paid_out_balance INTEGER DEFAULT 0,
    gross_volume INTEGER DEFAULT 0,
    fees_total INTEGER DEFAULT 0,
    net_volume INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'brl',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ledger_balances_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_balances_user ON public.ledger_balances(user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. PAYMENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.nb_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    appointment_id UUID,
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    provider TEXT DEFAULT 'stripe',
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    payment_method_type TEXT CHECK (payment_method_type IN ('pix', 'card', 'boleto')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending', 'processing', 'paid', 
        'failed', 'refunded', 'canceled', 'expired'
    )),
    gross_amount INTEGER NOT NULL, -- centavos
    platform_fee_amount INTEGER DEFAULT 0,
    net_amount INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'brl',
    description TEXT,
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    checkout_url TEXT,
    refund_amount INTEGER DEFAULT 0,
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nb_payments_user ON public.nb_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_nb_payments_patient ON public.nb_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_nb_payments_status ON public.nb_payments(status);
CREATE INDEX IF NOT EXISTS idx_nb_payments_stripe_pi ON public.nb_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_nb_payments_stripe_cs ON public.nb_payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_nb_payments_created ON public.nb_payments(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. PAYOUTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.nb_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    provider TEXT DEFAULT 'stripe',
    stripe_payout_id TEXT,
    amount INTEGER NOT NULL, -- centavos
    currency TEXT DEFAULT 'brl',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_transit', 'paid', 'failed', 'canceled'
    )),
    destination_type TEXT DEFAULT 'bank_account',
    destination_summary TEXT, -- e.g. "Banco do Brasil •••• 1234"
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nb_payouts_user ON public.nb_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_nb_payouts_status ON public.nb_payouts(status);
CREATE INDEX IF NOT EXISTS idx_nb_payouts_stripe ON public.nb_payouts(stripe_payout_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. FINANCIAL ONBOARDING SESSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    provider TEXT DEFAULT 'stripe',
    stripe_account_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'expired', 'failed'
    )),
    onboarding_url TEXT,
    refresh_url TEXT,
    return_url TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_onboarding_user ON public.financial_onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_onboarding_stripe ON public.financial_onboarding_sessions(stripe_account_id);

-- ═══════════════════════════════════════════════════════════════
-- 8. FINANCIAL EVENTS (Webhook event mirror - idempotency)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT DEFAULT 'stripe',
    event_type TEXT NOT NULL,
    stripe_event_id TEXT UNIQUE, -- ensures idempotency
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_events_stripe ON public.financial_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_type ON public.financial_events(event_type);
CREATE INDEX IF NOT EXISTS idx_financial_events_processed ON public.financial_events(processed);

-- ═══════════════════════════════════════════════════════════════
-- 9. INVOICE AUTOMATION
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.invoice_automation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    focus_customer_id TEXT,
    auto_issue_enabled BOOLEAN DEFAULT FALSE,
    issue_on_payment_confirmation BOOLEAN DEFAULT TRUE,
    default_service_code TEXT DEFAULT '8690-9/99',
    default_tax_regime TEXT DEFAULT 'simples_nacional',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT invoice_automation_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_automation_user ON public.invoice_automation(user_id);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nb_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nb_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_automation ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users read own financial_accounts" ON public.financial_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own ledger_accounts" ON public.ledger_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own ledger_entries" ON public.ledger_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own ledger_balances" ON public.ledger_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own payments" ON public.nb_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own payouts" ON public.nb_payouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own onboarding" ON public.financial_onboarding_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own invoice_automation" ON public.invoice_automation
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own payment records (drafts)
CREATE POLICY "Users insert own payments" ON public.nb_payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own invoice_automation settings
CREATE POLICY "Users update own invoice_automation" ON public.invoice_automation
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users insert own invoice_automation" ON public.invoice_automation
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
-- This is already built into Supabase service role

-- ═══════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$ 
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'financial_accounts', 'ledger_accounts', 'ledger_balances',
        'nb_payments', 'nb_payouts', 'financial_onboarding_sessions',
        'invoice_automation'
    ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- BALANCE RECALCULATION FUNCTION
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.recalculate_ledger_balance(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_financial_account_id UUID;
    v_gross INTEGER := 0;
    v_fees INTEGER := 0;
    v_available INTEGER := 0;
    v_pending INTEGER := 0;
    v_paid_out INTEGER := 0;
BEGIN
    -- Get financial account
    SELECT id INTO v_financial_account_id 
    FROM public.financial_accounts 
    WHERE user_id = p_user_id 
    LIMIT 1;
    
    -- Calculate from posted ledger entries
    SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' AND entry_type = 'payment_received' AND status = 'posted' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN direction = 'debit' AND entry_type = 'fee' AND status = 'posted' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN direction = 'debit' AND entry_type = 'payout' AND status = 'posted' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN direction = 'credit' AND entry_type = 'payment_received' AND status = 'pending' THEN amount ELSE 0 END), 0)
    INTO v_gross, v_fees, v_paid_out, v_pending
    FROM public.ledger_entries
    WHERE user_id = p_user_id;
    
    v_available := v_gross - v_fees - v_paid_out;
    
    -- Upsert the balance
    INSERT INTO public.ledger_balances (user_id, financial_account_id, available_balance, pending_balance, paid_out_balance, gross_volume, fees_total, net_volume, currency)
    VALUES (p_user_id, v_financial_account_id, v_available, v_pending, v_paid_out, v_gross, v_fees, v_gross - v_fees, 'brl')
    ON CONFLICT (user_id) 
    DO UPDATE SET
        financial_account_id = EXCLUDED.financial_account_id,
        available_balance = EXCLUDED.available_balance,
        pending_balance = EXCLUDED.pending_balance,
        paid_out_balance = EXCLUDED.paid_out_balance,
        gross_volume = EXCLUDED.gross_volume,
        fees_total = EXCLUDED.fees_total,
        net_volume = EXCLUDED.net_volume,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
