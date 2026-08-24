import { supabase } from "@/integrations/supabase/client";

type CheckoutPayload = {
  planId: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  city?: string;
  state?: string;
};

export type BillingAddressPayload = Pick<
  CheckoutPayload,
  "address" | "addressNumber" | "complement" | "province" | "postalCode" | "city" | "state"
>;

export type CheckoutBillingDraft = {
  cpfCnpj?: string;
  phone?: string;
  billingAddress?: BillingAddressPayload;
};

export type CheckoutResult = {
  url?: string;
  error?: string;
  code?: string;
  requiresDocument?: boolean;
  requiresPhone?: boolean;
  requiresAddress?: boolean;
  trialEndsAt?: string;
};

export const normalizeCpfCnpj = (value: string) => value.replace(/\D/g, "");

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
};

export const normalizePostalCode = (value: string) => value.replace(/\D/g, "").slice(0, 8);

export const isValidCpfCnpjLength = (value: string) => {
  const digits = normalizeCpfCnpj(value);
  return digits.length === 11 || digits.length === 14;
};

export const isValidBrazilianPhoneLength = (value: string) => {
  const digits = normalizePhone(value);
  return (digits.length === 10 || digits.length === 11) && !/^0+$/.test(digits);
};

export const isValidBillingAddress = (value: BillingAddressPayload) => (
  normalizePostalCode(value.postalCode || "").length === 8 &&
  String(value.address || "").trim().length >= 3 &&
  String(value.addressNumber || "").trim().length >= 1 &&
  String(value.province || "").trim().length >= 2
);

const CHECKOUT_BILLING_DRAFT_VERSION = "v1";

const sanitizeBillingDraft = (value: CheckoutBillingDraft): CheckoutBillingDraft => ({
  cpfCnpj: String(value.cpfCnpj || "").slice(0, 32),
  phone: String(value.phone || "").slice(0, 32),
  billingAddress: {
    address: String(value.billingAddress?.address || "").slice(0, 160),
    addressNumber: String(value.billingAddress?.addressNumber || "").slice(0, 32),
    complement: String(value.billingAddress?.complement || "").slice(0, 120),
    province: String(value.billingAddress?.province || "").slice(0, 120),
    postalCode: String(value.billingAddress?.postalCode || "").slice(0, 16),
    city: String(value.billingAddress?.city || "").slice(0, 120),
    state: String(value.billingAddress?.state || "").slice(0, 2).toUpperCase(),
  },
});

const hasBillingDraftData = (value: CheckoutBillingDraft) => Boolean(
  value.cpfCnpj ||
  value.phone ||
  value.billingAddress?.address ||
  value.billingAddress?.addressNumber ||
  value.billingAddress?.province ||
  value.billingAddress?.postalCode ||
  value.billingAddress?.city ||
  value.billingAddress?.state,
);

async function getCheckoutBillingDraftKey() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id || "anonymous";
  return `neuronex:subscription-checkout:${userId}:${CHECKOUT_BILLING_DRAFT_VERSION}`;
}

export async function readCheckoutBillingDraft(): Promise<CheckoutBillingDraft | null> {
  if (typeof window === "undefined") return null;

  try {
    const key = await getCheckoutBillingDraftKey();
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutBillingDraft;
    return sanitizeBillingDraft(parsed);
  } catch {
    return null;
  }
}

export async function saveCheckoutBillingDraft(value: CheckoutBillingDraft) {
  if (typeof window === "undefined") return;

  try {
    const key = await getCheckoutBillingDraftKey();
    const sanitized = sanitizeBillingDraft(value);
    if (!hasBillingDraftData(sanitized)) return;
    window.localStorage.setItem(key, JSON.stringify(sanitized));
  } catch {
    // Local persistence is a convenience only; checkout must continue without it.
  }
}

async function readFunctionError(error: unknown): Promise<Record<string, any> | null> {
  const maybeError = error as {
    context?: Response | { json?: () => Promise<unknown>; body?: unknown };
    details?: unknown;
  };

  const response = maybeError?.context;
  if (!response) {
    if (maybeError?.details && typeof maybeError.details === "object") {
      return maybeError.details as Record<string, any>;
    }
    return null;
  }

  try {
    if (response instanceof Response) return await response.clone().json();
    if (typeof response.json === "function") return (await response.json()) as Record<string, any>;
    if (response.body && typeof response.body === "object") return response.body as Record<string, any>;
  } catch {
    return null;
  }

  return null;
}

export async function startSubscriptionCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: payload,
  });

  if (!error) {
    return { url: data?.url };
  }

  const details = await readFunctionError(error);
  const fallbackMessage = (error as { message?: string })?.message || "Não foi possível iniciar o checkout.";

  return {
    error:
      details?.error ||
      details?.message ||
      (fallbackMessage.includes("FunctionsHttpError") ? "Não foi possível iniciar o checkout." : fallbackMessage),
    code: details?.code,
    requiresDocument: Boolean(details?.requires_document || details?.requiresDocument),
    requiresPhone: Boolean(details?.requires_phone || details?.requiresPhone),
    requiresAddress: Boolean(details?.requires_address || details?.requiresAddress),
    trialEndsAt: details?.trial_ends_at,
  };
}
