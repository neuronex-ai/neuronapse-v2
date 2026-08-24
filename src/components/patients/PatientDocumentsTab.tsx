"use client";

import { DocumentUploadPanel } from "@/components/documents/DocumentUploadPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PatientDocumentsTabProps {
  patientId: string;
}

export const PatientDocumentsTab = ({ patientId }: PatientDocumentsTabProps) => {
  const isMobile = useIsMobile();

  return (
    <div className={cn("animate-fade-in pb-10", isMobile ? "space-y-6" : "space-y-8")}>
      <DocumentUploadPanel
        patientId={patientId}
        category="patient_attachment"
        title="Documentos do paciente"
        description="Arquivos privados vinculados ao prontuario. Upload e download usam links seguros de curta duracao."
      />
    </div>
  );
};
