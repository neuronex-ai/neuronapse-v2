import { useMemo } from "react";
import { useNeuroFinanceTariffs } from "@/hooks/use-neurofinance-tariffs";
import type { TariffRule } from "@/lib/neurofinance-types";

export type SimulatorMethod = "card" | "boleto" | "pix";

export interface SalesSimulationInput {
  amount: number;
  method: SimulatorMethod;
  installments?: number;
  passFeesToClient?: boolean;
  anticipate?: boolean;
}

export function tariffPercentRate(rule: TariffRule | undefined) {
  return Number(rule?.percent_rate || 0) / 100;
}

export function feeFor(rule: TariffRule | undefined, amount: number) {
  if (!rule) return null;
  const percent = tariffPercentRate(rule);
  const fixed = Number(rule.fixed_fee_cents || 0);
  return Math.round(amount * percent) + fixed;
}

function findRule(rules: TariffRule[], method: SimulatorMethod, installments: number) {
  const candidates = rules.filter((rule) => {
    const sameMethod =
      rule.payment_method === method ||
      (method === "card" && rule.payment_method === "credit_card") ||
      (method === "boleto" && rule.payment_method === "bank_slip");
    const min = rule.installment_min || 1;
    const max = rule.installment_max || min;
    return sameMethod && installments >= min && installments <= max;
  });
  return candidates[0];
}

export function useNeurofinanceSimulator() {
  const { data } = useNeuroFinanceTariffs();
  const rules = useMemo(() => (Array.isArray(data) ? data : []) as TariffRule[], [data]);

  const simulate = (input: SalesSimulationInput) => {
    const amount = Math.max(Math.round(input.amount), 0);
    const installments = Math.max(input.installments || 1, 1);
    const rule = findRule(rules, input.method, installments);
    const fee = feeFor(rule, amount);

    if (fee == null) {
      return {
        amount,
        chargedAmount: amount,
        feeAmount: null,
        netAmount: null,
        rule,
        settlementLabel: "Consulte as condições",
      };
    }

    const chargedAmount = input.passFeesToClient
      ? Math.ceil((amount + Number(rule.fixed_fee_cents || 0)) / (1 - tariffPercentRate(rule)))
      : amount;
    const chargedFee = feeFor(rule, chargedAmount) || fee;

    return {
      amount,
      chargedAmount,
      feeAmount: chargedFee,
      netAmount: chargedAmount - chargedFee,
      rule,
      settlementLabel: rule.settlement_label || "Prazo informado antes da confirmação",
    };
  };

  return { rules, simulate };
}
