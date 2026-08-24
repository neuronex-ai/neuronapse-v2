import {
    asaasRequest,
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    supabaseAdmin,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

function cents(value: unknown) {
    return Math.round(Number(value || 0) * 100);
}

function normalizeStatus(status: string) {
    const value = String(status || '').toUpperCase();
    if (['CREDITED', 'DONE', 'APPROVED'].includes(value)) return 'credited';
    if (['DENIED', 'REFUSED', 'REJECTED'].includes(value)) return 'denied';
    if (['CANCELLED', 'CANCELED'].includes(value)) return 'cancelled';
    if (['DEBITED'].includes(value)) return 'debited';
    if (['OVERDUE'].includes(value)) return 'overdue';
    if (['SCHEDULED'].includes(value)) return 'scheduled';
    return 'pending';
}

async function upsertAnticipation(userId: string, accountId: string, anticipation: any, localPaymentId?: string | null) {
    const row = {
        user_id: userId,
        financial_account_id: accountId,
        provider: 'asaas',
        provider_anticipation_id: anticipation?.id || null,
        provider_status: anticipation?.status || null,
        normalized_status: normalizeStatus(anticipation?.status),
        payment_id: localPaymentId || null,
        provider_payment_id: anticipation?.payment || anticipation?.paymentId || null,
        installment_id: anticipation?.installment || anticipation?.installmentId || null,
        gross_amount: cents(anticipation?.totalValue || anticipation?.value || anticipation?.grossValue),
        anticipated_amount: cents(anticipation?.anticipatedValue || anticipation?.value),
        fee_amount: cents(anticipation?.fee || anticipation?.anticipationFee),
        net_amount: cents(anticipation?.netValue || anticipation?.anticipatedValue || anticipation?.value),
        anticipation_days: Number(anticipation?.anticipationDays || 0) || null,
        anticipation_date: anticipation?.anticipationDate || null,
        due_date: anticipation?.dueDate || null,
        requested_at: anticipation?.dateCreated || new Date().toISOString(),
        credited_at: anticipation?.creditedDate || null,
        documents_required: Boolean(anticipation?.isDocumentationRequired),
        denial_observation: anticipation?.denialObservation || null,
        provider_payload: anticipation || {},
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
        .from('neurofinance_anticipations')
        .upsert(row, { onConflict: 'provider,provider_anticipation_id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );
        const body = await req.json().catch(() => ({}));
        const action = body.action || 'list';
        const account = await getFinancialAccount(user.id);
        const apiKey = await getFinancialAccountAsaasApiKey(account);

        if (!account || !apiKey) {
            return errorResponse('Sua conta ainda não está pronta para antecipar recebíveis.', 403);
        }

        if (action === 'list') {
            const result = await asaasRequest('/anticipations?limit=100&offset=0', 'GET', undefined, apiKey) as any;
            for (const item of result?.data || []) {
                await upsertAnticipation(user.id, account.id, item);
            }
            return jsonResponse({ success: true, ...(result || {}) });
        }

        if (action === 'list_eligible_payments') {
            const { data, error } = await supabaseAdmin
                .from('neurofinance_eligible_anticipation_payments_v')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            return jsonResponse({ success: true, payments: data || [] });
        }

        if (action === 'simulate') {
            const payment = body.payment || body.paymentId;
            const installment = body.installment || body.installmentId;
            if (!payment && !installment) {
                return errorResponse('Escolha uma cobrança para simular a antecipação.', 400);
            }
            const result = await asaasRequest('/anticipations/simulate', 'POST', {
                payment,
                installment,
            }, apiKey);
            return jsonResponse({ success: true, simulation: result });
        }

        if (action === 'request') {
            const payment = body.payment || body.paymentId;
            const installment = body.installment || body.installmentId;
            if (!payment && !installment) {
                return errorResponse('Escolha uma cobrança para solicitar a antecipação.', 400);
            }

            const result = await asaasRequest('/anticipations', 'POST', {
                payment,
                installment,
            }, apiKey) as any;

            const { data: localPayment } = payment
                ? await supabaseAdmin
                    .from('nb_payments')
                    .select('id')
                    .eq('provider_payment_id', payment)
                    .maybeSingle()
                : { data: null };
            const record = await upsertAnticipation(user.id, account.id, result, localPayment?.id || null);
            return jsonResponse({ success: true, anticipation: result, record });
        }

        if (action === 'automatic_config') {
            const result = await asaasRequest('/anticipations/configurations', 'GET', undefined, apiKey);
            return jsonResponse({ success: true, config: result });
        }

        return errorResponse('Esta ação de antecipação não está disponível.', 400);
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-anticipations error:', error);
        return errorResponse(error?.message || 'Não conseguimos processar a antecipação agora.', error?.status || 500);
    }
});
