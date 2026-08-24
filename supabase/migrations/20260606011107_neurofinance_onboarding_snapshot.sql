-- NeuroFinance onboarding snapshot fields.
-- These columns make the data typed and queryable instead of relying on JSON metadata.

alter table public.financial_accounts
  add column if not exists holder_name text,
  add column if not exists cpf_cnpj text,
  add column if not exists birth_date date,
  add column if not exists mobile_phone text,
  add column if not exists pep_status text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_postal_code text,
  add column if not exists company_type text,
  add column if not exists income_value numeric(14,2),
  add column if not exists business_url text,
  add column if not exists business_description text,
  add column if not exists business_mcc text,
  add column if not exists bank_code text,
  add column if not exists bank_agency text,
  add column if not exists bank_account text,
  add column if not exists bank_account_digit text,
  add column if not exists bank_account_type text,
  add column if not exists bank_holder_name text,
  add column if not exists bank_holder_cpf_cnpj text,
  add column if not exists document_front_id text,
  add column if not exists document_back_id text,
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists onboarding_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_financial_accounts_user_bank_snapshot
  on public.financial_accounts (user_id, bank_code, bank_agency);

comment on column public.financial_accounts.onboarding_payload is
  'Sanitized snapshot of the NeuroFinance onboarding payload. Sensitive Asaas credentials remain in dedicated fields/metadata.';
