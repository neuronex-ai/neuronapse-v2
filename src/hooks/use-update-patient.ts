import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';

interface UpdatePatientData {
  id: string;
  updates: Partial<Patient>; // Atualizado para usar a interface completa
}

const updatePatient = async ({ id, updates }: UpdatePatientData, userId: string) => {
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar paciente:', error);
    throw new Error(error.message);
  }

  return data;
};

export const useUpdatePatient = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UpdatePatientData) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return updatePatient(data, userId);
    },
    onSuccess: (updatedPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.setQueryData(['patients', updatedPatient.id], updatedPatient);
    },
  });
};