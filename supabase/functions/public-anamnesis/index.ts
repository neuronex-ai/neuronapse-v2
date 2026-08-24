import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUuid(value: unknown, field: string) {
  const uuid = normalizeString(value);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(uuid)) throw new Error(`${field} invalido.`);
  return uuid;
}

function normalizeProgress(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(Math.round(numeric), 100));
}

function getPatientName(patient: unknown) {
  if (Array.isArray(patient)) return normalizeString((patient[0] as JsonRecord | undefined)?.name);
  return normalizeString((patient as JsonRecord | null)?.name);
}

function getPatientUserId(patient: unknown) {
  if (Array.isArray(patient)) return normalizeString((patient[0] as JsonRecord | undefined)?.user_id);
  return normalizeString((patient as JsonRecord | null)?.user_id);
}

async function loadAnamnesis(id: string, token: string) {
  const { data, error } = await supabaseAdmin()
    .from("patient_anamneses")
    .select("id,patient_id,content,token_expires_at,patients!inner(user_id,name)")
    .eq("id", id)
    .eq("access_token", token)
    .gt("token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("[public-anamnesis] load failed", error);
    throw new Error("Nao foi possivel validar o acesso.");
  }

  if (!data) throw new Error("Token invalido ou link expirado.");
  return data as JsonRecord & { patients?: unknown };
}

async function handleGet(body: JsonRecord) {
  const id = normalizeUuid(body.id, "Anamnese");
  const token = normalizeString(body.token);
  if (!token) throw new Error("Codigo obrigatorio.");

  const record = await loadAnamnesis(id, token);
  return jsonResponse({
    anamnesis: {
      id: record.id,
      patient_id: record.patient_id,
      user_id: getPatientUserId(record.patients),
      content: record.content,
      token_expires_at: record.token_expires_at,
      patient_name: getPatientName(record.patients),
    },
  });
}

async function handleUpdate(body: JsonRecord) {
  const id = normalizeUuid(body.id, "Anamnese");
  const token = normalizeString(body.token);
  if (!token) throw new Error("Codigo obrigatorio.");

  await loadAnamnesis(id, token);

  const { error } = await supabaseAdmin()
    .from("patient_anamneses")
    .update({
      content: body.content ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("access_token", token)
    .gt("token_expires_at", new Date().toISOString());

  if (error) {
    console.error("[public-anamnesis] update failed", error);
    throw new Error("Nao foi possivel salvar a anamnese.");
  }

  return jsonResponse({ ok: true });
}

async function handleNotify(body: JsonRecord) {
  const id = normalizeUuid(body.id, "Anamnese");
  const token = normalizeString(body.token);
  if (!token) throw new Error("Codigo obrigatorio.");

  const progress = normalizeProgress(body.progress);
  const record = await loadAnamnesis(id, token);
  const patientId = normalizeString(record.patient_id);
  const userId = getPatientUserId(record.patients);
  const patientName = getPatientName(record.patients) || "O paciente";

  const { data, error } = await supabaseAdmin().rpc("emit_user_notification", {
    p_user_id: userId,
    p_event_id: `anamnesis:${id}:progress`,
    p_type: progress >= 100 ? "anamnesis_completed" : "anamnesis_progress",
    p_category: "prontuario",
    p_severity: progress >= 100 ? "success" : "info",
    p_title: progress >= 100 ? "Anamnese concluida" : "Preenchimento parcial de anamnese",
    p_message: `${patientName} preencheu ${progress}% da anamnese${progress >= 100 ? "" : " e salvou para continuar mais tarde"}.`,
    p_action_url: `/pacientes/${patientId}?tab=anamnesis`,
    p_priority: progress >= 100 ? "normal" : "low",
    p_data: {
      sourceModule: "prontuario",
      eventSource: "public_anamnesis",
      anamnesisId: id,
      patientId,
      progress,
      requiresAction: progress >= 100,
      nativePushEligible: false,
    },
    p_payload: {},
    p_organization_id: null,
  });

  if (error) {
    console.error("[public-anamnesis] notification failed", error);
    throw new Error("Nao foi possivel notificar o profissional.");
  }

  return jsonResponse({ notificationId: data });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const action = normalizeString(body.action) || "get";

    if (action === "get") return await handleGet(body);
    if (action === "update") return await handleUpdate(body);
    if (action === "notify") return await handleNotify(body);

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return jsonResponse({ error: message }, 400);
  }
});
