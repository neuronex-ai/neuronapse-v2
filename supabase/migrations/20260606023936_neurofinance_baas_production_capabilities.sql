alter table public.financial_accounts
  add column if not exists pix_key_consent_at timestamptz;

alter table if exists public.user_fiscal_settings
  add column if not exists fiscal_provider text not null default 'asaas',
  add column if not exists asaas_municipal_service_id text,
  add column if not exists asaas_municipal_service_name text,
  add column if not exists asaas_last_sync_at timestamptz,
  add column if not exists asaas_last_sync_error text;

alter table if exists public.invoices
  add column if not exists nfse_status text,
  add column if not exists nfse_reference text,
  add column if not exists nfse_provider text default 'asaas';

create table if not exists public.neurofinance_baas_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  provider text not null default 'asaas',
  operation_type text not null,
  provider_operation_id text,
  status text not null default 'pending',
  amount numeric(14,2),
  description text,
  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_neurofinance_baas_operations_user_created
  on public.neurofinance_baas_operations (user_id, created_at desc);

alter table public.neurofinance_baas_operations enable row level security;

drop policy if exists "Users read own BaaS operations" on public.neurofinance_baas_operations;
create policy "Users read own BaaS operations"
  on public.neurofinance_baas_operations for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.neurofinance_baas_operations to authenticated;

comment on table public.neurofinance_baas_operations is
  'Audit trail for production Asaas BaaS operations initiated from NeuroFinance.';
