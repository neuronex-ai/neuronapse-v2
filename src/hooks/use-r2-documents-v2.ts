import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteR2Document,
  getR2DocumentDownloadUrl,
  uploadDocumentToR2,
  type DocumentCategory,
  type DocumentFile,
} from "@/lib/r2-documents-client";

export type { DocumentCategory, DocumentFile } from "@/lib/r2-documents-client";

interface UploadInput {
  file: File;
  patientId?: string | null;
  category?: DocumentCategory;
  metadata?: Record<string, unknown>;
}

interface DownloadInput {
  documentId: string;
  disposition?: "inline" | "attachment";
}

export function useR2DocumentsV2(patientId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["r2-documents", patientId ?? "all"];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["r2-document-usage"] }),
    ]);
  };

  const documents = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("document_files")
        .select("id,patient_id,category,original_name,mime_type,size_bytes,status,metadata,uploaded_at,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (patientId) query = query.eq("patient_id", patientId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DocumentFile[];
    },
  });

  const usage = useQuery({
    queryKey: ["r2-document-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_document_storage_usage");
      if (error) throw error;
      const row = data?.[0] ?? { total_bytes: 0, file_count: 0 };
      return { totalBytes: Number(row.total_bytes), fileCount: Number(row.file_count) };
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, patientId: targetPatientId, category = "general", metadata = {} }: UploadInput) => {
      return uploadDocumentToR2({ file, patientId: targetPatientId ?? null, category, metadata });
    },
    onSuccess: refresh,
  });

  const getDownloadUrl = useMutation({
    mutationFn: async ({ documentId, disposition = "inline" }: DownloadInput) => {
      return getR2DocumentDownloadUrl({ documentId, disposition });
    },
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) => {
      return deleteR2Document(documentId);
    },
    onSuccess: refresh,
  });

  return { documents, usage, upload, getDownloadUrl, remove };
}
