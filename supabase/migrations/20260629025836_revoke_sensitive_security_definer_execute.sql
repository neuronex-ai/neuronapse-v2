-- Hardening pass for SECURITY DEFINER routines in public.
--
-- These routines are internal trigger/service helpers. They should not be
-- directly callable by anon/authenticated users because SECURITY DEFINER
-- bypasses the caller's RLS privileges.

revoke execute on function public.auto_recalculate_balance() from public, anon, authenticated;
grant execute on function public.auto_recalculate_balance() to service_role;

revoke execute on function public.emit_appointment_notification_after_update() from public, anon, authenticated;
grant execute on function public.emit_appointment_notification_after_update() to service_role;

revoke execute on function public.emit_financial_entry_notification() from public, anon, authenticated;
grant execute on function public.emit_financial_entry_notification() to service_role;

revoke execute on function public.emit_neurofinance_payment_notification() from public, anon, authenticated;
grant execute on function public.emit_neurofinance_payment_notification() to service_role;

revoke execute on function public.emit_session_note_review_notification() from public, anon, authenticated;
grant execute on function public.emit_session_note_review_notification() to service_role;

revoke execute on function public.emit_user_notification(
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
) from public, anon, authenticated;
grant execute on function public.emit_user_notification(
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
) to service_role;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to service_role;

revoke execute on function public.mark_all_notifications_as_read() from public, anon, authenticated;
grant execute on function public.mark_all_notifications_as_read() to service_role;

revoke execute on function public.mark_notification_as_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_as_read(uuid) to service_role;

revoke execute on function public.sync_package_sessions() from public, anon, authenticated;
grant execute on function public.sync_package_sessions() to service_role;

revoke execute on function public.trigger_refresh_neurofinance_overview() from public, anon, authenticated;
grant execute on function public.trigger_refresh_neurofinance_overview() to service_role;

revoke execute on function public.trigger_webhook(text, jsonb) from public, anon, authenticated;
grant execute on function public.trigger_webhook(text, jsonb) to service_role;

revoke execute on function public.verify_financial_pin(text) from public, anon, authenticated;
grant execute on function public.verify_financial_pin(text) to service_role;
