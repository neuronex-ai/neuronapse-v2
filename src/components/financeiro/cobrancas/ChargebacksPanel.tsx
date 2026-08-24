import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { FinanceDataTable } from "@/components/financeiro/shared/FinanceDataTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { financeCompetenceLabel, normalizeFinanceMethod, type FinancePresentationRow } from "@/lib/finance-presentation";

export function ChargebacksPanel() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["neurofinance-chargebacks", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neurofinance_chargebacks_v")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Record<string, any>[];
    },
  });

  const rows: FinancePresentationRow[] = (query.data || []).map((item) => {
    const grossAmount = Math.abs(Number(item.dispute_amount ?? item.gross_amount ?? 0)) / 100;
    const competenceAt = item.updated_at || item.created_at || null;
    return {
      id: String(item.id),
      sourceId: item.payment_id || item.charge_id || item.id,
      kind: "dispute",
      direction: "income",
      patientId: item.patient_id || null,
      patientName: item.patient_name || "Sem paciente",
      description: item.description || "Cobrança contestada",
      typeLabel: "Contestação",
      origin: "neurofinance",
      method: normalizeFinanceMethod(item.payment_method || "card"),
      competenceAt,
      competenceLabel: financeCompetenceLabel(competenceAt),
      status: "disputed",
      availability: "blocked",
      grossAmount,
      feeAmount: null,
      netAmount: 0,
      netApplicability: "known",
      actions: ["open"],
      metadata: item,
    };
  });

  return (
    <div className="space-y-5">
      <div className="finance-inset flex items-start gap-4 rounded-[22px] border border-border/55 bg-muted/38 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-black text-foreground">Impacto no saldo</h3>
          <p className="mt-1 max-w-3xl text-xs font-medium leading-5 text-muted-foreground">Uma contestação bloqueia ou retira disponibilidade enquanto a disputa é analisada. Ela não é estorno nem reembolso e permanece vinculada à cobrança original.</p>
        </div>
      </div>
      <FinanceDataTable
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        context="neurofinance_charges"
        emptyTitle="Nenhuma contestação"
        emptyDescription="Quando o titular do cartão abrir uma disputa, ela aparecerá aqui com o impacto no saldo."
        renderActions={(row) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-11 w-11 rounded-xl"
            aria-label={`Ver andamento de ${row.description}`}
            onClick={() => toast.info(String(row.metadata?.dispute_reason || row.metadata?.dispute_status || "Acompanhamento em análise."))}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      />
    </div>
  );
}
