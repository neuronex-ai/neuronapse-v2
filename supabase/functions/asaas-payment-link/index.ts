/**
 * asaas-payment-link
 *
 * Creates a payment link via Asaas API on the psychologist's sub-account.
 *
 * POST /asaas-payment-link
 * Body: {
 *   name: string,
 *   description?: string,
 *   amount: number,                 // centavos
 *   billing_type?: 'pix' | 'card' | 'boleto' | 'undefined',
 *   charge_type?: 'DETACHED' | 'RECURRENT' | 'INSTALLMENT',
 *   due_date_limit_days?: number,
 *   max_installment_count?: number,
 * }
 */

import {
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    createAsaasPaymentLink,
    getFinancialAccountAsaasApiKey,
    type AsaasBillingType,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

const BILLING_TYPE_MAP: Record<string, AsaasBillingType> = {
    pix: 'PIX',
    card: 'CREDIT_CARD',
    boleto: 'BOLETO',
    undefined: 'UNDEFINED',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );
        const body = await req.json();

        const { name, description, amount, billing_type, charge_type, due_date_limit_days, max_installment_count } = body;

        if (!name || !amount || amount <= 0) {
            return errorResponse('name e amount são obrigatórios', 400);
        }

        // Get financial account
        const financialAccount = await getFinancialAccount(user.id);
        const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!financialAccount || !subApiKey) {
            return errorResponse('Conta financeira não configurada.', 403);
        }

        // Create payment link
        const billingType = BILLING_TYPE_MAP[billing_type || 'undefined'] || 'UNDEFINED';
        const valueReais = amount / 100;

        const paymentLink = await createAsaasPaymentLink(subApiKey, {
            name,
            description,
            value: valueReais,
            billingType,
            chargeType: charge_type || 'DETACHED',
            dueDateLimitDays: due_date_limit_days || 30,
            maxInstallmentCount: max_installment_count,
        });

        return jsonResponse({
            success: true,
            payment_link: paymentLink,
            url: paymentLink.url,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-payment-link error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
