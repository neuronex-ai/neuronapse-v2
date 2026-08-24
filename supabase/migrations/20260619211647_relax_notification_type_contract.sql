begin;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (length(btrim(type)) > 0);

notify pgrst, 'reload schema';

commit;
