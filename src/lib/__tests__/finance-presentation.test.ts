import { describe, expect, it } from "vitest";

import {
  financeCompetenceLabel,
  financePresentationFromTransaction,
  getFinanceColumnHelp,
  normalizeFinanceAvailability,
  normalizeFinanceMethod,
  normalizeFinanceOrigin,
  normalizeFinanceStatus,
} from "@/lib/finance-presentation";
import type { Transaction } from "@/types";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "movement-1",
  user_id: "professional-1",
  description: "Sessão clínica",
  amount: 250,
  type: "income",
  category: "Sessão",
  date: "2026-08-20T12:00:00.000Z",
  appointment_id: "appointment-1",
  created_at: "2026-08-20T12:00:00.000Z",
  patient_id: "patient-1",
  patient_name: "Ana",
  payment_method: "pix",
  status: "received",
  metadata: {},
  ...overrides,
});

describe("finance presentation contract", () => {
  it.each([
    ["planned", "planned"],
    ["pending", "pending"],
    ["received", "confirmed"],
    ["refund_in_progress", "refund_pending"],
    ["refunded", "refunded"],
    ["reversal_in_progress", "reversal_pending"],
    ["reversed", "reversed"],
    ["chargeback", "disputed"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
  ] as const)("normalizes status %s as %s", (raw, expected) => {
    expect(normalizeFinanceStatus(raw)).toBe(expected);
  });

  it("keeps operation status separate from balance availability", () => {
    expect(normalizeFinanceAvailability("BLOCKED", { isNeuroFinance: true, status: "confirmed" })).toBe("blocked");
    expect(normalizeFinanceAvailability("AVAILABLE", { isNeuroFinance: true, status: "confirmed" })).toBe("available");
    expect(normalizeFinanceAvailability(null, { isNeuroFinance: false, status: "confirmed" })).toBe("not_applicable");
  });

  it("normalizes origin and method without overloading charge type", () => {
    expect(normalizeFinanceOrigin("appointment", { appointmentId: "a-1" })).toBe("agenda");
    expect(normalizeFinanceOrigin("subscription")).toBe("recurrence");
    expect(normalizeFinanceOrigin("convenio")).toBe("insurance");
    expect(normalizeFinanceOrigin("bill_payment")).toBe("payment");
    expect(normalizeFinanceMethod("bank_slip")).toBe("boleto");
    expect(normalizeFinanceMethod("baixa manual")).toBe("manual_settlement");
  });

  it("adapts a transaction to the same vocabulary used by charges", () => {
    const row = financePresentationFromTransaction(transaction({
      metadata: {
        source: "neurofinance",
        provider_status: "confirmed",
        funds_status: "available",
        net_amount: 242.5,
      },
    }));

    expect(row).toMatchObject({
      patientName: "Ana",
      origin: "agenda",
      method: "pix",
      status: "confirmed",
      availability: "available",
      grossAmount: 250,
      netAmount: 242.5,
    });
  });

  it("explains competence according to list context", () => {
    expect(financeCompetenceLabel("2026-08-24")).toBe("24/08/2026");
    expect(getFinanceColumnHelp("competence", "statement_realized").body).toContain("aconteceu");
    expect(getFinanceColumnHelp("competence", "statement_future").body).toContain("esperada");
    expect(getFinanceColumnHelp("competence", "management_charges").body).toContain("vencimento");
  });
});
