import { Printer } from "lucide-react";

import { ReceiptModal } from "@/components/financeiro/ReceiptModal";
import { Button } from "@/components/ui/button";

interface GlobalReceiptModalProps {
  children?: React.ReactNode;
}

export const GlobalReceiptModal = ({ children }: GlobalReceiptModalProps) => (
  <ReceiptModal>
    {children || (
      <Button variant="outline" size="sm" className="h-11 gap-2 rounded-xl">
        <Printer className="h-4 w-4" aria-hidden="true" />
        Comprovante avulso
      </Button>
    )}
  </ReceiptModal>
);
