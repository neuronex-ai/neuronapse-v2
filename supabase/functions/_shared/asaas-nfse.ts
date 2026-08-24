import { asaasRequest, supabaseAdmin } from './asaas-client.ts';

type NfseStateTarget = {
    userId: string;
    financialAccountId?: string | null;
    nbPaymentId?: string | null;
    providerPaymentId?: string | null;
    legacyInvoiceId?: string | null;
    invoice: Record<string, any>;
    errorMessage?: string | null;
};

const todayISODate = () => new Date().toISOString().slice(0, 10);

const numericValue = (...values: unknown[]) => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const cleanPayload = (payload: Record<string, unknown>) => Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export function buildAsaasInvoiceTaxes(inputTaxes: any = {}, settings: any = {}) {
    return {
        retainIss: Boolean(inputTaxes.retainIss ?? inputTaxes.retain_iss ?? settings.retain_iss ?? false),
        iss: numericValue(inputTaxes.iss, settings.iss_aliquot, 0),
        pis: numericValue(inputTaxes.pis, settings.pis_aliquot, 0),
        cofins: numericValue(inputTaxes.cofins, settings.cofins_aliquot, 0),
        csll: numericValue(inputTaxes.csll, settings.csll_aliquot, 0),
        inss: numericValue(inputTaxes.inss, settings.inss_aliquot, 0),
        ir: numericValue(inputTaxes.ir, settings.ir_aliquot, 0),
        ...(inputTaxes.nbsCode || settings.nbs_code ? { nbsCode: inputTaxes.nbsCode || settings.nbs_code } : {}),
        ...(inputTaxes.taxSituationCode ? { taxSituationCode: inputTaxes.taxSituationCode } : {}),
        ...(inputTaxes.taxClassificationCode ? { taxClassificationCode: inputTaxes.taxClassificationCode } : {}),
        ...(inputTaxes.operationIndicatorCode ? { operationIndicatorCode: inputTaxes.operationIndicatorCode } : {}),
        ...(inputTaxes.pisCofinsTaxStatus ? { pisCofinsTaxStatus: inputTaxes.pisCofinsTaxStatus } : {}),
        ...(inputTaxes.operationPis != null ? { operationPis: numericValue(inputTaxes.operationPis) } : {}),
        ...(inputTaxes.operationCofins != null ? { operationCofins: numericValue(inputTaxes.operationCofins) } : {}),
    };
}

export function buildAsaasInvoicePayload(input: Record<string, any>, settings: Record<string, any> = {}) {
    const municipalServiceId = input.municipalServiceId || settings.asaas_municipal_service_id || null;
    const municipalServiceCode = input.municipalServiceCode || settings.service_code || null;
    const municipalServiceName =
        input.municipalServiceName ||
        settings.asaas_municipal_service_name ||
        municipalServiceCode ||
        'Servicos de psicologia';

    return cleanPayload({
        payment: input.payment,
        installment: input.installment,
        customer: input.customer,
        serviceDescription: input.serviceDescription || 'Servicos de psicologia e saude mental',
        observations: input.observations || 'Emissao fiscal NeuroFinance via Asaas.',
        externalReference: input.externalReference,
        value: numericValue(input.value),
        deductions: numericValue(input.deductions, 0),
        effectiveDate: input.effectiveDate || todayISODate(),
        municipalServiceId,
        municipalServiceCode: municipalServiceId ? null : municipalServiceCode,
        municipalServiceName,
        updatePayment: input.updatePayment,
        taxes: buildAsaasInvoiceTaxes(input.taxes, settings),
    });
}

export async function createAsaasInvoice(apiKey: string, payload: Record<string, unknown>) {
    return await asaasRequest<Record<string, any>>('/invoices', 'POST', payload, apiKey);
}

export async function authorizeAsaasInvoice(apiKey: string, invoiceId: string) {
    return await asaasRequest<Record<string, any>>(`/invoices/${encodeURIComponent(invoiceId)}/authorize`, 'POST', {}, apiKey);
}

export async function fetchAsaasInvoice(apiKey: string, invoiceId: string) {
    return await asaasRequest<Record<string, any>>(`/invoices/${encodeURIComponent(invoiceId)}`, 'GET', undefined, apiKey);
}

function buildNfsePatch(invoice: Record<string, any>, errorMessage?: string | null) {
    const status = invoice?.status || (errorMessage ? 'ERROR' : null);
    const now = new Date().toISOString();
    const patch: Record<string, any> = {
        nfse_provider: 'asaas',
        nfse_reference: invoice?.id || null,
        nfse_status: status,
        nfse_number: invoice?.number || null,
        nfse_verification_code: invoice?.validationCode || null,
        nfse_pdf_url: invoice?.pdfUrl || null,
        nfse_xml_url: invoice?.xmlUrl || null,
        nfse_status_description: invoice?.statusDescription || errorMessage || null,
        nfse_payload: invoice || {},
        nfse_synced_at: now,
        nfse_error_message: errorMessage || (status === 'ERROR' ? invoice?.statusDescription || null : null),
        updated_at: now,
    };

    if (status === 'AUTHORIZED') {
        patch.nfse_authorized_at = now;
    }

    return patch;
}

async function findPaymentTarget(target: NfseStateTarget) {
    if (target.nbPaymentId) {
        const { data, error } = await supabaseAdmin
            .from('nb_payments')
            .select('id,metadata')
            .eq('id', target.nbPaymentId)
            .eq('user_id', target.userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    const providerPaymentId = target.providerPaymentId || target.invoice?.payment || null;
    if (!providerPaymentId) return null;

    const { data, error } = await supabaseAdmin
        .from('nb_payments')
        .select('id,metadata')
        .eq('provider', 'asaas')
        .eq('provider_payment_id', providerPaymentId)
        .eq('user_id', target.userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function persistAsaasInvoiceState(target: NfseStateTarget) {
    const patch = buildNfsePatch(target.invoice, target.errorMessage);
    const paymentTarget = await findPaymentTarget(target);
    const legacyInvoiceId =
        target.legacyInvoiceId ||
        paymentTarget?.metadata?.invoice_id ||
        paymentTarget?.metadata?.legacy_invoice_id ||
        null;

    if (paymentTarget?.id) {
        const { data: current } = await supabaseAdmin
            .from('nb_payments')
            .select('metadata')
            .eq('id', paymentTarget.id)
            .maybeSingle();

        const { error } = await supabaseAdmin
            .from('nb_payments')
            .update({
                ...patch,
                metadata: {
                    ...(current?.metadata || {}),
                    asaas_nfse_id: target.invoice?.id || null,
                    asaas_nfse_status: target.invoice?.status || null,
                    asaas_nfse_pdf_url: target.invoice?.pdfUrl || null,
                    asaas_nfse_xml_url: target.invoice?.xmlUrl || null,
                    asaas_nfse_last_sync_at: patch.nfse_synced_at,
                },
            })
            .eq('id', paymentTarget.id);
        if (error) throw error;
    }

    if (legacyInvoiceId) {
        const { error } = await supabaseAdmin
            .from('invoices')
            .update(patch)
            .eq('id', legacyInvoiceId)
            .eq('user_id', target.userId);
        if (error) throw error;
    } else if (target.invoice?.id) {
        await supabaseAdmin
            .from('invoices')
            .update(patch)
            .eq('nfse_reference', target.invoice.id)
            .eq('user_id', target.userId);
    }

    return { paymentId: paymentTarget?.id || null, legacyInvoiceId };
}

export async function createAndAuthorizeAsaasInvoice(args: {
    apiKey: string;
    payload: Record<string, unknown>;
    authorize?: boolean;
    userId: string;
    financialAccountId?: string | null;
    nbPaymentId?: string | null;
    providerPaymentId?: string | null;
    legacyInvoiceId?: string | null;
}) {
    const scheduled = await createAsaasInvoice(args.apiKey, args.payload);
    await persistAsaasInvoiceState({
        userId: args.userId,
        financialAccountId: args.financialAccountId,
        nbPaymentId: args.nbPaymentId,
        providerPaymentId: args.providerPaymentId || String(args.payload.payment || ''),
        legacyInvoiceId: args.legacyInvoiceId,
        invoice: scheduled,
    });

    const invoice = args.authorize === false || !scheduled?.id
        ? scheduled
        : await authorizeAsaasInvoice(args.apiKey, scheduled.id);

    if (invoice?.id !== scheduled?.id || invoice?.status !== scheduled?.status) {
        await persistAsaasInvoiceState({
            userId: args.userId,
            financialAccountId: args.financialAccountId,
            nbPaymentId: args.nbPaymentId,
            providerPaymentId: args.providerPaymentId || String(args.payload.payment || ''),
            legacyInvoiceId: args.legacyInvoiceId,
            invoice,
        });
    }

    return { scheduled, invoice };
}
