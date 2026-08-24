begin;

alter table public.patients
  add column if not exists group_type text not null default 'adult',
  add column if not exists quick_registration boolean not null default true,
  add column if not exists phone_country_code text not null default '+55',
  add column if not exists mobile_phone text,
  add column if not exists landline_phone text,
  add column if not exists rg text,
  add column if not exists gender_identity text,
  add column if not exists has_social_name boolean not null default false,
  add column if not exists social_name text,
  add column if not exists country text not null default 'Brasil',
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text,
  add column if not exists complement text,
  add column if not exists naturality text,
  add column if not exists education_level text,
  add column if not exists race text,
  add column if not exists profession text,
  add column if not exists relative_name text,
  add column if not exists relative_relationship text,
  add column if not exists relative_phone text,
  add column if not exists referred_by_option_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_group_type_check') then
    alter table public.patients
      add constraint patients_group_type_check
      check (group_type in ('adult', 'child', 'adolescent', 'elderly'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'patients_gender_identity_check') then
    alter table public.patients
      add constraint patients_gender_identity_check
      check (
        gender_identity is null
        or gender_identity in (
          'male',
          'female',
          'agender',
          'gender_fluid',
          'non_binary',
          'transgender',
          'prefer_not_to_say',
          'other'
        )
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'patients_state_check') then
    alter table public.patients
      add constraint patients_state_check
      check (
        state is null
        or state in (
          'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS',
          'MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC',
          'SE','SP','TO'
        )
      );
  end if;
end $$;

create table if not exists public.patient_lookup_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_lookup_options_kind_check
    check (kind in ('referrer')),
  constraint patient_lookup_options_label_not_blank
    check (length(btrim(label)) > 0)
);

create unique index if not exists patient_lookup_options_user_kind_label_uidx
  on public.patient_lookup_options (user_id, kind, lower(btrim(label)));

create index if not exists patient_lookup_options_user_kind_idx
  on public.patient_lookup_options (user_id, kind, active);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_referred_by_option_id_fkey') then
    alter table public.patients
      add constraint patients_referred_by_option_id_fkey
      foreign key (referred_by_option_id)
      references public.patient_lookup_options(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.patient_insurance_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  repass_type text not null default 'currency',
  repass_value_cents integer,
  repass_percentage numeric(5,2),
  expected_receipt_days integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_insurance_agreements_name_check check (length(btrim(name)) > 0),
  constraint patient_insurance_agreements_repass_type_check check (repass_type in ('currency', 'percentage')),
  constraint patient_insurance_agreements_value_check check (repass_value_cents is null or repass_value_cents >= 0),
  constraint patient_insurance_agreements_percentage_check check (repass_percentage is null or (repass_percentage >= 0 and repass_percentage <= 100)),
  constraint patient_insurance_agreements_days_check check (expected_receipt_days >= 0)
);

create unique index if not exists patient_insurance_agreements_user_name_uidx
  on public.patient_insurance_agreements (user_id, lower(btrim(name)));

create index if not exists patient_insurance_agreements_user_active_idx
  on public.patient_insurance_agreements (user_id, active);

create table if not exists public.patient_responsibles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text,
  email text,
  phone_country_code text not null default '+55',
  mobile_phone text,
  cpf text,
  rg text,
  birth_date date,
  use_for_billing_documents boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id)
);

create index if not exists patient_responsibles_user_patient_idx
  on public.patient_responsibles (user_id, patient_id);

create table if not exists public.patient_financial_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_name text,
  plan_type text not null default 'per_session',
  session_value_cents integer not null default 0,
  monthly_value_cents integer,
  billing_day smallint,
  insurance_agreement_id uuid references public.patient_insurance_agreements(id) on delete set null,
  insurance_card_number text,
  insurance_card_expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id),
  constraint patient_financial_settings_plan_type_check
    check (plan_type in ('per_session', 'monthly', 'insurance', 'exempt')),
  constraint patient_financial_settings_session_value_check
    check (session_value_cents >= 0),
  constraint patient_financial_settings_monthly_value_check
    check (monthly_value_cents is null or monthly_value_cents >= 0),
  constraint patient_financial_settings_billing_day_check
    check (billing_day is null or billing_day between 1 and 31)
);

alter table public.patient_financial_settings
  add column if not exists insurance_agreement_id uuid,
  add column if not exists insurance_card_number text,
  add column if not exists insurance_card_expires_at date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patient_financial_settings_insurance_agreement_id_fkey') then
    alter table public.patient_financial_settings
      add constraint patient_financial_settings_insurance_agreement_id_fkey
      foreign key (insurance_agreement_id)
      references public.patient_insurance_agreements(id)
      on delete set null;
  end if;
end $$;

create index if not exists patient_financial_settings_user_patient_idx
  on public.patient_financial_settings (user_id, patient_id);

create table if not exists public.psychologist_patient_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_quick_registration boolean not null default true,
  default_group_type text not null default 'adult',
  default_country text not null default 'Brasil',
  default_financial_plan text not null default 'per_session',
  default_session_value_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint psychologist_patient_preferences_group_type_check
    check (default_group_type in ('adult', 'child', 'adolescent', 'elderly')),
  constraint psychologist_patient_preferences_financial_plan_check
    check (default_financial_plan in ('per_session', 'monthly', 'insurance', 'exempt')),
  constraint psychologist_patient_preferences_session_value_check
    check (default_session_value_cents >= 0)
);

alter table public.patient_lookup_options enable row level security;
alter table public.patient_insurance_agreements enable row level security;
alter table public.patient_responsibles enable row level security;
alter table public.patient_financial_settings enable row level security;
alter table public.psychologist_patient_preferences enable row level security;

drop policy if exists "patient_lookup_options_select_own" on public.patient_lookup_options;
create policy "patient_lookup_options_select_own"
  on public.patient_lookup_options for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_lookup_options_insert_own" on public.patient_lookup_options;
create policy "patient_lookup_options_insert_own"
  on public.patient_lookup_options for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "patient_lookup_options_update_own" on public.patient_lookup_options;
create policy "patient_lookup_options_update_own"
  on public.patient_lookup_options for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "patient_lookup_options_delete_own" on public.patient_lookup_options;
create policy "patient_lookup_options_delete_own"
  on public.patient_lookup_options for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_insurance_agreements_select_own" on public.patient_insurance_agreements;
create policy "patient_insurance_agreements_select_own"
  on public.patient_insurance_agreements for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_insurance_agreements_insert_own" on public.patient_insurance_agreements;
create policy "patient_insurance_agreements_insert_own"
  on public.patient_insurance_agreements for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "patient_insurance_agreements_update_own" on public.patient_insurance_agreements;
create policy "patient_insurance_agreements_update_own"
  on public.patient_insurance_agreements for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "patient_insurance_agreements_delete_own" on public.patient_insurance_agreements;
create policy "patient_insurance_agreements_delete_own"
  on public.patient_insurance_agreements for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_responsibles_select_own" on public.patient_responsibles;
create policy "patient_responsibles_select_own"
  on public.patient_responsibles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_responsibles_insert_own" on public.patient_responsibles;
create policy "patient_responsibles_insert_own"
  on public.patient_responsibles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "patient_responsibles_update_own" on public.patient_responsibles;
create policy "patient_responsibles_update_own"
  on public.patient_responsibles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "patient_responsibles_delete_own" on public.patient_responsibles;
create policy "patient_responsibles_delete_own"
  on public.patient_responsibles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_financial_settings_select_own" on public.patient_financial_settings;
create policy "patient_financial_settings_select_own"
  on public.patient_financial_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "patient_financial_settings_insert_own" on public.patient_financial_settings;
create policy "patient_financial_settings_insert_own"
  on public.patient_financial_settings for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "patient_financial_settings_update_own" on public.patient_financial_settings;
create policy "patient_financial_settings_update_own"
  on public.patient_financial_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "patient_financial_settings_delete_own" on public.patient_financial_settings;
create policy "patient_financial_settings_delete_own"
  on public.patient_financial_settings for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "psychologist_patient_preferences_select_own" on public.psychologist_patient_preferences;
create policy "psychologist_patient_preferences_select_own"
  on public.psychologist_patient_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "psychologist_patient_preferences_insert_own" on public.psychologist_patient_preferences;
create policy "psychologist_patient_preferences_insert_own"
  on public.psychologist_patient_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "psychologist_patient_preferences_update_own" on public.psychologist_patient_preferences;
create policy "psychologist_patient_preferences_update_own"
  on public.psychologist_patient_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.patient_lookup_options to authenticated, service_role;
grant select, insert, update, delete on public.patient_insurance_agreements to authenticated, service_role;
grant select, insert, update, delete on public.patient_responsibles to authenticated, service_role;
grant select, insert, update, delete on public.patient_financial_settings to authenticated, service_role;
grant select, insert, update on public.psychologist_patient_preferences to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.update_updated_at_column()') is not null then
    drop trigger if exists patient_lookup_options_set_updated_at on public.patient_lookup_options;
    create trigger patient_lookup_options_set_updated_at
      before update on public.patient_lookup_options
      for each row execute function public.update_updated_at_column();

    drop trigger if exists patient_insurance_agreements_set_updated_at on public.patient_insurance_agreements;
    create trigger patient_insurance_agreements_set_updated_at
      before update on public.patient_insurance_agreements
      for each row execute function public.update_updated_at_column();

    drop trigger if exists patient_responsibles_set_updated_at on public.patient_responsibles;
    create trigger patient_responsibles_set_updated_at
      before update on public.patient_responsibles
      for each row execute function public.update_updated_at_column();

    drop trigger if exists patient_financial_settings_set_updated_at on public.patient_financial_settings;
    create trigger patient_financial_settings_set_updated_at
      before update on public.patient_financial_settings
      for each row execute function public.update_updated_at_column();

    drop trigger if exists psychologist_patient_preferences_set_updated_at on public.psychologist_patient_preferences;
    create trigger psychologist_patient_preferences_set_updated_at
      before update on public.psychologist_patient_preferences
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

commit;
