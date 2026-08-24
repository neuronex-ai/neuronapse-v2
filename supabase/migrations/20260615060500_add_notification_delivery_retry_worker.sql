begin;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

create or replace function private.retry_notification_deliveries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_record record;
  push_secret text;
  email_secret text;
  dispatched integer := 0;
begin
  select decrypted_secret
    into push_secret
  from vault.decrypted_secrets
  where name = 'notification_push_webhook_secret'
  order by created_at desc
  limit 1;

  select decrypted_secret
    into email_secret
  from vault.decrypted_secrets
  where name = 'notification_email_webhook_secret'
  order by created_at desc
  limit 1;

  update public.notifications
  set
    push_status = 'failed',
    push_last_error = coalesce(push_last_error, 'Entrega interrompida antes da conclusão')
  where push_status = 'processing'
    and push_attempts < 3
    and updated_at < now() - interval '10 minutes';

  update public.notifications
  set
    email_status = 'failed',
    email_last_error = coalesce(email_last_error, 'Entrega interrompida antes da conclusão')
  where email_status = 'processing'
    and email_attempts < 3
    and updated_at < now() - interval '10 minutes';

  for notification_record in
    select id, push_status, email_status
    from public.notifications
    where (
      push_status in ('pending', 'failed')
      and push_attempts < 3
      and coalesce(push_requested_at, created_at) < now() - interval '2 minutes'
    ) or (
      email_status in ('pending', 'failed')
      and email_attempts < 3
      and coalesce(email_requested_at, created_at) < now() - interval '2 minutes'
    )
    order by created_at
    limit 100
  loop
    if notification_record.push_status in ('pending', 'failed') and push_secret is not null then
      perform net.http_post(
        url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/dispatch-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-neuronex-webhook-secret', push_secret
        ),
        body := jsonb_build_object('notificationId', notification_record.id)
      );
      dispatched := dispatched + 1;
    end if;

    if notification_record.email_status in ('pending', 'failed') and email_secret is not null then
      perform net.http_post(
        url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/dispatch-email-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-neuronex-webhook-secret', email_secret
        ),
        body := jsonb_build_object('notificationId', notification_record.id)
      );
      dispatched := dispatched + 1;
    end if;
  end loop;

  return dispatched;
end;
$$;

revoke all on function private.retry_notification_deliveries() from public;

select cron.unschedule(jobid)
from cron.job
where jobname = 'neuronex-notification-delivery-retry';

select cron.schedule(
  'neuronex-notification-delivery-retry',
  '*/5 * * * *',
  $cron$select private.retry_notification_deliveries();$cron$
);

commit;
