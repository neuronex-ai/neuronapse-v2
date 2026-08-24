-- Public buckets do not need broad SELECT policies for public object URLs.
-- Chat attachments moved to R2; keep the legacy Supabase bucket private.

drop policy if exists "Public Access Avatars" on storage.objects;
drop policy if exists "Public Access Chat Attachments" on storage.objects;
drop policy if exists "Authenticated Upload Chat Attachments" on storage.objects;
drop policy if exists "Public download access" on storage.objects;

update storage.buckets
set public = false
where id = 'chat_attachments';

drop policy if exists "Admin upload to downloads" on storage.objects;
drop policy if exists "Authenticated upload to downloads" on storage.objects;
create policy "Authenticated upload to downloads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'downloads');
