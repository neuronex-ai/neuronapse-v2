import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAddAppointment } from "@/hooks/use-add-appointment";
import { usePatients } from "@/hooks/use-patients";
import { buildSessionMetadata } from "@/lib/appointment-metadata";
import { cn } from "@/lib/utils";
import { addMinutes, format } from "date-fns";
import { CalendarPlus, CheckCircle2, Clock, MapPin, Plus, Video } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  MobileSynapseButton,
  MobileSynapseEyebrow,
  MobileSynapseField,
  mobileSynapseInputClassName,
} from "./synapse/MobileSynapsePrimitives";
import { NewPatientModal } from "@/components/patients/NewPatientModal";

interface MobileNewAppointmentSheetProps {
  children: ReactNode;
  selectedDate?: Date | null;
  selectedTime?: string | null;
  onCreated?: () => void;
}

const formatDateInput = (date: Date) => format(date, "yyyy-MM-dd");

export function MobileNewAppointmentSheet({
  children,
  selectedDate,
  selectedTime,
  onCreated,
}: MobileNewAppointmentSheetProps) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(formatDateInput(selectedDate || new Date()));
  const [startTime, setStartTime] = useState(selectedTime || "09:00");
  const [duration, setDuration] = useState("50");
  const [modality, setModality] = useState<"presencial" | "online">("presencial");
  const [sessionType, setSessionType] = useState("follow_up");
  const [notes, setNotes] = useState("");
  const { data: patients, isLoading: loadingPatients } = usePatients();
  const { mutateAsync: createAppointment, isPending } = useAddAppointment();

  useEffect(() => {
    if (!open) return;
    setDate(formatDateInput(selectedDate || new Date()));
    setStartTime(selectedTime || "09:00");
  }, [open, selectedDate, selectedTime]);

  const patientOptions = useMemo(() => patients || [], [patients]);

  const handleSubmit = async () => {
    if (!patientId) {
      toast.error("Selecione um paciente.");
      return;
    }

    const durationMinutes = Number(duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      toast.error("Informe uma duração válida.");
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(startDateTime.getTime())) {
      toast.error("Informe data e horário válidos.");
      return;
    }

    const endDateTime = addMinutes(startDateTime, durationMinutes);

    try {
      await createAppointment({
        patient_id: patientId,
        start_time: startDateTime,
        end_time: endDateTime,
        type: modality,
        location: modality === "online" ? "Teleconsulta NeuroNex" : "Consultório",
        notes,
        metadata: buildSessionMetadata({
          sessionType,
          modality,
          durationMinutes,
          notes,
          origin: "neuronex",
          syncStatus: "pending",
          financial: {
            usePackage: false,
            transactionAmount: null,
            transactionMethod: null,
            installments: 1,
          },
        }),
      });
    } catch {
      return;
    }

    setOpen(false);
    setPatientId("");
    setNotes("");
    onCreated?.();
  };

  return (
    <>
      <span
        className="contents"
        onClick={(event) => {
          if (!event.defaultPrevented) setOpen(true);
        }}
      >
        {children}
      </span>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="[&>div:first-child]:hidden z-[125] flex h-[min(92dvh,46rem)] max-h-[92dvh] overflow-hidden rounded-t-[30px] border-border/40 bg-background p-0 shadow-2xl dark:border-white/10">
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/14" />
          <header className="shrink-0 px-5 pb-4 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/40 bg-card/72 dark:border-white/10 dark:bg-white/[0.03]">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <MobileSynapseEyebrow>Agenda mobile</MobileSynapseEyebrow>
                <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.05em] text-foreground">Novo agendamento</h2>
                <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/70">
                  Crie uma sessão sem abrir o modal desktop.
                </p>
              </div>
            </div>
          </header>

          <div className="mobile-scroll-owner min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">
            <MobileSynapseField label="Paciente" hint={loadingPatients ? "Carregando pacientes..." : undefined}>
              <div className="grid grid-cols-[1fr_3rem] gap-2">
                <select value={patientId} onChange={(event) => setPatientId(event.target.value)} className={mobileSynapseInputClassName}>
                  <option value="">Selecione o paciente</option>
                  {patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.name}</option>
                  ))}
                </select>
                <NewPatientModal
                  onCreated={(patient) => {
                    if (patient?.id) setPatientId(patient.id);
                  }}
                >
                  <button
                    type="button"
                    className={cn(mobileSynapseInputClassName, "flex items-center justify-center p-0")}
                    aria-label="Criar novo paciente"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </NewPatientModal>
              </div>
            </MobileSynapseField>

            <div className="grid grid-cols-2 gap-3">
              <MobileSynapseField label="Data">
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={mobileSynapseInputClassName} />
              </MobileSynapseField>
              <MobileSynapseField label="Horário">
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={mobileSynapseInputClassName} />
              </MobileSynapseField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MobileSynapseField label="Duração">
                <select value={duration} onChange={(event) => setDuration(event.target.value)} className={mobileSynapseInputClassName}>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="50">50 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </MobileSynapseField>
              <MobileSynapseField label="Tipo">
                <select value={sessionType} onChange={(event) => setSessionType(event.target.value)} className={mobileSynapseInputClassName}>
                  <option value="follow_up">Acompanhamento</option>
                  <option value="first_visit">Primeira consulta</option>
                  <option value="emergency">Encaixe</option>
                </select>
              </MobileSynapseField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "presencial", label: "Presencial", icon: MapPin },
                { value: "online", label: "Online", icon: Video },
              ].map((option) => {
                const Icon = option.icon;
                const active = modality === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setModality(option.value as "presencial" | "online")}
                    className={cn(
                      "flex min-h-12 items-center justify-center gap-2 rounded-[16px] border text-[9px] font-black uppercase tracking-[0.12em]",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/45 bg-card/72 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <MobileSynapseField label="Notas">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observações internas"
                className={cn(mobileSynapseInputClassName, "h-28 resize-none py-4 leading-relaxed")}
              />
            </MobileSynapseField>

            <div className="rounded-[18px] border border-border/40 bg-card/72 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground">
                <Clock className="h-4 w-4" />
                Resumo
              </div>
              <p className="mt-2 text-sm font-black tracking-[-0.02em] text-foreground">
                {date ? format(new Date(`${date}T12:00:00`), "dd/MM/yyyy") : "Data"} às {startTime || "--:--"}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground/68">
                {duration} minutos, {modality === "online" ? "online" : "presencial"}.
              </p>
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/40 bg-background/94 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10">
            <div className="grid grid-cols-[0.8fr_1.2fr] gap-2.5">
              <MobileSynapseButton variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </MobileSynapseButton>
              <MobileSynapseButton onClick={handleSubmit} loading={isPending}>
                <CheckCircle2 className="h-4 w-4" />
                Agendar
              </MobileSynapseButton>
            </div>
          </footer>
        </DrawerContent>
      </Drawer>
    </>
  );
}
