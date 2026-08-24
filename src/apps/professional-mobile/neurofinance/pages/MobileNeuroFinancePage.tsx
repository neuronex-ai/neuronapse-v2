import { type ReactNode, useEffect, useMemo, useState } from "react";
import { addYears, format, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Barcode,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Landmark,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  QrCode,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { UpsellModal } from "@/components/subscription";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/context/SubscriptionContext";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useInvoicesPage } from "@/hooks/use-invoices";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { useNeuroFinanceStatement } from "@/hooks/use-neurofinance-statement";
import { usePatients } from "@/hooks/use-patients";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { MobileLayout } from "@/mobile/components/MobileLayout";
import type { Invoice, Transaction } from "@/types";

import {
  MobileActionButton,
  MobileEmptyState,
  MobileFinanceButton,
  MobileFinanceHero,
  MobileFinanceIconButton,
  MobileFinanceListRow,
  MobileFinanceSheet,
  MobileFinanceTabs,
  MobileSectionTitle,
  formatMoney,
  mobileFinanceSurface,
} from "../../shared/MobileFinancePrimitives";
import { MobileBillPaymentFlow } from "../components/MobileBillPaymentFlow";
import { MobileChargeFlow } from "../components/MobileChargeFlow";
import { MobileNeuroFinanceOnboardingSheet } from "../components/MobileNeuroFinanceOnboardingSheet";
import { MobilePixPaymentFlow } from "../components/MobilePixPaymentFlow";
import { MobileTransferFlow } from "../components/MobileTransferFlow";

type FinanceArea = "management" | "neurofinance";
type Flow = "charge" | "bill" | "pix-payment" | "pix-transfer" | "bank-payout" | null;
type ActivityView = "statement" | "charges";
type StatementFilter = "all" | "income" | "expense" | "pending";
type ChargeStatus = "all" | "pending" | "overdue" | "paid" | "cancelled";
type DetailList = "income" | "expense" | "pending" | null;

type MobileStatementTransaction = Transaction & {
  created_at?: string | Date | null;
  available_at?: string | Date | null;
};

const home = "/financeiro/neurofinance";

function flowFromPath(pathname: string): Flow {
  if (pathname.endsWith("/cobrar")) return "charge";
  if (pathname.endsWith("/pagamentos/boleto")) return "bill";
  if (pathname.endsWith("/pix/pagar")) return "pix-payment";
  if (pathname.endsWith("/transferir")) return "pix-transfer";
  if (pathname.endsWith("/saque")) return "bank-payout";
  return null;
}

const formatStatementDate = (transaction: MobileStatementTransaction) => {
  const rawDate = transaction.date || transaction.created_at;
  if (!rawDate) return "Recente";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "Recente";
  return format(date, "d MMM, HH:mm", { locale: ptBR });
};

const healthCopy = {
  active: { title: "Conta ativa", description: "Pix, boletos, cobranças e repasses liberados.", tone: "success" },
  account_missing: { title: "Conta desconectada", description: "A subconta precisa de suporte para reconectar.", tone: "danger" },
  restricted: { title: "Regularização pendente", description: "Resolva as etapas abertas para liberar operações.", tone: "warning" },
  pending_review: { title: "Conta em análise", description: "Aguardando retorno da verificação cadastral.", tone: "info" },
  onboarding: { title: "Dados em andamento", description: "Finalize as informações solicitadas.", tone: "warning" },
  pending: { title: "Validação pendente", description: "Estamos acompanhando o retorno do provedor.", tone: "info" },
  not_started: { title: "Onboarding não iniciado", description: "Abra a conta para liberar saldo real.", tone: "warning" },
  disabled: { title: "Conta restrita", description: "Operações temporariamente indisponíveis.", tone: "danger" },
};

const healthToneClass = {
  success: "border-emerald-500/20 bg-emerald-500/[0.075] text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/[0.075] text-amber-700 dark:text-amber-300",
  danger: "border-red-500/20 bg-red-500/[0.075] text-red-700 dark:text-red-300",
  info: "border-blue-500/20 bg-blue-500/[0.075] text-blue-700 dark:text-blue-300",
} as const;

const stageToneClass = {
  approved: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  pending: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  review: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  rejected: "bg-red-500/12 text-red-600 dark:text-red-300",
  missing: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  neutral: "bg-foreground/[0.06] text-muted-foreground",
} as const;

const chargeStatusCopy: Record<string, { label: string; tone: "success" | "warning" | "danger" | "default" }> = {
  paid: { label: "Recebida", tone: "success" },
  received: { label: "Recebida", tone: "success" },
  confirmed: { label: "Recebida", tone: "success" },
  overdue: { label: "Vencida", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "default" },
  canceled: { label: "Cancelada", tone: "default" },
  pending: { label: "Pendente", tone: "warning" },
  processing: { label: "Em processamento", tone: "warning" },
};

const statementStatusCopy: Record<string, string> = {
  paid: "Pago",
  received: "Recebido",
  confirmed: "Confirmado",
  completed: "Processada",
  processed: "Processada",
  pending: "Pendente",
  scheduled: "Agendada",
  overdue: "Vencida",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  failed: "Falhou",
  refunded: "Estornada",
};

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";

const statementStatusLabel = (transaction: MobileStatementTransaction) => {
  const raw = String(transaction.status || "").toLowerCase();
  return statementStatusCopy[raw] || transaction.category || "Processada";
};

const invoiceStatusLabel = (status?: string | null) => {
  const raw = String(status || "pending").toLowerCase();
  return chargeStatusCopy[raw]?.label || statementStatusCopy[raw] || "Pendente";
};

const getTransactionDocumentUrl = (transaction: MobileStatementTransaction, kind: "receipt" | "invoice") => {
  const metadata = ((transaction as { metadata?: Record<string, unknown> | null }).metadata || {}) as Record<string, unknown>;
  if (kind === "receipt") {
    return firstString(
      transaction.receipt_url,
      metadata.receipt_url,
      metadata.transaction_receipt_url,
      metadata.asaas_transaction_receipt_url,
      transaction.attachment_url,
    );
  }

  return firstString(
    transaction.invoice_url,
    transaction.bank_slip_url,
    metadata.invoice_url,
    metadata.checkout_url,
    metadata.payment_url,
    metadata.bank_slip_url,
    metadata.asaas_invoice_url,
    metadata.asaas_bank_slip_url,
  );
};

const getInvoiceDocumentUrl = (invoice: Invoice, kind: "receipt" | "invoice") => {
  const data = invoice as Invoice & {
    receipt_url?: string | null;
    bank_slip_url?: string | null;
    invoice_url?: string | null;
    checkout_url?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  const metadata = data.metadata || {};
  if (kind === "receipt") {
    return firstString(data.receipt_url, metadata.receipt_url, metadata.transaction_receipt_url, metadata.asaas_transaction_receipt_url);
  }
  return firstString(
    data.bank_slip_url,
    data.pdf_url,
    data.invoice_url,
    data.payment_url,
    data.checkout_url,
    metadata.bank_slip_url,
    metadata.asaas_bank_slip_url,
    metadata.invoice_url,
    metadata.checkout_url,
    metadata.payment_url,
  );
};

const openDocument = (url: string, unavailableMessage: string) => {
  if (!url) {
    toast.info(unavailableMessage);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const shareText = async ({
  title,
  text,
  url,
  email,
  channel = "share",
}: {
  title: string;
  text: string;
  url?: string;
  email?: string | null;
  channel?: "share" | "email";
}) => {
  if (channel === "email") {
    if (!email) {
      toast.info("E-mail do paciente indisponível.");
      return;
    }
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}${url ? `\n${url}` : ""}`)}`;
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}${url ? `\n${url}` : ""}`)}`, "_blank", "noopener,noreferrer");
};

export function MobileNeuroFinancePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const account = useFinancialAccount();
  const balance = useNeuroFinanceBalance();
  const { data: profile } = useProfile();
  const { data: patients = [] } = usePatients();
  const { isLoading: subscriptionLoading, canAccess, isDevAccount, isTrial } = useSubscription();
  const statementStart = useMemo(() => subMonths(new Date(), 6), []);
  const statementEnd = useMemo(() => addYears(new Date(), 2), []);
  const statement = useNeuroFinanceStatement(statementStart, statementEnd);
  const [showBalance, setShowBalance] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [activityView, setActivityView] = useState<ActivityView>("statement");
  const [statementFilter, setStatementFilter] = useState<StatementFilter>("all");
  const [chargeStatus, setChargeStatus] = useState<ChargeStatus>("all");
  const [actionSheet, setActionSheet] = useState<ActivityView | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<MobileStatementTransaction | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailList, setDetailList] = useState<DetailList>(null);

  const routeFlow = flowFromPath(location.pathname);
  const approved = account.isApproved;
  const canUseNeuroFinance = isDevAccount || (!isTrial && canAccess("advanced_finance"));
  const shouldShowOnboarding = canUseNeuroFinance && (account.needsInitialOnboarding || account.isAccountMissing);
  const psychologistName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    (profile as { full_name?: string } | undefined)?.full_name ||
    "Psicólogo";
  const patientsById = useMemo(
    () => new Map((patients as Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null }>).map((patient) => [patient.id, patient])),
    [patients],
  );

  const invoicesQuery = useInvoicesPage({
    page: 1,
    pageSize: 30,
    status: chargeStatus === "all" ? undefined : [chargeStatus],
  });

  const transactions = useMemo(
    () => ((statement.data || []) as MobileStatementTransaction[]),
    [statement.data],
  );

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((transaction) => {
      const isFuture = transaction.status === "pending" || isAfter(new Date(transaction.date), now);
      if (statementFilter === "pending") return isFuture;
      if (statementFilter === "income") return transaction.type === "income" && !isFuture;
      if (statementFilter === "expense") return transaction.type === "expense" && !isFuture;
      return !isFuture || transaction.status === "completed";
    });
  }, [statementFilter, transactions]);

  const detailTransactions = useMemo(() => {
    if (!detailList) return [];
    return transactions.filter((transaction) => {
      if (detailList === "pending") return transaction.status === "pending" || isAfter(new Date(transaction.date), new Date());
      return transaction.type === detailList;
    });
  }, [detailList, transactions]);

  const invoices = invoicesQuery.data?.invoices || [];
  const availableBalance = Number(balance.data?.balance || 0);
  const pendingBalance = Number(balance.data?.pending || 0);
  const totalReceived = Number(balance.data?.totalReceived || 0);
  const paidOut = Number(balance.data?.paidOut || 0);
  const healthKey = (account.uiStatus || "not_started") as keyof typeof healthCopy;
  const health = healthCopy[healthKey] || healthCopy.not_started;
  const HealthIcon = approved ? CheckCircle2 : account.isRestricted || account.isAccountMissing ? AlertCircle : Clock3;

  useEffect(() => {
    if (shouldShowOnboarding) setOnboardingOpen(true);
  }, [shouldShowOnboarding]);

  const openFlow = (flow: Exclude<Flow, null>) => {
    const routes: Record<Exclude<Flow, null>, string> = {
      charge: `${home}/cobrar`,
      bill: `${home}/pagamentos/boleto`,
      "pix-payment": `${home}/pix/pagar`,
      "pix-transfer": `${home}/transferir`,
      "bank-payout": `${home}/saque`,
    };
    navigate(routes[flow]);
  };

  const closeFlow = () => navigate(home);
  const switchArea = (area: FinanceArea) => navigate(area === "management" ? "/financeiro" : "/financeiro/neurofinance");

  const refresh = async () => {
    try {
      await balance.syncNow();
      await statement.refetch();
      await invoicesQuery.refetch();
      await account.refetch();
      toast.success("NeuroFinance atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar agora.");
    }
  };

  const exportPdf = (view: ActivityView) => {
    toast.info(`Preparando ${view === "statement" ? "extrato" : "cobranças"} para PDF.`);
    window.print();
  };

  if (account.isLoading || subscriptionLoading) {
    return (
      <MobileLayout className="min-h-screen bg-background px-5">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MobileLayout>
    );
  }

  if (!canUseNeuroFinance) {
    return (
      <MobileLayout className="min-h-screen bg-background px-0">
        <div className="mobile-scroll-owner h-full overflow-y-auto px-5 pb-32 pt-3">
          <MobileFinanceTabs
            value="neurofinance"
            onValueChange={switchArea}
            options={[
              { value: "management", label: "Gestão", description: "Controle", icon: TrendingUp },
              { value: "neurofinance", label: "NeuroFinance", description: "Conta", icon: Wallet },
            ]}
            className="sticky top-2 z-30"
          />
          <section className={cn(mobileFinanceSurface, "mt-5 overflow-hidden p-5")}>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="mt-6 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Plano Professional</p>
            <h1 className="mt-2 text-3xl font-black leading-[0.92] tracking-[-0.06em]">NeuroFinance libera dinheiro real.</h1>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-muted-foreground/70">
              A Gestão Financeira continua disponível durante o teste grátis. Para criar conta NeuroFinance, pagar Pix, boletos, sacar e receber saldo real, mantenha uma assinatura ativa.
            </p>
            <Button onClick={() => setUpsellOpen(true)} className="mt-6 h-14 w-full rounded-[20px] text-[10px] font-black uppercase tracking-[0.16em]">
              Ver planos
            </Button>
          </section>
        </div>
        <UpsellModal feature="advanced_finance" open={upsellOpen} onOpenChange={setUpsellOpen} />
      </MobileLayout>
    );
  }

  if (shouldShowOnboarding) {
    return (
      <MobileLayout className="min-h-screen bg-background px-0">
        <div className="mobile-scroll-owner h-full overflow-y-auto px-5 pb-32 pt-3">
          <MobileFinanceTabs
            value="neurofinance"
            onValueChange={switchArea}
            options={[
              { value: "management", label: "Gestão", description: "Controle", icon: TrendingUp },
              { value: "neurofinance", label: "NeuroFinance", description: "Conta", icon: Wallet },
            ]}
            className="sticky top-2 z-30"
          />
          <section className={cn(mobileFinanceSurface, "mt-5 p-5 text-center")}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-foreground text-background">
              <Landmark className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-black leading-[0.92] tracking-[-0.06em]">Crie sua conta NeuroFinance.</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-relaxed text-muted-foreground/70">
              Envie os dados pelo celular para liberar cobranças, Pix, boletos, saques e saldo real.
            </p>
            <Button onClick={() => setOnboardingOpen(true)} className="mt-6 h-14 w-full rounded-[20px] text-[10px] font-black uppercase tracking-[0.16em]">
              Começar onboarding
            </Button>
          </section>
        </div>
        <MobileNeuroFinanceOnboardingSheet
          open={onboardingOpen}
          onOpenChange={setOnboardingOpen}
          onComplete={() => void refresh()}
        />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout className="min-h-screen bg-background px-0">
      <div className="mobile-scroll-owner h-full overflow-y-auto overflow-x-hidden px-5 pb-32 pt-3">
        <div className="space-y-5">
          <MobileFinanceTabs
            value="neurofinance"
            onValueChange={switchArea}
            options={[
              { value: "management", label: "Gestão", description: "Controle", icon: TrendingUp },
              { value: "neurofinance", label: "NeuroFinance", description: "Conta", icon: Wallet },
            ]}
            className="sticky top-2 z-30"
          />

          <MobileFinanceHero
            eyebrow="Saldo disponível"
            title={psychologistName}
            value={balance.isLoading ? "..." : showBalance ? formatMoney(availableBalance) : "R$ ******"}
            description={showBalance ? `${formatMoney(pendingBalance)} a liberar.` : "Saldo oculto nesta sessão."}
            tone={approved ? "default" : "warning"}
            action={
              <div className="flex items-center gap-2">
                <MobileFinanceIconButton
                  icon={showBalance ? EyeOff : Eye}
                  label={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                  onClick={() => setShowBalance((value) => !value)}
                  className="h-10 w-10 rounded-[14px] border-foreground/10 bg-background/70"
                />
                <MobileFinanceIconButton
                  icon={RefreshCw}
                  label="Atualizar NeuroFinance"
                  onClick={() => void refresh()}
                  className="h-10 w-10 rounded-[14px] border-foreground/10 bg-background/70"
                />
              </div>
            }
          />

          <div className="-mt-2 -mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 px-1">
              <MiniMetric label="Entrou" value={totalReceived} hidden={!showBalance} icon={ArrowUpRight} onClick={() => setDetailList("income")} />
              <MiniMetric label="Saiu" value={paidOut} hidden={!showBalance} icon={ArrowDownRight} onClick={() => setDetailList("expense")} />
              <MiniMetric label="Vai cair" value={pendingBalance} hidden={!showBalance} icon={Calendar} onClick={() => setDetailList("pending")} />
            </div>
          </div>

          <section className="space-y-4">
            <MobileSectionTitle title="Ações" />
            <div className="grid grid-cols-2 gap-3">
              <MobileActionButton label="Cobrar" description="Pix ou boleto" icon={Receipt} tone="success" onClick={() => openFlow("charge")} disabled={!approved} />
              <MobileActionButton label="Pagar boleto" description="Agora ou agendar" icon={Barcode} onClick={() => openFlow("bill")} disabled={!approved} />
              <MobileActionButton label="Pagar Pix" description="Copia e Cola" icon={QrCode} onClick={() => openFlow("pix-payment")} disabled={!approved} />
              <MobileActionButton label="Transferir Pix" description="Chave validada" icon={Send} onClick={() => openFlow("pix-transfer")} disabled={!approved} />
              <MobileActionButton label="Minha conta" description="Conta cadastrada" icon={Landmark} onClick={() => openFlow("bank-payout")} disabled={!approved} />
              <MobileActionButton label="Gestão" description="Controle" icon={CircleDollarSign} onClick={() => navigate("/financeiro")} />
            </div>
          </section>

          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setStatusExpanded((value) => !value)}
              className={cn(mobileFinanceSurface, "flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]")}
              aria-expanded={statusExpanded}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]", healthToneClass[health.tone as keyof typeof healthToneClass])}>
                <HealthIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/55">Status da conta</span>
                <span className="mt-1 block truncate text-sm font-black">{health.title}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", statusExpanded && "rotate-180")} />
            </button>
            {statusExpanded ? (
              <div className={cn(mobileFinanceSurface, "space-y-3 p-4")}>
                <p className="text-xs font-semibold leading-relaxed text-muted-foreground/70">{health.description}</p>
                <div className="grid gap-2">
                  {(account.approvalStages || []).slice(0, 5).map((stage) => (
                    <div key={stage.id} className="flex items-center gap-3 rounded-[16px] border border-border/35 bg-background/55 p-3 dark:border-white/10 dark:bg-white/[0.025]">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]", stageToneClass[stage.tone as keyof typeof stageToneClass] || stageToneClass.neutral)}>
                        {stage.tone === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-black text-foreground">{stage.label}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{stage.statusLabel}</p>
                      </div>
                      {stage.actionable ? <span className="rounded-full bg-amber-500/12 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-amber-600 dark:text-amber-300">Ação</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <MobileSectionTitle
              title="Extrato"
              trailing={
                <MobileFinanceIconButton
                  icon={MoreHorizontal}
                  label="Ações"
                  onClick={() => setActionSheet(activityView)}
                  className="h-10 w-10 rounded-[14px]"
                />
              }
            />
            <MobileFinanceTabs
              value={activityView}
              onValueChange={(value) => setActivityView(value as ActivityView)}
              options={[
                { value: "statement", label: "Extrato", description: `${filteredTransactions.length} itens`, icon: FileText },
                { value: "charges", label: "Cobranças", description: `${invoices.length} itens`, icon: Receipt },
              ]}
            />
            {activityView === "statement" ? (
              <StatementList
                isLoading={statement.isLoading}
                transactions={filteredTransactions.slice(0, 18)}
                hidden={!showBalance}
                onOpen={setSelectedTransaction}
              />
            ) : (
              <ChargesList
                isLoading={invoicesQuery.isLoading}
                invoices={invoices}
                hidden={!showBalance}
                onOpen={setSelectedInvoice}
              />
            )}
          </section>
        </div>
      </div>

      <ActivityActionsSheet
        view={actionSheet}
        statementFilter={statementFilter}
        chargeStatus={chargeStatus}
        onStatementFilter={setStatementFilter}
        onChargeStatus={setChargeStatus}
        onExport={exportPdf}
        onClose={() => setActionSheet(null)}
      />
      <TransactionDetailSheet transaction={selectedTransaction} hidden={!showBalance} onOpenChange={(open) => !open && setSelectedTransaction(null)} />
      <InvoiceDetailSheet invoice={selectedInvoice} patient={selectedInvoice ? patientsById.get(selectedInvoice.patient_id) : null} hidden={!showBalance} onOpenChange={(open) => !open && setSelectedInvoice(null)} />
      <MetricDetailSheet kind={detailList} transactions={detailTransactions} hidden={!showBalance} onOpenChange={(open) => !open && setDetailList(null)} />

      <MobileChargeFlow open={routeFlow === "charge"} onOpenChange={(open) => !open && closeFlow()} onCompleted={() => void refresh()} />
      <MobileBillPaymentFlow open={routeFlow === "bill"} onOpenChange={(open) => !open && closeFlow()} onCompleted={() => void refresh()} />
      <MobilePixPaymentFlow open={routeFlow === "pix-payment"} onOpenChange={(open) => !open && closeFlow()} onCompleted={() => void refresh()} />
      <MobileTransferFlow open={routeFlow === "pix-transfer"} onOpenChange={(open) => !open && closeFlow()} purpose="transfer" onCompleted={() => void refresh()} />
      <MobileTransferFlow open={routeFlow === "bank-payout"} onOpenChange={(open) => !open && closeFlow()} purpose="payout" onCompleted={() => void refresh()} />
    </MobileLayout>
  );
}

function MiniMetric({ label, value, hidden, icon, onClick }: { label: string; value: number; hidden: boolean; icon: typeof ArrowUpRight; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-[118px] shrink-0 rounded-[16px] border border-border/35 bg-background/80 p-2.5 text-left shadow-sm backdrop-blur-xl transition active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04]">
      <span className="flex h-7 w-7 items-center justify-center rounded-[11px] bg-foreground/[0.055] text-foreground">
        {(() => {
          const Icon = icon;
          return <Icon className="h-3.5 w-3.5" />;
        })()}
      </span>
      <p className="mt-2 text-[7px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">{label}</p>
      <p className="mt-1 truncate text-base font-black tracking-[-0.04em]">{hidden ? "R$ ******" : formatMoney(value)}</p>
    </button>
  );
}

function StatementList({ isLoading, transactions, hidden, onOpen }: { isLoading: boolean; transactions: MobileStatementTransaction[]; hidden: boolean; onOpen: (transaction: MobileStatementTransaction) => void }) {
  if (isLoading) return <LoadingCard />;
  if (transactions.length === 0) return <MobileEmptyState icon={FileText} title="Nenhuma movimentação" description="Operações confirmadas aparecem aqui." />;

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const income = transaction.type === "income";
        const amount = Math.abs(Number(transaction.amount || 0));
        return (
          <MobileFinanceListRow
            key={transaction.id}
            icon={income ? ArrowUpRight : ArrowDownRight}
            title={transaction.description || "Movimentação"}
            description={statementStatusLabel(transaction)}
            meta={formatStatementDate(transaction)}
            value={hidden ? "******" : `${income ? "+" : "-"} ${formatMoney(amount)}`}
            tone={income ? "success" : "danger"}
            valueMuted={hidden}
            onClick={() => onOpen(transaction)}
          />
        );
      })}
    </div>
  );
}

function ChargesList({ isLoading, invoices, hidden, onOpen }: { isLoading: boolean; invoices: Invoice[]; hidden: boolean; onOpen: (invoice: Invoice) => void }) {
  if (isLoading) return <LoadingCard />;
  if (invoices.length === 0) return <MobileEmptyState icon={Receipt} title="Nenhuma cobrança" description="Cobranças geradas pelo NeuroFinance aparecem aqui." />;

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => {
        const status = String((invoice as { status?: string }).status || "pending").toLowerCase();
        const copy = chargeStatusCopy[status] || chargeStatusCopy.pending;
        return (
          <MobileFinanceListRow
            key={invoice.id}
            icon={Receipt}
            title={invoice.description || "Cobrança NeuroFinance"}
            description={copy.label}
            meta={invoice.due_date ? `Vence ${format(new Date(invoice.due_date), "dd/MM")}` : "Sem vencimento"}
            value={hidden ? "******" : formatMoney(Number(invoice.amount || 0))}
            tone={copy.tone}
            valueMuted={hidden}
            onClick={() => onOpen(invoice)}
          />
        );
      })}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className={cn(mobileFinanceSurface, "flex h-28 items-center justify-center")}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function ActivityActionsSheet({
  view,
  statementFilter,
  chargeStatus,
  onStatementFilter,
  onChargeStatus,
  onExport,
  onClose,
}: {
  view: ActivityView | null;
  statementFilter: StatementFilter;
  chargeStatus: ChargeStatus;
  onStatementFilter: (filter: StatementFilter) => void;
  onChargeStatus: (status: ChargeStatus) => void;
  onExport: (view: ActivityView) => void;
  onClose: () => void;
}) {
  const open = Boolean(view);
  return (
    <MobileFinanceSheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} contentClassName="h-auto max-h-[82dvh]">
      {view ? (
        <div className="py-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Ações</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">{view === "statement" ? "Extrato" : "Cobranças"}</h2>
            </div>
            <Filter className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-6 space-y-3">
            {view === "statement" ? (
              <ToggleGrid
                value={statementFilter}
                options={[
                  ["all", "Todos"],
                  ["income", "Entradas"],
                  ["expense", "Saídas"],
                  ["pending", "A cair"],
                ]}
                onChange={(value) => onStatementFilter(value as StatementFilter)}
              />
            ) : (
              <ToggleGrid
                value={chargeStatus}
                options={[
                  ["all", "Todas"],
                  ["pending", "Pendentes"],
                  ["overdue", "Vencidas"],
                  ["paid", "Recebidas"],
                  ["cancelled", "Canceladas"],
                ]}
                onChange={(value) => onChargeStatus(value as ChargeStatus)}
              />
            )}
            <MobileFinanceButton variant="secondary" className="w-full" onClick={() => onExport(view)}>
              <Download className="h-4 w-4" />
              Exportar PDF
            </MobileFinanceButton>
          </div>
        </div>
      ) : null}
    </MobileFinanceSheet>
  );
}

function ToggleGrid({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "min-h-12 rounded-[16px] border px-3 text-[10px] font-black uppercase tracking-[0.12em] transition active:scale-[0.98]",
            value === id ? "border-foreground bg-foreground text-background" : "border-border/40 bg-card/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TransactionDetailSheet({ transaction, hidden, onOpenChange }: { transaction: MobileStatementTransaction | null; hidden: boolean; onOpenChange: (open: boolean) => void }) {
  const receiptUrl = transaction ? getTransactionDocumentUrl(transaction, "receipt") : "";
  const invoiceUrl = transaction ? getTransactionDocumentUrl(transaction, "invoice") : "";
  const patientEmail =
    transaction?.patients?.email ||
    (transaction as (MobileStatementTransaction & { patient_email?: string | null }) | null)?.patient_email ||
    null;
  const documentText = transaction
    ? `${transaction.description || "Movimentação NeuroFinance"} - ${formatMoney(Math.abs(Number(transaction.amount || 0)))}`
    : "";

  return (
    <MobileFinanceSheet open={Boolean(transaction)} onOpenChange={onOpenChange} contentClassName="h-auto max-h-[82dvh]">
      {transaction ? (
        <DetailContent
          eyebrow="Movimentação"
          title={transaction.description || "Movimentação NeuroFinance"}
          amount={hidden ? "******" : formatMoney(Math.abs(Number(transaction.amount || 0)))}
          rows={[
            ["Tipo", transaction.type === "income" ? "Entrada" : "Saída"],
            ["Status", statementStatusLabel(transaction)],
            ["Data", formatStatementDate(transaction)],
            ["Categoria", transaction.category || "NeuroFinance"],
          ]}
          actions={
            <DetailActions
              receiptUrl={receiptUrl}
              invoiceUrl={invoiceUrl}
              shareTitle="Movimentação NeuroFinance"
              shareText={documentText}
              email={patientEmail}
            />
          }
        />
      ) : null}
    </MobileFinanceSheet>
  );
}

function InvoiceDetailSheet({
  invoice,
  patient,
  hidden,
  onOpenChange,
}: {
  invoice: Invoice | null;
  patient?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  hidden: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const receiptUrl = invoice ? getInvoiceDocumentUrl(invoice, "receipt") : "";
  const invoiceUrl = invoice ? getInvoiceDocumentUrl(invoice, "invoice") : "";
  const paymentUrl = invoice ? firstString(invoice.payment_url, invoiceUrl) : "";
  const patientName = patient?.name || "paciente";
  const shareMessage = invoice
    ? `Olá ${patientName.split(" ")[0]}! Segue sua cobrança NeuroFinance (${formatMoney(Number(invoice.amount || 0))}).`
    : "";

  return (
    <MobileFinanceSheet open={Boolean(invoice)} onOpenChange={onOpenChange} contentClassName="h-auto max-h-[82dvh]">
      {invoice ? (
        <DetailContent
          eyebrow="Cobrança"
          title={invoice.description || "Cobrança NeuroFinance"}
          amount={hidden ? "******" : formatMoney(Number(invoice.amount || 0))}
          rows={[
            ["Status", invoiceStatusLabel(invoice.status)],
            ["Vencimento", invoice.due_date ? format(new Date(invoice.due_date), "dd/MM/yyyy") : "Sem data"],
            ["Número", invoice.invoice_number || invoice.id],
            ["Link", paymentUrl ? "Disponível" : "Indisponível"],
          ]}
          actions={
            <DetailActions
              receiptUrl={receiptUrl}
              invoiceUrl={invoiceUrl}
              shareTitle="Cobrança NeuroFinance"
              shareText={shareMessage}
              shareUrl={paymentUrl}
              email={patient?.email}
            />
          }
        />
      ) : null}
    </MobileFinanceSheet>
  );
}

function MetricDetailSheet({ kind, transactions, hidden, onOpenChange }: { kind: DetailList; transactions: MobileStatementTransaction[]; hidden: boolean; onOpenChange: (open: boolean) => void }) {
  const title = kind === "income" ? "Quanto entrou" : kind === "expense" ? "Quanto saiu" : "Quanto vai cair";
  return (
    <MobileFinanceSheet open={Boolean(kind)} onOpenChange={onOpenChange} contentClassName="h-[82dvh]">
      <div className="py-7">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Detalhes</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">{title}</h2>
        <div className="mt-6 space-y-2">
          {transactions.length === 0 ? (
            <MobileEmptyState icon={FileText} title="Sem registros" description="Nenhuma movimentação encontrada para este grupo." />
          ) : (
            transactions.slice(0, 30).map((transaction) => {
              const income = transaction.type === "income";
              const amount = Math.abs(Number(transaction.amount || 0));
              return (
                <MobileFinanceListRow
                  key={transaction.id}
                  icon={income ? ArrowUpRight : ArrowDownRight}
                  title={transaction.description || "Movimentação"}
                  description={statementStatusLabel(transaction)}
                  meta={formatStatementDate(transaction)}
                  value={hidden ? "******" : `${income ? "+" : "-"} ${formatMoney(amount)}`}
                  tone={income ? "success" : "danger"}
                  valueMuted={hidden}
                />
              );
            })
          )}
        </div>
      </div>
    </MobileFinanceSheet>
  );
}

function DetailActions({
  receiptUrl,
  invoiceUrl,
  shareTitle,
  shareText: text,
  shareUrl,
  email,
}: {
  receiptUrl: string;
  invoiceUrl: string;
  shareTitle: string;
  shareText: string;
  shareUrl?: string;
  email?: string | null;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-2">
      <MobileFinanceButton variant="secondary" className="h-12" onClick={() => openDocument(receiptUrl, "Recibo ainda não disponível.")}>
        <Receipt className="h-4 w-4" />
        Recibo
      </MobileFinanceButton>
      <MobileFinanceButton variant="secondary" className="h-12" onClick={() => openDocument(invoiceUrl, "Fatura ainda não disponível.")}>
        <FileText className="h-4 w-4" />
        Fatura
      </MobileFinanceButton>
      <MobileFinanceButton
        variant="secondary"
        className="h-12"
        onClick={() => void shareText({ title: shareTitle, text, url: shareUrl })}
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </MobileFinanceButton>
      <MobileFinanceButton
        variant="secondary"
        className="h-12"
        onClick={() => void shareText({ title: shareTitle, text, url: shareUrl, email, channel: "email" })}
      >
        <Mail className="h-4 w-4" />
        Gmail
      </MobileFinanceButton>
    </div>
  );
}

function DetailContent({ eyebrow, title, amount, rows, actions }: { eyebrow: string; title: string; amount: string; rows: Array<[string, string]>; actions?: ReactNode }) {
  return (
    <div className="py-7">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.05em]">{title}</h2>
      <p className="mt-5 text-4xl font-black tracking-[-0.06em]">{amount}</p>
      <div className="mt-6 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-[16px] border border-border/35 bg-card/70 p-3 dark:border-white/10 dark:bg-white/[0.035]">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
            <span className="max-w-[58%] truncate text-right text-xs font-black">{value || "-"}</span>
          </div>
        ))}
      </div>
      {actions}
    </div>
  );
}
