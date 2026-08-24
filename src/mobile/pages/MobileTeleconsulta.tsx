"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useAppointments } from "@/hooks/use-appointments";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  CalendarClock,
  ChevronRight,
  Clock,
  Play,
  Search,
  Send,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { format, endOfDay, isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MobileLayout } from "../components/MobileLayout";
import { MobileActiveSession } from "../components/MobileActiveSession";
import { SessionReminderDrawer } from "../components/SessionReminderDrawer";

type ViewMode = "upcoming" | "history";
type LatestSessionNote = {
  patients?: {
    id: string;
    name?: string | null;
  } | null;
  ai_summary?: {
    sentiment?: string | null;
    summary?: string | null;
  } | null;
};

export const MobileTeleconsulta = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [activeSession, setActiveSession] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [reminderAppointment, setReminderAppointment] = useState<Appointment | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const today = new Date();
  const { data: appointments, isLoading } = useAppointments({
    startDate: startOfDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
    endDate: endOfDay(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
  });

  const { data: latestNotes } = useQuery<LatestSessionNote[]>({
    queryKey: ["latestSessionNotes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_notes")
        .select("*, patients(id, name)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data as LatestSessionNote[];
    },
    enabled: Boolean(user?.id),
  });

  const lastSession = latestNotes?.[0];

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    const query = searchQuery.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (isCancelledAppointmentStatus(appointment.status, appointment.notes)) return false;
      if (appointment.type === "block") return false;
      if (!query) return true;

      return (
        appointment.patient_name?.toLowerCase().includes(query) ||
        appointment.notes?.toLowerCase().includes(query)
      );
    });
  }, [appointments, searchQuery]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return filteredAppointments
      .filter((appointment) => {
        const endTime = new Date(appointment.end_time);
        return isAfter(endTime, now) || isSameDay(endTime, now);
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [filteredAppointments]);

  const historyAppointments = useMemo(() => {
    const now = new Date();
    return filteredAppointments
      .filter((appointment) => isBefore(new Date(appointment.end_time), now))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [filteredAppointments]);

  const nextAppointment = upcomingAppointments[0];

  useEffect(() => {
    if (!location.state?.activeAppointmentId || !appointments || activeSession) return;

    const sessionToActivate = appointments.find(
      (appointment) => appointment.id === location.state.activeAppointmentId,
    );

    if (sessionToActivate) {
      setActiveSession(sessionToActivate);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [activeSession, appointments, location.pathname, location.state]);

  const handleStartSession = (appointment: Appointment) => {
    setActiveSession(appointment);
    toast.info(`Conectando a sala de ${appointment.patient_name || "teleconsulta"}...`);
  };

  const currentList = viewMode === "upcoming" ? upcomingAppointments : historyAppointments;

  if (activeSession) {
    return (
      <MobileActiveSession
        activeAppointment={activeSession}
        onSessionEnd={() => setActiveSession(null)}
      />
    );
  }

  return (
    <MobileLayout className="min-h-screen bg-background px-0">
      <div className="mobile-scroll-owner h-full overflow-y-auto px-6 pb-32 pt-6">
        <div className="relative z-40 mb-6 w-full animate-fade-in">
          <div className="flex h-[60px] w-full items-center justify-between rounded-full border border-white/10 bg-zinc-900/90 p-2 pl-4 pr-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all duration-300">
            {!isSearchVisible ? (
              <>
                <div className="flex h-full flex-col justify-center -space-y-0.5">
                  <span className="pl-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Salas Virtuais
                  </span>
                  <h1 className="text-base font-bold leading-none tracking-tight text-zinc-100">
                    Teleconsulta
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchVisible(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/5 text-zinc-400 transition-all hover:text-white active:scale-95"
                    aria-label="Buscar sala"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/agenda")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95"
                    aria-label="Abrir agenda"
                  >
                    <CalendarClock className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex w-full flex-1 items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar sala..."
                    className="h-9 rounded-full border-transparent bg-white/5 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchVisible(false);
                    setSearchQuery("");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-white"
                  aria-label="Fechar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-10">
          {nextAppointment && !searchQuery ? (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="mb-5 flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20">
                  Proxima Consulta
                </h3>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    Destaque
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="group relative w-full overflow-hidden rounded-[32px] bg-foreground p-6 text-left text-background shadow-2xl transition-transform active:scale-[0.98]"
                onClick={() => handleStartSession(nextAppointment)}
              >
                <div className="absolute right-0 top-0 -mr-20 -mt-20 h-48 w-48 rounded-full bg-white/10 blur-[60px]" />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/50">
                        {isSameDay(new Date(nextAppointment.start_time), new Date())
                          ? "Hoje"
                          : format(new Date(nextAppointment.start_time), "dd 'de' MMM", { locale: ptBR })}{" "}
                        as {format(new Date(nextAppointment.start_time), "HH:mm")}
                      </p>
                      <h2 className="truncate pr-4 text-2xl font-black tracking-tight">
                        {nextAppointment.patient_name || "Paciente"}
                      </h2>
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-background/20 bg-background/10 px-3 py-1.5 backdrop-blur-md">
                        <Video className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em]">
                          Acessar Teleconsulta
                        </span>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-background text-foreground shadow-xl"
                  >
                    <Play className="ml-1 h-6 w-6 fill-current" />
                  </motion.div>
                </div>
              </button>
            </motion.section>
          ) : null}

          {!searchQuery ? (
            <motion.section
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              <div className="mb-5 flex items-center gap-2 px-1">
                <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20">
                  Recapitulacao IA
                </h3>
              </div>

              <div className="group relative">
                <div className="absolute -inset-0.5 rounded-[32px] bg-gradient-to-r from-foreground/10 to-transparent opacity-30 blur-xl transition-all duration-700 group-hover:opacity-50" />
                <div className="relative overflow-hidden rounded-[28px] border border-border/20 bg-card shadow-2xl">
                  <div className="relative z-10 p-6">
                    <div className="mb-6 flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-4">
                        <h2 className="mb-1 text-xl font-bold leading-tight text-foreground">
                          Ultima Sessao
                        </h2>
                        <p className="truncate text-sm text-muted-foreground">
                          {lastSession?.patients?.name || "Inicie uma sessao para gerar insights"}
                        </p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/10 bg-foreground/[0.04]">
                        <BrainCircuit className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="mb-5 rounded-[20px] border border-border/10 bg-foreground/[0.02] p-5 backdrop-blur-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                          Analise
                        </span>
                        <span className="rounded-md border border-border/10 bg-foreground/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground/70">
                          {lastSession?.ai_summary?.sentiment || "Padrao"}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-[13px] font-medium leading-relaxed text-muted-foreground">
                        {lastSession?.ai_summary?.summary ||
                          "O resumo inteligente aparecera aqui apos a finalizacao da nota da sessao do paciente."}
                      </p>
                    </div>

                    <Button
                      disabled={!lastSession?.patients?.id}
                      onClick={() => {
                        if (lastSession?.patients?.id) navigate(`/pacientes/${lastSession.patients.id}`);
                      }}
                      className="h-12 w-full rounded-xl bg-foreground text-[10px] font-bold uppercase tracking-widest text-background shadow-lg transition-all hover:bg-foreground/90 active:scale-95"
                    >
                      Ver Detalhes do Prontuario
                    </Button>
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          <div className="space-y-6 px-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20">
                Gestao de Sessoes
              </h3>
              <div className="flex shrink-0 rounded-xl border border-border/10 bg-foreground/[0.04] p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setViewMode("upcoming")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-all",
                    viewMode === "upcoming" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  Proximas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("history")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-all",
                    viewMode === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  Historico
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                [...Array(3)].map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[28px] border border-border/10 bg-foreground/[0.02]"
                  />
                ))
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {currentList.map((appointment) => (
                      <div key={appointment.id} className="group relative">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-[28px] border border-border/30 bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98]"
                          onClick={() => handleStartSession(appointment)}
                        >
                          <div className="flex min-w-[55px] flex-col items-center justify-center space-y-1">
                            <span className="text-[16px] font-black text-foreground">
                              {format(new Date(appointment.start_time), "HH:mm")}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                              {format(new Date(appointment.start_time), "dd MMM", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="h-10 w-px shrink-0 bg-border/20" />

                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-[14px] font-bold text-foreground">
                              {appointment.patient_name || "Paciente"}
                            </h4>
                            <div className="mt-1 flex items-center gap-2">
                              <div
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  appointment.type === "online" ? "bg-indigo-400" : "bg-orange-400",
                                )}
                              />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                {appointment.type === "online" ? "Online" : "Presencial"}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {viewMode === "upcoming" ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setReminderAppointment(appointment);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setReminderAppointment(appointment);
                                }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-emerald-500/5 text-emerald-600 shadow-inner transition-all hover:bg-emerald-500/10"
                                aria-label="Enviar lembrete"
                              >
                                <Send className="h-4 w-4" />
                              </span>
                            ) : null}
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-border/10 bg-foreground/[0.03] transition-all group-active:bg-foreground group-active:text-background">
                              {viewMode === "upcoming" ? (
                                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                          </div>
                        </button>
                      </div>
                    ))}

                    {currentList.length === 0 ? (
                      <div className="rounded-[32px] border border-dashed border-border/30 bg-foreground/[0.01] py-16 text-center">
                        <Clock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20">
                          Nenhum agendamento encontrado
                        </p>
                      </div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>

      <SessionReminderDrawer
        isOpen={Boolean(reminderAppointment)}
        onOpenChange={(open) => {
          if (!open) setReminderAppointment(null);
        }}
        appointment={reminderAppointment}
      />
    </MobileLayout>
  );
};

export default MobileTeleconsulta;
