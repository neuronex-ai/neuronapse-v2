import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export interface PatientFinancialSettings {
  id: string;
  user_id: string;
  patient_id: string;
  professional_name: string | null;
  plan_type: "per_session" | "monthly" | "insurance" | "exempt" | string | null;
  session_value_cents: number | null;
  monthly_value_cents: number | null;
  billing_day: number | null;
  insurance_agreement_id: string | null;
  insurance_card_number: string | null;
  insurance_card_expires_at: string | null;
}

export interface PatientResponsible {
  id: string;
  user_id: string;
  patient_id: string;
  name: string | null;
  email: string | null;
  phone_country_code: string | null;
  mobile_phone: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  use_for_billing_documents: boolean | null;
}

export interface PatientRecordDetails {
  financial: PatientFinancialSettings | null;
  responsible: PatientResponsible | null;
}

const fetchPatientRecordDetails = async (patientId: string, userId: string): Promise<PatientRecordDetails> => {
  const [financialResult, responsibleResult] = await Promise.all([
    supabase
      .from("patient_financial_settings")
      .select("*")
      .eq("patient_id", patientId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("patient_responsibles")
      .select("*")
      .eq("patient_id", patientId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (financialResult.error) throw new Error(financialResult.error.message);
  if (responsibleResult.error) throw new Error(responsibleResult.error.message);

  return {
    financial: (financialResult.data as PatientFinancialSettings | null) ?? null,
    responsible: (responsibleResult.data as PatientResponsible | null) ?? null,
  };
};

export const usePatientRecordDetails = (patientId?: string | null) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["patient-record-details", userId, patientId],
    queryFn: () => fetchPatientRecordDetails(patientId!, userId!),
    enabled: Boolean(patientId && userId),
    staleTime: 1000 * 60 * 2,
  });
};
