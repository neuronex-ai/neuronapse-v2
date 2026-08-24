import { useMemo, useState } from "react";
import { addYears, format, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Eye, EyeOff, FileText, Loader2, RefreshCw, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { useNeuroFinanceStatement } from "@/hooks/use-neurofinance-statement";
import { cn, formatCurrency } from "@/lib/utils";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { Transaction } from "@/types";
import { MobileEmptyState, MobileSegmentedControl, MobileSkeletonCard } from "../../components/MobilePagePrimitives";

type StatementTab = "realizado" | "futuro" | "assinaturas";
type TypeFilter = "all" | "income" | "expense";

function openDocument(transaction: Transaction) {
  const url = transaction.receipt_url || transaction.attachment_url || transaction.invoice_url || transaction.bank_slip_url;
  if (!url) return toast.info("Ainda não existe comprovante disponível para esta movimentação.");
  window.open(url, "_blank", "noopener,noreferrer");
}

export function MobileNeuroFinanceStatement() {
  const [tab, setTab] = useState<StatementTab>("realizado");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [showValues, setShowValues] = useState(true);
  const start = useMemo(() => subMonths(new Date(), 6), []);
  const end = useMemo(() => addYears(new Date(), 2), []);
  const statement = useNeuroFinanceStatement(start, end);
  const balance = useNeuroFinanceBalance();

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const now = new Date();
    return (statement.data || []).filter((item) => {
      const future = isAfter(new Date(item.date), now);
      const recurring = `${item.description || ""} ${item.category || ""}`.toLowerCase();
      if (tab === "realizado" && (future || item.status !== "completed")) return false;
      if (tab === "futuro" && !future && item.status !== "pending") return false;
      if (tab === "assinaturas" && !recurring.includes("assinatura") && !recurring.includes("recorr")) return false;
      if (type !== "all" && item.type !== type) return false;
      return !search || `${item.description} ${item.patient_name || ""} ${item.category || ""}`.toLowerCase().includes(search);
    });
  }, [query, statement.data, tab, type]);

  const sync = async () => {
    try {
      await balance.syncNow();
      await statement.refetch();
      toast.success("Extrato atualizado.");
    } catch (error) {
      const friendly = toUserFacingError(error, "balance");
      toast.error(friendly.title, { description: friendly.message });
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Saldo disponível</p>
            {balance.isLoading ? <Loader2 className="mt-4 h-6 w-6 animate-spin text-muted-foreground/35" /> : (
              <p className="mt-2 text-3xl font-black tracking-[-0.055em] text-foreground">
                {showValues ? formatCurrency(balance.data?.balance || 0) : "R$ ••••••"}
              </p>
            )}
            <p className="mt-2 text-[10px] font-bold text-muted-foreground/55">
              {showValues ? `${formatCurrency(balance.data?.pending || 0)} a liberar` : "Valores protegidos"}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowValues((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/[0.045] text-muted-foreground">
              {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button type="button" onClick={sync} disabled={balance.isSyncing} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/[0.045] text-muted-foreground disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", balance.isSyncing && "animate-spin")} />
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {[{ label: "Entradas", value: balance.data?.totalReceived || 0, icon: ArrowUpRight }, { label: "Saídas", value: balance.data?.paidOut || 0, icon: ArrowDownRight }].map((item) => (
          <div key={item.label} className="rounded-[22px] border border-border/40 bg-card/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/55">{item.label}</p>
            <p className="mt-1 text-lg font-black text-foreground">{showValues ? formatCurrency(item.value) : "R$ ••••"}</p>
          </div>
        ))}
      </div>

      <MobileSegmentedControl<StatementTab> value={tab} onValueChange={setTab} ariaLabel="Período do extrato" options={[
        { value: "realizado", label: "Realizado", icon: Wallet },
        { value: "futuro", label: "Futuro", icon: CalendarClock },
        { value: "assinaturas", label: "Recorrente", icon: FileText },
      ]} />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar movimentação" className="h-12 w-full rounded-[18px] border border-border/40 bg-card/70 pl-11 pr-4 text-sm outline-none dark:border-white/10 dark:bg-white/[0.03]" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[{ value: "all", label: "Tudo" }, { value: "income", label: "Entradas" }, { value: "expense", label: "Saídas" }].map((item) => (
          <button key={item.value} type="button" onClick={() => setType(item.value as TypeFilter)} className={cn("min-h-10 shrink-0 rounded-xl px-4 text-[8px] font-black uppercase tracking-[0.13em]", type === item.value ? "bg-foreground text-background" : "border border-border/40 bg-card/60 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]")}>{item.label}</button>
        ))}
      </div>

      {statement.isLoading ? <div className="space-y-2"><MobileSkeletonCard lines={1} /><MobileSkeletonCard lines={1} /></div> : rows.length === 0 ? (
        <MobileEmptyState icon={FileText} title="Nenhuma movimentação" description="Não encontramos movimentações para os filtros selecionados." className="min-h-[280px]" />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 50).map((item) => (
            <button key={item.id} type="button" onClick={() => openDocument(item)} className="flex w-full items-center gap-3 rounded-[22px] border border-border/40 bg-card/75 p-4 text-left active:scale-[0.985] dark:border-white/10 dark:bg-white/[0.03]">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]", item.type === "income" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                {item.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-foreground">{item.description || "Movimentação"}</p><p className="mt-1 text-[9px] text-muted-foreground/60">{format(new Date(item.date), "d MMM yyyy, HH:mm", { locale: ptBR })}</p></div>
              <div className="text-right"><p className={cn("text-[12px] font-black", item.type === "income" ? "text-emerald-500" : "text-foreground")}>{item.type === "income" ? "+" : "−"} {showValues ? formatCurrency(Math.abs(item.amount)) : "R$ ••••"}</p><p className="mt-1 text-[8px] font-black uppercase text-muted-foreground/50">{item.status === "completed" ? "Concluída" : "Pendente"}</p></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
