import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { markProfilePlan } from "../_shared/subscription-access.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST") {
    return errorResponse("Método não permitido.", 405);
  }

  try {
    const user = await getAuthenticatedUser(req);
    const now = new Date().toISOString();

    const { data: subscription, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (
      subscription?.status === "active" &&
      subscription?.access_state === "paid_access" &&
      subscription?.asaas_subscription_id
    ) {
      return errorResponse("Sua assinatura paga ja esta ativa.", 409);
    }

    if (subscription?.asaas_subscription_id && subscription?.status !== "canceled") {
      return errorResponse("Existe uma assinatura Asaas vinculada. Cancele ou regularize a assinatura antes de voltar ao plano gratuito.", 409);
    }

    const metadata = {
      ...((subscription?.metadata || {}) as Record<string, unknown>),
      continued_free_at: now,
      previous_plan: subscription?.plan || "Professional",
      previous_status: subscription?.status || "trialing",
    };

    const payload = {
      user_id: user.id,
      plan: "Essential",
      plan_code: "essential",
      status: "active",
      access_state: "limited_access",
      current_period_start: now,
      current_period_end: null,
      trial_started_at: subscription?.trial_started_at || null,
      trial_ends_at: subscription?.trial_ends_at || null,
      canceled_at: null,
      blocked_at: null,
      grace_period_ends_at: null,
      metadata,
      status_version: Number(subscription?.status_version || 0) + 1,
      updated_at: now,
    };

    const { error: upsertError } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert(payload, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        status: "abandoned",
        error_message: "Usuario optou pelo plano Essential.",
        updated_at: now,
      })
      .eq("user_id", user.id)
      .in("status", ["pending", "created", "checkout_pending", "payment_pending"]);

    await supabaseAdmin.from("subscription_audit_logs").insert({
      user_id: user.id,
      actor_type: "user",
      action: "continued_free_plan",
      from_status: subscription?.status || null,
      to_status: "active",
      from_access_state: subscription?.access_state || null,
      to_access_state: "limited_access",
      reason: "user_selected_essential",
      metadata,
    });

    await markProfilePlan(user.id, "Essential");

    return jsonResponse({ ok: true, plan: "Essential", status: "active" });
  } catch (error) {
    console.error("continue-free-plan:error", error);
    return errorResponse("Não foi possível continuar no plano gratuito.", 500);
  }
});
