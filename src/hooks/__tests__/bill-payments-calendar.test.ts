import { describe, expect, it } from "vitest";

import { mapBillPaymentToCalendarItem } from "../use-bill-payments-calendar";
import type { BillPaymentRecord } from "../use-neurofinance-bill-payments";

const record: BillPaymentRecord = {
  id: "bill-1",
  provider_bill_id: "asaas-1",
  external_reference: "neurofinance:bill:1",
  status: "scheduled",
  payment_mode: "scheduled",
  amount: 20000,
  fee_amount: 250,
  due_date: "2026-07-02",
  scheduled_date: "2026-06-19",
  beneficiary_name: "NeuroNex AI",
  bank_code: "461",
  receipt_url: "https://example.com/receipt",
  created_at: "2026-06-10T12:00:00Z",
};

describe("bill payments calendar mapping", () => {
  it("maps a submitted scheduled bill to its processing date", () => {
    expect(mapBillPaymentToCalendarItem(record)).toMatchObject({
      date: "2026-06-19",
      amount: 202.5,
      status: "scheduled",
      beneficiaryName: "NeuroNex AI",
      bankName: "Banco 461",
      hasReceipt: true,
    });
  });

  it("ignores consultations that were not submitted or scheduled", () => {
    expect(mapBillPaymentToCalendarItem({ ...record, provider_bill_id: null })).toBeNull();
    expect(mapBillPaymentToCalendarItem({ ...record, scheduled_date: null })).toBeNull();
    expect(mapBillPaymentToCalendarItem({ ...record, payment_mode: "now" })).toBeNull();
  });
});
