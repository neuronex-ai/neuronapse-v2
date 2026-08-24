import { useAuth } from '@/components/auth/SessionContextProvider';
import { getAppointmentKind } from '@/lib/appointment-metadata';
import {
  normalizeAppointmentStatus,
  STATUS_CHART_KEYS,
  type AppointmentStatus,
} from '@/lib/appointment-status';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/types';
import { useQuery } from '@tanstack/react-query';
import {
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  formatISO,
  isAfter,
  parseISO,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const isClinicalSession = (appointment: Appointment) =>
  getAppointmentKind(appointment) === 'session' && !!appointment.patient_id;

const countByStatus = (appointments: Appointment[], status: AppointmentStatus) =>
  appointments.filter((appointment) => normalizeAppointmentStatus(appointment.status, appointment.notes) === status).length;

const getBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) return null;

  const isoDateOnly = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateOnly) {
    return {
      day: Number(isoDateOnly[3]),
      monthIndex: Number(isoDateOnly[2]) - 1,
    };
  }

  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    day: parsed.getDate(),
    monthIndex: parsed.getMonth(),
  };
};

export const useMonthlySessionMetrics = (selectedDate: Date) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['monthly-session-metrics', selectedDate.toISOString(), userId],
    queryFn: async () => {
      if (!userId) return null;

      const startMonth = startOfMonth(selectedDate);
      const endMonth = endOfMonth(selectedDate);
      const startYear = startOfYear(selectedDate);
      const endYear = endOfYear(selectedDate);

      const { data: monthApts, error: monthError } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', formatISO(startMonth))
        .lte('start_time', formatISO(endMonth));

      if (monthError) throw monthError;

      const { data: yearApts, error: yearError } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', formatISO(startYear))
        .lte('start_time', formatISO(endYear));

      if (yearError) throw yearError;

      const { data: allPatients, error: patientsError } = await supabase
        .from('patients')
        .select('id, name, birth_date, phone, email, status')
        .eq('user_id', userId);

      if (patientsError) throw patientsError;

      const selectedMonth = selectedDate.getMonth();
      const monthlyBirthdays = (allPatients || [])
        .filter((patient) => {
          const birth = getBirthDateParts(patient.birth_date);
          return !!birth && birth.monthIndex === selectedMonth;
        })
        .map((patient) => {
          const birth = getBirthDateParts(patient.birth_date)!;
          return {
            id: patient.id,
            name: patient.name,
            birth_date: patient.birth_date!,
            birth_day: birth.day,
            birth_month: birth.monthIndex,
            phone: patient.phone,
            email: patient.email,
          };
        })
        .sort((a, b) => a.birth_day - b.birth_day);

      const { count: activityCount } = await supabase
        .from('dashboard_patient_activity_v')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('occurred_at', formatISO(startMonth))
        .lte('occurred_at', formatISO(endMonth));

      const appointments = ((monthApts || []) as Appointment[]).filter(isClinicalSession);
      const yearAppointments = ((yearApts || []) as Appointment[]).filter(isClinicalSession);
      const now = new Date();

      const totalScheduled = appointments.length;
      const present = countByStatus(appointments, 'attended');
      const absent = countByStatus(appointments, 'absent');
      const clientCancelled = countByStatus(appointments, 'cancelled_by_patient');
      const proCancelled = countByStatus(appointments, 'cancelled_by_professional');
      const unscored = countByStatus(appointments, 'unscored');

      const patientAptCounts: Record<string, number> = {};
      const patientsWithFutureApts = new Set<string>();
      const reschedules = appointments.filter((appointment: any) => {
        if (!appointment.updated_at || !appointment.created_at) return false;
        const created = new Date(appointment.created_at).getTime();
        const updated = new Date(appointment.updated_at).getTime();
        return updated - created > 60000;
      }).length;

      appointments.forEach((appointment) => {
        if (appointment.patient_id) {
          patientAptCounts[appointment.patient_id] = (patientAptCounts[appointment.patient_id] || 0) + 1;
          if (isAfter(new Date(appointment.start_time), now)) {
            patientsWithFutureApts.add(appointment.patient_id);
          }
        }
      });

      const topPatientId = Object.entries(patientAptCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const topPatientName = allPatients?.find((patient) => patient.id === topPatientId)?.name || 'Nenhum';
      const topPatientCount = patientAptCounts[topPatientId || ''] || 0;

      const onlineCount = appointments.filter((appointment) => appointment.type === 'online').length;
      const presencialCount = appointments.filter((appointment) => appointment.type === 'presencial').length;
      const onlinePerc = totalScheduled > 0 ? (onlineCount / totalScheduled) * 100 : 0;
      const presencialPerc = totalScheduled > 0 ? (presencialCount / totalScheduled) * 100 : 0;

      const activePatients = (allPatients || []).filter((patient: any) => patient.status === 'active');
      const totalActivePatients = activePatients.length || allPatients?.length || 0;
      const withFuture = patientsWithFutureApts.size;
      const withoutFuture = Math.max(totalActivePatients - withFuture, 0);

      const months = eachMonthOfInterval({ start: startYear, end: endYear });
      const chartData = months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthAppointments = yearAppointments.filter((appointment) => {
          const date = parseISO(appointment.start_time);
          return date >= monthStart && date <= monthEnd;
        });

        return {
          name: format(month, 'MMMM', { locale: ptBR }),
          [STATUS_CHART_KEYS.unscored]: countByStatus(monthAppointments, 'unscored'),
          [STATUS_CHART_KEYS.attended]: countByStatus(monthAppointments, 'attended'),
          [STATUS_CHART_KEYS.absent]: countByStatus(monthAppointments, 'absent'),
          [STATUS_CHART_KEYS.cancelled_by_patient]: countByStatus(monthAppointments, 'cancelled_by_patient'),
          [STATUS_CHART_KEYS.cancelled_by_professional]: countByStatus(monthAppointments, 'cancelled_by_professional'),
        };
      });

      return {
        kpis: {
          totalScheduled,
          present,
          absent,
          clientCancelled,
          proCancelled,
          confirmed: present,
          unscored,
        },
        patients: {
          totalActive: totalActivePatients,
          withFuture,
          withoutFuture,
          topPatientName,
          topPatientCount,
          onlinePerc,
          presencialPerc,
          reschedules,
        },
        chartData,
        monthlyBirthdays,
        birthdayCount: monthlyBirthdays.length,
        activityCount: activityCount || 0,
      };
    },
    enabled: !!userId,
  });
};
