import { Button } from '@/components/ui/button';
import { usePatientAttachments } from '@/hooks/use-patient-attachments';
import { LEGACY_PATIENT_ATTACHMENTS_ENABLED, useUploadAttachment } from '@/hooks/use-upload-attachment';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download, File, Loader2, Paperclip, UploadCloud } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

interface AttachmentsPanelProps {
  patientId: string;
}

export const AttachmentsPanel = ({ patientId }: AttachmentsPanelProps) => {
  const { data: attachments, isLoading } = usePatientAttachments(patientId);
  const { mutate: uploadFile, isPending: isUploading } = useUploadAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!LEGACY_PATIENT_ATTACHMENTS_ENABLED) {
      toast.info("Upload de anexos temporariamente indisponível enquanto o fluxo privado migra para R2.");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      uploadFile({ patientId, file });
    }
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    if (!LEGACY_PATIENT_ATTACHMENTS_ENABLED) {
      toast.info("Download legado desativado. Os documentos privados serão disponibilizados pelo fluxo R2.");
      return;
    }

    const { data, error } = await supabase.storage
      .from('patient-attachments')
      .download(storagePath);

    if (error) {
      toast.error("Erro ao baixar arquivo.");
      return;
    }

    const blob = new Blob([data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      {!LEGACY_PATIENT_ATTACHMENTS_ENABLED ? (
        <div className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          Upload de anexos desativado temporariamente enquanto os documentos privados migram para R2.
        </div>
      ) : null}
      <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading || !LEGACY_PATIENT_ATTACHMENTS_ENABLED}>
        <UploadCloud className="mr-2 h-4 w-4" />
        {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
      </Button>

      <div className="flex-1 mt-4 overflow-y-auto custom-scrollbar pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !attachments || attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground opacity-50">
            <Paperclip className="w-8 h-8 mb-2" />
            <p className="text-xs">Nenhum anexo encontrado.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map((file) => (
              <li key={file.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <File className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate text-foreground/90">{file.file_name}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(file.created_at), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" disabled={!LEGACY_PATIENT_ATTACHMENTS_ENABLED} onClick={() => handleDownload(file.storage_path, file.file_name)}>
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
