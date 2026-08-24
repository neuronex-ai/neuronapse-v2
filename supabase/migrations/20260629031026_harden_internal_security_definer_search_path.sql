-- The public notification emitters are helpers called by trusted database
-- flows. They should not be callable as public RPC endpoints.

revoke execute on function public.emit_public_appointment_notification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.emit_public_appointment_notification(uuid, text, text) to service_role;

revoke execute on function public.emit_public_anamnesis_notification(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.emit_public_anamnesis_notification(uuid, text, integer) to service_role;

-- Pin search_path for SECURITY DEFINER/internal helpers so names resolve in a
-- predictable schema instead of through a caller-controlled search path.

alter function public.auto_recalculate_balance()
set search_path = public, pg_temp;

alter function public.emit_appointment_notification_after_update()
set search_path = public, pg_temp;

alter function public.emit_financial_entry_notification()
set search_path = public, pg_temp;

alter function public.emit_neurofinance_payment_notification()
set search_path = public, pg_temp;

alter function public.emit_public_anamnesis_notification(uuid, text, integer)
set search_path = public, pg_temp;

alter function public.emit_public_appointment_notification(uuid, text, text)
set search_path = public, pg_temp;

alter function public.emit_session_note_review_notification()
set search_path = public, pg_temp;

alter function public.emit_user_notification(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  uuid
)
set search_path = public, pg_temp;

alter function public.get_public_anamnesis(uuid, text)
set search_path = public, pg_temp;

alter function public.is_admin()
set search_path = public, pg_temp;

alter function public.mark_all_notifications_as_read()
set search_path = public, pg_temp;

alter function public.mark_notification_as_read(uuid)
set search_path = public, pg_temp;

alter function public.sync_package_sessions()
set search_path = public, pg_temp;

alter function public.trigger_refresh_neurofinance_overview()
set search_path = public, pg_temp;

alter function public.trigger_webhook(text, jsonb)
set search_path = public, pg_temp;

alter function public.update_public_anamnesis(uuid, text, jsonb)
set search_path = public, pg_temp;

alter function public.verify_financial_pin(text)
set search_path = public, pg_temp;
