alter table public.user_financial_settings
  add column if not exists pin_last_verified_at timestamptz;

comment on column public.user_financial_settings.pin_last_verified_at is
  'Timestamp of the most recent successful financial PIN validation.';
