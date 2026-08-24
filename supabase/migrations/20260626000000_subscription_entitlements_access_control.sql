begin;

create extension if not exists pgcrypto;

create table if not exists public.subscription_plan_catalog (
  plan_code text primary key,
  public_name text not null,
  description text,
  price_cents integer,
  currency text not null default 'BRL',
  billing_cycle text not null default 'MONTHLY',
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  internal_flags jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plan_catalog_plan_code_check
    check (plan_code in ('essential', 'professional', 'enterprise')),
  constraint subscription_plan_catalog_billing_cycle_check
    check (billing_cycle in ('FREE', 'MONTHLY', 'CUSTOM')),
  constraint subscription_plan_catalog_price_check
    check (price_cents is null or price_cents >= 0)
);

insert into public.subscription_plan_catalog (
  plan_code,
  public_name,
  description,
  price_cents,
  billing_cycle,
  features,
  limits,
  internal_flags,
  sort_order
) values
  (
    'essential',
    'Essential',
    'Plano gratuito com recursos essenciais.',
    0,
    'FREE',
    jsonb_build_object(
      'ai_copilot', false,
      'telemedicine', false,
      'advanced_finance', false,
      'patient_portal', false,
      'multiple_professionals', false,
      'admin_dashboard', false,
      'performance_reports', false,
      'api_access', false
    ),
    jsonb_build_object(
      'patients', 5,
      'session_records_monthly', null,
      'ai_monthly_actions', 0,
      'neurodrive_documents', 0,
      'neurodrive_storage_mb', 0,
      'teleconsultations_monthly', 0,
      'synapse_text_messages', 0,
      'synapse_voice_minutes', 0,
      'integrations', 0,
      'reports_monthly', 0
    ),
    jsonb_build_object(
      'can_use_neurofinance', false,
      'can_use_synapse', false,
      'can_use_neurodrive', false,
      'overage_policy', 'block'
    ),
    10
  ),
  (
    'professional',
    'Professional',
    'Plano profissional mensal NeuroNex.',
    14000,
    'MONTHLY',
    jsonb_build_object(
      'ai_copilot', true,
      'telemedicine', true,
      'advanced_finance', true,
      'patient_portal', true,
      'multiple_professionals', false,
      'admin_dashboard', false,
      'performance_reports', false,
      'api_access', false
    ),
    jsonb_build_object(
      'patients', 'unlimited',
      'session_records_monthly', null,
      'ai_monthly_actions', null,
      'neurodrive_documents', null,
      'neurodrive_storage_mb', null,
      'teleconsultations_monthly', null,
      'synapse_text_messages', null,
      'synapse_voice_minutes', null,
      'integrations', null,
      'reports_monthly', null
    ),
    jsonb_build_object(
      'can_use_neurofinance', true,
      'can_use_synapse', true,
      'can_use_neurodrive', true,
      'overage_policy', 'product_decision_required'
    ),
    20
  ),
  (
    'enterprise',
    'Enterprise',
    'Plano customizado para clinicas e operacoes avancadas.',
    null,
    'CUSTOM',
    jsonb_build_object(
      'ai_copilot', true,
      'telemedicine', true,
      'advanced_finance', true,
      'patient_portal', true,
      'multiple_professionals', true,
      'admin_dashboard', true,
      'performance_reports', true,
      'api_access', true
    ),
    jsonb_build_object(
      'patients', 'unlimited',
      'session_records_monthly', null,
      'ai_monthly_actions', null,
      'neurodrive_documents', null,
      'neurodrive_storage_mb', null,
      'teleconsultations_monthly', null,
      'synapse_text_messages', null,
      'synapse_voice_minutes', null,
      'integrations', null,
      'reports_monthly', null
    ),
    jsonb_build_object(
      'can_use_neurofinance', true,
      'can_use_synapse', true,
      'can_use_neurodrive', true,
      'overage_policy', 'contract'
    ),
    30
  )
on conflict (plan_code) do update set
  public_name = excluded.public_name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  billing_cycle = excluded.billing_cycle,
  is_active = excluded.is_active,
  features = excluded.features,
  limits = excluded.limits,
  internal_flags = excluded.internal_flags,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.user_subscriptions
  add column if not exists id uuid,
  add column if not exists plan_code text,
  add column if not exists access_state text,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_checkout_id text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists blocked_at timestamptz,
  add column if not exists grace_period_ends_at timestamptz,
  add column if not exists last_payment_id text,
  add column if not exists last_payment_status text,
  add column if not exists last_payment_event_at timestamptz,
  add column if not exists external_reference text,
  add column if not exists metadata jsonb,
  add column if not exists status_version integer not null default 0;

update public.user_subscriptions
set
  id = coalesce(id, gen_random_uuid()),
  plan = coalesce(nullif(plan, ''), 'Essential'),
  plan_code = coalesce(
    nullif(plan_code, ''),
    case lower(coalesce(plan, 'Essential'))
      when 'professional' then 'professional'
      when 'enterprise' then 'enterprise'
      else 'essential'
    end
  ),
  status = case
    when status is null or btrim(status) = '' then 'inactive'
    when status = 'pending' then 'payment_pending'
    else status
  end,
  access_state = coalesce(
    nullif(access_state, ''),
    case
      when status = 'trialing' then 'trial_access'
      when status = 'active' and coalesce(plan, 'Essential') = 'Essential' then 'limited_access'
      when status = 'active' then 'paid_access'
      when status = 'admin_override' then 'admin_override'
      else 'blocked'
    end
  ),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

update public.user_subscriptions
set
  status = 'trial_expired',
  access_state = 'blocked',
  blocked_at = coalesce(blocked_at, now()),
  updated_at = now(),
  status_version = status_version + 1
where status = 'trialing'
  and trial_ends_at is not null
  and trial_ends_at <= now();

alter table public.user_subscriptions
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column plan set default 'Essential',
  alter column plan set not null,
  alter column plan_code set default 'essential',
  alter column plan_code set not null,
  alter column status set default 'inactive',
  alter column status set not null,
  alter column access_state set default 'blocked',
  alter column access_state set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_plan_check,
  drop constraint if exists user_subscriptions_status_check,
  drop constraint if exists user_subscriptions_access_state_check,
  drop constraint if exists user_subscriptions_plan_code_fkey;

alter table public.user_subscriptions
  add constraint user_subscriptions_plan_check
    check (plan in ('Essential', 'Professional', 'Enterprise')),
  add constraint user_subscriptions_status_check
    check (status in (
      'inactive',
      'trialing',
      'trial_expired',
      'checkout_pending',
      'payment_pending',
      'active',
      'past_due',
      'grace_period',
      'blocked',
      'canceled',
      'refunded',
      'chargeback',
      'admin_override',
      'internal_error'
    )),
  add constraint user_subscriptions_access_state_check
    check (access_state in (
      'trial_access',
      'paid_access',
      'limited_access',
      'blocked',
      'admin_override'
    )),
  add constraint user_subscriptions_plan_code_fkey
    foreign key (plan_code)
    references public.subscription_plan_catalog(plan_code);

create unique index if not exists user_subscriptions_id_unique
  on public.user_subscriptions(id);

create unique index if not exists user_subscriptions_asaas_customer_id_unique
  on public.user_subscriptions(asaas_customer_id)
  where asaas_customer_id is not null;

create unique index if not exists user_subscriptions_asaas_subscription_id_unique
  on public.user_subscriptions(asaas_subscription_id)
  where asaas_subscription_id is not null;

create unique index if not exists user_subscriptions_external_reference_unique
  on public.user_subscriptions(external_reference)
  where external_reference is not null;

create index if not exists user_subscriptions_status_idx
  on public.user_subscriptions(status);

create index if not exists user_subscriptions_trial_ends_at_idx
  on public.user_subscriptions(trial_ends_at)
  where status = 'trialing';

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
  blocked_at,
  metadata,
  created_at,
  updated_at
)
select
  p.id,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then 'Professional'
    else 'Essential'
  end,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then 'professional'
    else 'essential'
  end,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then 'trialing'
    else 'active'
  end,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then 'trial_access'
    else 'limited_access'
  end,
  coalesce(p.signup_completed_at, now()),
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then p.signup_completed_at + interval '7 days'
    else null
  end,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then p.signup_completed_at
    else null
  end,
  case
    when p.signup_completed_at is not null
      and p.signup_completed_at >= now() - interval '7 days'
    then p.signup_completed_at + interval '7 days'
    else null
  end,
  null,
  jsonb_build_object(
    'source', case
      when p.signup_completed_at is not null
        and p.signup_completed_at >= now() - interval '7 days'
      then 'recent_signup_trial_backfill'
      else 'safe_missing_subscription_backfill'
    end,
    'previous_profile_subscription_plan', p.subscription_plan
  ),
  now(),
  now()
from public.profiles p
where not exists (
  select 1
  from public.user_subscriptions us
  where us.user_id = p.id
);

create table if not exists public.subscription_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_record_id uuid,
  plan text not null default 'Professional',
  plan_code text not null default 'professional' references public.subscription_plan_catalog(plan_code),
  provider text not null default 'asaas',
  provider_checkout_id text,
  provider_subscription_id text,
  provider_payment_id text,
  external_reference text not null,
  checkout_url text,
  amount_cents integer not null,
  currency text not null default 'BRL',
  billing_type text,
  status text not null default 'checkout_pending',
  expires_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_checkout_sessions_provider_check
    check (provider in ('asaas')),
  constraint subscription_checkout_sessions_plan_check
    check (plan in ('Professional', 'Enterprise')),
  constraint subscription_checkout_sessions_status_check
    check (status in (
      'pending',
      'created',
      'checkout_pending',
      'payment_pending',
      'paid',
      'canceled',
      'expired',
      'blocked',
      'failed',
      'abandoned',
      'updated'
    )),
  constraint subscription_checkout_sessions_amount_check
    check (amount_cents >= 0)
);

alter table public.subscription_checkout_sessions
  add column if not exists subscription_record_id uuid,
  add column if not exists plan_code text,
  add column if not exists provider_payment_id text,
  add column if not exists billing_type text,
  add column if not exists expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists error_message text;

update public.subscription_checkout_sessions
set
  plan_code = coalesce(plan_code, 'professional'),
  status = case
    when status is null or btrim(status) = '' then 'checkout_pending'
    when status = 'pending' then 'checkout_pending'
    else status
  end,
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, now());

alter table public.subscription_checkout_sessions
  alter column plan_code set default 'professional',
  alter column plan_code set not null,
  alter column status set default 'checkout_pending',
  alter column status set not null;

alter table public.subscription_checkout_sessions
  drop constraint if exists subscription_checkout_sessions_plan_code_fkey,
  add constraint subscription_checkout_sessions_plan_code_fkey
    foreign key (plan_code)
    references public.subscription_plan_catalog(plan_code);

create unique index if not exists subscription_checkout_sessions_external_reference_unique
  on public.subscription_checkout_sessions(external_reference);

create unique index if not exists subscription_checkout_sessions_provider_checkout_id_unique
  on public.subscription_checkout_sessions(provider_checkout_id)
  where provider_checkout_id is not null;

create index if not exists subscription_checkout_sessions_user_status_idx
  on public.subscription_checkout_sessions(user_id, status, created_at desc);

create unique index if not exists subscription_checkout_sessions_one_open_per_user_plan
  on public.subscription_checkout_sessions(user_id, plan_code)
  where status in ('pending', 'created', 'checkout_pending', 'payment_pending');

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_record_id uuid,
  checkout_session_id uuid references public.subscription_checkout_sessions(id) on delete set null,
  provider text not null default 'asaas',
  provider_event_id text not null,
  event_type text not null,
  object_type text,
  object_id text,
  external_reference text,
  provider_subscription_id text,
  provider_payment_id text,
  provider_checkout_id text,
  event_created_at timestamptz,
  processed_at timestamptz,
  processing_status text not null default 'processed',
  effect text not null default 'history_only',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_events_provider_check
    check (provider in ('asaas')),
  constraint subscription_events_processing_status_check
    check (processing_status in ('pending', 'processed', 'failed', 'ignored')),
  constraint subscription_events_effect_check
    check (effect in ('history_only', 'checkout_update', 'access_granted', 'access_blocked', 'access_warning', 'error'))
);

create unique index if not exists subscription_events_provider_event_unique
  on public.subscription_events(provider, provider_event_id);

create index if not exists subscription_events_user_created_idx
  on public.subscription_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists subscription_events_provider_objects_idx
  on public.subscription_events(provider_subscription_id, provider_payment_id, provider_checkout_id);

create table if not exists public.subscription_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_record_id uuid,
  checkout_session_id uuid references public.subscription_checkout_sessions(id) on delete set null,
  event_id uuid references public.subscription_events(id) on delete set null,
  actor_type text not null default 'system',
  actor_id uuid,
  action text not null,
  from_status text,
  to_status text,
  from_access_state text,
  to_access_state text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_audit_logs_actor_type_check
    check (actor_type in ('system', 'asaas_webhook', 'edge_function', 'admin', 'user')),
  constraint subscription_audit_logs_action_not_blank
    check (length(btrim(action)) > 0)
);

create index if not exists subscription_audit_logs_user_created_idx
  on public.subscription_audit_logs(user_id, created_at desc)
  where user_id is not null;

create table if not exists public.subscription_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plan_catalog(plan_code),
  feature_key text not null,
  period_start date not null,
  period_end date not null,
  used_count integer not null default 0,
  limit_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_usage_counters_used_count_check
    check (used_count >= 0),
  unique (user_id, feature_key, period_start)
);

create or replace function public.touch_subscription_updated_at()
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

drop trigger if exists subscription_plan_catalog_touch_updated_at on public.subscription_plan_catalog;
create trigger subscription_plan_catalog_touch_updated_at
before update on public.subscription_plan_catalog
for each row execute function public.touch_subscription_updated_at();

drop trigger if exists user_subscriptions_touch_updated_at on public.user_subscriptions;
create trigger user_subscriptions_touch_updated_at
before update on public.user_subscriptions
for each row execute function public.touch_subscription_updated_at();

drop trigger if exists subscription_checkout_sessions_touch_updated_at on public.subscription_checkout_sessions;
create trigger subscription_checkout_sessions_touch_updated_at
before update on public.subscription_checkout_sessions
for each row execute function public.touch_subscription_updated_at();

drop trigger if exists subscription_usage_counters_touch_updated_at on public.subscription_usage_counters;
create trigger subscription_usage_counters_touch_updated_at
before update on public.subscription_usage_counters
for each row execute function public.touch_subscription_updated_at();

create or replace view public.current_subscription_entitlements
with (security_invoker = true)
as
select
  us.user_id,
  us.id as subscription_record_id,
  us.plan,
  us.plan_code,
  case
    when us.status = 'trialing'
      and us.trial_ends_at is not null
      and us.trial_ends_at <= now()
    then 'trial_expired'
    else us.status
  end as effective_status,
  case
    when us.status = 'trialing'
      and us.trial_ends_at is not null
      and us.trial_ends_at <= now()
    then 'blocked'
    else us.access_state
  end as effective_access_state,
  us.status,
  us.access_state,
  us.current_period_start,
  us.current_period_end,
  us.trial_started_at,
  us.trial_ends_at,
  us.grace_period_ends_at,
  us.asaas_customer_id,
  us.asaas_subscription_id,
  us.last_payment_status,
  pc.public_name,
  pc.price_cents,
  pc.currency,
  pc.billing_cycle,
  pc.features,
  pc.limits,
  pc.internal_flags,
  (
    (
      us.status = 'trialing'
      and (us.trial_ends_at is null or us.trial_ends_at > now())
    )
    or (
      us.status = 'active'
      and us.access_state = 'paid_access'
    )
    or us.status = 'admin_override'
  ) as has_paid_access,
  (
    case
      when us.status = 'trialing'
        and us.trial_ends_at is not null
        and us.trial_ends_at <= now()
      then true
      when us.status in ('trial_expired', 'blocked', 'canceled', 'past_due', 'payment_pending', 'checkout_pending', 'refunded', 'chargeback', 'internal_error')
      then true
      else false
    end
  ) as requires_upsell
from public.user_subscriptions us
left join public.subscription_plan_catalog pc
  on pc.plan_code = us.plan_code;

create or replace function public.current_user_can_use_feature(feature_key text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      select
        case
          when cse.effective_status not in ('active', 'trialing', 'admin_override') then false
          when cse.effective_access_state not in ('paid_access', 'trial_access', 'limited_access', 'admin_override') then false
          when feature_key = 'basic_access' then true
          when feature_key = 'patients' then true
          else coalesce((cse.features ->> feature_key)::boolean, false)
        end
      from public.current_subscription_entitlements cse
      where cse.user_id = (select auth.uid())
      limit 1
    ),
    false
  );
$$;

create or replace function public.enforce_patient_subscription_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  entitlement record;
  patient_limit_text text;
  patient_limit integer;
  existing_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select *
  into entitlement
  from public.current_subscription_entitlements
  where user_id = new.user_id
  limit 1;

  if not found then
    raise exception 'subscription_required'
      using errcode = 'P0001',
            message = 'Assinatura obrigatoria para criar pacientes.';
  end if;

  if entitlement.effective_status not in ('active', 'trialing', 'admin_override')
    or entitlement.effective_access_state not in ('paid_access', 'trial_access', 'limited_access', 'admin_override')
  then
    raise exception 'subscription_access_blocked'
      using errcode = 'P0001',
            message = 'Seu acesso esta bloqueado. Regularize sua assinatura para continuar.';
  end if;

  patient_limit_text = entitlement.limits ->> 'patients';

  if patient_limit_text is null or patient_limit_text = 'unlimited' then
    return new;
  end if;

  patient_limit = patient_limit_text::integer;

  select count(*)
  into existing_count
  from public.patients
  where user_id = new.user_id
    and (
      status is null
      or lower(status) not in ('archived', 'inactive', 'deleted')
    );

  if existing_count >= patient_limit then
    raise exception 'patient_limit_reached'
      using errcode = 'P0001',
            message = 'Limite de pacientes do plano atingido.';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.patients') is not null then
    drop trigger if exists patients_enforce_subscription_limit on public.patients;
    create trigger patients_enforce_subscription_limit
    before insert on public.patients
    for each row execute function public.enforce_patient_subscription_limit();
  end if;
end $$;

alter table public.subscription_plan_catalog enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.subscription_checkout_sessions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.subscription_audit_logs enable row level security;
alter table public.subscription_usage_counters enable row level security;

drop policy if exists "Anyone can read active subscription plans" on public.subscription_plan_catalog;
create policy "Anyone can read active subscription plans"
on public.subscription_plan_catalog
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Service role manages subscription plans" on public.subscription_plan_catalog;
create policy "Service role manages subscription plans"
on public.subscription_plan_catalog
for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription"
on public.user_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages user subscriptions" on public.user_subscriptions;
create policy "Service role manages user subscriptions"
on public.user_subscriptions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can view own checkout sessions" on public.subscription_checkout_sessions;
create policy "Users can view own checkout sessions"
on public.subscription_checkout_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages subscription checkout sessions" on public.subscription_checkout_sessions;
create policy "Service role manages subscription checkout sessions"
on public.subscription_checkout_sessions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages subscription events" on public.subscription_events;
create policy "Service role manages subscription events"
on public.subscription_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages subscription audit logs" on public.subscription_audit_logs;
create policy "Service role manages subscription audit logs"
on public.subscription_audit_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can view own usage counters" on public.subscription_usage_counters;
create policy "Users can view own usage counters"
on public.subscription_usage_counters
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages usage counters" on public.subscription_usage_counters;
create policy "Service role manages usage counters"
on public.subscription_usage_counters
for all
to service_role
using (true)
with check (true);

revoke all on public.subscription_plan_catalog from anon, authenticated;
grant select on public.subscription_plan_catalog to anon, authenticated;

revoke all on public.user_subscriptions from anon, authenticated;
grant select on public.user_subscriptions to authenticated;

revoke all on public.subscription_checkout_sessions from anon, authenticated;
grant select on public.subscription_checkout_sessions to authenticated;

revoke all on public.subscription_events from anon, authenticated;
revoke all on public.subscription_audit_logs from anon, authenticated;

revoke all on public.subscription_usage_counters from anon, authenticated;
grant select on public.subscription_usage_counters to authenticated;

grant select on public.current_subscription_entitlements to authenticated;
revoke all on function public.current_user_can_use_feature(text) from public, anon;
grant execute on function public.current_user_can_use_feature(text) to authenticated;
revoke all on function public.enforce_patient_subscription_limit() from public, anon, authenticated;

comment on table public.subscription_plan_catalog is
  'Server-owned NeuroNex SaaS plan catalog and entitlement limits.';

comment on table public.subscription_checkout_sessions is
  'Asaas checkout/session attempts for NeuroNex SaaS billing through the master account.';

comment on table public.subscription_events is
  'Idempotent normalized SaaS subscription/payment/checkout events received from Asaas.';

comment on table public.subscription_audit_logs is
  'Audit trail for subscription and access-state transitions.';

comment on view public.current_subscription_entitlements is
  'Current computed subscription entitlement surface. Frontend should prefer the Edge Function facade.';

notify pgrst, 'reload schema';

commit;
