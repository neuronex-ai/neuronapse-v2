import type { ReceiptPDFData } from "@/lib/pdf-types";

export type ReceiptFiscalMode = ReceiptPDFData["fiscalMode"];

export function receiptReference(sourceId: string) {
  const normalized = sourceId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `NNX-${(normalized || "SEMREFERENCIA").slice(0, 14)}`;
}

export function receiptFiscalNotice(mode: ReceiptFiscalMode) {
  if (mode === "individual") {
    return "Este documento NeuroNex comprova o pagamento, mas não substitui o recibo oficial emitido no Receita Saúde quando ele for exigido para o profissional pessoa física.";
  }
  if (mode === "company") {
    return "Este comprovante de pagamento não substitui a Nota Fiscal de Serviço eletrônica (NFS-e). Consulte o vínculo fiscal indicado neste documento.";
  }
  return "Este é um comprovante de pagamento NeuroNex. A obrigação fiscal aplicável deve ser verificada conforme o enquadramento do emissor.";
}

export function formatReceiptDate(value?: string | Date | null) {
  if (!value) return "Data não informada";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : date.toLocaleDateString("pt-BR");
}

export function isCpf(value: string) {
  return value.replace(/\D/g, "").length === 11;
}

export function isCnpj(value: string) {
  return value.replace(/\D/g, "").length === 14;
}
