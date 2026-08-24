import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

export interface NoteModule {
  id: string;
  name: string;
  created_at: string;
  // Adicionaremos count via query auxiliar ou join se necessário, 
  // mas por enquanto vamos simplificar
}

const fetchModules = async (userId: string): Promise<NoteModule[]> => {
  const { data, error } = await supabase
    .from('note_modules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const createModule = async (name: string, userId: string) => {
  const { data, error } = await supabase
    .from('note_modules')
    .insert({ name, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const deleteModule = async (id: string, userId: string) => {
  const { error } = await supabase
    .from('note_modules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

export const useNoteModules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['noteModules', userId],
    queryFn: () => fetchModules(userId!),
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => {
        if (!userId) throw new Error("Usuário não autenticado");
        return createModule(name, userId);
    },
    onSuccess: () => {
      toast.success("Módulo criado.");
      queryClient.invalidateQueries({ queryKey: ['noteModules'] });
    },
    onError: (e) => {
      console.error('[useNoteModules] Falha ao criar módulo', e);
      toast.error(getUserFacingErrorMessage(e, 'save'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
        if (!userId) throw new Error("Usuário não autenticado");
        return deleteModule(id, userId);
    },
    onSuccess: () => {
      toast.success("Módulo excluído.");
      queryClient.invalidateQueries({ queryKey: ['noteModules'] });
      // Também invalidar notas pois elas cascateiam
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] });
    }
  });

  return {
    modules: query.data,
    isLoading: query.isLoading,
    createModule: createMutation.mutate,
    deleteModule: deleteMutation.mutate,
  };
};
