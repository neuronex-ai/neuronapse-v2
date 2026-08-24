import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import {
    evaluateBillScheduling,
    normalizeBillPaymentStatus,
    validateBillPaymentDecision,
} from "./asaas-bill-scheduling.ts";

const base = {
    totalCents: 500,
    minimumScheduleDate: "2026-06-10",
    dueDate: "2026-06-13",
    today: "2026-06-10",
};

Deno.test("offers now and scheduled when balance covers the bill", () => {
    assertEquals(evaluateBillScheduling({
        ...base,
        availableBalanceCents: 1000,
    }), {
        canPayNow: true,
        canSchedule: true,
        recommendedMode: "now",
        defaultScheduleDate: "2026-06-13",
        balanceShortfallCents: 0,
    });
});

Deno.test("forces scheduling when balance is insufficient", () => {
    const input = { ...base, availableBalanceCents: 100 };
    assertEquals(evaluateBillScheduling(input).recommendedMode, "scheduled");
    assertThrows(
        () => validateBillPaymentDecision("now", null, input),
        Error,
        "saldo disponível não cobre",
    );
    assertEquals(
        validateBillPaymentDecision("scheduled", "2026-06-13", input),
        "2026-06-13",
    );
});

Deno.test("blocks scheduling beyond the due date", () => {
    assertThrows(
        () => validateBillPaymentDecision(
            "scheduled",
            "2026-06-14",
            { ...base, availableBalanceCents: 1000 },
        ),
        Error,
        "não pode ultrapassar",
    );
});

Deno.test("maps future pending bills as scheduled", () => {
    assertEquals(normalizeBillPaymentStatus("PENDING", "2026-06-13", "2026-06-10"), "scheduled");
    assertEquals(normalizeBillPaymentStatus("BANK_PROCESSING", "2026-06-10", "2026-06-10"), "processing");
    assertEquals(normalizeBillPaymentStatus("PAID", "2026-06-10", "2026-06-10"), "paid");
});
