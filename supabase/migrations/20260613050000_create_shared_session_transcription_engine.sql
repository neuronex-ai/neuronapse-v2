create table if not exists public.session_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  modality text not null check (modality in ('online', 'in_person')),
  provider text not null default 'mixed' check (provider in ('jitsi', 'browser_speech', 'manual', 'mixed')),
  status text not null default 'draft' check (status in ('draft', 'recording', 'paused', 'finalizing', 'completed', 'error', 'abandoned')),
  language text not null default 'pt-BR',
  consent_status text not null default 'pending' check (consent_status in ('pending', 'granted', 'declined', 'revoked')),
  consent_method text check (consent_method is null or consent_method in ('verbal', 'written', 'digital', 'legacy')),
  consent_notes text,
  consent_recorded_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  finalized_at timestamptz,
  reviewed_at timestamptz,
  summary_note_id uuid references public.session_notes(id) on delete set null,
  retention_policy text not null default 'manual' check (retention_policy in ('manual', 'keep', 'delete_after_summary')),
  retention_until timestamptz,
  last_synced_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint session_transcripts_id_user_unique unique (id, user_id)
);

create table if not exists public.session_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null,
  user_id uuid not null,
  client_segment_id uuid not null,
  sequence bigint not null check (sequence >= 0),
  source text not null check (source in ('jitsi', 'browser_speech', 'manual', 'imported')),
  speaker_label text,
  speaker_id text,
  text text not null check (length(btrim(text)) > 0),
  is_final boolean not null default true,
  started_at_ms integer check (started_at_ms is null or started_at_ms >= 0),
  ended_at_ms integer check (ended_at_ms is null or ended_at_ms >= 0),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_transcript_segments_transcript_user_fk
    foreign key (transcript_id, user_id)
    references public.session_transcripts(id, user_id)
    on delete cascade,
  constraint session_transcript_segments_client_unique unique (transcript_id, client_segment_id),
  constraint session_transcript_segments_sequence_unique unique (transcript_id, sequence)
);

create index if not exists session_transcripts_user_created_idx on public.session_transcripts (user_id, created_at desc) where deleted_at is null;
create index if not exists session_transcripts_appointment_idx on public.session_transcripts (appointment_id, created_at desc) where deleted_at is null;
create index if not exists session_transcripts_patient_idx on public.session_transcripts (patient_id, created_at desc) where deleted_at is null;
create index if not exists session_transcripts_active_idx on public.session_transcripts (user_id, status, updated_at desc) where deleted_at is null and status in ('draft', 'recording', 'paused', 'finalizing', 'error');
create index if not exists session_transcript_segments_transcript_sequence_idx on public.session_transcript_segments (transcript_id, sequence);
create index if not exists session_transcript_segments_user_created_idx on public.session_transcript_segments (user_id, created_at desc);

create or replace function public.touch_session_transcript_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_session_transcripts_updated_at on public.session_transcripts;
create trigger touch_session_transcripts_updated_at before update on public.session_transcripts for each row execute function public.touch_session_transcript_updated_at();

alter table public.session_transcripts enable row level security;
alter table public.session_transcript_segments enable row level security;

revoke all on public.session_transcripts from anon;
revoke all on public.session_transcript_segments from anon;
grant select, insert, update, delete on public.session_transcripts to authenticated;
grant select, insert, update, delete on public.session_transcript_segments to authenticated;
grant all on public.session_transcripts to service_role;
grant all on public.session_transcript_segments to service_role;

create policy "Users can view their own session transcripts" on public.session_transcripts for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Users can create their own session transcripts" on public.session_transcripts for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Users can update their own session transcripts" on public.session_transcripts for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Users can delete their own session transcripts" on public.session_transcripts for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view their own transcript segments" on public.session_transcript_segments for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id and exists (select 1 from public.session_transcripts transcript where transcript.id = transcript_id and transcript.user_id = (select auth.uid()) and transcript.deleted_at is null));
create policy "Users can create their own transcript segments" on public.session_transcript_segments for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and exists (select 1 from public.session_transcripts transcript where transcript.id = transcript_id and transcript.user_id = (select auth.uid()) and transcript.deleted_at is null));
create policy "Users can update their own transcript segments" on public.session_transcript_segments for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and exists (select 1 from public.session_transcripts transcript where transcript.id = transcript_id and transcript.user_id = (select auth.uid()) and transcript.deleted_at is null));
create policy "Users can delete their own transcript segments" on public.session_transcript_segments for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_transcripts') then
      alter publication supabase_realtime add table public.session_transcripts;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_transcript_segments') then
      alter publication supabase_realtime add table public.session_transcript_segments;
    end if;
  end if;
end;
$$;
