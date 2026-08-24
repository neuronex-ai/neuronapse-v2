-- NeuroFinance: safer payout destinations, payment action metadata and financial PIN reset flow.

create table if not exists public.user_financial_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_hash text,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  reset_requested_at timestamptz,
  reset_attempts integer not null default 0,
  pin_updated_at timestamptz,
  pin_last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_financial_settings_user_unique unique (user_id)
);

alter table public.user_financial_settings enable row level security;

drop policy if exists "Users read own financial settings" on public.user_financial_settings;
create policy "Users read own financial settings"
  on public.user_financial_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.user_financial_settings to authenticated;

alter table public.user_financial_settings
  add column if not exists reset_token_hash text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists reset_requested_at timestamptz,
  add column if not exists reset_attempts integer not null default 0,
  add column if not exists pin_updated_at timestamptz,
  add column if not exists pin_last_verified_at timestamptz;

alter table public.nb_payouts
  add column if not exists destination_payload jsonb not null default '{}'::jsonb,
  add column if not exists receipt_url text,
  add column if not exists error_code text,
  add column if not exists error_message text;

alter table public.nb_payments
  add column if not exists receipt_url text,
  add column if not exists invoice_url text,
  add column if not exists bank_slip_url text,
  add column if not exists cancelable boolean not null default true;

create index if not exists idx_nb_payouts_user_requested
  on public.nb_payouts(user_id, requested_at desc);

create index if not exists idx_nb_payments_user_created_status
  on public.nb_payments(user_id, created_at desc, status);

drop view if exists public.neurofinance_charges_v;
create view public.neurofinance_charges_v
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.financial_account_id,
  p.patient_id,
  patients.name as patient_name,
  p.appointment_id,
  p.provider,
  p.provider_payment_id,
  p.provider_status,
  p.normalized_status,
  p.funds_status,
  p.status,
  p.payment_method_type,
  p.gross_amount,
  p.net_amount,
  p.platform_fee_amount,
  p.actual_fee_amount,
  p.estimated_fee_amount,
  p.currency,
  p.description,
  p.checkout_url,
  coalesce(p.invoice_url, p.metadata ->> 'asaas_invoice_url', p.checkout_url) as invoice_url,
  coalesce(p.bank_slip_url, p.metadata ->> 'asaas_bank_slip_url') as bank_slip_url,
  coalesce(p.receipt_url, p.metadata ->> 'asaas_transaction_receipt_url') as receipt_url,
  p.expires_at,
  p.paid_at,
  p.confirmed_at,
  p.available_at,
  p.created_at,
  p.updated_at,
  p.cancelable,
  p.metadata
from public.nb_payments p
left join public.patients on patients.id = p.patient_id;

grant select on public.neurofinance_charges_v to authenticated;

drop view if exists public.neurofinance_overview_items_v;
create view public.neurofinance_overview_items_v
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.financial_account_id,
  'income'::text as overview_group,
  'payment'::text as item_type,
  coalesce(p.description, 'Cobrança recebida') as description,
  p.gross_amount as amount,
  p.currency,
  p.normalized_status as status,
  p.payment_method_type as payment_method,
  coalesce(p.available_at, p.paid_at, p.updated_at) as occurred_at,
  p.provider_payment_id as reference_id,
  patients.name as patient_name,
  jsonb_build_object(
    'gross_amount', p.gross_amount,
    'net_amount', p.net_amount,
    'actual_fee_amount', p.actual_fee_amount,
    'estimated_fee_amount', p.estimated_fee_amount,
    'reconciliation_status', p.reconciliation_status,
    'checkout_url', p.checkout_url,
    'invoice_url', coalesce(p.invoice_url, p.metadata ->> 'asaas_invoice_url', p.checkout_url),
    'bank_slip_url', coalesce(p.bank_slip_url, p.metadata ->> 'asaas_bank_slip_url'),
    'receipt_url', coalesce(p.receipt_url, p.metadata ->> 'asaas_transaction_receipt_url')
  ) || coalesce(p.metadata, '{}'::jsonb) as metadata
from public.nb_payments p
left join public.patients on patients.id = p.patient_id
where p.funds_status = 'available'
  and p.normalized_status = 'paid'

union all

select
  p.id,
  p.user_id,
  p.financial_account_id,
  'receivable'::text,
  'payment'::text,
  coalesce(p.description, 'Cobrança a receber'),
  p.gross_amount,
  p.currency,
  p.normalized_status,
  p.payment_method_type,
  coalesce(p.estimated_credit_at, p.expires_at, p.updated_at),
  p.provider_payment_id,
  patients.name,
  jsonb_build_object(
    'estimated_fee_amount', p.estimated_fee_amount,
    'estimated_credit_at', p.estimated_credit_at,
    'reconciliation_status', p.reconciliation_status,
    'checkout_url', p.checkout_url,
    'invoice_url', coalesce(p.invoice_url, p.metadata ->> 'asaas_invoice_url', p.checkout_url),
    'bank_slip_url', coalesce(p.bank_slip_url, p.metadata ->> 'asaas_bank_slip_url'),
    'receipt_url', coalesce(p.receipt_url, p.metadata ->> 'asaas_transaction_receipt_url')
  ) || coalesce(p.metadata, '{}'::jsonb)
from public.nb_payments p
left join public.patients on patients.id = p.patient_id
where p.funds_status in ('pending', 'confirmed')
  and p.normalized_status in ('pending', 'processing', 'confirmed')

union all

select
  m.id,
  m.user_id,
  m.financial_account_id,
  'outflow'::text,
  m.movement_type,
  coalesce(m.description, 'Saída da conta'),
  m.amount,
  m.currency,
  m.status,
  null::text,
  m.occurred_at,
  coalesce(m.reference_id, m.provider_movement_id),
  null::text,
  coalesce(m.metadata, '{}'::jsonb)
from public.neurofinance_account_movements m
where m.direction = 'debit'
  and m.status = 'posted';

grant select on public.neurofinance_overview_items_v to authenticated;
