-- NeuroFinance: bill payments, Pix-out consistency, anticipations and chargeback reads.

create table if not exists public.neurofinance_bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  provider text not null default 'asaas',
  provider_bill_id text,
  external_reference text not null default gen_random_uuid()::text,
  identification_field text,
  barcode text,
  status text not null default 'draft',
  amount integer not null default 0,
  fee_amount integer not null default 0,
  due_date date,
  scheduled_date date,
  paid_at timestamptz,
  beneficiary_name text,
  beneficiary_document text,
  bank_code text,
  bank_name text,
  description text,
  provider_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_neurofinance_bill_payments_user_created
  on public.neurofinance_bill_payments(user_id, created_at desc);

create unique index if not exists idx_neurofinance_bill_payments_provider_bill
  on public.neurofinance_bill_payments(provider, provider_bill_id)
  where provider_bill_id is not null;

alter table public.neurofinance_bill_payments enable row level security;

drop policy if exists "Users read own bill payments" on public.neurofinance_bill_payments;
create policy "Users read own bill payments"
  on public.neurofinance_bill_payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.neurofinance_bill_payments to authenticated;

create table if not exists public.neurofinance_anticipations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  provider text not null default 'asaas',
  provider_anticipation_id text,
  provider_status text,
  normalized_status text not null default 'pending',
  payment_id uuid references public.nb_payments(id) on delete set null,
  provider_payment_id text,
  installment_id text,
  gross_amount integer not null default 0,
  anticipated_amount integer not null default 0,
  fee_amount integer not null default 0,
  net_amount integer not null default 0,
  anticipation_days integer,
  anticipation_date date,
  due_date date,
  requested_at timestamptz,
  credited_at timestamptz,
  documents_required boolean not null default false,
  documents jsonb not null default '[]'::jsonb,
  denial_observation text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_neurofinance_anticipations_user_created
  on public.neurofinance_anticipations(user_id, created_at desc);

create unique index if not exists idx_neurofinance_anticipations_provider
  on public.neurofinance_anticipations(provider, provider_anticipation_id)
  where provider_anticipation_id is not null;

alter table public.neurofinance_anticipations enable row level security;

drop policy if exists "Users read own anticipations" on public.neurofinance_anticipations;
create policy "Users read own anticipations"
  on public.neurofinance_anticipations for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.neurofinance_anticipations to authenticated;

alter table public.nb_payouts
  add column if not exists operation_type text,
  add column if not exists pix_key text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb;

alter table public.nb_payments
  add column if not exists anticipable boolean,
  add column if not exists anticipated boolean,
  add column if not exists installment_id text,
  add column if not exists provider_due_date date;

create or replace view public.neurofinance_eligible_anticipation_payments_v
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.financial_account_id,
  p.provider_payment_id,
  p.installment_id,
  p.description,
  p.payment_method_type,
  p.provider_status,
  p.normalized_status,
  p.funds_status,
  p.gross_amount,
  p.net_amount,
  p.platform_fee_amount,
  p.expires_at as due_date,
  p.estimated_credit_at,
  p.anticipable,
  p.anticipated,
  p.metadata,
  p.created_at
from public.nb_payments p
where p.provider = 'asaas'
  and p.provider_payment_id is not null
  and coalesce(p.anticipated, false) = false
  and (
    p.anticipable = true
    or p.metadata ->> 'anticipable' = 'true'
    or p.funds_status in ('confirmed', 'pending')
  )
  and coalesce(p.normalized_status, p.status) not in ('deleted', 'canceled', 'cancelled', 'refunded', 'chargeback', 'failed');

grant select on public.neurofinance_eligible_anticipation_payments_v to authenticated;

create or replace view public.neurofinance_chargebacks_v
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.financial_account_id,
  p.provider_payment_id,
  p.description,
  p.payment_method_type,
  p.provider_status,
  p.normalized_status,
  p.funds_status,
  p.gross_amount,
  p.dispute_status,
  p.dispute_id,
  p.dispute_reason,
  p.dispute_amount,
  p.paid_at,
  p.updated_at,
  p.created_at,
  p.metadata
from public.nb_payments p
where coalesce(p.dispute_status, 'none') <> 'none'
   or coalesce(p.normalized_status, p.status) = 'chargeback'
   or p.provider_status like '%CHARGEBACK%';

grant select on public.neurofinance_chargebacks_v to authenticated;
