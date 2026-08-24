import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { subMonths, format } from 'date-fns';
import { isAttendedAppointmentStatus } from '@/lib/appointment-status';
import { getAppointmentKind } from '@/lib/appointment-metadata';

export interface UnpaidSession {
  id: string;
  start_time: string;
  patient_name: string;
  patient_id: string;
  suggested_value?: number;
}

const fetchRevenueLeakage = async (userId: string): Promise<UnpaidSession[]> => {
  // Busca sessões concluídas nos últimos 2 meses para não pesar a query
  const startDate = format(subMonths(new Date(), 2), 'yyyy-MM-dd');

  // 1. Buscar agendamentos concluídos
  const { data: appointments, error: aptError } = await supabase
    .from('appointments')
    .select('id, start_time, status, notes, type, patient_id, metadata, patient:patient_id(name, id)')
    .eq('user_id', userId)
    .gte('start_time', startDate);

  if (aptError) throw new Error(aptError.message);

  // 2. Buscar IDs de agendamentos que JÁ possuem transação
  const billableAppointments = (appointments || []).filter((appointment: any) =>
    getAppointmentKind(appointment) === 'session' &&
    isAttendedAppointmentStatus(appointment.status, appointment.notes)
  );
  const appointmentIds = billableAppointments.map(a => a.id);

  if (appointmentIds.length === 0) return [];

  const { data: financialEntries, error: entriesError } = await supabase
    .from('financial_entries')
    .select('appointment_id')
    .eq('professional_id', userId)
    .in('appointment_id', appointmentIds);

  if (entriesError) throw new Error(entriesError.message);

  const billedAppointmentIds = new Set((financialEntries || []).map(t => t.appointment_id));

  // 3. Filtrar apenas os que NÃO estão no set de pagos
  let unpaid: UnpaidSession[] = billableAppointments
    .filter(apt => !billedAppointmentIds.has(apt.id))
    .map(apt => {
      const patient = Array.isArray(apt.patient) ? apt.patient[0] : apt.patient;
      return {
        id: apt.id,
        start_time: apt.start_time,
        patient_name: (patient as any)?.name || 'Paciente',
        patient_id: (patient as any)?.id
      };
    });

  // 4. Buscar valor sugerido baseado na última transação de cada paciente
  const uniquePatientIds = [...new Set(unpaid.map(u => u.patient_id).filter(Boolean))];

  if (uniquePatientIds.length > 0) {
    const { data: historyData } = await supabase
      .from('financial_entries')
      .select('amount, due_date, paid_at, competence_date, patient_id')
      .eq('professional_id', userId)
      .eq('type', 'income')
      .in('patient_id', uniquePatientIds)
      .order('due_date', { ascending: false });

    // Agrupar transações por paciente
    const entriesByPatient = new Map<string, any[]>();
    historyData?.forEach((t: any) => {
      const pId = t.patient_id;
      if (pId) {
        if (!entriesByPatient.has(pId)) {
          entriesByPatient.set(pId, []);
        }
        entriesByPatient.get(pId)?.push(t);
      }
    });

    unpaid = unpaid.map(u => {
      const patientEntries = entriesByPatient.get(u.patient_id) || [];

      // Encontrar a transação mais recente que seja ANTERIOR ou IGUAL à data da sessão
      // Como historyData está desc (mais recente primeiro), procuramos o primeiro que satisfaz a condição
      const sessionDate = new Date(u.start_time);

      const match = patientEntries.find(t => new Date(t.paid_at || t.due_date || t.competence_date) <= sessionDate);

      // Se não encontrar anterior, usa a mais antiga disponível (ou a mais recente absoluta se preferir, mas lógica temporal sugere 'preço vigente')
      // Fallback: use the most recent transaction found (first in list) if no prior transaction exists
      const suggested = match ? match.amount : (patientEntries.length > 0 ? patientEntries[0].amount : undefined);

      return {
        ...u,
        suggested_value: suggested
      };
    });
  }

  return unpaid;
};
export const useRevenueLeakage = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<UnpaidSession[], Error>({
    queryKey: ['revenueLeakage', userId],
    queryFn: () => fetchRevenueLeakage(userId!),
    enabled: !!userId,
  });
};
