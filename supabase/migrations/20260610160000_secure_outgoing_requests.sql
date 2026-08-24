-- Secure, Edge-only review and authorization records for outgoing money.

create table if not exists public.neurofinance_outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  payout_id uuid references public.nb_payouts(id) on delete set null,
  provider text not null default 'asaas',
  kind text not null check (kind in ('pix_qr_payment', 'pix_transfer', 'payout_pix', 'payout_bank')),
  status text not null default 'review_pending',
  external_reference text not null default gen_random_uuid()::text,
  amount integer not null default 0,
  fee_amount integer not null default 0,
  available_balance_at_review integer,
  destination_summary text,
  destination_payload jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  provider_operation_id text,
  provider_status text,
  receipt_url text,
  consultation_expires_at timestamptz,
  authorized_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_neurofinance_outgoing_requests_user_reference
  on public.neurofinance_outgoing_requests(user_id, external_reference);

create unique index if not exists idx_neurofinance_outgoing_requests_provider_operation
  on public.neurofinance_outgoing_requests(provider, provider_operation_id)
  where provider_operation_id is not null;

create index if not exists idx_neurofinance_outgoing_requests_user_status
  on public.neurofinance_outgoing_requests(user_id, status, created_at desc);

alter table public.neurofinance_outgoing_requests enable row level security;

-- Intentionally no anon/authenticated grants or policies. All access is mediated
-- by authenticated Edge Functions using the service role.
revoke all on public.neurofinance_outgoing_requests from anon, authenticated;

comment on table public.neurofinance_outgoing_requests is
  'Edge-only frozen consultations and PIN authorizations for outgoing money.';

comment on column public.neurofinance_outgoing_requests.provider_payload is
  'Complete provider consultation and execution payloads retained for audit.';
