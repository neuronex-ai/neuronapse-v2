-- Remove unnecessary SECURITY DEFINER privilege from app-facing RPCs.
-- These functions already receive a user id and can safely run as SECURITY
-- INVOKER while preserving an explicit caller/user check.

create or replace function public.check_appointment_overlap(
  p_user_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_exclude_appointment_id uuid default null::uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  conflict_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'not allowed to check appointments for this user'
      using errcode = '42501';
  end if;

  select count(*)
  into conflict_count
  from public.appointments
  where user_id = p_user_id
    and status <> 'cancelled'
    and start_time < p_end_time
    and end_time > p_start_time
    and (p_exclude_appointment_id is null or id <> p_exclude_appointment_id);

  return conflict_count > 0;
end;
$function$;

revoke execute on function public.check_appointment_overlap(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  uuid
) from public, anon;
grant execute on function public.check_appointment_overlap(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  uuid
) to authenticated, service_role;

create or replace function public.get_financial_metrics(
  p_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_revenue numeric;
  v_expenses numeric;
  v_pending_invoices numeric;
  v_projected_revenue numeric;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'not allowed to read financial metrics for this user'
      using errcode = '42501';
  end if;

  select coalesce(sum(amount), 0)
  into v_revenue
  from public.transactions
  where user_id = p_user_id
    and type = 'income'
    and date >= p_start_date
    and date <= p_end_date;

  select coalesce(sum(amount), 0)
  into v_expenses
  from public.transactions
  where user_id = p_user_id
    and type = 'expense'
    and date >= p_start_date
    and date <= p_end_date;

  select coalesce(sum(amount), 0)
  into v_pending_invoices
  from public.invoices
  where user_id = p_user_id
    and status = 'pending';

  v_projected_revenue := v_revenue + v_pending_invoices;

  return jsonb_build_object(
    'currentMonthRevenue', v_revenue,
    'currentMonthExpenses', v_expenses,
    'netProfit', v_revenue - v_expenses,
    'projectedRevenue', v_projected_revenue,
    'pendingInvoices', v_pending_invoices
  );
end;
$function$;

revoke execute on function public.get_financial_metrics(uuid, date, date)
  from public, anon;
grant execute on function public.get_financial_metrics(uuid, date, date)
  to authenticated, service_role;
