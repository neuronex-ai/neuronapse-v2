-- Secure two-step bill payment flow.
-- The consultation is persisted server-side so execution never trusts values
-- resubmitted by the browser after the user reviews the bill.

alter table public.neurofinance_bill_payments
  add column if not exists consultation_expires_at timestamptz,
  add column if not exists authorized_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists receipt_url text;

create unique index if not exists idx_neurofinance_bill_payments_user_external_reference
  on public.neurofinance_bill_payments(user_id, external_reference);

create index if not exists idx_neurofinance_bill_payments_user_status
  on public.neurofinance_bill_payments(user_id, status, created_at desc);

comment on column public.neurofinance_bill_payments.consultation_expires_at is
  'Maximum time at which a simulated bill may still be authorized and submitted.';

comment on column public.neurofinance_bill_payments.authorized_at is
  'Timestamp when the owner confirmed the bill using the six-digit financial PIN.';

comment on column public.neurofinance_bill_payments.submitted_at is
  'Timestamp when the frozen consultation payload was submitted to Asaas.';

comment on column public.neurofinance_bill_payments.receipt_url is
  'Provider receipt URL when one is returned by Asaas.';
