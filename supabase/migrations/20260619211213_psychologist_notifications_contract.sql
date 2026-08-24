begin;

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

alter table public.notifications
  add column if not exists subaccount_id text,
  add column if not exists push_status text not null default 'not_requested',
  add column if not exists push_requested_at timestamptz,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_last_error text,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists email_status text not null default 'not_requested',
  add column if not exists email_requested_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_error text,
  add column if not exists email_attempts integer not null default 0;

update public.notifications
set category = case category
  when 'pacientes' then 'prontuario'
  when 'clinica' then 'sistema'
  else coalesce(nullif(category, ''), 'sistema')
end;

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check
  check (
    category in (
      'dashboard',
      'agenda',
      'prontuario',
      'teleconsulta',
      'neurodrive',
      'financeiro',
      'synapse',
      'ajustes',
      'seguranca',
      'sistema',
      'pacientes',
      'clinica'
    )
  );

alter table public.notifications drop constraint if exists notifications_push_status_check;
alter table public.notifications
  add constraint notifications_push_status_check
  check (push_status in ('not_requested', 'pending', 'processing', 'sent', 'partial', 'failed', 'no_devices'));

alter table public.notifications drop constraint if exists notifications_email_status_check;
alter table public.notifications
  add constraint notifications_email_status_check
  check (email_status in ('not_requested', 'pending', 'processing', 'sent', 'failed', 'no_recipient'));

create index if not exists idx_notifications_user_source_module
  on public.notifications (user_id, ((data ->> 'sourceModule')), created_at desc)
  where dismissed_at is null;

create index if not exists idx_notifications_user_finance_scope
  on public.notifications (user_id, ((data ->> 'financeScope')), created_at desc)
  where category = 'financeiro' and dismissed_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null,
  device_name text,
  browser text,
  platform text,
  device_id text,
  enabled boolean not null default true,
  permission text not null default 'granted',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fcm_token)
);

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  status text not null default 'pending',
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create or replace function public.touch_row_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_row_updated_at();

drop trigger if exists notification_push_deliveries_touch_updated_at on public.notification_push_deliveries;
create trigger notification_push_deliveries_touch_updated_at
before update on public.notification_push_deliveries
for each row execute function public.touch_row_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.notification_push_deliveries enable row level security;

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
create policy "Users can view own push subscriptions"
on public.push_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own push deliveries" on public.notification_push_deliveries;
create policy "Users can view own push deliveries"
on public.notification_push_deliveries for select
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update on public.push_subscriptions to authenticated;
grant select on public.notification_push_deliveries to authenticated;

create index if not exists idx_push_subscriptions_user_device
  on public.push_subscriptions (user_id, device_id, enabled);

create index if not exists idx_notification_push_deliveries_notification
  on public.notification_push_deliveries (notification_id, status);

create or replace function public.verify_notification_webhook_secret(
  p_channel text,
  p_candidate text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_secret text;
  secret_name text;
begin
  if coalesce(p_candidate, '') = '' then
    return false;
  end if;

  secret_name := case lower(coalesce(p_channel, ''))
    when 'push' then 'notification_push_webhook_secret'
    when 'email' then 'notification_email_webhook_secret'
    else null
  end;

  if secret_name is null then
    return false;
  end if;

  select decrypted_secret
    into expected_secret
  from vault.decrypted_secrets
  where name = secret_name
  order by created_at desc
  limit 1;

  return expected_secret is not null and expected_secret = p_candidate;
end;
$$;

revoke all on function public.verify_notification_webhook_secret(text, text) from public;
grant execute on function public.verify_notification_webhook_secret(text, text) to service_role;

create or replace function public.emit_user_notification(
  p_user_id uuid,
  p_event_id text,
  p_type text,
  p_category text,
  p_severity text,
  p_title text,
  p_message text,
  p_action_url text default null,
  p_priority text default 'normal',
  p_data jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb,
  p_organization_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_category text := lower(coalesce(nullif(p_category, ''), 'sistema'));
  v_severity text := lower(coalesce(nullif(p_severity, ''), 'info'));
  v_priority text := lower(coalesce(nullif(p_priority, ''), 'normal'));
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_email_enabled boolean := true;
  v_email_appointment_reminders boolean := true;
  v_email_payment_confirmations boolean := true;
  v_email_monthly_reports boolean := true;
  v_email_security_alerts boolean := true;
  v_push_enabled boolean := false;
  v_push_requested boolean := false;
  v_email_requested boolean := false;
begin
  if p_user_id is null or coalesce(p_title, '') = '' then
    return null;
  end if;

  if v_category = 'pacientes' then
    v_category := 'prontuario';
  elsif v_category = 'clinica' then
    v_category := 'sistema';
  elsif v_category not in (
    'dashboard',
    'agenda',
    'prontuario',
    'teleconsulta',
    'neurodrive',
    'financeiro',
    'synapse',
    'ajustes',
    'seguranca',
    'sistema'
  ) then
    v_category := 'sistema';
  end if;

  if v_severity not in ('success', 'info', 'warning', 'destructive') then
    v_severity := 'info';
  end if;

  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    v_priority := case when v_severity in ('warning', 'destructive') then 'high' else 'normal' end;
  end if;

  if v_category = 'financeiro' and not (v_data ? 'financeScope') then
    v_data := v_data || jsonb_build_object('financeScope', 'gestao');
  end if;

  v_data := jsonb_strip_nulls(
    v_data ||
    jsonb_build_object(
      'sourceModule',
      coalesce(v_data ->> 'sourceModule', v_category),
      'requiresAction',
      coalesce((lower(coalesce(v_data ->> 'requiresAction', 'false')) in ('true', '1', 'yes', 'sim')), false),
      'nativePushEligible',
      coalesce((lower(coalesce(v_data ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')), false)
    )
  );

  select
    coalesce(email_enabled, true),
    coalesce(email_appointment_reminders, true),
    coalesce(email_payment_confirmations, true),
    coalesce(email_monthly_reports, true),
    coalesce(email_security_alerts, true),
    coalesce(push_enabled, false)
    into
      v_email_enabled,
      v_email_appointment_reminders,
      v_email_payment_confirmations,
      v_email_monthly_reports,
      v_email_security_alerts,
      v_push_enabled
  from public.user_notification_settings
  where user_id = p_user_id;

  if not found then
    v_email_enabled := true;
    v_email_appointment_reminders := true;
    v_email_payment_confirmations := true;
    v_email_monthly_reports := true;
    v_email_security_alerts := true;
    v_push_enabled := false;
  end if;

  v_push_requested :=
    v_push_enabled
    and (
      lower(coalesce(v_data ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')
      or v_priority = 'urgent'
    );

  v_email_requested :=
    v_email_enabled
    and case v_category
      when 'agenda' then v_email_appointment_reminders
      when 'financeiro' then v_email_payment_confirmations
      when 'seguranca' then v_email_security_alerts
      when 'dashboard' then v_email_monthly_reports
      else false
    end;

  insert into public.notifications (
    user_id,
    organization_id,
    event_id,
    type,
    category,
    severity,
    title,
    message,
    action_url,
    priority,
    data,
    payload,
    subaccount_id,
    push_status,
    push_requested_at,
    email_status,
    email_requested_at,
    read,
    read_at,
    dismissed_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_organization_id,
    p_event_id,
    coalesce(nullif(p_type, ''), 'system'),
    v_category,
    v_severity,
    p_title,
    coalesce(p_message, ''),
    p_action_url,
    v_priority,
    v_data,
    coalesce(p_payload, '{}'::jsonb),
    v_data ->> 'subaccountId',
    case when v_push_requested then 'pending' else 'not_requested' end,
    case when v_push_requested then now() else null end,
    case when v_email_requested then 'pending' else 'not_requested' end,
    case when v_email_requested then now() else null end,
    false,
    null,
    null,
    now(),
    now()
  )
  on conflict (user_id, event_id)
  do update set
    organization_id = excluded.organization_id,
    type = excluded.type,
    category = excluded.category,
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    action_url = excluded.action_url,
    priority = excluded.priority,
    data = excluded.data,
    payload = excluded.payload,
    subaccount_id = excluded.subaccount_id,
    push_status = case
      when excluded.push_status = 'pending'
        and public.notifications.push_status in ('not_requested', 'failed', 'no_devices')
      then 'pending'
      else public.notifications.push_status
    end,
    push_requested_at = case
      when excluded.push_status = 'pending'
      then now()
      else public.notifications.push_requested_at
    end,
    email_status = case
      when excluded.email_status = 'pending'
        and public.notifications.email_status in ('not_requested', 'failed', 'no_recipient')
      then 'pending'
      else public.notifications.email_status
    end,
    email_requested_at = case
      when excluded.email_status = 'pending'
      then now()
      else public.notifications.email_requested_at
    end,
    read = false,
    read_at = null,
    dismissed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.emit_user_notification(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, uuid) from public;
grant execute on function public.emit_user_notification(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, uuid) to service_role;

create or replace function public.emit_public_appointment_notification(
  p_appointment_id uuid,
  p_token text,
  p_event text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_patient_id uuid;
  v_start_time timestamptz;
  v_patient_name text;
  v_event_id text;
  v_title text;
  v_message text;
  v_severity text;
  v_priority text := 'normal';
  v_native_push boolean := false;
begin
  if p_event not in ('rescheduled', 'confirmed', 'cancelled') then
    raise exception 'Unsupported appointment notification event';
  end if;

  select a.user_id, a.patient_id, a.start_time, p.name
    into v_user_id, v_patient_id, v_start_time, v_patient_name
  from public.appointments a
  left join public.patients p on p.id = a.patient_id
  where a.id = p_appointment_id
    and (
      a.token = p_token
      or exists (
        select 1
        from public.appointment_confirmation_tokens act
        where act.appointment_id = a.id
          and act.token::text = p_token
          and act.expires_at > now()
      )
    );

  if not found then
    raise exception 'Invalid appointment token';
  end if;

  if p_event = 'rescheduled' then
    v_event_id := format(
      'appointment:%s:rescheduled:%s',
      p_appointment_id,
      coalesce(to_char(v_start_time at time zone 'America/Sao_Paulo', 'YYYYMMDDHH24MI'), 'unscheduled')
    );
    v_title := 'Sessao reagendada pelo paciente';
    v_message := format(
      'A consulta de %s foi movida para %s.',
      coalesce(v_patient_name, 'um paciente'),
      coalesce(to_char(v_start_time at time zone 'America/Sao_Paulo', 'DD/MM as HH24:MI'), 'um novo horario')
    );
    v_severity := 'warning';
    v_priority := 'high';
    v_native_push := true;
  elsif p_event = 'confirmed' then
    v_event_id := format('appointment:%s:confirmed', p_appointment_id);
    v_title := 'Agendamento confirmado';
    v_message := format(
      'A presenca de %s foi confirmada para %s.',
      coalesce(v_patient_name, 'um paciente'),
      coalesce(to_char(v_start_time at time zone 'America/Sao_Paulo', 'DD/MM as HH24:MI'), 'o horario agendado')
    );
    v_severity := 'success';
  else
    v_event_id := format('appointment:%s:cancelled', p_appointment_id);
    v_title := 'Agendamento cancelado pelo paciente';
    v_message := format('A consulta de %s foi cancelada.', coalesce(v_patient_name, 'um paciente'));
    v_severity := 'warning';
    v_priority := 'high';
    v_native_push := true;
  end if;

  return public.emit_user_notification(
    v_user_id,
    v_event_id,
    'appointment_' || p_event,
    'agenda',
    v_severity,
    v_title,
    v_message,
    '/agenda?appointmentId=' || p_appointment_id::text,
    v_priority,
    jsonb_build_object(
      'sourceModule', 'agenda',
      'eventSource', 'public_appointment',
      'appointmentId', p_appointment_id,
      'patientId', v_patient_id,
      'event', p_event,
      'requiresAction', p_event in ('rescheduled', 'cancelled'),
      'nativePushEligible', v_native_push,
      'deadlineAt', v_start_time
    ),
    '{}'::jsonb,
    null
  );
end;
$$;

grant execute on function public.emit_public_appointment_notification(uuid, text, text)
to anon, authenticated;

create or replace function public.emit_public_anamnesis_notification(
  p_anamnesis_id uuid,
  p_token text,
  p_progress integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_patient_id uuid;
  v_patient_name text;
  v_progress integer := greatest(0, least(coalesce(p_progress, 0), 100));
begin
  select p.user_id, pa.patient_id, p.name
    into v_user_id, v_patient_id, v_patient_name
  from public.patient_anamneses pa
  join public.patients p on p.id = pa.patient_id
  where pa.id = p_anamnesis_id
    and pa.access_token = p_token
    and pa.token_expires_at > now();

  if not found then
    raise exception 'Invalid anamnesis token or expired link';
  end if;

  return public.emit_user_notification(
    v_user_id,
    'anamnesis:' || p_anamnesis_id::text || ':progress',
    case when v_progress >= 100 then 'anamnesis_completed' else 'anamnesis_progress' end,
    'prontuario',
    case when v_progress >= 100 then 'success' else 'info' end,
    case when v_progress >= 100 then 'Anamnese concluida' else 'Preenchimento parcial de anamnese' end,
    format(
      '%s preencheu %s%% da anamnese%s.',
      coalesce(v_patient_name, 'O paciente'),
      v_progress,
      case when v_progress >= 100 then '' else ' e salvou para continuar mais tarde' end
    ),
    '/pacientes/' || v_patient_id::text || '?tab=anamnesis',
    case when v_progress >= 100 then 'normal' else 'low' end,
    jsonb_build_object(
      'sourceModule', 'prontuario',
      'eventSource', 'public_anamnesis',
      'anamnesisId', p_anamnesis_id,
      'patientId', v_patient_id,
      'progress', v_progress,
      'requiresAction', v_progress >= 100,
      'nativePushEligible', false
    ),
    '{}'::jsonb,
    null
  );
end;
$$;

grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer)
to anon, authenticated;

create or replace function public.emit_session_note_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
begin
  if new.review_status = 'pending_review'
    and (tg_op = 'INSERT' or old.review_status is distinct from new.review_status)
  then
    select name into v_patient_name
    from public.patients
    where id = new.patient_id;

    perform public.emit_user_notification(
      new.user_id,
      'session_note_review:' || new.id::text || ':pending',
      'session_note_review_pending',
      'prontuario',
      'warning',
      'Resumo de teleconsulta pendente',
      format(
        'O resumo de %s precisa ser validado antes de entrar definitivo no prontuario.',
        coalesce(v_patient_name, 'um paciente')
      ),
      '/pacientes/' || new.patient_id::text || '?tab=pending-reviews',
      'high',
      jsonb_build_object(
        'sourceModule', 'prontuario',
        'eventSource', 'session_notes',
        'sessionNoteId', new.id,
        'patientId', new.patient_id,
        'appointmentId', new.appointment_id,
        'requiresAction', true,
        'nativePushEligible', false,
        'deadlineAt', new.review_due_at
      ),
      '{}'::jsonb,
      null
    );
  elsif tg_op = 'UPDATE'
    and new.review_status = 'confirmed'
    and old.review_status = 'pending_review'
    and new.auto_confirmed_at is not null
    and old.auto_confirmed_at is distinct from new.auto_confirmed_at
  then
    perform public.emit_user_notification(
      new.user_id,
      'session_note_review:' || new.id::text || ':auto_confirmed',
      'session_note_review_auto_confirmed',
      'prontuario',
      'info',
      'Resumo auto-confirmado',
      'O prazo de revisao terminou e o resumo foi confirmado automaticamente no prontuario.',
      '/pacientes/' || new.patient_id::text || '?tab=timeline',
      'normal',
      jsonb_build_object(
        'sourceModule', 'prontuario',
        'eventSource', 'session_notes',
        'sessionNoteId', new.id,
        'patientId', new.patient_id,
        'appointmentId', new.appointment_id,
        'requiresAction', false,
        'nativePushEligible', false
      ),
      '{}'::jsonb,
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists session_notes_emit_review_notification on public.session_notes;
create trigger session_notes_emit_review_notification
after insert or update of review_status, auto_confirmed_at on public.session_notes
for each row execute function public.emit_session_note_review_notification();

create or replace function private.emit_due_session_note_review_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  note_record record;
  emitted integer := 0;
begin
  for note_record in
    select sn.id, sn.user_id, sn.patient_id, sn.appointment_id, sn.review_due_at, p.name as patient_name
    from public.session_notes sn
    left join public.patients p on p.id = sn.patient_id
    where sn.review_status = 'pending_review'
      and sn.review_due_at is not null
      and sn.review_due_at > now()
      and sn.review_due_at <= now() + interval '4 hours'
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = sn.user_id
          and n.event_id = 'session_note_review:' || sn.id::text || ':due_soon'
      )
    order by sn.review_due_at asc
    limit 100
  loop
    perform public.emit_user_notification(
      note_record.user_id,
      'session_note_review:' || note_record.id::text || ':due_soon',
      'session_note_review_due_soon',
      'prontuario',
      'warning',
      'Resumo pendente vence em breve',
      format(
        'O prazo de validacao do resumo de %s termina nas proximas horas.',
        coalesce(note_record.patient_name, 'um paciente')
      ),
      '/pacientes/' || note_record.patient_id::text || '?tab=pending-reviews',
      'urgent',
      jsonb_build_object(
        'sourceModule', 'prontuario',
        'eventSource', 'session_notes',
        'sessionNoteId', note_record.id,
        'patientId', note_record.patient_id,
        'appointmentId', note_record.appointment_id,
        'requiresAction', true,
        'nativePushEligible', true,
        'deadlineAt', note_record.review_due_at
      ),
      '{}'::jsonb,
      null
    );
    emitted := emitted + 1;
  end loop;

  return emitted;
end;
$$;

revoke all on function private.emit_due_session_note_review_notifications() from public;

select cron.unschedule(jobid)
from cron.job
where jobname = 'neuronex-session-note-review-due-notifications';

select cron.schedule(
  'neuronex-session-note-review-due-notifications',
  '*/30 * * * *',
  $cron$select private.emit_due_session_note_review_notifications();$cron$
);

create or replace function public.emit_neurofinance_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;

  perform public.emit_user_notification(
    new.user_id,
    'nb_payment_paid:' || new.id::text,
    'payment_received',
    'financeiro',
    'success',
    'Pagamento recebido',
    'Um pagamento foi confirmado no NeuroFinance.',
    '/financeiro',
    'normal',
    jsonb_build_object(
      'sourceModule', 'financeiro',
      'financeScope', 'neurofinance',
      'eventSource', 'nb_payments',
      'paymentId', new.id,
      'amountCents', new.gross_amount,
      'paymentMethod', new.payment_method_type,
      'paidAt', coalesce(new.paid_at, now()),
      'requiresAction', false,
      'nativePushEligible', false,
      'templateKey', 'payment_confirmed'
    ),
    jsonb_build_object(
      'source', 'nb_payments',
      'provider', new.provider
    ),
    null
  );

  return new;
end;
$$;

revoke all on function public.emit_neurofinance_payment_notification() from public;

create or replace function public.emit_financial_entry_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_title text;
  v_message text;
  v_severity text := 'info';
  v_priority text := 'normal';
  v_requires_action boolean := false;
  v_native_push boolean := false;
begin
  if coalesce(new.origin, 'manual') = 'neurofinance' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('pending', 'planned')
      and new.due_date is not null
      and new.due_date < current_date
    then
      v_event := 'overdue';
    else
      return new;
    end if;
  elsif old.status is distinct from new.status then
    if new.status in ('paid', 'overdue', 'cancelled') then
      v_event := new.status;
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_event = 'paid' then
    v_title := case when new.type = 'income' then 'Recebimento marcado como pago' else 'Despesa marcada como paga' end;
    v_message := format('%s foi marcado como pago na Gestao Financeira.', coalesce(new.title, 'Um lancamento'));
    v_severity := 'success';
  elsif v_event = 'overdue' then
    v_title := case when new.type = 'income' then 'Recebimento vencido' else 'Despesa vencida' end;
    v_message := format('%s esta vencido na Gestao Financeira.', coalesce(new.title, 'Um lancamento'));
    v_severity := 'warning';
    v_priority := 'high';
    v_requires_action := true;
    v_native_push := true;
  else
    v_title := 'Lancamento financeiro cancelado';
    v_message := format('%s foi cancelado na Gestao Financeira.', coalesce(new.title, 'Um lancamento'));
    v_severity := 'warning';
  end if;

  perform public.emit_user_notification(
    new.professional_id,
    'financial_entry:' || new.id::text || ':' || v_event,
    'financial_entry_' || v_event,
    'financeiro',
    v_severity,
    v_title,
    v_message,
    '/financeiro?tab=gestao',
    v_priority,
    jsonb_build_object(
      'sourceModule', 'financeiro',
      'financeScope', 'gestao',
      'eventSource', 'financial_entries',
      'financialEntryId', new.id,
      'patientId', new.patient_id,
      'appointmentId', new.appointment_id,
      'amountCents', round(new.amount * 100),
      'entryType', new.type,
      'status', new.status,
      'dueDate', new.due_date,
      'requiresAction', v_requires_action,
      'nativePushEligible', v_native_push,
      'deadlineAt', new.due_date
    ),
    '{}'::jsonb,
    new.clinic_id
  );

  return new;
end;
$$;

drop trigger if exists financial_entries_emit_notification on public.financial_entries;
create trigger financial_entries_emit_notification
after insert or update of status, due_date on public.financial_entries
for each row execute function public.emit_financial_entry_notification();

drop trigger if exists notifications_dispatch_delivery on public.notifications;
drop trigger if exists notifications_dispatch_delivery_on_insert on public.notifications;
drop trigger if exists notifications_dispatch_delivery_on_update on public.notifications;

create trigger notifications_dispatch_delivery_on_insert
after insert on public.notifications
for each row
when (
  new.push_status = 'pending'
  or new.email_status = 'pending'
)
execute function private.dispatch_notification_delivery();

create trigger notifications_dispatch_delivery_on_update
after update of push_status, email_status on public.notifications
for each row
when (
  (old.push_status is distinct from new.push_status and new.push_status = 'pending')
  or (old.email_status is distinct from new.email_status and new.email_status = 'pending')
)
execute function private.dispatch_notification_delivery();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'push_subscriptions'
  ) then
    alter publication supabase_realtime add table public.push_subscriptions;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
