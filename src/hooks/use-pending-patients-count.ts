import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';

const fetchPendingPatientsCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Erro ao buscar contagem de pacientes pendentes:', error);
    throw new Error(error.message);
  }

  return count || 0;
};

export const usePendingPatientsCount = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<number, Error>({
    queryKey: ['pendingPatientsCount', userId],
    queryFn: () => fetchPendingPatientsCount(userId!),
    enabled: !!userId,
  });
};