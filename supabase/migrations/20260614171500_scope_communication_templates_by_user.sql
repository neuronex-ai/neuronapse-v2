-- Scope communication template keys by owner.
-- The frontend upserts on (user_id, template_key); a global unique constraint
-- on template_key prevented different professionals from saving the same
-- template type.

begin;

alter table public.communication_templates
  drop constraint if exists communication_templates_template_key_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.communication_templates'::regclass
      and conname = 'communication_templates_user_template_key_key'
  ) then
    alter table public.communication_templates
      add constraint communication_templates_user_template_key_key
      unique (user_id, template_key);
  end if;
end
$$;

commit;
