alter table public.neurofinance_bill_payments
  add column if not exists payment_mode text,
  add column if not exists available_balance_at_review integer,
  add column if not exists balance_source text,
  add column if not exists provider_status text,
  add column if not exists payment_date date,
  add column if not exists can_be_cancelled boolean;

alter table public.neurofinance_bill_payments
  drop constraint if exists neurofinance_bill_payments_payment_mode_check;

alter table public.neurofinance_bill_payments
  add constraint neurofinance_bill_payments_payment_mode_check
  check (payment_mode is null or payment_mode in ('now', 'scheduled'));

update public.neurofinance_bill_payments
set
  payment_mode = case
    when scheduled_date is not null
      and scheduled_date > (created_at at time zone 'America/Sao_Paulo')::date
      then 'scheduled'
    else 'now'
  end,
  provider_status = coalesce(
    provider_status,
    provider_payload #>> '{execution,status}',
    provider_payload ->> 'status'
  ),
  payment_date = coalesce(
    payment_date,
    nullif(provider_payload #>> '{execution,paymentDate}', '')::date,
    nullif(provider_payload ->> 'paymentDate', '')::date
  ),
  can_be_cancelled = coalesce(
    can_be_cancelled,
    (provider_payload #>> '{execution,canBeCancelled}')::boolean,
    (provider_payload ->> 'canBeCancelled')::boolean
  ),
  status = case
    when coalesce(
      provider_status,
      provider_payload #>> '{execution,status}',
      provider_payload ->> 'status'
    ) in ('PENDING', 'CREATED')
      and scheduled_date > (now() at time zone 'America/Sao_Paulo')::date
      then 'scheduled'
    else status
  end
where provider_bill_id is not null;

create index if not exists idx_neurofinance_bill_payments_user_schedule
  on public.neurofinance_bill_payments(user_id, scheduled_date desc, created_at desc)
  where provider_bill_id is not null;

comment on column public.neurofinance_bill_payments.payment_mode is
  'Owner choice frozen with the financial PIN: now or scheduled.';

comment on column public.neurofinance_bill_payments.available_balance_at_review is
  'Available Asaas subaccount balance in cents when the payment choice was confirmed.';

comment on column public.neurofinance_bill_payments.provider_status is
  'Latest raw bill status returned by Asaas or received through BILL_* webhooks.';

comment on column public.neurofinance_bill_payments.provider_payload is
  'Complete Asaas consultation, execution and latest webhook payloads for audit and detail views.';
