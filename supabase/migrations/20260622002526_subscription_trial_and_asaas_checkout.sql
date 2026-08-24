create extension if not exists pgcrypto;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'Essential',
  status text not null default 'inactive',
  asaas_subscription_id text,
  asaas_customer_id text,
  asaas_checkout_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions
  add column if not exists user_id uuid,
  add column if not exists plan text default 'Essential',
  add column if not exists status text default 'inactive',
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_checkout_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.user_subscriptions
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'user_subscriptions_user_id_unique'
  ) and not exists (
    select 1
    from public.user_subscriptions
    group by user_id
    having count(*) > 1
  ) then
    create unique index user_subscriptions_user_id_unique
      on public.user_subscriptions(user_id);
  end if;
end $$;

create index if not exists user_subscriptions_user_id_idx
  on public.user_subscriptions(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'user_subscriptions_asaas_subscription_id_unique'
  ) and not exists (
    select 1
    from public.user_subscriptions
    where asaas_subscription_id is not null
    group by asaas_subscription_id
    having count(*) > 1
  ) then
    create unique index user_subscriptions_asaas_subscription_id_unique
      on public.user_subscriptions(asaas_subscription_id)
      where asaas_subscription_id is not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_subscriptions_plan_check'
  ) and not exists (
    select 1 from public.user_subscriptions where plan not in ('Essential', 'Professional', 'Enterprise')
  ) then
    alter table public.user_subscriptions
      add constraint user_subscriptions_plan_check
      check (plan in ('Essential', 'Professional', 'Enterprise'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_subscriptions_status_check'
  ) and not exists (
    select 1 from public.user_subscriptions where status not in ('active', 'trialing', 'inactive', 'canceled', 'past_due')
  ) then
    alter table public.user_subscriptions
      add constraint user_subscriptions_status_check
      check (status in ('active', 'trialing', 'inactive', 'canceled', 'past_due'));
  end if;
end $$;

create table if not exists public.subscription_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'Professional',
  provider text not null default 'asaas',
  provider_checkout_id text,
  provider_subscription_id text,
  external_reference text not null,
  checkout_url text,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscription_checkout_sessions_external_reference_unique
  on public.subscription_checkout_sessions(external_reference);

create unique index if not exists subscription_checkout_sessions_provider_checkout_id_unique
  on public.subscription_checkout_sessions(provider_checkout_id)
  where provider_checkout_id is not null;

create index if not exists subscription_checkout_sessions_user_id_idx
  on public.subscription_checkout_sessions(user_id);

alter table public.user_subscriptions enable row level security;
alter table public.subscription_checkout_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users can view own subscription'
  ) then
    create policy "Users can view own subscription"
      on public.user_subscriptions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_checkout_sessions'
      and policyname = 'Users can view own checkout sessions'
  ) then
    create policy "Users can view own checkout sessions"
      on public.subscription_checkout_sessions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

grant select on public.user_subscriptions to authenticated;
grant select on public.subscription_checkout_sessions to authenticated;
