create table if not exists public.user_notion_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  workspace_id text,
  bot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_notion_tokens
  add column if not exists access_token text,
  add column if not exists workspace_id text,
  add column if not exists bot_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_notion_tokens_user_id_uidx
  on public.user_notion_tokens (user_id);

alter table public.user_notion_tokens enable row level security;

drop policy if exists "Notion tokens read own" on public.user_notion_tokens;
create policy "Notion tokens read own"
  on public.user_notion_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Notion tokens delete own" on public.user_notion_tokens;
create policy "Notion tokens delete own"
  on public.user_notion_tokens for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own notion token" on public.user_notion_tokens;
drop policy if exists "Users can insert own notion token" on public.user_notion_tokens;
drop policy if exists "Users can update own notion token" on public.user_notion_tokens;
drop policy if exists "Users can delete own notion token" on public.user_notion_tokens;

revoke select, insert, update, delete on public.user_notion_tokens from anon, authenticated;
grant select (user_id, workspace_id, bot_id, created_at, updated_at) on public.user_notion_tokens to authenticated;
grant delete on public.user_notion_tokens to authenticated;
revoke truncate, references, trigger on public.user_notion_tokens from anon, authenticated;

drop trigger if exists set_updated_at on public.user_notion_tokens;
create trigger set_updated_at
before update on public.user_notion_tokens
for each row execute function public.update_updated_at_column();

create table if not exists public.notion_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text,
  notion_page_id text not null,
  note_id uuid,
  title text not null,
  source_url text,
  last_edited_time timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notion_imports
  add column if not exists workspace_id text,
  add column if not exists notion_page_id text,
  add column if not exists note_id uuid,
  add column if not exists title text,
  add column if not exists source_url text,
  add column if not exists last_edited_time timestamptz,
  add column if not exists imported_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists notion_imports_user_page_uidx
  on public.notion_imports (user_id, notion_page_id);

do $$
begin
  if to_regclass('public.personal_notes') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'notion_imports_note_id_fkey'
        and conrelid = 'public.notion_imports'::regclass
    )
  then
    alter table public.notion_imports
      add constraint notion_imports_note_id_fkey
      foreign key (note_id) references public.personal_notes(id) on delete set null;
  end if;
end $$;

alter table public.notion_imports enable row level security;

drop policy if exists "Notion imports read own" on public.notion_imports;
create policy "Notion imports read own"
  on public.notion_imports for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Notion imports delete own" on public.notion_imports;
create policy "Notion imports delete own"
  on public.notion_imports for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, delete on public.notion_imports to authenticated;
revoke truncate, references, trigger on public.notion_imports from anon, authenticated;

drop trigger if exists set_updated_at on public.notion_imports;
create trigger set_updated_at
before update on public.notion_imports
for each row execute function public.update_updated_at_column();

comment on table public.notion_imports is
  'Mapeia paginas importadas do Notion para notas pessoais do NeuroDrive.';
