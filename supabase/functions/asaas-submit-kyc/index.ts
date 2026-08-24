/**
 * asaas-submit-kyc
 *
 * Submits KYC documents (identity, selfie, etc.) to the Asaas sub-account.
 *
 * POST /asaas-submit-kyc
 * Expects multipart/form-data with:
 *   - document_type: string ('IDENTIFICATION' | 'SOCIAL_CONTRACT' | 'ENTREPRENEUR_REQUIREMENT' | 'MINUTES_OF_ELECTION' | 'CUSTOM')
 *   - file: File (the document file)
 */

import {
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    asaasRequest,
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

        // 1. Get financial account
        const financialAccount = await getFinancialAccount(user.id);
        const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!financialAccount || !subApiKey) {
            return errorResponse('Conta financeira não configurada.', 403);
        }

        // 2. Parse multipart form data
        const formData = await req.formData();
        const documentType = formData.get('document_type') as string;
        const file = formData.get('file') as File;

        if (!documentType || !file) {
            return errorResponse('document_type e file são obrigatórios', 400);
        }

        // 3. Build FormData for Asaas API
        const asaasFormData = new FormData();
        asaasFormData.append('documentFile', file, file.name);
        asaasFormData.append('type', documentType);

        // 4. Upload to Asaas
        const result = await asaasRequest(
            '/myAccount/documents',
            'POST',
            asaasFormData,
            subApiKey
        );

        return jsonResponse({
            success: true,
            document: result,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-submit-kyc error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
