"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ["current-subscription-entitlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("current_subscription_entitlements")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}