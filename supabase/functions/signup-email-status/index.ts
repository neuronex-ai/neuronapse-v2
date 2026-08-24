import {
  corsHeaders,
  createAdminClient,
  findAuthUserByEmail,
  isValidEmail,
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
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      return jsonResponse({ status: "invalid", exists: false });
    }

    const admin = createAdminClient();
    const user = await findAuthUserByEmail(admin, email);

    return jsonResponse({
      status: user ? "exists" : "available",
      exists: Boolean(user),
    });
  } catch (error) {
    console.error("signup-email-status:error", error);
    return jsonResponse(
      {
        status: "error",
        exists: false,
        error: "Não conseguimos verificar este e-mail agora.",
      },
      500,
    );
  }
});
