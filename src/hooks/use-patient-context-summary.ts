import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const fetchContextSummary = async (patientId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('session_notes')
    .select('ai_summary')
    .eq('patient_id', patientId)
    .not('ai_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Error fetching context summary:", error);
    return ["Erro ao buscar histórico."];
  }

  if (!data || data.length === 0) {
    return ["Nenhum insight de sessões anteriores encontrado."];
  }

  const insights: string[] = [];
  
  // Get a key insight from the most recent session
  const latestSummary = data[0].ai_summary as any;
  if (latestSummary?.next_steps && latestSummary.next_steps.length > 0) {
    insights.push(`Foco anterior: ${latestSummary.next_steps[0]}`);
  } else if (latestSummary?.topics && latestSummary.topics.length > 0) {
    insights.push(`Tópico principal: ${latestSummary.topics[0]}`);
  }

  // Get insights from older sessions if available
  if (data[1]?.ai_summary) {
    const secondSummary = data[1].ai_summary as any;
    if (secondSummary?.topics?.[0]) {
      insights.push(`Sessão retrasada: ${secondSummary.topics[0]}`);
    }
  }
  if (data[2]?.ai_summary) {
    const thirdSummary = data[2].ai_summary as any;
    if (thirdSummary?.sentiment) {
      insights.push(`Sentimento há 3 sessões: ${thirdSummary.sentiment}`);
    }
  }

  return insights.slice(0, 3); // Max 3 pills
};

export const usePatientContextSummary = (patientId: string | null) => {
  return useQuery<string[], Error>({
    queryKey: ['patientContextSummary', patientId],
    queryFn: () => fetchContextSummary(patientId!),
    enabled: !!patientId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};