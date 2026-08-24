import {
    asaasRequest,
    corsResponse,
    errorResponse,
    findOrCreateAsaasCustomer,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    recordBaasOperation,
    sanitizeDigits,
    supabaseAdmin,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};

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

        if (!account || !apiKey) return errorResponse('Conta NeuroFinance não configurada ou ainda indisponível.', 403);

        if (action === 'list') {
            const query = new URLSearchParams({
                limit: String(clamp(body.limit, 50, 1, 100)),
                offset: String(clamp(body.offset, 0, 0, 10_000)),
            });
            if (body.status) query.set('status', String(body.status));

            if (body.patient_id) {
                const { data: patient, error: patientError } = await supabaseAdmin
                    .from('patients')
                    .select('id,cpf')
                    .eq('id', body.patient_id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (patientError) throw patientError;
                if (!patient) return errorResponse('Paciente não encontrado.', 404);
                const cpf = sanitizeDigits(patient.cpf);
                if (!cpf) return jsonResponse({ success: true, data: [], totalCount: 0, hasMore: false });
                const customers = await asaasRequest<{ data?: Array<{ id: string }> }>(
                    `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`,
                    'GET',
                    undefined,
                    apiKey,
                );
                const customerId = customers.data?.[0]?.id;
                if (!customerId) return jsonResponse({ success: true, data: [], totalCount: 0, hasMore: false });
                query.set('customer', customerId);
            }

            const result = await asaasRequest(`/invoices?${query.toString()}`, 'GET', undefined, apiKey);
            return jsonResponse({ success: true, ...(result as Record<string, unknown>) });
        }

        if (action === 'detail') {
            if (!body.id) return errorResponse('Identificador da NFS-e é obrigatório.', 400);
            const result = await asaasRequest(`/invoices/${encodeURIComponent(body.id)}`, 'GET', undefined, apiKey);
            return jsonResponse({ success: true, invoice: result });
        }

        if (action === 'municipal_services') {
            const query = body.description ? `?description=${encodeURIComponent(body.description)}` : '';
            const result = await asaasRequest(`/invoices/municipalServices${query}`, 'GET', undefined, apiKey);
            return jsonResponse({ success: true, ...(result as Record<string, unknown>) });
        }

        if (action === 'create') {
            if (!body.serviceDescription || !body.effectiveDate || (!body.payment && !body.patient_id)) {
                return errorResponse('Informe paciente ou cobrança, descrição do serviço e data efetiva.', 400);
            }

            if (body.idempotencyKey) {
                const { data: existing, error: existingError } = await supabaseAdmin
                    .from('neurofinance_baas_operations')
                    .select('provider_response,status,provider_operation_id')
                    .eq('user_id', user.id)
                    .eq('operation_type', 'nfse_create')
                    .filter('payload->>idempotencyKey', 'eq', String(body.idempotencyKey))
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (existingError) console.warn('[asaas-invoices] Idempotency lookup failed:', existingError.message);
                if (existing?.provider_response && Object.keys(existing.provider_response).length > 0) {
                    return jsonResponse({ success: true, invoice: existing.provider_response, duplicate: true });
                }
            }

            const { data: settings, error: settingsError } = await supabaseAdmin
                .from('user_fiscal_settings')
                .select('service_code,iss_aliquot,asaas_municipal_service_id,asaas_municipal_service_name')
                .eq('user_id', user.id)
                .maybeSingle();
            if (settingsError) throw settingsError;

            const municipalServiceId = body.municipalServiceId || settings?.asaas_municipal_service_id || null;
            const municipalServiceCode = municipalServiceId ? null : (body.municipalServiceCode || settings?.service_code || null);
            const municipalServiceName = body.municipalServiceName || settings?.asaas_municipal_service_name || 'Serviços de psicologia';
            if (!municipalServiceId && !municipalServiceCode) {
                return errorResponse('Complete o serviço municipal nos dados fiscais antes de emitir.', 422, { code: 'FISCAL_CONFIGURATION_INCOMPLETE' });
            }

            let customerId: string | null = null;
            if (!body.payment && body.patient_id) {
                const { data: patient, error: patientError } = await supabaseAdmin
                    .from('patients')
                    .select('id,name,cpf,email,phone')
                    .eq('id', body.patient_id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (patientError) throw patientError;
                if (!patient) return errorResponse('Paciente não encontrado.', 404);
                if (!sanitizeDigits(patient.cpf)) {
                    return errorResponse(`O CPF de ${patient.name} precisa ser preenchido antes da emissão.`, 422, { code: 'PATIENT_CPF_REQUIRED' });
                }
                const customer = await findOrCreateAsaasCustomer(apiKey, {
                    name: patient.name,
                    cpfCnpj: patient.cpf,
                    email: patient.email || undefined,
                    phone: patient.phone || undefined,
                    externalReference: patient.id,
                });
                customerId = customer.id;
            }

            const payload: Record<string, unknown> = {
                ...(body.payment ? { payment: body.payment } : { customer: customerId }),
                serviceDescription: body.serviceDescription,
                observations: body.observations,
                value: Number(body.value),
                deductions: Number(body.deductions || 0),
                effectiveDate: body.effectiveDate,
                municipalServiceId,
                municipalServiceCode,
                municipalServiceName,
                taxes: body.taxes || {
                    retainIss: false,
                    iss: Number(settings?.iss_aliquot || 0),
                },
            };
            const result = await asaasRequest('/invoices', 'POST', payload, apiKey);
            await recordBaasOperation(user.id, account.id, 'nfse_create', result as Record<string, unknown>, {
                amount: Number(body.value) || undefined,
                description: body.serviceDescription,
                payload: { ...payload, idempotencyKey: body.idempotencyKey || null, patient_id: body.patient_id || null },
            });
            return jsonResponse({ success: true, invoice: result });
        }

        if (action === 'authorize') {
            if (!body.id) return errorResponse('ID da NFS-e é obrigatório.', 400);
            const result = await asaasRequest(`/invoices/${encodeURIComponent(body.id)}/authorize`, 'POST', {}, apiKey);
            await recordBaasOperation(user.id, account.id, 'nfse_authorize', result as Record<string, unknown>, { payload: { id: body.id } });
            return jsonResponse({ success: true, invoice: result });
        }

        return errorResponse('Ação fiscal não suportada.', 400);
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-invoices error:', error);
        return errorResponse(error?.message || 'Erro ao processar NFS-e.', error?.status || 500);
    }
});
