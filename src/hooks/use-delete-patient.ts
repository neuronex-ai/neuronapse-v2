import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

interface DeletePatientOptions {
  patientId: string;
  patientName: string;
  exportBeforeDelete?: boolean;
}

/**
 * Hook to delete a patient record with optional data export.
 * Handles cascading delete of related records and provides feedback.
 */
export const useDeletePatient = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ patientId, patientName, exportBeforeDelete }: DeletePatientOptions) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // If export is requested, gather patient data and download
      if (exportBeforeDelete) {
        try {
          const [
            { data: patientData },
            { data: sessions },
            { data: notes },
          ] = await Promise.all([
            supabase.from('patients').select('*').eq('id', patientId).single(),
            supabase.from('sessions').select('*').eq('patient_id', patientId),
            supabase.from('session_notes').select('*').eq('patient_id', patientId),
          ]);

          const exportPayload = {
            patient: patientData,
            sessions: sessions || [],
            notes: notes || [],
            exportedAt: new Date().toISOString(),
            exportedBy: user.email,
          };

          const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `paciente_${patientName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success('Dados exportados com sucesso', {
            description: 'O arquivo foi baixado para o seu dispositivo.',
          });
        } catch (exportError) {
          console.error('[useDeletePatient] Export error:', exportError);
          toast.error('Falha ao exportar', {
            description: 'A exclusão continuará mesmo sem a exportação.',
          });
        }
      }

      // Delete related records (cascading)
      const relatedTables = ['session_notes', 'sessions'];
      for (const table of relatedTables) {
        try {
          await supabase.from(table).delete().eq('patient_id', patientId);
        } catch {
          // Table may not exist or have no fk — continue
        }
      }

      // Delete the patient
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      return { patientId, patientName };
    },
    onSuccess: ({ patientName }) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente excluído', {
        description: `${patientName} foi removido permanentemente.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useDeletePatient] Error:', error);
      toast.error('Erro ao excluir paciente', {
        description: getUserFacingErrorMessage(error, 'delete'),
      });
    },
  });
};
