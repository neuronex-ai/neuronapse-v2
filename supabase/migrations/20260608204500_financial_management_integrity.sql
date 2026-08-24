-- ================================================================
-- Financial Management integrity hardening
--
-- Goals:
-- - Add idempotency keys for managerial writes.
-- - Represent refunds/chargebacks as auditable reversal entries.
-- - Fix NULL-clinic category uniqueness.
-- - Add lightweight integrity audit view for rollout checks.
-- ================================================================

begin;

alter table if exists public.financial_entries
  add column if not exists idempotency_key text,
  add column if not exists reversal_of_entry_id uuid references public.financial_entries(id) on delete set null,
  add column if not exists reversal_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text;

alter table if exists public.recurring_financial_entries
  add column if not exists idempotency_key text;

alter table if exists public.financial_reconciliations
  add column if not exists idempotency_key text;

alter table if exists public.financial_entries
  drop constraint if exists financial_entries_origin_check;

alter table if exists public.financial_entries
  add constraint financial_entries_origin_check
  check (origin in (
    'appointment',
    'manual',
    'package',
    'subscription',
    'convenio',
    'recurring',
    'nfe',
    'neurofinance',
    'reversal'
  ));

-- Existing UNIQUE(professional_id, clinic_id, type, name) permits duplicates
-- when clinic_id is NULL. Collapse exact duplicates first, preserving the
-- oldest/default category and moving references to the kept row.
with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by professional_id, clinic_id, type, lower(btrim(name))
      order by is_default desc, created_at asc, id asc
    ) as keep_id
  from public.financial_categories
)
update public.financial_entries fe
set category_id = ranked_categories.keep_id,
    updated_at = now()
from ranked_categories
where fe.category_id = ranked_categories.id
  and ranked_categories.id <> ranked_categories.keep_id;

with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by professional_id, clinic_id, type, lower(btrim(name))
      order by is_default desc, created_at asc, id asc
    ) as keep_id
  from public.financial_categories
)
update public.recurring_financial_entries rfe
set category_id = ranked_categories.keep_id,
    updated_at = now()
from ranked_categories
where rfe.category_id = ranked_categories.id
  and ranked_categories.id <> ranked_categories.keep_id;

with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by professional_id, clinic_id, type, lower(btrim(name))
      order by is_default desc, created_at asc, id asc
    ) as keep_id
  from public.financial_categories
)
update public.financial_automation_settings fas
set appointment_default_category_id = ranked_categories.keep_id,
    updated_at = now()
from ranked_categories
where fas.appointment_default_category_id = ranked_categories.id
  and ranked_categories.id <> ranked_categories.keep_id;

with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by professional_id, clinic_id, type, lower(btrim(name))
      order by is_default desc, created_at asc, id asc
    ) as keep_id
  from public.financial_categories
)
delete from public.financial_categories fc
using ranked_categories
where fc.id = ranked_categories.id
  and ranked_categories.id <> ranked_categories.keep_id;

create unique index if not exists idx_financial_categories_professional_null_clinic_name
  on public.financial_categories(professional_id, type, lower(btrim(name)))
  where clinic_id is null;

create unique index if not exists idx_financial_categories_professional_clinic_name
  on public.financial_categories(professional_id, clinic_id, type, lower(btrim(name)))
  where clinic_id is not null;

update public.financial_entries
set idempotency_key = 'legacy:transactions:' || legacy_transaction_id::text
where idempotency_key is null
  and legacy_transaction_id is not null;

update public.financial_entries
set idempotency_key = 'neurofinance:charge:' || neurofinance_charge_id::text
where idempotency_key is null
  and neurofinance_charge_id is not null;

with appointment_entries as (
  select
    id,
    row_number() over (
      partition by professional_id, appointment_id, type
      order by
        case status when 'paid' then 0 when 'pending' then 1 when 'planned' then 2 else 3 end,
        created_at asc,
        id asc
    ) as rn
  from public.financial_entries
  where idempotency_key is null
    and appointment_id is not null
    and type = 'income'
    and origin in ('appointment', 'package')
)
update public.financial_entries fe
set idempotency_key = 'appointment:primary:' || fe.appointment_id::text
from appointment_entries
where fe.id = appointment_entries.id
  and appointment_entries.rn = 1;

create unique index if not exists idx_financial_entries_professional_idempotency
  on public.financial_entries(professional_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_financial_entries_reversal_of_entry
  on public.financial_entries(reversal_of_entry_id)
  where reversal_of_entry_id is not null;

create unique index if not exists idx_recurring_financial_entries_professional_idempotency
  on public.recurring_financial_entries(professional_id, idempotency_key)
  where idempotency_key is not null;

with ranked_reconciliations as (
  select
    id,
    row_number() over (
      partition by financial_entry_id, neurofinance_charge_id
      order by matched_at desc, created_at desc, id desc
    ) as rn
  from public.financial_reconciliations
  where neurofinance_charge_id is not null
)
delete from public.financial_reconciliations fr
using ranked_reconciliations
where fr.id = ranked_reconciliations.id
  and ranked_reconciliations.rn > 1;

create unique index if not exists idx_financial_reconciliations_entry_charge_unique
  on public.financial_reconciliations(financial_entry_id, neurofinance_charge_id)
  where neurofinance_charge_id is not null;

create unique index if not exists idx_financial_reconciliations_idempotency
  on public.financial_reconciliations(professional_id, idempotency_key)
  where idempotency_key is not null;

drop view if exists public.financial_integrity_audit_v;
create view public.financial_integrity_audit_v
with (security_invoker = true)
as
select
  fe.professional_id,
  'financial_entries_without_idempotency'::text as check_name,
  count(*)::bigint as issue_count
from public.financial_entries fe
where fe.idempotency_key is null
group by fe.professional_id

union all

select
  fe.professional_id,
  'financial_entries_duplicate_appointment_income'::text as check_name,
  count(*)::bigint as issue_count
from (
  select professional_id, appointment_id
  from public.financial_entries
  where appointment_id is not null
    and type = 'income'
    and status <> 'cancelled'
  group by professional_id, appointment_id
  having count(*) > 1
) fe
group by fe.professional_id

union all

select
  fc.professional_id,
  'financial_categories_duplicate_names'::text as check_name,
  count(*)::bigint as issue_count
from (
  select professional_id, clinic_id, type, lower(btrim(name)) as normalized_name
  from public.financial_categories
  group by professional_id, clinic_id, type, lower(btrim(name))
  having count(*) > 1
) fc
group by fc.professional_id

union all

select
  p.user_id as professional_id,
  'nb_payments_missing_financial_entry_link'::text as check_name,
  count(*)::bigint as issue_count
from public.nb_payments p
where p.financial_entry_id is null
  and p.status in ('paid', 'pending', 'processing', 'expired', 'refunded', 'failed')
group by p.user_id;

grant select on public.financial_integrity_audit_v to authenticated;

comment on column public.financial_entries.idempotency_key is
  'Stable key used to make managerial writes idempotent across Agenda, recurring generation and NeuroFinance webhook/sync.';

comment on column public.financial_entries.reversal_of_entry_id is
  'When set, this entry reverses another managerial entry, usually due to refund or chargeback.';

comment on view public.financial_integrity_audit_v is
  'Security-invoker rollout audit for managerial finance integrity checks scoped by existing RLS.';

commit;
