import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  FileBarChart,
  Landmark,
  ListChecks,
  Plus,
  Scale,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useFinancialMetrics } from "@/hooks/use-financial-metrics";
import { useTransactions } from "@/hooks/use-transactions";
import { cn } from "@/lib/utils";
import { MobileLayout } from "@/mobile/components/MobileLayout";

import { MobileFinancialEntrySheet } from "../components/MobileFinancialEntrySheet";
import {
  MobileActionButton,
  MobileEmptyState,
  MobileFinanceButton,
  MobileFinanceHero,
  MobileFinanceIconButton,
  MobileFinanceInsightStrip,
  MobileFinanceListRow,
  MobileFinanceTabs,
  MobileMetricCard,
  MobileSectionTitle,
  formatMoney,
} from "../../shared/MobileFinancePrimitives";

type EntryType = "income" | "expense";
type FinanceArea = "management" | "neurofinance";
type TransactionFilter = "all" | "income" | "expense";
type MobileFinanceTransaction = {
  id: string;
  type?: string | null;
  amount?: number | string | null;
  date?: string | Date | null;
  created_at?: string | Date | null;
  description?: string | null;
  category?: string | null;
};

const filters: Array<{ value: TransactionFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Despesas" },
];

const formatTransactionDate = (transaction: MobileFinanceTransaction) => {
  const rawDate = transaction.date || transaction.created_at;
  if (!rawDate) return "Recente";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "Recente";
  return format(date, "d MMM, HH:mm", { locale: ptBR });
};

const getTransactionTime = (transaction: MobileFinanceTransaction) => {
  const rawDate = transaction.date || transaction.created_at;
  if (!rawDate) return 0;
  const time = new Date(rawDate).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function MobileFinancialManagementPage() {
  const navigate = useNavigate();
  const { data: metrics, isLoading } = useFinancialMetrics();
  const { data: transactionData = [] } = useTransactions(subMonths(new Date(), 3));
  const transactions = transactionData as MobileFinanceTransaction[];
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>("income");
  const [filter, setFilter] = useState<TransactionFilter>("all");

  const recent = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            getTransactionTime(b) -
            getTransactionTime(a),
        )
        .slice(0, 16),
    [transactions],
  );

  const visibleTransactions = useMemo(
    () =>
      recent.filter((transaction) => {
        if (filter === "all") return true;
        return transaction.type === filter;
      }),
    [filter, recent],
  );

  const result = Number(metrics?.netProfit || 0);
  const pendingInvoices = Number(metrics?.pendingInvoices || 0);
  const resultTone = result >= 0 ? "success" : "warning";

  const openEntry = (type: EntryType) => {
    setEntryType(type);
    setEntryOpen(true);
  };

  const switchArea = (area: FinanceArea) => {
    navigate(area === "management" ? "/financeiro" : "/financeiro/neurofinance");
  };

  return (
    <MobileLayout className="min-h-screen bg-background px-0">
      <div className="mobile-scroll-owner h-full overflow-y-auto overflow-x-hidden px-5 pb-32 pt-3">
        <div className="space-y-5">
          <MobileFinanceTabs
            value="management"
            onValueChange={switchArea}
            options={[
              {
                value: "management",
                label: "Gestão",
                description: "Controle",
                icon: TrendingUp,
              },
              {
                value: "neurofinance",
                label: "NeuroFinance",
                description: "Conta",
                icon: Wallet,
              },
            ]}
            className="sticky top-2 z-30"
          />

          <MobileFinanceHero
            eyebrow="Resultado do mês"
            title="Gestão Financeira"
            value={isLoading ? "—" : formatMoney(result)}
            description={
              result >= 0
                ? "Resultado positivo neste periodo."
                : "Revise despesas e pendencias."
            }
            icon={Scale}
            tone="default"
            action={
              <MobileFinanceIconButton
                icon={Plus}
                label="Novo lancamento"
                onClick={() => openEntry("income")}
                className="h-10 w-10 rounded-[14px] border-foreground/10 bg-background/70"
              />
            }
          >
            <div className="grid grid-cols-2 gap-2.5">
              <MobileFinanceButton
                variant="primary"
                onClick={() => openEntry("income")}
              >
                <ArrowUpRight className="h-4 w-4" />
                Entrada
              </MobileFinanceButton>
              <MobileFinanceButton
                variant="secondary"
                className="border-foreground/10 bg-background/70 text-foreground"
                onClick={() => openEntry("expense")}
              >
                <ArrowDownRight className="h-4 w-4" />
                Despesa
              </MobileFinanceButton>
            </div>
          </MobileFinanceHero>

          <section className="grid grid-cols-2 gap-3">
            <MobileMetricCard
              label="Recebido"
              value={isLoading ? "—" : formatMoney(metrics?.currentMonthRevenue)}
              caption="Confirmado"
              icon={ArrowUpRight}
              tone="success"
              onClick={() => setFilter("income")}
            />
            <MobileMetricCard
              label="A receber"
              value={isLoading ? "—" : formatMoney(metrics?.projectedRevenue)}
              caption={`${pendingInvoices} pend.`}
              icon={WalletCards}
              tone={pendingInvoices > 0 ? "warning" : "default"}
              onClick={() =>
                toast.info(
                  `${pendingInvoices} pendência(s) identificada(s) neste período.`,
                )
              }
            />
            <MobileMetricCard
              label="Despesas"
              value={isLoading ? "—" : formatMoney(metrics?.currentMonthExpenses)}
              caption="Registradas"
              icon={ArrowDownRight}
              tone="danger"
              onClick={() => setFilter("expense")}
            />
            <MobileMetricCard
              label="Resultado"
              value={isLoading ? "—" : formatMoney(metrics?.netProfit)}
              caption="Saldo do mes"
              icon={CircleDollarSign}
              tone={resultTone}
            />
          </section>

          <MobileFinanceInsightStrip
            items={[
              {
                label: "Pendências",
                value: `${pendingInvoices}`,
                icon: ListChecks,
                tone: pendingInvoices > 0 ? "warning" : "success",
              },
              {
                label: "Synapse",
                value: "Análise",
                icon: Bot,
              },
              {
                label: "Relatório",
                value: "Mensal",
                icon: FileBarChart,
              },
            ]}
          />

          <section className="space-y-4">
            <MobileSectionTitle
              title="Ações principais"
            />
            <div className="grid grid-cols-2 gap-3">
              <MobileActionButton
                label="Registrar entrada"
                description="Receita manual"
                icon={ArrowUpRight}
                tone="success"
                onClick={() => openEntry("income")}
              />
              <MobileActionButton
                label="Registrar despesa"
                description="Custo externo"
                icon={ArrowDownRight}
                tone="danger"
                onClick={() => openEntry("expense")}
              />
              <MobileActionButton
                label="Ver pendências"
                description="A receber"
                icon={ListChecks}
                badge={`${pendingInvoices}`}
                tone={pendingInvoices > 0 ? "warning" : "default"}
                onClick={() =>
                  toast.info(
                    `${pendingInvoices} pendência(s) identificada(s) neste período.`,
                  )
                }
              />
              <MobileActionButton
                label="Analisar caixa"
                description="Synapse"
                icon={Bot}
                onClick={() => navigate("/synapse-ai")}
              />
            </div>
          </section>

          <section>
            <MobileFinanceListRow
              icon={Landmark}
              title="NeuroFinance"
              description="Pix, boleto, transferencias e saldo real."
              meta="Conta protegida por biometria/PIN"
              status="Conta"
              onClick={() => navigate("/financeiro/neurofinance")}
            />
          </section>

          <section className="space-y-4">
            <MobileSectionTitle
              title="Lançamentos recentes"
              trailing={
                <MobileFinanceButton
                  variant="ghost"
                  className="min-h-9 px-2.5"
                  onClick={() => navigate("/synapse-ai")}
                >
                  Relatório
                </MobileFinanceButton>
              }
            />

            <div className="-mx-5 overflow-x-auto px-5 pb-1 no-scrollbar">
              <div className="flex gap-2">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      "min-h-10 shrink-0 rounded-[13px] px-4 text-[8px] font-black uppercase tracking-[0.12em] transition",
                      filter === item.value
                        ? "bg-foreground text-background"
                        : "border border-border/40 bg-card/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {visibleTransactions.length === 0 ? (
              <MobileEmptyState
                icon={ListChecks}
                title="Nenhum lançamento por aqui"
                description="Registre uma entrada ou despesa."
                action={
                  <MobileFinanceButton onClick={() => openEntry("income")}>
                    <Plus className="h-4 w-4" />
                    Novo lançamento
                  </MobileFinanceButton>
                }
              />
            ) : (
              <div className="space-y-2">
                {visibleTransactions.slice(0, 10).map((transaction) => {
                  const income = transaction.type === "income";
                  const amount = Math.abs(Number(transaction.amount || 0));

                  return (
                    <MobileFinanceListRow
                      key={transaction.id}
                      icon={income ? ArrowUpRight : ArrowDownRight}
                      title={transaction.description || "Lançamento"}
                      description={transaction.category || "Sem categoria"}
                      meta={formatTransactionDate(transaction)}
                      value={`${income ? "+" : "−"} ${formatMoney(amount)}`}
                      tone={income ? "success" : "danger"}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <MobileFinancialEntrySheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        defaultType={entryType}
      />
    </MobileLayout>
  );
}
