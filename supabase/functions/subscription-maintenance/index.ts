import {
  ASAAS_ENV,
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";

const OPEN_CHECKOUT_STATUSES = ["pending", "created", "checkout_pending", "payment_pending"];

function authorize(req: Request) {
  const configuredSecret = Deno.env.get("SUBSCRIPTION_MAINTENANCE_SECRET")?.trim() || "";
  if (!configuredSecret) {
    return ASAAS_ENV !== "production";
  }
  return req.headers.get("x-neuronex-maintenance-secret") === configuredSecret;
}

async function audit(rows: any[], action: string, toStatus: string, toAccessState: string, reason: string) {
  if (!rows.length) return;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("subscription_audit_logs").insert(
    rows.map((row) => ({
      user_id: row.user_id,
      subscription_record_id: row.id || null,
      checkout_session_id: row.checkout_session_id || null,
      actor_type: "system",
      action,
      from_status: row.status || null,
      to_status: toStatus,
      from_access_state: row.access_state || null,
      to_access_state: toAccessState,
      reason,
      metadata: {
        maintenance_at: now,
        external_reference: row.external_reference || null,
      },
    })),
  );

  if (error) console.warn("subscription-maintenance:audit-error", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST") {
    return errorResponse("Metodo nao permitido.", 405);
  }

  if (!authorize(req)) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const now = new Date().toISOString();

    const { data: expiredTrials, error: expiredTrialError } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        plan: "Essential",
        plan_code: "essential",
        status: "active",
        access_state: "limited_access",
        blocked_at: null,
        updated_at: now,
      })
      .eq("status", "trialing")
      .lte("trial_ends_at", now)
      .select("id,user_id,status,access_state,external_reference");

    if (expiredTrialError) throw expiredTrialError;
    await audit(expiredTrials || [], "trial_expired_essential_started", "active", "limited_access", "trial_end_reached_essential_fallback");

    const { data: expiredCheckouts, error: expiredCheckoutError } = await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        status: "expired",
        error_message: "Checkout expirado pelo job de manutencao.",
        updated_at: now,
      })
      .in("status", OPEN_CHECKOUT_STATUSES)
      .lte("expires_at", now)
      .select("id,user_id,external_reference,status");

    if (expiredCheckoutError) throw expiredCheckoutError;

    for (const checkout of expiredCheckouts || []) {
      const { data: updatedSubscriptions, error: blockError } = await supabaseAdmin
        .from("user_subscriptions")
        .update({
          plan: "Essential",
          plan_code: "essential",
          status: "active",
          access_state: "limited_access",
          blocked_at: null,
          updated_at: now,
        })
        .eq("user_id", checkout.user_id)
        .eq("external_reference", checkout.external_reference)
        .in("status", ["checkout_pending", "payment_pending"])
        .select("id,user_id,status,access_state,external_reference");

      if (blockError) throw blockError;
      await audit(
        (updatedSubscriptions || []).map((row) => ({ ...row, checkout_session_id: checkout.id })),
        "checkout_expired_essential_preserved",
        "active",
        "limited_access",
        "checkout_expired_essential_fallback",
      );
    }

    const { data: graceExpired, error: graceError } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: "blocked",
        access_state: "blocked",
        blocked_at: now,
        updated_at: now,
      })
      .eq("status", "grace_period")
      .lte("grace_period_ends_at", now)
      .select("id,user_id,status,access_state,external_reference");

    if (graceError) throw graceError;
    await audit(graceExpired || [], "grace_period_expired", "blocked", "blocked", "grace_period_end_reached");

    return jsonResponse({
      ok: true,
      expired_trials: expiredTrials?.length || 0,
      expired_checkouts: expiredCheckouts?.length || 0,
      grace_period_blocked: graceExpired?.length || 0,
    });
  } catch (error) {
    console.error("subscription-maintenance:error", error);
    return errorResponse("Nao foi possivel executar manutencao de assinaturas.", 500);
  }
});
