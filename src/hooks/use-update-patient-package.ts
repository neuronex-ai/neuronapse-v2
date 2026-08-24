import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PatientPackage } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';

interface UpdatePackageData {
  packageId: string;
  patientId: string;
  updates: Partial<Omit<PatientPackage, 'id' | 'user_id' | 'patient_id' | 'created_at'>>;
}

const updatePatientPackage = async ({ packageId, updates }: UpdatePackageData, userId: string) => {
  // Formata datas se estiverem presentes nas atualizações
  const formattedUpdates: any = { ...updates };
  if (formattedUpdates.start_date instanceof Date) {
    formattedUpdates.start_date = format(formattedUpdates.start_date, 'yyyy-MM-dd');
  }
  if (formattedUpdates.end_date instanceof Date) {
    formattedUpdates.end_date = format(formattedUpdates.end_date, 'yyyy-MM-dd');
  }

  const { data, error } = await supabase
    .from('patient_packages')
    .update(formattedUpdates)
    .eq('id', packageId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar pacote de sessões:', error);
    throw new Error(error.message);
  }

  return data;
};

export const useUpdatePatientPackage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UpdatePackageData) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return updatePatientPackage(data, userId);
    },
    onSuccess: (_, variables) => {
      toast.success("Pacote atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['patientPackages', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['activePatientPackages', variables.patientId] });
      // Atualiza a projeção financeira
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
    },
    onError: (error) => {
      toast.error(`Falha ao atualizar pacote: ${error.message}`);
    }
  });
};