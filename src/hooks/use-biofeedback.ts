import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';

export interface HealthMetric {
    id: string;
    metric_type: 'heart_rate' | 'hrv' | 'sleep_duration' | 'sleep_quality' | 'steps' | 'active_energy';
    source: string;
    value: number;
    unit: string;
    measured_at: string;
    details?: any;
}

export interface MoodCorrelation {
    date: string;
    avg_mood: number | null;
    avg_sleep: number | null;
    avg_hrv: number | null;
    avg_activity: number | null;
}

export const useBiofeedback = (patientId?: string) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Buscar métricas brutas
    const useMetrics = (type?: string, limit = 50) => useQuery({
        queryKey: ['healthMetrics', patientId, type],
        queryFn: async () => {
            if (!patientId) return [];
            let query = supabase
                .from('patient_health_metrics')
                .select('*')
                .eq('patient_id', patientId)
                .order('measured_at', { ascending: false })
                .limit(limit);

            if (type) {
                query = query.eq('metric_type', type);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as HealthMetric[];
        },
        enabled: !!patientId && !!user
    });

    // Buscar correlações (Insights)
    const useCorrelations = (days = 30) => useQuery({
        queryKey: ['healthMoodCorrelation', patientId, days],
        queryFn: async () => {
            if (!patientId) return [];

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data, error } = await supabase.rpc('analyze_mood_health_correlation', {
                p_patient_id: patientId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            });

            if (error) throw error;
            return data as MoodCorrelation[];
        },
        enabled: !!patientId && !!user
    });

    // Importar métrica manual
    const addMetric = useMutation({
        mutationFn: async (metric: Omit<HealthMetric, 'id' | 'patient_id'>) => {
            if (!user || !patientId) throw new Error("Contexto inválido");

            const { error } = await supabase.from('patient_health_metrics').insert({
                patient_id: patientId,
                user_id: user.id,
                ...metric
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['healthMetrics', patientId] });
            queryClient.invalidateQueries({ queryKey: ['healthMoodCorrelation', patientId] });
        }
    });

    return {
        useMetrics,
        useCorrelations,
        addMetric
    };
};
