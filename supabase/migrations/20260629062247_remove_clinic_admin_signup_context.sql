-- Plano Clinica/multi-professional signup is postponed and will be rebuilt
-- from a fresh contract. Keep the active signup contexts individual only.

update public.profiles
set professional_context = 'individual_professional'
where professional_context = 'clinic_admin';

alter table if exists public.profiles
  drop constraint if exists profiles_professional_context_check;

alter table if exists public.profiles
  add constraint profiles_professional_context_check
  check (
    professional_context is null or
    professional_context in (
      'individual_professional',
      'psychology_student'
    )
  );

comment on column public.profiles.professional_context is
  'Self-described signup context for the professional account. Clinic/team signup context was removed as legacy.';
