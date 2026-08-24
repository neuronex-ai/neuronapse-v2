import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeNeurofinanceFunction } from "@/lib/neurofinance-edge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";

export const NEUROFINANCE_ANTICIPATION_ENABLED =
  import.meta.env.VITE_ENABLE_NEUROFINANCE_ANTICIPATION === "true";

export interface EligibleAnticipationPayment {
  id: string;
  provider_payment_id: string;
  description: string | null;
  payment_method_type: string | null;
  gross_amount: number;
  net_amount: number;
  due_date: string | null;
}

export interface NeurofinanceAnticipation {
  id: string;
  provider_anticipation_id: string | null;
  normalized_status: string;
  gross_amount: number;
  net_amount: number;
  fee_amount: number;
  anticipation_date: string | null;
  created_at: string;
}

export function useNeurofinanceAnticipations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["neurofinance-anticipations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neurofinance_anticipations")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NeurofinanceAnticipation[];
    },
  });

  const eligible = useQuery({
    queryKey: ["neurofinance-anticipation-eligible", user?.id],
    enabled: !!user?.id && NEUROFINANCE_ANTICIPATION_ENABLED,
    queryFn: async () =>
      invokeNeurofinanceFunction<{ success: boolean; payments: EligibleAnticipationPayment[] }>(
        "asaas-anticipations",
        { action: "list_eligible_payments" },
        "load",
      ).then((result) => result.payments || []),
  });

  const simulate = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!NEUROFINANCE_ANTICIPATION_ENABLED) {
        throw new Error("Antecipação de recebíveis aguardando confirmação contratual.");
      }
      return invokeNeurofinanceFunction<{ success: boolean; simulation: any }>(
        "asaas-anticipations",
        { action: "simulate", payment: paymentId },
        "payment",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const request = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!NEUROFINANCE_ANTICIPATION_ENABLED) {
        throw new Error("Antecipação de recebíveis aguardando confirmação contratual.");
      }
      return invokeNeurofinanceFunction<{ success: boolean; anticipation: any }>(
        "asaas-anticipations",
        { action: "request", payment: paymentId },
        "payment",
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["neurofinance-anticipations"] });
      queryClient.invalidateQueries({ queryKey: ["neurofinance-anticipation-eligible"] });
      queryClient.invalidateQueries({ queryKey: ["neurofinance-overview"] });
      toast.success("Solicitação de antecipação enviada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { list, eligible, simulate, request };
}
