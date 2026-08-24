import { supabase } from "@/integrations/supabase/client";

export interface SignedR2UploadDocument {
  id: string;
  patient_id: string | null;
  category: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: "pending_upload" | "ready" | "failed" | "deleted";
  metadata: Record<string, unknown>;
  uploaded_at: string | null;
  created_at: string;
}

export interface SignedR2Upload {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresIn: number;
  document: SignedR2UploadDocument;
}

export interface GetSignedR2UploadOptions {
  patientId?: string | null;
  category?: string;
  metadata?: Record<string, unknown>;
}

export async function getSignedR2Upload(
  file: File,
  options: GetSignedR2UploadOptions = {},
): Promise<SignedR2Upload> {
  const { data, error } = await supabase.functions.invoke<SignedR2Upload>("r2-create-upload-url", {
    body: {
      action: "create-upload-url",
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      patientId: options.patientId ?? null,
      category: options.category ?? "general",
      metadata: options.metadata ?? {},
    },
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel preparar o upload.");
  }

  if (!data?.uploadUrl || !data?.objectKey || !data?.bucket || !data.document?.id) {
    throw new Error("Nao foi possivel preparar o upload.");
  }

  return data;
}
