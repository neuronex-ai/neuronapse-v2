import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import {
    QrCode,
    Key,
    ShieldCheck,
    TrendingUp,
    Landmark,
    Receipt,
    FileText,
    Users,
    Settings,
    BadgeCent,
    ChevronLeft,
    PieChart,
    Calendar,
    Send,
    Barcode,
    FolderOpen,
    Activity,
    WalletCards,
    CalendarClock,
} from "lucide-react";

import { CashFlowScenarios } from "@/components/financeiro/CashFlowScenarios";
import { InvoicesListPanel } from "@/components/financeiro/InvoicesListPanel";
import { NeuroNexBankPanel } from "@/components/financeiro/NeuroNexBankPanel";
import { FinancialStatement } from "@/components/financeiro/FinancialStatement";
import { InvoicesHistoryList } from "@/components/financeiro/invoice/InvoicesHistoryList";
import { GenerateRPSForm } from "@/components/financeiro/invoice/GenerateRPSForm";
import { BankTransferView } from "@/components/financeiro/BankTransferView";
import { BankAccountsView } from "@/components/financeiro/BankAccountsView";
import { NeuroFinanceMovementsTimeline } from "@/components/financeiro/NeuroFinanceMovementsTimeline";
import TransactionDetailView from "@/components/financeiro/TransactionDetailView";
import { PixPagarCopiaCola } from "@/components/financeiro/pix/PixPagarCopiaCola";
import { PixTransferir } from "@/components/financeiro/pix/PixTransferir";
import { PixGerarQrCode } from "@/components/financeiro/pix/PixGerarQrCode";
import { PixChaves } from "@/components/financeiro/pix/PixChaves";
import { PixSalarios } from "@/components/financeiro/pix/PixSalarios";
import { PixLimites } from "@/components/financeiro/pix/PixLimites";
import { PagamentosAgendamento } from "@/components/financeiro/pagamentos/PagamentosAgendamento";
import { PagamentosGrupos } from "@/components/financeiro/pagamentos/PagamentosGrupos";
import { ScheduledBillPayments } from "@/components/financeiro/pagamentos/ScheduledBillPayments";
import { AsaasRegulatoryFooter } from "@/components/financeiro/AsaasRegulatoryFooter";
import { FiscalConfigPanel } from "@/components/settings/FiscalConfigPanel";
import { NeuroFinanceTariffs } from "@/components/financeiro/NeuroFinanceTariffs";
import { SalesSimulator } from "@/components/financeiro/cobrancas/SalesSimulator";
import { ChargebacksPanel } from "@/components/financeiro/cobrancas/ChargebacksPanel";
import { AsaasAccountStatusTimeline } from "@/components/financeiro/AsaasAccountStatusTimeline";
import { DetailedStatementPanel } from "@/components/financeiro/DetailedStatementPanel";
import { FinancialManagementDashboard } from "@/components/financeiro/management/FinancialManagementDashboard";
import type{NeuroFinanceManagementContext}from"@/components/financeiro/management/FinancialManagementDashboard";
import type { Transaction } from "@/types";

export type FinanceView =
    | "gestao-visao-geral"
    | "gestao-lancamentos"
    | "gestao-recebimentos"
    | "gestao-fluxo-caixa"
    | "gestao-receitas"
    | "gestao-despesas"
    | "gestao-cobrancas"
    | "gestao-inadimplencia"
    | "gestao-repasses-convenio"
    | "gestao-recorrencia"
    | "gestao-planejamento"
    | "gestao-relatorios"
    | "conta-digital"
    | "pix"
    | "pix-pagar"
    | "pix-transferir"
    | "pix-qrcode"
    | "pix-receber"
    | "pix-chaves"
    | "pix-salarios"
    | "pix-limites"
    | "transferencias"
    | "pagamentos"
    | "pagamentos-boletos"
    | "pagamentos-agendados"
    | "pagamentos-agendar"
    | "pagamentos-grupos"
    | "contas-bancarias"
    | "saude-conta"
    | "extrato"
    | "fluxo-caixa"
    | "receitas"
    | "despesas"
    | "cobrancas-historia"
    | "cobrancas-config"
    | "cobrancas-simulador"
    | "cobrancas-chargebacks"
    | "antecipacoes"
    | "antecipacoes-lista"
    | "antecipacoes-solicitar"
    | "antecipacoes-automatica"
    | "antecipacoes-simulador"
    | "antecipacoes-historico"
    | "fiscal-dados"
    | "fiscal-nova"
    | "fiscal-lista"
    | "repasses-profissional"
    | "tarifas";

const SectionHeader = ({
    icon: Icon,
    title,
    subtitle,
    action,
    onBack,
}: {
    icon: ElementType<{ className?: string }>;
    title: string;
    subtitle: string;
    action?: ReactNode;
    onBack?: () => void;
}) => (
    <div className="finance-panel relative overflow-hidden rounded-[32px] border border-border/55 bg-background/78 p-7 shadow-[0_18px_54px_-46px_hsl(var(--foreground)/0.32)] dark:border-white/[0.075] dark:bg-zinc-900/[0.72] lg:p-8">
        <div className="relative z-10 flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-foreground text-background shadow-[0_12px_30px_-22px_hsl(var(--foreground)/0.72)]">
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-xl font-black leading-tight tracking-[-0.025em] text-foreground">{title}</h3>
                    <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {action}
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Voltar para a visão anterior"
                        className="group/back flex h-11 w-11 items-center justify-center rounded-[15px] border border-border/60 bg-background/70 transition-colors hover:bg-muted dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                    >
                        <ChevronLeft className="h-5 w-5 text-zinc-600 transition-transform group-hover/back:-translate-x-0.5 dark:text-zinc-400" />
                    </button>
                )}
            </div>
        </div>
    </div>
);

const ContentWrapper = ({ children }: { children: ReactNode }) => (
    <div className="finance-panel relative overflow-hidden rounded-[32px] border border-border/55 bg-background/78 p-6 shadow-sm dark:border-white/[0.075] dark:bg-zinc-900/[0.72] lg:p-8">
        <div className="relative z-10">{children}</div>
    </div>
);

const PaymentRouteSwitcher = ({
    active,
    onSelect,
}: {
    active: "boleto" | "pix";
    onSelect: (route: "pagamentos-boletos" | "pix-pagar") => void;
}) => (
    <div role="group" aria-label="Forma de pagamento" className="finance-inset flex rounded-[18px] border border-border/60 bg-muted/55 p-1.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
        {[
            { id: "boleto" as const, route: "pagamentos-boletos" as const, label: "Pagar boleto", icon: Barcode },
            { id: "pix" as const, route: "pix-pagar" as const, label: "Pagar Pix", icon: QrCode },
        ].map((item) => (
            <button
                key={item.id}
                type="button"
                aria-pressed={active === item.id}
                onClick={() => onSelect(item.route)}
                className={`flex h-11 items-center gap-2 rounded-[13px] px-4 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${
                    active === item.id
                        ? "bg-zinc-950 text-white shadow-md dark:bg-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                }`}
            >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
            </button>
        ))}
    </div>
);

const CapabilityNotice = ({ icon: Icon, title, description }: { icon: ElementType<{ className?: string }>; title: string; description: string }) => (
    <div className="finance-inset flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-muted/45 px-8 py-10 text-center dark:border-white/[0.08] dark:bg-white/[0.025]">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-black/75 dark:bg-black/30 dark:shadow-[0_16px_38px_-30px_rgba(0,0,0,0.94)]">
            <Icon className="h-6 w-6 text-zinc-500" />
        </div>
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">{title}</h4>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
);

const AutomationRulesMatrix = () => (
    <div className="grid gap-4 lg:grid-cols-3">
        {[
            { title: "Recorrência na Gestão", state: "Disponível", description: "Gera lançamentos gerenciais periódicos e informa quando houver vínculo bancário." },
            { title: "Cobranças da Agenda", state: "Disponível conforme configuração", description: "Sessões configuradas podem originar cobranças sem mudar o vocabulário da lista." },
            { title: "Motor automático completo", state: "Ainda indisponível", description: "Pacotes, assinaturas e consultas não serão apresentados como automatizados antes do piloto real." },
        ].map((item) => (
            <section key={item.title} className="finance-inset min-h-[190px] rounded-[22px] border border-border/55 bg-muted/38 p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{item.state}</p>
                <h3 className="mt-5 text-base font-black tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">{item.description}</p>
            </section>
        ))}
    </div>
);

export interface FinancialDashboardProps {
    selectedTransaction: Transaction | null;
    setSelectedTransaction: (t: Transaction | null) => void;
    activeView: FinanceView;
    setActiveView: (view: FinanceView) => void;
    allTransactions: Transaction[];
    managementTransactions?:Transaction[];
    neurofinance?:NeuroFinanceManagementContext;
    isLoadingTransactions: boolean;
    motionProps: HTMLMotionProps<"div">;
    extratoTab: "realizado" | "futuro" | "assinaturas";
    setExtratoTab: (tab: "realizado" | "futuro" | "assinaturas") => void;
    realizedTransactions: Transaction[];
    futureTransactions: Transaction[];
    subscriptionTransactions: Transaction[];
    isNbStatementLoading: boolean;
    statementPixReceivedPreset?: boolean;
}

export function FinancialDashboard({
    selectedTransaction,
    setSelectedTransaction,
    activeView,
    setActiveView,
    allTransactions,
    managementTransactions,
    neurofinance,
    isLoadingTransactions,
    motionProps,
    extratoTab,
    setExtratoTab,
    realizedTransactions,
    futureTransactions,
    subscriptionTransactions,
    statementPixReceivedPreset = false,
}: FinancialDashboardProps) {
    const handleGoBack = () => {
        setActiveView("gestao-visao-geral");
        setSelectedTransaction(null);
    };

    if (selectedTransaction) {
        return (
            <motion.div {...motionProps} key="transaction-detail" className="px-6 py-6">
                <TransactionDetailView transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />
            </motion.div>
        );
    }

    switch (activeView) {
        case "gestao-visao-geral":
        case "gestao-lancamentos":
        case "gestao-recebimentos":
        case "gestao-fluxo-caixa":
        case "gestao-receitas":
        case "gestao-despesas":
        case "gestao-cobrancas":
        case "gestao-inadimplencia":
        case "gestao-repasses-convenio":
        case "gestao-recorrencia":
        case "gestao-planejamento":
        case "gestao-relatorios":
            return (
                <motion.div {...motionProps} key={activeView}>
                    <FinancialManagementDashboard
                        activeView={activeView}
                        setActiveView={setActiveView}
                        allTransactions={allTransactions}
                        managementTransactions={managementTransactions}
                        neurofinance={neurofinance}
                        realizedTransactions={realizedTransactions}
                        futureTransactions={futureTransactions}
                        subscriptionTransactions={subscriptionTransactions}
                        isLoadingTransactions={isLoadingTransactions}
                        setSelectedTransaction={setSelectedTransaction}
                    />
                </motion.div>
            );

        case "conta-digital":
            return (
                <motion.div {...motionProps} key="conta-digital" className="space-y-6 px-6 py-6">
                    <NeuroNexBankPanel transactions={allTransactions} isLoadingTransactions={isLoadingTransactions} onNavigate={setActiveView} />
                    <NeuroFinanceMovementsTimeline
                        onOpenFutureStatement={() => {
                            setExtratoTab("futuro");
                            setActiveView("extrato");
                        }}
                        onOpenScheduledPayments={() => setActiveView("pagamentos-agendados")}
                    />
                    <AsaasRegulatoryFooter />
                </motion.div>
            );

        case "extrato":
        case "pix":
        case "pix-receber":
            return (
                <motion.div {...motionProps} key={`extrato-${statementPixReceivedPreset || activeView !== "extrato" ? "pix" : "all"}`} className="px-6 py-6">
                    <div className="mx-auto max-w-7xl space-y-6">
                        <SectionHeader icon={FileText} title="Extrato" subtitle="Histórico unificado NeuroFinance e manual" onBack={handleGoBack} />
                        <DetailedStatementPanel
                            tab={extratoTab}
                            onTabChange={setExtratoTab}
                            onSelectTransaction={setSelectedTransaction}
                            initialPixReceivedFilter={statementPixReceivedPreset || activeView === "pix" || activeView === "pix-receber"}
                        />
                    </div>
                </motion.div>
            );

        case "receitas":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={TrendingUp} title="Receitas" subtitle="Entradas confirmadas" onBack={handleGoBack} /><ContentWrapper><FinancialStatement transactions={allTransactions.filter((t) => t.type === "income")} isLoading={isLoadingTransactions} onSelectTransaction={setSelectedTransaction} /></ContentWrapper></motion.div>;
        case "despesas":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={PieChart} title="Despesas" subtitle="Saídas e custos" onBack={handleGoBack} /><ContentWrapper><FinancialStatement transactions={allTransactions.filter((t) => t.type === "expense")} isLoading={isLoadingTransactions} onSelectTransaction={setSelectedTransaction} /></ContentWrapper></motion.div>;
        case "pix-pagar":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={QrCode} title="Pagar Pix" subtitle="Cole o Pix e pague" action={<PaymentRouteSwitcher active="pix" onSelect={setActiveView} />} onBack={() => setActiveView("extrato")} /><ContentWrapper><PixPagarCopiaCola /></ContentWrapper></motion.div>;
        case "pix-transferir":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Send} title="Transferir" subtitle="Envie para uma chave Pix" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixTransferir /></ContentWrapper></motion.div>;
        case "pix-qrcode":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={QrCode} title="QR Code" subtitle="Gere um Pix para receber" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixGerarQrCode /></ContentWrapper></motion.div>;
        case "pix-chaves":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Key} title="Chaves Pix" subtitle="Suas chaves para receber" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixChaves /></ContentWrapper></motion.div>;
        case "pix-salarios":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Users} title="Salários" subtitle="Pix em lote para sua equipe" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixSalarios /></ContentWrapper></motion.div>;
        case "pix-limites":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={ShieldCheck} title="Limites" subtitle="Segurança da conta" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixLimites /></ContentWrapper></motion.div>;
        case "transferencias":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Send} title="Saque" subtitle="Envie fundos para sua conta" onBack={handleGoBack} /><ContentWrapper><BankTransferView /></ContentWrapper></motion.div>;
        case "pagamentos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Receipt} title="Pagamentos" subtitle="Pague boletos e Pix" action={<PaymentRouteSwitcher active="boleto" onSelect={setActiveView} />} onBack={handleGoBack} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-boletos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Barcode} title="Pagar boletos" subtitle="Linha digitável, imagem ou PDF" action={<PaymentRouteSwitcher active="boleto" onSelect={setActiveView} />} onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-agendados":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={CalendarClock} title="Pagamentos Agendados" subtitle="Programações e histórico da conta NeuroFinance" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><ScheduledBillPayments /></ContentWrapper></motion.div>;
        case "pagamentos-agendar":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Calendar} title="Pagar contas" subtitle="Boletos e Pix de fornecedores" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-grupos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={FolderOpen} title="Pagamentos em lote" subtitle="Organize várias contas de uma vez" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosGrupos /></ContentWrapper></motion.div>;
        case "contas-bancarias":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Landmark} title="Ajustes" subtitle="Conta bancária" onBack={handleGoBack} /><ContentWrapper><BankAccountsView /></ContentWrapper></motion.div>;
        case "saude-conta":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={ShieldCheck} title="Saúde da conta" subtitle="Status documental e análise cadastral" onBack={handleGoBack} /><AsaasAccountStatusTimeline /></motion.div>;
        case "fluxo-caixa":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={TrendingUp} title="Fluxo" subtitle="Análise de caixa" onBack={handleGoBack} /><div className="h-[500px] overflow-hidden rounded-[32px]"><CashFlowScenarios /></div></motion.div>;
        case "cobrancas-historia":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={WalletCards} title="Todas as cobranças" subtitle="Veja, filtre e crie cobranças" onBack={handleGoBack} /><InvoicesListPanel /></motion.div>;
        case "cobrancas-config":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Settings} title="Regras automáticas" subtitle="O que já funciona e o que ainda não está no piloto automático" onBack={handleGoBack} /><ContentWrapper><AutomationRulesMatrix /></ContentWrapper></motion.div>;
        case "cobrancas-simulador":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={BadgeCent} title="Simulador de vendas" subtitle="Veja taxas e valor líquido antes de cobrar" onBack={handleGoBack} /><SalesSimulator /></motion.div>;
        case "cobrancas-chargebacks":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Activity} title="Contestações" subtitle="Contestações e reversões de pagamento" onBack={handleGoBack} /><ChargebacksPanel /></motion.div>;
        case "antecipacoes":
        case "antecipacoes-lista":
        case "antecipacoes-solicitar":
        case "antecipacoes-automatica":
        case "antecipacoes-simulador":
        case "antecipacoes-historico":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={TrendingUp} title="Antecipação" subtitle="Recurso em preparação" onBack={handleGoBack} /><ContentWrapper><CapabilityNotice icon={TrendingUp} title="Em breve" description="A antecipação ainda não está habilitada. Quando o motor estiver validado, esta área mostrará valor, Taxa, Líquido e prazo antes de qualquer confirmação." /></ContentWrapper></motion.div>;
        case "fiscal-dados":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Landmark} title="Dados Fiscais" subtitle="Informações usadas na emissão da NFS-e" onBack={handleGoBack} /><ContentWrapper><FiscalConfigPanel /></ContentWrapper></motion.div>;
        case "fiscal-nova":
            return <motion.div {...motionProps} className="px-6 py-6"><GenerateRPSForm onBack={handleGoBack} onSuccess={() => setActiveView("fiscal-lista")} /></motion.div>;
        case "fiscal-lista":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={FileText} title="Minhas Notas Fiscais" subtitle="Histórico fiscal" onBack={handleGoBack} /><ContentWrapper><InvoicesHistoryList fiscalOnly /></ContentWrapper></motion.div>;
        case "repasses-profissional":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Users} title="Conta de destino" subtitle="Conta bancária usada em saques" onBack={handleGoBack} /><ContentWrapper><BankAccountsView /></ContentWrapper></motion.div>;
        case "tarifas":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Receipt} title="Tarifas" subtitle="Custos e prazos, sem letras miúdas" onBack={handleGoBack} /><NeuroFinanceTariffs /></motion.div>;
        default:
            return null;
    }
}
