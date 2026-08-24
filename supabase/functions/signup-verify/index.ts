import {
  corsHeaders,
  createAdminClient,
  hashSignupValue,
  jsonResponse,
  normalizeEmail,
} from "../_shared/signup.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const verificationId = String(body.verificationId || "").trim();
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").replace(/\D/g, "");

    if (!verificationId || !email || code.length !== 6) {
      return jsonResponse({ error: "Digite o código de 6 dígitos." }, 400);
    }

    const admin = createAdminClient();
    const { data: verification, error } = await admin
      .from("signup_email_verifications")
      .select("*")
      .eq("id", verificationId)
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    if (!verification || verification.consumed_at) {
      return jsonResponse({ error: "Código inválido ou já utilizado." }, 400);
    }

    if (verification.blocked_until && new Date(verification.blocked_until).getTime() > Date.now()) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "Código expirado. Reenvie um novo código." }, 410);
    }

    if ((verification.attempts || 0) >= (verification.max_attempts || 5)) {
      await admin
        .from("signup_email_verifications")
        .update({
          blocked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", verificationId);

      return jsonResponse({ error: "Tentativas excedidas. Reenvie o código em alguns minutos." }, 429);
    }

    const expectedHash = await hashSignupValue(`${verificationId}:${email}:${code}`);
    if (expectedHash !== verification.code_hash) {
      await admin
        .from("signup_email_verifications")
        .update({
          attempts: (verification.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", verificationId);

      return jsonResponse({ error: "Código inválido. Confira os números enviados por e-mail." }, 400);
    }

    const signupToken = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
    const signupTokenHash = await hashSignupValue(signupToken);

    const { error: updateError } = await admin
      .from("signup_email_verifications")
      .update({
        verified_at: new Date().toISOString(),
        signup_token_hash: signupTokenHash,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    if (updateError) throw updateError;

    return jsonResponse({
      signupToken,
      expiresIn: 20 * 60,
    });
  } catch (error) {
    console.error("signup-verify:error", error);
    return jsonResponse(
      {
        error: "Não conseguimos validar o código agora. Tente novamente.",
      },
      500,
    );
  }
});
