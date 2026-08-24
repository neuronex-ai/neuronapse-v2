import {
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
  hmacHex,
  maskEmail,
  publicProfessionalName,
} from "../_shared/patient-portal.ts";

async function readToken(req: Request) {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;
  const body = await req.json().catch(() => ({}));
  return String(body.token || "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "GET" && req.method !== "POST") return errorResponse("Metodo nao permitido.", 405);

  try {
    const token = (await readToken(req)).trim();
    if (!token) return errorResponse("Convite nao informado.", 400);

    const tokenHash = await hmacHex(token);
    const inviteResult = await supabaseAdmin
      .from("patient_portal_invites")
      .select("id,psychologist_user_id,patient_id,patient_email,status,expires_at,activation_attempts,max_attempts")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (inviteResult.error) throw inviteResult.error;
    const invite = inviteResult.data;
    if (!invite) return errorResponse("Convite invalido ou expirado.", 404, { code: "invalid_invite" });

    if (new Date(invite.expires_at).getTime() <= Date.now() && ["pending", "sent"].includes(invite.status)) {
      await supabaseAdmin
        .from("patient_portal_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return errorResponse("Convite expirado.", 410, { code: "expired_invite" });
    }

    if (!["pending", "sent", "activated"].includes(invite.status)) {
      return errorResponse("Convite indisponivel.", 409, { code: `invite_${invite.status}` });
    }

    const [patientResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("patients")
        .select("id,name")
        .eq("id", invite.patient_id)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,full_name,name,clinic_name,avatar_url")
        .eq("id", invite.psychologist_user_id)
        .maybeSingle(),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (profileResult.error) throw profileResult.error;

    return jsonResponse({
      status: invite.status === "activated" ? "activated" : "ready",
      inviteId: invite.id,
      expiresAt: invite.expires_at,
      attemptsRemaining: Math.max(0, Number(invite.max_attempts || 5) - Number(invite.activation_attempts || 0)),
      patient: {
        name: patientResult.data?.name || "Paciente",
        emailMasked: maskEmail(invite.patient_email),
      },
      professional: {
        name: publicProfessionalName(profileResult.data),
        clinicName: profileResult.data?.clinic_name || null,
        avatarUrl: profileResult.data?.avatar_url || null,
      },
    });
  } catch (error) {
    console.error("[patient-portal-invite-preview]", error);
    return errorResponse("Nao foi possivel validar o convite.", 500);
  }
});
