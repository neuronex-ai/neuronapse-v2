-- NeuroFinance read model for instant overview values.
-- The provider remains authoritative for the available balance. Payments,
-- payouts and movements explain the other totals without using ledger_*.

create table if not exists public.neurofinance_tariff_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null,
  operation text not null,
  payment_method text,
  channel text not null default 'online',
  installment_min integer,
  installment_max integer,
  percent_rate numeric(8,4),
  fixed_fee_cents integer,
  free_monthly_quota integer,
  settlement_delay_days integer,
  settlement_business_days boolean not null default false,
  display_name text not null,
  description text,
  price_label text,
  settlement_label text,
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.neurofinance_tariff_rules enable row level security;

drop policy if exists "Authenticated users read NeuroFinance tariffs"
  on public.neurofinance_tariff_rules;
create policy "Authenticated users read NeuroFinance tariffs"
  on public.neurofinance_tariff_rules for select
  to authenticated
  using (true);

grant select on public.neurofinance_tariff_rules to authenticated;

insert into public.neurofinance_tariff_rules (
  code, category, operation, payment_method, channel,
  installment_min, installment_max, percent_rate, fixed_fee_cents,
  free_monthly_quota, settlement_delay_days, settlement_business_days,
  display_name, description, price_label, settlement_label,
  effective_from, display_order, metadata
)
values
  ('receive_boleto', 'Receber', 'charge', 'boleto', 'online', null, null, null, 199, null, 1, true,
   'Boleto bancário', 'Cobrança por boleto, cobrada somente quando o pagamento é recebido.', 'R$ 1,99 por boleto pago', 'Disponível em 1 dia útil', '2026-06-06', 10, '{}'::jsonb),
  ('receive_pix_dynamic', 'Receber', 'charge', 'pix', 'dynamic', null, null, null, 199, null, 0, false,
   'Pix na cobrança', 'Pix gerado dentro de uma cobrança.', 'R$ 1,99 por recebimento', 'Disponível em poucos segundos', '2026-06-06', 20, '{}'::jsonb),
  ('receive_pix', 'Receber', 'pix_receive', 'pix', 'standard', null, null, null, 199, 100, 0, false,
   'Receber por Pix', 'Recebimentos por chave, QR Code ou Pix manual.', '100 recebimentos gratuitos por mês; depois R$ 1,99', 'Disponível em poucos segundos', '2026-06-06', 30, '{}'::jsonb),
  ('credit_online_1', 'Cartões', 'charge', 'card', 'online', 1, 1, 2.9900, 49, null, 32, false,
   'Crédito à vista', 'Pagamento online em uma parcela.', '2,99% + R$ 0,49', 'Disponível em 32 dias', '2026-06-06', 40, '{}'::jsonb),
  ('credit_online_2_6', 'Cartões', 'charge', 'card', 'online', 2, 6, 3.4900, 49, null, 32, false,
   'Crédito de 2 a 6 parcelas', 'Pagamento online parcelado.', '3,49% + R$ 0,49', 'Disponível em 32 dias', '2026-06-06', 50, '{}'::jsonb),
  ('credit_online_7_12', 'Cartões', 'charge', 'card', 'online', 7, 12, 3.9900, 49, null, 32, false,
   'Crédito de 7 a 12 parcelas', 'Pagamento online parcelado.', '3,99% + R$ 0,49', 'Disponível em 32 dias', '2026-06-06', 60, '{}'::jsonb),
  ('credit_online_13_21', 'Cartões', 'charge', 'card', 'online', 13, 21, 4.2900, 49, null, 32, false,
   'Crédito de 13 a 21 parcelas', 'Pagamento online parcelado.', '4,29% + R$ 0,49', 'Disponível em 32 dias', '2026-06-06', 70, '{}'::jsonb),
  ('debit_online', 'Cartões', 'charge', 'debit', 'online', 1, 1, 1.8900, 35, null, 3, false,
   'Cartão de débito', 'Pagamento online no débito.', '1,89% + R$ 0,35', 'Disponível em 3 dias', '2026-06-06', 80, '{}'::jsonb),
  ('voucher_online', 'Cartões', 'charge', 'voucher', 'online', 1, 1, null, null, null, 15, false,
   'Cartão voucher', 'A tarifa depende das condições disponíveis para a conta.', 'Consulte as condições', 'Disponível em 15 dias', '2026-06-06', 90, '{"estimate_available": false}'::jsonb),
  ('transfer_bank', 'Movimentar', 'transfer', null, 'bank', null, null, null, 500, null, 0, false,
   'Transferência bancária', 'Envio para uma conta bancária externa.', 'R$ 5,00 por transferência', 'No mesmo dia quando autorizada até 15h', '2026-06-06', 100, '{}'::jsonb),
  ('transfer_pix', 'Movimentar', 'pix_transfer', 'pix', 'standard', null, null, null, 200, 30, 0, false,
   'Transferir por Pix', 'Envio para outra conta por chave ou QR Code.', '30 transferências gratuitas por mês; depois R$ 2,00', 'Processamento imediato', '2026-06-06', 110, '{}'::jsonb),
  ('bill_payment', 'Movimentar', 'bill_payment', null, 'online', null, null, null, 0, null, 0, false,
   'Pagar contas', 'Pagamento de contas de consumo e boletos.', 'Gratuito', 'Conforme o vencimento', '2026-06-06', 120, '{}'::jsonb),
  ('anticipation_boleto', 'Antecipar', 'anticipation', 'boleto', 'online', null, null, 5.7900, 0, null, 3, true,
   'Antecipar boleto', 'Receba antes um boleto elegível.', 'A partir de 5,79% ao mês', 'Em até 3 dias úteis, após análise', '2026-06-06', 130, '{"monthly_rate": true}'::jsonb),
  ('anticipation_pix', 'Antecipar', 'anticipation', 'pix', 'online', null, null, 5.7900, 0, null, 3, true,
   'Antecipar Pix', 'Receba antes um Pix elegível.', 'A partir de 5,79% ao mês', 'Em até 3 dias úteis, após análise', '2026-06-06', 140, '{"monthly_rate": true}'::jsonb),
  ('nfse', 'Serviços adicionais', 'nfse', null, 'online', null, null, null, 49, null, 0, false,
   'Emitir NFS-e', 'Emissão de nota fiscal de serviço.', 'R$ 0,49 por nota emitida', 'Emissão após confirmação', '2026-06-06', 150, '{}'::jsonb),
  ('notification_whatsapp', 'Serviços adicionais', 'notification', null, 'whatsapp', null, null, null, 55, null, 0, false,
   'Lembrete por WhatsApp', 'Envio de lembrete de cobrança.', 'R$ 0,55 por mensagem', 'Envio imediato', '2026-06-06', 160, '{}'::jsonb),
  ('notification_email_sms', 'Serviços adicionais', 'notification', null, 'email_sms', null, null, null, 99, null, 0, false,
   'Lembrete por e-mail e SMS', 'Envio combinado de lembrete de cobrança.', 'R$ 0,99 por envio', 'Envio imediato', '2026-06-06', 170, '{}'::jsonb)
on conflict (code) do update set
  category = excluded.category,
  operation = excluded.operation,
  payment_method = excluded.payment_method,
  channel = excluded.channel,
  installment_min = excluded.installment_min,
  installment_max = excluded.installment_max,
  percent_rate = excluded.percent_rate,
  fixed_fee_cents = excluded.fixed_fee_cents,
  free_monthly_quota = excluded.free_monthly_quota,
  settlement_delay_days = excluded.settlement_delay_days,
  settlement_business_days = excluded.settlement_business_days,
  display_name = excluded.display_name,
  description = excluded.description,
  price_label = excluded.price_label,
  settlement_label = excluded.settlement_label,
  active = true,
  display_order = excluded.display_order,
  metadata = excluded.metadata,
  updated_at = now();

alter table public.nb_payments
  add column if not exists provider_status text,
  add column if not exists normalized_status text not null default 'pending',
  add column if not exists funds_status text not null default 'pending',
  add column if not exists installments integer not null default 1,
  add column if not exists channel text not null default 'online',
  add column if not exists fee_rule_id uuid references public.neurofinance_tariff_rules(id) on delete set null,
  add column if not exists estimated_fee_amount integer,
  add column if not exists actual_fee_amount integer,
  add column if not exists confirmed_at timestamptz,
  add column if not exists available_at timestamptz,
  add column if not exists estimated_credit_at timestamptz,
  add column if not exists reconciliation_status text not null default 'unverified',
  add column if not exists reconciled_at timestamptz;

alter table public.nb_payouts
  add column if not exists provider_payout_id text,
  add column if not exists provider_status text,
  add column if not exists operation_type text not null default 'transfer',
  add column if not exists fee_amount integer,
  add column if not exists completed_at timestamptz,
  add column if not exists reconciliation_status text not null default 'unverified',
  add column if not exists reconciled_at timestamptz;

update public.nb_payments
set provider_payment_id = coalesce(
  provider_payment_id,
  nullif(metadata->>'asaas_payment_id', ''),
  nullif(metadata->>'payment_id', '')
)
where provider_payment_id is null
  and coalesce(
    nullif(metadata->>'asaas_payment_id', ''),
    nullif(metadata->>'payment_id', '')
  ) is not null;

update public.nb_payments
set payment_method_type = case upper(coalesce(payment_method_type, ''))
  when 'PIX' then 'pix'
  when 'BOLETO' then 'boleto'
  when 'CREDIT_CARD' then 'card'
  when 'CARD' then 'card'
  when 'DEBIT_CARD' then 'debit'
  when 'DEBIT' then 'debit'
  when 'UNDEFINED' then null
  else nullif(lower(payment_method_type), '')
end;

create unique index if not exists idx_nb_payments_provider_payment_unique
  on public.nb_payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists idx_nb_payouts_provider_payout_unique
  on public.nb_payouts(provider, provider_payout_id)
  where provider_payout_id is not null;

update public.nb_payments
set
  payment_method_type = coalesce(
    payment_method_type,
    case upper(coalesce(metadata->>'billing_type', metadata->>'asaas_billing_type', ''))
      when 'PIX' then 'pix'
      when 'BOLETO' then 'boleto'
      when 'CREDIT_CARD' then 'card'
      when 'DEBIT_CARD' then 'debit'
      else null
    end
  ),
  provider_status = coalesce(provider_status, upper(metadata->>'asaas_status')),
  normalized_status = case
    when status = 'paid' then 'paid'
    when status = 'expired' then 'overdue'
    when status in ('canceled', 'refunded', 'failed', 'processing') then status
    else 'pending'
  end,
  funds_status = case
    when status = 'paid' then 'available'
    when status = 'refunded' then 'refunded'
    when status = 'expired' then 'overdue'
    when status in ('canceled', 'failed') then status
    else 'pending'
  end,
  installments = greatest(
    case
      when coalesce(metadata->>'installment_count', '') ~ '^[0-9]+$'
        then (metadata->>'installment_count')::integer
      else 1
    end,
    1
  ),
  actual_fee_amount = case
    when status = 'paid' and gross_amount >= net_amount then gross_amount - net_amount
    else actual_fee_amount
  end,
  reconciliation_status = case when status = 'paid' then 'legacy' else reconciliation_status end;

update public.nb_payments p
set
  fee_rule_id = r.id,
  estimated_fee_amount = case
    when r.percent_rate is null and r.fixed_fee_cents is null then null
    else round(p.gross_amount * coalesce(r.percent_rate, 0) / 100.0)::integer
      + coalesce(r.fixed_fee_cents, 0)
  end
from public.neurofinance_tariff_rules r
where p.fee_rule_id is null
  and r.active
  and r.operation = 'charge'
  and r.payment_method = p.payment_method_type
  and r.channel = p.channel
  and p.installments between coalesce(r.installment_min, p.installments)
    and coalesce(r.installment_max, p.installments);

create table if not exists public.neurofinance_account_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  provider text not null default 'asaas',
  provider_movement_id text,
  movement_type text not null,
  direction text not null check (direction in ('credit', 'debit')),
  status text not null default 'posted',
  amount integer not null check (amount >= 0),
  currency text not null default 'brl',
  description text,
  reference_type text,
  reference_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_neurofinance_movements_provider_id
  on public.neurofinance_account_movements(financial_account_id, provider_movement_id);
create unique index if not exists idx_neurofinance_movements_reference
  on public.neurofinance_account_movements(financial_account_id, movement_type, reference_id);
create index if not exists idx_neurofinance_movements_user_occurred
  on public.neurofinance_account_movements(user_id, occurred_at desc);

alter table public.neurofinance_account_movements enable row level security;
drop policy if exists "Users read own NeuroFinance movements"
  on public.neurofinance_account_movements;
create policy "Users read own NeuroFinance movements"
  on public.neurofinance_account_movements for select
  to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.neurofinance_account_movements to authenticated;

create table if not exists public.neurofinance_overview_snapshots (
  financial_account_id uuid primary key references public.financial_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  available_balance integer not null default 0,
  gross_received integer not null default 0,
  pending_receivables integer not null default 0,
  total_outflow integer not null default 0,
  fees_total integer not null default 0,
  calculated_available_balance integer not null default 0,
  reconciliation_difference integer not null default 0,
  currency text not null default 'brl',
  source text not null default 'database',
  provider_as_of timestamptz,
  last_reconciled_at timestamptz,
  last_sync_error text,
  is_stale boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_neurofinance_snapshots_user
  on public.neurofinance_overview_snapshots(user_id);

alter table public.neurofinance_overview_snapshots enable row level security;
drop policy if exists "Users read own NeuroFinance overview"
  on public.neurofinance_overview_snapshots;
create policy "Users read own NeuroFinance overview"
  on public.neurofinance_overview_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.neurofinance_overview_snapshots to authenticated;

create or replace function public.refresh_neurofinance_overview_snapshot(
  target_financial_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_user_id uuid;
  received_total integer;
  receivable_total integer;
  outflow_total integer;
  fee_total integer;
  current_available integer;
begin
  select fa.user_id
  into account_user_id
  from public.financial_accounts fa
  where fa.id = target_financial_account_id;

  if account_user_id is null then
    return;
  end if;

  select
    coalesce(sum(p.gross_amount) filter (
      where p.funds_status = 'available'
        and p.normalized_status = 'paid'
    ), 0),
    coalesce(sum(p.gross_amount) filter (
      where p.funds_status in ('pending', 'confirmed')
        and p.normalized_status in ('pending', 'processing', 'confirmed')
    ), 0)
  into received_total, receivable_total
  from public.nb_payments p
  where p.financial_account_id = target_financial_account_id;

  select
    coalesce(sum(m.amount) filter (
      where m.direction = 'debit' and m.status = 'posted'
    ), 0),
    coalesce(sum(m.amount) filter (
      where m.direction = 'debit'
        and m.status = 'posted'
        and m.movement_type in ('payment_fee', 'transfer_fee', 'service_fee')
    ), 0)
  into outflow_total, fee_total
  from public.neurofinance_account_movements m
  where m.financial_account_id = target_financial_account_id;

  select s.available_balance
  into current_available
  from public.neurofinance_overview_snapshots s
  where s.financial_account_id = target_financial_account_id;

  insert into public.neurofinance_overview_snapshots (
    financial_account_id,
    user_id,
    available_balance,
    gross_received,
    pending_receivables,
    total_outflow,
    fees_total,
    calculated_available_balance,
    reconciliation_difference,
    updated_at
  )
  values (
    target_financial_account_id,
    account_user_id,
    coalesce(current_available, 0),
    received_total,
    receivable_total,
    outflow_total,
    fee_total,
    greatest(received_total - outflow_total, 0),
    coalesce(current_available, 0) - greatest(received_total - outflow_total, 0),
    now()
  )
  on conflict (financial_account_id) do update set
    user_id = excluded.user_id,
    gross_received = excluded.gross_received,
    pending_receivables = excluded.pending_receivables,
    total_outflow = excluded.total_outflow,
    fees_total = excluded.fees_total,
    calculated_available_balance = excluded.calculated_available_balance,
    reconciliation_difference =
      public.neurofinance_overview_snapshots.available_balance
      - excluded.calculated_available_balance,
    updated_at = now();
end;
$$;

revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from public;
revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from anon;
revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from authenticated;
grant execute on function public.refresh_neurofinance_overview_snapshot(uuid) to service_role;

create or replace function public.trigger_refresh_neurofinance_overview()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_neurofinance_overview_snapshot(old.financial_account_id);
    return old;
  end if;

  perform public.refresh_neurofinance_overview_snapshot(new.financial_account_id);
  return new;
end;
$$;

revoke all on function public.trigger_refresh_neurofinance_overview() from public;

drop trigger if exists refresh_neurofinance_overview_on_payment on public.nb_payments;
create trigger refresh_neurofinance_overview_on_payment
after insert or update or delete on public.nb_payments
for each row execute function public.trigger_refresh_neurofinance_overview();

drop trigger if exists refresh_neurofinance_overview_on_payout on public.nb_payouts;
create trigger refresh_neurofinance_overview_on_payout
after insert or update or delete on public.nb_payouts
for each row execute function public.trigger_refresh_neurofinance_overview();

drop trigger if exists refresh_neurofinance_overview_on_movement
  on public.neurofinance_account_movements;
create trigger refresh_neurofinance_overview_on_movement
after insert or update or delete on public.neurofinance_account_movements
for each row execute function public.trigger_refresh_neurofinance_overview();

insert into public.neurofinance_account_movements (
  user_id, financial_account_id, movement_type, direction, status, amount,
  description, reference_type, reference_id, occurred_at, metadata
)
select
  p.user_id,
  p.financial_account_id,
  'payment_fee',
  'debit',
  'posted',
  coalesce(p.actual_fee_amount, greatest(p.gross_amount - p.net_amount, 0)),
  'Tarifa da cobrança',
  'payment',
  p.provider_payment_id,
  coalesce(p.available_at, p.paid_at, p.updated_at),
  jsonb_build_object('source', 'legacy_backfill')
from public.nb_payments p
where p.financial_account_id is not null
  and p.funds_status = 'available'
  and coalesce(p.actual_fee_amount, greatest(p.gross_amount - p.net_amount, 0)) > 0
  and p.provider_payment_id is not null
on conflict do nothing;

insert into public.neurofinance_account_movements (
  user_id, financial_account_id, movement_type, direction, status, amount,
  description, reference_type, reference_id, occurred_at, metadata
)
select
  po.user_id,
  po.financial_account_id,
  'transfer',
  'debit',
  'posted',
  po.amount,
  coalesce(po.destination_summary, 'Transferência concluída'),
  'payout',
  po.provider_payout_id,
  coalesce(po.completed_at, po.processed_at, po.updated_at),
  jsonb_build_object('source', 'legacy_backfill')
from public.nb_payouts po
where po.financial_account_id is not null
  and po.status = 'paid'
  and po.provider_payout_id is not null
on conflict do nothing;

insert into public.neurofinance_account_movements (
  user_id, financial_account_id, movement_type, direction, status, amount,
  description, reference_type, reference_id, occurred_at, metadata
)
select
  po.user_id,
  po.financial_account_id,
  'transfer_fee',
  'debit',
  'posted',
  po.fee_amount,
  'Tarifa da transferência',
  'payout',
  po.provider_payout_id,
  coalesce(po.completed_at, po.processed_at, po.updated_at),
  jsonb_build_object('source', 'legacy_backfill')
from public.nb_payouts po
where po.financial_account_id is not null
  and po.status = 'paid'
  and coalesce(po.fee_amount, 0) > 0
  and po.provider_payout_id is not null
on conflict do nothing;

insert into public.neurofinance_overview_snapshots (
  financial_account_id, user_id
)
select fa.id, fa.user_id
from public.financial_accounts fa
on conflict (financial_account_id) do nothing;

do $$
declare account_record record;
begin
  for account_record in select id from public.financial_accounts loop
    perform public.refresh_neurofinance_overview_snapshot(account_record.id);
  end loop;
end;
$$;

drop view if exists public.neurofinance_overview_snapshot_v;
create view public.neurofinance_overview_snapshot_v
with (security_invoker = true)
as
select
  s.financial_account_id,
  s.user_id,
  s.available_balance,
  s.gross_received,
  s.pending_receivables,
  s.total_outflow,
  s.fees_total,
  s.calculated_available_balance,
  s.reconciliation_difference,
  s.currency,
  s.source,
  s.provider_as_of,
  s.last_reconciled_at,
  s.last_sync_error,
  s.is_stale,
  s.metadata,
  s.updated_at
from public.neurofinance_overview_snapshots s;

drop view if exists public.neurofinance_overview_items_v;
create view public.neurofinance_overview_items_v
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.financial_account_id,
  'income'::text as overview_group,
  'payment'::text as item_type,
  coalesce(p.description, 'Cobrança recebida') as description,
  p.gross_amount as amount,
  p.currency,
  p.normalized_status as status,
  p.payment_method_type as payment_method,
  coalesce(p.available_at, p.paid_at, p.updated_at) as occurred_at,
  p.provider_payment_id as reference_id,
  patients.name as patient_name,
  jsonb_build_object(
    'gross_amount', p.gross_amount,
    'net_amount', p.net_amount,
    'actual_fee_amount', p.actual_fee_amount,
    'estimated_fee_amount', p.estimated_fee_amount,
    'reconciliation_status', p.reconciliation_status
  ) || coalesce(p.metadata, '{}'::jsonb) as metadata
from public.nb_payments p
left join public.patients on patients.id = p.patient_id
where p.funds_status = 'available'
  and p.normalized_status = 'paid'

union all

select
  p.id,
  p.user_id,
  p.financial_account_id,
  'receivable'::text,
  'payment'::text,
  coalesce(p.description, 'Cobrança a receber'),
  p.gross_amount,
  p.currency,
  p.normalized_status,
  p.payment_method_type,
  coalesce(p.estimated_credit_at, p.expires_at, p.updated_at),
  p.provider_payment_id,
  patients.name,
  jsonb_build_object(
    'estimated_fee_amount', p.estimated_fee_amount,
    'estimated_credit_at', p.estimated_credit_at,
    'reconciliation_status', p.reconciliation_status
  ) || coalesce(p.metadata, '{}'::jsonb)
from public.nb_payments p
left join public.patients on patients.id = p.patient_id
where p.funds_status in ('pending', 'confirmed')
  and p.normalized_status in ('pending', 'processing', 'confirmed')

union all

select
  m.id,
  m.user_id,
  m.financial_account_id,
  'outflow'::text,
  m.movement_type,
  coalesce(m.description, 'Saída da conta'),
  m.amount,
  m.currency,
  m.status,
  null::text,
  m.occurred_at,
  coalesce(m.reference_id, m.provider_movement_id),
  null::text,
  m.metadata
from public.neurofinance_account_movements m
where m.direction = 'debit'
  and m.status = 'posted';

grant select on public.neurofinance_overview_snapshot_v to authenticated;
grant select on public.neurofinance_overview_items_v to authenticated;

comment on table public.neurofinance_tariff_rules is
  'Versioned, read-only catalog of NeuroFinance customer-facing tariffs.';
comment on table public.neurofinance_account_movements is
  'Provider-backed account movements. This replaces ledger_* as the operational statement source.';
comment on table public.neurofinance_overview_snapshots is
  'Instant overview snapshot. Available balance is authoritative from the provider; other totals are locally explainable.';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'neurofinance_overview_snapshots'
  ) then
    alter publication supabase_realtime
      add table public.neurofinance_overview_snapshots;
  end if;
end;
$$;

create schema if not exists private;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.request_neurofinance_reconciliation(sync_mode text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'neurofinance_cron_secret'
  order by created_at desc
  limit 1;

  if cron_secret is null then
    raise warning 'NeuroFinance reconciliation secret is not configured.';
    return null;
  end if;

  select net.http_post(
    url := 'https://krewdaklcyzqfxkkgvqr.supabase.co/functions/v1/asaas-financial-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neurofinance-cron-secret', cron_secret
    ),
    body := jsonb_build_object('mode', sync_mode)
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.request_neurofinance_reconciliation(text) from public;
grant usage on schema private to service_role;
grant execute on function private.request_neurofinance_reconciliation(text) to service_role;

do $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'neurofinance-incremental-sync';
  if job_id is not null then perform cron.unschedule(job_id); end if;

  select jobid into job_id from cron.job where jobname = 'neurofinance-daily-full-sync';
  if job_id is not null then perform cron.unschedule(job_id); end if;

  perform cron.schedule(
    'neurofinance-incremental-sync',
    '*/10 * * * *',
    'select private.request_neurofinance_reconciliation(''incremental'');'
  );
  perform cron.schedule(
    'neurofinance-daily-full-sync',
    '15 3 * * *',
    'select private.request_neurofinance_reconciliation(''full'');'
  );
end;
$$;
