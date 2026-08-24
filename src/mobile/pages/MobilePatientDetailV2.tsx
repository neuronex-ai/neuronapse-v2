import { ClinicalSummaryCard } from "@/components/patients/ClinicalSummaryCard";
import { EditPatientModal } from "@/components/patients/EditPatientModal";
import { PatientDocumentsTab } from "@/components/patients/PatientDocumentsTab";
import { PatientFinanceTab } from "@/components/patients/PatientFinanceTab";
import { PatientGoalsTab } from "@/components/patients/PatientGoalsTab";
import { PatientHistoryTab } from "@/components/patients/PatientHistoryTab";
import { PatientMoodTab } from "@/components/patients/PatientMoodTab";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddAppointment } from "@/hooks/use-add-appointment";
import { usePatientAppointments } from "@/hooks/use-patient-appointments";
import { usePatientById } from "@/hooks/use-patient-by-id";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { cn } from "@/lib/utils";
import { addWeeks, format } from "date-fns";
import { ArrowLeft, Cake, DollarSign, Edit2, FileOutput, FileText, Loader2, Phone, RotateCw, Smile, Target } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MobileLoadingState, MobilePageHeader, MobilePageScaffold, MobileStatusBanner } from "../components/MobilePagePrimitives";

export const MobilePatientDetailV2 = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const patientQuery = usePatientById(id || "");
  const { data: notes } = useSessionNotes(id || "");
  const { data: appointments } = usePatientAppointments();
  const { mutate: addAppointment, isPending: isScheduling } = useAddAppointment();
  const patient = patientQuery.data;
  const latestNote = notes?.[0];

  const repeatLastAppointment = () => {
    if (!id || !appointments?.length) {
      toast.info("Nenhum agendamento anterior encontrado.");
      return;
    }

    const lastAppointment = appointments
      .filter((appointment) => appointment.patient_id === id)
      .sort((left, right) => new Date(right.start_time).getTime() - new Date(left.start_time).getTime())[0];

    if (!lastAppointment) {
      toast.info("Nenhum agendamento anterior encontrado.");
      return;
    }

    const previousStart = new Date(lastAppointment.start_time);
    const previousEnd = new Date(lastAppointment.end_time);
    const duration = Math.max(30 * 60 * 1000, previousEnd.getTime() - previousStart.getTime());
    let nextStart = addWeeks(previousStart, 1);

    while (nextStart.getTime() <= Date.now()) nextStart = addWeeks(nextStart, 1);

    addAppointment({
      patient_id: id,
      start_time: nextStart,
      end_time: new Date(nextStart.getTime() + duration),
      type: lastAppointment.type,
      notes: "Repetição rápida",
      location: lastAppointment.location,
    }, {
      onSuccess: () => toast.success(`Agendado para ${format(nextStart, "dd/MM 'às' HH:mm")}.`),
    });
  };

  if (patientQuery.isLoading) {
    return <MobilePageScaffold><MobileLoadingState label="Carregando paciente" /></MobilePageScaffold>;
  }

  if (!patient) {
    return (
      <MobilePageScaffold>
        <MobileStatusBanner
          variant="error"
          title="Paciente não encontrado"
          description="O cadastro pode ter sido removido ou você não possui acesso a ele."
          action={<Button onClick={() => navigate("/pacientes")} variant="outline" className="h-10 rounded-xl text-[8px] font-black uppercase tracking-[0.11em]">Voltar</Button>}
        />
      </MobilePageScaffold>
    );
  }

  const initials = patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const tabs = [
    { value: "history", label: "Histórico", icon: FileText },
    { value: "mood", label: "Humor", icon: Smile },
    { value: "goals", label: "Metas", icon: Target },
    { value: "documents", label: "Arquivos", icon: FileOutput },
    { value: "finance", label: "Financeiro", icon: DollarSign },
  ];

  return (
    <MobilePageScaffold showBottomNavigation={false}>
      <MobilePageHeader
        eyebrow="Prontuário"
        title={patient.name}
        description={patient.status === "active" ? "Paciente em acompanhamento" : "Cadastro inativo"}
        leading={(
          <Button variant="outline" size="icon" onClick={() => navigate("/pacientes")} className="h-10 w-10 rounded-[14px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        actions={(
          <EditPatientModal patient={patient}>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-[14px]">
              <Edit2 className="h-4 w-4" />
            </Button>
          </EditPatientModal>
        )}
      />

      <div className="space-y-4 pb-2">
        <section className="rounded-[22px] border border-border/40 bg-card/68 p-4 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border border-border/40">
              <AvatarFallback className="bg-foreground text-sm font-black text-background">{initials || "PA"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", patient.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground/55">{patient.status === "active" ? "Em tratamento" : "Inativo"}</p>
              </div>
              <p className="mt-1 truncate text-[15px] font-black text-foreground">{patient.name}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[15px] bg-foreground/[0.035] p-3">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="mt-2 truncate text-[10px] font-black text-foreground">{patient.phone || "Não informado"}</p>
            </div>
            <div className="rounded-[15px] bg-foreground/[0.035] p-3">
              <Cake className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="mt-2 truncate text-[10px] font-black text-foreground">{patient.birth_date ? format(new Date(patient.birth_date), "dd/MM/yyyy") : "Não informado"}</p>
            </div>
          </div>

          <Button onClick={repeatLastAppointment} disabled={isScheduling} variant="outline" className="mt-3 h-11 w-full rounded-[14px] text-[8px] font-black uppercase tracking-[0.11em]">
            {isScheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
            Repetir último horário
          </Button>
        </section>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="-mx-4 flex h-auto w-[calc(100%+2rem)] justify-start gap-1.5 overflow-x-auto rounded-none bg-transparent px-4 pb-1 no-scrollbar">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-10 shrink-0 rounded-[13px] border border-border/40 bg-card/65 px-3 text-[8px] font-black uppercase tracking-[0.09em] text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background dark:border-white/10 dark:bg-white/[0.025]">
                <tab.icon className="mr-1.5 h-3.5 w-3.5" />{tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mobile-patient-embedded mt-4 min-w-0 overflow-x-clip">
            <TabsContent value="history" className="mt-0"><div className="space-y-4"><ClinicalSummaryCard latestNote={latestNote} patient={patient} /><PatientHistoryTab patientId={id!} /></div></TabsContent>
            <TabsContent value="mood" className="mt-0"><PatientMoodTab patientId={id!} /></TabsContent>
            <TabsContent value="goals" className="mt-0"><PatientGoalsTab patientId={id!} /></TabsContent>
            <TabsContent value="documents" className="mt-0"><PatientDocumentsTab patientId={id!} /></TabsContent>
            <TabsContent value="finance" className="mt-0"><PatientFinanceTab patientId={id!} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </MobilePageScaffold>
  );
};
