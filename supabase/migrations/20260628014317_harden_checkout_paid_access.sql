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
    case
      when trial_is_expired then 'trial_expired'
      when status = 'active'
        and access_state = 'paid_access'
        and not payment_backed_paid_access
      then 'payment_pending'
      else status
    end as resolved_status,
    case
      when trial_is_expired then 'blocked'
      when status = 'active'
        and access_state = 'paid_access'
        and not payment_backed_paid_access
      then 'blocked'
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
  plan,
  plan_code,
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
  public_name,
  price_cents,
  currency,
  billing_cycle,
  case
    when has_current_access then coalesce(configured_features, '{}'::jsonb)
    else coalesce(essential_features, '{}'::jsonb)
  end as features,
  case
    when has_current_access then coalesce(configured_limits, '{}'::jsonb)
    else coalesce(essential_limits, '{}'::jsonb)
  end as limits,
  case
    when has_current_access then coalesce(configured_internal_flags, '{}'::jsonb)
    else coalesce(essential_internal_flags, '{}'::jsonb)
  end as internal_flags,
  payment_backed_paid_access as has_paid_access,
  has_current_access,
  (
    case
      when trial_is_expired then true
      when status = 'active'
        and access_state = 'paid_access'
        and not payment_backed_paid_access
      then true
      when status in (
        'trial_expired',
        'blocked',
        'canceled',
        'past_due',
        'payment_pending',
        'checkout_pending',
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

comment on view public.current_subscription_entitlements is
  'Current computed subscription entitlement surface. Checkout and local active states only expose paid access when backed by a confirmed Asaas payment/webhook.';

notify pgrst, 'reload schema';

commit;
