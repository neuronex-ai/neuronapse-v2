import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';

export interface SimplePatient {
  id: string;
  name: string;
}

export const usePatientsList = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['patients-list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('patients')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      return data as SimplePatient[];
    },
    enabled: !!user,
  });
};