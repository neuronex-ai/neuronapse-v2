create extension if not exists pgcrypto with schema extensions;

create table if not exists public.signup_email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  recovery_email text,
  full_name text not null,
  phone text,
  professional_context text,
  code_hash text not null,
  signup_token_hash text,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  resend_count integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  blocked_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.signup_email_verifications enable row level security;

revoke all on table public.signup_email_verifications from anon;
revoke all on table public.signup_email_verifications from authenticated;

create index if not exists signup_email_verifications_email_idx
  on public.signup_email_verifications (lower(email));

create index if not exists signup_email_verifications_signup_token_idx
  on public.signup_email_verifications (signup_token_hash)
  where signup_token_hash is not null and consumed_at is null;

create index if not exists signup_email_verifications_expiry_idx
  on public.signup_email_verifications (expires_at);

alter table public.profiles
  add column if not exists professional_address jsonb not null default '{}'::jsonb;

comment on table public.signup_email_verifications is
  'Temporary custom signup code verification records. No direct client access; managed by Edge Functions with service role.';

comment on column public.profiles.professional_address is
  'Validated professional address selected during initial settings.';
