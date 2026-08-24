update storage.buckets
set public = false
where id = 'files_psico';

drop policy if exists "Allow authenticated patients to download their files" on storage.objects;
drop policy if exists "Allow authenticated users to delete their own files" on storage.objects;
drop policy if exists "Allow authenticated users to read their own files" on storage.objects;
drop policy if exists "Allow authenticated users to update their own files" on storage.objects;
drop policy if exists "Allow authenticated users to upload files" on storage.objects;

drop policy if exists "Service role can manage legacy files_psico during migration" on storage.objects;
create policy "Service role can manage legacy files_psico during migration"
on storage.objects
for all
to service_role
using (bucket_id = 'files_psico')
with check (bucket_id = 'files_psico');
