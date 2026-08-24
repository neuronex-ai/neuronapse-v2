create table if not exists public.monthly_report_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  send_day smallint not null default 1 check (send_day between 1 and 28),
  include_sessions boolean not null default true,
  include_payments boolean not null default true,
  include_notes_summary boolean not null default false,
  email_subject text not null default 'Relatório Mensal - Seu Acompanhamento Terapêutico',
  email_intro text not null default 'Olá {{patientName}}, segue um resumo do nosso trabalho no último mês.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.monthly_report_settings enable row level security;

drop policy if exists "Users can view their own monthly report settings" on public.monthly_report_settings;
create policy "Users can view their own monthly report settings"
on public.monthly_report_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own monthly report settings" on public.monthly_report_settings;
create policy "Users can insert their own monthly report settings"
on public.monthly_report_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own monthly report settings" on public.monthly_report_settings;
create policy "Users can update their own monthly report settings"
on public.monthly_report_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_monthly_report_settings_updated_at()
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

drop trigger if exists monthly_report_settings_touch_updated_at on public.monthly_report_settings;
create trigger monthly_report_settings_touch_updated_at
before update on public.monthly_report_settings
for each row execute function public.touch_monthly_report_settings_updated_at();

create index if not exists idx_monthly_report_settings_enabled_day
on public.monthly_report_settings (enabled, send_day)
where enabled = true;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'monthly_report_settings'
  ) then
    alter publication supabase_realtime add table public.monthly_report_settings;
  end if;
end;
$$;
