create table if not exists public.synapse_whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  instance_name text not null,
  instance_key text generated always as (lower(btrim(instance_name))) stored,
  label text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists synapse_whatsapp_instances_instance_key_key
  on public.synapse_whatsapp_instances(instance_key);

create index if not exists idx_synapse_whatsapp_instances_professional_id
  on public.synapse_whatsapp_instances(professional_id);

alter table public.synapse_whatsapp_instances enable row level security;

drop policy if exists "Professionals can read their own WhatsApp instances"
  on public.synapse_whatsapp_instances;
create policy "Professionals can read their own WhatsApp instances"
  on public.synapse_whatsapp_instances
  for select
  to authenticated
  using (auth.uid() = professional_id);

drop policy if exists "Professionals can manage their own WhatsApp instances"
  on public.synapse_whatsapp_instances;
create policy "Professionals can manage their own WhatsApp instances"
  on public.synapse_whatsapp_instances
  for all
  to authenticated
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

grant select, insert, update, delete on public.synapse_whatsapp_instances to authenticated;

drop trigger if exists set_updated_at on public.synapse_whatsapp_instances;
create trigger set_updated_at
before update on public.synapse_whatsapp_instances
for each row execute function public.update_updated_at_column();

create or replace function public.match_messages_gemini_for_user(
  target_user_id uuid,
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  role text,
  similarity float,
  created_at timestamptz
)
language plpgsql
stable
as $$
begin
  if target_user_id is null then
    return;
  end if;

  if auth.role() is distinct from 'service_role' and auth.uid() is distinct from target_user_id then
    raise exception 'not allowed to read memories for another user';
  end if;

  return query
  select
    m.id,
    m.content,
    m.role,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from public.messages m
  where m.user_id = target_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke all on function public.match_messages_gemini_for_user(uuid, vector(768), float, int) from public;
grant execute on function public.match_messages_gemini_for_user(uuid, vector(768), float, int) to authenticated;
grant execute on function public.match_messages_gemini_for_user(uuid, vector(768), float, int) to service_role;
