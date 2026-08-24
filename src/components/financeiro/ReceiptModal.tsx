"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Mail,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { BrandInvoiceTemplate } from "@/components/financeiro/BrandInvoiceTemplate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFiscalSettings } from "@/hooks/use-fiscal-settings";
import { useProfile } from "@/hooks/use-profile";
import { formatDocumentInput, formatMoneyInput, moneyInputToNumber } from "@/lib/financial-input";
import { generateReceiptPDF } from "@/lib/pdf-generator";
import type { ReceiptPDFData } from "@/lib/pdf-types";
import { formatReceiptDate, receiptFiscalNotice, receiptReference, type ReceiptFiscalMode } from "@/lib/receipt-document";
import { formatCurrency } from "@/lib/utils";
import type { Transaction } from "@/types";

interface ReceiptModalProps {
  transaction?: Transaction | null;
  children: React.ReactNode;
  patientEmail?: string;
}

interface ReceiptFormState {
  fiscalMode: ReceiptFiscalMode;
  issuerName: string;
  issuerDocument: string;
  issuerRegistry: string;
  issuerAddress: string;
  payerName: string;
  payerDocument: string;
  beneficiaryName: string;
  beneficiaryDocument: string;
  payerBeneficiaryRelationship: string;
  samePerson: boolean;
  serviceDescription: string;
  serviceDate: string;
  paymentDate: string;
  paymentMethod: string;
  amountInput: string;
  installmentLabel: string;
  relatedReference: string;
  notes: string;
  receitaSaudeReference: string;
  nfseReference: string;
}

const metadataText = (transaction: Transaction | null | undefined, keys: string[]) => {
  const metadata = (transaction?.metadata || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const dateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const paymentMethodLabel = (transaction?: Transaction | null) => {
  const raw = String(metadataText(transaction, ["payment_method", "billing_type"]) || transaction?.payment_method || "").toLowerCase();
  if (raw.includes("pix")) return "Pix";
  if (raw.includes("boleto") || raw.includes("bank_slip")) return "Boleto";
  if (raw.includes("card") || raw.includes("cart")) return "Cartão";
  if (raw.includes("cash") || raw.includes("dinheiro")) return "Dinheiro";
  if (raw.includes("conven")) return "Convênio";
  if (raw.includes("transfer")) return "Transferência";
  if (raw.includes("manual")) return "Baixa manual";
  return "Não informado";
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      {children}
      {hint ? <p className="text-[10px] font-medium leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/55 bg-background/70 pl-3">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-bold text-foreground">{value || "Não informado"}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 rounded-xl"
        disabled={!value}
        aria-label={`Copiar ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copiado.`);
        }}
      >
        <Clipboard className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export const ReceiptModal = ({ transaction, children, patientEmail }: ReceiptModalProps) => {
  const { data: profile } = useProfile();
  const { settings: fiscalSettings } = useFiscalSettings();
  const draftId = useRef(transaction?.id || globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}`);
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [issuedData, setIssuedData] = useState<ReceiptPDFData | null>(null);
  const [receitaSaudeFileName, setReceitaSaudeFileName] = useState("");
  const patientName = transaction?.patient_name || transaction?.patients?.name || metadataText(transaction, ["patient_name"]) || "";
  const patientDocument = metadataText(transaction, ["beneficiary_cpf", "patient_cpf"]);
  const payerName = metadataText(transaction, ["payer_name"]) || patientName;
  const payerDocument = metadataText(transaction, ["payer_cpf", "payer_document"]);
  const processedByNeuroFinance = Boolean(
    transaction?.origin === "gateway_auto" ||
    metadataText(transaction, ["asaas_payment_id", "neurofinance_transaction_id", "neurofinance_charge_id"]),
  );

  const [form, setForm] = useState<ReceiptFormState>(() => ({
    fiscalMode: "unspecified",
    issuerName: "",
    issuerDocument: "",
    issuerRegistry: "",
    issuerAddress: "",
    payerName,
    payerDocument,
    beneficiaryName: patientName,
    beneficiaryDocument: patientDocument,
    payerBeneficiaryRelationship: "",
    samePerson: !payerName || payerName === patientName,
    serviceDescription: transaction?.description || "Sessão de psicoterapia",
    serviceDate: dateInputValue(metadataText(transaction, ["service_date", "appointment_date"]) || transaction?.date),
    paymentDate: dateInputValue(transaction?.date) || new Date().toISOString().slice(0, 10),
    paymentMethod: paymentMethodLabel(transaction),
    amountInput: transaction ? formatMoneyInput(Number(transaction.amount || 0).toFixed(2).replace(".", ",")) : "",
    installmentLabel: transaction?.installments && transaction.installments > 1
      ? `${metadataText(transaction, ["installment_number"]) || "1"} de ${transaction.installments}`
      : "À vista",
    relatedReference: transaction?.external_reference || transaction?.id || "",
    notes: "",
    receitaSaudeReference: metadataText(transaction, ["receita_saude_reference", "receita_saude_id"]),
    nfseReference: metadataText(transaction, ["nfse_reference", "nfse_number"]),
  }));

  useEffect(() => {
    if (!profile || issuedData) return;
    const profileRecord = profile as unknown as Record<string, unknown>;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || profile.name || "";
    const cnpj = fiscalSettings?.cnpj || "";
    const cpf = typeof profileRecord.cpf === "string" ? profileRecord.cpf : "";
    setForm((current) => ({
      ...current,
      fiscalMode: current.fiscalMode === "unspecified" ? (cnpj ? "company" : cpf ? "individual" : "unspecified") : current.fiscalMode,
      issuerName: current.issuerName || fiscalSettings?.company_name || name,
      issuerDocument: current.issuerDocument || cnpj || cpf,
      issuerRegistry: current.issuerRegistry || profile.crp || "",
      issuerAddress: current.issuerAddress || profile.address || "",
    }));
  }, [fiscalSettings?.cnpj, fiscalSettings?.company_name, issuedData, profile]);

  const setValue = <K extends keyof ReceiptFormState>(key: K, value: ReceiptFormState[K]) => {
    if (issuedData) return;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const previewData = useMemo<ReceiptPDFData>(() => ({
    reference: receiptReference(draftId.current),
    issuedAt: issuedData?.issuedAt || "Prévia — ainda não emitido",
    issuerName: form.issuerName || "Emissor não informado",
    issuerDocument: form.issuerDocument,
    issuerRegistry: form.issuerRegistry || "CRP não informado",
    issuerAddress: form.issuerAddress,
    payerName: form.payerName || "Pagador não informado",
    payerDocument: form.payerDocument,
    beneficiaryName: form.samePerson ? form.payerName || "Beneficiário não informado" : form.beneficiaryName || "Beneficiário não informado",
    beneficiaryDocument: form.samePerson ? form.payerDocument : form.beneficiaryDocument,
    payerBeneficiaryRelationship: form.samePerson ? "Mesma pessoa" : form.payerBeneficiaryRelationship,
    amountFormatted: formatCurrency(moneyInputToNumber(form.amountInput)),
    serviceDescription: form.serviceDescription || "Serviço não informado",
    serviceDate: formatReceiptDate(form.serviceDate),
    paymentDate: formatReceiptDate(form.paymentDate),
    paymentMethod: form.paymentMethod,
    installmentLabel: form.installmentLabel,
    relatedReference: form.relatedReference,
    notes: form.notes,
    fiscalMode: form.fiscalMode,
    fiscalNotice: receiptFiscalNotice(form.fiscalMode),
    receitaSaudeReference: form.receitaSaudeReference,
    nfseReference: form.nfseReference,
    processedByNeuroFinance,
  }), [form, issuedData?.issuedAt, processedByNeuroFinance]);

  const validate = () => {
    if (!form.issuerName.trim()) return "Informe o nome ou razão social do emissor.";
    if (!form.issuerRegistry.trim()) return "Informe o CRP do profissional.";
    if (!form.payerName.trim()) return "Informe o pagador.";
    if (!form.samePerson && !form.beneficiaryName.trim()) return "Informe o beneficiário do atendimento.";
    if (!form.serviceDescription.trim()) return "Descreva o serviço prestado.";
    if (!form.paymentDate) return "Informe a data do pagamento.";
    if (moneyInputToNumber(form.amountInput) <= 0) return "Informe um valor de pagamento válido.";
    return "";
  };

  const downloadBlob = (blob: Blob, data: ReceiptPDFData) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprovante_${data.reference.toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleIssue = async () => {
    const validationError = validate();
    if (validationError) return toast.error(validationError);
    setIsGenerating(true);
    try {
      const data = issuedData || { ...previewData, issuedAt: formatReceiptDate(new Date()) };
      const blob = await generateReceiptPDF(data);
      if (!issuedData) setIssuedData(data);
      downloadBlob(blob, data);
      toast.success(issuedData ? "Comprovante baixado." : "Comprovante preparado e baixado.");
    } catch (error) {
      console.error("Falha ao gerar comprovante:", error);
      toast.error("Não foi possível gerar o comprovante.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    const data = issuedData || previewData;
    const blob = await generateReceiptPDF(data);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const locked = Boolean(issuedData);
  const controlClass = "h-11 rounded-xl border-border/60 bg-background/78 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="finance-modal-surface flex h-[92vh] w-[calc(100vw-32px)] max-w-[1480px] flex-col overflow-hidden rounded-[28px] border-border/60 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl">
        <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-6 border-b border-border/55 px-6 pr-16 lg:px-8 lg:pr-16">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              Comprovante de pagamento
            </DialogTitle>
            <DialogDescription className="mt-1 truncate text-xs font-medium text-muted-foreground">
              Uma fonte de dados para prévia e PDF · referência {previewData.reference}
            </DialogDescription>
          </div>
          {locked ? (
            <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300 sm:flex">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Emitido nesta sessão
            </span>
          ) : null}
        </header>

        <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border/45 px-6 py-3 xl:hidden">
            <TabsList className="w-full">
              <TabsTrigger value="data" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">Prévia</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 xl:grid xl:grid-cols-[430px_minmax(0,1fr)]">
            <TabsContent forceMount value="data" className="m-0 h-full min-h-0 overflow-y-auto border-r border-border/55 data-[state=inactive]:hidden xl:data-[state=inactive]:block">
              <div className="space-y-8 p-6 lg:p-7">
                {locked ? (
                  <div className="rounded-2xl border border-border/55 bg-muted/45 p-4 text-xs font-medium leading-5 text-muted-foreground">
                    O documento emitido está bloqueado para edição. Correções devem gerar cancelamento e um novo comprovante quando a persistência backend estiver habilitada.
                  </div>
                ) : null}

                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">Emissor</h3>
                  <Field label="Enquadramento">
                    <Select disabled={locked} value={form.fiscalMode} onValueChange={(value) => setValue("fiscalMode", value as ReceiptFiscalMode)}>
                      <SelectTrigger className={controlClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Pessoa física</SelectItem>
                        <SelectItem value="company">Pessoa jurídica</SelectItem>
                        <SelectItem value="unspecified">Não informado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="receipt-issuer-name" label="Nome / Razão social"><Input id="receipt-issuer-name" disabled={locked} value={form.issuerName} onChange={(event) => setValue("issuerName", event.target.value)} className={controlClass} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <Field id="receipt-issuer-document" label="CPF/CNPJ"><Input id="receipt-issuer-document" disabled={locked} value={form.issuerDocument} onChange={(event) => setValue("issuerDocument", formatDocumentInput(event.target.value))} className={controlClass} /></Field>
                    <Field id="receipt-issuer-crp" label="CRP"><Input id="receipt-issuer-crp" disabled={locked} value={form.issuerRegistry} onChange={(event) => setValue("issuerRegistry", event.target.value)} className={controlClass} /></Field>
                  </div>
                  <Field id="receipt-issuer-address" label="Endereço"><Input id="receipt-issuer-address" disabled={locked} value={form.issuerAddress} onChange={(event) => setValue("issuerAddress", event.target.value)} className={controlClass} /></Field>
                </section>

                <section className="space-y-4 border-t border-border/55 pt-7">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">Pagador e beneficiário</h3>
                  <Field id="receipt-payer" label="Pagador"><Input id="receipt-payer" disabled={locked} value={form.payerName} onChange={(event) => setValue("payerName", event.target.value)} className={controlClass} /></Field>
                  <Field id="receipt-payer-document" label="CPF/CNPJ do pagador"><Input id="receipt-payer-document" disabled={locked} value={form.payerDocument} onChange={(event) => setValue("payerDocument", formatDocumentInput(event.target.value))} className={controlClass} /></Field>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/55 bg-muted/35 px-3 text-xs font-bold text-foreground">
                    <Checkbox checked={form.samePerson} disabled={locked} onCheckedChange={(checked) => setValue("samePerson", checked === true)} />
                    Pagador e beneficiário são a mesma pessoa
                  </label>
                  {!form.samePerson ? (
                    <div className="space-y-4 rounded-2xl border border-border/55 bg-muted/35 p-4">
                      <Field id="receipt-beneficiary" label="Beneficiário"><Input id="receipt-beneficiary" disabled={locked} value={form.beneficiaryName} onChange={(event) => setValue("beneficiaryName", event.target.value)} className={controlClass} /></Field>
                      <Field id="receipt-beneficiary-document" label="CPF do beneficiário"><Input id="receipt-beneficiary-document" disabled={locked} value={form.beneficiaryDocument} onChange={(event) => setValue("beneficiaryDocument", formatDocumentInput(event.target.value))} className={controlClass} /></Field>
                      <Field id="receipt-relationship" label="Vínculo com o pagador"><Input id="receipt-relationship" disabled={locked} placeholder="Ex.: mãe, pai ou responsável" value={form.payerBeneficiaryRelationship} onChange={(event) => setValue("payerBeneficiaryRelationship", event.target.value)} className={controlClass} /></Field>
                    </div>
                  ) : null}
                </section>

                <section className="space-y-4 border-t border-border/55 pt-7">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">Serviço e pagamento</h3>
                  <Field id="receipt-service" label="Serviço"><Textarea id="receipt-service" disabled={locked} value={form.serviceDescription} onChange={(event) => setValue("serviceDescription", event.target.value)} className="min-h-24 rounded-xl bg-background/78" /></Field>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <Field id="receipt-service-date" label="Data do atendimento"><Input id="receipt-service-date" type="date" disabled={locked} value={form.serviceDate} onChange={(event) => setValue("serviceDate", event.target.value)} className={controlClass} /></Field>
                    <Field id="receipt-payment-date" label="Data do pagamento"><Input id="receipt-payment-date" type="date" disabled={locked} value={form.paymentDate} onChange={(event) => setValue("paymentDate", event.target.value)} className={controlClass} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <Field id="receipt-method" label="Método"><Input id="receipt-method" disabled={locked} value={form.paymentMethod} onChange={(event) => setValue("paymentMethod", event.target.value)} className={controlClass} /></Field>
                    <Field id="receipt-amount" label="Valor"><Input id="receipt-amount" inputMode="decimal" disabled={locked || Boolean(transaction)} value={form.amountInput} onChange={(event) => setValue("amountInput", formatMoneyInput(event.target.value))} className={`${controlClass} tabular-nums`} /></Field>
                  </div>
                  <Field id="receipt-installment" label="Parcela"><Input id="receipt-installment" disabled={locked} value={form.installmentLabel} onChange={(event) => setValue("installmentLabel", event.target.value)} className={controlClass} /></Field>
                  <Field id="receipt-related" label="Cobrança / movimento relacionado"><Input id="receipt-related" disabled={locked} value={form.relatedReference} onChange={(event) => setValue("relatedReference", event.target.value)} className={controlClass} /></Field>
                  <Field id="receipt-notes" label="Observação"><Textarea id="receipt-notes" disabled={locked} value={form.notes} onChange={(event) => setValue("notes", event.target.value)} className="min-h-20 rounded-xl bg-background/78" /></Field>
                </section>

                {form.fiscalMode === "individual" ? (
                  <section className="space-y-4 rounded-2xl border border-border/55 bg-muted/42 p-5">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">Preparar Receita Saúde</h3>
                      <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">O comprovante NeuroNex não substitui o Receita Saúde. Copie os campos para a emissão oficial e registre depois o identificador ou PDF.</p>
                    </div>
                    <CopyField label="CPF do pagador" value={form.payerDocument} />
                    {!form.samePerson ? <CopyField label="CPF do beneficiário" value={form.beneficiaryDocument} /> : null}
                    <CopyField label="Valor" value={formatCurrency(moneyInputToNumber(form.amountInput))} />
                    <CopyField label="Data do pagamento" value={formatReceiptDate(form.paymentDate)} />
                    <Field id="receipt-health-reference" label="Identificador do Receita Saúde"><Input id="receipt-health-reference" disabled={locked} value={form.receitaSaudeReference} onChange={(event) => setValue("receitaSaudeReference", event.target.value)} className={controlClass} /></Field>
                    <Field id="receipt-health-file" label="PDF emitido externamente" hint="O arquivo será vinculado quando o armazenamento imutável da fase backend estiver habilitado.">
                      <Input id="receipt-health-file" type="file" accept="application/pdf" disabled={locked} className="min-h-11 rounded-xl border-border/60 bg-background/78 file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-bold" onChange={(event) => setReceitaSaudeFileName(event.target.files?.[0]?.name || "")} />
                    </Field>
                    {receitaSaudeFileName ? <p className="text-[10px] font-bold text-muted-foreground">Selecionado: {receitaSaudeFileName}</p> : null}
                  </section>
                ) : form.fiscalMode === "company" ? (
                  <section className="space-y-4 rounded-2xl border border-border/55 bg-muted/42 p-5">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">Nota fiscal</h3>
                      <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">Este comprovante não substitui a NFS-e. Vincule a nota quando ela existir.</p>
                    </div>
                    <Field id="receipt-nfse-reference" label="Identificador da NFS-e"><Input id="receipt-nfse-reference" disabled={locked} value={form.nfseReference} onChange={(event) => setValue("nfseReference", event.target.value)} className={controlClass} /></Field>
                  </section>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent forceMount value="preview" className="m-0 h-full min-h-0 overflow-y-auto bg-muted/35 p-6 data-[state=inactive]:hidden xl:data-[state=inactive]:block lg:p-8">
              <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-[0_22px_60px_-38px_rgba(0,0,0,0.42)]">
                <BrandInvoiceTemplate data={issuedData || previewData} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <footer className="flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/55 bg-background/96 px-6 py-3 lg:px-8">
          <p className="max-w-xl text-[10px] font-medium leading-4 text-muted-foreground">
            {patientEmail ? `E-mail disponível: ${patientEmail}. ` : ""}Envio automático ficará disponível após o PDF ser armazenado com registro imutável.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-xl" disabled title="Disponível após o armazenamento imutável">
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> Enviar
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => void handlePrint()} disabled={!issuedData}>
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Imprimir
            </Button>
            <Button type="button" className="h-11 rounded-xl bg-foreground px-5 text-background hover:bg-foreground/90" onClick={() => void handleIssue()} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : issuedData ? <Download className="mr-2 h-4 w-4" aria-hidden="true" /> : <FileText className="mr-2 h-4 w-4" aria-hidden="true" />}
              {issuedData ? "Baixar novamente" : "Emitir comprovante"}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};
