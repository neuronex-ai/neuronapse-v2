-- ================================================================
-- Financial Management foundation
--
-- Goals:
-- - Introduce financial_entries as the managerial source of truth.
-- - Keep existing NeuroFinance/Asaas banking tables intact.
-- - Add a safe link from nb_payments to financial_entries.
-- - Keep legacy transactions readable while the UI migrates.
-- ================================================================

create schema if not exists private;

create or replace function private.can_access_financial_scope(
  scope_clinic_id uuid,
  owner_user_id uuid,
  require_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (select auth.uid()) = owner_user_id;
$$;

revoke all on function private.can_access_financial_scope(uuid, uuid, boolean) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_access_financial_scope(uuid, uuid, boolean) to authenticated;

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  professional_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null,
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_categories_name_unique unique (professional_id, clinic_id, type, name)
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  description text,
  category_id uuid references public.financial_categories(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  competence_date date,
  paid_at timestamptz,
  status text not null default 'pending'
    check (status in ('planned', 'pending', 'paid', 'overdue', 'cancelled')),
  payment_method text not null default 'manual'
    check (payment_method in (
      'manual',
      'pix',
      'boleto',
      'card',
      'cash',
      'external_transfer',
      'convenio',
      'other'
    )),
  origin text not null default 'manual'
    check (origin in (
      'appointment',
      'manual',
      'package',
      'subscription',
      'convenio',
      'recurring',
      'nfe',
      'neurofinance'
    )),
  neurofinance_transaction_id uuid,
  neurofinance_charge_id uuid,
  legacy_transaction_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_financial_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  professional_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.financial_categories(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  end_date date,
  next_generation_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'finished', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_reconciliations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  professional_id uuid not null references auth.users(id) on delete cascade,
  financial_entry_id uuid not null references public.financial_entries(id) on delete cascade,
  neurofinance_transaction_id uuid,
  neurofinance_charge_id uuid,
  matched_by text not null check (matched_by in ('automatic', 'manual')),
  matched_at timestamptz not null default now(),
  confidence_score numeric(5,2),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_automation_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  professional_id uuid not null references auth.users(id) on delete cascade,
  appointment_auto_create_enabled boolean not null default false,
  appointment_default_amount numeric(14,2),
  appointment_default_category_id uuid references public.financial_categories(id) on delete set null,
  appointment_due_days integer not null default 0,
  attended_status_moves_to_pending boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_financial_automation_settings_professional
  on public.financial_automation_settings(professional_id)
  where clinic_id is null;

create unique index if not exists idx_financial_automation_settings_clinic_professional
  on public.financial_automation_settings(clinic_id, professional_id)
  where clinic_id is not null;

create unique index if not exists idx_financial_entries_legacy_transaction
  on public.financial_entries(legacy_transaction_id)
  where legacy_transaction_id is not null;

create unique index if not exists idx_financial_entries_neurofinance_charge
  on public.financial_entries(neurofinance_charge_id)
  where neurofinance_charge_id is not null;

create index if not exists idx_financial_entries_professional_due
  on public.financial_entries(professional_id, due_date desc);

create index if not exists idx_financial_entries_professional_competence
  on public.financial_entries(professional_id, competence_date desc);

create index if not exists idx_financial_entries_professional_status
  on public.financial_entries(professional_id, status);

create index if not exists idx_financial_entries_clinic_status
  on public.financial_entries(clinic_id, status)
  where clinic_id is not null;

create index if not exists idx_financial_entries_patient
  on public.financial_entries(patient_id)
  where patient_id is not null;

create index if not exists idx_financial_entries_appointment
  on public.financial_entries(appointment_id)
  where appointment_id is not null;

create index if not exists idx_financial_entries_category
  on public.financial_entries(category_id)
  where category_id is not null;

create index if not exists idx_financial_reconciliations_entry
  on public.financial_reconciliations(financial_entry_id);

create index if not exists idx_financial_reconciliations_charge
  on public.financial_reconciliations(neurofinance_charge_id)
  where neurofinance_charge_id is not null;

create index if not exists idx_recurring_financial_entries_professional
  on public.recurring_financial_entries(professional_id, status, next_generation_date);

alter table public.financial_categories enable row level security;
alter table public.financial_entries enable row level security;
alter table public.recurring_financial_entries enable row level security;
alter table public.financial_reconciliations enable row level security;
alter table public.financial_automation_settings enable row level security;

drop policy if exists "Financial categories read scoped" on public.financial_categories;
create policy "Financial categories read scoped"
  on public.financial_categories for select
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, false));

drop policy if exists "Financial categories insert scoped" on public.financial_categories;
create policy "Financial categories insert scoped"
  on public.financial_categories for insert
  to authenticated
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial categories update scoped" on public.financial_categories;
create policy "Financial categories update scoped"
  on public.financial_categories for update
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true))
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial categories delete scoped" on public.financial_categories;
create policy "Financial categories delete scoped"
  on public.financial_categories for delete
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial entries read scoped" on public.financial_entries;
create policy "Financial entries read scoped"
  on public.financial_entries for select
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, false));

drop policy if exists "Financial entries insert scoped" on public.financial_entries;
create policy "Financial entries insert scoped"
  on public.financial_entries for insert
  to authenticated
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial entries update scoped" on public.financial_entries;
create policy "Financial entries update scoped"
  on public.financial_entries for update
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true))
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial entries delete scoped" on public.financial_entries;
create policy "Financial entries delete scoped"
  on public.financial_entries for delete
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Recurring financial entries read scoped" on public.recurring_financial_entries;
create policy "Recurring financial entries read scoped"
  on public.recurring_financial_entries for select
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, false));

drop policy if exists "Recurring financial entries write scoped" on public.recurring_financial_entries;
create policy "Recurring financial entries write scoped"
  on public.recurring_financial_entries for all
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true))
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial reconciliations read scoped" on public.financial_reconciliations;
create policy "Financial reconciliations read scoped"
  on public.financial_reconciliations for select
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, false));

drop policy if exists "Financial reconciliations write scoped" on public.financial_reconciliations;
create policy "Financial reconciliations write scoped"
  on public.financial_reconciliations for all
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true))
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

drop policy if exists "Financial automation settings read scoped" on public.financial_automation_settings;
create policy "Financial automation settings read scoped"
  on public.financial_automation_settings for select
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, false));

drop policy if exists "Financial automation settings write scoped" on public.financial_automation_settings;
create policy "Financial automation settings write scoped"
  on public.financial_automation_settings for all
  to authenticated
  using (private.can_access_financial_scope(clinic_id, professional_id, true))
  with check (private.can_access_financial_scope(clinic_id, professional_id, true));

grant select, insert, update, delete on public.financial_categories to authenticated;
grant select, insert, update, delete on public.financial_entries to authenticated;
grant select, insert, update, delete on public.recurring_financial_entries to authenticated;
grant select, insert, update, delete on public.financial_reconciliations to authenticated;
grant select, insert, update, delete on public.financial_automation_settings to authenticated;
revoke truncate, references, trigger on public.financial_categories from authenticated;
revoke truncate, references, trigger on public.financial_entries from authenticated;
revoke truncate, references, trigger on public.recurring_financial_entries from authenticated;
revoke truncate, references, trigger on public.financial_reconciliations from authenticated;
revoke truncate, references, trigger on public.financial_automation_settings from authenticated;

drop trigger if exists set_updated_at on public.financial_categories;
create trigger set_updated_at
before update on public.financial_categories
for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at on public.financial_entries;
create trigger set_updated_at
before update on public.financial_entries
for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at on public.recurring_financial_entries;
create trigger set_updated_at
before update on public.recurring_financial_entries
for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at on public.financial_automation_settings;
create trigger set_updated_at
before update on public.financial_automation_settings
for each row execute function public.update_updated_at_column();

alter table if exists public.nb_payments
  add column if not exists financial_entry_id uuid references public.financial_entries(id) on delete set null;

create index if not exists idx_nb_payments_financial_entry_id
  on public.nb_payments(financial_entry_id)
  where financial_entry_id is not null;

do $$
begin
  if to_regclass('public.transactions') is not null then
    execute $backfill$
      insert into public.financial_entries (
        professional_id,
        patient_id,
        appointment_id,
        type,
        title,
        description,
        amount,
        due_date,
        competence_date,
        paid_at,
        status,
        payment_method,
        origin,
        legacy_transaction_id,
        metadata,
        created_at,
        updated_at
      )
      select
        t.user_id,
        patient_ref.id,
        appointment_ref.id,
        case when t.type in ('income', 'expense') then t.type else 'income' end,
        coalesce(nullif(t.description, ''), case when t.type = 'expense' then 'Despesa' else 'Receita' end),
        t.description,
        abs(coalesce(t.amount, 0))::numeric(14,2),
        t.date::date,
        t.date::date,
        case
          when lower(coalesce(t.status, '')) in ('paid', 'completed', 'received')
            then t.date::timestamptz
          else null
        end,
        case
          when lower(coalesce(t.status, '')) in ('paid', 'completed', 'received') then 'paid'
          when lower(coalesce(t.status, '')) in ('cancelled', 'canceled') then 'cancelled'
          when t.type = 'income' and t.date::date < current_date then 'overdue'
          else 'pending'
        end,
        case lower(coalesce(t.payment_method, 'manual'))
          when 'money' then 'cash'
          when 'credit_card' then 'card'
          when 'debit_card' then 'card'
          when 'external_transfer' then 'external_transfer'
          when 'boleto' then 'boleto'
          when 'pix' then 'pix'
          else 'manual'
        end,
        case
          when coalesce(t.asaas_transaction_id, '') <> ''
            or coalesce(t.external_reference, '') ilike 'pay_%'
            then 'neurofinance'
          when appointment_ref.id is not null then 'appointment'
          when t.package_id is not null then 'package'
          else 'manual'
        end,
        t.id,
        jsonb_strip_nulls(jsonb_build_object(
          'legacy_source', 'transactions',
          'category', t.category,
          'external_reference', t.external_reference,
          'asaas_transaction_id', t.asaas_transaction_id,
          'legacy_patient_id', t.patient_id,
          'legacy_appointment_id', t.appointment_id,
          'package_id', t.package_id,
          'attachment_url', t.attachment_url,
          'installments', t.installments
        )),
        coalesce(t.created_at, now()),
        coalesce(t.created_at, now())
      from public.transactions t
      left join public.patients patient_ref
        on patient_ref.id = t.patient_id
      left join public.appointments appointment_ref
        on appointment_ref.id = t.appointment_id
      where not exists (
        select 1
        from public.financial_entries fe
        where fe.legacy_transaction_id = t.id
      )
    $backfill$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.nb_payments') is not null then
    execute $link$
      update public.nb_payments p
      set financial_entry_id = fe.id
      from public.financial_entries fe
      where p.financial_entry_id is null
        and fe.neurofinance_charge_id is null
        and fe.professional_id = p.user_id
        and (
          (p.appointment_id is not null and fe.appointment_id = p.appointment_id)
          or (
            p.patient_id is not null
            and fe.patient_id = p.patient_id
            and abs((fe.amount * 100)::bigint - p.gross_amount::bigint) <= 1
            and fe.origin in ('appointment', 'manual', 'neurofinance')
          )
        )
    $link$;

    execute $entry_link$
      update public.financial_entries fe
      set neurofinance_charge_id = p.id,
          origin = case when fe.origin = 'manual' then 'neurofinance' else fe.origin end,
          payment_method = case
            when lower(coalesce(p.payment_method_type, '')) in ('pix', 'boleto') then lower(p.payment_method_type)
            when lower(coalesce(p.payment_method_type, '')) in ('card', 'credit_card', 'debit', 'debit_card') then 'card'
            else fe.payment_method
          end,
          updated_at = now()
      from public.nb_payments p
      where p.financial_entry_id = fe.id
        and fe.neurofinance_charge_id is null
    $entry_link$;
  end if;
end $$;

drop view if exists public.financial_monthly_summary_v;
create view public.financial_monthly_summary_v
with (security_invoker = true)
as
select
  fe.professional_id,
  fe.clinic_id,
  date_trunc('month', coalesce(fe.competence_date, fe.due_date, fe.paid_at::date, fe.created_at::date))::date as month,
  coalesce(sum(fe.amount) filter (where fe.type = 'income'), 0)::numeric(14,2) as income_total,
  coalesce(sum(fe.amount) filter (where fe.type = 'income' and fe.status = 'paid'), 0)::numeric(14,2) as income_paid,
  coalesce(sum(fe.amount) filter (where fe.type = 'income' and fe.status <> 'paid'), 0)::numeric(14,2) as income_unpaid,
  coalesce(sum(fe.amount) filter (where fe.type = 'expense'), 0)::numeric(14,2) as expense_total,
  coalesce(sum(fe.amount) filter (where fe.type = 'expense' and fe.status = 'paid'), 0)::numeric(14,2) as expense_paid,
  coalesce(sum(fe.amount) filter (where fe.type = 'expense' and fe.status <> 'paid'), 0)::numeric(14,2) as expense_unpaid,
  (
    coalesce(sum(fe.amount) filter (where fe.type = 'income'), 0)
    - coalesce(sum(fe.amount) filter (where fe.type = 'expense'), 0)
  )::numeric(14,2) as expected_result,
  (
    coalesce(sum(fe.amount) filter (where fe.type = 'income' and fe.status = 'paid'), 0)
    - coalesce(sum(fe.amount) filter (where fe.type = 'expense' and fe.status = 'paid'), 0)
  )::numeric(14,2) as current_result
from public.financial_entries fe
group by
  fe.professional_id,
  fe.clinic_id,
  date_trunc('month', coalesce(fe.competence_date, fe.due_date, fe.paid_at::date, fe.created_at::date))::date;

grant select on public.financial_monthly_summary_v to authenticated;

comment on table public.financial_entries is
  'Managerial financial source of truth. It can represent planned, pending or paid income/expense without a real bank movement.';

comment on column public.financial_entries.neurofinance_charge_id is
  'Optional link to the real NeuroFinance charge in nb_payments.';

comment on column public.financial_entries.neurofinance_transaction_id is
  'Optional link to the real NeuroFinance statement movement when one exists.';

comment on table public.financial_reconciliations is
  'Audit table for automatic/manual matches between managerial entries and real NeuroFinance movements.';
