import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { subDays, differenceInDays } from 'date-fns';
import {
  isAbsentAppointmentStatus,
  isAttendedAppointmentStatus,
  isCancelledAppointmentStatus,
} from '@/lib/appointment-status';

export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnAlert {
  patientId: string;
  patientName: string;
  riskScore: number;
  riskLevel: ChurnRiskLevel;
  factors: string[];
  suggestedAction: string;
}

const SUGGESTED_ACTIONS: Record<string, string> = {
  no_session: 'Enviar mensagem de acolhimento e perguntar como está',
  cancelled: 'Oferecer horário alternativo ou sessão online',
  unpaid: 'Enviar lembrete gentil sobre pendência financeira',
  frequency_drop: 'Agendar sessão de acompanhamento preventivo',
  no_future: 'Sugerir agendamento para manter a continuidade do tratamento',
};

const getSuggestedAction = (factors: string[]): string => {
  const joined = factors.join(' ').toLowerCase();
  if (joined.includes('dias sem sessão')) return SUGGESTED_ACTIONS.no_session;
  if (joined.includes('cancelamento') || joined.includes('falta')) return SUGGESTED_ACTIONS.cancelled;
  if (joined.includes('fatura')) return SUGGESTED_ACTIONS.unpaid;
  if (joined.includes('frequência')) return SUGGESTED_ACTIONS.frequency_drop;
  if (joined.includes('sem agendamento')) return SUGGESTED_ACTIONS.no_future;
  return 'Entrar em contato para reforçar o vínculo terapêutico';
};

const getRiskLevel = (score: number): ChurnRiskLevel => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
};

const fetchTopChurnRisks = async (userId: string): Promise<ChurnAlert[]> => {
  // 1. Get active patients
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(100);

  if (error || !patients || patients.length === 0) return [];

  const now = new Date();
  const ninetyDaysAgo = subDays(now, 90);

  // 2. Batch fetch all appointments for all patients in one query
  const patientIds = patients.map(p => p.id);

  const { data: allAppointments } = await supabase
    .from('appointments')
    .select('id, status, notes, start_time, patient_id')
    .eq('user_id', userId)
    .in('patient_id', patientIds)
    .gte('start_time', ninetyDaysAgo.toISOString())
    .order('start_time', { ascending: false });

  // 3. Batch fetch overdue invoices
  const { data: allOverdueInvoices } = await supabase
    .from('invoices')
    .select('id, patient_id, amount')
    .eq('user_id', userId)
    .in('patient_id', patientIds)
    .eq('status', 'pending')
    .lt('due_date', now.toISOString().split('T')[0]);

  // 4. Calculate risk for each patient locally
  const alerts: ChurnAlert[] = [];

  for (const patient of patients) {
    const patientApts = allAppointments?.filter(a => a.patient_id === patient.id) || [];
    const patientInvoices = allOverdueInvoices?.filter(i => i.patient_id === patient.id) || [];
    const factors: string[] = [];
    let score = 0;

    // Cancelamento/falta rate
    const total = patientApts.length;
    if (total > 0) {
      const badCount = patientApts.filter(a =>
        isCancelledAppointmentStatus(a.status, a.notes) || isAbsentAppointmentStatus(a.status, a.notes)
      ).length;
      const cancelRate = badCount / total;
      score += Math.min(cancelRate * 100, 30);
      if (cancelRate > 0.3) factors.push(`${Math.round(cancelRate * 100)}% de cancelamentos`);
    }

    // Tempo sem sessão
    const completedApts = patientApts.filter(a => isAttendedAppointmentStatus(a.status, a.notes));
    if (completedApts.length > 0) {
      const daysSince = differenceInDays(now, new Date(completedApts[0].start_time));
      if (daysSince > 60) { score += 25; factors.push(`${daysSince} dias sem sessão`); }
      else if (daysSince > 30) { score += 15; factors.push(`${daysSince} dias sem sessão`); }
      else if (daysSince > 14) score += 8;
    } else {
      score += 20;
      factors.push('Nenhuma sessão concluída');
    }

    // Inadimplência
    if (patientInvoices.length > 0) {
      score += Math.min(patientInvoices.length * 7, 20);
      const totalDebt = patientInvoices.reduce((s, i) => s + i.amount, 0);
      factors.push(`R$ ${totalDebt.toLocaleString('pt-BR')} em aberto`);
    }

    // Sem futuro
    const hasFuture = patientApts.some(a =>
      new Date(a.start_time) > now && !isCancelledAppointmentStatus(a.status, a.notes)
    );
    if (!hasFuture) {
      score += 10;
      factors.push('Sem agendamento futuro');
    }

    const finalScore = Math.min(Math.round(score), 100);
    const riskLevel = getRiskLevel(finalScore);

    // Only include medium+ risks
    if (riskLevel !== 'low') {
      alerts.push({
        patientId: patient.id,
        patientName: patient.name,
        riskScore: finalScore,
        riskLevel,
        factors: factors.slice(0, 3),
        suggestedAction: getSuggestedAction(factors),
      });
    }
  }

  // Sort by risk score descending, return top 5
  return alerts
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
};

export const useChurnAlerts = () => {
  const { user } = useAuth();

  return useQuery<ChurnAlert[]>({
    queryKey: ['churnAlerts', user?.id],
    queryFn: () => fetchTopChurnRisks(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutos de cache
    gcTime: 1000 * 60 * 60,
  });
};
