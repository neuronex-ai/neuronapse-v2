begin;

alter table public.notifications drop constraint if exists notifications_push_status_check;
alter table public.notifications
  add constraint notifications_push_status_check
  check (push_status in ('disabled', 'not_requested', 'pending', 'processing', 'sent', 'partial', 'failed', 'no_devices'));

alter table public.notifications drop constraint if exists notifications_email_status_check;
alter table public.notifications
  add constraint notifications_email_status_check
  check (email_status in ('disabled', 'not_requested', 'pending', 'processing', 'sent', 'failed', 'no_recipient'));

create or replace function public.prepare_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.user_notification_settings%rowtype;
  push_requested boolean := false;
  push_allowed boolean := false;
  email_requested boolean := false;
  email_allowed boolean := false;
begin
  select * into settings
  from public.user_notification_settings
  where user_id = new.user_id;

  push_requested :=
    lower(coalesce(new.data ->> 'nativePushEligible', new.payload ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')
    or lower(coalesce(new.priority, 'normal')) = 'urgent';

  push_allowed := coalesce(settings.push_enabled, false);

  if push_requested and push_allowed then
    new.push_status := 'pending';
    new.push_requested_at := coalesce(new.push_requested_at, now());
  elsif push_requested then
    new.push_status := 'disabled';
    new.push_requested_at := null;
  else
    new.push_status := 'not_requested';
    new.push_requested_at := null;
  end if;

  email_requested := new.category in ('agenda', 'financeiro', 'seguranca', 'dashboard');
  email_allowed := coalesce(settings.email_enabled, true) and case new.category
    when 'agenda' then coalesce(settings.email_appointment_reminders, true)
    when 'financeiro' then coalesce(settings.email_payment_confirmations, true)
    when 'seguranca' then coalesce(settings.email_security_alerts, true)
    when 'dashboard' then coalesce(settings.email_monthly_reports, true)
    else false
  end;

  if email_requested and email_allowed then
    new.email_status := 'pending';
    new.email_requested_at := coalesce(new.email_requested_at, now());
  elsif email_requested then
    new.email_status := 'disabled';
    new.email_requested_at := null;
  else
    new.email_status := 'not_requested';
    new.email_requested_at := null;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
