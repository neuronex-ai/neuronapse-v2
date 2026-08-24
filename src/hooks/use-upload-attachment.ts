import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

export const LEGACY_PATIENT_ATTACHMENTS_ENABLED =
  import.meta.env.VITE_ENABLE_LEGACY_PATIENT_ATTACHMENTS === 'true';

const uploadAttachment = async ({
  patientId,
  file,
  userId,
}: {
  patientId: string;
  file: File;
  userId: string;
}) => {
  if (!LEGACY_PATIENT_ATTACHMENTS_ENABLED) {
    throw new Error('Upload legado de anexos desativado enquanto o fluxo privado migra para R2.');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${patientId}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('patient-attachments')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Storage Error: ${uploadError.message}`);
  }

  // 2. Insert into database
  const { data, error: insertError } = await supabase
    .from('patient_attachments')
    .insert({
      user_id: userId,
      patient_id: patientId,
      file_name: file.name,
      storage_path: filePath,
      file_size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError) {
    // Attempt to clean up storage if db insert fails
    await supabase.storage.from('patient-attachments').remove([filePath]);
    throw new Error(`Database Error: ${insertError.message}`);
  }

  return data;
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (variables: { patientId: string; file: File }) => {
      if (!user) throw new Error('User not authenticated');
      return uploadAttachment({ ...variables, userId: user.id });
    },
    onSuccess: (data) => {
      toast.success(`Arquivo "${data.file_name}" enviado com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ['patient-attachments', data.patient_id] });
    },
    onError: (error: Error) => {
      console.error('[useUploadAttachment] Falha no envio', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
  });
};
