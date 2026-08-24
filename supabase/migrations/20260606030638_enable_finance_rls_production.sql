-- Turn the existing ownership policies into effective protections before launch.
-- Service-role Edge Functions continue to bypass RLS, while browser clients are
-- limited to their own financial records.

alter table public.financial_accounts enable row level security;
alter table public.nb_payments enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users can only update their own transactions"
  on public.transactions
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.financial_accounts is
  'NeuroFinance account records protected by per-user RLS; provider synchronization runs through service-role Edge Functions.';

comment on table public.nb_payments is
  'NeuroFinance payment records protected by per-user RLS.';
