import { useState } from "react";
import { Check, Landmark, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MobileFinanceSheet,
  formatMoney,
  mobileFinanceSurface,
  parseMoney,
} from "../../shared/MobileFinancePrimitives";
import { MobileFinancialPinSheet } from "./MobileFinancialPinSheet";
import {
  authorizePayout,
  consultPayout,
  executePayout,
  type OperationResult,
  type PayoutConsultation,
} from "../services/neurofinance-mobile-api";

export function MobileTransferFlow({
  open,
  onOpenChange,
  purpose,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: "transfer" | "payout";
  onCompleted: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [consultation, setConsultation] = useState<PayoutConsultation | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const isTransfer = purpose === "transfer";
  const numericAmount = parseMoney(amount);
  const canConsult = numericAmount > 0 && (!isTransfer || pixKey.trim().length >= 3);

  const consult = async () => {
    if (!canConsult) return;
    setBusy(true);
    try {
      const data = await consultPayout({
        amount: Math.round(numericAmount * 100),
        purpose,
        destination: isTransfer
          ? { type: "pix_key", pix_key: pixKey.trim() }
          : { type: "saved_bank" },
      });
      setConsultation(data.consultation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Destino não validado.");
    } finally {
      setBusy(false);
    }
  };

  const authorizeAndExecute = async (pin: string) => {
    if (!consultation) return;
    setBusy(true);
    try {
      await authorizePayout(consultation.id, pin);
      const operation = await executePayout(consultation.id);
      setResult(operation);
      setPinOpen(false);
      onCompleted();
      toast.success(isTransfer ? "Transferência enviada." : "Saque enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operação não concluída.");
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAmount("");
    setPixKey("");
    setConsultation(null);
    setPinOpen(false);
    setResult(null);
  };

  return (
    <>
      <MobileFinanceSheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) reset();
        }}
        bodyClassName="pb-[calc(28px+env(safe-area-inset-bottom))]"
      >
          {result ? (
            <div className="py-9 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="h-6 w-6" />
              </div>
              <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Operação enviada
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {isTransfer ? "Transferência em processamento" : "Transferência para sua conta"}
              </h2>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                O status e o comprovante serão atualizados automaticamente.
              </p>
              {result.receiptUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(result.receiptUrl!, "_blank", "noopener")}
                  className="mt-7 h-[52px] w-full rounded-[18px]"
                >
                  Abrir comprovante
                </Button>
              ) : null}
            </div>
          ) : consultation ? (
            <div className="py-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Revisão segura
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Confirme a transferência
              </h2>

              <div className={cn(mobileFinanceSurface, "mt-6 space-y-4 p-5")}>
                <Row
                  label="Destino"
                  value={consultation.destinationSummary || "Conta cadastrada"}
                />
                <Row label="Valor" value={formatMoney(consultation.amount)} />
                <Row label="Tarifa" value={formatMoney(consultation.fee)} />
                <Row
                  label="Saldo disponível"
                  value={
                    consultation.availableBalance == null
                      ? "Indisponível"
                      : formatMoney(consultation.availableBalance)
                  }
                />
              </div>

              <Button
                disabled={busy}
                onClick={() => setPinOpen(true)}
                className="mt-6 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Confirmar com biometria/PIN
              </Button>
            </div>
          ) : (
            <div className="py-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/40 bg-card">
                {isTransfer ? (
                  <Send className="h-5 w-5" strokeWidth={1.6} />
                ) : (
                  <Landmark className="h-5 w-5" strokeWidth={1.6} />
                )}
              </div>
              <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                NeuroFinance
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {isTransfer ? "Transferir por Pix" : "Transferir para minha conta"}
              </h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {isTransfer
                  ? "A chave e o titular serão validados antes de solicitar seu PIN."
                  : "O valor será enviado para a conta bancária cadastrada e aprovada."}
              </p>

              <label className="mt-6 block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Valor
                </span>
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-2 h-14 rounded-[18px] border-border/50 bg-card text-xl font-semibold"
                />
              </label>

              {isTransfer ? (
                <label className="mt-4 block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Chave Pix
                  </span>
                  <Input
                    value={pixKey}
                    onChange={(event) => setPixKey(event.target.value)}
                    placeholder="CPF, CNPJ, e-mail, telefone ou aleatória"
                    className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
                  />
                </label>
              ) : (
                <div className={cn(mobileFinanceSurface, "mt-5 p-4")}>
                  <p className="text-xs font-semibold">Conta bancária cadastrada</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    O NeuroFinance usará os dados bancários verificados no cadastro.
                  </p>
                </div>
              )}

              <Button
                disabled={busy || !canConsult}
                onClick={() => void consult()}
                className="mt-6 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar operação
              </Button>
            </div>
          )}
      </MobileFinanceSheet>

      <MobileFinancialPinSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        busy={busy}
        title={isTransfer ? "Autorizar transferência Pix" : "Autorizar transferência"}
        onConfirm={authorizeAndExecute}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right text-[12px]">{value}</span>
    </div>
  );
}
