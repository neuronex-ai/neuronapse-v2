import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePatientAppointments } from "@/hooks/use-patient-appointments";
import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { cn } from "@/lib/utils";
import { Appointment } from "@/types";
import { differenceInMinutes, format, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calendar as CalendarIcon, Clock, Loader2, MapPin, Video } from "lucide-react";
import { JoinSessionModal } from "./JoinSessionModal";
import { RequestAppointmentModal } from "./RequestAppointmentModal";

const getDurationString = (start: string, end: string) => {
  const minutes = differenceInMinutes(new Date(end), new Date(start));
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }
  return `${minutes}min`;
};

interface PatientAppointmentsListProps {
  patientId?: string;
}

export const PatientAppointmentsList = ({ patientId }: PatientAppointmentsListProps) => {
  const { data: appointments, isLoading, error } = usePatientAppointments(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm bg-rose-500/5 rounded-xl mx-4">
        Erro ao carregar seus agendamentos.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Próximas Consultas
          </h2>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide ml-7">
            {appointments && appointments.length > 0 ? `${appointments.length} agendada(s)` : "Agenda livre"}
          </span>
        </div>

        <RequestAppointmentModal />
      </div>

      <div className="space-y-3">
        {appointments && appointments.filter((appointment: Appointment) => !isCancelledAppointmentStatus(appointment.status, appointment.notes)).length > 0 ? (
          appointments
            .filter((appointment: Appointment) => !isCancelledAppointmentStatus(appointment.status, appointment.notes))
            .map((appointment: Appointment) => {
            const statusMeta = getAppointmentStatusMeta(appointment.status, appointment.notes);
            const isOnlineSession = appointment.type === 'online';
            const isNearStart = isFuture(new Date(appointment.start_time)) && differenceInMinutes(new Date(appointment.start_time), new Date()) <= 15;
            const isToday = new Date(appointment.start_time).getDate() === new Date().getDate();

            return (
              <div
                key={appointment.id}
                className={cn(
                  "group flex flex-col relative p-5 rounded-2xl border transition-all duration-300 overflow-hidden",
                  statusMeta.value === 'unscored'
                    ? "bg-[#0F0F11] border-zinc-500/20 hover:border-zinc-500/30"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                )}
              >
                {isToday && (
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1 animate-pulse", statusMeta.dotClassName)} />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex flex-col items-center justify-center w-12 h-12 rounded-xl border shadow-sm",
                        isToday ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-white/80"
                      )}>
                        <span className="text-sm font-bold">{format(new Date(appointment.start_time), 'dd')}</span>
                        <span className="text-[9px] uppercase font-bold opacity-70">{format(new Date(appointment.start_time), 'MMM', { locale: ptBR })}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-base">
                            {format(new Date(appointment.start_time), 'EEEE', { locale: ptBR })}
                          </p>
                          <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0", statusMeta.softClassName, statusMeta.textClassName)}>
                            {statusMeta.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{format(new Date(appointment.start_time), 'HH:mm')}</span>
                          <span className="text-white/20">•</span>
                          <span>{getDurationString(appointment.start_time, appointment.end_time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 sm:gap-1 pl-14 sm:pl-0">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide font-medium">
                      {appointment.type === "online" ? (
                        <>
                          <Video className="h-3.5 w-3.5 text-primary" />
                          <span className="text-primary">Online</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Presencial</span>
                        </>
                      )}
                    </div>

                    {isOnlineSession ? (
                      isNearStart ? (
                        <JoinSessionModal appointment={appointment}>
                          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 rounded-xl h-9 px-4 text-xs font-bold uppercase tracking-wider w-full sm:w-auto">
                            <Video className="h-3.5 w-3.5" />
                            Entrar
                          </Button>
                        </JoinSessionModal>
                      ) : (
                        <div className="text-[10px] text-muted-foreground/50 font-medium bg-white/5 px-2 py-1 rounded-md">
                          Link disponível em breve
                        </div>
                      )
                    ) : appointment.google_meet_link && appointment.type === 'online' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white rounded-xl h-9 text-xs w-full sm:w-auto"
                        onClick={() => window.open(appointment.google_meet_link || '', '_blank')}
                      >
                        Link Externo <ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <CalendarIcon className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">Nenhuma consulta futura.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Solicite um novo horário acima.</p>
          </div>
        )}
      </div>
    </div>
  );
};
