begin;

create extension if not exists pgcrypto;

create table if not exists public.patient_portal_invites (
  id uuid primary key default gen_random_uuid(),
  psychologist_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_email text not null,
  token_hash text not null,
  activation_code_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  activation_attempts integer not null default 0,
  max_attempts integer not null default 5,
  sent_count integer not null default 0,
  last_sent_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  blocked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_portal_invites_status_check
    check (status in ('pending', 'sent', 'activated', 'expired', 'revoked', 'blocked')),
  constraint patient_portal_invites_attempts_check
    check (activation_attempts >= 0 and max_attempts between 1 and 20)
);

create unique index if not exists patient_portal_invites_token_hash_key
  on public.patient_portal_invites(token_hash);

create unique index if not exists patient_portal_invites_open_patient_idx
  on public.patient_portal_invites(psychologist_user_id, patient_id)
  where status in ('pending', 'sent');

create index if not exists patient_portal_invites_patient_idx
  on public.patient_portal_invites(patient_id, created_at desc);

create index if not exists patient_portal_invites_email_idx
  on public.patient_portal_invites(lower(patient_email), created_at desc);

create table if not exists public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  psychologist_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  invite_id uuid references public.patient_portal_invites(id) on delete set null,
  status text not null default 'active',
  activated_at timestamptz not null default now(),
  suspended_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_portal_links_status_check
    check (status in ('active', 'suspended', 'revoked'))
);

create unique index if not exists patient_portal_links_patient_user_patient_key
  on public.patient_portal_links(patient_user_id, patient_id);

create unique index if not exists patient_portal_links_psychologist_patient_key
  on public.patient_portal_links(psychologist_user_id, patient_id);

create index if not exists patient_portal_links_patient_user_idx
  on public.patient_portal_links(patient_user_id, status);

create index if not exists patient_portal_links_psychologist_idx
  on public.patient_portal_links(psychologist_user_id, status, created_at desc);

create table if not exists public.patient_portal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_user_id uuid references auth.users(id) on delete set null,
  psychologist_user_id uuid references auth.users(id) on delete set null,
  patient_user_id uuid references auth.users(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  invite_id uuid references public.patient_portal_invites(id) on delete set null,
  link_id uuid references public.patient_portal_links(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint patient_portal_audit_actor_type_check
    check (actor_type in ('psychologist', 'patient', 'edge_function', 'system'))
);

create index if not exists patient_portal_audit_psychologist_idx
  on public.patient_portal_audit_logs(psychologist_user_id, created_at desc);

create index if not exists patient_portal_audit_patient_idx
  on public.patient_portal_audit_logs(patient_id, created_at desc);

alter table public.document_files
  add column if not exists shared_with_patient boolean not null default false,
  add column if not exists shared_with_patient_at timestamptz,
  add column if not exists shared_with_patient_by uuid references auth.users(id) on delete set null;

create index if not exists document_files_patient_shared_idx
  on public.document_files(patient_id, created_at desc)
  where shared_with_patient = true
    and status = 'ready'
    and deleted_at is null;

create table if not exists public.patient_mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  mood_score integer not null check (mood_score between 1 and 5),
  notes text,
  source text not null default 'professional',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.patient_mood_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source text not null default 'professional',
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.patient_mood_logs'::regclass
      and conname = 'patient_mood_logs_source_check'
  ) then
    alter table public.patient_mood_logs
      add constraint patient_mood_logs_source_check
      check (source in ('professional', 'patient_portal')) not valid;
  end if;
end $$;

create index if not exists patient_mood_logs_patient_created_idx
  on public.patient_mood_logs(patient_id, created_at desc);

create table if not exists public.patient_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  description text not null,
  is_completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists patient_goals_patient_created_idx
  on public.patient_goals(patient_id, created_at desc);

create or replace function public.set_patient_portal_updated_at()
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

drop trigger if exists set_patient_portal_invites_updated_at on public.patient_portal_invites;
create trigger set_patient_portal_invites_updated_at
before update on public.patient_portal_invites
for each row execute function public.set_patient_portal_updated_at();

drop trigger if exists set_patient_portal_links_updated_at on public.patient_portal_links;
create trigger set_patient_portal_links_updated_at
before update on public.patient_portal_links
for each row execute function public.set_patient_portal_updated_at();

alter table public.patient_portal_invites enable row level security;
alter table public.patient_portal_links enable row level security;
alter table public.patient_portal_audit_logs enable row level security;
alter table public.patient_mood_logs enable row level security;
alter table public.patient_goals enable row level security;

drop policy if exists "Psychologists can read own patient portal invites" on public.patient_portal_invites;
create policy "Psychologists can read own patient portal invites"
on public.patient_portal_invites
for select
to authenticated
using ((select auth.uid()) = psychologist_user_id);

drop policy if exists "Patient portal links visible to participants" on public.patient_portal_links;
create policy "Patient portal links visible to participants"
on public.patient_portal_links
for select
to authenticated
using (
  (select auth.uid()) = psychologist_user_id
  or (select auth.uid()) = patient_user_id
);

drop policy if exists "Patient portal audit visible to participants" on public.patient_portal_audit_logs;
create policy "Patient portal audit visible to participants"
on public.patient_portal_audit_logs
for select
to authenticated
using (
  (select auth.uid()) = psychologist_user_id
  or (select auth.uid()) = patient_user_id
);

drop policy if exists "Psychologists can manage own mood logs" on public.patient_mood_logs;
create policy "Psychologists can manage own mood logs"
on public.patient_mood_logs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Psychologists can manage own patient goals" on public.patient_goals;
create policy "Psychologists can manage own patient goals"
on public.patient_goals
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on public.patient_portal_invites to authenticated;
grant select on public.patient_portal_links to authenticated;
grant select on public.patient_portal_audit_logs to authenticated;
grant select, insert, update, delete on public.patient_mood_logs to authenticated;
grant select, insert, update, delete on public.patient_goals to authenticated;

commit;
