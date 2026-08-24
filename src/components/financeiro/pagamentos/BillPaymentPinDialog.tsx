import { SecureOperationPinDialog } from "@/components/financeiro/secure/SecureOperationPinDialog";
import type { BillPaymentMode } from "@/hooks/use-neurofinance-bill-payments";

interface BillPaymentPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pin: string) => Promise<void>;
  beneficiaryName?: string | null;
  value: number;
  paymentMode?: BillPaymentMode | null;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function BillPaymentPinDialog({
  beneficiaryName,
  paymentMode,
  ...props
}: BillPaymentPinDialogProps) {
  return (
    <SecureOperationPinDialog
      {...props}
      recipient={beneficiaryName}
      actionLabel={paymentMode === "scheduled" ? "o agendamento" : "o pagamento"}
    />
  );
}
