import { useAuth } from '@/components/auth/SessionContextProvider';
import { SessionNote } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { edgeFunctionUrl } from '@/lib/supabase-config';

// URL da Edge Function para gerar o prontuário
const GENERATE_PRONTUARIO_URL = edgeFunctionUrl("generate-session-prontuario");

interface ChatMessage {
  text: string;
  sender: string;
  time: string;
}

interface GenerateProntuarioData {
  patientId: string;
  appointmentId: string;
  notes: string;
  chatHistory: ChatMessage[] | string;
  reviewMode?: 'pending' | 'confirmed';
  sourceTranscriptId?: string | null;
}

interface GenerateProntuarioResponse {
  message: string;
  sessionNote: SessionNote;
}

const generateProntuario = async (data: GenerateProntuarioData, accessToken: string): Promise<GenerateProntuarioResponse> => {
  try {
    const response = await fetch(GENERATE_PRONTUARIO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textBody = await response.text();
      console.error("Non-JSON response from Prontuario AI:", textBody);
      throw new Error("Erro na resposta do servidor. Tente novamente.");
    }

    const result = await response.json();

    if (!response.ok) {
      console.error("Prontuario API Error:", result);
      throw new Error(result.error || result.details || "Falha ao gerar o prontuário.");
    }

    return result;
  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      throw new Error("Erro de comunicação com a IA (Formato inválido).");
    }
    throw error;
  }
};

export const useGenerateSessionProntuario = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: (data: GenerateProntuarioData) => {
      if (!accessToken) throw new Error("Sessão inválida.");
      return generateProntuario(data, accessToken);
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.reviewMode === 'pending' ? "Resumo pendente gerado para revisão." : "Prontuário gerado e salvo com sucesso!");
      // Invalida o histórico de sessões do paciente e o resumo do portal
      queryClient.invalidateQueries({ queryKey: ['sessionNotes', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['pendingSessionReviews', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientTimeline', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientSessionSummary'] });
    },
    onError: (error) => {
      toast.error(`Erro ao gerar prontuário: ${error.message}`);
    }
  });
};
