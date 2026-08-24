begin;

create schema if not exists private;
create extension if not exists pg_net with schema extensions;

create or replace function private.dispatch_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  push_secret text;
  email_secret text;
begin
  if new.push_status = 'pending' then
    select decrypted_secret
      into push_secret
    from vault.decrypted_secrets
    where name = 'notification_push_webhook_secret'
    order by created_at desc
    limit 1;

    if push_secret is not null then
      perform net.http_post(
        url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/dispatch-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-neuronex-webhook-secret', push_secret
        ),
        body := jsonb_build_object('notificationId', new.id)
      );
    end if;
  end if;

  if new.email_status = 'pending' then
    select decrypted_secret
      into email_secret
    from vault.decrypted_secrets
    where name = 'notification_email_webhook_secret'
    order by created_at desc
    limit 1;

    if email_secret is not null then
      perform net.http_post(
        url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/dispatch-email-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-neuronex-webhook-secret', email_secret
        ),
        body := jsonb_build_object('notificationId', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.dispatch_notification_delivery() from public;

drop trigger if exists notifications_dispatch_delivery on public.notifications;
create trigger notifications_dispatch_delivery
after insert on public.notifications
for each row execute function private.dispatch_notification_delivery();

create or replace function public.emit_neurofinance_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_event_id text;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;

  notification_event_id := 'nb_payment_paid:' || new.id::text;

  if not exists (
    select 1
    from public.notifications n
    where n.user_id = new.user_id
      and n.event_id = notification_event_id
  ) then
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
      payload
    ) values (
      new.user_id,
      notification_event_id,
      'payment',
      'financeiro',
      'success',
      'Pagamento recebido',
      'Um pagamento foi confirmado no NeuroFinance.',
      '/financeiro',
      'high',
      jsonb_build_object(
        'paymentId', new.id,
        'amountCents', new.gross_amount,
        'paymentMethod', new.payment_method_type,
        'paidAt', coalesce(new.paid_at, now()),
        'templateKey', 'payment_confirmed'
      ),
      jsonb_build_object(
        'source', 'nb_payments',
        'provider', new.provider
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.emit_neurofinance_payment_notification() from public;

drop trigger if exists nb_payments_emit_received_notification on public.nb_payments;
create trigger nb_payments_emit_received_notification
after update of status on public.nb_payments
for each row execute function public.emit_neurofinance_payment_notification();

create or replace function private.request_system_email_template_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'notification_email_webhook_secret'
  order by created_at desc
  limit 1;

  if webhook_secret is null then
    raise exception 'notification_email_webhook_secret is not configured in Vault';
  end if;

  select net.http_post(
    url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/sync-system-email-templates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', webhook_secret
    ),
    body := '{}'::jsonb
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.request_system_email_template_sync() from public;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
