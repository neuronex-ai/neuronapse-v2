alter table public.profiles
  add column if not exists recovery_email text,
  add column if not exists professional_context text,
  add column if not exists signup_completed_at timestamptz,
  add column if not exists initial_preferences jsonb not null default '{}'::jsonb,
  add column if not exists calendar_sync_enabled boolean not null default false,
  add column if not exists gmail_send_enabled boolean not null default false,
  add column if not exists neurofinance_intro_choice text;

do $$
begin
  alter table public.profiles
    add constraint profiles_professional_context_check
    check (
      professional_context is null or
      professional_context in (
        'individual_professional',
        'clinic_admin',
        'psychology_student'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_neurofinance_intro_choice_check
    check (
      neurofinance_intro_choice is null or
      neurofinance_intro_choice in ('create_now', 'later')
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.recovery_email is 'Secondary email used for account recovery and future primary email changes.';
comment on column public.profiles.professional_context is 'Self-described signup context for the professional account.';
comment on column public.profiles.initial_preferences is 'Initial settings wizard choices captured after account creation.';
comment on column public.profiles.calendar_sync_enabled is 'Whether the professional enabled calendar sync during setup.';
comment on column public.profiles.gmail_send_enabled is 'Whether the professional allowed Gmail sending during setup.';
comment on column public.profiles.neurofinance_intro_choice is 'Choice made in the NeuroFinance introduction during setup.';
