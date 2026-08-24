import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RecurringInvoice {
  id: string;
  patient_id: string | null;
  amount: number;
  description: string;
  day_of_month: number;
  active: boolean;
  last_generated_date: string | null;
}

const fetchRecurringInvoices = async (userId: string) => {
  const { data, error } = await supabase
    .from('recurring_invoices')
    .select(`
      *,
      patient:patient_id (name)
    `)
    .eq('user_id', userId)
    .order('day_of_month', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const addRecurringInvoice = async (data: Partial<RecurringInvoice>, userId: string) => {
  const { error } = await supabase
    .from('recurring_invoices')
    .insert({ ...data, user_id: userId });
  if (error) throw new Error(error.message);
};

const toggleRecurringInvoice = async ({ id, active }: { id: string, active: boolean }, userId: string) => {
  const { error } = await supabase
    .from('recurring_invoices')
    .update({ active })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

const removeRecurringInvoice = async (id: string, userId: string) => {
  const { error } = await supabase
    .from('recurring_invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

export const useRecurringInvoices = () => {
  const queryClient = useQueryClient();

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  };

  const query = useQuery({
    queryKey: ['recurringInvoices'],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      return fetchRecurringInvoices(userId);
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<RecurringInvoice>) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      return addRecurringInvoice(data, userId);
    },
    onSuccess: () => {
      toast.success("Fatura recorrente criada.");
      queryClient.invalidateQueries({ queryKey: ['recurringInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (e) => toast.error(e.message)
  });

  const toggleMutation = useMutation({
    mutationFn: async (data: { id: string, active: boolean }) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      return toggleRecurringInvoice(data, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      return removeRecurringInvoice(id, userId);
    },
    onSuccess: () => {
      toast.success("Fatura recorrente removida.");
      queryClient.invalidateQueries({ queryKey: ['recurringInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message)
  });

  return {
    invoices: query.data,
    isLoading: query.isLoading,
    addInvoice: addMutation.mutate,
    toggleInvoice: toggleMutation.mutate,
    removeInvoice: removeMutation.mutate
  };
};