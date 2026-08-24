import { Loader2, Banknote, ArrowDown, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useNeuroFinancePayouts } from "@/hooks/use-neurofinance-payouts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PayoutsHistoryWidgetProps {
    compact?: boolean;
    showHeaderAction?: boolean;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    in_transit: { label: 'Em trânsito', icon: ArrowDown, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    paid: { label: 'Pago', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    failed: { label: 'Falhou', icon: XCircle, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
    canceled: { label: 'Cancelado', icon: XCircle, color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
};

export const PayoutsHistoryWidget = ({ compact = false }: PayoutsHistoryWidgetProps) => {
    const { data: payouts, isLoading } = useNeuroFinancePayouts(10);

    return (
        <div className={cn("h-full flex flex-col", compact ? "p-0" : "p-8")}>
            {!compact && (
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/10 dark:bg-white/5 rounded-xl border border-border/10 dark:border-white/10 text-foreground dark:text-white">
                            <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground dark:text-white uppercase tracking-wider">Saques</h3>
                            <p className="text-[10px] text-muted-foreground">Histórico de saques para conta bancária</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 -mr-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-white/20" />
                    </div>
                ) : payouts && payouts.length > 0 ? (
                    payouts.map((payout) => {
                        const config = statusConfig[payout.status] || statusConfig.pending;
                        const StatusIcon = config.icon;

                        return (
                            <div key={payout.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/5 dark:hover:bg-white/[0.02] transition-colors">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", config.color)}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground dark:text-white truncate">
                                        {payout.destination_summary || 'Conta bancária'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {payout.requested_at
                                            ? format(new Date(payout.requested_at), "d MMM, HH:mm", { locale: ptBR })
                                            : '—'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-foreground dark:text-white">
                                        {formatCurrency((payout.amount || 0) / 100)}
                                    </p>
                                    <p className={cn("text-[9px] font-bold uppercase tracking-wider", config.color.split(' ')[0])}>
                                        {config.label}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/40 border border-dashed border-white/[0.08] rounded-2xl p-4 bg-transparent">
                        <Banknote className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500">Nenhum saque recente.</p>
                    </div>
                )}
            </div>
        </div>
    );
};