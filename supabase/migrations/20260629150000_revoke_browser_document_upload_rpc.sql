-- The browser now creates document metadata through the authenticated R2 Edge Function.
-- Keep this RPC available only to server-side service-role code.

revoke execute on function public.prepare_document_upload(
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb
) from authenticated;

grant execute on function public.prepare_document_upload(
  uuid,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb
) to service_role;

drop policy if exists "Users update their own document lifecycle" on public.document_files;

revoke update (
  status,
  size_bytes,
  mime_type,
  uploaded_at,
  deleted_at,
  metadata
) on table public.document_files from authenticated;
