alter table public.profiles
  add column if not exists gender_identity text;

alter table public.signup_email_verifications
  add column if not exists gender_identity text;

do $$
begin
  alter table public.profiles
    add constraint profiles_gender_identity_check
    check (
      gender_identity is null or
      gender_identity in ('female', 'male', 'non_binary', 'prefer_not_to_say')
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.signup_email_verifications
    add constraint signup_email_verifications_gender_identity_check
    check (
      gender_identity is null or
      gender_identity in ('female', 'male', 'non_binary', 'prefer_not_to_say')
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.gender_identity is
  'Gender identity selected during public signup. Used to guide Synapse language only.';

comment on column public.signup_email_verifications.gender_identity is
  'Temporary gender identity captured before custom signup completion.';
