import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, FileWarning, RefreshCw, ShieldCheck } from "lucide-react";

import { AccountResolutionForm } from "@/components/financeiro/AccountResolutionForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { getAsaasAccountSituation } from "@/lib/asaas-account-status";
import { cn } from "@/lib/utils";
import { mobileFinanceSurface } from "../../shared/MobileFinancePrimitives";

const toneClass = {
  approved: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  pending: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  review: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  rejected: "bg-red-500/12 text-red-600 dark:text-red-300",
  missing: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  neutral: "bg-foreground/[0.06] text-muted-foreground",
} as const;

export function MobileNeuroFinanceAccountStatusPanel({
  onOpenNeuroFinance,
}: {
  onOpenNeuroFinance: () => void;
}) {
  const account = useFinancialAccount();
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null);
  const stages = (account.approvalStages || []).slice(0, 5);
  const actionable = account.actionableApprovalStages || [];
  const situation = getAsaasAccountSituation(account.account);
  const approved = account.isApproved;
  const StatusIcon = approved ? CheckCircle2 : account.isRestricted ? AlertCircle : Clock3;

  return (
    <>
      <div className="space-y-4">
        <section className={cn(mobileFinanceSurface, "p-4")}>
          <div className="flex items-start gap-3">
            <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]", approved ? "bg-emerald-500/12 text-emerald-500" : "bg-amber-500/12 text-amber-500")}>
              <StatusIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Saude da conta</p>
              <h3 className="mt-1 text-xl font-black tracking-[-0.04em]">{situation}</h3>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-muted-foreground">
                Acompanhe a aprovação cadastral e resolva pendências documentais pelo celular.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => account.syncAccount.mutate()} disabled={account.syncAccount.isPending} className="h-12 rounded-[16px] text-[9px] font-black uppercase tracking-[0.12em]">
              <RefreshCw className={cn("mr-2 h-4 w-4", account.syncAccount.isPending && "animate-spin")} />
              Sincronizar
            </Button>
            <Button onClick={onOpenNeuroFinance} className="h-12 rounded-[16px] text-[9px] font-black uppercase tracking-[0.12em]">
              Abrir conta
            </Button>
          </div>
        </section>

        <section className={cn(mobileFinanceSurface, "space-y-2 p-3")}>
          <div className="px-1 pb-1 pt-1">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Checklist</p>
            <h4 className="mt-1 text-base font-black tracking-[-0.035em]">5 status de aprovação</h4>
          </div>
          {stages.map((stage) => {
            const Icon = stage.tone === "approved" ? CheckCircle2 : stage.tone === "rejected" || stage.tone === "missing" ? FileWarning : Clock3;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => stage.actionable ? setSelectedRequirement(stage.id) : undefined}
                className="flex w-full items-center gap-3 rounded-[18px] border border-border/35 bg-background/58 p-3 text-left dark:border-white/10 dark:bg-white/[0.025]"
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]", toneClass[stage.tone] || toneClass.neutral)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black">{stage.label}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{stage.statusLabel}</p>
                </div>
                {stage.actionable ? (
                  <span className="rounded-full bg-amber-500/12 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-amber-600 dark:text-amber-300">Resolver</span>
                ) : null}
                <ChevronRight className="h-4 w-4 text-muted-foreground/45" />
              </button>
            );
          })}

          {stages.length === 0 ? (
            <div className="rounded-[18px] border border-border/35 bg-background/58 p-4 text-center dark:border-white/10 dark:bg-white/[0.025]">
              <ShieldCheck className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-xs font-black">Nenhum status cadastral disponível.</p>
            </div>
          ) : null}
        </section>

        {actionable.length > 0 ? (
          <section className={cn(mobileFinanceSurface, "space-y-3 p-4")}>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Pendências</p>
            {actionable.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedRequirement(stage.id)}
                className="flex w-full items-center gap-3 rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-3 text-left text-amber-700 dark:text-amber-300"
              >
                <FileWarning className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-black">{stage.label}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </section>
        ) : null}
      </div>

      <Sheet open={Boolean(selectedRequirement)} onOpenChange={(open) => !open && setSelectedRequirement(null)}>
        <SheetContent side="bottom" className="z-[130] h-[min(92dvh,50rem)] overflow-hidden rounded-t-[32px] border-x-0 border-b-0 border-t border-border/50 bg-background p-0 dark:border-white/10">
          <div className="mobile-scroll-owner h-full overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-foreground/14" />
            {selectedRequirement ? (
              <AccountResolutionForm
                requirement={selectedRequirement}
                onSuccess={() => {
                  setSelectedRequirement(null);
                  void account.refetch();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
