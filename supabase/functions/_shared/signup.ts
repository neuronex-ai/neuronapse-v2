import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export type JsonBody = Record<string, unknown>;

export function jsonResponse(body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizePhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export function getSignupSecret(): string {
  return (
    Deno.env.get("SIGNUP_TOKEN_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "neuronex-signup-dev-secret"
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSignupValue(value: string): Promise<string> {
  return sha256Hex(`${getSignupSecret()}:${value}`);
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const target = normalizeEmail(email);

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const users = data?.users || [];
    const found = users.find((user) => normalizeEmail(user.email) === target);
    if (found) return found;
    if (users.length < 1000) break;
  }

  return null;
}

export function createSignupCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export function assertPasswordStrength(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-z]/.test(password)) return "Inclua ao menos uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "Inclua ao menos uma letra maiúscula.";
  if (!/[@#<!$%&*;/?]/.test(password)) return "Inclua ao menos um caractere especial.";
  return null;
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function sendSignupCodeEmail(params: {
  email: string;
  code: string;
  fullName: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from =
    Deno.env.get("SIGNUP_EMAIL_FROM")?.trim() ||
    Deno.env.get("SECURITY_EMAIL_FROM")?.trim() ||
    "NeuroNex Segurança <seguranca@email.neuronex.site>";

  const displayName = params.fullName.trim().split(/\s+/)[0] || "psicólogo";
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Código NeuroNex AI</title>
  </head>
  <body style="margin:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f8f8f8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #242424;border-radius:28px;background:#111111;padding:36px;">
            <tr>
              <td style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#a7a7a7;font-weight:800;">NeuroNex AI</td>
            </tr>
            <tr>
              <td style="padding-top:28px;font-size:30px;line-height:1.08;font-weight:900;color:#ffffff;">Seu código de confirmação</td>
            </tr>
            <tr>
              <td style="padding-top:14px;font-size:16px;line-height:1.55;color:#cfcfcf;">
                Olá, ${escapeHtml(displayName)}. Use o código abaixo para confirmar seu e-mail e continuar o cadastro.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:30px 0 24px;">
                <div style="display:inline-block;padding:18px 26px;border-radius:20px;background:#ffffff;color:#050505;font-size:34px;letter-spacing:0.28em;font-weight:900;">
                  ${escapeHtml(params.code)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.55;color:#a7a7a7;">
                O código expira em 15 minutos. Se você não pediu esse cadastro, ignore este e-mail.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject: `${params.code} é seu código da NeuroNex AI`,
      html,
      text: `Seu código de confirmação da NeuroNex AI é ${params.code}. Ele expira em 15 minutos.`,
    }),
  });

  if (!response.ok) {
    const payload = await response.clone().json().catch(() => null);
    const detail =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : await response.text().catch(() => "");
    throw new Error(`Resend failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
}

export function isSignupEmailConfigured(): boolean {
  return Boolean(Deno.env.get("RESEND_API_KEY")?.trim());
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeReturnTo(value: unknown, fallback = "/dashboard"): string {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\\\")) {
    return fallback;
  }
  return raw;
}
