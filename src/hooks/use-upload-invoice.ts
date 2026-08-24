import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { uploadDocumentToR2 } from "@/lib/r2-documents-client";

interface UploadInvoiceData {
  file: File;
  invoiceId: string;
}

const uploadInvoiceFile = async ({ file, invoiceId }: UploadInvoiceData) => {
  const document = await uploadDocumentToR2({
    file,
    category: "financial",
    metadata: {
      source: "external_invoice",
      invoiceId,
    },
  });

  return `neuronex-r2://document/${document.id}`;
};

export const useUploadInvoice = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UploadInvoiceData) => {
      if (!userId) throw new Error("Usuario nao autenticado.");
      return uploadInvoiceFile(data);
    },
  });
};
