import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_USER_STORAGE_BYTES = 250 * 1024 * 1024;
const UPLOAD_EXPIRES_IN_SECONDS = 900;
const DOWNLOAD_EXPIRES_IN_SECONDS = 300;
const DOCUMENT_RESPONSE_SELECT =
  "id,patient_id,category,original_name,mime_type,size_bytes,status,metadata,uploaded_at,created_at";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/plain",
  "text/csv",
]);

const DOCUMENT_CATEGORIES = new Set([
  "general",
  "patient_attachment",
  "anamnesis_import",
  "session_document",
  "financial",
  "other",
]);

const ACTIVE_STATUSES = new Set(["active", "trialing", "admin_override"]);
const ACTIVE_ACCESS_STATES = new Set(["paid_access", "trial_access", "admin_override"]);

type JsonRecord = Record<string, unknown>;

type SupabaseUser = {
  id: string;
  email?: string;
  app_metadata?: JsonRecord;
};

class AccessError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function accessErrorResponse(error: unknown): Response {
  if (error instanceof AccessError) {
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }

  return jsonResponse({ error: "access_check_failed", message: "Nao foi possivel validar o acesso." }, 500);
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function r2Bucket(): string {
  const bucket = Deno.env.get("R2_BUCKET") ?? Deno.env.get("R2_BUCKET_NAME");
  if (!bucket) throw new Error("Missing environment variable: R2_BUCKET");
  return bucket;
}

function adminSupabase() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function userSupabase(req: Request) {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function authenticatedUser(req: Request): Promise<SupabaseUser> {
  const token = bearerToken(req);
  if (!token) throw new AccessError(401, "missing_jwt", "Sessao obrigatoria.");

  const { data, error } = await adminSupabase().auth.getUser(token);
  if (error || !data.user?.id) {
    throw new AccessError(401, "invalid_jwt", "Sessao invalida.");
  }

  return data.user as SupabaseUser;
}

function isPatientPortalAccount(user: SupabaseUser): boolean {
  const role = String(user.app_metadata?.account_role ?? user.app_metadata?.role ?? "").toLowerCase();
  return role === "patient";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function valueAsRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function isFeatureExplicitlyBlocked(row: JsonRecord, featureKey: string): boolean {
  const internalFlags = valueAsRecord(row.internal_flags);
  const features = valueAsRecord(row.features);
  const limits = valueAsRecord(row.limits);

  if (featureKey === "neurodrive") {
    return internalFlags.can_use_neurodrive === false || limits.neurodrive_documents === 0;
  }

  return features[featureKey] === false;
}

async function requireRequestEntitlement(req: Request, featureKey: string) {
  const user = await authenticatedUser(req);

  if (isPatientPortalAccount(user)) {
    throw new AccessError(403, "patient_account_blocked", "Conta de paciente nao pode acessar recursos profissionais.");
  }

  if (user.email === "jotahub@gmail.com") {
    return { user, entitlement: { status: "admin_override", access_state: "admin_override" } };
  }

  const { data, error } = await adminSupabase()
    .from("current_subscription_entitlements")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new AccessError(500, "entitlement_lookup_failed", "Nao foi possivel validar sua assinatura.");
  }

  if (!data) {
    throw new AccessError(402, "subscription_required", "Assinatura ativa ou teste ativo obrigatorio.");
  }

  const row = valueAsRecord(data);
  const status = String(row.effective_status ?? row.status ?? "").toLowerCase();
  const accessState = String(row.effective_access_state ?? row.access_state ?? "").toLowerCase();

  if (!ACTIVE_STATUSES.has(status) || !ACTIVE_ACCESS_STATES.has(accessState) || isFeatureExplicitlyBlocked(row, featureKey)) {
    throw new AccessError(402, "feature_unavailable", "Recurso indisponivel para a assinatura atual.");
  }

  return { user, entitlement: data };
}

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: requireEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function normalizeFileName(fileName: string): string {
  const fallback = "documento";
  const cleaned = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return cleaned || fallback;
}

function normalizeCategory(value: unknown): string {
  const category = normalizeString(value) || "general";
  return DOCUMENT_CATEGORIES.has(category) ? category : "general";
}

function normalizePatientId(value: unknown): string | null {
  const patientId = normalizeString(value);
  if (!patientId) return null;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(patientId)) {
    throw new AccessError(400, "invalid_patient_id", "Paciente invalido.");
  }

  return patientId;
}

function normalizeMetadata(value: unknown): JsonRecord {
  const metadata = valueAsRecord(value);
  const result: JsonRecord = {};

  for (const [key, item] of Object.entries(metadata)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      result[key] = item;
    }
  }

  return result;
}

function normalizeFileInput(body: JsonRecord) {
  const rawFileName = normalizeString(body.fileName);
  const mimeType = normalizeString(body.mimeType);
  const sizeBytes = Number(body.sizeBytes);

  if (!rawFileName) {
    throw new AccessError(400, "missing_file_name", "Nome do arquivo obrigatorio.");
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
    throw new AccessError(400, "invalid_file_size", "Arquivo maior que o limite permitido.");
  }

  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new AccessError(400, "invalid_file_type", "Tipo de arquivo nao permitido.");
  }

  return {
    fileName: normalizeFileName(rawFileName),
    originalName: rawFileName,
    mimeType,
    sizeBytes,
  };
}

function shouldCreateMetadata(body: JsonRecord): boolean {
  return body.patientId !== undefined || body.category !== undefined || body.metadata !== undefined;
}

async function ensurePatientBelongsToUser(admin: ReturnType<typeof adminSupabase>, patientId: string | null, userId: string) {
  if (!patientId) return;

  const { data, error } = await admin
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AccessError(500, "patient_lookup_failed", "Nao foi possivel validar o paciente.");
  }

  if (!data) {
    throw new AccessError(403, "patient_not_owned", "Paciente nao pertence a este profissional.");
  }
}

async function currentStorageUsage(admin: ReturnType<typeof adminSupabase>, userId: string): Promise<number> {
  const { data, error } = await admin
    .from("document_files")
    .select("size_bytes")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["pending_upload", "ready"]);

  if (error) {
    throw new AccessError(500, "storage_usage_failed", "Nao foi possivel validar a cota de documentos.");
  }

  return (data ?? []).reduce((total: number, row: { size_bytes: number | null }) => total + Number(row.size_bytes ?? 0), 0);
}

async function createUploadUrl(req: Request, body: JsonRecord) {
  const { user } = await requireRequestEntitlement(req, "neurodrive");
  const file = normalizeFileInput(body);
  const bucket = r2Bucket();
  const objectKey = `documents/${user.id}/${crypto.randomUUID()}-${file.fileName}`;
  const client = r2Client();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: file.mimeType,
      ContentLength: file.sizeBytes,
      Metadata: {
        uploadedBy: user.id,
        originalName: encodeURIComponent(file.originalName),
      },
    }),
    { expiresIn: UPLOAD_EXPIRES_IN_SECONDS },
  );

  if (!shouldCreateMetadata(body)) {
    return jsonResponse({
      uploadUrl,
      objectKey,
      bucket,
      expiresIn: UPLOAD_EXPIRES_IN_SECONDS,
    });
  }

  const patientId = normalizePatientId(body.patientId);
  const category = normalizeCategory(body.category);
  const metadata = normalizeMetadata(body.metadata);
  const admin = adminSupabase();

  await ensurePatientBelongsToUser(admin, patientId, user.id);

  const usage = await currentStorageUsage(admin, user.id);
  if (usage + file.sizeBytes > MAX_USER_STORAGE_BYTES) {
    throw new AccessError(413, "document_storage_quota_exceeded", "Limite de armazenamento de documentos atingido.");
  }

  const { data: document, error } = await admin
    .from("document_files")
    .insert({
      user_id: user.id,
      patient_id: patientId,
      category,
      bucket,
      object_key: objectKey,
      original_name: file.originalName,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      status: "pending_upload",
      metadata: {
        ...metadata,
        storage_provider: "cloudflare_r2",
        upload_flow: "edge_signed_url",
      },
    })
    .select(DOCUMENT_RESPONSE_SELECT)
    .single();

  if (error || !document) {
    console.error("Failed to create document metadata", error);
    throw new AccessError(500, "document_metadata_failed", "Nao foi possivel preparar o documento.");
  }

  return jsonResponse({
    uploadUrl,
    objectKey,
    bucket,
    expiresIn: UPLOAD_EXPIRES_IN_SECONDS,
    document,
  });
}

async function markUploadFailed(req: Request, body: JsonRecord) {
  const { user } = await requireRequestEntitlement(req, "neurodrive");
  const documentId = normalizeString(body.documentId);
  if (!documentId) {
    return jsonResponse({ error: "missing_document_id" }, 400);
  }

  const admin = adminSupabase();
  const { data: current, error: selectError } = await admin
    .from("document_files")
    .select("id,metadata,status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("Failed to select failed upload", selectError);
    return jsonResponse({ error: "document_lookup_failed" }, 500);
  }

  if (!current) {
    return jsonResponse({ error: "document_not_found" }, 404);
  }

  const currentMetadata = valueAsRecord(current.metadata);
  const { data: document, error } = await admin
    .from("document_files")
    .update({
      status: "failed",
      metadata: {
        ...currentMetadata,
        upload_failed_at: new Date().toISOString(),
        upload_failure_reason: normalizeString(body.reason) || "client_upload_failed",
      },
    })
    .eq("id", documentId)
    .eq("user_id", user.id)
    .eq("status", "pending_upload")
    .select(DOCUMENT_RESPONSE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("Failed to mark upload failed", error);
    return jsonResponse({ error: "mark_failed_error" }, 500);
  }

  return jsonResponse({ document: document ?? current });
}

async function confirmUpload(req: Request, body: JsonRecord) {
  const { user } = await requireRequestEntitlement(req, "neurodrive");
  const documentId = normalizeString(body.documentId);
  if (!documentId) {
    return jsonResponse({ error: "missing_document_id" }, 400);
  }

  const admin = adminSupabase();
  const { data: document, error: selectError } = await admin
    .from("document_files")
    .select(`${DOCUMENT_RESPONSE_SELECT},bucket,object_key,user_id`)
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("Failed to select document before confirm", selectError);
    return jsonResponse({ error: "document_lookup_error" }, 500);
  }

  if (!document) {
    return jsonResponse({ error: "document_not_found" }, 404);
  }

  if (document.status === "ready") {
    return jsonResponse({ document });
  }

  let head;

  try {
    head = await r2Client().send(
      new HeadObjectCommand({
        Bucket: String(document.bucket),
        Key: String(document.object_key),
      }),
    );
  } catch (error) {
    console.error("R2 head object failed", error);
    return jsonResponse({ error: "object_not_found" }, 404);
  }

  const currentMetadata = valueAsRecord(document.metadata);
  const { data: readyDocument, error: updateError } = await admin
    .from("document_files")
    .update({
      status: "ready",
      size_bytes: Number(head.ContentLength ?? 0),
      mime_type: head.ContentType ?? document.mime_type,
      uploaded_at: new Date().toISOString(),
      metadata: {
        ...currentMetadata,
        etag: head.ETag,
        storage_provider: "cloudflare_r2",
      },
    })
    .eq("id", document.id)
    .eq("user_id", user.id)
    .select(DOCUMENT_RESPONSE_SELECT)
    .single();

  if (updateError) {
    console.error("Failed to confirm upload", updateError);
    return jsonResponse({ error: "confirm_update_error" }, 500);
  }

  return jsonResponse({ document: readyDocument });
}

async function createDownloadUrl(req: Request, body: JsonRecord) {
  const documentId = normalizeString(body.documentId);
  if (!documentId) {
    return jsonResponse({ error: "missing_document_id" }, 400);
  }

  const disposition = normalizeString(body.disposition) === "attachment" ? "attachment" : "inline";
  const supabase = userSupabase(req);
  const { data: document, error } = await supabase
    .from("document_files")
    .select("id,bucket,object_key,original_name,mime_type,status")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to load document for signed URL", error);
    return jsonResponse({ error: "document_lookup_error" }, 500);
  }

  if (!document || document.status !== "ready") {
    return jsonResponse({ error: "document_not_available" }, 404);
  }

  const downloadUrl = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: String(document.bucket),
      Key: String(document.object_key),
      ResponseContentType: String(document.mime_type),
      ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(String(document.original_name))}"`,
    }),
    { expiresIn: DOWNLOAD_EXPIRES_IN_SECONDS },
  );

  return jsonResponse({ downloadUrl, expiresIn: DOWNLOAD_EXPIRES_IN_SECONDS });
}

async function deleteDocument(req: Request, body: JsonRecord) {
  const { user } = await requireRequestEntitlement(req, "neurodrive");
  const documentId = normalizeString(body.documentId);
  if (!documentId) {
    return jsonResponse({ error: "missing_document_id" }, 400);
  }

  const admin = adminSupabase();
  const { data: document, error } = await admin
    .from("document_files")
    .select("id,bucket,object_key,status,deleted_at")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load document for delete", error);
    return jsonResponse({ error: "document_lookup_error" }, 500);
  }

  if (!document) {
    return jsonResponse({ error: "document_not_found" }, 404);
  }

  if (document.deleted_at) {
    return jsonResponse({ ok: true, alreadyDeleted: true });
  }

  try {
    await r2Client().send(
      new DeleteObjectCommand({
        Bucket: String(document.bucket),
        Key: String(document.object_key),
      }),
    );
  } catch (error) {
    console.error("Failed to delete R2 object", error);
    return jsonResponse({ error: "object_delete_error" }, 500);
  }

  const { error: updateError } = await admin
    .from("document_files")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to mark document deleted", updateError);
    return jsonResponse({ error: "metadata_delete_error" }, 500);
  }

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const action = String(body.action ?? "create-upload-url");

    switch (action) {
      case "create-upload-url":
        return await createUploadUrl(req, body);
      case "mark-upload-failed":
        return await markUploadFailed(req, body);
      case "confirm-upload":
        return await confirmUpload(req, body);
      case "create-download-url":
        return await createDownloadUrl(req, body);
      case "delete-document":
        return await deleteDocument(req, body);
      default:
        return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (error) {
    if (error instanceof AccessError) {
      return accessErrorResponse(error);
    }

    console.error("Unexpected R2 function error", error);
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("R2_")) {
      return jsonResponse({ error: "r2_not_configured", detail: message }, 500);
    }

    return jsonResponse({ error: "internal_error" }, 500);
  }
});
