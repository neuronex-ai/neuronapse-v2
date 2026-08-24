alter table public.appointments
  add column if not exists updated_at timestamptz;

update public.appointments
set updated_at = coalesce(updated_at, created_at, start_time, now())
where updated_at is null;

alter table public.appointments
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists set_updated_at on public.appointments;
create trigger set_updated_at
before update on public.appointments
for each row execute function public.update_updated_at_column();

update public.financial_accounts
set last_sync_error = case
  when last_sync_error ilike '%chave de api%' then
    'Não foi possível validar a conexão com a conta Asaas.'
  when last_sync_error like '%N?o foi poss?vel%' then
    'Não foi possível validar a conexão com a conta Asaas.'
  else last_sync_error
end
where last_sync_error is not null;

update public.financial_accounts
set
  metadata = coalesce(metadata, '{}'::jsonb) - 'asaas_api_key',
  updated_at = now()
where coalesce(metadata, '{}'::jsonb) ? 'asaas_api_key';

update public.financial_accounts
set
  status = 'account_missing',
  charges_enabled = false,
  payouts_enabled = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'provider_connection',
    jsonb_build_object(
      'status', 'account_missing',
      'detected_at', now(),
      'error_code', 'INVALID_PROVIDER_CREDENTIAL',
      'support_required', true
    )
  ),
  updated_at = now()
where status = 'disabled'
  and last_sync_error = 'Não foi possível validar a conexão com a conta Asaas.';

drop view if exists public.dashboard_patient_activity_v;
create view public.dashboard_patient_activity_v
with (security_invoker = true)
as
select
  a.user_id,
  a.id as source_id,
  'appointment'::text as source_type,
  a.patient_id,
  coalesce(p.name, 'Paciente') as patient_name,
  a.updated_at as occurred_at,
  a.created_at,
  a.start_time as reference_at,
  a.status,
  null::numeric as amount,
  coalesce(a.metadata, '{}'::jsonb) as metadata
from public.appointments a
left join public.patients p on p.id = a.patient_id
where a.patient_id is not null
  and coalesce(a.metadata->>'kind', 'session') = 'session'

union all

select
  t.user_id,
  t.id as source_id,
  'payment'::text as source_type,
  t.patient_id,
  coalesce(p.name, 'Paciente') as patient_name,
  t.created_at as occurred_at,
  t.created_at,
  t.date::timestamptz as reference_at,
  coalesce(t.status, 'completed') as status,
  t.amount,
  jsonb_build_object(
    'description', t.description,
    'type', t.type,
    'origin', coalesce(t.asaas_transaction_id, t.external_reference)
  ) as metadata
from public.transactions t
left join public.patients p on p.id = t.patient_id
where t.type = 'income'
  and t.asaas_transaction_id is null
  and coalesce(t.external_reference, '') not ilike 'pay_%'

union all

select
  pay.user_id,
  pay.id as source_id,
  'payment'::text as source_type,
  pay.patient_id,
  coalesce(p.name, 'Paciente') as patient_name,
  coalesce(pay.paid_at, pay.updated_at, pay.created_at) as occurred_at,
  pay.created_at,
  coalesce(pay.paid_at, pay.updated_at, pay.created_at) as reference_at,
  pay.status,
  (pay.gross_amount::numeric / 100) as amount,
  jsonb_build_object(
    'description', pay.description,
    'provider', pay.provider,
    'provider_payment_id', pay.provider_payment_id,
    'payment_method_type', pay.payment_method_type
  ) || coalesce(pay.metadata, '{}'::jsonb) as metadata
from public.nb_payments pay
left join public.patients p on p.id = pay.patient_id
where pay.status = 'paid'

union all

select
  p.user_id,
  pa.id as source_id,
  'anamnesis'::text as source_type,
  pa.patient_id,
  coalesce(p.name, 'Paciente') as patient_name,
  pa.updated_at as occurred_at,
  pa.created_at,
  pa.updated_at as reference_at,
  'completed'::text as status,
  null::numeric as amount,
  jsonb_build_object('anamnesis_type', pa.type) as metadata
from public.patient_anamneses pa
join public.patients p on p.id = pa.patient_id

union all

select
  sn.user_id,
  sn.id as source_id,
  'note'::text as source_type,
  sn.patient_id,
  coalesce(p.name, 'Paciente') as patient_name,
  sn.created_at as occurred_at,
  sn.created_at,
  sn.created_at as reference_at,
  'completed'::text as status,
  null::numeric as amount,
  jsonb_build_object('appointment_id', sn.appointment_id) as metadata
from public.session_notes sn
left join public.patients p on p.id = sn.patient_id;

grant select on public.dashboard_patient_activity_v to authenticated;

comment on view public.dashboard_patient_activity_v is
  'Security-invoker read model for the three Dashboard desktop activity surfaces.';

drop function if exists public.recalculate_ledger_balance(uuid);

create or replace function public.verify_financial_pin(pin_attempt text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select ufs.pin_hash
  into stored_hash
  from public.user_financial_settings ufs
  where ufs.user_id = auth.uid();

  return stored_hash is not null
    and stored_hash = extensions.crypt(pin_attempt, stored_hash);
end;
$$;

revoke all on function public.verify_financial_pin(text) from public;
grant execute on function public.verify_financial_pin(text) to authenticated;

create or replace function public.get_monthly_report_data(start_date date, end_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with appointment_stats as (
    select
      count(*) as total,
      count(*) filter (where a.status in ('attended', 'completed')) as completed,
      count(*) filter (where a.status in ('cancelled_by_patient', 'cancelled_by_professional', 'cancelled')) as cancelled,
      count(*) filter (where a.status in ('unscored', 'pending', 'confirmed')) as scheduled
    from public.appointments a
    where a.user_id = auth.uid()
      and a.start_time >= start_date::timestamptz
      and a.start_time < (end_date + 1)::timestamptz
  ),
  financial_stats as (
    select
      coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as total_income,
      coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as total_expense
    from public.transactions t
    where t.user_id = auth.uid()
      and t.date >= start_date
      and t.date <= end_date
  ),
  new_patients as (
    select count(*) as count
    from public.patients p
    where p.user_id = auth.uid()
      and p.created_at >= start_date::timestamptz
      and p.created_at < (end_date + 1)::timestamptz
  )
  select jsonb_build_object(
    'appointments', (select to_jsonb(appointment_stats) from appointment_stats),
    'financial', (select to_jsonb(financial_stats) from financial_stats),
    'new_patients', (select count from new_patients)
  );
$$;

revoke all on function public.get_monthly_report_data(date, date) from public;
grant execute on function public.get_monthly_report_data(date, date) to authenticated;

create or replace function public.export_user_data()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with patient_data as (
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) as data
    from public.patients p
    where p.user_id = auth.uid()
  ),
  appointment_data as (
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) as data
    from public.appointments a
    where a.user_id = auth.uid()
  ),
  transaction_data as (
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data
    from public.transactions t
    where t.user_id = auth.uid()
  ),
  note_data as (
    select coalesce(jsonb_agg(to_jsonb(sn)), '[]'::jsonb) as data
    from public.session_notes sn
    where sn.user_id = auth.uid()
  ),
  template_data as (
    select coalesce(jsonb_agg(to_jsonb(tpl)), '[]'::jsonb) as data
    from public.templates tpl
    where tpl.psychologist_id = auth.uid()
  )
  select jsonb_build_object(
    'metadata', jsonb_build_object(
      'generated_at', now(),
      'user_id', auth.uid(),
      'version', '2.0'
    ),
    'patients', (select data from patient_data),
    'appointments', (select data from appointment_data),
    'transactions', (select data from transaction_data),
    'session_notes', (select data from note_data),
    'templates', (select data from template_data)
  );
$$;

revoke all on function public.export_user_data() from public;
grant execute on function public.export_user_data() to authenticated;
