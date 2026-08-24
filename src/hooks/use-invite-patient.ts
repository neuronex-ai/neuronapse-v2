import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { toast } from "sonner";

export interface InviteOptions {
  paymentType?: string;
  price?: number;
  channel?: "whatsapp" | "email";
}

export interface PatientPortalInviteResult {
  status: "sent" | "linked";
  inviteId?: string;
  expiresAt?: string;
  patientEmail?: string;
  portalUrl?: string;
  activationCode?: string;
  message: string;
  token?: never;
  authCode?: never;
}

const readFunctionError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") return payload.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        return fallback;
      }
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

export const useInvitePatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId }: { patientId: string; options?: InviteOptions }) => {
      const { data, error } = await supabase.functions.invoke("create-patient-portal-invite", {
        body: { patientId },
      });

      if (error) {
        throw new Error(await readFunctionError(error, "Não foi possível enviar o convite do portal."));
      }

      return data as PatientPortalInviteResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-invite-status"] });
      toast.success(data.message || "Convite enviado com segurança.");
    },
    onError: (error) => {
      console.error(error);
      toast.error(getUserFacingErrorMessage(error, "generic"));
    },
  });
};
