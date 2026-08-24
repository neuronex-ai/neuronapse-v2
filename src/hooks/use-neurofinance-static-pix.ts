import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export interface StaticPixQrCodeParams {
  value?: number;
  description?: string;
  expirationSeconds?: number;
  allowsMultiplePayments?: boolean;
  externalReference?: string;
}

export interface StaticPixQrCodeResult {
  success: boolean;
  qrcode_id: string | null;
  status: string;
  amount: number | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  address_key: string;
  provider: string;
}

export function useNeuroFinanceStaticPixQrCode() {
  return useMutation<StaticPixQrCodeResult, Error, StaticPixQrCodeParams>({
    mutationFn: async (params) => {
      const response = await supabase.functions.invoke("asaas-pix-static-qrcode", {
        body: {
          value: params.value && params.value > 0 ? params.value : undefined,
          description: params.description?.trim() || undefined,
          expirationSeconds: params.expirationSeconds,
          allowsMultiplePayments: params.allowsMultiplePayments ?? true,
          externalReference: params.externalReference,
          format: "ALL",
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      if (!response.data?.pix_qr_code && !response.data?.pix_copy_paste) {
        throw new Error("A instituição não retornou o QR Code Pix.");
      }

      return response.data as StaticPixQrCodeResult;
    },
    onSuccess: () => toast.success("QR Code Pix gerado."),
    onError: (error) => toast.error(getUserFacingErrorMessage(error, "payment")),
  });
}
