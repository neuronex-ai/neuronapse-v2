create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  event_id text null,
  type text not null default 'system',
  category text not null default 'sistema',
  severity text not null default 'info',
  title text not null,
  message text not null,
  action_url text null,
  priority text not null default 'normal',
  data jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  read_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists organization_id uuid null,
  add column if not exists event_id text null,
  add column if not exists type text not null default 'system',
  add column if not exists category text not null default 'sistema',
  add column if not exists severity text not null default 'info',
  add column if not exists title text not null default 'Notificação',
  add column if not exists message text not null default '',
  add column if not exists action_url text null,
  add column if not exists priority text not null default 'normal',
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists read boolean not null default false,
  add column if not exists read_at timestamptz null,
  add column if not exists dismissed_at timestamptz null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.notifications
set
  category = coalesce(nullif(category, ''), 'sistema'),
  severity = coalesce(nullif(severity, ''), case when priority = 'high' then 'warning' else 'info' end),
  priority = coalesce(nullif(priority, ''), 'normal'),
  data = coalesce(data, '{}'::jsonb),
  payload = coalesce(payload, '{}'::jsonb),
  read = coalesce(read, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_organization_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_category_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_category_check
      check (category in ('agenda', 'financeiro', 'pacientes', 'clinica', 'seguranca', 'sistema'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_severity_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_severity_check
      check (severity in ('success', 'info', 'warning', 'destructive'))
      not valid;
  end if;
end;
$$;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, event_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.notifications
  where event_id is not null
)
delete from public.notifications n
using ranked r
where n.id = r.id
  and r.row_number > 1;

create unique index if not exists idx_notifications_user_event_id
  on public.notifications (user_id, event_id);

create index if not exists idx_notifications_user_active_created
  on public.notifications (user_id, dismissed_at, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read, created_at desc)
  where read = false and dismissed_at is null;

create index if not exists idx_notifications_user_category
  on public.notifications (user_id, category, created_at desc)
  where dismissed_at is null;

create or replace function public.sync_notification_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();

  if coalesce(new.read, false) = true and new.read_at is null then
    new.read_at = now();
  elsif coalesce(new.read, false) = false then
    new.read_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_sync_timestamps on public.notifications;
create trigger notifications_sync_timestamps
before insert or update on public.notifications
for each row execute function public.sync_notification_timestamps();

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
on public.notifications for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Allow anon insert notifications for patient actions" on public.notifications;

grant select, insert, update on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from anon;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.notifications
  set read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where user_id = (select auth.uid())
    and dismissed_at is null
    and coalesce(read, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.restore_notification(p_notification_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.notifications
  set dismissed_at = null,
      updated_at = now()
  where id = p_notification_id
    and user_id = (select auth.uid());
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.restore_notification(uuid) to authenticated;

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
