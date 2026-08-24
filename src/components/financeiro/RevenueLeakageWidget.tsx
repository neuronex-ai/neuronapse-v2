import { useRevenueLeakage } from "@/hooks/use-revenue-leakage";
import { AlertTriangle, CheckCircle, ArrowRight, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewAppointmentTransactionModal } from "@/components/agenda/NewAppointmentTransactionModal";
import { Appointment } from "@/types";

export const RevenueLeakageWidget = () => {
  const { data: unpaidSessions, isLoading } = useRevenueLeakage();

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>;
  }

  if (!unpaidSessions || unpaidSessions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-transparent">
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-3 border border-zinc-200 dark:border-white/10">
          <CheckCircle className="h-6 w-6 text-zinc-900 dark:text-white" />
        </div>
        <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em]">Tudo certo</h3>
        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-widest max-w-[200px]">Todas as sessões foram registradas.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-2 bg-transparent">
      {/* Header only visible if outside of dialog context, but here we usually show it inside dialog, 
                so we can keep it minimal or remove it if the DialogHeader already covers it. 
                The previous code had a header, let's keep it but style it nicely. 
            */}
      <div className="flex items-center justify-between mb-6 relative z-10 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-sm">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.3em]">Pendências</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">{unpaidSessions.length} sessões sem registro</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {unpaidSessions.map(session => {
          const appointmentForModal = {
            id: session.id,
            start_time: session.start_time,
            end_time: session.start_time,
            patient_id: session.patient_id,
            user_id: '',
            type: 'presencial',
            status: 'completed',
            created_at: session.start_time,
            notes: null,
            location: null
          } as Appointment;

          return (
            <div key={session.id} className="flex items-center justify-between p-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-white hover:shadow-lg hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300 group">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-black text-zinc-900 dark:text-white truncate uppercase tracking-tight">{session.patient_name}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  <CalendarClock className="h-3 w-3" />
                  {format(new Date(session.start_time), "dd 'de' MMM", { locale: ptBR })}
                  {session.suggested_value && (
                    <span className="text-zinc-900 dark:text-white ml-1">
                      • R$ {session.suggested_value.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <NewAppointmentTransactionModal
                appointment={appointmentForModal}
                patientName={session.patient_name}
                defaultAmount={session.suggested_value}
              >
                <Button size="sm" variant="outline" className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black bg-zinc-50 dark:bg-zinc-950/10 transition-all">
                  Registrar <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </NewAppointmentTransactionModal>
            </div>
          );
        })}
      </div>
    </div>
  );
};