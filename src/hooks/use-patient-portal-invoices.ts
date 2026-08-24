import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { useQuery } from '@tanstack/react-query';

const fetchPatientPortalInvoices = async (_userId: string): Promise<Invoice[]> => {
  // RLS na tabela 'invoices' garante que apenas as faturas ligadas ao paciente logado (via email) sejam retornadas.
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'pending') // Apenas faturas pendentes
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar faturas do paciente no portal:', error);
    throw new Error(error.message);
  }

  return data || [];
};

export const usePatientPortalInvoices = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Invoice[], Error>({
    queryKey: ['patientPortalInvoices', userId],
    queryFn: () => fetchPatientPortalInvoices(userId!),
    enabled: !!userId,
  });
};
