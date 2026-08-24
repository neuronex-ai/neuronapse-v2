alter table public.neuro_flows
  add column if not exists workflow jsonb not null default '{"schema":"neuroflow.workflow.v2","nodes":[],"edges":[],"viewport":{},"metadata":{},"links":[]}'::jsonb,
  add column if not exists workflow_schema_version text not null default 'neuroflow.workflow.v2',
  add column if not exists save_revision integer not null default 0,
  add column if not exists last_saved_at timestamptz,
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_template boolean not null default false,
  add column if not exists patient_id uuid references public.patients(id) on delete set null;

create index if not exists neuro_flows_user_updated_idx
  on public.neuro_flows(user_id, updated_at desc);

create index if not exists neuro_flows_user_patient_idx
  on public.neuro_flows(user_id, patient_id)
  where patient_id is not null;

update public.neuro_flows
set
  tags = coalesce(tags, '{}'::text[]),
  is_template = coalesce(is_template, false);

alter table public.neuro_flows
  alter column tags set default '{}'::text[],
  alter column tags set not null,
  alter column is_template set default false,
  alter column is_template set not null;

create table if not exists public.neuro_pulse_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.flow_nodes') is not null
    and to_regclass('public.flow_edges') is not null
  then
    execute $sql$
      with flow_table_nodes as (
        select
          fn.flow_id,
          jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'id', fn.id,
              'type', coalesce(fn.type, 'item'),
              'position', jsonb_build_object('x', fn.x, 'y', fn.y),
              'width', fn.width,
              'height', fn.height,
              'data', coalesce(fn.content, '{}'::jsonb) || jsonb_build_object('label', coalesce(fn.label, fn.content->>'label', 'Sem titulo'))
            ))
            order by fn.created_at, fn.id
          ) as nodes
        from public.flow_nodes fn
        group by fn.flow_id
      ),
      flow_table_edges as (
        select
          fe.flow_id,
          jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'id', fe.id,
              'source', fe.source_id,
              'target', fe.target_id,
              'type', coalesce(fe.type, 'neural'),
              'label', fe.label,
              'animated', true,
              'data', jsonb_strip_nulls(jsonb_build_object('relation', fe.label))
            ))
            order by fe.created_at, fe.id
          ) as edges
        from public.flow_edges fe
        group by fe.flow_id
      )
      update public.neuro_flows nf
      set
        workflow = jsonb_build_object(
          'schema', 'neuroflow.workflow.v2',
          'nodes', coalesce(ftn.nodes, '[]'::jsonb),
          'edges', coalesce(fte.edges, '[]'::jsonb),
          'viewport', '{}'::jsonb,
          'metadata', jsonb_strip_nulls(jsonb_build_object(
            'title', nf.title,
            'patientId', nf.patient_id,
            'ownerScope', case when nf.patient_id is null then 'none' else 'patient' end,
            'updatedAt', coalesce(nf.updated_at, now())
          )),
          'links', '[]'::jsonb
        ),
        workflow_schema_version = 'neuroflow.workflow.v2',
        last_saved_at = coalesce(nf.last_saved_at, nf.updated_at, now())
      from flow_table_nodes ftn
      full outer join flow_table_edges fte on fte.flow_id = ftn.flow_id
      where nf.id = coalesce(ftn.flow_id, fte.flow_id)
        and (
          jsonb_array_length(coalesce(ftn.nodes, '[]'::jsonb)) > 0
          or jsonb_array_length(coalesce(fte.edges, '[]'::jsonb)) > 0
        );
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'neuro_flows'
      and column_name in ('nodes', 'edges', 'viewport')
  )
  then
    execute $sql$
      update public.neuro_flows nf
      set
        workflow = jsonb_build_object(
          'schema', 'neuroflow.workflow.v2',
          'nodes', coalesce(nf.nodes, '[]'::jsonb),
          'edges', coalesce(nf.edges, '[]'::jsonb),
          'viewport', coalesce(nf.viewport, '{}'::jsonb),
          'metadata', jsonb_strip_nulls(jsonb_build_object(
            'title', nf.title,
            'patientId', nf.patient_id,
            'ownerScope', case when nf.patient_id is null then 'none' else 'patient' end,
            'updatedAt', coalesce(nf.updated_at, now())
          )),
          'links', '[]'::jsonb
        ),
        workflow_schema_version = 'neuroflow.workflow.v2',
        last_saved_at = coalesce(nf.last_saved_at, nf.updated_at, now())
      where nf.workflow = jsonb_build_object(
          'schema', 'neuroflow.workflow.v2',
          'nodes', '[]'::jsonb,
          'edges', '[]'::jsonb,
          'viewport', '{}'::jsonb,
          'metadata', '{}'::jsonb,
          'links', '[]'::jsonb
        )
        and (
          jsonb_array_length(coalesce(nf.nodes, '[]'::jsonb)) > 0
          or jsonb_array_length(coalesce(nf.edges, '[]'::jsonb)) > 0
        );
    $sql$;
  end if;
end $$;

alter table public.neuro_flows enable row level security;

drop policy if exists "Users can view own flows" on public.neuro_flows;
create policy "Users can view own flows"
  on public.neuro_flows for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own flows" on public.neuro_flows;
create policy "Users can insert own flows"
  on public.neuro_flows for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own flows" on public.neuro_flows;
create policy "Users can update own flows"
  on public.neuro_flows for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own flows" on public.neuro_flows;
create policy "Users can delete own flows"
  on public.neuro_flows for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.neuro_flows to authenticated;

alter table public.neuro_pulse_entries enable row level security;

drop policy if exists "Users can view own pulse entries" on public.neuro_pulse_entries;
create policy "Users can view own pulse entries"
  on public.neuro_pulse_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own pulse entries" on public.neuro_pulse_entries;
create policy "Users can insert own pulse entries"
  on public.neuro_pulse_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own pulse entries" on public.neuro_pulse_entries;
create policy "Users can update own pulse entries"
  on public.neuro_pulse_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own pulse entries" on public.neuro_pulse_entries;
create policy "Users can delete own pulse entries"
  on public.neuro_pulse_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.neuro_pulse_entries to authenticated;

create or replace function public.save_neuroflow_workflow(
  p_flow_id uuid,
  p_workflow jsonb,
  p_expected_revision integer default null
)
returns table (
  id uuid,
  save_revision integer,
  last_saved_at timestamptz,
  workflow jsonb
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_revision integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if coalesce(p_workflow->>'schema', '') <> 'neuroflow.workflow.v2' then
    raise exception 'invalid_neuroflow_schema' using errcode = '22023';
  end if;

  select nf.save_revision
    into v_current_revision
  from public.neuro_flows nf
  where nf.id = p_flow_id
    and nf.user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'flow_not_found' using errcode = 'P0002';
  end if;

  if p_expected_revision is not null and v_current_revision <> p_expected_revision then
    raise exception 'save_conflict' using errcode = '40001';
  end if;

  return query
  update public.neuro_flows nf
  set
    workflow = p_workflow,
    workflow_schema_version = p_workflow->>'schema',
    save_revision = nf.save_revision + 1,
    last_saved_at = now(),
    updated_at = now()
  where nf.id = p_flow_id
    and nf.user_id = (select auth.uid())
  returning nf.id, nf.save_revision, nf.last_saved_at, nf.workflow;
end;
$$;

revoke all on function public.save_neuroflow_workflow(uuid, jsonb, integer) from public;
grant execute on function public.save_neuroflow_workflow(uuid, jsonb, integer) to authenticated;

comment on column public.neuro_flows.workflow is
  'Fonte de verdade versionada do NeuroFlow Studio. Contem nodes, edges, viewport, metadata e links.';

comment on function public.save_neuroflow_workflow(uuid, jsonb, integer) is
  'Salva workflow NeuroFlow v2 em operacao atomica, com RLS e controle otimista por save_revision.';

drop table if exists public.flow_edges;
drop table if exists public.flow_nodes;

alter table public.neuro_flows
  drop column if exists nodes,
  drop column if exists edges,
  drop column if exists viewport;
