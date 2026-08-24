import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";

interface FileObject {
  name: string;
  id: string;
  documentId: string;
  created_at: string;
  size: number;
  path: string;
  mimetype?: string;
  storageProvider: "r2";
}

const fetchPatientDocuments = async (patientId: string): Promise<FileObject[]> => {
  const { data, error } = await supabase
    .from("document_files")
    .select("id, original_name, mime_type, size_bytes, created_at")
    .eq("patient_id", patientId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data || []).map((item) => ({
    name: item.original_name,
    id: item.id,
    documentId: item.id,
    created_at: item.created_at,
    size: item.size_bytes || 0,
    path: `r2:${item.id}`,
    mimetype: item.mime_type,
    storageProvider: "r2" as const,
  }));
};

export const usePatientDocuments = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FileObject[], Error>({
    queryKey: ["patientDocuments", patientId, userId],
    queryFn: () => fetchPatientDocuments(patientId),
    enabled: !!patientId && !!userId,
  });
};
