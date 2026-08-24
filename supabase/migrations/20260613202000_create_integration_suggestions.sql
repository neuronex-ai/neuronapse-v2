create extension if not exists pgcrypto;

create table if not exists public.integration_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suggestion text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_suggestions_suggestion_not_blank
    check (length(btrim(suggestion)) > 0),
  constraint integration_suggestions_status_check
    check (status in ('new', 'reviewed', 'planned', 'declined'))
);

alter table public.integration_suggestions enable row level security;

drop policy if exists "Users can view their own integration suggestions"
on public.integration_suggestions;
create policy "Users can view their own integration suggestions"
on public.integration_suggestions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own integration suggestions"
on public.integration_suggestions;
create policy "Users can create their own integration suggestions"
on public.integration_suggestions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.touch_integration_suggestions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integration_suggestions_touch_updated_at
on public.integration_suggestions;

create trigger integration_suggestions_touch_updated_at
before update on public.integration_suggestions
for each row execute function public.touch_integration_suggestions_updated_at();

create index if not exists idx_integration_suggestions_user_created
on public.integration_suggestions (user_id, created_at desc);

grant select, insert on public.integration_suggestions to authenticated;
