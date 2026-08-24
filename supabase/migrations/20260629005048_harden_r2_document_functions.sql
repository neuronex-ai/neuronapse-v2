create or replace function public.prepare_document_upload(
  p_patient_id uuid,
  p_category text,
  p_bucket text,
  p_object_key text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns public.document_files
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_used bigint;
  v_row public.document_files;
  v_object_prefix text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_object_prefix := 'documents/' || v_user::text || '/';

  if p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'invalid_file_size';
  end if;

  if p_category not in ('general','patient_attachment','anamnesis_import','session_document','financial','other') then
    raise exception 'invalid_category';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain',
    'text/csv'
  ) then
    raise exception 'invalid_mime_type';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'invalid_bucket';
  end if;

  if p_object_key is null
    or p_object_key not like v_object_prefix || '%'
    or p_object_key like '%..%'
    or p_object_key like '%//%'
  then
    raise exception 'invalid_object_key';
  end if;

  if p_patient_id is not null and not exists(
    select 1
    from public.patients
    where id = p_patient_id
      and user_id = v_user
  ) then
    raise exception 'patient_not_found';
  end if;

  select coalesce(sum(size_bytes), 0)
    into v_used
  from public.document_files
  where user_id = v_user
    and deleted_at is null
    and status in ('pending_upload', 'ready');

  if v_used + p_size_bytes > 262144000 then
    raise exception 'quota_exceeded';
  end if;

  insert into public.document_files(
    user_id,
    patient_id,
    category,
    bucket,
    object_key,
    original_name,
    mime_type,
    size_bytes,
    status,
    metadata
  )
  values(
    v_user,
    p_patient_id,
    p_category,
    p_bucket,
    p_object_key,
    left(p_original_name, 255),
    p_mime_type,
    p_size_bytes,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.prepare_document_upload(uuid, text, text, text, text, text, bigint, jsonb) from public;
revoke all on function public.prepare_document_upload(uuid, text, text, text, text, text, bigint, jsonb) from anon;
grant execute on function public.prepare_document_upload(uuid, text, text, text, text, text, bigint, jsonb) to authenticated, service_role;

revoke all on function public.get_document_storage_usage() from public;
revoke all on function public.get_document_storage_usage() from anon;
grant execute on function public.get_document_storage_usage() to authenticated, service_role;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on table public.document_files from anon;
revoke insert, delete, truncate, references, trigger on table public.document_files from authenticated;
grant select on table public.document_files to authenticated;
grant update(status, size_bytes, mime_type, uploaded_at, deleted_at, metadata) on public.document_files to authenticated;
