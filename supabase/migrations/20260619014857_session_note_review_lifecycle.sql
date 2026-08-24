begin;

create extension if not exists pg_cron with schema extensions;
create schema if not exists private;

alter table public.session_notes
  add column if not exists review_status text not null default 'confirmed',
  add column if not exists review_due_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists auto_confirmed_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists source_transcript_id uuid references public.session_transcripts(id) on delete set null,
  add column if not exists original_ai_summary jsonb,
  add column if not exists original_transcription text,
  add column if not exists ai_summary_edited boolean not null default false,
  add column if not exists ai_summary_edited_at timestamptz,
  add column if not exists ai_summary_edited_by uuid references auth.users(id) on delete set null,
  add column if not exists ai_summary_edit_count integer not null default 0;

update public.session_notes
set
  review_status = coalesce(nullif(review_status, ''), 'confirmed'),
  confirmed_at = coalesce(confirmed_at, created_at),
  locked_at = coalesce(locked_at, created_at),
  original_ai_summary = coalesce(original_ai_summary, ai_summary),
  original_transcription = coalesce(original_transcription, transcription)
where review_status is null
   or review_status = ''
   or review_status = 'confirmed'
   or original_ai_summary is null
   or original_transcription is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'session_notes_review_status_check'
      and conrelid = 'public.session_notes'::regclass
  ) then
    alter table public.session_notes
      add constraint session_notes_review_status_check
      check (review_status in ('pending_review', 'confirmed'));
  end if;
end;
$$;

create index if not exists session_notes_patient_review_status_idx
  on public.session_notes (user_id, patient_id, review_status, review_due_at desc);

create index if not exists session_notes_pending_review_due_idx
  on public.session_notes (review_due_at)
  where review_status = 'pending_review';

create or replace function private.confirm_expired_session_note_reviews()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  update public.session_notes
  set
    review_status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, now()),
    auto_confirmed_at = coalesce(auto_confirmed_at, now()),
    locked_at = coalesce(locked_at, now())
  where review_status = 'pending_review'
    and review_due_at is not null
    and review_due_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.confirm_expired_session_note_reviews() from public;

select cron.unschedule(jobid)
from cron.job
where jobname = 'neuronex-session-note-auto-confirm';

select cron.schedule(
  'neuronex-session-note-auto-confirm',
  '15 * * * *',
  $cron$select private.confirm_expired_session_note_reviews();$cron$
);

notify pgrst, 'reload schema';

commit;
