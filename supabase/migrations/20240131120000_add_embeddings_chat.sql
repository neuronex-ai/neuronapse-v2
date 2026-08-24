-- Enable the vector extension for embeddings
create extension if not exists vector with schema extensions;

-- Add user_id to messages for easier RLS and efficient filtering (Denormalization)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'messages' and column_name = 'user_id') then
    alter table public.messages add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- Backfill user_id for existing messages (if any)
update public.messages m
set user_id = cs.user_id
from public.chat_sessions cs
where m.session_id = cs.id
and m.user_id is null;

-- Make user_id not null now that we backfilled
alter table public.messages alter column user_id set not null;

-- Add embedding column
alter table public.messages 
add column if not exists embedding vector(768);

-- Create index for faster querying
create index if not exists messages_embedding_idx on public.messages using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to match relevant messages (Semantic Search)
create or replace function match_messages_gemini (
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
as $$
begin
  return query
  select
    messages.id,
    messages.content,
    messages.role,
    1 - (messages.embedding <=> query_embedding) as similarity,
    messages.created_at
  from messages
  where 1 - (messages.embedding <=> query_embedding) > match_threshold
  and messages.user_id = auth.uid() -- Strict isolation by User ID
  order by messages.embedding <=> query_embedding
  limit match_count;
end;
$$;
