import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export type InsuranceRepassType = "currency" | "percentage";

export interface PatientInsuranceAgreement {
  id: string;
  user_id: string;
  name: string;
  repass_type: InsuranceRepassType;
  repass_value_cents: number | null;
  repass_percentage: number | null;
  expected_receipt_days: number;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

interface AddInsuranceAgreementPayload {
  name: string;
  repassType: InsuranceRepassType;
  repassValue: string;
  expectedReceiptDays: string;
}

export const parseMoneyToCents = (value?: string | null) => {
  const cleaned = value?.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

export const formatCentsAsBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);

const parsePercentage = (value?: string | null) => {
  const numeric = Number(value?.replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

const parseDays = (value?: string | null) => {
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 ? days : 0;
};

const fetchAgreements = async (userId: string): Promise<PatientInsuranceAgreement[]> => {
  const { data, error } = await supabase
    .from("patient_insurance_agreements")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const usePatientInsuranceAgreements = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["patient-insurance-agreements", userId],
    queryFn: () => fetchAgreements(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const addAgreement = useMutation({
    mutationFn: async ({ name, repassType, repassValue, expectedReceiptDays }: AddInsuranceAgreementPayload) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error("Informe o nome do convênio.");

      const { data, error } = await supabase
        .from("patient_insurance_agreements")
        .insert({
          user_id: userId,
          name: normalizedName,
          repass_type: repassType,
          repass_value_cents: repassType === "currency" ? parseMoneyToCents(repassValue) : null,
          repass_percentage: repassType === "percentage" ? parsePercentage(repassValue) : null,
          expected_receipt_days: parseDays(expectedReceiptDays),
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as PatientInsuranceAgreement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-insurance-agreements", userId] });
    },
  });

  return {
    ...query,
    addAgreement,
  };
};
