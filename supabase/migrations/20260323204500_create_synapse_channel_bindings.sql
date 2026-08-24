-- Create synapse_channel_bindings table
create table if not exists public.synapse_channel_bindings (
  id uuid primary key,
  professional_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'whatsapp',
  external_user_id text not null,
  session_id text not null,
  instance_name text null,
  push_name text null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_seen_at timestamptz default now() not null,
  unique (professional_id, channel, external_user_id),
  unique (session_id)
);

-- RLS
alter table public.synapse_channel_bindings enable row level security;

-- Only the professional or service role can access these bindings
create policy "Professionals can view their own channel bindings"
  on public.synapse_channel_bindings for select
  using (auth.uid() = professional_id);

create policy "Professionals can manage their own channel bindings"
  on public.synapse_channel_bindings for all
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

-- Create indeces to speed up lookups
create index if not exists idx_synapse_channel_bindings_professional_id on public.synapse_channel_bindings(professional_id);
create index if not exists idx_synapse_channel_bindings_session_id on public.synapse_channel_bindings(session_id);
create index if not exists idx_synapse_channel_bindings_external on public.synapse_channel_bindings(channel, external_user_id);
