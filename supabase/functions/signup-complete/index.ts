import {
  assertPasswordStrength,
  corsHeaders,
  createAdminClient,
  findAuthUserByEmail,
  hashSignupValue,
  jsonResponse,
  normalizePhone,
  splitFullName,
} from "../_shared/signup.ts";

const PROFESSIONAL_TRIAL_DAYS = 7;

async function createProfessionalTrial(admin: ReturnType<typeof createAdminClient>, userId: string, metadata: Record<string, unknown>) {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + PROFESSIONAL_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const payload = {
    user_id: userId,
    plan: "Professional",
    plan_code: "professional",
    status: "trialing",
    access_state: "trial_access",
    current_period_start: now.toISOString(),
    current_period_end: trialEndsAt.toISOString(),
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    canceled_at: null,
    blocked_at: null,
    grace_period_ends_at: null,
    metadata: {
      ...metadata,
      source: "signup-complete",
      trial_days: PROFESSIONAL_TRIAL_DAYS,
    },
    status_version: 0,
    updated_at: now.toISOString(),
  };

  const { data: existing, error: findError } = await admin
    .from("user_subscriptions")
    .select("id,user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await admin
      .from("user_subscriptions")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  if (existing?.user_id) {
    const { error } = await admin
      .from("user_subscriptions")
      .update(payload)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await admin
    .from("user_subscriptions")
    .insert(payload);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const signupToken = String(body.signupToken || "").trim();
    const password = String(body.password || "");
    const passwordIssue = assertPasswordStrength(password);

    if (!signupToken) {
      return jsonResponse({ error: "Confirmação de e-mail não encontrada. Valide o código novamente." }, 400);
    }

    if (passwordIssue) {
      return jsonResponse({ error: passwordIssue }, 400);
    }

    const admin = createAdminClient();
    const tokenHash = await hashSignupValue(signupToken);
    const { data: verification, error } = await admin
      .from("signup_email_verifications")
      .select("*")
      .eq("signup_token_hash", tokenHash)
      .is("consumed_at", null)
      .maybeSingle();

    if (error) throw error;

    if (!verification || !verification.verified_at) {
      return jsonResponse({ error: "Confirmação inválida. Valide seu e-mail novamente." }, 400);
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "Sua confirmação expirou. Reenvie o código para continuar." }, 410);
    }

    const existingUser = await findAuthUserByEmail(admin, verification.email);
    if (existingUser) {
      return jsonResponse(
        {
          code: "email_exists",
          error: "Já existe uma conta com este e-mail. Faça login para continuar.",
        },
        409,
      );
    }

    const { firstName, lastName } = splitFullName(verification.full_name);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: verification.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: verification.full_name,
        name: verification.full_name,
        first_name: firstName,
        last_name: lastName,
        recovery_email: verification.recovery_email,
        phone: normalizePhone(verification.phone),
        gender_identity: verification.gender_identity,
        professional_context: verification.professional_context,
      },
      app_metadata: {
        signup_source: "custom_create_account",
      },
    });

    if (createError || !created?.user) {
      console.error("signup-complete:create-user-error", createError);
      return jsonResponse(
        {
          error: createError?.message || "Não conseguimos criar sua conta agora.",
        },
        400,
      );
    }

    const userId = created.user.id;
    const now = new Date().toISOString();
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: verification.full_name,
        name: verification.full_name,
        first_name: firstName,
        last_name: lastName,
        recovery_email: verification.recovery_email,
        phone: normalizePhone(verification.phone),
        gender_identity: verification.gender_identity,
        professional_context: verification.professional_context,
        signup_completed_at: now,
        setup_completed: false,
        subscription_plan: "Professional",
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("signup-complete:profile-error", profileError);
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: "Não conseguimos salvar seu perfil. Tente novamente." }, 500);
    }

    try {
      await createProfessionalTrial(admin, userId, {
        signup_verification_id: verification.id,
        requested_plan: verification.metadata?.requested_plan || "professional_trial",
      });
    } catch (subscriptionError) {
      console.error("signup-complete:subscription-error", subscriptionError);
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: "Não conseguimos iniciar seu teste grátis. Tente novamente." }, 500);
    }

    await admin
      .from("signup_email_verifications")
      .update({
        consumed_at: now,
        updated_at: now,
        metadata: {
          ...(verification.metadata || {}),
          user_id: userId,
        },
      })
      .eq("id", verification.id);

    return jsonResponse({
      userId,
      email: verification.email,
    });
  } catch (error) {
    console.error("signup-complete:error", error);
    return jsonResponse(
      {
        error: "Não conseguimos concluir sua conta agora. Tente novamente.",
      },
      500,
    );
  }
});
