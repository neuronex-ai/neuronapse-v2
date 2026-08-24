import {
  corsHeaders,
  createAdminClient,
  jsonResponse,
} from "../_shared/signup.ts";

const VALID_THEMES = new Set(["light", "dark", "system"]);
const VALID_NEUROFINANCE_CHOICES = new Set(["create_now", "later"]);
const DEV_ACCOUNTS = new Set(["jotahub@gmail.com"]);

function validateCrp(value: string) {
  if (!value) return true;
  return /^\d{2}\/\d{4,6}$/.test(value);
}

function planCanCreateNeuroFinance(plan: string, status?: string | null, accessState?: string | null, email?: string | null) {
  if (email && DEV_ACCOUNTS.has(email.toLowerCase())) return true;
  return (
    (plan === "Professional" || plan === "Enterprise") &&
    (status === "active" || status === "admin_override") &&
    (accessState === "paid_access" || accessState === "admin_override")
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Sessão não encontrada. Entre novamente." }, 401);
    }

    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );

    if (authError || !authData.user) {
      return jsonResponse({ error: "Sessão inválida. Entre novamente." }, 401);
    }

    const user = authData.user;
    const body = await req.json().catch(() => ({}));
    const theme = String(body.theme || "system");
    const clinicName = String(body.clinicName || "").trim();
    const crp = String(body.crp || "").trim();
    const address = String(body.address || "").trim();
    const bio = String(body.bio || "").trim();
    const professionalAddress = body.professionalAddress && typeof body.professionalAddress === "object"
      ? body.professionalAddress as Record<string, unknown>
      : {};
    const googleChoice = String(body.googleChoice || "skip");
    const googleConnected = Boolean(body.googleConnected);
    let neurofinanceIntroChoice = String(body.neurofinanceIntroChoice || "later");

    if (!VALID_THEMES.has(theme)) {
      return jsonResponse({ error: "Escolha um tema válido." }, 400);
    }

    if (!validateCrp(crp)) {
      return jsonResponse({ error: "Use o formato CRP 00/000000 ou deixe o campo em branco." }, 400);
    }

    if (address && !professionalAddress.label) {
      return jsonResponse({ error: "Selecione um endereço profissional válido da lista." }, 400);
    }

    if (!VALID_NEUROFINANCE_CHOICES.has(neurofinanceIntroChoice)) {
      return jsonResponse({ error: "Escolha uma opção para o NeuroFinance." }, 400);
    }

    let { data: subscription } = await admin
      .from("user_subscriptions")
      .select("plan,status,access_state,trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!subscription) {
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: createdSubscription, error: trialError } = await admin
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan: "Professional",
          plan_code: "professional",
          status: "trialing",
          access_state: "trial_access",
          current_period_start: trialStartedAt.toISOString(),
          current_period_end: trialEndsAt.toISOString(),
          trial_started_at: trialStartedAt.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
          metadata: {
            source: "initial-settings-save",
            trial_days: 7,
          },
          updated_at: trialStartedAt.toISOString(),
        })
        .select("plan,status,access_state,trial_ends_at")
        .maybeSingle();

      if (trialError) {
        console.error("initial-settings-save:trial-error", trialError);
      } else {
        subscription = createdSubscription;
      }
    }

    const plan = String(subscription?.plan || "Essential");
    const canCreateNeuroFinance = planCanCreateNeuroFinance(
      plan,
      String(subscription?.status || ""),
      String(subscription?.access_state || ""),
      user.email,
    );

    const initialPreferences: Record<string, unknown> = {
      theme,
      google_choice: googleChoice === "connect" && googleConnected ? "connect" : "skip",
      professional_address: professionalAddress,
      initial_settings_completed_at: new Date().toISOString(),
    };

    if (!canCreateNeuroFinance && neurofinanceIntroChoice === "create_now") {
      neurofinanceIntroChoice = "later";
      initialPreferences.neurofinance_locked_reason = subscription?.status === "trialing"
        ? "trial_access"
        : "subscription_not_paid";
    }

    const googleEnabled = googleChoice === "connect" && googleConnected;
    const now = new Date().toISOString();
    const payload = {
      id: user.id,
      clinic_name: clinicName || null,
      crp: crp || null,
      address: address || null,
      bio: bio || null,
      setup_completed: true,
      calendar_sync_enabled: googleEnabled,
      gmail_send_enabled: googleEnabled,
      neurofinance_intro_choice: neurofinanceIntroChoice,
      professional_address: professionalAddress,
      initial_preferences: initialPreferences,
      updated_at: now,
    };

    const update = await admin
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (update.error) {
      console.error("initial-settings-save:update-error", update.error);
    }

    if (!update.error && update.data?.id) {
      return jsonResponse({
        success: true,
        neurofinanceIntroChoice,
        plan,
      });
    }

    const { error: upsertError } = await admin.from("profiles").upsert(payload, {
      onConflict: "id",
    });

    if (upsertError) {
      console.error("initial-settings-save:upsert-error", upsertError);
      return jsonResponse(
        {
          error: upsertError.message || "Não foi possível salvar suas configurações.",
        },
        400,
      );
    }

    return jsonResponse({
      success: true,
      neurofinanceIntroChoice,
      plan,
    });
  } catch (error) {
    console.error("initial-settings-save:error", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Não foi possível salvar suas configurações.",
      },
      500,
    );
  }
});
