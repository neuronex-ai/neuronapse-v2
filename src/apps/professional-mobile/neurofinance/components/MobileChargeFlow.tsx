import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  QrCode,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNeurofinanceSimulator, type SimulatorMethod } from "@/hooks/use-neurofinance-simulator";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";

import {
  MobileFinanceSheet,
  parseMoney,
  formatMoney,
} from "../../shared/MobileFinancePrimitives";
import {
  createNeuroFinanceCharge,
  type ChargeResult,
} from "../services/neurofinance-mobile-api";

type MobilePatientOption = {
  id: string;
  name?: string | null;
  cpf?: string | null;
  payer_cpf?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PaymentMethod = "pix" | "boleto" | "card" | "undefined";
type Step = "form" | "confirm" | "success";

const methodLabels: Record<SimulatorMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  card: "Cartão",
};

const paymentMethodsFor = (method: PaymentMethod): SimulatorMethod[] =>
  method === "undefined" ? ["pix", "boleto", "card"] : [method];

const methodApiLabel = (method: PaymentMethod) =>
  method === "undefined" ? "Paciente escolhe" : methodLabels[method];

const resultUrl = (result: ChargeResult | null) =>
  result?.checkout_url || result?.invoice_url || result?.bank_slip_url || "";

export function MobileChargeFlow({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const { data: patientData = [] } = usePatients();
  const { simulate } = useNeurofinanceSimulator();
  const patients = patientData as MobilePatientOption[];
  const [step, setStep] = useState<Step>("form");
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("Sessão de psicoterapia");
  const [payerCpf, setPayerCpf] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChargeResult | null>(null);

  const patient = useMemo(
    () => patients.find((item) => item.id === patientId),
    [patientId, patients],
  );

  useEffect(() => {
    setPayerCpf(patient?.cpf || patient?.payer_cpf || "");
    setPayerEmail(patient?.email || "");
  }, [patient]);

  const value = parseMoney(amount);
  const amountInCents = Math.round(value * 100);
  const payerDocument = payerCpf.replace(/\D/g, "");
  const valid = Boolean(patientId) && value > 0 && Boolean(dueDate) && payerDocument.length >= 11;
  const feeSummaries = useMemo(
    () =>
      paymentMethodsFor(method).map((item) => ({
        method: item,
        label: methodLabels[item],
        ...simulate({
          amount: amountInCents,
          method: item,
          installments: 1,
        }),
      })),
    [amountInCents, method, simulate],
  );

  const submit = async () => {
    if (!valid || !patient) return;
    setBusy(true);
    try {
      const data = await createNeuroFinanceCharge({
        patient_id: patient.id,
        amount: amountInCents,
        payment_method: method,
        description: description.trim() || "Cobrança NeuroFinance",
        due_date: dueDate,
        patient_name: patient.name || "Paciente",
        patient_cpf: payerDocument,
        patient_email: payerEmail.trim() || undefined,
      });
      setResult(data);
      setStep("success");
      onCompleted();
      toast.success("Cobrança criada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar cobrança.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (valueToCopy?: string | null) => {
    if (!valueToCopy) return;
    await navigator.clipboard.writeText(valueToCopy);
    toast.success("Código copiado.");
  };

  const buildChargeMessage = () => {
    const url = resultUrl(result);
    const firstName = (patient?.name || "paciente").split(" ")[0];
    return `Olá ${firstName}! Segue sua cobrança NeuroFinance no valor de ${formatMoney((result?.amount || amountInCents) / 100)}.${url ? `\n${url}` : ""}`;
  };

  const sendWhatsApp = async () => {
    const text = buildChargeMessage();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cobrança NeuroFinance", text, url: resultUrl(result) || undefined });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
      }
    }

    const phone = patient?.phone?.replace(/\D/g, "");
    const target = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const sendEmail = () => {
    const email = payerEmail.trim() || patient?.email;
    if (!email) {
      toast.info("Informe o e-mail do paciente para enviar pelo Gmail.");
      return;
    }
    window.location.href = `mailto:${email}?subject=${encodeURIComponent("Cobrança NeuroFinance")}&body=${encodeURIComponent(buildChargeMessage())}`;
  };

  const reset = () => {
    setResult(null);
    setPatientId("");
    setAmount("");
    setStep("form");
  };

  return (
    <MobileFinanceSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      bodyClassName="pb-[calc(28px+env(safe-area-inset-bottom))]"
    >
      {step === "success" && result ? (
        <SuccessStep
          result={result}
          onCopy={copy}
          onShareWhatsApp={() => void sendWhatsApp()}
          onShareEmail={sendEmail}
        />
      ) : step === "confirm" ? (
        <ConfirmStep
          patientName={patient?.name || "Paciente"}
          amount={value}
          dueDate={dueDate}
          description={description}
          method={method}
          feeSummaries={feeSummaries}
          busy={busy}
          onBack={() => setStep("form")}
          onConfirm={() => void submit()}
        />
      ) : (
        <>
          <div className="mt-7">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              NeuroFinance
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              Criar cobrança
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Gere uma cobrança vinculada ao paciente e ao controle financeiro do consultório.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Paciente
              </span>
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="mt-2 h-[52px] w-full rounded-[18px] border border-border/50 bg-card px-4 text-sm outline-none"
              >
                <option value="">Selecione</option>
                {patients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || "Paciente"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
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

            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  CPF ou CNPJ do paciente
                </span>
                <Input
                  value={payerCpf}
                  onChange={(event) => setPayerCpf(event.target.value)}
                  inputMode="numeric"
                  placeholder="Documento usado na cobrança"
                  className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  E-mail do paciente
                </span>
                <Input
                  value={payerEmail}
                  onChange={(event) => setPayerEmail(event.target.value)}
                  inputMode="email"
                  placeholder="Opcional"
                  className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Forma de recebimento
              </span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                className="mt-2 h-[52px] w-full rounded-[18px] border border-border/50 bg-card px-4 text-sm outline-none"
              >
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="card">Cartão</option>
                <option value="undefined">Paciente escolhe</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Vencimento
              </span>
              <Input
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Descrição
              </span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
              />
            </label>
          </div>

          <Button
            disabled={!valid}
            onClick={() => setStep("confirm")}
            className="mt-6 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
          >
            Revisar cobrança
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </MobileFinanceSheet>
  );
}

function ConfirmStep({
  patientName,
  amount,
  dueDate,
  description,
  method,
  feeSummaries,
  busy,
  onBack,
  onConfirm,
}: {
  patientName: string;
  amount: number;
  dueDate: string;
  description: string;
  method: PaymentMethod;
  feeSummaries: Array<{
    method: SimulatorMethod;
    label: string;
    feeAmount: number | null;
    netAmount: number | null;
    rule?: { price_label?: string | null } | null;
  }>;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="py-7">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Confirmação</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Revise a cobrança</h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        A cobrança só será criada depois desta confirmação. Revise as taxas e o valor líquido previsto.
      </p>

      <div className="mt-6 rounded-[22px] border border-border/45 bg-card/80 p-4 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="grid gap-3 text-sm">
          <SummaryRow label="Paciente" value={patientName} />
          <SummaryRow label="Valor" value={formatMoney(amount)} />
          <SummaryRow label="Vencimento" value={new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")} />
          <SummaryRow label="Método" value={methodApiLabel(method)} />
          <SummaryRow label="Descrição" value={description || "Cobrança NeuroFinance"} />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Taxas estimadas</p>
        {feeSummaries.map((summary) => (
          <div key={summary.method} className="rounded-[20px] border border-border/40 bg-background/76 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black">{summary.label}</p>
                <p className="mt-1 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                  {summary.rule?.price_label || "Condição confirmada no processamento"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/55">Taxa</p>
                <p className="mt-1 text-sm font-black text-rose-600 dark:text-rose-300">
                  {summary.feeAmount == null ? "A confirmar" : `- ${formatMoney(summary.feeAmount / 100)}`}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/35 pt-4 dark:border-white/10">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Recebe limpo</span>
              <strong className="text-base font-black text-emerald-600 dark:text-emerald-300">
                {summary.netAmount == null ? "A confirmar" : formatMoney(summary.netAmount / 100)}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[0.8fr_1.2fr] gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-14 rounded-[20px] text-xs font-semibold uppercase tracking-[0.14em]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button type="button" disabled={busy} onClick={onConfirm} className="h-14 rounded-[20px] text-xs font-semibold uppercase tracking-[0.14em]">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Confirmar
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({
  result,
  onCopy,
  onShareWhatsApp,
  onShareEmail,
}: {
  result: ChargeResult;
  onCopy: (valueToCopy?: string | null) => void;
  onShareWhatsApp: () => void;
  onShareEmail: () => void;
}) {
  const url = resultUrl(result);

  return (
    <div className="py-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-6 w-6" />
      </div>
      <div className="mt-5 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Cobrança preparada
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
          {formatMoney(result.amount / 100)}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Envie o link, o boleto ou o código Pix ao paciente.
        </p>
      </div>

      {result.pix_qr_code ? (
        <div className="mt-7 rounded-[24px] border border-border/40 bg-card/70 p-4 text-center dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-3 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            <QrCode className="h-4 w-4" />
            QR Code Pix
          </div>
          <img
            alt="QR Code Pix"
            src={
              result.pix_qr_code.startsWith("data:")
                ? result.pix_qr_code
                : `data:image/png;base64,${result.pix_qr_code}`
            }
            className="mx-auto h-48 w-48 rounded-[24px] bg-white p-3"
          />
        </div>
      ) : null}

      <div className="mt-7 space-y-3">
        {result.pix_copy_paste ? (
          <Button
            variant="outline"
            onClick={() => onCopy(result.pix_copy_paste)}
            className="h-[52px] w-full rounded-[18px]"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar Pix Copia e Cola
          </Button>
        ) : null}
        {url ? (
          <Button
            variant="outline"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            className="h-[52px] w-full rounded-[18px]"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir página da cobrança
          </Button>
        ) : null}
        {result.bank_slip_url ? (
          <Button
            variant="outline"
            onClick={() => window.open(result.bank_slip_url!, "_blank", "noopener,noreferrer")}
            className="h-[52px] w-full rounded-[18px]"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Visualizar boleto
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" onClick={onShareWhatsApp} className="h-[52px] rounded-[18px]">
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={onShareEmail} className="h-[52px] rounded-[18px]">
            <Mail className="mr-2 h-4 w-4" />
            Gmail
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/30 pb-3 last:border-0 last:pb-0 dark:border-white/10">
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={cn("max-w-[58%] truncate text-right text-xs font-black", !value && "text-muted-foreground")}>{value || "-"}</span>
    </div>
  );
}
