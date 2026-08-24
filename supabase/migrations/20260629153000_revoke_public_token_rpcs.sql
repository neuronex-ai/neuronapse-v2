-- Public token workflows now go through Edge Functions that validate tokens
-- before using service-role-only notification helpers.

revoke execute on function public.get_public_anamnesis(uuid, text)
from public, anon, authenticated;

grant execute on function public.get_public_anamnesis(uuid, text)
to service_role;

revoke execute on function public.update_public_anamnesis(uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.update_public_anamnesis(uuid, text, jsonb)
to service_role;

revoke execute on function public.emit_public_anamnesis_notification(uuid, text, integer)
from public, anon, authenticated;

grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer)
to service_role;

revoke execute on function public.emit_public_appointment_notification(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.emit_public_appointment_notification(uuid, text, text)
to service_role;
