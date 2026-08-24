import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecurringExpense } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';

const fetchRecurringExpenses = async (userId: string): Promise<RecurringExpense[]> => {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_month', { ascending: true });

  if (error) {
    console.error('Erro ao buscar despesas recorrentes:', error);
    throw new Error(error.message);
  }

  return data || [];
};

const addRecurringExpense = async (data: Omit<RecurringExpense, 'id' | 'created_at' | 'last_generated_date' | 'user_id'>, userId: string) => {
  const { error } = await supabase
    .from('recurring_expenses')
    .insert({
      ...data,
      user_id: userId,
    });

  if (error) throw new Error(error.message);
};

const deleteRecurringExpense = async (id: string, userId: string) => {
  const { error } = await supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

const toggleRecurringExpense = async (id: string, currentState: boolean, userId: string) => {
  const { error } = await supabase
    .from('recurring_expenses')
    .update({ active: !currentState })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

export const useRecurringExpenses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['recurringExpenses', userId],
    queryFn: () => fetchRecurringExpenses(userId!),
    enabled: !!userId,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<RecurringExpense, 'id' | 'created_at' | 'last_generated_date' | 'user_id'>) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return addRecurringExpense(data, userId);
    },
    onSuccess: () => {
      toast.success("Despesa recorrente adicionada!");
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return deleteRecurringExpense(id, userId);
    },
    onSuccess: () => {
      toast.success("Despesa removida.");
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, currentState }: { id: string, currentState: boolean }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return toggleRecurringExpense(id, currentState, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    addExpense: addMutation.mutate,
    isAdding: addMutation.isPending,
    deleteExpense: deleteMutation.mutate,
    toggleExpense: toggleMutation.mutate,
  };
};