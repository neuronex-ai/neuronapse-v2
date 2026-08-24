"use client";
import { useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Landmark,
  MoreHorizontal,
  Plus,
  Search,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { ChargesWorkspace } from "@/components/financeiro/ChargesWorkspace";
import { FinanceDataTable } from "@/components/financeiro/shared/FinanceDataTable";
import { FinancialSettlementModal } from "@/components/financeiro/FinancialSettlementModal";
import { ManualChargeModal } from "@/components/financeiro/ManualChargeModal";
import { NewTransactionModal } from "@/components/financeiro/NewTransactionModal";
import {
  SYNAPSE_PAGE_ACTION_EVENT,
  type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";
import {
  ConventionAndTransfersView,
  ManagementRecurrenceView,
} from "@/components/financeiro/management/ManagementSpecializedViews";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import {
  DesktopMiniStat,
  DesktopWorkspaceIcon,
  DesktopWorkspacePanel,
  DesktopWorkspaceShell,
} from "@/components/ui/desktop-workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fromPlanningCents,
  useFinancialPlanning,
} from "@/hooks/use-financial-planning";
import {
  buildFinancialManagementMetrics,
  managementCategoryOf,
  managementAllowsManualSettlement,
  managementDateKeyOf,
  managementOriginOf,
  managementOutstandingAmountOf,
  managementStatusOf,
  monthKeyFromDate,
  type FinancialBasis,
} from "@/lib/financial-management-model";
import { financeCompetenceLabel, financePresentationFromTransaction } from "@/lib/finance-presentation";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import type { FinanceView } from "../FinancialDashboard";

const FINANCE_PANEL_SURFACE =
  "finance-panel border-border/55 bg-background/[0.82] dark:border-white/[0.075] dark:bg-zinc-900/[0.68] dark:ring-white/[0.018]";

const MANAGEMENT_VIEW_CONTEXT: Partial<Record<FinanceView, { title: string; description: string }>> = {
  "gestao-visao-geral": { title: "Visão geral", description: "Resultado, previsões e pendências do consultório." },
  "gestao-cobrancas": { title: "Cobranças manuais", description: "Crie e acompanhe cobranças gerenciais sem misturá-las ao extrato bancário." },
  "gestao-lancamentos": { title: "Lançamentos", description: "Consulte entradas e saídas registradas na gestão." },
  "gestao-recebimentos": { title: "Recebimentos", description: "Acompanhe baixas e valores ainda em aberto." },
  "gestao-repasses-convenio": { title: "Repasses e convênio", description: "Somente cobranças vinculadas a uma configuração estruturada de convênio." },
  "gestao-recorrencia": { title: "Recorrência", description: "Controle entradas e saídas periódicas da clínica e pessoais." },
  "gestao-planejamento": { title: "Planejamento", description: "Defina metas e limites para o período selecionado." },
};

export interface NeuroFinanceManagementContext {
  enabled: boolean;
  connected: boolean;
  balance?: number;
  pending?: number;
  isStale?: boolean;
  lastUpdatedAt?: string | null;
}
type Props = {
  activeView: FinanceView;
  setActiveView: (v: FinanceView) => void;
  allTransactions: Transaction[];
  managementTransactions?: Transaction[];
  realizedTransactions: Transaction[];
  futureTransactions: Transaction[];
  subscriptionTransactions: Transaction[];
  isLoadingTransactions: boolean;
  setSelectedTransaction: (t: Transaction | null) => void;
  neurofinance?: NeuroFinanceManagementContext;
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(v) ? v : 0);
const amount = (t: Transaction) => Math.abs(Number(t.amount || 0));
const ENTRIES_PAGE_SIZE = 20;
const date = (t: Transaction, b: FinancialBasis) => {
  const k = managementDateKeyOf(t, b);
  return k ? k.split("-").reverse().join("/") : "Sem data";
};
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DesktopWorkspacePanel className={cn(FINANCE_PANEL_SURFACE, "rounded-[30px] p-6 lg:p-7")}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </DesktopWorkspacePanel>
  );
}
function Rows({
  rows,
  basis,
  onOpen,
  onSettle,
}: {
  rows: Transaction[];
  basis: FinancialBasis;
  onOpen: (t: Transaction) => void;
  onSettle?: (t: Transaction) => void;
}) {
  const transactionById = new Map(rows.map((transaction) => [transaction.id, transaction]));
  const presentationRows = rows.map((transaction) => {
    const competenceAt = managementDateKeyOf(transaction, basis);
    const presentation = financePresentationFromTransaction(transaction, { context: "management_entries" });
    return {
      ...presentation,
      typeLabel: managementCategoryOf(transaction),
      competenceAt,
      competenceLabel: financeCompetenceLabel(competenceAt),
    };
  });

  return (
    <FinanceDataTable
      rows={presentationRows}
      context="management_entries"
      emptyTitle="Nenhum lançamento neste recorte"
      emptyDescription="Ajuste o período ou registre uma receita ou despesa."
      renderActions={(row) => {
        const transaction = transactionById.get(row.sourceId || row.id);
        if (!transaction) return null;
        const canSettle = managementOutstandingAmountOf(transaction) > 0 && Boolean(onSettle) && managementAllowsManualSettlement(transaction);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="ml-auto h-11 w-11 rounded-xl" aria-label={`Ações de ${row.description}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="finance-panel w-56 rounded-[16px] border-border/55 p-2">
              <DropdownMenuItem className="min-h-11 rounded-xl font-semibold" onSelect={() => onOpen(transaction)}>Abrir detalhe</DropdownMenuItem>
              {canSettle ? <DropdownMenuItem className="min-h-11 rounded-xl font-semibold" onSelect={() => onSettle?.(transaction)}>Registrar baixa</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    />
  );
}
function Planning({
  month,
  metrics,
}: {
  month: Date;
  metrics: ReturnType<typeof buildFinancialManagementMetrics>;
}) {
  const p = useFinancialPlanning(month);
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setRevenue(
      p.goal
        ? String(fromPlanningCents(p.goal.revenue_goal_cents)).replace(".", ",")
        : "",
    );
    setExpenses(
      p.goal
        ? String(fromPlanningCents(p.goal.expense_limit_cents)).replace(
            ".",
            ",",
          )
        : "",
    );
    setNotes(p.goal?.notes || "");
  }, [p.goal, p.monthKey]);
  const parse = (x: string) =>
    Number(x.replace(/\./g, "").replace(",", ".")) || 0;
  const save = async () => {
    try {
      await p.saveGoal.mutateAsync({
        revenueGoal: parse(revenue),
        expenseLimit: parse(expenses),
        desiredProfit: Math.max(0, parse(revenue) - parse(expenses)),
        targetSessions: 0,
        notes,
      });
      toast.success("Planejamento salvo.");
    } catch {
      toast.error("Não foi possível salvar.");
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <DesktopWorkspacePanel highContrast className="rounded-[30px] border-foreground/90 p-7 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.52)] dark:border-white/90 dark:shadow-[0_24px_64px_-42px_rgba(0,0,0,0.96)]">
          <Target className="h-5 w-5 opacity-60" />
          <p className="mt-10 text-sm opacity-60">Meta mensal</p>
          <p className="mt-2 text-4xl font-bold">{money(parse(revenue))}</p>
          <p className="mt-3 text-sm opacity-60">
            Realizado: {money(metrics.received)}
          </p>
        </DesktopWorkspacePanel>
        <Panel title="Metas do período">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Meta de receita</Label>
              <Input
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
            <div>
              <Label>Limite de despesas</Label>
              <Input
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="mt-5 min-h-11" onClick={save}>
            Salvar
          </Button>
        </Panel>
      </div>
    </div>
  );
}
export const FinancialManagementDashboard = (props: Props) => {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [basis, setBasis] = useState<FinancialBasis>("cash");
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [settlement, setSettlement] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [entriesPage, setEntriesPage] = useState(1);
  const rows = props.managementTransactions || props.allTransactions;
  const metrics = useMemo(
    () =>
      buildFinancialManagementMetrics(rows, {
        monthKey: monthKeyFromDate(month),
        todayKey: format(new Date(), "yyyy-MM-dd"),
        basis,
      }),
    [rows, month, basis],
  );
  const overdueInsurance = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return rows.filter((transaction) => {
      const origin = String(transaction.origin || (transaction.metadata as Record<string, unknown> | null)?.financial_entry_origin || "").toLowerCase();
      const dueDate = String((transaction.metadata as Record<string, unknown> | null)?.due_date || transaction.date || "").slice(0, 10);
      return transaction.type === "income" && ["convenio", "insurance"].includes(origin) && managementOutstandingAmountOf(transaction) > 0 && Boolean(dueDate && dueDate < today);
    });
  }, [rows]);
  const aliases: Partial<Record<FinanceView, FinanceView>> = {
    "gestao-fluxo-caixa": "gestao-visao-geral",
    "gestao-receitas": "gestao-lancamentos",
    "gestao-despesas": "gestao-lancamentos",
    "gestao-inadimplencia": "gestao-recebimentos",
    "gestao-relatorios": "gestao-lancamentos",
  };
  const view = aliases[props.activeView] || props.activeView;
  const viewContext = MANAGEMENT_VIEW_CONTEXT[view] || MANAGEMENT_VIEW_CONTEXT["gestao-visao-geral"]!;
  const showPeriodControls = [
    "gestao-visao-geral",
    "gestao-lancamentos",
    "gestao-recebimentos",
    "gestao-repasses-convenio",
    "gestao-planejamento",
  ].includes(view);
  const showEntryActions = ["gestao-visao-geral", "gestao-lancamentos"].includes(view);
  const showChargeAction = view === "gestao-visao-geral";
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return rows;
    return rows.filter((transaction) =>
      `${transaction.description} ${transaction.patient_name || transaction.patients?.name || ""} ${transaction.category || ""} ${managementOriginOf(transaction)}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [rows, search]);
  const entriesPageCount = Math.max(1, Math.ceil(filtered.length / ENTRIES_PAGE_SIZE));
  const visibleEntries = useMemo(
    () => filtered.slice((entriesPage - 1) * ENTRIES_PAGE_SIZE, entriesPage * ENTRIES_PAGE_SIZE),
    [entriesPage, filtered],
  );

  useEffect(() => {
    setEntriesPage(1);
  }, [basis, search]);

  useEffect(() => {
    setEntriesPage((current) => Math.min(current, entriesPageCount));
  }, [entriesPageCount]);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (action?.action === "open_modal" && action.modal === "new_charge") {
        setChargeOpen(true);
      }
    };

    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  const openEntry = (type: "income" | "expense") => {
    setEntryType(type);
    setEntryOpen(true);
  };
  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Data", "Descrição", "Tipo", "Categoria", "Origem", "Status", "Valor"],
      ...filtered.map((t) => [
        date(t, basis),
        t.description,
        t.type,
        t.category,
        managementOriginOf(t),
        managementStatusOf(t),
        amount(t),
      ]),
    ]
      .map((r) => r.map(q).join(";"))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\ufeff${csv}`], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestao-financeira-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (props.isLoadingTransactions)
    return (
      <div className="p-7">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  return (
    <div className="p-4 sm:p-5 lg:p-6 2xl:p-7">
      <NewTransactionModal
        open={entryOpen}
        onOpenChange={setEntryOpen}
        showTrigger={false}
        defaultType={entryType}
      />
      <ManualChargeModal open={chargeOpen} onOpenChange={setChargeOpen} />
      <FinancialSettlementModal
        transaction={settlement}
        open={Boolean(settlement)}
        onOpenChange={(v) => {
          if (!v) setSettlement(null);
        }}
      />
      <DesktopWorkspaceShell className="finance-frame rounded-[32px] border-border/45 bg-background/70 p-4 dark:border-white/[0.065] dark:bg-black/[0.32] dark:ring-white/[0.018] md:p-5 lg:p-6">
        <div className="finance-panel mb-5 flex flex-wrap items-center gap-4 rounded-[28px] border border-border/55 bg-background/[0.8] p-5 dark:border-white/[0.075] dark:bg-zinc-900/[0.68] lg:p-6">
          <DesktopWorkspaceIcon icon={CircleDollarSign} className="finance-inset dark:border-white/[0.07] dark:bg-white/[0.035]" />
          <div className="min-w-48 flex-1">
            <h1 className="text-xl font-bold">{viewContext.title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{viewContext.description}</p>
          </div>
          {showPeriodControls ? <div className="finance-inset flex min-h-12 items-center rounded-[16px] border border-border/60 bg-background/[0.55] p-0.5 dark:border-white/[0.07] dark:bg-white/[0.025]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 text-center text-sm capitalize">
              {format(month, "MMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div> : null}
          {showPeriodControls ? <MagneticSegmentedControl
            id="financial-management-basis"
            indicatorId="financial-management-basis-indicator"
            value={basis}
            onValueChange={setBasis}
            ariaLabel="Regime de apuração financeira"
            behavior="single-select"
            options={[
              { value: "cash", label: "Caixa" },
              { value: "competence", label: "Competência" },
            ]}
            className="finance-inset h-12 min-h-12 shrink-0 rounded-[16px] border-border/60 bg-background/[0.55] p-0.5 dark:border-white/[0.07] dark:bg-white/[0.025]"
            triggerClassName="h-11 min-h-11 rounded-lg px-3 py-0 text-xs"
          /> : null}
          {showEntryActions ? <Button variant="outline" className="min-h-11" onClick={() => openEntry("expense")}>
            <ArrowDownRight className="mr-2 h-4 w-4" />
            Despesa
          </Button> : null}
          {showEntryActions ? <Button variant="outline" className="min-h-11" onClick={() => openEntry("income")}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Receita
          </Button> : null}
          {showChargeAction ? <Button className="min-h-11" onClick={() => setChargeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cobrança
          </Button> : null}
        </div>
        <div key={view} className="animate-fade-in motion-reduce:animate-none">
        {view === "gestao-visao-geral" ? (
          <div data-synapse-target="finance-overview" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <DesktopMiniStat
                className="finance-kpi finance-kpi-accent p-5 dark:border-white/90 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                accent
                label="Resultado"
                value={compact(metrics.result)}
                detail={
                  basis === "cash" ? "Regime de caixa" : "Regime de competência"
                }
              />
              <DesktopMiniStat
                className="finance-kpi p-5 dark:border-white/[0.075] dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                tone="success"
                label="Recebido"
                value={compact(metrics.received)}
              />
              <DesktopMiniStat
                className="finance-kpi p-5 dark:border-white/[0.075] dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                label="Despesas pagas"
                value={compact(metrics.paidExpenses)}
              />
              <DesktopMiniStat
                className="finance-kpi p-5 dark:border-white/[0.075] dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                tone={metrics.overdueCount ? "warning" : "default"}
                label="A receber"
                value={compact(metrics.receivable)}
                detail={`${metrics.overdueCount} vencida(s)`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <button type="button" onClick={() => props.setActiveView("gestao-recebimentos")} className="finance-inset flex min-h-[104px] items-center gap-4 rounded-[20px] border border-border/55 bg-background/[0.5] p-5 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.07] dark:bg-white/[0.025]">
                <AlertTriangle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1"><b className="block text-sm">Cobranças vencidas</b><span className="mt-1 block text-xs text-muted-foreground">{metrics.overdueCount} operação(ões) · {money(metrics.overdueAmount)}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => props.setActiveView("gestao-repasses-convenio")} className="finance-inset flex min-h-[104px] items-center gap-4 rounded-[20px] border border-border/55 bg-background/[0.5] p-5 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.07] dark:bg-white/[0.025]">
                <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1"><b className="block text-sm">Convênio em atraso</b><span className="mt-1 block text-xs text-muted-foreground">{overdueInsurance.length} ciclo(s) aguardando operadora</span></span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => props.setActiveView("conta-digital")} className="finance-inset flex min-h-[104px] items-center gap-4 rounded-[20px] border border-border/55 bg-background/[0.5] p-5 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.07] dark:bg-white/[0.025]">
                <CircleDollarSign className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1"><b className="block text-sm">Saldo NeuroFinance</b><span className="mt-1 block text-xs text-muted-foreground">{props.neurofinance?.connected ? money(props.neurofinance.balance || 0) : "Conta não conectada"}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
              <Panel title="Movimentações recentes">
                <Rows
                  rows={metrics.recent}
                  basis={basis}
                  onOpen={props.setSelectedTransaction}
                  onSettle={setSettlement}
                />
              </Panel>
              <Panel title="Precisa de atenção">
                {metrics.attention.length ? (
                  <div className="space-y-2">
                    {metrics.attention.map((x) => (
                      <button
                        key={x.id}
                        onClick={() =>
                          props.setSelectedTransaction(x.transaction)
                        }
                        className="finance-inset flex min-h-14 w-full items-center gap-4 rounded-[16px] border border-border/55 p-4 text-left transition-[background-color,transform] duration-150 hover:bg-muted/45 active:scale-[0.995] dark:border-white/[0.07] dark:hover:bg-white/[0.045] motion-reduce:transition-none motion-reduce:active:scale-100"
                      >
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{x.title}</b>
                          <span className="text-xs text-muted-foreground">
                            {x.detail}
                          </span>
                        </span>
                        <b className="text-sm">{money(x.amount)}</b>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                    Tudo em ordem
                  </div>
                )}
              </Panel>
            </div>
          </div>
        ) : null}
        {view === "gestao-lancamentos" ? (
          <div data-synapse-target="finance-entries">
          <Panel
            title="Lançamentos"
            action={
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            }
          >
            <div className="relative mb-5">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descrição, paciente ou categoria"
              />
            </div>
            <Rows
              rows={visibleEntries}
              basis={basis}
              onOpen={props.setSelectedTransaction}
              onSettle={setSettlement}
            />
            <div className="mt-5 flex flex-col gap-3 border-t border-border/55 pt-5 text-xs font-semibold text-muted-foreground dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
              <span>
                {filtered.length === 0
                  ? "Nenhum lançamento encontrado"
                  : `${(entriesPage - 1) * ENTRIES_PAGE_SIZE + 1}–${Math.min(entriesPage * ENTRIES_PAGE_SIZE, filtered.length)} de ${filtered.length} lançamentos`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  aria-label="Página anterior de lançamentos"
                  onClick={() => setEntriesPage((current) => Math.max(1, current - 1))}
                  disabled={entriesPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-14 text-center text-[10px] font-black uppercase tracking-widest">
                  {entriesPage}/{entriesPageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  aria-label="Próxima página de lançamentos"
                  onClick={() => setEntriesPage((current) => Math.min(entriesPageCount, current + 1))}
                  disabled={entriesPage >= entriesPageCount}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Panel>
          </div>
        ) : null}
        {view === "gestao-cobrancas" ? (
          <div data-synapse-target="finance-charges">
            <ChargesWorkspace
              scope="management"
              title="Cobranças manuais"
              initialTypeFilters={["manual"]}
            />
          </div>
        ) : null}
        {view === "gestao-recebimentos" ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              <DesktopMiniStat
                className="finance-kpi p-5 dark:border-white/[0.075] dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                tone={metrics.overdueCount ? "warning" : "default"}
                label="Vencidas"
                value={metrics.overdueCount}
                detail={money(metrics.overdueAmount)}
              />
              <DesktopMiniStat
                className="finance-kpi p-5 dark:border-white/[0.075] dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                label="A vencer"
                value={
                  metrics.openIncomeTransactions.length - metrics.overdueCount
                }
              />
              <DesktopMiniStat
                className="finance-kpi finance-kpi-accent p-5 dark:border-white/90 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)] lg:p-6"
                accent
                label="Total em aberto"
                value={compact(metrics.receivable)}
                detail="Considera baixas parciais"
              />
            </div>
            <Panel title="Recebimentos em aberto">
              <Rows
                rows={metrics.openIncomeTransactions}
                basis="competence"
                onOpen={props.setSelectedTransaction}
                onSettle={setSettlement}
              />
            </Panel>
          </div>
        ) : null}
        {view === "gestao-repasses-convenio" ? (
          <ConventionAndTransfersView
            transactions={rows}
            onOpen={props.setSelectedTransaction}
            onSettle={setSettlement}
          />
        ) : null}
        {view === "gestao-recorrencia" ? (
          <ManagementRecurrenceView
            transactions={rows}
            onOpen={props.setSelectedTransaction}
          />
        ) : null}
        {view === "gestao-planejamento" ? (
          <Planning month={month} metrics={metrics} />
        ) : null}
        </div>
      </DesktopWorkspaceShell>
    </div>
  );
};
export default FinancialManagementDashboard;
