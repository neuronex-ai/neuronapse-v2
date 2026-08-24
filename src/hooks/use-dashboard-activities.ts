import { useAuth } from '@/components/auth/SessionContextProvider';
import { isCancelledAppointmentStatus, normalizeAppointmentStatus } from '@/lib/appointment-status';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, formatISO, startOfMonth } from 'date-fns';

export type ActivityType =
  | 'appointment_scheduled'
  | 'appointment_status'
  | 'appointment_rescheduled'
  | 'payment_received'
  | 'anamnesis_updated'
  | 'note_created';

export interface DashboardActivity {
  id: string;
  type: ActivityType;
  patient_name: string;
  patient_id: string;
  date: Date;
  description: string;
  amount?: number;
  status?: string;
  typeLabel?: string;
}

const getAppointmentActivity = (row: any): DashboardActivity => {
  const normalizedStatus = normalizeAppointmentStatus(row.status);
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
  const changedAt = row.occurred_at ? new Date(row.occurred_at).getTime() : 0;
  const wasEditedAfterCreate = createdAt > 0 && changedAt - createdAt > 60000;
  const referenceDate = new Date(row.reference_at || row.occurred_at);
  const dateLabel = referenceDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const timeLabel = referenceDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isCancelled = isCancelledAppointmentStatus(normalizedStatus);
  const hasPresenceStatus = normalizedStatus !== 'unscored';
  const type: ActivityType = isCancelled || hasPresenceStatus
    ? 'appointment_status'
    : wasEditedAfterCreate
      ? 'appointment_rescheduled'
      : 'appointment_scheduled';

  return {
    id: row.source_id,
    type,
    patient_name: row.patient_name || 'Paciente',
    patient_id: row.patient_id || '',
    date: new Date(row.occurred_at),
    status: normalizedStatus,
    typeLabel: type === 'appointment_rescheduled'
      ? 'Reagendamento'
      : type === 'appointment_status'
        ? 'Status de consulta'
        : 'Consulta registrada',
    description: type === 'appointment_rescheduled'
      ? `reagendou a consulta para ${dateLabel} às ${timeLabel}.`
      : type === 'appointment_status'
        ? `${isCancelled ? 'cancelou' : 'atualizou o status da'} consulta de ${dateLabel} às ${timeLabel}.`
        : `registrou uma consulta para ${dateLabel} às ${timeLabel}.`,
  };
};

const mapActivity = (row: any): DashboardActivity => {
  if (row.source_type === 'appointment') return getAppointmentActivity(row);

  const common = {
    id: row.source_id,
    patient_name: row.patient_name || 'Paciente',
    patient_id: row.patient_id || '',
    date: new Date(row.occurred_at),
  };

  if (row.source_type === 'payment') {
    return {
      ...common,
      type: 'payment_received',
      typeLabel: 'Pagamento',
      description: 'realizou o pagamento da sessão.',
      amount: Number(row.amount || 0),
      status: row.status || 'completed',
    };
  }

  if (row.source_type === 'anamnesis') {
    return {
      ...common,
      type: 'anamnesis_updated',
      typeLabel: 'Anamnese',
      description: 'preencheu ou atualizou a ficha de anamnese pelo link online.',
    };
  }

  return {
    ...common,
    type: 'note_created',
    typeLabel: 'Nota clínica',
    description: 'teve uma nota clínica registrada.',
  };
};

export const useDashboardActivities = (selectedDate = new Date()) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['dashboard-activities', userId, selectedDate.getFullYear(), selectedDate.getMonth()],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('dashboard_patient_activity_v')
        .select('*')
        .eq('user_id', userId)
        .gte('occurred_at', formatISO(startOfMonth(selectedDate)))
        .lte('occurred_at', formatISO(endOfMonth(selectedDate)))
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      return (data || [])
        .filter((row: any) => row.occurred_at)
        .map(mapActivity);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
};
