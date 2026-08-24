import { usePatientPortalTransactions } from "@/hooks/use-patient-portal-transactions";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";
import { ArrowDownRight, ArrowUpRight, Calendar, Loader2, Wallet } from "lucide-react";

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
  return (
    <div className="group flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-2.5 rounded-xl border shadow-lg transition-transform group-hover:scale-105 flex-shrink-0",
          transaction.type === "income"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          {transaction.type === "income" ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate pr-2">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(transaction.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
            <span className="w-0.5 h-0.5 bg-white/20 rounded-full" />
            <span className="truncate">{transaction.category || "Geral"}</span>
          </div>
        </div>
      </div>
      <div className="text-right pl-2">
        <p className={cn(
          "text-sm font-bold tracking-tight",
          transaction.type === "income" ? "text-emerald-400" : "text-rose-400"
        )}>
          {transaction.type === "income" ? "+" : "-"} {formatCurrency(transaction.amount)}
        </p>
      </div>
    </div>
  );
};

interface PatientFinancePanelProps {
  patientId?: string;
}

export const PatientFinancePanel = ({ patientId }: PatientFinancePanelProps) => {
  const { data: transactions, isLoading, error } = usePatientPortalTransactions(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm bg-rose-500/5 rounded-xl mx-4">
        Erro ao carregar histórico financeiro.
      </div>
    );
  }

  const totalPaid = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between border-b border-white/5 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Extrato
        </h2>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total Investido</span>
          <span className="font-bold text-lg text-emerald-400 tracking-tight">{formatCurrency(totalPaid)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {transactions && transactions.length > 0 ? (
          transactions.map(t => (
            <TransactionItem key={t.id} transaction={t} />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum registro.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Seu histórico aparecerá aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
};