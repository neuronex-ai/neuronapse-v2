import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';

const fetchPatientData = async (email: string): Promise<Patient | null> => {
  if (!email) return null;
  
  // O RLS deve garantir que o usuário só possa buscar o registro que corresponde ao seu próprio email.
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
    console.error('Erro ao buscar dados do paciente:', error);
    throw new Error(error.message);
  }

  return data || null;
};

export const usePatientData = (email: string) => {
  return useQuery<Patient | null, Error>({
    queryKey: ['patientData', email],
    queryFn: () => fetchPatientData(email),
    enabled: !!email,
  });
};