begin;

create or replace view public.current_subscription_entitlements
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
          upper(coalesce(us.last_payment_status, '')) in (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH',
            'CHECKOUT_PAID',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED'
          )
          or upper(coalesce(us.metadata ->> 'last_asaas_event', '')) in (
            'CHECKOUT_PAID',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED'
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

grant select on public.current_subscription_entitlements to authenticated;

comment on view public.current_subscription_entitlements is
  'Current subscription/access state. Paid access requires a confirmed Asaas payment event, never checkout/subscription creation alone.';

with unsafe_paid as (
  select
    id,
    user_id,
    status,
    access_state,
    plan_code,
    last_payment_status,
    metadata,
    status_version
  from public.user_subscriptions
  where status = 'active'
    and access_state = 'paid_access'
    and upper(coalesce(last_payment_status, '')) not in (
      'CONFIRMED',
      'RECEIVED',
      'RECEIVED_IN_CASH',
      'CHECKOUT_PAID',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED'
    )
    and upper(coalesce(metadata ->> 'last_asaas_event', '')) not in (
      'CHECKOUT_PAID',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED'
    )
),
fixed as (
  update public.user_subscriptions us
  set
    plan = 'Essential',
    plan_code = 'essential',
    status = 'active',
    access_state = 'limited_access',
    blocked_at = null,
    last_payment_status = coalesce(nullif(unsafe_paid.metadata ->> 'last_asaas_event', ''), us.last_payment_status),
    metadata = coalesce(us.metadata, '{}'::jsonb) || jsonb_build_object(
      'paid_access_removed_at', now(),
      'paid_access_removed_reason', 'missing_confirmed_payment_event',
      'previous_plan_code', unsafe_paid.plan_code,
      'previous_access_state', unsafe_paid.access_state,
      'previous_last_payment_status', unsafe_paid.last_payment_status,
      'checkout_access_policy', 'essential_until_payment_confirmation'
    ),
    status_version = coalesce(us.status_version, 0) + 1,
    updated_at = now()
  from unsafe_paid
  where us.id = unsafe_paid.id
  returning
    us.id,
    us.user_id,
    unsafe_paid.status as from_status,
    us.status as to_status,
    unsafe_paid.access_state as from_access_state,
    us.access_state as to_access_state,
    unsafe_paid.plan_code as from_plan_code,
    unsafe_paid.last_payment_status as from_last_payment_status,
    unsafe_paid.metadata as from_metadata
)
insert into public.subscription_audit_logs (
  user_id,
  subscription_record_id,
  actor_type,
  action,
  from_status,
  to_status,
  from_access_state,
  to_access_state,
  reason,
  metadata
)
select
  user_id,
  id,
  'system',
  'paid_access_removed_without_payment_proof',
  from_status,
  to_status,
  from_access_state,
  to_access_state,
  'checkout_or_subscription_created_is_not_payment_proof',
  jsonb_build_object(
    'from_plan_code', from_plan_code,
    'from_last_payment_status', from_last_payment_status,
    'from_last_asaas_event', from_metadata ->> 'last_asaas_event'
  )
from fixed;

commit;
