-- Tighten SECURITY DEFINER execution grants that were still inherited through
-- PUBLIC. Keep public-token RPCs callable by anon/authenticated explicitly.

do $$
begin
  if to_regprocedure('app_core.emit_event(text,jsonb)') is not null then
    execute 'alter function app_core.emit_event(text, jsonb) set search_path = app_core, pg_temp';
    execute 'revoke execute on function app_core.emit_event(text, jsonb) from public, anon, authenticated';
    execute 'grant execute on function app_core.emit_event(text, jsonb) to service_role';
  end if;

  if to_regprocedure('public.get_public_anamnesis(uuid,text)') is not null then
    execute 'revoke execute on function public.get_public_anamnesis(uuid, text) from public';
    execute 'grant execute on function public.get_public_anamnesis(uuid, text) to anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.update_public_anamnesis(uuid,text,jsonb)') is not null then
    execute 'revoke execute on function public.update_public_anamnesis(uuid, text, jsonb) from public';
    execute 'grant execute on function public.update_public_anamnesis(uuid, text, jsonb) to anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.emit_public_anamnesis_notification(uuid,text,integer)') is not null then
    execute 'revoke execute on function public.emit_public_anamnesis_notification(uuid, text, integer) from public';
    execute 'grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer) to anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.emit_public_appointment_notification(uuid,text,text)') is not null then
    execute 'revoke execute on function public.emit_public_appointment_notification(uuid, text, text) from public';
    execute 'grant execute on function public.emit_public_appointment_notification(uuid, text, text) to anon, authenticated, service_role';
  end if;
end $$;
