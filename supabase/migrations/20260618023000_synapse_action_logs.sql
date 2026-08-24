create table if not exists public.synapse_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid null references public.chat_sessions(id) on delete set null,
  channel text not null check (channel in ('text', 'voice')),
  action_type text not null,
  status text not null check (status in ('success', 'error', 'cancelled')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists synapse_action_logs_user_created_idx
  on public.synapse_action_logs(user_id, created_at desc);

alter table public.synapse_action_logs enable row level security;

drop policy if exists "Users insert their own Synapse action logs" on public.synapse_action_logs;
create policy "Users insert their own Synapse action logs"
  on public.synapse_action_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read their own Synapse action logs" on public.synapse_action_logs;
create policy "Users read their own Synapse action logs"
  on public.synapse_action_logs
  for select
  to authenticated
  using (auth.uid() = user_id);
