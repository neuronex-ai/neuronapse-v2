-- Clear stale Asaas sync errors for accounts that are already healthy again.
--
-- A successful provider sync can refresh financial_accounts while a previous
-- failure remains on neurofinance_overview_snapshots. The UI reads both, so an
-- old snapshot error can keep showing a "Sincronizacao Asaas" alert after the
-- account itself is active.

update public.financial_accounts fa
set
  metadata = jsonb_set(
    coalesce(fa.metadata, '{}'::jsonb),
    '{provider_connection}',
    (
      coalesce(fa.metadata -> 'provider_connection', '{}'::jsonb)
      || jsonb_build_object(
        'status', 'connected',
        'recovered_at', now(),
        'error_code', null,
        'error_message', null,
        'support_required', false
      )
    ),
    true
  ),
  updated_at = now()
where fa.provider = 'asaas'
  and fa.status <> 'account_missing'
  and fa.last_sync_error is null
  and coalesce(fa.metadata -> 'provider_connection' ->> 'status', '') in ('sync_failed', 'account_missing');

update public.neurofinance_overview_snapshots s
set
  is_stale = false,
  last_sync_error = null,
  updated_at = now()
from public.financial_accounts fa
where fa.id = s.financial_account_id
  and fa.provider = 'asaas'
  and fa.status <> 'account_missing'
  and fa.last_sync_error is null
  and s.last_sync_error is not null;
