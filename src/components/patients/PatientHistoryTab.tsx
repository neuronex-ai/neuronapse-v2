import { PatientUnifiedTimeline } from "./PatientUnifiedTimeline";

interface PatientHistoryTabProps {
  patientId: string;
}

export const PatientHistoryTab = ({ patientId }: PatientHistoryTabProps) => {
  return <PatientUnifiedTimeline patientId={patientId} />;
};