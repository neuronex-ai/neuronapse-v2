import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';

const fetchPatientById = async (patientId: string, userId: string): Promise<Patient> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Erro ao buscar paciente por ID:', error);
    throw new Error(error.message);
  }

  return data;
};

export const usePatientById = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Patient, Error>({
    queryKey: ['patient', patientId, userId],
    queryFn: () => fetchPatientById(patientId, userId!),
    enabled: !!patientId && !!userId,
  });
};