import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export type PatientLookupKind = "referrer";

export interface PatientLookupOption {
  id: string;
  user_id: string;
  kind: PatientLookupKind;
  label: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

const fetchOptions = async (userId: string, kind: PatientLookupKind): Promise<PatientLookupOption[]> => {
  const { data, error } = await supabase
    .from("patient_lookup_options")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("active", true)
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const usePatientLookupOptions = (kind: PatientLookupKind) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["patient-lookup-options", userId, kind],
    queryFn: () => fetchOptions(userId!, kind),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const addOption = useMutation({
    mutationFn: async (label: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const normalized = label.trim();
      if (!normalized) throw new Error("Informe um nome para a opção.");

      const { data, error } = await supabase
        .from("patient_lookup_options")
        .insert({ user_id: userId, kind, label: normalized })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as PatientLookupOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-lookup-options", userId, kind] });
    },
  });

  return {
    ...query,
    addOption,
  };
};
