export interface PatientAttachment {
  id: string;
  user_id: string;
  patient_id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  created_at: string;
}