import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PatientPackage } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';

const fetchPatientPackages = async (patientId: string, userId: string): Promise<PatientPackage[]> => {
  const { data, error } = await supabase
    .from('patient_packages')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pacotes do paciente:', error);
    throw new Error(error.message);
  }

  return data || [];
};

export const usePatientPackages = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PatientPackage[], Error>({
    queryKey: ['patientPackages', patientId, userId],
    queryFn: () => fetchPatientPackages(patientId, userId!),
    enabled: !!patientId && !!userId,
  });
};