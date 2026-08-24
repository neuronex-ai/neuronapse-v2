/**
 * check-invoice-status
 * 
 * Checks the payment status of an invoice by looking up the linked
 * nb_payments record and verifying against Asaas payment status.
 * 
 * This is called when the user clicks the "Sync" button on a pending invoice.
 * 
 * POST /check-invoice-status
 * Body: { invoiceId: string }
 * 
 * Returns: { status: 'paid' | 'pending' | 'expired' | 'failed', updated: boolean }
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    asaasRequest,
    getFinancialAccountAsaasApiKey,
} from '../_shared/asaas-client.ts';
import { syncFinancialEntryForPayment } from '../_shared/financial-management.ts';
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
        const { invoiceId } = await req.json();

        if (!invoiceId) {
            return errorResponse('invoiceId is required');
        }

        // 1. Get the invoice
        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('user_id', user.id)
            .single();

        if (invoiceError || !invoice) {
            return errorResponse('Invoice not found', 404);
        }

        // Already paid? Return immediately
        if (invoice.status === 'paid') {
            return jsonResponse({ status: 'paid', updated: false });
        }

        // 2. Find the linked nb_payments record
        // Try matching by invoice_id in metadata, then by patient + amount
        let payment: any = null;

        // Strategy A: Search by metadata containing this invoice ID
        const { data: paymentsByMeta } = await supabaseAdmin
            .from('nb_payments')
            .select('*')
            .eq('user_id', user.id)
            .contains('metadata', { invoice_id: invoiceId })
            .order('created_at', { ascending: false })
            .limit(1);

        if (paymentsByMeta && paymentsByMeta.length > 0) {
            payment = paymentsByMeta[0];
        }

        // Strategy B: Match by patient_id + amount (approximate)
        if (!payment && invoice.patient_id) {
            const amountInCentavos = Math.round(invoice.amount * 100);
            const { data: paymentsByMatch } = await supabaseAdmin
                .from('nb_payments')
                .select('*')
                .eq('user_id', user.id)
                .eq('patient_id', invoice.patient_id)
                .gte('gross_amount', amountInCentavos - 1)
                .lte('gross_amount', amountInCentavos + 1)
                .order('created_at', { ascending: false })
                .limit(1);

            if (paymentsByMatch && paymentsByMatch.length > 0) {
                payment = paymentsByMatch[0];
            }
        }

        if (!payment) {
            // No linked payment record found - invoice has no payment link yet
            return jsonResponse({
                status: invoice.status,
                updated: false,
                message: 'No payment record linked to this invoice'
            });
        }

        // 3. If payment already shows as paid in our DB, sync invoice
        if (payment.status === 'paid') {
            if (invoice.status !== 'paid') {
                await supabaseAdmin
                    .from('invoices')
                    .update({ status: 'paid' })
                    .eq('id', invoiceId);
                await syncFinancialEntryForPayment(payment, {
                    matchedBy: 'automatic',
                    notes: 'Verificacao manual de status da fatura',
                });
                return jsonResponse({ status: 'paid', updated: true });
            }
            await syncFinancialEntryForPayment(payment, {
                matchedBy: 'automatic',
                notes: 'Verificacao manual de status da fatura',
            });
            return jsonResponse({ status: 'paid', updated: false });
        }

        // 4. Check Asaas for the latest status
        let providerStatus = 'pending';
        let updated = false;
        let paymentForSync = payment;

        // Find Asaas payment id (provider-neutral)
        const asaasPaymentId =
            payment.provider_payment_id || payment.metadata?.asaas_payment_id;

        if (!asaasPaymentId) {
            return jsonResponse({
                status: payment.status || invoice.status,
                updated: false,
                message: 'Pagamento sem provider_payment_id vinculado'
            });
        }

        // Need subconta key to query Asaas
        const financialAccount = await getFinancialAccount(user.id);
        const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!subApiKey) {
            return errorResponse('Conta financeira não configurada. Complete o onboarding primeiro.', 403);
        }

        try {
            const asaasPayment = await asaasRequest<any>(
                `/payments/${encodeURIComponent(asaasPaymentId)}`,
                'GET',
                undefined,
                subApiKey
            );

            // Asaas statuses: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, DELETED, etc.
            const s = String(asaasPayment?.status || '').toUpperCase();
            if (s === 'RECEIVED' || s === 'CONFIRMED') providerStatus = 'paid';
            else if (s === 'OVERDUE') providerStatus = 'expired';
            else if (s === 'REFUNDED') providerStatus = 'refunded';
            else if (s === 'DELETED' || s === 'CANCELLED') providerStatus = 'failed';
            else providerStatus = 'pending';
        } catch (e: any) {
            console.error(`[check-invoice-status] Erro ao consultar pagamento Asaas ${asaasPaymentId}:`, e?.message);
            providerStatus = payment.status || 'pending';
        }

        // 5. Update local records if status changed
        if (providerStatus !== payment.status) {
            updated = true;

            // Update nb_payments
            const paymentUpdate: any = {
                status: providerStatus,
                updated_at: new Date().toISOString()
            };
            if (providerStatus === 'paid') {
                paymentUpdate.paid_at = new Date().toISOString();
            }
            paymentForSync = {
                ...payment,
                ...paymentUpdate,
                normalized_status: providerStatus === 'paid' ? 'paid' : providerStatus,
            };
            await supabaseAdmin
                .from('nb_payments')
                .update(paymentUpdate)
                .eq('id', payment.id);

            // Update invoices
            await supabaseAdmin
                .from('invoices')
                .update({ status: providerStatus === 'paid' ? 'paid' : providerStatus })
                .eq('id', invoiceId);

            console.log(`[check-invoice-status] Updated invoice ${invoiceId} and payment ${payment.id} to ${providerStatus}`);
        }

        if (['paid', 'expired', 'failed', 'refunded'].includes(providerStatus)) {
            await syncFinancialEntryForPayment(paymentForSync, {
                matchedBy: 'automatic',
                notes: 'Verificacao manual de status da fatura',
            });
        }

        return jsonResponse({
            status: providerStatus,
            updated,
            payment_id: payment.id,
            provider_payment_id: asaasPaymentId,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('[check-invoice-status] Error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
