import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { uploadDocumentToR2 } from "@/lib/r2-documents-client";

interface UploadDocumentData {
  patientId: string;
  file: File;
}

const uploadDocument = async ({ patientId, file }: UploadDocumentData) =>
  uploadDocumentToR2({
    file,
    patientId,
    category: "patient_attachment",
    metadata: { source: "patient_documents" },
  });

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UploadDocumentData) => {
      if (!userId) throw new Error("Usuario nao autenticado.");
      return uploadDocument(data);
    },
    onSuccess: (_, variables) => {
      toast.success(`Documento '${variables.file.name}' enviado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["patientDocuments", variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ["r2-documents", variables.patientId] });
    },
    onError: (error) => {
      console.error("[useUploadDocument] Falha no envio", error);
      toast.error(getUserFacingErrorMessage(error, "save"));
    },
  });
};
