begin;

create extension if not exists pgcrypto;

-- Agenda isolation: appointments must never be visible across psychologists.
do $$
begin
  if to_regclass('public.appointments') is not null then
    execute 'alter table public.appointments enable row level security';

    execute 'drop policy if exists "Users can manage own appointments" on public.appointments';
    execute 'drop policy if exists "Users can only see own appointments" on public.appointments';
    execute 'drop policy if exists "Users can only insert own appointments" on public.appointments';
    execute 'drop policy if exists "Users can only update own appointments" on public.appointments';
    execute 'drop policy if exists "Users can only delete own appointments" on public.appointments';

    execute '
      create policy "Users can manage own appointments"
      on public.appointments
      for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id)
    ';

    execute 'grant select, insert, update, delete on public.appointments to authenticated';
  end if;
end $$;

-- Ensure every completed signup has exactly one 7-day Professional trial record.
create or replace function public.ensure_user_subscription_trial(
  p_user_id uuid,
  p_started_at timestamptz default now(),
  p_source text default 'profile_signup_completed'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  started_at timestamptz := coalesce(p_started_at, now());
  ends_at timestamptz := coalesce(p_started_at, now()) + interval '7 days';
  created_subscription_id uuid;
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.user_subscriptions (
    user_id,
    plan,
    plan_code,
    status,
    access_state,
    current_period_start,
    current_period_end,
    trial_started_at,
    trial_ends_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    'Professional',
    'professional',
    'trialing',
    'trial_access',
    started_at,
    ends_at,
    started_at,
    ends_at,
    jsonb_build_object('source', p_source, 'trial_days', 7),
    now(),
    now()
  )
  on conflict (user_id) do nothing
  returning id into created_subscription_id;

  if created_subscription_id is not null and to_regclass('public.subscription_audit_logs') is not null then
    insert into public.subscription_audit_logs (
      user_id,
      subscription_record_id,
      actor_type,
      action,
      to_status,
      to_access_state,
      reason,
      metadata
    )
    values (
      p_user_id,
      created_subscription_id,
      'system',
      'trial_started',
      'trialing',
      'trial_access',
      p_source,
      jsonb_build_object('trial_started_at', started_at, 'trial_ends_at', ends_at)
    );
  end if;
end;
$$;

create or replace function public.ensure_trial_subscription_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.signup_completed_at is not null then
    perform public.ensure_user_subscription_trial(
      new.id,
      new.signup_completed_at,
      'profiles_signup_completed_trigger'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists profiles_ensure_trial_subscription on public.profiles;
    create trigger profiles_ensure_trial_subscription
    after insert or update of signup_completed_at
    on public.profiles
    for each row
    execute function public.ensure_trial_subscription_from_profile();
  end if;
end $$;

select public.ensure_user_subscription_trial(
  p.id,
  p.signup_completed_at,
  'recent_profile_trial_backfill'
)
from public.profiles p
where p.signup_completed_at is not null
  and p.signup_completed_at >= now() - interval '7 days'
  and not exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = p.id
  );

-- Synapse quota: 15 allowed user requests, then locked for 24h from the 15th request.
create table if not exists public.synapse_usage_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used_count integer not null default 0 check (used_count >= 0),
  limit_count integer not null default 15 check (limit_count > 0),
  window_started_at timestamptz not null default now(),
  last_request_at timestamptz,
  locked_at timestamptz,
  unlocks_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists synapse_usage_quota_unlocks_idx
  on public.synapse_usage_quota(unlocks_at)
  where unlocks_at is not null;

create or replace function public.consume_synapse_quota(
  p_user_id uuid,
  p_limit_count integer default 15
)
returns table (
  allowed boolean,
  used_count integer,
  limit_count integer,
  remaining_count integer,
  unlocks_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  quota_row public.synapse_usage_quota%rowtype;
  v_now timestamptz := now();
  v_limit integer := greatest(1, coalesce(p_limit_count, 15));
  next_used integer;
  next_unlocks_at timestamptz;
begin
  if p_user_id is null then
    return query select false, 0, v_limit, 0, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select *
  into quota_row
  from public.synapse_usage_quota
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.synapse_usage_quota (
      user_id,
      used_count,
      limit_count,
      window_started_at,
      last_request_at,
      updated_at
    )
    values (p_user_id, 1, v_limit, v_now, v_now, v_now);

    return query select true, 1, v_limit, greatest(v_limit - 1, 0), null::timestamptz;
    return;
  end if;

  if quota_row.unlocks_at is not null and quota_row.unlocks_at <= v_now then
    update public.synapse_usage_quota
    set
      used_count = 1,
      limit_count = v_limit,
      window_started_at = v_now,
      last_request_at = v_now,
      locked_at = null,
      unlocks_at = null,
      updated_at = v_now
    where user_id = p_user_id;

    return query select true, 1, v_limit, greatest(v_limit - 1, 0), null::timestamptz;
    return;
  end if;

  if quota_row.unlocks_at is not null and quota_row.unlocks_at > v_now then
    return query select false, quota_row.used_count, quota_row.limit_count, 0, quota_row.unlocks_at;
    return;
  end if;

  next_used := least(quota_row.used_count + 1, v_limit);
  next_unlocks_at := case
    when next_used >= v_limit then v_now + interval '24 hours'
    else null
  end;

  update public.synapse_usage_quota
  set
    used_count = next_used,
    limit_count = v_limit,
    last_request_at = v_now,
    locked_at = case when next_unlocks_at is not null then v_now else null end,
    unlocks_at = next_unlocks_at,
    updated_at = v_now
  where user_id = p_user_id;

  return query
  select
    true,
    next_used,
    v_limit,
    greatest(v_limit - next_used, 0),
    next_unlocks_at;
end;
$$;

alter table public.synapse_usage_quota enable row level security;

drop policy if exists "Users can view own Synapse quota" on public.synapse_usage_quota;
create policy "Users can view own Synapse quota"
on public.synapse_usage_quota
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages Synapse quota" on public.synapse_usage_quota;
create policy "Service role manages Synapse quota"
on public.synapse_usage_quota
for all
to service_role
using (true)
with check (true);

revoke all on public.synapse_usage_quota from anon, authenticated;
grant select on public.synapse_usage_quota to authenticated;
revoke all on function public.consume_synapse_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_synapse_quota(uuid, integer) to service_role;
revoke all on function public.ensure_user_subscription_trial(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.ensure_user_subscription_trial(uuid, timestamptz, text) to service_role;
revoke all on function public.ensure_trial_subscription_from_profile() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
