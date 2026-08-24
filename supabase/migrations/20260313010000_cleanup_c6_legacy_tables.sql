-- ================================================================
-- Migration: Cleanup C6 Legacy Tables
-- Date: 2026-03-13
-- Description: Removes all C6 Bank legacy tables, triggers, 
--              functions, policies, and indexes that are no longer
--              needed after the Stripe Connect migration.
--
-- Safety: Tables are dropped only if they exist.
--         Data was never used in production (sandbox-only).
-- ================================================================

-- 1. Drop triggers first (they reference the tables)
DROP TRIGGER IF EXISTS c6_accounts_updated_at ON public.c6_accounts;
DROP TRIGGER IF EXISTS c6_pix_charges_updated_at ON public.c6_pix_charges;
DROP TRIGGER IF EXISTS c6_boletos_updated_at ON public.c6_boletos;
DROP TRIGGER IF EXISTS c6_checkouts_updated_at ON public.c6_checkouts;
DROP TRIGGER IF EXISTS c6_payment_groups_updated_at ON public.c6_payment_groups;

-- 2. Drop RLS policies
DROP POLICY IF EXISTS "Users can view own c6 account" ON public.c6_accounts;
DROP POLICY IF EXISTS "Users can view own pix charges" ON public.c6_pix_charges;
DROP POLICY IF EXISTS "Users can view own boletos" ON public.c6_boletos;
DROP POLICY IF EXISTS "Users can view own checkouts" ON public.c6_checkouts;
DROP POLICY IF EXISTS "Users can view own payment groups" ON public.c6_payment_groups;
DROP POLICY IF EXISTS "Users can view own webhook logs" ON public.c6_webhook_logs;

DROP POLICY IF EXISTS "Service role full access c6_accounts" ON public.c6_accounts;
DROP POLICY IF EXISTS "Service role full access c6_pix_charges" ON public.c6_pix_charges;
DROP POLICY IF EXISTS "Service role full access c6_boletos" ON public.c6_boletos;
DROP POLICY IF EXISTS "Service role full access c6_checkouts" ON public.c6_checkouts;
DROP POLICY IF EXISTS "Service role full access c6_payment_groups" ON public.c6_payment_groups;
DROP POLICY IF EXISTS "Service role full access c6_webhook_logs" ON public.c6_webhook_logs;

-- 3. Drop tables (CASCADE to remove any remaining dependent objects)
DROP TABLE IF EXISTS public.c6_payment_groups CASCADE;
DROP TABLE IF EXISTS public.c6_checkouts CASCADE;
DROP TABLE IF EXISTS public.c6_boletos CASCADE;
DROP TABLE IF EXISTS public.c6_pix_charges CASCADE;
DROP TABLE IF EXISTS public.c6_webhook_logs CASCADE;
DROP TABLE IF EXISTS public.c6_accounts CASCADE;

-- 4. Drop the C6-specific updated_at trigger function
DROP FUNCTION IF EXISTS public.update_c6_updated_at() CASCADE;

-- 5. Confirm cleanup
DO $$
BEGIN
    RAISE NOTICE 'C6 legacy cleanup complete. Removed: c6_accounts, c6_webhook_logs, c6_pix_charges, c6_boletos, c6_checkouts, c6_payment_groups';
END
$$;
