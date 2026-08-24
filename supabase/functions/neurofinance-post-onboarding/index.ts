import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  sanitizeDigits,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
  requireEntitlementForUser,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

type DestinationBody = {
  action?: "complete" | "get" | "save_destination";
  bank?: {
    holderName?: string;
    cpfCnpj?: string;
    bankCode?: string;
    agency?: string;
    account?: string;
    digit?: string;
    accountType?: string;
  };
  pix?: {
    key?: string;
    type?: string;
    normalizedKey?: string;
    normalized_key?: string;
  };
};

function clean(value?: string | null, max = 160) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : "";
}

function normalizedBank(input: DestinationBody["bank"]) {
  if (!input) return null;
  const bankCode = sanitizeDigits(input.bankCode).slice(0, 3);
  const agency = sanitizeDigits(input.agency).slice(0, 10);
  const account = sanitizeDigits(input.account).slice(0, 18);
  const digit = sanitizeDigits(input.digit).slice(0, 2);
  const holderName = clean(input.holderName);
  const cpfCnpj = sanitizeDigits(input.cpfCnpj).slice(0, 14);
  const hasAny = Boolean(bankCode || agency || account || digit || holderName || cpfCnpj);
  if (!hasAny) return null;
  return {
    holderName,
    cpfCnpj,
    bankCode,
    agency,
    account,
    digit,
    accountType: clean(input.accountType, 32) || "CONTA_CORRENTE",
    last4: `${account}${digit}`.slice(-4),
    updatedAt: new Date().toISOString(),
  };
}

function normalizedPix(input: DestinationBody["pix"]) {
  if (!input) return null;
  const key = clean(input.key, 140);
  if (!key) return null;
  return {
    key,
    normalizedKey: clean(input.normalizedKey || input.normalized_key, 140) || key,
    type: clean(input.type, 32) || "manual",
    updatedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Método não suportado.", 405);

  try {
    const user = await getAuthenticatedUser(req);
    await requireEntitlementForUser(
      { id: user.id, email: user.email, user_metadata: user.user_metadata },
      "neurofinance",
    );
    const body = (await req.json().catch(() => ({}))) as DestinationBody;

    const { data: account, error } = await supabaseAdmin
      .from("financial_accounts")
      .select("id, metadata, holder_name, cpf_cnpj")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!account?.id) return errorResponse("Conta NeuroFinance não encontrada.", 404);

    const metadata = account.metadata || {};
    const destinations = metadata.destinations || {};

    if (body.action === "get") {
      return jsonResponse({
        success: true,
        postOnboarding: metadata.neurofinance_post_onboarding || null,
        destinations,
      });
    }

    const bank = normalizedBank(body.bank);
    const pix = normalizedPix(body.pix);
    const now = new Date().toISOString();
    const shouldComplete = body.action !== "save_destination";

    const nextDestinations = {
      ...destinations,
      ...(bank ? { bank } : {}),
      ...(pix ? { pix } : {}),
      updatedAt: now,
    };

    const updatePayload: Record<string, unknown> = {
      metadata: {
        ...metadata,
        destinations: nextDestinations,
        ...(shouldComplete ? {
          neurofinance_post_onboarding: {
            ...(metadata.neurofinance_post_onboarding || {}),
            completed: true,
            completed_at: now,
            destination_configured_at: bank || pix ? now : metadata.neurofinance_post_onboarding?.destination_configured_at || null,
            version: 1,
          },
        } : {}),
      },
      updated_at: now,
    };

    if (bank) {
      updatePayload.bank_code = bank.bankCode;
      updatePayload.bank_agency = bank.agency;
      updatePayload.bank_account = bank.account;
      updatePayload.bank_account_digit = bank.digit;
      updatePayload.bank_account_type = bank.accountType;
      updatePayload.bank_holder_name = bank.holderName || account.holder_name || null;
      updatePayload.bank_holder_cpf_cnpj = bank.cpfCnpj || account.cpf_cnpj || null;
      updatePayload.bank_account_last4 = bank.last4 || null;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("financial_accounts")
      .update(updatePayload)
      .eq("id", account.id)
      .select("id, metadata, bank_code, bank_agency, bank_account, bank_account_digit, bank_account_type, bank_holder_name, bank_holder_cpf_cnpj, bank_account_last4, updated_at")
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      account: updated,
      destinations: updated?.metadata?.destinations || nextDestinations,
      postOnboarding: updated?.metadata?.neurofinance_post_onboarding || null,
    });
  } catch (error: any) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[neurofinance-post-onboarding] error:", error);
    return errorResponse(error?.message || "Não foi possível salvar as configurações iniciais.", error?.status || 500);
  }
});
