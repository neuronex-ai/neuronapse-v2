import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TariffRule } from "@/lib/neurofinance-types";

export function useNeuroFinanceTariffs() {
  return useQuery<TariffRule[], Error>({
    queryKey: ["neurofinance-tariffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neurofinance_tariff_rules")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return (data || []) as TariffRule[];
    },
    staleTime: 1000 * 60 * 60,
  });
}
