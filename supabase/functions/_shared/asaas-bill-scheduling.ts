export type BillPaymentMode = "now" | "scheduled";

export interface BillSchedulingInput {
    availableBalanceCents: number | null;
    totalCents: number;
    minimumScheduleDate: string | null;
    dueDate: string | null;
    today: string;
}

export interface BillSchedulingDecision {
    canPayNow: boolean;
    canSchedule: boolean;
    recommendedMode: BillPaymentMode | null;
    defaultScheduleDate: string | null;
    balanceShortfallCents: number;
}

export function dateInTimeZone(date = new Date(), timeZone = "America/Sao_Paulo") {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function evaluateBillScheduling(input: BillSchedulingInput): BillSchedulingDecision {
    const hasEnoughBalance = input.availableBalanceCents != null &&
        input.availableBalanceCents >= input.totalCents;
    const operationalToday = !input.minimumScheduleDate ||
        input.minimumScheduleDate <= input.today;
    const notOverdue = !input.dueDate || input.dueDate >= input.today;
    const canPayNow = hasEnoughBalance && operationalToday && notOverdue;
    const canSchedule = Boolean(
        input.dueDate &&
        input.dueDate > input.today &&
        (!input.minimumScheduleDate || input.dueDate >= input.minimumScheduleDate),
    );

    return {
        canPayNow,
        canSchedule,
        recommendedMode: canPayNow ? "now" : canSchedule ? "scheduled" : null,
        defaultScheduleDate: canSchedule ? input.dueDate : null,
        balanceShortfallCents: input.availableBalanceCents == null
            ? input.totalCents
            : Math.max(0, input.totalCents - input.availableBalanceCents),
    };
}

export function validateBillPaymentDecision(
    mode: BillPaymentMode,
    scheduleDate: string | null,
    input: BillSchedulingInput,
) {
    const availability = evaluateBillScheduling(input);

    if (mode === "now") {
        if (!availability.canPayNow) {
            throw Object.assign(
                new Error(availability.canSchedule
                    ? "O saldo disponível não cobre o valor total. Escolha uma data para agendar o boleto."
                    : "Este boleto não pode ser pago agora com o saldo disponível."),
                { status: 409, code: "BILL_SCHEDULE_REQUIRED" },
            );
        }
        return input.today;
    }

    if (!availability.canSchedule || !scheduleDate) {
        throw Object.assign(
            new Error("Este boleto não possui uma data futura válida para agendamento."),
            { status: 409, code: "BILL_CANNOT_BE_SCHEDULED" },
        );
    }
    if (scheduleDate <= input.today) {
        throw Object.assign(
            new Error("Escolha uma data futura para agendar o pagamento."),
            { status: 400, code: "INVALID_SCHEDULE_DATE" },
        );
    }
    if (input.minimumScheduleDate && scheduleDate < input.minimumScheduleDate) {
        throw Object.assign(
            new Error(`A primeira data disponível para este pagamento é ${input.minimumScheduleDate}.`),
            { status: 400, code: "INVALID_SCHEDULE_DATE" },
        );
    }
    if (input.dueDate && scheduleDate > input.dueDate) {
        throw Object.assign(
            new Error("A data do agendamento não pode ultrapassar o vencimento do boleto."),
            { status: 400, code: "INVALID_SCHEDULE_DATE" },
        );
    }

    return scheduleDate;
}

export function normalizeBillPaymentStatus(
    providerStatus: string | null | undefined,
    scheduleDate: string | null | undefined,
    today = dateInTimeZone(),
) {
    const status = String(providerStatus || "PENDING").toUpperCase();
    if (status === "PAID") return "paid";
    if (status === "FAILED") return "failed";
    if (status === "CANCELLED" || status === "CANCELED") return "cancelled";
    if (status === "REFUNDED") return "refunded";
    if ((status === "PENDING" || status === "CREATED") && scheduleDate && scheduleDate > today) {
        return "scheduled";
    }
    return "processing";
}
