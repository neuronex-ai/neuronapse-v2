import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchLastSummary = async (patientId: string) => {
  const { data, error } = await supabase
    .from('session_notes')
    .select('ai_summary')
    .eq('patient_id', patientId)
    .not('ai_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(error.message);
  }

  return data?.ai_summary || null;
};

export const useLastSessionSummary = (patientId: string) => {
  return useQuery({
    queryKey: ['last-session-summary', patientId],
    queryFn: () => fetchLastSummary(patientId),
    enabled: !!patientId,
  });
};