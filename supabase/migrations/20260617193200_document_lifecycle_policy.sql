create policy "Users update their own document lifecycle" on public.document_files for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant update(status,size_bytes,mime_type,uploaded_at,deleted_at,metadata) on public.document_files to authenticated;
