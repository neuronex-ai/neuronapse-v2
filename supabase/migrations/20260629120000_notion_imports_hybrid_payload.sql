alter table public.notion_imports
  add column if not exists raw_page jsonb,
  add column if not exists raw_blocks jsonb,
  add column if not exists unsupported_blocks jsonb not null default '[]'::jsonb,
  add column if not exists api_version text,
  add column if not exists render_version text,
  add column if not exists source_meta jsonb not null default '{}'::jsonb;

comment on column public.notion_imports.raw_page is
  'Payload bruto da pagina do Notion retornado por /pages/{page_id}.';

comment on column public.notion_imports.raw_blocks is
  'Arvore bruta de blocos do Notion usada na ultima importacao.';

comment on column public.notion_imports.unsupported_blocks is
  'Diagnostico de blocos convertidos como fallback ou nao suportados pelo renderer atual.';

comment on column public.notion_imports.api_version is
  'Versao do header Notion-Version usada para buscar o payload.';

comment on column public.notion_imports.render_version is
  'Versao interna do conversor Notion para HTML do editor.';

comment on column public.notion_imports.source_meta is
  'Metadados de origem da importacao para rastreio e reprocessamento.';

grant select, delete on public.notion_imports to authenticated;
revoke insert, update on public.notion_imports from anon, authenticated;
revoke truncate, references, trigger on public.notion_imports from anon, authenticated;
