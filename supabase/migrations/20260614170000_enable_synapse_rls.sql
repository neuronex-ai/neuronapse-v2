-- Re-enable row-level security on Synapse conversation tables.
-- The ownership policies already exist in production; these ALTER statements
-- make them effective again without changing application behavior for the
-- authenticated owner or service-role Edge Functions.

begin;

alter table public.history_conversation_psychology enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.synapse_channel_bindings enable row level security;

commit;
