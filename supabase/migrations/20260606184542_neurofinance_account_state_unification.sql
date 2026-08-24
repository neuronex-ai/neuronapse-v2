-- ================================================================
-- NeuroFinance account state unification
--
-- Goals:
-- - Keep Asaas as the operational source of truth for account status.
-- - Store one normalized requirements snapshot in financial_accounts.
-- - Keep legacy ledger tables out of the operational read path.
-- - Provide safe read views for account state, charges and manual finance summaries.
-- ================================================================

create or replace function public.neurofinance_safe_jsonb(input text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if input is null or btrim(input) = '' then
    return '{}'::jsonb;
  end if;

  return input::jsonb;
exception when others then
  return jsonb_build_object('legacy_value', input);
end;
$$;

alter table if exists public.appointments
  add column if not exists metadata jsonb default '{}'::jsonb;

do $$
declare
  metadata_type text;
begin
  select data_type
    into metadata_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'appointments'
    and column_name = 'metadata';

  if metadata_type is not null and metadata_type <> 'jsonb' then
    execute
      'alter table public.appointments alter column metadata type jsonb using public.neurofinance_safe_jsonb(metadata::text)';
  end if;
end $$;

alter table if exists public.appointments
  alter column metadata set default '{}'::jsonb;

update public.appointments
set metadata = coalesce(metadata, '{}'::jsonb)
where metadata is null;

create or replace function public.neurofinance_status_text(value text, fallback text default 'PENDING')
returns text
language sql
immutable
as $$
  select coalesce(nullif(regexp_replace(upper(btrim(coalesce(value, fallback))), '\s+', '_', 'g'), ''), fallback);
$$;

create or replace function public.neurofinance_status_tone(status text)
returns text
language sql
immutable
as $$
  select case public.neurofinance_status_text(status, 'UNKNOWN')
    when 'APPROVED' then 'approved'
    when 'REJECTED' then 'rejected'
    when 'DENIED' then 'rejected'
    when 'EXPIRED' then 'rejected'
    when 'AWAITING_APPROVAL' then 'review'
    when 'PENDING' then 'pending'
    when 'EXPIRING_SOON' then 'pending'
    when 'AWAITING_ACTION_AUTHORIZATION' then 'pending'
    when 'NOT_SENT' then 'missing'
    else 'neutral'
  end;
$$;

create or replace function public.neurofinance_stage_snapshot(label text, provider_status text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'label', label,
    'provider_status', public.neurofinance_status_text(provider_status, 'UNKNOWN'),
    'status', public.neurofinance_status_tone(provider_status),
    'status_label', public.neurofinance_status_text(provider_status, 'UNKNOWN'),
    'actionable',
      public.neurofinance_status_tone(provider_status) in ('rejected', 'missing')
      or public.neurofinance_status_text(provider_status, 'UNKNOWN') in (
        'PENDING',
        'AWAITING_ACTION_AUTHORIZATION',
        'EXPIRING_SOON',
        'EXPIRED'
      )
  );
$$;

create or replace function public.neurofinance_normalize_asaas_requirements(
  requirements jsonb,
  account_status text default null,
  status_source text default 'database'
)
returns jsonb
language sql
stable
as $$
with input as (
  select coalesce(requirements, '{}'::jsonb) as r
),
raw_payload as (
  select
    r,
    coalesce(r -> 'raw', r -> 'accountStatus', r) as raw
  from input
),
base_statuses as (
  select
    r,
    raw,
    public.neurofinance_status_text(coalesce(
      raw ->> 'generalStatus',
      raw ->> 'general',
      r #>> '{stages,general,provider_status}',
      r ->> 'generalStatus',
      r ->> 'general',
      case when account_status = 'active' then 'APPROVED' end
    ), 'PENDING') as general_status,
    public.neurofinance_status_text(coalesce(
      raw ->> 'commercialInfoStatus',
      raw ->> 'commercialInfo',
      raw ->> 'commercial_info',
      r #>> '{stages,commercial,provider_status}',
      r ->> 'commercialInfoStatus',
      r ->> 'commercialInfo',
      r ->> 'commercial_info'
    ), 'PENDING') as commercial_status,
    public.neurofinance_status_text(coalesce(
      raw ->> 'bankAccountInfoStatus',
      raw ->> 'bankAccountInfo',
      raw ->> 'bank_account_info',
      r #>> '{stages,bank,provider_status}',
      r ->> 'bankAccountInfoStatus',
      r ->> 'bankAccountInfo',
      r ->> 'bank_account_info'
    ), 'PENDING') as bank_status,
    public.neurofinance_status_text(coalesce(
      raw ->> 'documentStatus',
      raw ->> 'documentationStatus',
      raw ->> 'documentation',
      raw ->> 'document',
      raw ->> 'documents',
      r #>> '{stages,documents,provider_status}',
      r ->> 'documentStatus',
      r ->> 'documentation',
      r ->> 'document'
    ), case when coalesce(raw ->> 'generalStatus', raw ->> 'general', account_status) = 'APPROVED' then 'APPROVED' else 'PENDING' end) as documents_status
  from raw_payload
),
statuses as (
  select
    r,
    raw,
    general_status,
    commercial_status,
    bank_status,
    documents_status,
    public.neurofinance_status_text(coalesce(
      raw ->> 'billingInfoStatus',
      raw ->> 'billingInfo',
      raw ->> 'bankSlipInfoStatus',
      raw ->> 'bankSlipInfo',
      raw ->> 'boletoInfoStatus',
      raw ->> 'boletoInfo',
      r #>> '{stages,billing,provider_status}',
      r ->> 'billingInfoStatus',
      r ->> 'bankSlipInfoStatus',
      r ->> 'boletoInfoStatus',
      case when general_status = 'APPROVED' then 'APPROVED' end
    ), case when general_status = 'APPROVED' then 'APPROVED' else 'UNKNOWN' end) as billing_status
  from base_statuses
),
stages as (
  select jsonb_build_object(
    'general', public.neurofinance_stage_snapshot('Aprovação geral do cadastro', general_status),
    'commercial', public.neurofinance_stage_snapshot('Dados comerciais', commercial_status),
    'bank', public.neurofinance_stage_snapshot('Dados bancários', bank_status),
    'billing', public.neurofinance_stage_snapshot('Dados do boleto', billing_status),
    'documents', public.neurofinance_stage_snapshot('Documentos', documents_status)
  ) as stages_json,
  raw
  from statuses
),
flags as (
  select
    stages_json,
    raw,
    bool_and(stage.value ->> 'status' = 'approved') as all_approved,
    bool_or(stage.value ->> 'status' = 'rejected') as has_rejected,
    bool_or(coalesce((stage.value ->> 'actionable')::boolean, false)) as has_actionable
  from stages
  cross join lateral jsonb_each(stages_json) as stage
  group by stages_json, raw
),
ui as (
  select
    stages_json,
    raw,
    all_approved,
    has_rejected,
    has_actionable,
    case
      when all_approved then 'active'
      when has_rejected then 'restricted'
      when has_actionable then 'onboarding'
      else 'pending_review'
    end as ui_status
  from flags
)
select jsonb_build_object(
  'overall_status', ui_status,
  'ui_status', ui_status,
  'is_approved', all_approved,
  'has_open_stages', not all_approved,
  'has_actionable_stages', has_actionable,
  'stages', stages_json,
  'raw', raw,
  'source', status_source,
  'synced_at', now()
)
from ui;
$$;

alter table if exists public.financial_accounts
  add column if not exists requirements jsonb default '{}'::jsonb,
  add column if not exists last_sync_error text,
  add column if not exists last_balance_sync_at timestamptz,
  add column if not exists last_asaas_event_type text,
  add column if not exists last_asaas_event_at timestamptz,
  add column if not exists asaas_environment text default 'production';

alter table if exists public.financial_accounts
  drop constraint if exists financial_accounts_status_check;

update public.financial_accounts fa
set
  requirements = normalized.snapshot,
  status = case
    when fa.asaas_account_id is null then coalesce(nullif(fa.status, ''), 'not_started')
    else normalized.snapshot ->> 'ui_status'
  end,
  charges_enabled = case
    when fa.asaas_account_id is null then coalesce(fa.charges_enabled, false)
    else coalesce((normalized.snapshot ->> 'is_approved')::boolean, false)
  end,
  payouts_enabled = case
    when fa.asaas_account_id is null then coalesce(fa.payouts_enabled, false)
    else coalesce((normalized.snapshot ->> 'is_approved')::boolean, false)
  end,
  details_submitted = coalesce((normalized.snapshot #>> '{stages,commercial,status}') <> 'missing', fa.details_submitted, false),
  asaas_environment = coalesce(nullif(fa.asaas_environment, ''), 'production'),
  updated_at = now()
from (
  select id, public.neurofinance_normalize_asaas_requirements(requirements, status, 'migration') as snapshot
  from public.financial_accounts
) normalized
where fa.id = normalized.id;

alter table if exists public.financial_accounts
  add constraint financial_accounts_status_check
  check (
    status in (
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

create index if not exists idx_financial_accounts_requirements_gin
  on public.financial_accounts using gin (requirements);

drop view if exists public.neurofinance_account_state;
create view public.neurofinance_account_state
with (security_invoker = true)
as
select
  fa.id,
  fa.user_id,
  fa.status,
  fa.provider,
  fa.asaas_account_id,
  fa.asaas_wallet_id,
  fa.asaas_environment,
  fa.charges_enabled,
  fa.payouts_enabled,
  fa.details_submitted,
  fa.bank_code,
  fa.bank_agency,
  fa.bank_account,
  fa.bank_account_digit,
  fa.bank_account_last4,
  fa.bank_name,
  fa.requirements,
  public.neurofinance_normalize_asaas_requirements(fa.requirements, fa.status, 'view') as account_state,
  fa.last_sync_error,
  fa.last_balance_sync_at,
  fa.last_asaas_event_type,
  fa.last_asaas_event_at,
  fa.updated_at
from public.financial_accounts fa;

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
  p.status,
  p.payment_method_type,
  p.gross_amount,
  p.net_amount,
  p.platform_fee_amount,
  p.currency,
  p.description,
  p.checkout_url,
  p.expires_at,
  p.paid_at,
  p.created_at,
  p.updated_at,
  p.metadata
from public.nb_payments p
left join public.patients on patients.id = p.patient_id;

drop view if exists public.manual_finance_summary_v;
create view public.manual_finance_summary_v
with (security_invoker = true)
as
select
  t.user_id,
  date_trunc('month', t.date)::date as month,
  sum(case when t.type = 'income' then coalesce(t.amount, 0) else 0 end) as manual_income,
  sum(case when t.type = 'expense' then coalesce(t.amount, 0) else 0 end) as manual_expense,
  sum(case when t.type = 'income' then coalesce(t.amount, 0) else -coalesce(t.amount, 0) end) as manual_net,
  count(*) as transaction_count
from public.transactions t
where t.asaas_transaction_id is null
  and coalesce(t.external_reference, '') not ilike 'pay_%'
group by t.user_id, date_trunc('month', t.date)::date;

drop view if exists public.neurofinance_activity_v;
create view public.neurofinance_activity_v
with (security_invoker = true)
as
select
  p.user_id,
  p.id as source_id,
  'charge'::text as activity_type,
  p.status,
  p.description,
  p.gross_amount as amount,
  p.created_at as occurred_at,
  p.metadata
from public.nb_payments p
union all
select
  po.user_id,
  po.id as source_id,
  'payout'::text as activity_type,
  po.status,
  po.destination_summary as description,
  po.amount,
  coalesce(po.requested_at, po.created_at) as occurred_at,
  po.metadata
from public.nb_payouts po;

grant select on public.neurofinance_account_state to authenticated;
grant select on public.neurofinance_charges_v to authenticated;
grant select on public.manual_finance_summary_v to authenticated;
grant select on public.neurofinance_activity_v to authenticated;

comment on column public.financial_accounts.requirements is
  'Normalized Asaas account approval snapshot used by NeuroFinance UI and Edge Functions.';

comment on view public.neurofinance_account_state is
  'Security-invoker account-state view. The frontend may use it to read the same normalized approval state saved in financial_accounts.';

comment on view public.neurofinance_charges_v is
  'Read model for real Asaas charges/payments. This is separate from manual finance transactions.';

comment on view public.manual_finance_summary_v is
  'Read model for manual financial management. It intentionally excludes Asaas provider records.';

comment on view public.neurofinance_activity_v is
  'Operational activity stream for Asaas-backed NeuroFinance payments and payouts.';
