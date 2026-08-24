-- These notification emitters are intentionally callable from public token
-- flows. Their bodies validate appointment/anamnesis tokens before emitting a
-- professional notification, and their search_path is pinned by the previous
-- hardening migration.

revoke execute on function public.emit_public_appointment_notification(uuid, text, text) from public;
grant execute on function public.emit_public_appointment_notification(uuid, text, text) to anon, authenticated, service_role;

revoke execute on function public.emit_public_anamnesis_notification(uuid, text, integer) from public;
grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer) to anon, authenticated, service_role;
