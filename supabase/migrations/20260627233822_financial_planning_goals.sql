create table if not exists public.financial_planning_goals (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  revenue_goal_cents integer not null default 0 check (revenue_goal_cents >= 0),
  expense_limit_cents integer not null default 0 check (expense_limit_cents >= 0),
  desired_profit_cents integer not null default 0,
  target_sessions integer not null default 0 check (target_sessions >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, month)
);

create index if not exists idx_financial_planning_goals_professional_month
  on public.financial_planning_goals (professional_id, month desc);

alter table public.financial_planning_goals enable row level security;

drop policy if exists "Financial planning goals read own" on public.financial_planning_goals;
create policy "Financial planning goals read own"
  on public.financial_planning_goals for select
  to authenticated
  using ((select auth.uid()) = professional_id);

drop policy if exists "Financial planning goals insert own" on public.financial_planning_goals;
create policy "Financial planning goals insert own"
  on public.financial_planning_goals for insert
  to authenticated
  with check ((select auth.uid()) = professional_id);

drop policy if exists "Financial planning goals update own" on public.financial_planning_goals;
create policy "Financial planning goals update own"
  on public.financial_planning_goals for update
  to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

drop policy if exists "Financial planning goals delete own" on public.financial_planning_goals;
create policy "Financial planning goals delete own"
  on public.financial_planning_goals for delete
  to authenticated
  using ((select auth.uid()) = professional_id);

grant select, insert, update, delete on public.financial_planning_goals to authenticated;
revoke truncate, references, trigger on public.financial_planning_goals from anon, authenticated;

drop trigger if exists set_updated_at on public.financial_planning_goals;
create trigger set_updated_at
before update on public.financial_planning_goals
for each row execute function public.update_updated_at_column();

comment on table public.financial_planning_goals is
  'Metas financeiras mensais persistidas para o planejamento gerencial da Gestao Financeira.';
