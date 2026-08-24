import { AlertTriangle, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_AVAILABILITY_LABELS, type FinanceAvailabilityCode } from "@/lib/finance-presentation";
import { formatCurrency } from "@/lib/utils";

export type FinanceOperationKind = "reversal" | "refund";

interface FinanceOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: FinanceOperationKind;
  description: string;
  amount: number;
  availability: FinanceAvailabilityCode;
  backendReady?: boolean;
  onConfirm?: (reason: string) => void | Promise<void>;
}

const COPY: Record<FinanceOperationKind, {
  title: string;
  action: string;
  explanation: string;
  impact: string;
}> = {
  reversal: {
    title: "Preparar estorno",
    action: "Confirmar estorno",
    explanation: "O estorno reverte o lançamento ou movimento, preservando a relação com a operação original.",
    impact: "O valor deixa de compor o resultado confirmado. Se houver conciliação bancária, ela deverá ser revertida de forma relacionada, sem excluir histórico.",
  },
  refund: {
    title: "Preparar reembolso",
    action: "Confirmar reembolso",
    explanation: "O reembolso devolve dinheiro ao pagador e não deve ser tratado como cancelamento ou contestação.",
    impact: "O saldo disponível poderá ser reduzido pelo valor devolvido e por eventuais tarifas do provedor. O movimento original continuará visível e relacionado.",
  },
};

export function FinanceOperationDialog({
  open,
  onOpenChange,
  operation,
  description,
  amount,
  availability,
  backendReady = false,
  onConfirm,
}: FinanceOperationDialogProps) {
  const [reason, setReason] = useState("");
  const copy = COPY[operation];
  const Icon = operation === "refund" ? Undo2 : RotateCcw;

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const canConfirm = backendReady && reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-modal-surface max-w-xl rounded-[28px] border-border/60 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="border-b border-border/55 px-6 py-6 pr-14 text-left">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[15px] border border-border/55 bg-muted/55 text-foreground">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl font-black tracking-tight">{copy.title}</DialogTitle>
          <DialogDescription className="max-w-md text-sm font-medium leading-6">
            {copy.explanation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="finance-inset rounded-[18px] border border-border/55 bg-muted/38 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Operação</p>
              <p className="mt-2 line-clamp-2 text-sm font-bold text-foreground">{description}</p>
            </div>
            <div className="finance-inset rounded-[18px] border border-border/55 bg-muted/38 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Valor elegível</p>
              <p className="mt-2 text-sm font-black tabular-nums text-foreground">{formatCurrency(Math.abs(amount))}</p>
              <p className="mt-1 text-[10px] font-bold text-muted-foreground">Saldo: {FINANCE_AVAILABILITY_LABELS[availability]}</p>
            </div>
          </div>

          <div>
            <label htmlFor="finance-operation-reason" className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Motivo
            </label>
            <Textarea
              id="finance-operation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explique o motivo para manter a trilha financeira compreensível."
              className="mt-2 min-h-24 rounded-[16px] border-border/60 bg-background/78"
            />
          </div>

          <div className="rounded-[18px] border border-border/55 bg-muted/38 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Impacto esperado</p>
            <p className="mt-2 text-xs font-medium leading-5 text-foreground/78">{copy.impact}</p>
          </div>

          {!backendReady ? (
            <div role="status" className="flex gap-3 rounded-[18px] border border-amber-500/25 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-xs font-semibold leading-5">
                Fluxo em revisão: a confirmação permanecerá bloqueada até o contrato backend, a idempotência e o movimento relacionado estarem validados.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/55 px-6 py-5 sm:justify-between">
          <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl bg-foreground px-5 text-background hover:bg-foreground/90"
            disabled={!canConfirm}
            title={!backendReady ? "Disponível após a validação do contrato backend" : reason.trim().length < 3 ? "Informe o motivo" : undefined}
            onClick={() => void onConfirm?.(reason.trim())}
          >
            {copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
