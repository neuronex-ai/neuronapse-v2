import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

const BUCKET_NAME = 'avatars'; // Assume que este bucket existe e é público

const uploadAvatar = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  // 1. Upload do arquivo
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  // 2. Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  // 3. Atualizar perfil
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return publicUrl;
};

export const useUploadAvatar = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (file: File) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return uploadAvatar(file, userId);
    },
    onSuccess: () => {
      toast.success("Foto de perfil atualizada!");
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (error) => {
      console.error('[useUploadAvatar] Falha ao atualizar foto', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    }
  });
};
