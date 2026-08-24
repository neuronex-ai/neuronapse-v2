import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { useAuth } from "@/components/auth/SessionContextProvider";
import type { BillPaymentRecord } from "@/hooks/use-neurofinance-bill-payments";
import { supabase } from "@/integrations/supabase/client";

export interface BillPaymentCalendarItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  beneficiaryName: string | null;
  bankName: string | null;
  dueDate: string | null;
  hasReceipt: boolean;
  record: BillPaymentRecord;
}

export function mapBillPaymentToCalendarItem(
  record: BillPaymentRecord,
): BillPaymentCalendarItem | null {
  if (
    !record.provider_bill_id ||
    record.payment_mode !== "scheduled" ||
    !record.scheduled_date
  ) {
    return null;
  }

  return {
    id: record.id,
    date: record.scheduled_date.slice(0, 10),
    amount: (Number(record.amount || 0) + Number(record.fee_amount || 0)) / 100,
    status: String(record.status || "processing"),
    beneficiaryName: record.beneficiary_name || null,
    bankName: record.bank_name || (record.bank_code ? `Banco ${record.bank_code}` : null),
    dueDate: record.due_date || null,
    hasReceipt: Boolean(record.receipt_url),
    record,
  };
}

export function useBillPaymentsCalendar(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const startKey = format(startDate, "yyyy-MM-dd");
  const endKey = format(endDate, "yyyy-MM-dd");

  const query = useQuery<BillPaymentCalendarItem[]>({
    queryKey: ["neurofinance-bill-payments", userId, "calendar", startKey, endKey],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<BillPaymentCalendarItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("neurofinance_bill_payments")
        .select("*")
        .eq("user_id", userId)
        .eq("payment_mode", "scheduled")
        .not("provider_bill_id", "is", null)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", startKey)
        .lte("scheduled_date", endKey)
        .order("scheduled_date", { ascending: true })
        .limit(1000);

      if (error) throw error;
      return (data || [])
        .map((record) => mapBillPaymentToCalendarItem(record as BillPaymentRecord))
        .filter((item): item is BillPaymentCalendarItem => item !== null);
    },
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`neurofinance-bill-payments-calendar-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "neurofinance_bill_payments",
          filter: `user_id=eq.${userId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["neurofinance-bill-payments", userId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}
