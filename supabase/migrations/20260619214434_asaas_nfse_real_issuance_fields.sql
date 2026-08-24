-- NeuroFinance Asaas NFS-e: persist real issuance state from subaccounts.

alter table if exists public.user_fiscal_settings
  add column if not exists fiscal_email text,
  add column if not exists simples_nacional boolean not null default true,
  add column if not exists cultural_projects_promoter boolean not null default false,
  add column if not exists cnae text,
  add column if not exists special_tax_regime text,
  add column if not exists service_list_item text,
  add column if not exists nbs_code text,
  add column if not exists retain_iss boolean not null default false,
  add column if not exists pis_aliquot numeric(8,4) not null default 0,
  add column if not exists cofins_aliquot numeric(8,4) not null default 0,
  add column if not exists csll_aliquot numeric(8,4) not null default 0,
  add column if not exists inss_aliquot numeric(8,4) not null default 0,
  add column if not exists ir_aliquot numeric(8,4) not null default 0,
  add column if not exists asaas_fiscal_info jsonb not null default '{}'::jsonb,
  add column if not exists asaas_municipal_options jsonb not null default '{}'::jsonb;

alter table if exists public.invoices
  add column if not exists nfse_number text,
  add column if not exists nfse_verification_code text,
  add column if not exists nfse_pdf_url text,
  add column if not exists nfse_xml_url text,
  add column if not exists nfse_status_description text,
  add column if not exists nfse_payload jsonb not null default '{}'::jsonb,
  add column if not exists nfse_authorized_at timestamptz,
  add column if not exists nfse_synced_at timestamptz,
  add column if not exists nfse_error_message text;

alter table if exists public.nb_payments
  add column if not exists nfse_provider text not null default 'asaas',
  add column if not exists nfse_reference text,
  add column if not exists nfse_status text,
  add column if not exists nfse_number text,
  add column if not exists nfse_verification_code text,
  add column if not exists nfse_pdf_url text,
  add column if not exists nfse_xml_url text,
  add column if not exists nfse_status_description text,
  add column if not exists nfse_payload jsonb not null default '{}'::jsonb,
  add column if not exists nfse_authorized_at timestamptz,
  add column if not exists nfse_synced_at timestamptz,
  add column if not exists nfse_error_message text;

do $$
begin
  if to_regclass('public.invoices') is not null then
    create index if not exists idx_invoices_nfse_reference
      on public.invoices(nfse_reference)
      where nfse_reference is not null;
  end if;

  if to_regclass('public.nb_payments') is not null then
    create index if not exists idx_nb_payments_nfse_reference
      on public.nb_payments(nfse_reference)
      where nfse_reference is not null;
  end if;
end $$;

comment on column public.user_fiscal_settings.asaas_fiscal_info is
  'Last sanitized fiscalInfo response returned by Asaas for the NeuroFinance subaccount.';

comment on column public.nb_payments.nfse_reference is
  'Asaas NFS-e identifier (inv_*) linked to this NeuroFinance charge.';
