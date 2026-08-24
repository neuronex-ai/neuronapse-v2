import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionNote } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';

const fetchLatestSessionNote = async (): Promise<SessionNote | null> => {
  // RLS garante que apenas as notas associadas ao paciente autenticado sejam retornadas.
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle() para retornar null se não houver linhas

  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
    console.error('Erro ao buscar resumo da sessão do paciente:', error);
    throw new Error(error.message);
  }

  return data || null;
};

export const usePatientSessionSummary = () => {
  const { user } = useAuth();
  const userId = user?.id; // Este é o auth.uid() do paciente

  return useQuery<SessionNote | null, Error>({
    queryKey: ['patientSessionSummary', userId],
    queryFn: () => fetchLatestSessionNote(),
    enabled: !!userId,
  });
};