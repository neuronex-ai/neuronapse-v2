import type { Appointment } from "@/types";

export type DashboardContextNotice = {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
};

export type DashboardSynapseSuggestion = {
  id: string;
  label: string;
  prompt: string;
  reason: string;
};

export type DashboardSuggestionContext = {
  now: Date;
  appointments: Appointment[];
  notifications: DashboardContextNotice[];
  waitlistCount: number;
  pendingPatients: number;
  receivable: number;
  neurofinancePending: number;
};

const cancelledStates = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);

const appointmentName = (appointment: Appointment) =>
  appointment.patient_name?.trim() || "próxima sessão";

const isActiveAppointment = (appointment: Appointment) =>
  !appointment.archived_at &&
  appointment.visibility_status !== "archived" &&
  !cancelledStates.has(String(appointment.lifecycle_status || appointment.status || "").toLowerCase());

export const getDashboardUpcomingAppointments = (
  appointments: Appointment[],
  now: Date,
) =>
  appointments
    .filter(isActiveAppointment)
    .filter((appointment) => new Date(appointment.end_time).getTime() >= now.getTime())
    .sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    );

export const getDashboardAppointmentState = (
  appointment: Appointment,
  now: Date,
): "Confirmado" | "A confirmar" | "A pontuar" => {
  const endAt = new Date(appointment.end_time).getTime();
  const status = String(appointment.lifecycle_status || appointment.status || "").toLowerCase();

  if (endAt < now.getTime() && !["completed", "closed", "concluido", "concluído"].includes(status)) {
    return "A pontuar";
  }

  if (
    ["confirmed", "in_progress", "completed", "closed", "confirmado", "concluido", "concluído"].includes(
      status,
    ) ||
    Boolean(appointment.confirmed_at)
  ) {
    return "Confirmado";
  }

  return "A confirmar";
};

export const getDashboardAppointmentMode = (appointment: Appointment) => {
  if (appointment.type === "online" || appointment.google_meet_link) return "Online";
  if (appointment.type === "presencial") return "Presencial";
  return "Bloqueio";
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const buildDashboardSynapseSuggestions = ({
  now,
  appointments,
  notifications,
  waitlistCount,
  pendingPatients,
  receivable,
  neurofinancePending,
}: DashboardSuggestionContext): DashboardSynapseSuggestion[] => {
  const upcoming = getDashboardUpcomingAppointments(appointments, now);
  const nextAppointment = upcoming[0];
  const unread = notifications.filter((notice) => !notice.isRead);
  const recordNotice = unread.find((notice) => notice.category === "prontuario");
  const financialNotice = unread.find((notice) => notice.category === "financeiro");
  const candidates: DashboardSynapseSuggestion[] = [];

  if (nextAppointment) {
    const name = appointmentName(nextAppointment);
    candidates.push({
      id: `prepare-${nextAppointment.id}`,
      label: `Preparar ${name}`,
      prompt: `O que preciso preparar para a próxima sessão com ${name}? Considere o histórico recente, pendências de prontuário e próximos passos já confirmados.`,
      reason: "Próxima sessão",
    });
  }

  if (recordNotice) {
    candidates.push({
      id: `record-${recordNotice.id}`,
      label: "Revisar prontuários",
      prompt: `Organize o que exige minha atenção em prontuários agora. Comece por: ${recordNotice.title}. Não confirme nada por mim.`,
      reason: "Prontuário",
    });
  } else if (pendingPatients > 0) {
    candidates.push({
      id: "pending-patients",
      label: `${pendingPatients} cadastro${pendingPatients === 1 ? "" : "s"} em atenção`,
      prompt: `Quais cadastros ou prontuários precisam da minha atenção hoje? Tenho ${pendingPatients} cadastro${pendingPatients === 1 ? "" : "s"} pendente${pendingPatients === 1 ? "" : "s"}.`,
      reason: "Pacientes",
    });
  }

  if (waitlistCount > 0) {
    candidates.push({
      id: "waitlist-fit",
      label: "Checar lista de espera",
      prompt: `Tenho ${waitlistCount} pessoa${waitlistCount === 1 ? "" : "s"} ativa${waitlistCount === 1 ? "" : "s"} na lista de espera. Existe alguma janela compatível nos próximos dias? Apenas organize as opções; eu decido se ofereço.`,
      reason: "Agenda",
    });
  }

  if (receivable > 0 || neurofinancePending > 0 || financialNotice) {
    const amount = Math.max(receivable, neurofinancePending);
    candidates.push({
      id: "finance-week",
      label: "Entender o financeiro",
      prompt: `Como está meu financeiro agora? Destaque recebimentos, valores a receber${amount > 0 ? ` — hoje há cerca de ${currency.format(amount)} em aberto ou processamento` : ""} — e qualquer sinal que mereça atenção.`,
      reason: "Financeiro",
    });
  }

  const firstOperationalNotice = unread.find(
    (notice) =>
      notice.category !== "financeiro" &&
      notice.category !== "prontuario",
  );

  if (firstOperationalNotice) {
    candidates.push({
      id: `notice-${firstOperationalNotice.id}`,
      label: firstOperationalNotice.title.slice(0, 42),
      prompt: `Me explique o contexto desta atualização e o que vale revisar: ${firstOperationalNotice.title}. ${firstOperationalNotice.message}`,
      reason: "Atualização recente",
    });
  }

  const fallbacks: DashboardSynapseSuggestion[] = [
    {
      id: "day-flow",
      label: "Organizar meu dia",
      prompt: "Organize meu dia clínico a partir da agenda, prontuários, teleconsultas e pendências atuais. Mostre apenas o que merece minha atenção.",
      reason: "Contexto do dia",
    },
    {
      id: "week-flow",
      label: "Olhar os próximos 7 dias",
      prompt: `O que merece preparação nos próximos 7 dias? Considere os ${upcoming.length} compromisso${upcoming.length === 1 ? "" : "s"} que estão no meu contexto atual.`,
      reason: "Agenda",
    },
    {
      id: "recent-changes",
      label: "O que mudou recentemente?",
      prompt: "Resuma o que mudou recentemente na minha clínica enquanto eu não estava aqui, sem executar nenhuma ação por mim.",
      reason: "Contexto recente",
    },
  ];

  const unique: DashboardSynapseSuggestion[] = [];
  for (const suggestion of [...candidates, ...fallbacks]) {
    if (unique.some((item) => item.prompt === suggestion.prompt)) continue;
    unique.push(suggestion);
    if (unique.length === 3) break;
  }

  return unique;
};
