create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  category text not null default 'general' check (category in ('general','patient_attachment','anamnesis_import','session_document','financial','other')),
  provider text not null default 'cloudflare_r2' check (provider = 'cloudflare_r2'),
  bucket text not null,
  object_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  status text not null default 'pending_upload' check (status in ('pending_upload','ready','failed','deleted')),
  checksum_sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists document_files_user_created_idx on public.document_files(user_id,created_at desc);
create index if not exists document_files_patient_created_idx on public.document_files(patient_id,created_at desc) where patient_id is not null;
alter table public.document_files enable row level security;
create policy "Users can read their own document files" on public.document_files for select to authenticated using (auth.uid()=user_id);
revoke insert,update,delete on public.document_files from authenticated;
grant select on public.document_files to authenticated;
create or replace function public.set_document_files_updated_at() returns trigger language plpgsql security invoker set search_path=public as $$ begin new.updated_at=now();return new;end; $$;
create trigger set_document_files_updated_at before update on public.document_files for each row execute function public.set_document_files_updated_at();
create or replace function public.get_document_storage_usage() returns table(total_bytes bigint,file_count bigint) language sql stable security invoker set search_path=public as $$ select coalesce(sum(size_bytes),0)::bigint,count(*)::bigint from public.document_files where user_id=auth.uid() and status='ready' and deleted_at is null; $$;
grant execute on function public.get_document_storage_usage() to authenticated;
