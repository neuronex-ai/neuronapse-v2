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
  v_notification_id uuid;
  v_event_id text;
  v_title text;
  v_message text;
  v_severity text;
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
    v_title := 'Sessão reagendada pelo paciente';
    v_message := format(
      'A consulta de %s foi movida para %s.',
      coalesce(v_patient_name, 'um paciente'),
      coalesce(to_char(v_start_time at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI'), 'um novo horário')
    );
    v_severity := 'info';
  elsif p_event = 'confirmed' then
    v_event_id := format('appointment:%s:confirmed', p_appointment_id);
    v_title := 'Agendamento confirmado';
    v_message := format(
      'A presença de %s foi confirmada para %s.',
      coalesce(v_patient_name, 'um paciente'),
      coalesce(to_char(v_start_time at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI'), 'o horário agendado')
    );
    v_severity := 'success';
  else
    v_event_id := format('appointment:%s:cancelled', p_appointment_id);
    v_title := 'Agendamento cancelado pelo paciente';
    v_message := format(
      'A consulta de %s foi cancelada.',
      coalesce(v_patient_name, 'um paciente')
    );
    v_severity := 'warning';
  end if;

  insert into public.notifications (
    user_id,
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
    read,
    read_at,
    dismissed_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_event_id,
    'appointment_' || p_event,
    'agenda',
    v_severity,
    v_title,
    v_message,
    '/agenda?appointmentId=' || p_appointment_id::text,
    'normal',
    jsonb_build_object(
      'source', 'public_appointment',
      'appointmentId', p_appointment_id,
      'patientId', v_patient_id,
      'event', p_event
    ),
    '{}'::jsonb,
    false,
    null,
    null,
    now(),
    now()
  )
  on conflict (user_id, event_id)
  do update set
    type = excluded.type,
    category = excluded.category,
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    action_url = excluded.action_url,
    priority = excluded.priority,
    data = excluded.data,
    read = false,
    read_at = null,
    dismissed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_notification_id;

  return v_notification_id;
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
  v_notification_id uuid;
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

  insert into public.notifications (
    user_id,
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
    read,
    read_at,
    dismissed_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'anamnesis:' || p_anamnesis_id::text || ':progress',
    'anamnesis_progress',
    'pacientes',
    case when v_progress >= 100 then 'success' else 'info' end,
    case when v_progress >= 100 then 'Anamnese concluída' else 'Preenchimento parcial de anamnese' end,
    format(
      '%s preencheu %s%% da anamnese%s.',
      coalesce(v_patient_name, 'O paciente'),
      v_progress,
      case when v_progress >= 100 then '' else ' e salvou para continuar mais tarde' end
    ),
    '/pacientes/' || v_patient_id::text || '?tab=anamnesis',
    case when v_progress >= 100 then 'normal' else 'high' end,
    jsonb_build_object(
      'source', 'public_anamnesis',
      'anamnesisId', p_anamnesis_id,
      'patientId', v_patient_id,
      'progress', v_progress
    ),
    '{}'::jsonb,
    false,
    null,
    null,
    now(),
    now()
  )
  on conflict (user_id, event_id)
  do update set
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    action_url = excluded.action_url,
    priority = excluded.priority,
    data = excluded.data,
    read = false,
    read_at = null,
    dismissed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer)
to anon, authenticated;

drop policy if exists "Allow anon insert notifications for patient actions"
on public.notifications;

create or replace function public.emit_appointment_notification_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.token is null then
    return new;
  end if;

  if new.start_time is distinct from old.start_time then
    perform public.emit_public_appointment_notification(new.id, new.token, 'rescheduled');
  elsif new.status is distinct from old.status and new.status in ('unscored', 'confirmed') then
    perform public.emit_public_appointment_notification(new.id, new.token, 'confirmed');
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    perform public.emit_public_appointment_notification(new.id, new.token, 'cancelled');
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_emit_persistent_notification
on public.appointments;

create trigger appointments_emit_persistent_notification
after update of start_time, status on public.appointments
for each row execute function public.emit_appointment_notification_after_update();
