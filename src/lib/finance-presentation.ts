import type { Transaction } from "@/types";

export const FINANCE_COLUMN_ORDER = [
  "patient",
  "description",
  "origin",
  "method",
  "competence",
  "status",
  "gross",
  "net",
  "actions",
] as const;

export type FinanceColumnId = (typeof FINANCE_COLUMN_ORDER)[number];

export type FinanceStatusCode =
  | "planned"
  | "pending"
  | "overdue"
  | "processing"
  | "confirmed"
  | "cancelled"
  | "reversal_pending"
  | "reversed"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "failed";

export type FinanceAvailabilityCode = "to_release" | "available" | "blocked" | "not_applicable";
export type FinanceOriginCode = "agenda" | "manual" | "neurofinance" | "insurance" | "package" | "recurrence" | "payment";
export type FinanceMethodCode =
  | "pix"
  | "boleto"
  | "card"
  | "cash"
  | "insurance"
  | "transfer"
  | "manual_settlement"
  | "to_define"
  | "unknown";
export type FinanceRecordKind =
  | "charge"
  | "management_entry"
  | "account_movement"
  | "insurance_cycle"
  | "recurrence"
  | "fee"
  | "withdrawal"
  | "refund"
  | "reversal"
  | "dispute";
export type FinanceAction =
  | "open"
  | "copy_link"
  | "sync"
  | "settle"
  | "cancel"
  | "reverse"
  | "refund"
  | "receipt"
  | "provider_receipt"
  | "invoice"
  | "nfse"
  | "open_patient"
  | "open_appointment"
  | "open_charge"
  | "open_movement";

export type FinanceColumnHelpContext =
  | "generic"
  | "management_charges"
  | "neurofinance_charges"
  | "management_entries"
  | "statement_realized"
  | "statement_future"
  | "statement_subscriptions";

export interface FinancePresentationRow {
  id: string;
  sourceId?: string | null;
  kind: FinanceRecordKind;
  direction: "income" | "expense";
  patientId?: string | null;
  patientName: string;
  description: string;
  typeLabel?: string | null;
  origin: FinanceOriginCode;
  method: FinanceMethodCode;
  competenceAt?: string | null;
  competenceLabel: string;
  status: FinanceStatusCode;
  availability: FinanceAvailabilityCode;
  grossAmount: number;
  feeAmount?: number | null;
  netAmount?: number | null;
  netApplicability: "known" | "pending" | "not_applicable";
  actions: FinanceAction[];
  links?: {
    paymentUrl?: string | null;
    receiptUrl?: string | null;
    invoiceUrl?: string | null;
    nfseUrl?: string | null;
    patientRoute?: string | null;
    appointmentRoute?: string | null;
    statementRoute?: string | null;
  };
  metadata?: Record<string, unknown>;
}

export const FINANCE_STATUS_META: Record<FinanceStatusCode, { label: string; description: string }> = {
  planned: { label: "Planejada", description: "Registro previsto, ainda não exigível." },
  pending: { label: "Pendente", description: "A operação aguarda pagamento ou conclusão." },
  overdue: { label: "Vencida", description: "O prazo passou sem confirmação." },
  processing: { label: "Em processamento", description: "A operação foi aceita e ainda está sendo concluída." },
  confirmed: { label: "Confirmada", description: "O pagamento ou movimento foi concluído. A disponibilidade do saldo aparece separadamente." },
  cancelled: { label: "Cancelada", description: "A operação foi encerrada antes da confirmação." },
  reversal_pending: { label: "Estorno em processamento", description: "A reversão foi iniciada e ainda não terminou." },
  reversed: { label: "Estornada", description: "O lançamento ou movimento original foi revertido." },
  refund_pending: { label: "Reembolso em processamento", description: "A devolução ao pagador foi iniciada." },
  refunded: { label: "Reembolsada", description: "O dinheiro foi devolvido ao pagador." },
  disputed: { label: "Contestada", description: "O pagamento está sob disputa no ecossistema do cartão." },
  failed: { label: "Não concluída", description: "A operação foi recusada ou encerrada com falha." },
};

export const FINANCE_AVAILABILITY_LABELS: Record<FinanceAvailabilityCode, string> = {
  to_release: "A liberar",
  available: "Disponível",
  blocked: "Bloqueado",
  not_applicable: "Não se aplica",
};

export const FINANCE_ORIGIN_LABELS: Record<FinanceOriginCode, string> = {
  agenda: "Agenda",
  manual: "Manual",
  neurofinance: "NeuroFinance",
  insurance: "Convênio",
  package: "Pacote",
  recurrence: "Recorrência",
  payment: "Pagamento",
};

export const FINANCE_METHOD_LABELS: Record<FinanceMethodCode, string> = {
  pix: "Pix",
  boleto: "Boleto",
  card: "Cartão",
  cash: "Dinheiro",
  insurance: "Convênio",
  transfer: "Transferência",
  manual_settlement: "Baixa manual",
  to_define: "A combinar",
  unknown: "Não informado",
};

const normalized = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isPastDate = (value?: string | null) => {
  if (!value) return false;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && key < new Date().toISOString().slice(0, 10);
};

export function normalizeFinanceStatus(
  rawStatus: unknown,
  options: { dueDate?: string | null; disputeStatus?: unknown; fundsStatus?: unknown; itemType?: unknown } = {},
): FinanceStatusCode {
  const status = normalized(rawStatus);
  const dispute = normalized(options.disputeStatus);
  const itemType = normalized(options.itemType);

  if (dispute && !["none", "resolved", "won", "closed"].includes(dispute)) return "disputed";
  if (status.includes("chargeback") || status.includes("dispute") || itemType.includes("chargeback") || itemType.includes("dispute")) return "disputed";
  if (["refund_requested", "refund_in_progress", "refunding"].includes(status)) return "refund_pending";
  if (["refunded", "partially_refunded", "refund_completed"].includes(status) || itemType.includes("refund")) return "refunded";
  if (["reversal_requested", "reversal_in_progress", "reversing"].includes(status)) return "reversal_pending";
  if (["reversed", "voided", "reversal_completed"].includes(status) || itemType.includes("reversal")) return "reversed";
  if (["cancelled", "canceled", "deleted"].includes(status)) return "cancelled";
  if (["failed", "error", "rejected", "refused", "denied"].includes(status)) return "failed";
  if (["overdue", "expired"].includes(status)) return "overdue";
  if (["processing", "in_process", "authorized", "awaiting_risk_analysis", "awaiting_action_authorization"].includes(status)) return "processing";
  if (["paid", "received", "confirmed", "completed", "settled", "posted", "available", "received_in_cash"].includes(status)) return "confirmed";
  if (status === "planned") return isPastDate(options.dueDate) ? "overdue" : "planned";
  if (isPastDate(options.dueDate)) return "overdue";
  return "pending";
}

export function normalizeFinanceOrigin(rawOrigin: unknown, options: { appointmentId?: string | null; isNeuroFinance?: boolean } = {}): FinanceOriginCode {
  const origin = normalized(rawOrigin);
  if (origin.includes("conven") || origin.includes("insurance")) return "insurance";
  if (origin.includes("package") || origin.includes("pacote")) return "package";
  if (origin.includes("recurr") || origin.includes("subscription") || origin.includes("assinatura")) return "recurrence";
  if (origin.includes("bill_payment") || origin === "payment" || origin.includes("pagamento")) return "payment";
  if (options.appointmentId || origin.includes("agenda") || origin.includes("appointment") || origin.includes("session")) return "agenda";
  if (options.isNeuroFinance || origin.includes("neurofinance") || origin.includes("gateway") || origin.includes("provider")) return "neurofinance";
  return "manual";
}

export function normalizeFinanceMethod(rawMethod: unknown): FinanceMethodCode {
  const method = normalized(rawMethod);
  if (method.includes("pix")) return "pix";
  if (method.includes("boleto") || method.includes("bank_slip")) return "boleto";
  if (method.includes("card") || method.includes("cart") || method.includes("credit") || method.includes("debit")) return "card";
  if (["cash", "money", "dinheiro"].includes(method)) return "cash";
  if (method.includes("conven") || method.includes("insurance")) return "insurance";
  if (method.includes("transfer") || method.includes("saque") || method.includes("payout")) return "transfer";
  if (method.includes("manual")) return "manual_settlement";
  if (method.includes("combinar") || method.includes("payment_link") || method.includes("link")) return "to_define";
  return "unknown";
}

export function normalizeFinanceAvailability(
  rawAvailability: unknown,
  options: { isNeuroFinance?: boolean; status?: FinanceStatusCode; availableAt?: string | null } = {},
): FinanceAvailabilityCode {
  if (!options.isNeuroFinance) return "not_applicable";
  if (options.status === "disputed") return "blocked";
  const availability = normalized(rawAvailability);
  if (availability.includes("block") || availability.includes("hold") || availability.includes("dispute")) return "blocked";
  if (availability.includes("available") || availability.includes("released")) return "available";
  if (options.availableAt && new Date(options.availableAt).getTime() <= Date.now()) return "available";
  if (options.status === "confirmed" || options.status === "processing" || options.status === "pending") return "to_release";
  return "not_applicable";
}

export function financeCompetenceLabel(value?: string | null) {
  if (!value) return "Não informada";
  const key = value.slice(0, 10);
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informada" : date.toLocaleDateString("pt-BR");
}

export function financeTypeLabel(value: unknown) {
  const type = normalized(value);
  if (type.includes("subscription") || type.includes("assinatura") || type.includes("recurr")) return "Assinatura";
  if (type.includes("installment") || type.includes("parcela")) return "Parcelada";
  if (type.includes("appointment") || type.includes("sessao") || type.includes("agenda")) return "Sessão";
  if (type.includes("package") || type.includes("pacote")) return "Pacote";
  if (type.includes("insurance") || type.includes("conven")) return "Convênio";
  if (type.includes("manual")) return "Manual";
  return "Avulsa";
}

function metadataString(transaction: Transaction, keys: string[]) {
  const metadata = (transaction.metadata || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function financePresentationFromTransaction(
  transaction: Transaction,
  options: { context?: FinanceColumnHelpContext; isFuture?: boolean } = {},
): FinancePresentationRow {
  const metadata = (transaction.metadata || {}) as Record<string, unknown>;
  const itemType = metadataString(transaction, ["item_type", "provider_type"]);
  const isNeuroFinance = transaction.origin === "gateway_auto" || Boolean(metadata.source === "neurofinance" || metadata.asaas_payment_id || metadata.neurofinance_transaction_id);
  const status = normalizeFinanceStatus(
    metadataString(transaction, ["financial_entry_status", "provider_status", "normalized_status"]) || transaction.status,
    {
      dueDate: metadataString(transaction, ["due_date", "provider_due_date"]),
      disputeStatus: metadata.dispute_status,
      fundsStatus: metadata.funds_status,
      itemType,
    },
  );
  const method = normalizeFinanceMethod(
    metadataString(transaction, ["financial_entry_payment_method", "payment_method", "billing_type", "provider_type"]) || transaction.payment_method,
  );
  const rawOrigin = transaction.type === "expense" && method === "boleto"
    ? "payment"
    : metadataString(transaction, ["financial_entry_origin", "origin", "source"]);
  const origin = normalizeFinanceOrigin(rawOrigin, {
    appointmentId: transaction.appointment_id,
    isNeuroFinance: isNeuroFinance && rawOrigin !== "payment",
  });
  const competenceAt = options.isFuture
    ? metadataString(transaction, ["estimated_credit_at", "available_at", "due_date", "expires_at"]) || transaction.date
    : transaction.date;
  const feeCents = Number(metadata.actual_fee_amount_cents ?? metadata.estimated_fee_amount_cents ?? metadata.fee_amount_cents);
  const feeDirect = Number(metadata.actual_fee_amount ?? metadata.estimated_fee_amount ?? metadata.fee_amount);
  const netCents = Number(metadata.net_amount_cents ?? metadata.net_value_cents);
  const netDirect = Number(metadata.net_amount ?? metadata.net_value);
  const hasFeeCents = Number.isFinite(feeCents);
  const hasFeeDirect = Number.isFinite(feeDirect);
  const hasNetCents = Number.isFinite(netCents);
  const hasNetDirect = Number.isFinite(netDirect);
  const feeAmount = hasFeeCents ? feeCents / 100 : hasFeeDirect ? feeDirect : null;
  const netAmount = hasNetCents ? netCents / 100 : hasNetDirect ? netDirect : feeAmount != null ? Math.max(0, transaction.amount - feeAmount) : null;
  const availability = normalizeFinanceAvailability(metadata.funds_status, {
    isNeuroFinance,
    status,
    availableAt: metadataString(transaction, ["available_at", "estimated_credit_at"]),
  });
  const category = normalized(transaction.category);
  const kind: FinanceRecordKind = category.includes("fee") || category.includes("tarifa")
    ? "fee"
    : status === "disputed"
      ? "dispute"
      : status === "refunded" || status === "refund_pending"
        ? "refund"
        : status === "reversed" || status === "reversal_pending"
          ? "reversal"
          : isNeuroFinance
            ? "account_movement"
            : "management_entry";

  const actions: FinanceAction[] = ["open"];
  if (status === "confirmed") actions.push("receipt");
  if (transaction.receipt_url) actions.push("provider_receipt");
  if (transaction.invoice_url || transaction.bank_slip_url) actions.push("invoice");
  if (transaction.patient_id) actions.push("open_patient");
  if (transaction.appointment_id) actions.push("open_appointment");

  return {
    id: transaction.id,
    sourceId: transaction.id,
    kind,
    direction: transaction.type,
    patientId: transaction.patient_id || null,
    patientName: transaction.patient_name || transaction.patients?.name || "Sem paciente",
    description: transaction.description || "Movimentação sem descrição",
    typeLabel: transaction.category || null,
    origin,
    method,
    competenceAt,
    competenceLabel: financeCompetenceLabel(competenceAt),
    status,
    availability,
    grossAmount: Math.abs(Number(transaction.amount || 0)),
    feeAmount: feeAmount == null ? null : Math.abs(feeAmount),
    netAmount,
    netApplicability: isNeuroFinance ? (netAmount == null ? "pending" : "known") : "not_applicable",
    actions,
    links: {
      receiptUrl: transaction.receipt_url || transaction.attachment_url || null,
      invoiceUrl: transaction.invoice_url || transaction.bank_slip_url || null,
      patientRoute: transaction.patient_id ? `/patients/${transaction.patient_id}` : null,
      appointmentRoute: transaction.appointment_id ? `/agenda?appointment=${transaction.appointment_id}` : null,
    },
    metadata,
  };
}

const BASE_COLUMN_HELP: Record<FinanceColumnId, { title: string; body: string }> = {
  patient: { title: "Paciente", body: "Mostra quem está vinculado a este dinheiro. Quando não existe vínculo clínico, a lista diz Sem paciente." },
  description: { title: "Descrição", body: "É o nome humano da operação: sessão, pacote, mensalidade, Pix, tarifa, saque ou outro fato financeiro." },
  origin: { title: "Origem", body: "Explica onde o registro nasceu: Agenda, Manual, NeuroFinance, Pagamento, Convênio, Pacote ou Recorrência." },
  method: { title: "Método", body: "Explica como o dinheiro entra ou sai, sem esconder Pix, boleto, cartão, convênio, transferência ou baixa manual." },
  competence: { title: "Competência", body: "É a data que explica o fato financeiro neste contexto." },
  status: { title: "Status", body: "Mostra o ponto atual do ciclo. Disponibilidade para saque aparece separadamente e não é presumida pelo status." },
  gross: { title: "Valor", body: "É o valor de face da operação, antes de tarifas, antecipações, estornos ou reembolsos." },
  net: { title: "Líquido", body: "É o valor efetivo depois de tarifas e ajustes. Quando ainda não existe cálculo confiável, aparece A calcular." },
  actions: { title: "Ações", body: "Reúne apenas o que pode ser feito agora, como abrir, copiar, sincronizar, cancelar, estornar, reembolsar ou emitir documento." },
};

export function getFinanceColumnHelp(column: FinanceColumnId, context: FinanceColumnHelpContext = "generic") {
  if (column === "competence") {
    if (context === "statement_realized") return { title: "Competência", body: "No extrato realizado, é a data em que o movimento aconteceu na conta." };
    if (context === "statement_future" || context === "statement_subscriptions") return { title: "Competência", body: "Nesta previsão, é a data esperada de crédito ou o vencimento que organiza o valor futuro." };
    if (context === "management_charges" || context === "neurofinance_charges") return { title: "Competência", body: "Nas cobranças, corresponde ao vencimento usado para organizar o que está pendente, vencido ou confirmado." };
  }
  if (column === "net" && (context === "management_charges" || context === "management_entries")) {
    return { title: "Líquido", body: "Na Gestão, este campo não se aplica quando não há processamento pela conta digital. O valor de face continua em Valor." };
  }
  return BASE_COLUMN_HELP[column];
}
