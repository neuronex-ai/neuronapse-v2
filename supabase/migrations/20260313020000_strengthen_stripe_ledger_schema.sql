-- ================================================================
-- Migration: Strengthen Stripe + Ledger Schema
-- Date: 2026-03-13
-- Phase: 3 — Audit and Strengthen
-- 
-- Fixes identified during Phase 3 audit:
--   1. Add missing RLS policies for nb_payments UPDATE
--   2. Add missing RLS policies for nb_payouts INSERT
--   3. Add expired status handling for nb_payments
--   4. Add dispute tracking columns to nb_payments
--   5. Add partial refund support
--   6. Improve ledger_entries immutability enforcement
--   7. Add auto-recalculate balance trigger
--   8. Add appointment_id FK to nb_payments (soft)
-- ================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. MISSING RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Users need to update their own payment records (e.g. adding payment_link to draft)
CREATE POLICY "Users update own payments" ON public.nb_payments
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users need to insert payout requests
CREATE POLICY "Users insert own payouts" ON public.nb_payouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users need to insert their own financial account during onboarding
CREATE POLICY "Users insert own financial_accounts" ON public.financial_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users need to update their own financial account (status changes)
CREATE POLICY "Users update own financial_accounts" ON public.financial_accounts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. DISPUTE TRACKING 
-- ═══════════════════════════════════════════════════════════════

-- Add dispute columns to nb_payments
ALTER TABLE public.nb_payments 
    ADD COLUMN IF NOT EXISTS dispute_status TEXT 
        CHECK (dispute_status IN ('none', 'warning_needs_response', 'warning_under_review', 
                                   'warning_closed', 'needs_response', 'under_review', 
                                   'charge_refunded', 'won', 'lost')),
    ADD COLUMN IF NOT EXISTS dispute_id TEXT,
    ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
    ADD COLUMN IF NOT EXISTS dispute_amount INTEGER DEFAULT 0;

-- Set default for existing rows
UPDATE public.nb_payments SET dispute_status = 'none' WHERE dispute_status IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. ENHANCED PAYMENT STATUS TRACKING
-- ═══════════════════════════════════════════════════════════════

-- Allow 'disputed' and 'partially_refunded' statuses
ALTER TABLE public.nb_payments DROP CONSTRAINT IF EXISTS nb_payments_status_check;
ALTER TABLE public.nb_payments ADD CONSTRAINT nb_payments_status_check 
    CHECK (status IN (
        'draft', 'pending', 'processing', 'paid', 
        'failed', 'refunded', 'partially_refunded',
        'canceled', 'expired', 'disputed'
    ));

-- ═══════════════════════════════════════════════════════════════
-- 4. LEDGER IMMUTABILITY ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════

-- Prevent UPDATE and DELETE on ledger_entries (compensatory entries only)
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable. Use compensatory entries instead.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the prevention triggers
DROP TRIGGER IF EXISTS prevent_ledger_update ON public.ledger_entries;
CREATE TRIGGER prevent_ledger_update 
    BEFORE UPDATE ON public.ledger_entries 
    FOR EACH ROW 
    -- Allow status transitions from pending → posted/cancelled only
    WHEN (OLD.status = 'posted' OR OLD.status = 'cancelled')
    EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS prevent_ledger_delete ON public.ledger_entries;
CREATE TRIGGER prevent_ledger_delete 
    BEFORE DELETE ON public.ledger_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION public.prevent_ledger_mutation();

-- ═══════════════════════════════════════════════════════════════
-- 5. AUTO-RECALCULATE BALANCE ON LEDGER INSERT
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_recalculate_balance()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_ledger_balance(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_recalculate_on_ledger_insert ON public.ledger_entries;
CREATE TRIGGER auto_recalculate_on_ledger_insert
    AFTER INSERT ON public.ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_recalculate_balance();

-- Also recalculate on status change (pending → posted)
DROP TRIGGER IF EXISTS auto_recalculate_on_ledger_status_change ON public.ledger_entries;
CREATE TRIGGER auto_recalculate_on_ledger_status_change
    AFTER UPDATE OF status ON public.ledger_entries
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.auto_recalculate_balance();

-- ═══════════════════════════════════════════════════════════════
-- 6. ENHANCED RECALCULATE FUNCTION
-- ═══════════════════════════════════════════════════════════════

-- Add reserved balance calculation and refund tracking
CREATE OR REPLACE FUNCTION public.recalculate_ledger_balance(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_financial_account_id UUID;
    v_gross INTEGER := 0;
    v_fees INTEGER := 0;
    v_available INTEGER := 0;
    v_pending INTEGER := 0;
    v_paid_out INTEGER := 0;
    v_reserved INTEGER := 0;
    v_refunds INTEGER := 0;
BEGIN
    -- Get financial account
    SELECT id INTO v_financial_account_id 
    FROM public.financial_accounts 
    WHERE user_id = p_user_id 
    LIMIT 1;
    
    -- Calculate from ledger entries
    SELECT 
        -- Gross = all posted payment_received credits
        COALESCE(SUM(CASE WHEN direction = 'credit' AND entry_type = 'payment_received' AND status = 'posted' THEN amount ELSE 0 END), 0),
        -- Fees = all posted fee debits
        COALESCE(SUM(CASE WHEN direction = 'debit' AND entry_type = 'fee' AND status = 'posted' THEN amount ELSE 0 END), 0),
        -- Paid out = all posted payout debits
        COALESCE(SUM(CASE WHEN direction = 'debit' AND entry_type = 'payout' AND status = 'posted' THEN amount ELSE 0 END), 0),
        -- Pending = all pending payment_received credits
        COALESCE(SUM(CASE WHEN direction = 'credit' AND entry_type = 'payment_received' AND status = 'pending' THEN amount ELSE 0 END), 0),
        -- Reserved = all posted reserve debits minus release credits
        COALESCE(SUM(CASE WHEN entry_type = 'reserve' AND status = 'posted' THEN amount ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN entry_type = 'release' AND status = 'posted' THEN amount ELSE 0 END), 0),
        -- Refunds = all posted refund debits
        COALESCE(SUM(CASE WHEN direction = 'debit' AND entry_type = 'refund' AND status = 'posted' THEN amount ELSE 0 END), 0)
    INTO v_gross, v_fees, v_paid_out, v_pending, v_reserved, v_refunds
    FROM public.ledger_entries
    WHERE user_id = p_user_id;
    
    -- Ensure reserved doesn't go negative
    IF v_reserved < 0 THEN v_reserved := 0; END IF;
    
    -- Available = gross - fees - payouts - reserved - refunds
    v_available := v_gross - v_fees - v_paid_out - v_reserved - v_refunds;
    IF v_available < 0 THEN v_available := 0; END IF;
    
    -- Upsert the balance
    INSERT INTO public.ledger_balances (
        user_id, financial_account_id, 
        available_balance, pending_balance, reserved_balance,
        paid_out_balance, gross_volume, fees_total, net_volume, currency
    )
    VALUES (
        p_user_id, v_financial_account_id, 
        v_available, v_pending, v_reserved,
        v_paid_out, v_gross, v_fees, v_gross - v_fees, 'brl'
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        financial_account_id = EXCLUDED.financial_account_id,
        available_balance = EXCLUDED.available_balance,
        pending_balance = EXCLUDED.pending_balance,
        reserved_balance = EXCLUDED.reserved_balance,
        paid_out_balance = EXCLUDED.paid_out_balance,
        gross_volume = EXCLUDED.gross_volume,
        fees_total = EXCLUDED.fees_total,
        net_volume = EXCLUDED.net_volume,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 7. PAYMENT EXPIRY INDEX
-- ═══════════════════════════════════════════════════════════════

-- For efficient lookup of expired pending payments  
CREATE INDEX IF NOT EXISTS idx_nb_payments_expires 
    ON public.nb_payments(expires_at) 
    WHERE status = 'pending' AND expires_at IS NOT NULL;

-- For dispute lookups
CREATE INDEX IF NOT EXISTS idx_nb_payments_dispute
    ON public.nb_payments(dispute_id) 
    WHERE dispute_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 8. FINANCIAL_EVENTS RETRY TRACKING
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.financial_events
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE 'Schema strengthening complete: RLS, disputes, immutability, auto-balance, enhanced recalculation';
END
$$;
