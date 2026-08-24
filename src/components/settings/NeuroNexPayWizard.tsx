import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  Landmark,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomOnboardingFlow } from "@/components/financeiro/CustomOnboardingFlow";
import { NeuroFinanceVerificationModal } from "@/components/financeiro/NeuroFinanceVerificationModal";
import { NeuroNexCard } from "@/components/financeiro/NeuroNexCard";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useProfile } from "@/hooks/use-profile";
import { getAsaasAccountSituation } from "@/lib/asaas-account-status";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { buildNeuroFinanceSupportUrl } from "@/lib/neurofinance-support";

interface NeuroNexPayWizardProps {
  onSuccess?: () => void;
  onSkipDocuments?: () => void;
  isMobile?: boolean;
}

const statusVisual = {
  active: {
    icon: BadgeCheck,
    title: "Conta aprovada",
    label: "Pronta para uso",
    description: "Sua conta NeuroFinance está aprovada para cobranças, Pix e repasses.",
    tone: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300",
  },
  onboarding: {
    icon: ShieldAlert,
    title: "Ação necessária",
    label: "Completar dados",
    description: "A Asaas ainda precisa de alguma informação ou documento para concluir a análise.",
    tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
  },
  pending_review: {
    icon: Clock3,
    title: "Conta em análise",
    label: "Aguardando Asaas",
    description: "Sua documentação foi enviada e está na fila de análise cadastral da Asaas.",
    tone: "border-blue-500/20 bg-blue-500/[0.08] text-blue-700 dark:text-blue-300",
  },
  restricted: {
    icon: ShieldAlert,
    title: "Conta restrita",
    label: "Regularizar",
    description: "Existe uma pendência cadastral impedindo o uso completo da conta.",
    tone: "border-red-500/20 bg-red-500/[0.08] text-red-700 dark:text-red-300",
  },
  account_missing: {
    icon: ShieldAlert,
    title: "Conta desconectada",
    label: "Suporte necessário",
    description: "A subconta não está mais acessível pela Asaas. O histórico foi preservado e nossa equipe pode recuperar a conexão.",
    tone: "border-red-500/20 bg-red-500/[0.08] text-red-700 dark:text-red-300",
  },
  default: {
    icon: Landmark,
    title: "Ativar NeuroFinance",
    label: "Configuração inicial",
    description: "Crie sua subconta Asaas para receber cobranças e operar o NeuroFinance.",
    tone: "border-zinc-300/60 bg-zinc-100/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300",
  },
};

export const NeuroNexPayWizard = ({ onSuccess, isMobile = false }: NeuroNexPayWizardProps) => {
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const {
    account,
    accountState,
    hasAccount,
    isApproved,
    isLoading,
    needsInitialOnboarding,
    isAccountMissing,
    lastSyncError,
    syncAccount,
  } = useFinancialAccount();

  const [showWizard, setShowWizard] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null);

  const statusKey = isApproved
    ? "active"
    : isAccountMissing
      ? "account_missing"
    : accountState?.uiStatus === "restricted"
      ? "restricted"
      : accountState?.hasActionableStages
        ? "onboarding"
        : hasAccount
          ? "pending_review"
          : "default";
  const visual = statusVisual[statusKey] || statusVisual.default;
  const StatusIcon = visual.icon;
  const bankAccount = [account?.bank_agency, account?.bank_account]
    .filter(Boolean)
    .join(" / ");

  const handlePrimary = () => {
    if (isAccountMissing) {
      const url = buildNeuroFinanceSupportUrl({
        professionalName:
          profile?.full_name ||
          profile?.name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
        professionalEmail: user?.email,
        userId: user?.id,
        accountId: account?.asaas_account_id || account?.id,
        error: lastSyncError,
        occurredAt:
          account?.metadata?.provider_connection?.detected_at ||
          account?.updated_at,
      });
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (needsInitialOnboarding) {
      setShowWizard(true);
      return;
    }
    setShowVerification(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "items-center h-full animate-fade-in",
          isMobile ? "flex flex-col gap-8 px-1" : "grid grid-cols-1 gap-12 lg:grid-cols-2"
        )}
      >
        <div className="relative flex flex-col items-center justify-center py-8 lg:py-0">
          <div className="pointer-events-none absolute inset-0 rounded-full bg-zinc-500/10 opacity-20 blur-[120px]" />
          <motion.div
            whileHover={{ scale: 1.04, rotateY: 4 }}
            className={cn("relative z-10", isMobile ? "w-full max-w-[260px]" : "w-full max-w-[280px] sm:max-w-sm")}
          >
            <NeuroNexCard
              name={profile ? `${profile.first_name} ${profile.last_name}` : "MEMBRO NEURONEX"}
              showSensitive={false}
              className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
            />
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {showWizard ? (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative z-20 flex w-full pt-4 lg:pt-0"
            >
              <CustomOnboardingFlow
                onCancel={() => setShowWizard(false)}
                onComplete={() => {
                  setShowWizard(false);
                  syncAccount.mutate();
                  onSuccess?.();
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="status"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mx-auto max-w-xl space-y-7 text-center lg:mx-0 lg:text-left"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 lg:justify-start">
                  <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em]", visual.tone)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {visual.label}
                  </div>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
                </div>

                <div>
                  <h3 className="text-3xl font-black tracking-[-0.04em] text-zinc-950 dark:text-white">
                    {visual.title}
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {visual.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <InfoRow
                  icon={Building2}
                  label="Situação da conta"
                  value={hasAccount ? getAsaasAccountSituation(account) : "Conta ainda não criada"}
                />
                <InfoRow
                  icon={WalletCards}
                  label="Subconta Asaas"
                  value={account?.asaas_account_id ? `•••• ${String(account.asaas_account_id).slice(-8)}` : "Não vinculada"}
                />
                <InfoRow
                  icon={Landmark}
                  label="Conta de repasse"
                  value={bankAccount || account?.bank_account_last4 ? bankAccount || `•••• ${account?.bank_account_last4}` : "Ainda não informada"}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={handlePrimary}
                  className="h-14 flex-1 rounded-[20px] bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:scale-[1.015] active:scale-[0.985] dark:bg-white dark:text-zinc-900"
                >
                  {isAccountMissing
                    ? "Falar com o suporte"
                    : needsInitialOnboarding
                      ? "Ativar conta"
                      : isApproved
                        ? "Ver análise cadastral"
                        : "Ver pendências"}
                  {isAccountMissing ? (
                    <MessageCircle className="ml-2 h-4 w-4" />
                  ) : (
                    <ArrowRight className="ml-2 h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => syncAccount.mutate()}
                  disabled={syncAccount.isPending}
                  className="h-14 rounded-[20px] border-zinc-200 bg-white/[0.76] px-6 text-[10px] font-black uppercase tracking-[0.2em] dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", syncAccount.isPending && "animate-spin")} />
                  Sincronizar
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 lg:justify-start">
                <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Segurança bancária com infraestrutura Asaas
                </p>
                <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <NeuroFinanceVerificationModal
        open={showVerification}
        onOpenChange={setShowVerification}
        selectedRequirement={selectedRequirement}
        setSelectedRequirement={setSelectedRequirement}
        onSuccess={() => {
          setSelectedRequirement(null);
          syncAccount.mutate();
        }}
      />
    </>
  );
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="group flex items-center gap-4 rounded-[22px] border border-zinc-200/[0.62] bg-white/[0.86] p-4 text-left transition-all hover:border-zinc-300 dark:border-white/[0.06] dark:bg-white/[0.025]">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:bg-white/[0.06] dark:text-zinc-200 dark:group-hover:bg-white dark:group-hover:text-zinc-950">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  </div>
);
