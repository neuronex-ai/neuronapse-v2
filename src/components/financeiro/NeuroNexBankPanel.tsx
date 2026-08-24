"use client";

import { useState, useMemo, useCallback } from "react";
import type { ElementType, MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import {
    ArrowUpRight,
    QrCode,
    Banknote,
    ReceiptText,
    X,
    Search,
    Download,
    Settings,
    TrendingUp,
    Clock,
    ChevronRight,
    ArrowDownLeft,
    Package,
    FileText,
    RefreshCw,
    Eye,
    EyeOff,
    Send,
    Activity,
    AlertTriangle,
} from "lucide-react";
import { NeuroNexCard } from "@/components/financeiro/NeuroNexCard";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import { getNeuroFinanceProfessionalName } from "./neurofinance-profile-name";

import { NewInvoiceModal } from "./NewInvoiceModal";
import { NfseGenerateModal } from "./NfseGenerateModal";
import { GlobalPlanosModal } from "./GlobalPlanosModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FinancialStatement } from "./FinancialStatement";
import { Transaction } from "@/types";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { motion, AnimatePresence } from "framer-motion";
import TransactionDetailView from "./TransactionDetailView";
import { useNeuroFinanceBalanceDetails } from "@/hooks/use-neurofinance-balance-details";
import { toUserFacingError } from "@/lib/user-facing-error";


interface NeuroNexBankPanelProps {
    transactions?: Transaction[];
    isLoadingTransactions?: boolean;
    onNavigate?: (view: PanelNavigationView) => void;
}

type PanelNavigationView =
    | "transferencias"
    | "pix-transferir"
    | "extrato"
    | "fiscal-nova"
    | "fiscal-lista"
    | "fiscal-dados"
    | "cobrancas-historia"
    | "cobrancas-chargebacks"
    | "pagamentos-boletos"
    | "contas-bancarias";

interface MiniActionBlockProps {
    icon: ElementType<{ className?: string }>;
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    variant?: "default" | "primary";
}

const MiniActionBlock = ({ icon: Icon, label, onClick, disabled = false, variant = 'default' }: MiniActionBlockProps) => (
    <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
            "group flex w-20 shrink-0 flex-col items-center gap-2 rounded-[18px] px-1.5 py-2 transition-[background-color,transform] duration-200 hover:bg-muted/45 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 md:w-24",
            disabled && "opacity-40 cursor-not-allowed"
        )}
    >
        <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-[18px] shadow-sm transition-colors duration-200 md:h-14 md:w-14 md:rounded-[20px]",
            variant === 'primary'
                ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg"
                : "border border-border/60 bg-background/78 dark:border-white/[0.07] dark:bg-white/[0.035] group-hover:bg-muted dark:group-hover:bg-white/[0.07]"
        )}>
            <Icon className={cn(
                "h-4 w-4 transition-colors duration-200 md:h-5 md:w-5",
                variant === 'default' && "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"
            )} />
        </div>
        <span className={cn(
            "w-full text-center text-[8px] font-black uppercase leading-tight tracking-[0.1em] text-muted-foreground transition-colors group-hover:text-foreground"
        )}>
            {label}
        </span>
    </motion.button>
);

export const NeuroNexBankPanel = ({ transactions = [], isLoadingTransactions = false, onNavigate }: NeuroNexBankPanelProps) => {
    // 1. Hooks de dados
    const { isConnected, account } = useFinancialAccount();
    const {
        data: balanceData,
        isLoading: isLoadingBalance,
        syncNow,
        isSyncing,
    } = useNeuroFinanceBalance();
    const { data: profile } = useProfile();

    // 2. Estado local
    const [isStatementOpen, setIsStatementOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
    const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [cardExpanded, setCardExpanded] = useState(false);
    const [showValues, setShowValues] = useState(true);
    const [detailPeriod, setDetailPeriod] = useState("all");
    const [detailMethod, setDetailMethod] = useState("all");
    const [detailStatus, setDetailStatus] = useState("all");

    // 3. Memos e Callbacks (Nível Superior)
    const bankBalance = useMemo(() => balanceData || {
        balance: 0,
        pending: 0,
        reserved: 0,
        totalReceived: 0,
        paidOut: 0,
        lastUpdatedAt: null,
        isStale: false,
    }, [balanceData]);

    const professionalName = useMemo(
        () => getNeuroFinanceProfessionalName(
            profile,
            account?.bank_holder_name || account?.holder_name,
        ),
        [account?.bank_holder_name, account?.holder_name, profile],
    );
    const cardName = professionalName.toUpperCase();

    const cardBankName = account?.bank_name || (account?.bank_code ? `Banco ${account.bank_code}` : "Banco cadastrado");
    const cardAgency = account?.bank_agency || "Não informada";
    const cardAccount = account?.bank_account
        ? `${account.bank_account}${account.bank_account_digit ? `-${account.bank_account_digit}` : ""}`
        : account?.bank_account_last4
            ? `•••• ${account.bank_account_last4}`
            : "Não informada";
    const cardAccountType = account?.bank_account_type === "CONTA_POUPANCA" ? "Poupança" : "Conta corrente";

    const safeCardAccount = account?.bank_account_last4
        ? `•••• ${account.bank_account_last4}`
        : "Não informada";
    void cardAccount;

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const patientName = (t as Transaction & { patient_name?: string }).patient_name || "";
            const matchesSearch = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.amount.toString().includes(searchQuery);
            return matchesSearch;
        });
    }, [transactions, searchQuery]);

    // Hooks individuais para cada modal (Real-time Asaas BaaS Data)
    const { data: incomeDetails, isLoading: isLoadingIncome } = useNeuroFinanceBalanceDetails('total');
    const { data: expensesDetails, isLoading: isLoadingExpenses } = useNeuroFinanceBalanceDetails('andamento');
    const { data: pendingDetails, isLoading: isLoadingPending } = useNeuroFinanceBalanceDetails('futuro');

    const incomeTransactions = useMemo(() => {
        return Array.isArray(incomeDetails) ? incomeDetails : [];
    }, [incomeDetails]);

    const expenseTransactions = useMemo(() => {
        return Array.isArray(expensesDetails) ? expensesDetails : [];
    }, [expensesDetails]);

    const pendingTransactions = useMemo(() => {
        return Array.isArray(pendingDetails) ? pendingDetails : [];
    }, [pendingDetails]);

    const filterDetailTransactions = useCallback((items: Transaction[]) => {
        const cutoff = detailPeriod === "30"
            ? Date.now() - 30 * 24 * 60 * 60 * 1000
            : detailPeriod === "90"
                ? Date.now() - 90 * 24 * 60 * 60 * 1000
                : null;

        return items.filter((item) => {
            const matchesPeriod = !cutoff || new Date(item.date).getTime() >= cutoff;
            const matchesMethod = detailMethod === "all" || item.payment_method === detailMethod;
            const matchesStatus = detailStatus === "all" || item.status === detailStatus;
            return matchesPeriod && matchesMethod && matchesStatus;
        });
    }, [detailMethod, detailPeriod, detailStatus]);

    const filteredIncomeTransactions = useMemo(
        () => filterDetailTransactions(incomeTransactions),
        [filterDetailTransactions, incomeTransactions],
    );
    const filteredExpenseTransactions = useMemo(
        () => filterDetailTransactions(expenseTransactions),
        [expenseTransactions, filterDetailTransactions],
    );
    const filteredPendingTransactions = useMemo(
        () => filterDetailTransactions(pendingTransactions),
        [filterDetailTransactions, pendingTransactions],
    );

    const detailFilters = (
        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={detailPeriod} onValueChange={setDetailPeriod}>
                <SelectTrigger className="h-11 rounded-[15px] border-zinc-200 bg-white text-xs font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
            </Select>
            <Select value={detailMethod} onValueChange={setDetailMethod}>
                <SelectTrigger className="h-11 rounded-[15px] border-zinc-200 bg-white text-xs font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos os métodos</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                </SelectContent>
            </Select>
            <Select value={detailStatus} onValueChange={setDetailStatus}>
                <SelectTrigger className="h-11 rounded-[15px] border-zinc-200 bg-white text-xs font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );


    const actionButtons = useMemo(() => (
        <>
            <NewInvoiceModal>
                <MiniActionBlock icon={QrCode} label="Cobrar Paciente" variant="primary" />
            </NewInvoiceModal>

            <MiniActionBlock
                icon={ArrowUpRight}
                label="Sacar"
                onClick={() => onNavigate?.('transferencias')}
                disabled={!isConnected}
            />

            <MiniActionBlock
                icon={Send}
                label="Transferir via Pix"
                onClick={() => onNavigate?.('pix-transferir')}
                disabled={!isConnected}
            />

            <MiniActionBlock
                icon={Banknote}
                label="Extrato"
                onClick={() => onNavigate?.('extrato')}
            />

            <NfseGenerateModal onNavigate={onNavigate}>
                <MiniActionBlock
                    icon={FileText}
                    label="NFS-e"
                    disabled={!isConnected}
                />
            </NfseGenerateModal>

            <MiniActionBlock
                icon={AlertTriangle}
                label="Cobranças vencidas"
                onClick={() => onNavigate?.('cobrancas-historia')}
            />

            <MiniActionBlock
                icon={Activity}
                label="Chargeback"
                onClick={() => onNavigate?.('cobrancas-chargebacks')}
            />

            <MiniActionBlock
                icon={ReceiptText}
                label="Pagamentos"
                onClick={() => onNavigate?.('pagamentos-boletos')}
            />

            <GlobalPlanosModal>
                <MiniActionBlock
                    icon={Package}
                    label="Planos e Pacotes"
                />
            </GlobalPlanosModal>

            <MiniActionBlock
                icon={Settings}
                label="Configurações"
                onClick={() => onNavigate?.('contas-bancarias')}
            />
        </>
    ), [isConnected, onNavigate]);

    const handleExport = useCallback(() => {
        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
            loading: 'Gerando relatório...',
            success: 'Extrato exportado',
            error: 'Erro ao exportar',
        });
    }, []);

    const handleSync = useCallback(async () => {
        try {
            await syncNow();
            toast.success("Dados financeiros atualizados.");
        } catch (error) {
            const friendlyError = toUserFacingError(error, "balance");
            toast.error(friendlyError.title, {
                description: friendlyError.message,
            });
        }
    }, [syncNow]);

    const handleCloseStatement = useCallback(() => {
        setIsStatementOpen(false);
        setSelectedTransaction(null);
    }, []);

    const displayBalance = bankBalance?.balance;
    const displayAmount = (value: number) => showValues
        ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : "••••••";

    return (
        <div className="w-full space-y-8">
            {/* Modal de Extrato Geral */}
            <Dialog open={isStatementOpen} onOpenChange={(open) => { if (!open) handleCloseStatement(); else setIsStatementOpen(true); }}>
                <DialogContent className="finance-modal-surface max-w-[1100px] h-[90vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                    <DialogHeader className="px-12 py-10 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-[20px] bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl">
                                <ReceiptText className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-2">Extrato</DialogTitle>
                                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.4em] opacity-60">Histórico de Movimentações em Tempo Real</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {!selectedTransaction && (
                                <Button variant="outline" size="sm" onClick={handleExport} className="h-12 px-8 rounded-[20px] border-zinc-200 dark:border-white/10 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                                    <Download className="w-4 h-4 mr-3" /> Exportar Tudo
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={handleCloseStatement} className="h-12 w-12 rounded-full">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </DialogHeader>

                    {!selectedTransaction && (
                        <div className="px-12 py-6 border-b border-zinc-100 dark:border-white/5 bg-white dark:bg-[#0A0A0B]">
                            <div className="flex-1 w-full max-w-sm relative">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="PROCURAR TRANSAÇÃO..."
                                    className="w-full h-14 pl-14 pr-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 rounded-[24px] text-[10px] font-black tracking-[0.2em] uppercase focus:outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-12 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {selectedTransaction ? (
                                <TransactionDetailView
                                    key="detail"
                                    transaction={selectedTransaction}
                                    onBack={() => setSelectedTransaction(null)}
                                />
                            ) : (
                                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <FinancialStatement
                                        transactions={filteredTransactions}
                                        isLoading={isLoadingTransactions}
                                        onSelectTransaction={setSelectedTransaction}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Quanto Entrou */}
            <Dialog open={isIncomeModalOpen} onOpenChange={(open) => { if (!open) setSelectedTransaction(null); setIsIncomeModalOpen(open); }}>
                <DialogContent className="finance-modal-surface max-w-[800px] h-[80vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                    <DialogHeader className="px-10 py-8 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[18px] bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-1.5">
                                    Quanto Entrou
                                </DialogTitle>
                                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-60">Pagamentos disponíveis na conta</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => { setIsIncomeModalOpen(false); setSelectedTransaction(null); }} className="h-10 w-10 rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {selectedTransaction ? (
                                <TransactionDetailView
                                    key="income-detail"
                                    transaction={selectedTransaction}
                                    onBack={() => setSelectedTransaction(null)}
                                />
                            ) : (
                                <motion.div key="income-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {detailFilters}
                                    <FinancialStatement
                                        transactions={filteredIncomeTransactions}
                                        isLoading={isLoadingIncome}
                                        onSelectTransaction={setSelectedTransaction}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Quanto Saiu */}
            <Dialog open={isExpensesModalOpen} onOpenChange={(open) => { if (!open) setSelectedTransaction(null); setIsExpensesModalOpen(open); }}>
                <DialogContent className="finance-modal-surface max-w-[800px] h-[80vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                    <DialogHeader className="px-10 py-8 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[18px] bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shadow-xl">
                                <ArrowDownLeft className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-1.5">
                                    Quanto Saiu
                                </DialogTitle>
                                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-60">Transferências, tarifas e ajustes</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => { setIsExpensesModalOpen(false); setSelectedTransaction(null); }} className="h-10 w-10 rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {selectedTransaction ? (
                                <TransactionDetailView
                                    key="expense-detail"
                                    transaction={selectedTransaction}
                                    onBack={() => setSelectedTransaction(null)}
                                />
                            ) : (
                                <motion.div key="expense-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {detailFilters}
                                    <FinancialStatement
                                        transactions={filteredExpenseTransactions}
                                        isLoading={isLoadingExpenses}
                                        onSelectTransaction={setSelectedTransaction}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: A liberar */}
            <Dialog open={isPendingModalOpen} onOpenChange={(open) => { if (!open) setSelectedTransaction(null); setIsPendingModalOpen(open); }}>
                <DialogContent className="finance-modal-surface max-w-[800px] h-[80vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                    <DialogHeader className="px-10 py-8 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[18px] bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-xl">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-1.5">
                                    A liberar
                                </DialogTitle>
                                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-60">Valores válidos a receber</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => { setIsPendingModalOpen(false); setSelectedTransaction(null); }} className="h-10 w-10 rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {selectedTransaction ? (
                                <TransactionDetailView
                                    key="pending-detail"
                                    transaction={selectedTransaction}
                                    onBack={() => setSelectedTransaction(null)}
                                />
                            ) : (
                                <motion.div key="pending-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {detailFilters}
                                    <FinancialStatement
                                        transactions={filteredPendingTransactions}
                                        isLoading={isLoadingPending}
                                        onSelectTransaction={setSelectedTransaction}
                                        context="statement_future"
                                        isFuture
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="finance-panel group/panel relative w-full overflow-hidden rounded-[32px] border border-border/55 bg-background/82 shadow-[0_24px_58px_-48px_hsl(var(--foreground)/0.34)] dark:border-white/[0.075] dark:bg-zinc-900/[0.72]">
                <div className="flex flex-col lg:flex-row items-stretch relative z-10">
                    <div className="relative z-10 flex flex-[2.5] flex-col justify-center p-7 md:p-9 lg:p-10">
                        <div className="space-y-7 md:space-y-9">
                            <div className="flex items-center gap-4">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-base md:text-lg font-black text-zinc-900 dark:text-white tracking-[0.1em] uppercase leading-none mb-1">NeuroFinance</h2>
                                    <div
                                        className="flex min-w-0 items-center gap-2"
                                        aria-label={`Conta NeuroFinance de ${professionalName}`}
                                    >
                                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700 dark:bg-zinc-300" />
                                        <p className="truncate text-[9px] font-bold tracking-[0.12em] text-zinc-500 dark:text-zinc-400 md:text-[10px]">
                                            {professionalName}
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowValues((current) => !current)}
                                        title={showValues ? "Ocultar valores" : "Mostrar valores"}
                                        aria-pressed={!showValues}
                                        className="flex h-11 w-11 items-center justify-center rounded-[15px] border border-border/60 bg-background/76 text-muted-foreground shadow-sm transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-[0.985] dark:border-white/[0.08] dark:bg-white/[0.04]"
                                    >
                                        {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        title="Sincronizar dados financeiros"
                                        className="flex h-11 w-11 items-center justify-center rounded-[15px] border border-border/60 bg-background/76 text-muted-foreground shadow-sm transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-[0.985] disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04]"
                                    >
                                        <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex w-full max-w-4xl flex-col items-center gap-6 xl:flex-row xl:gap-7">
                                <motion.button
                                    type="button"
                                    onClick={() => onNavigate?.('extrato')}
                                    className="finance-inset group/balance w-full flex-1 cursor-pointer space-y-5 rounded-[24px] border border-border/60 bg-muted/55 p-6 text-left shadow-sm transition-colors hover:bg-muted/80 dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:bg-white/[0.055] lg:p-8"
                                >
                                    <div className="mb-7 flex items-center justify-between gap-5">
                                        <span className="text-[10px] md:text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">Saldo Disponível</span>
                                        <span className="flex h-10 items-center gap-2.5 rounded-[14px] border border-border/60 bg-background/78 px-4 shadow-sm transition-colors group-hover/balance:bg-background dark:border-white/[0.07] dark:bg-white/[0.04] dark:group-hover/balance:bg-white/[0.07]">
                                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 group-hover/balance:text-zinc-900 dark:group-hover/balance:text-white mt-0.5">Ver Extrato</span>
                                            <ChevronRight className="h-4 w-4 text-zinc-400 group-hover/balance:text-zinc-900 dark:group-hover/balance:text-white" />
                                        </span>
                                    </div>

                                    {isLoadingBalance ? (
                                        <Skeleton className="h-16 md:h-20 w-full md:w-[80%] bg-zinc-100 dark:bg-white/5 rounded-[16px]" />
                                    ) : (
                                        <div className="flex items-baseline gap-3 md:gap-4">
                                            <span className="text-2xl md:text-4xl text-zinc-400 dark:text-white/30 font-light translate-y-[-4px] md:translate-y-[-6px] italic">R$</span>
                                            <p className="text-5xl md:text-6xl lg:text-[72px] font-black tracking-[-0.05em] text-zinc-900 dark:text-white leading-none">
                                                {displayAmount(displayBalance || 0)}
                                            </p>
                                        </div>
                                    )}
                                    {bankBalance.lastUpdatedAt && (
                                        <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
                                            Atualizado em {new Date(bankBalance.lastUpdatedAt).toLocaleString("pt-BR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {bankBalance.isStale ? " · atualização em andamento" : ""}
                                        </p>
                                    )}
                                </motion.button>

                                <div className="finance-inset flex h-full min-h-[176px] w-full shrink-0 flex-col justify-center gap-2.5 rounded-[24px] border border-border/60 bg-muted/45 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.025] xl:w-auto">
                                    <button
                                        type="button"
                                        className="w-full cursor-pointer rounded-[17px] border border-border/60 bg-background/82 px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-background dark:border-white/[0.08] dark:bg-black/25 dark:hover:bg-black/40 xl:w-[124px]"
                                        onClick={() => setIsPendingModalOpen(true)}
                                    >
                                        <p className="text-[7.5px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-1.5 leading-none">A liberar</p>
                                        <p className="text-sm md:text-base font-black text-zinc-900 dark:text-white tracking-tighter leading-none flex items-baseline gap-1">
                                            <span className="text-[9px] text-zinc-400 font-medium italic">R$</span>
                                            {isLoadingBalance ? "..." : displayAmount(bankBalance.pending)}
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full cursor-pointer rounded-[17px] px-4 py-3 text-left transition-colors hover:bg-background/65 dark:hover:bg-white/[0.045] xl:w-[124px]"
                                        onClick={() => toast.info(bankBalance.reserved > 0 ? "Há valores temporariamente bloqueados. Abra o extrato para ver a origem." : "Nenhum valor bloqueado no momento.")}
                                    >
                                        <p className="text-[7.5px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-1.5 leading-none">Bloqueado</p>
                                        <p className="text-[13px] md:text-sm font-bold text-zinc-900 dark:text-white/90 leading-none flex items-baseline gap-1">
                                            <span className="text-[8px] text-zinc-400 font-light italic">R$</span>
                                            {isLoadingBalance ? "..." : displayAmount(bankBalance.reserved)}
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full cursor-pointer rounded-[17px] px-4 py-3 text-left transition-colors hover:bg-background/65 dark:hover:bg-white/[0.045] xl:w-[124px]"
                                        onClick={() => setIsExpensesModalOpen(true)}
                                    >
                                        <p className="text-[7.5px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-1.5 leading-none">Quanto saiu</p>
                                        <p className="text-[13px] md:text-sm font-bold text-zinc-900 dark:text-white/90 leading-none flex items-baseline gap-1">
                                            <span className="text-[8px] text-zinc-400 font-light italic">R$</span>
                                            {isLoadingBalance ? "..." : displayAmount(bankBalance.paidOut)}
                                        </p>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="finance-separator relative flex flex-1 flex-col items-center justify-center border-t border-border/55 bg-muted/30 p-7 dark:border-white/[0.065] dark:bg-black/15 md:p-9 lg:border-l lg:border-t-0">
                        <div className="relative z-10 w-full flex flex-col items-center transform scale-75 md:scale-90 xl:scale-100 transition-all duration-700">
                            <NeuroNexCard
                                name={cardName}
                                bankName={cardBankName}
                                bankCode={account?.bank_code || undefined}
                                agency={cardAgency}
                                account={safeCardAccount}
                                accountType={cardAccountType}
                                isExpanded={cardExpanded}
                                showSensitive={true}
                                onToggle={() => setCardExpanded(!cardExpanded)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="finance-panel group/actions relative rounded-[28px] border border-border/55 bg-background/82 px-5 py-4 shadow-sm dark:border-white/[0.075] dark:bg-zinc-900/[0.68] md:px-7">
                <div className="no-scrollbar flex items-start justify-start gap-4 overflow-x-auto py-1 2xl:justify-center">
                    {actionButtons}
                </div>
            </div>
        </div>
    );
};
