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
  signedUrl?: string | null;
  storageProvider: "r2";
}

interface PortalDocumentsResponse {
  documents?: Array<{
    id: string;
    name: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string | null;
    signedUrl?: string | null;
  }>;
}

const fetchPatientSharedDocuments = async (): Promise<FileObject[]> => {
  const { data, error } = await supabase.functions.invoke<PortalDocumentsResponse>("patient-portal-current", {
    body: { action: "documents" },
  });

  if (error) throw new Error(error.message);

  return (data?.documents || []).map((item) => ({
    name: item.name,
    id: item.id,
    documentId: item.id,
    created_at: item.createdAt || new Date().toISOString(),
    size: item.sizeBytes || 0,
    path: `r2:${item.id}`,
    mimetype: item.mimeType || undefined,
    signedUrl: item.signedUrl || null,
    storageProvider: "r2" as const,
  }));
};

export const usePatientSharedDocuments = () => {
  const { user } = useAuth();

  return useQuery<FileObject[], Error>({
    queryKey: ["patientSharedDocuments", user?.id],
    queryFn: fetchPatientSharedDocuments,
    enabled: !!user?.id,
  });
};
