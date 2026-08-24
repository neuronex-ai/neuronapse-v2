import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, isAfter, parseISO, startOfDay } from "date-fns";

import { useAuth } from "@/components/auth/SessionContextProvider";
import type { FinancialEntry, FinancialEntryStatus } from "@/hooks/use-financial-entries";
import { useNeuroFinanceBalanceDetails } from "@/hooks/use-neurofinance-balance-details";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/types";

export type ReceivableSource = "neurofinance" | "agenda" | "manual";
export type ReceivableStatus = FinancialEntryStatus | "processing" | "confirmed";

export interface ReceivableCalendarItem {
  id: string;
  source: ReceivableSource;
  sourceId: string;
  financialEntryId: string | null;
  patientName: string | null;
  description: string;
  amount: number;
  date: string;
  status: ReceivableStatus;
  editable: boolean;
  paymentMethod: string | null;
}

const OPEN_FINANCIAL_STATUSES: FinancialEntryStatus[] = ["planned", "pending", "overdue"];

const toDateKey = (value: string) => value.slice(0, 10);

export function updateReceivableDateSelection(current: Date[], selected: Date) {
  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedIndex = current.findIndex((date) => format(date, "yyyy-MM-dd") === selectedKey);

  if (selectedIndex >= 0) {
    return current.filter((_, index) => index !== selectedIndex);
  }
  if (current.length >= 2) return [selected];
  return [...current, selected].sort((left, right) => left.getTime() - right.getTime());
}

function financialEntryDate(entry: FinancialEntry) {
  if (entry.status === "paid") {
    return entry.paid_at?.slice(0, 10) || entry.due_date || entry.competence_date;
  }
  return entry.due_date || entry.competence_date;
}

function effectiveEntryStatus(entry: FinancialEntry, today: string): FinancialEntryStatus {
  if (
    entry.status !== "paid" &&
    entry.status !== "cancelled" &&
    entry.due_date &&
    entry.due_date < today
  ) {
    return "overdue";
  }
  return entry.status;
}

export function mapFinancialEntryToReceivable(
  entry: FinancialEntry,
  today = format(new Date(), "yyyy-MM-dd"),
): ReceivableCalendarItem | null {
  if (
    entry.type !== "income" ||
    entry.status === "cancelled" ||
    entry.origin === "neurofinance" ||
    entry.neurofinance_charge_id ||
    entry.neurofinance_transaction_id
  ) {
    return null;
  }

  const date = financialEntryDate(entry);
  if (!date) return null;

  return {
    id: `financial-entry:${entry.id}`,
    source: entry.origin === "appointment" ? "agenda" : "manual",
    sourceId: entry.id,
    financialEntryId: entry.id,
    patientName: entry.patients?.name || null,
    description: entry.description || entry.title,
    amount: Number(entry.amount || 0),
    date: toDateKey(date),
    status: effectiveEntryStatus(entry, today),
    editable: true,
    paymentMethod: entry.payment_method,
  };
}

export function mapNeuroFinanceTransactionToReceivable(
  transaction: Transaction,
  status: "paid" | "pending",
): ReceivableCalendarItem | null {
  if (!transaction.date) return null;

  const patientName = transaction.patients?.name || null;
  const patientPrefix = patientName ? `${patientName} · ` : "";
  const description = patientPrefix && transaction.description.startsWith(patientPrefix)
    ? transaction.description.slice(patientPrefix.length)
    : transaction.description;

  return {
    id: `neurofinance:${transaction.id}`,
    source: "neurofinance",
    sourceId: transaction.id,
    financialEntryId: null,
    patientName,
    description: description || (status === "paid" ? "Cobrança recebida" : "Cobrança a receber"),
    amount: Number(transaction.amount || 0),
    date: toDateKey(transaction.date),
    status,
    editable: false,
    paymentMethod: transaction.payment_method || null,
  };
}

export function mergeReceivables(
  financialEntries: FinancialEntry[],
  neuroFinanceItems: ReceivableCalendarItem[],
  today = format(new Date(), "yyyy-MM-dd"),
) {
  const managerialItems = financialEntries
    .map((entry) => mapFinancialEntryToReceivable(entry, today))
    .filter((item): item is ReceivableCalendarItem => Boolean(item));

  return [...neuroFinanceItems, ...managerialItems].sort((a, b) =>
    a.date === b.date ? b.amount - a.amount : a.date.localeCompare(b.date),
  );
}

export function useReceivablesCalendar(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const startKey = format(startOfDay(startDate), "yyyy-MM-dd");
  const endKey = format(endOfDay(endDate), "yyyy-MM-dd");
  const paidDetails = useNeuroFinanceBalanceDetails("total");
  const pendingDetails = useNeuroFinanceBalanceDetails("futuro");

  const entriesQuery = useQuery<FinancialEntry[], Error>({
    queryKey: ["financialEntries", userId, "receivables-calendar", startKey, endKey],
    queryFn: async () => {
      if (!userId) return [];

      const paidStart = `${startKey}T00:00:00`;
      const paidEnd = `${endKey}T23:59:59`;
      const [paidEntriesResult, openEntriesResult] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("*, patients(name, email)")
          .eq("professional_id", userId)
          .eq("type", "income")
          .eq("status", "paid")
          .gte("paid_at", paidStart)
          .lte("paid_at", paidEnd)
          .limit(2500),
        supabase
          .from("financial_entries")
          .select("*, patients(name, email)")
          .eq("professional_id", userId)
          .eq("type", "income")
          .in("status", OPEN_FINANCIAL_STATUSES)
          .gte("due_date", startKey)
          .lte("due_date", endKey)
          .limit(2500),
      ]);

      if (paidEntriesResult.error) throw paidEntriesResult.error;
      if (openEntriesResult.error) throw openEntriesResult.error;

      const entries = [
        ...((paidEntriesResult.data || []) as FinancialEntry[]),
        ...((openEntriesResult.data || []) as FinancialEntry[]),
      ];

      return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const neuroFinanceItems = [
    ...(paidDetails.data || [])
      .map((transaction) => mapNeuroFinanceTransactionToReceivable(transaction, "paid"))
      .filter((item): item is ReceivableCalendarItem => Boolean(item)),
    ...(pendingDetails.data || [])
      .map((transaction) => mapNeuroFinanceTransactionToReceivable(transaction, "pending"))
      .filter((item): item is ReceivableCalendarItem => Boolean(item)),
  ];

  const merged = mergeReceivables(entriesQuery.data || [], neuroFinanceItems);
  const data = merged.filter((item) => {
    const itemDate = parseISO(item.date);
    if (item.status === "paid" && isAfter(itemDate, endOfDay(new Date()))) return false;
    return item.date >= startKey && item.date <= endKey;
  });

  return {
    data,
    isLoading: entriesQuery.isLoading || paidDetails.isLoading || pendingDetails.isLoading,
    isFetching: entriesQuery.isFetching || paidDetails.isFetching || pendingDetails.isFetching,
    error: entriesQuery.error || paidDetails.error || pendingDetails.error,
    refetch: async () => {
      await Promise.all([
        entriesQuery.refetch(),
        paidDetails.refetch(),
        pendingDetails.refetch(),
      ]);
    },
  };
}
