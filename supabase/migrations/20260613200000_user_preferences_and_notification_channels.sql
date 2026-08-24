alter table public.user_notification_settings
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_security_alerts boolean not null default true,
  add column if not exists sms_appointments boolean not null default true,
  add column if not exists push_enabled boolean not null default true;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('light', 'dark', 'system')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  reduced_motion boolean not null default false,
  language text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can view their own preferences" on public.user_preferences;
create policy "Users can view their own preferences"
on public.user_preferences for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own preferences" on public.user_preferences;
create policy "Users can insert their own preferences"
on public.user_preferences for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
on public.user_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_user_preferences_updated_at()
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

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute function public.touch_user_preferences_updated_at();

create or replace function public.touch_notification_settings_updated_at()
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

drop trigger if exists user_notification_settings_touch_updated_at on public.user_notification_settings;
create trigger user_notification_settings_touch_updated_at
before update on public.user_notification_settings
for each row execute function public.touch_notification_settings_updated_at();

create index if not exists idx_user_preferences_updated_at
  on public.user_preferences (updated_at desc);

create index if not exists idx_user_notification_settings_updated_at
  on public.user_notification_settings (updated_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_preferences'
  ) then
    alter publication supabase_realtime add table public.user_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notification_settings'
  ) then
    alter publication supabase_realtime add table public.user_notification_settings;
  end if;
end;
$$;
