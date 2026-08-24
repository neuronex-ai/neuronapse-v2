import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PatientGoal } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';

const fetchPatientGoals = async (patientId: string): Promise<PatientGoal[]> => {
  const { data, error } = await supabase
    .from('patient_goals')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

const addGoal = async (goal: { description: string, dueDate?: Date, patientId: string }, userId: string) => {
  const { error } = await supabase
    .from('patient_goals')
    .insert({
      description: goal.description,
      due_date: goal.dueDate ? format(goal.dueDate, 'yyyy-MM-dd') : null,
      patient_id: goal.patientId,
      user_id: userId,
      is_completed: false
    });

  if (error) throw new Error(error.message);
};

const toggleGoal = async ({ id, isCompleted }: { id: string, isCompleted: boolean }) => {
  const { error } = await supabase
    .from('patient_goals')
    .update({ is_completed: isCompleted })
    .eq('id', id);

  if (error) throw new Error(error.message);
};

const deleteGoal = async (id: string) => {
  const { error } = await supabase
    .from('patient_goals')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
};

export const usePatientGoals = (patientId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['patientGoals', patientId],
    queryFn: () => fetchPatientGoals(patientId),
    enabled: !!patientId,
  });

  const addMutation = useMutation({
    mutationFn: (goal: { description: string, dueDate?: Date }) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return addGoal({ ...goal, patientId }, userId);
    },
    onSuccess: () => {
      toast.success("Meta adicionada!");
      queryClient.invalidateQueries({ queryKey: ['patientGoals', patientId] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientGoals', patientId] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      toast.success("Meta removida.");
      queryClient.invalidateQueries({ queryKey: ['patientGoals', patientId] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  return {
    goals: query.data,
    isLoading: query.isLoading,
    addGoal: addMutation.mutate,
    isAdding: addMutation.isPending,
    toggleGoal: toggleMutation.mutate,
    deleteGoal: deleteMutation.mutate,
  };
};