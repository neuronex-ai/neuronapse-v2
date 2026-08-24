import { supabaseAdmin } from "./asaas-client.ts";

export type NormalizedPaymentStatus =
    | "pending"
    | "processing"
    | "confirmed"
    | "paid"
    | "overdue"
    | "canceled"
    | "failed"
    | "refunded"
    | "chargeback";

export type FundsStatus =
    | "pending"
    | "confirmed"
    | "available"
    | "overdue"
    | "canceled"
    | "failed"
    | "refunded"
    | "chargeback";

type FinancialAccountRef = {
    id: string;
    user_id: string;
};

export function normalizePaymentMethod(billingType?: string | null) {
    switch (String(billingType || "").toUpperCase()) {
        case "PIX":
            return "pix";
        case "BOLETO":
            return "boleto";
        case "CREDIT_CARD":
            return "card";
        case "DEBIT_CARD":
            return "debit";
        default:
            return null;
    }
}

export function normalizePaymentState(payment: any, event?: string) {
    const providerStatus = String(payment?.status || event?.replace("PAYMENT_", "") || "PENDING").toUpperCase();
    const eventName = String(event || "").toUpperCase();

    if (eventName === "PAYMENT_RECEIVED" || ["RECEIVED", "RECEIVED_IN_CASH"].includes(providerStatus)) {
        return {
            legacyStatus: "paid",
            normalizedStatus: "paid" as NormalizedPaymentStatus,
            fundsStatus: "available" as FundsStatus,
        };
    }

    if (eventName === "PAYMENT_CONFIRMED" || providerStatus === "CONFIRMED") {
        return {
            legacyStatus: "paid",
            normalizedStatus: "confirmed" as NormalizedPaymentStatus,
            fundsStatus: "confirmed" as FundsStatus,
        };
    }

    if (eventName.includes("CHARGEBACK") || providerStatus.includes("CHARGEBACK")) {
        return {
            legacyStatus: "failed",
            normalizedStatus: "chargeback" as NormalizedPaymentStatus,
            fundsStatus: "chargeback" as FundsStatus,
        };
    }

    if (eventName.includes("REFUND") || providerStatus.includes("REFUND")) {
        return {
            legacyStatus: eventName.includes("IN_PROGRESS") ? "processing" : "refunded",
            normalizedStatus: "refunded" as NormalizedPaymentStatus,
            fundsStatus: "refunded" as FundsStatus,
        };
    }

    if (eventName === "PAYMENT_OVERDUE" || providerStatus === "OVERDUE") {
        return {
            legacyStatus: "expired",
            normalizedStatus: "overdue" as NormalizedPaymentStatus,
            fundsStatus: "overdue" as FundsStatus,
        };
    }

    if (eventName === "PAYMENT_DELETED" || providerStatus === "DELETED") {
        return {
            legacyStatus: "canceled",
            normalizedStatus: "canceled" as NormalizedPaymentStatus,
            fundsStatus: "canceled" as FundsStatus,
        };
    }

    if (eventName.includes("REFUSED") || providerStatus.includes("REFUSED")) {
        return {
            legacyStatus: "failed",
            normalizedStatus: "failed" as NormalizedPaymentStatus,
            fundsStatus: "failed" as FundsStatus,
        };
    }

    if (eventName.includes("RISK_ANALYSIS") || providerStatus === "AWAITING_RISK_ANALYSIS") {
        return {
            legacyStatus: "processing",
            normalizedStatus: "processing" as NormalizedPaymentStatus,
            fundsStatus: "pending" as FundsStatus,
        };
    }

    return {
        legacyStatus: "pending",
        normalizedStatus: "pending" as NormalizedPaymentStatus,
        fundsStatus: "pending" as FundsStatus,
    };
}

export async function estimatePaymentFee(
    grossAmount: number,
    paymentMethod: string | null,
    installments = 1,
    channel = "online"
) {
    if (!paymentMethod) {
        return { feeRuleId: null, estimatedFee: null, netAmount: null };
    }

    const tariffChannel = paymentMethod === "pix" ? "dynamic" : channel;
    const { data, error } = await supabaseAdmin
        .from("neurofinance_tariff_rules")
        .select("id,percent_rate,fixed_fee_cents,installment_min,installment_max")
        .eq("operation", "charge")
        .eq("payment_method", paymentMethod)
        .eq("channel", tariffChannel)
        .eq("active", true)
        .lte("effective_from", new Date().toISOString().slice(0, 10))
        .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().slice(0, 10)}`);

    if (error) {
        console.warn("[neurofinance] Tariff lookup failed:", error);
        return { feeRuleId: null, estimatedFee: null, netAmount: null };
    }

    const rule = (data || []).find((candidate: any) =>
        installments >= Number(candidate.installment_min || installments) &&
        installments <= Number(candidate.installment_max || installments)
    );

    if (!rule || (rule.percent_rate == null && rule.fixed_fee_cents == null)) {
        return { feeRuleId: rule?.id || null, estimatedFee: null, netAmount: null };
    }

    const estimatedFee =
        Math.round(grossAmount * Number(rule.percent_rate || 0) / 100) +
        Number(rule.fixed_fee_cents || 0);

    return {
        feeRuleId: rule.id,
        estimatedFee,
        netAmount: Math.max(grossAmount - estimatedFee, 0),
    };
}

export async function upsertPaymentFromProvider(
    financialAccount: FinancialAccountRef,
    payment: any,
    event?: string
) {
    if (!payment?.id) return null;

    const paymentMethod = normalizePaymentMethod(payment.billingType);
    const installments = Math.max(Number(payment.installmentCount || 1), 1);
    const grossAmount = Math.round(Number(payment.value || 0) * 100);
    const providerNetAmount = payment.netValue == null
        ? null
        : Math.round(Number(payment.netValue || 0) * 100);
    const state = normalizePaymentState(payment, event);
    const feeEstimate = await estimatePaymentFee(grossAmount, paymentMethod, installments);
    const actualFee = providerNetAmount == null
        ? null
        : Math.max(grossAmount - providerNetAmount, 0);

    const { data: existing, error: existingError } = await supabaseAdmin
        .from("nb_payments")
        .select("*")
        .eq("provider", "asaas")
        .eq("provider_payment_id", payment.id)
        .maybeSingle();

    if (existingError) throw existingError;

    const refundAmount = state.fundsStatus === "refunded"
        ? Math.round(Number(payment.refundedValue || payment.value || 0) * 100)
        : existing?.refund_amount || 0;

    const patch = {
        user_id: financialAccount.user_id,
        financial_account_id: financialAccount.id,
        provider: "asaas",
        provider_payment_id: payment.id,
        provider_status: String(payment.status || event?.replace("PAYMENT_", "") || "PENDING").toUpperCase(),
        payment_method_type: paymentMethod || existing?.payment_method_type || null,
        status: state.legacyStatus,
        normalized_status: state.normalizedStatus,
        funds_status: state.fundsStatus,
        gross_amount: grossAmount || existing?.gross_amount || 0,
        platform_fee_amount: actualFee ?? feeEstimate.estimatedFee ?? existing?.platform_fee_amount ?? 0,
        estimated_fee_amount: feeEstimate.estimatedFee,
        actual_fee_amount: actualFee,
        net_amount: providerNetAmount ?? feeEstimate.netAmount ?? existing?.net_amount ?? grossAmount,
        refund_amount: refundAmount,
        fee_rule_id: feeEstimate.feeRuleId,
        installments,
        channel: "online",
        currency: "brl",
        description: payment.description || existing?.description || "Cobrança NeuroFinance",
        checkout_url: payment.invoiceUrl || existing?.checkout_url || null,
        expires_at: payment.dueDate || existing?.expires_at || null,
        paid_at: payment.paymentDate || existing?.paid_at || null,
        confirmed_at: payment.confirmedDate || existing?.confirmed_at || null,
        available_at: state.fundsStatus === "available"
            ? payment.paymentDate || new Date().toISOString()
            : existing?.available_at || null,
        estimated_credit_at: payment.estimatedCreditDate || existing?.estimated_credit_at || null,
        reconciliation_status: "reconciled",
        reconciled_at: new Date().toISOString(),
        metadata: {
            ...(existing?.metadata || {}),
            asaas_payment_id: payment.id,
            asaas_customer_id: payment.customer || existing?.metadata?.asaas_customer_id || null,
            asaas_status: payment.status || null,
            asaas_billing_type: payment.billingType || null,
            asaas_invoice_url: payment.invoiceUrl || null,
            asaas_bank_slip_url: payment.bankSlipUrl || null,
            asaas_last_event: event || "RECONCILIATION",
            source: existing?.metadata?.source || "provider_sync",
        },
        updated_at: new Date().toISOString(),
    };

    if (existing) {
        const { data, error } = await supabaseAdmin
            .from("nb_payments")
            .update(patch)
            .eq("id", existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabaseAdmin
        .from("nb_payments")
        .insert(patch)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function upsertAccountMovement(input: {
    userId: string;
    financialAccountId: string;
    providerMovementId?: string | null;
    movementType: string;
    direction: "credit" | "debit";
    amount: number;
    description?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    occurredAt?: string | null;
    metadata?: Record<string, unknown>;
}) {
    const row = {
        user_id: input.userId,
        financial_account_id: input.financialAccountId,
        provider: "asaas",
        provider_movement_id: input.providerMovementId || null,
        movement_type: input.movementType,
        direction: input.direction,
        status: "posted",
        amount: Math.max(Math.round(input.amount), 0),
        currency: "brl",
        description: input.description || null,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
        occurred_at: input.occurredAt || new Date().toISOString(),
        metadata: input.metadata || {},
        updated_at: new Date().toISOString(),
    };

    const conflictTarget = input.referenceId
        ? "financial_account_id,movement_type,reference_id"
        : "financial_account_id,provider_movement_id";

    const { error } = await supabaseAdmin
        .from("neurofinance_account_movements")
        .upsert(row, { onConflict: conflictTarget, ignoreDuplicates: false });

    if (error) throw error;
}

export async function refreshOverviewSnapshot(
    financialAccountId: string,
    availableBalance?: number,
    source = "database",
    syncError?: string | null
) {
    if (availableBalance != null) {
        const { data: account, error: accountError } = await supabaseAdmin
            .from("financial_accounts")
            .select("user_id")
            .eq("id", financialAccountId)
            .single();
        if (accountError) throw accountError;

        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
            .from("neurofinance_overview_snapshots")
            .upsert({
                financial_account_id: financialAccountId,
                user_id: account.user_id,
                available_balance: availableBalance,
                source,
                provider_as_of: now,
                last_reconciled_at: now,
                last_sync_error: syncError || null,
                is_stale: false,
                updated_at: now,
            }, { onConflict: "financial_account_id" });
        if (error) throw error;
    }

    const { error } = await supabaseAdmin.rpc(
        "refresh_neurofinance_overview_snapshot",
        { target_financial_account_id: financialAccountId }
    );
    if (error) throw error;

    if (availableBalance != null && !syncError) {
        const { error: clearError } = await supabaseAdmin
            .from("neurofinance_overview_snapshots")
            .update({
                last_sync_error: null,
                is_stale: false,
                updated_at: new Date().toISOString(),
            })
            .eq("financial_account_id", financialAccountId);
        if (clearError) throw clearError;
    }
}
