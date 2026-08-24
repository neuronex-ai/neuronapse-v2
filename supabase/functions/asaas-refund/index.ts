/**
 * asaas-refund
 *
 * Initiates a refund for a payment via Asaas API.
 *
 * POST /asaas-refund
 * Body: {
 *   payment_id: string,       // nb_payments.id
 *   amount?: number           // In centavos. If undefined, full refund.
 * }
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    refundAsaasPayment,
    getFinancialAccountAsaasApiKey,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );
        const { payment_id, amount } = await req.json();

        if (!payment_id) {
            return errorResponse('payment_id é obrigatório', 400);
        }

        // 1. Get payment and validate ownership
        const { data: payment, error } = await supabaseAdmin
            .from('nb_payments')
            .select('*')
            .eq('id', payment_id)
            .eq('user_id', user.id)
            .single();

        if (error || !payment) {
            return errorResponse('Pagamento não encontrado', 404);
        }

        if (payment.status !== 'paid' && payment.status !== 'processing') {
            return errorResponse('Somente pagamentos confirmados podem ser estornados', 400);
        }

        const asaasPaymentId =
            payment.provider_payment_id || payment.metadata?.asaas_payment_id;
        if (!asaasPaymentId) {
            return errorResponse('ID de pagamento Asaas não encontrado', 400);
        }

        // 2. Get financial account for API key
        const financialAccount = await getFinancialAccount(user.id);
        const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!financialAccount || !subApiKey) {
            return errorResponse('Conta financeira não configurada', 403);
        }

        // 3. Validate refund amount
        const remainingAmount = payment.gross_amount - (payment.refund_amount || 0);
        if (amount && amount > remainingAmount) {
            return errorResponse('Valor do estorno não pode ser maior que o valor restante', 400);
        }

        // 4. Execute refund via Asaas API
        const refundValueReais = amount ? amount / 100 : undefined;
        const refund = await refundAsaasPayment(subApiKey, asaasPaymentId, refundValueReais);

        // 5. Update payment status optimistically
        await supabaseAdmin
            .from('nb_payments')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

        return jsonResponse({
            success: true,
            refund: refund,
            payment_id: payment.id,
            status: 'processing',
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-refund error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
