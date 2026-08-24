import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PatientAttachment } from '@/types/attachments';

const fetchAttachments = async (patientId: string) => {
  const { data, error } = await supabase
    .from('patient_attachments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data as PatientAttachment[];
};

export const usePatientAttachments = (patientId: string) => {
  return useQuery({
    queryKey: ['patient-attachments', patientId],
    queryFn: () => fetchAttachments(patientId),
    enabled: !!patientId,
  });
};