-- Durable conversational context for Synapse across desktop and mobile.
-- Additive only: existing chat sessions and message history remain untouched.

alter table public.chat_sessions
  add column if not exists context_state jsonb not null default '{}'::jsonb,
  add column if not exists memory_summary text,
  add column if not exists memory_updated_at timestamptz;

comment on column public.chat_sessions.context_state is
  'Server-owned Synapse entity context such as the active patient, appointment, charge and fiscal invoice. Internal identifiers must never be rendered to users.';

comment on column public.chat_sessions.memory_summary is
  'Compact rolling summary used when a Synapse conversation grows beyond the recent-message window.';

create index if not exists idx_chat_sessions_user_updated_at
  on public.chat_sessions (user_id, updated_at desc);
