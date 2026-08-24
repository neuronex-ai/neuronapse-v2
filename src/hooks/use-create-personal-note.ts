import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

const createNote = async ({
  userId,
  patientId,
  content,
  title,
}: {
  userId: string;
  patientId: string;
  content: string;
  title: string;
}) => {
  const { data, error } = await supabase.from('personal_notes').insert({
    user_id: userId,
    patient_id: patientId,
    content,
    title,
    reference_date: new Date().toISOString(),
  });

  if (error) throw error;
  return data;
};

export const useCreatePersonalNote = () => {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (variables: { patientId: string; content: string; title: string }) => {
      if (!user) throw new Error('User not authenticated');
      return createNote({ ...variables, userId: user.id });
    },
    onSuccess: () => {
      toast.success('Anotação salva em "Notas Pessoais".');
    },
    onError: (error) => {
      console.error('[useCreatePersonalNote] Falha ao salvar nota', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
  });
};
