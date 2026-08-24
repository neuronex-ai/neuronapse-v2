-- Remove definitive legacy schema from Focus NFe and monthly clinical reports.
-- Current fiscal provider is Asaas BaaS v3 / NeuroFinance.

do $$
begin
  if to_regclass('public.communication_templates') is not null then
    delete from public.communication_templates
    where template_key in ('monthly_report', 'monthly_report_config');
  end if;
end $$;

drop table if exists public.monthly_report_settings cascade;
drop table if exists public.generated_reports cascade;

drop function if exists public.touch_monthly_report_settings_updated_at() cascade;

alter table if exists public.invoices
  drop column if exists focus_nfe_ref,
  drop column if exists focus_nfe_status,
  drop column if exists focus_nfe_url;

alter table if exists public.invoice_automation
  drop column if exists focus_customer_id;

alter table if exists public.user_fiscal_settings
  drop column if exists focus_nfe_api_key,
  drop column if exists focus_nfe_environment;

alter table if exists public.user_notification_settings
  drop column if exists email_monthly_reports;

comment on table public.user_fiscal_settings is
  'Fiscal settings for NeuroFinance/Asaas NFS-e issuance. Focus NFe fields were removed as legacy.';
