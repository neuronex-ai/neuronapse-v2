update public.neuro_flows
set
  tags = coalesce(tags, '{}'::text[]),
  is_template = coalesce(is_template, false);

alter table public.neuro_flows
  alter column tags set default '{}'::text[],
  alter column tags set not null,
  alter column is_template set default false,
  alter column is_template set not null;
