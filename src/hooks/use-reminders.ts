import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { Reminder } from '@/types';

const fetchReminders = async (userId: string): Promise<Reminder[]> => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const createReminder = async (reminder: Partial<Reminder>, userId: string) => {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...reminder, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const toggleReminder = async ({ id, is_completed }: { id: string, is_completed: boolean }, userId: string) => {
  const { error } = await supabase
    .from('reminders')
    .update({ is_completed })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

const deleteReminder = async (id: string, userId: string) => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

const updateReminderCategory = async ({ id, category }: { id: string, category: string }, userId: string) => {
  const { error } = await supabase
    .from('reminders')
    .update({ category })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

const updateReminderFields = async ({ id, updates }: { id: string, updates: Partial<Reminder> }, userId: string) => {
  const { error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

export const useReminders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['reminders', userId],
    queryFn: () => fetchReminders(userId!),
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: (reminder: Partial<Reminder>) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return createReminder(reminder, userId);
    },
    onSuccess: () => {
      toast.success("Lembrete definido.");
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (e) => toast.error(e.message)
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_completed }: { id: string, is_completed: boolean }) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return toggleReminder({ id, is_completed }, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, category }: { id: string, category: string }) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return updateReminderCategory({ id, category }, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (e) => toast.error("Falha ao atualizar categoria: " + e.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Reminder> }) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return updateReminderFields({ id, updates }, userId);
    },
    onSuccess: () => {
      toast.success("Tarefa atualizada.");
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (e) => toast.error("Falha ao atualizar: " + e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!userId) throw new Error("Usuário não autenticado");
      return deleteReminder(id, userId);
    },
    onSuccess: () => {
      toast.success("Lembrete removido.");
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  return {
    reminders: query.data,
    isLoading: query.isLoading,
    createReminder: createMutation.mutate,
    toggleReminder: toggleMutation.mutate,
    updateReminderCategory: updateCategoryMutation.mutate,
    updateReminder: updateMutation.mutate,
    deleteReminder: deleteMutation.mutate,
  };
};