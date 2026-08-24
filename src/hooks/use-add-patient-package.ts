import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/SessionContextProvider';

interface AddPackageData {
  patientId: string;
  description: string;
  totalSessions: number;
  price: number | null;
  startDate: Date;
  endDate: Date | null;
  dueDay?: number;
}

const addPatientPackage = async (data: AddPackageData, userId: string) => {
  const { data: newPackage, error } = await supabase
    .from('patient_packages')
    .insert({
      user_id: userId,
      patient_id: data.patientId,
      description: data.description,
      total_sessions: data.totalSessions,
      sessions_used: 0,
      price: data.price,
      start_date: format(data.startDate, 'yyyy-MM-dd'),
      end_date: data.endDate ? format(data.endDate, 'yyyy-MM-dd') : null,
      due_day: data.dueDay || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao adicionar pacote de sessões:', error);
    throw new Error(error.message);
  }

  return newPackage;
};

export const useAddPatientPackage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: AddPackageData) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return addPatientPackage(data, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patientPackages', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] }); // Atualiza previsão financeira
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
  });
};