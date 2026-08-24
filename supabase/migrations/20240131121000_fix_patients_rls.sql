-- Consolidate RLS policies for patients table to avoid conflicts
-- First, drop all existing policies on patients to start fresh
drop policy if exists "Patients can view their own record" on public.patients;
drop policy if exists "Patients can view their own record by email" on public.patients;
drop policy if exists "Therapists can manage their own patients" on public.patients;
drop policy if exists "Users can only delete their own patients" on public.patients;
drop policy if exists "Users can only insert their own patients" on public.patients;
drop policy if exists "Users can only see their own patients" on public.patients;
drop policy if exists "Users can only update their own patients" on public.patients;

-- Ensure RLS is enabled
alter table public.patients enable row level security;

-- Create a single, comprehensive policy for Therapists (Authenticated Users)
create policy "Therapists can manage their own patients"
on public.patients
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Optional: If patients ever need to log in, we'd need a separate policy for them, 
-- but for now the user request implies the Agent acts as the Therapist.
