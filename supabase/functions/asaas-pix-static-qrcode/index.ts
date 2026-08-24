/**
 * asaas-pix-static-qrcode
 *
 * Create and delete static PIX QR Codes using the psychologist sub-account.
 * If addressKey is omitted, the function uses the first active Pix key found
 * in the authenticated user's Asaas sub-account.
 *
 * - POST: create static QR code for receiving Pix payments
 * - DELETE: delete static QR code by id
 */
import {
  corsResponse,
  jsonResponse,
  errorResponse,
  getAuthenticatedUser,
  getFinancialAccount,
  getFinancialAccountAsaasApiKey,
  asaasRequest,
} from "../_shared/asaas-client.ts";
import {
  requireEntitlementForUser,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

type CreateStaticQrBody = {
  addressKey?: string;
  description?: string;
  value?: number | string;
  format?: "ALL" | "IMAGE" | "PAYLOAD";
  expirationDate?: string; // date-time
  expirationSeconds?: number | string;
  allowsMultiplePayments?: boolean;
  externalReference?: string;
};

type NormalizedPixKey = {
  addressKey: string;
  status: string;
  active: boolean;
  raw: Record<string, unknown>;
};

async function getSubAccountApiKey(financialAccount: any) {
  const key = await getFinancialAccountAsaasApiKey(financialAccount);
  if (!key) throw new Error("Conta financeira não configurada.");
  return key as string;
}

function normalizePixKey(raw: any): NormalizedPixKey | null {
  const addressKey = String(
    raw?.id || raw?.addressKey || raw?.pixAddressKey || raw?.key || ""
  ).trim();

  if (!addressKey) return null;

  const status = String(
    raw?.status || (raw?.active === false ? "INACTIVE" : "ACTIVE")
  ).toUpperCase();

  return {
    addressKey,
    status,
    active: raw?.active !== false && !["INACTIVE", "DELETED", "DISABLED", "CANCELLED"].includes(status),
    raw,
  };
}

async function resolveAddressKey(subApiKey: string, requestedKey?: string) {
  const explicitKey = String(requestedKey || "").trim();
  if (explicitKey) return explicitKey;

  const result = await asaasRequest<{ data?: Array<Record<string, unknown>> }>(
    "/pix/addressKeys?limit=100&offset=0",
    "GET",
    undefined,
    subApiKey
  );

  const keys = (Array.isArray(result?.data) ? result.data : [])
    .map(normalizePixKey)
    .filter(Boolean) as NormalizedPixKey[];

  const selected = keys.find((key) => key.active) || keys[0];
  return selected?.addressKey || "";
}

function toPositiveNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function readString(payload: any, ...paths: string[][]) {
  for (const path of paths) {
    const value = path.reduce((acc, key) => acc?.[key], payload);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stripBase64Prefix(value: string | null) {
  if (!value) return null;
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const user = await getAuthenticatedUser(req);
    await requireEntitlementForUser(
      { id: user.id, email: user.email, user_metadata: user.user_metadata },
      "neurofinance",
    );
    const financialAccount = await getFinancialAccount(user.id);
    const subApiKey = await getSubAccountApiKey(financialAccount);
    const url = new URL(req.url);

    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as Partial<CreateStaticQrBody>;
      const addressKey = await resolveAddressKey(subApiKey, body.addressKey);
      if (!addressKey) {
        return errorResponse("Nenhuma chave Pix ativa encontrada para gerar o QR Code.", 400, {
          code: "PIX_KEY_NOT_FOUND",
        });
      }

      const value = toPositiveNumber(body.value);
      const expirationSeconds = toPositiveNumber(body.expirationSeconds);

      const payload: Record<string, unknown> = {
        addressKey,
        description: body.description || undefined,
        value,
        format: body.format || "ALL",
        expirationDate: body.expirationDate || undefined,
        expirationSeconds: expirationSeconds ? Math.round(expirationSeconds) : undefined,
        allowsMultiplePayments:
          body.allowsMultiplePayments !== undefined ? body.allowsMultiplePayments : false,
        externalReference: body.externalReference || undefined,
      };

      const created = await asaasRequest<Record<string, unknown>>(
        `/pix/qrCodes/static`,
        "POST",
        payload,
        subApiKey
      );

      const pixQrCode = stripBase64Prefix(
        readString(
          created,
          ["encodedImage"],
          ["encoded_image"],
          ["image"],
          ["qrCode", "encodedImage"],
          ["qrCode", "encoded_image"],
          ["qrCode", "image"]
        )
      );
      const pixCopyPaste = readString(
        created,
        ["payload"],
        ["copyPaste"],
        ["copy_paste"],
        ["pixCopyPaste"],
        ["qrCode", "payload"],
        ["qrCode", "copyPaste"],
        ["qrCode", "copy_paste"]
      );
      const qrcodeId = readString(created, ["id"], ["qrCodeId"], ["qrCode", "id"]);

      return jsonResponse({
        success: true,
        qrcode_id: qrcodeId,
        status: "available",
        amount: value || null,
        pix_qr_code: pixQrCode,
        pix_copy_paste: pixCopyPaste,
        address_key: addressKey,
        provider: "asaas",
        raw: created,
      });
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return errorResponse("Informe o id do QR Code.", 400);

      const deleted = await asaasRequest(
        `/pix/qrCodes/static/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        subApiKey
      );

      return jsonResponse(deleted);
    }

    return errorResponse("Método não suportado.", 405);
  } catch (error: any) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("asaas-pix-static-qrcode error:", error);
    return errorResponse(error?.message || "Internal error", error?.status || 500);
  }
});
