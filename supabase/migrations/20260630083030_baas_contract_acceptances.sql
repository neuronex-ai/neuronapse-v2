-- BaaS contract acceptance records for Asaas onboarding and Pix random keys.
-- This migration only defines the local database contract. It does not insert
-- real users, credentials, tokens, clinical data or production evidence.

alter table if exists public.financial_accounts
  add column if not exists neuronex_terms_version text,
  add column if not exists asaas_terms_reference text,
  add column if not exists asaas_privacy_policy_reference text;

create table if not exists public.neurofinance_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  provider text not null default 'asaas',
  acceptance_type text not null check (
    acceptance_type in (
      'neuronex_terms',
      'asaas_terms',
      'asaas_privacy_policy',
      'financial_onboarding_bundle',
      'pix_random_key_consent'
    )
  ),
  accepted_at timestamptz not null default now(),
  flow_origin text not null,
  content_version text not null,
  content_reference text not null,
  content_hash text not null,
  ip_collection_basis text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.neurofinance_contract_acceptances enable row level security;

drop policy if exists "Users read own NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances;
create policy "Users read own NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances;
create policy "Service role manages NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.neurofinance_contract_acceptances from anon;
revoke all on public.neurofinance_contract_acceptances from authenticated;
grant select on public.neurofinance_contract_acceptances to authenticated;
grant select, insert, update, delete on public.neurofinance_contract_acceptances to service_role;

create index if not exists idx_neurofinance_acceptances_user_created
  on public.neurofinance_contract_acceptances(user_id, created_at desc);

create index if not exists idx_neurofinance_acceptances_account_type
  on public.neurofinance_contract_acceptances(financial_account_id, acceptance_type, accepted_at desc);

comment on table public.neurofinance_contract_acceptances is
  'Audit trail of server-side financial contract acceptances and Pix random-key consent for Asaas BaaS.';

comment on column public.neurofinance_contract_acceptances.content_hash is
  'Immutable content hash or immutable reference identifier resolved server-side; do not rely on user-provided text.';

comment on column public.neurofinance_contract_acceptances.ip_collection_basis is
  'Reserved for future IP collection only after documenting purpose, lawful basis and retention.';
