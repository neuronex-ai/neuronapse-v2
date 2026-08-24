import { Button } from "@/components/ui/button";
import { usePatientSharedDocuments } from "@/hooks/use-patient-shared-documents";
import { getR2DocumentDownloadUrl } from "@/lib/r2-documents-client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Download, File, FileImage, FileText, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PatientDocumentsPanelProps {
  patientId: string;
}

export const PatientDocumentsPanel = ({ patientId: _ }: PatientDocumentsPanelProps) => {
  const { data: documents, isLoading, error } = usePatientSharedDocuments();

  const handleDownload = async (documentId: string, signedUrl?: string | null) => {
    try {
      const url = signedUrl || await getR2DocumentDownloadUrl({ documentId, disposition: "inline" });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      console.error("Error creating R2 signed URL:", downloadError);
      toast.error("Nao foi possivel gerar o link de download seguro.");
    }
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith(".pdf")) return <FileText className="h-5 w-5" />;
    if (name.match(/\.(jpg|jpeg|png|webp)$/i)) return <FileImage className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-4 rounded-xl bg-rose-500/5 py-8 text-center text-sm text-destructive">
        Erro ao carregar documentos.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <FolderOpen className="h-5 w-5 text-primary" />
          Arquivos
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {documents?.length || 0} compartilhado(s)
        </span>
      </div>

      <div className="grid gap-3">
        {documents && documents.length > 0 ? (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={cn(
                    "flex flex-shrink-0 rounded-xl border p-3 transition-colors",
                    "border-blue-500/20 bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
                  )}
                >
                  {getFileIcon(doc.name)}
                </div>
                <div className="min-w-0">
                  <p className="max-w-[200px] truncate text-sm font-semibold text-white transition-colors group-hover:text-blue-200 sm:max-w-xs">
                    {doc.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <span>{(doc.size / 1024).toFixed(1)} KB</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                    <span>{format(new Date(doc.created_at), "dd MMM yyyy")}</span>
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(doc.documentId, doc.signedUrl)}
                className="h-10 w-10 flex-shrink-0 rounded-xl border border-transparent text-muted-foreground transition-all hover:border-white/5 hover:bg-white/10 hover:text-white"
                title="Baixar Arquivo"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Pasta vazia.</p>
            <p className="mt-1 text-xs text-muted-foreground/50">Seu terapeuta ainda nao compartilhou arquivos.</p>
          </div>
        )}
      </div>
    </div>
  );
};
