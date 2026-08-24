begin;

drop function if exists public.current_user_can_use_feature(text);
drop view if exists public.current_subscription_entitlements;

create view public.current_subscription_entitlements
with (security_invoker = true)
as
with entitlement_source as (
  select
    us.*,
    pc.public_name,
    pc.price_cents,
    pc.currency,
    pc.billing_cycle,
    pc.features as configured_features,
    pc.limits as configured_limits,
    pc.internal_flags as configured_internal_flags,
    ep.public_name as essential_public_name,
    ep.features as essential_features,
    ep.limits as essential_limits,
    ep.internal_flags as essential_internal_flags,
    (
      us.status = 'trialing'
      and us.trial_ends_at is not null
      and us.trial_ends_at <= now()
    ) as trial_is_expired,
    (
      us.status = 'admin_override'
      or (
        us.status = 'active'
        and us.access_state = 'paid_access'
        and (
          us.last_payment_id is not null
          or upper(coalesce(us.last_payment_status, '')) in (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH',
            'CHECKOUT_PAID',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED'
          )
          or (
            us.asaas_subscription_id is not null
            and us.last_payment_event_at is not null
          )
        )
      )
    ) as payment_backed_paid_access
  from public.user_subscriptions us
  left join public.subscription_plan_catalog pc
    on pc.plan_code = us.plan_code
  left join public.subscription_plan_catalog ep
    on ep.plan_code = 'essential'
),
entitlement_resolved as (
  select
    *,
    (
      not payment_backed_paid_access
      and (
        trial_is_expired
        or status in ('trial_expired', 'checkout_pending', 'payment_pending')
        or (status = 'active' and access_state = 'paid_access')
      )
    ) as should_fallback_to_essential,
    case
      when not payment_backed_paid_access
        and (
          trial_is_expired
          or status in ('trial_expired', 'checkout_pending', 'payment_pending')
          or (status = 'active' and access_state = 'paid_access')
        )
      then 'active'
      else status
    end as resolved_status,
    case
      when not payment_backed_paid_access
        and (
          trial_is_expired
          or status in ('trial_expired', 'checkout_pending', 'payment_pending')
          or (status = 'active' and access_state = 'paid_access')
        )
      then 'limited_access'
      else access_state
    end as resolved_access_state
  from entitlement_source
),
entitlement_gated as (
  select
    *,
    (
      (
        resolved_status = 'trialing'
        and (trial_ends_at is null or trial_ends_at > now())
        and resolved_access_state = 'trial_access'
      )
      or (
        resolved_status = 'active'
        and resolved_access_state = 'limited_access'
      )
      or payment_backed_paid_access
      or resolved_status = 'admin_override'
    ) as has_current_access
  from entitlement_resolved
)
select
  user_id,
  id as subscription_record_id,
  case when should_fallback_to_essential then 'Essential' else plan end as plan,
  case when should_fallback_to_essential then 'essential' else plan_code end as plan_code,
  resolved_status as effective_status,
  resolved_access_state as effective_access_state,
  status,
  access_state,
  current_period_start,
  current_period_end,
  trial_started_at,
  trial_ends_at,
  grace_period_ends_at,
  asaas_customer_id,
  asaas_subscription_id,
  last_payment_id,
  last_payment_status,
  last_payment_event_at,
  case when should_fallback_to_essential then essential_public_name else public_name end as public_name,
  case when should_fallback_to_essential then 0 else price_cents end as price_cents,
  currency,
  billing_cycle,
  case
    when should_fallback_to_essential then coalesce(essential_features, '{}'::jsonb)
    when has_current_access then coalesce(configured_features, '{}'::jsonb)
    else coalesce(essential_features, '{}'::jsonb)
  end as features,
  case
    when should_fallback_to_essential then coalesce(essential_limits, '{}'::jsonb)
    when has_current_access then coalesce(configured_limits, '{}'::jsonb)
    else coalesce(essential_limits, '{}'::jsonb)
  end as limits,
  case
    when should_fallback_to_essential then coalesce(essential_internal_flags, '{}'::jsonb)
    when has_current_access then coalesce(configured_internal_flags, '{}'::jsonb)
    else coalesce(essential_internal_flags, '{}'::jsonb)
  end as internal_flags,
  payment_backed_paid_access as has_paid_access,
  has_current_access,
  (
    case
      when should_fallback_to_essential then false
      when status in (
        'blocked',
        'canceled',
        'past_due',
        'refunded',
        'chargeback',
        'internal_error'
      )
      then true
      else false
    end
  ) as requires_upsell
from entitlement_gated;

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
          when cse.has_current_access is not true then false
          when feature_key = 'basic_access' then true
          when feature_key = 'patients' then true
          when feature_key in ('advanced_finance', 'patient_portal') and cse.has_paid_access is not true then false
          else coalesce((cse.features ->> feature_key)::boolean, false)
        end
      from public.current_subscription_entitlements cse
      where cse.user_id = (select auth.uid())
      limit 1
    ),
    false
  );
$$;

grant select on public.current_subscription_entitlements to authenticated;
revoke all on function public.current_user_can_use_feature(text) from public, anon;
grant execute on function public.current_user_can_use_feature(text) to authenticated;

with affected as (
  update public.user_subscriptions us
  set
    plan = 'Essential',
    plan_code = 'essential',
    status = 'active',
    access_state = 'limited_access',
    blocked_at = null,
    metadata = coalesce(us.metadata, '{}'::jsonb) || jsonb_build_object(
      'checkout_access_policy', 'essential_until_payment_confirmation',
      'essential_fallback_applied_at', now(),
      'essential_fallback_reason', 'trial_or_checkout_without_confirmed_payment'
    ),
    status_version = coalesce(us.status_version, 0) + 1,
    updated_at = now()
  where
    not (
      us.status = 'active'
      and us.access_state = 'paid_access'
      and (
        us.last_payment_id is not null
        or upper(coalesce(us.last_payment_status, '')) in (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH',
          'CHECKOUT_PAID',
          'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED'
        )
        or (
          us.asaas_subscription_id is not null
          and us.last_payment_event_at is not null
        )
      )
    )
    and (
      us.status in ('trial_expired', 'checkout_pending', 'payment_pending')
      or (us.status = 'trialing' and us.trial_ends_at is not null and us.trial_ends_at <= now())
      or (us.status = 'active' and us.access_state = 'paid_access')
    )
  returning
    us.id,
    us.user_id,
    us.status,
    us.access_state
)
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
select
  affected.user_id,
  affected.id,
  'system',
  'essential_fallback_without_payment_confirmation',
  'active',
  'limited_access',
  'trial_checkout_or_local_paid_state_without_confirmed_payment',
  jsonb_build_object('migration', '20260628020650_checkout_pending_essential_fallback')
from affected;

comment on view public.current_subscription_entitlements is
  'Current computed subscription entitlement surface. Expired trial, checkout or local paid states without confirmed Asaas payment fall back to Essential/limited access; paid access requires webhook or server-side payment proof.';

notify pgrst, 'reload schema';

commit;
