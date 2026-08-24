import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';

const fetchPatients = async (userId: string): Promise<Patient[]> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pacientes:', error);
    throw new Error(error.message);
  }

  return data || [];
};

export const usePatients = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Patient[], Error>({
    queryKey: ['patients', userId],
    queryFn: () => fetchPatients(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};