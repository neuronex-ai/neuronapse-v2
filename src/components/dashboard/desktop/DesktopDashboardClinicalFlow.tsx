"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  FolderClock,
  Mic,
  NotebookTabs,
  Send,
  Sparkles,
  Stethoscope,
  Users,
  Video,
  WalletCards,
} from "lucide-react";
import {
  type ElementType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DesktopWorkspaceIcon, DesktopWorkspaceShell } from "@/components/ui/desktop-workspace";
import { useSubscription } from "@/context/SubscriptionContext";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { useDashboardManagerialMetrics } from "@/hooks/use-dashboard-managerial-metrics";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeuroFinanceBalanceSnapshot } from "@/hooks/use-neurofinance-balance";
import { useNotifications } from "@/hooks/use-notifications";
import { usePendingPatientsCount } from "@/hooks/use-pending-patients-count";
import { useProfessionalWaitlist } from "@/hooks/use-professional-waitlist";
import { useProfile } from "@/hooks/use-profile";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

import { DashboardSynapseVoiceOverlay } from "./DashboardSynapseVoiceOverlay";
import {
  buildDashboardSynapseSuggestions,
  getDashboardAppointmentMode,
  getDashboardAppointmentState,
  getDashboardUpcomingAppointments,
} from "./dashboard-clinical-flow-model";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const rowClass =
  "group flex w-full items-center gap-3 rounded-[16px] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.04] motion-reduce:transition-none";

const getFirstName = (profile: ReturnType<typeof useProfile>["data"]) => {
  const value = profile?.first_name || profile?.full_name || profile?.name || "";
  return value.trim().split(/\s+/)[0] || "profissional";
};

const appointmentTitle = (appointment: Appointment) =>
  appointment.patient_name?.trim() || (appointment.type === "block" ? "Bloqueio de agenda" : "Paciente");

const isCancelled = (appointment: Appointment) =>
  Boolean(appointment.archived_at) ||
  appointment.visibility_status === "archived" ||
  String(appointment.lifecycle_status || appointment.status || "").toLowerCase().includes("cancel");

const safeRoute = (value: string | null, fallback: string) =>
  value?.startsWith("/") ? value : fallback;

type GroupProps = {
  icon: ElementType<{ className?: string }>;
  title: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

const Group = ({ icon, title, detail, action, className, children }: GroupProps) => (
  <section className={cn("min-w-0 py-4", className)}>
    <div className="mb-3 flex items-center gap-2.5 px-1">
      <DesktopWorkspaceIcon icon={icon} className="h-8 w-8 rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[11px] font-black uppercase tracking-[0.14em]">{title}</h2>
        {detail ? <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{detail}</p> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const LoadingRows = ({ count = 3 }: { count?: number }) => (
  <div role="status" aria-label="Carregando contexto" className="space-y-1.5 px-1">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="h-10 animate-pulse rounded-[14px] bg-muted/35 motion-reduce:animate-none" />
    ))}
  </div>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-3 text-xs font-medium leading-relaxed text-muted-foreground">{children}</p>
);

const MiniAction = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-full border border-foreground/[0.08] bg-background/48 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-muted-foreground transition hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.025] motion-reduce:transition-none"
  >
    {label}
  </button>
);

const TinySegments = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => (
  <div className="flex rounded-full border border-foreground/[0.08] bg-background/42 p-0.5 dark:border-white/[0.055]">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={cn(
          "rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em] text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          value === option.value && "bg-foreground text-background",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const DesktopDashboardClinicalFlow = () => {
  const navigate = useNavigate();
  const { features } = useSubscription();
  const { data: profile } = useProfile();
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");
  const [agendaView, setAgendaView] = useState<"today" | "week">("today");
  const [financeView, setFinanceView] = useState<"management" | "neurofinance">("management");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voicePrompt, setVoicePrompt] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const range = useMemo(
    () => ({ start: startOfDay(now), end: endOfDay(addDays(now, 7)) }),
    [now],
  );

  const {
    data: appointmentData = [],
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useAppointmentsByDateRange(range.start, range.end);
  const { notifications, isLoading: notificationsLoading } = useNotifications({
    enableRealtime: true,
    syncBadge: false,
  });
  const { data: waitlist = [], isLoading: waitlistLoading } = useProfessionalWaitlist();
  const { data: pendingPatientsRaw = 0, isLoading: pendingPatientsLoading } = usePendingPatientsCount();
  const {
    data: managerial,
    isLoading: managerialLoading,
    isError: managerialError,
  } = useDashboardManagerialMetrics();
  const { isConnected: financialConnected, isLoading: financialAccountLoading } = useFinancialAccount();
  const {
    data: neuroBalance,
    isLoading: neuroLoading,
    isError: neuroError,
  } = useNeuroFinanceBalanceSnapshot(features.hasAdvancedFinance);

  const appointments = useMemo(
    () =>
      (appointmentData as Appointment[])
        .filter((appointment) => !isCancelled(appointment))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [appointmentData],
  );
  const upcoming = useMemo(() => getDashboardUpcomingAppointments(appointments, now), [appointments, now]);
  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => isSameDay(new Date(appointment.start_time), now)),
    [appointments, now],
  );
  const activeWaitlist = useMemo(
    () => waitlist.filter((entry) => entry.status === "active" || entry.status === "offered"),
    [waitlist],
  );
  const pendingPatients = Number(pendingPatientsRaw || 0);
  const agendaItems = agendaView === "today" ? todayAppointments : appointments;

  const expandedAppointment = appointments.find((appointment) => appointment.id === expandedId) || null;
  const prepAppointment = expandedAppointment || upcoming[0] || null;
  const prepPatientId = prepAppointment?.patient_id || "";
  const { data: prepNotes = [], isLoading: prepLoading } = useSessionNotes(prepPatientId, { limit: 1 });
  const latestPrepNote = prepNotes[0];

  const records = useMemo(
    () => notifications.filter((item) => item.category === "prontuario").slice(0, 3),
    [notifications],
  );
  const teleSignals = useMemo(
    () => notifications.filter((item) => item.category === "teleconsulta").slice(0, 2),
    [notifications],
  );
  const driveSignals = useMemo(
    () =>
      notifications
        .filter(
          (item) =>
            item.category === "neurodrive" ||
            /neurobox|neurovision|neurotime|neuropulse/i.test(`${item.title} ${item.message} ${item.type}`),
        )
        .slice(0, 3),
    [notifications],
  );

  const suggestions = useMemo(
    () =>
      buildDashboardSynapseSuggestions({
        now,
        appointments,
        notifications: notifications.map((item) => ({
          id: item.id,
          category: item.category,
          severity: item.severity,
          title: item.title,
          message: item.message,
          isRead: item.isRead,
        })),
        waitlistCount: activeWaitlist.length,
        pendingPatients,
        receivable: managerial?.receivable || 0,
        neurofinancePending: neuroBalance?.pending || 0,
      }),
    [activeWaitlist.length, appointments, managerial?.receivable, neuroBalance?.pending, notifications, now, pendingPatients],
  );

  const contextSignals = useMemo(() => {
    const items: Array<{ id: string; icon: ElementType<{ className?: string }>; text: string }> = [];
    if (upcoming[0]) {
      items.push({
        id: "next",
        icon: Clock3,
        text: `${appointmentTitle(upcoming[0])} é o próximo compromisso, às ${format(new Date(upcoming[0].start_time), "HH:mm")}.`,
      });
    }
    const unread = notifications.filter(
      (item) => !item.isRead && ["prontuario", "agenda", "financeiro", "teleconsulta"].includes(item.category),
    ).length;
    if (unread) {
      items.push({
        id: "updates",
        icon: CircleAlert,
        text: `${unread} atualização${unread === 1 ? "" : "ões"} recente${unread === 1 ? "" : "s"} pode${unread === 1 ? "" : "m"} exigir sua revisão.`,
      });
    }
    if ((managerial?.receivable || 0) > 0) {
      items.push({
        id: "receivable",
        icon: WalletCards,
        text: `${money.format(managerial?.receivable || 0)} aparece como valor a receber no mês.`,
      });
    }
    if (activeWaitlist.length) {
      items.push({
        id: "waitlist",
        icon: Users,
        text: `${activeWaitlist.length} pessoa${activeWaitlist.length === 1 ? "" : "s"} segue${activeWaitlist.length === 1 ? "" : "m"} ativa${activeWaitlist.length === 1 ? "" : "s"} na lista de espera.`,
      });
    }
    return items.slice(0, 3);
  }, [activeWaitlist.length, managerial?.receivable, notifications, upcoming]);

  const sendToSynapse = (prompt: string) => {
    const text = prompt.trim();
    if (text) navigate(`/synapse-ai?q=${encodeURIComponent(text)}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sendToSynapse(draft);
  };

  const openVoice = (prompt?: string) => {
    const text = prompt?.trim() || draft.trim() || suggestions[0]?.prompt || "";
    setVoicePrompt(text);
    setVoiceOpen(true);
  };

  return (
    <>
      <div className="desktop-lumen-page desktop-content-offset relative min-h-screen w-full bg-transparent pb-24 font-sans text-foreground selection:bg-primary/10 selection:text-primary">
        <main className="page-spacing relative z-10 w-full px-6 md:px-8 lg:px-12 xl:px-16">
          <DesktopWorkspaceShell className="p-0 md:p-0">
            <div className="relative overflow-hidden rounded-[39px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,hsl(var(--foreground)/0.035),transparent_34%)] dark:bg-[radial-gradient(circle_at_50%_16%,hsl(var(--foreground)/0.07),transparent_36%)]" />

              <header className="relative z-10 flex items-center justify-between gap-5 border-b border-foreground/[0.07] px-5 py-4 dark:border-white/[0.05] lg:px-7">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">
                    {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold tracking-[-0.02em]">
                    Seu dia clínico, {getFirstName(profile)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/55" />
                  Contexto vivo
                </div>
              </header>

              <div className="relative z-10 grid min-h-[690px] xl:grid-cols-[minmax(15rem,0.78fr)_minmax(34rem,1.55fr)_minmax(15rem,0.82fr)]">
                <aside className="min-w-0 border-b border-foreground/[0.07] px-4 xl:border-b-0 xl:border-r dark:border-white/[0.05] lg:px-5">
                  <Group
                    icon={CalendarDays}
                    title="Agenda"
                    detail={`${todayAppointments.length} hoje · ${appointments.length} em 7 dias`}
                    action={
                      <TinySegments
                        value={agendaView}
                        onChange={setAgendaView}
                        options={[{ value: "today", label: "Hoje" }, { value: "week", label: "7d" }]}
                      />
                    }
                  >
                    {appointmentsLoading ? (
                      <LoadingRows />
                    ) : appointmentsError ? (
                      <Empty>Não consegui carregar a agenda agora.</Empty>
                    ) : agendaItems.length ? (
                      <div className="space-y-0.5">
                        {agendaItems.slice(0, 4).map((appointment) => {
                          const state = getDashboardAppointmentState(appointment, now);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => setExpandedId((current) => current === appointment.id ? null : appointment.id)}
                              aria-expanded={expandedId === appointment.id}
                              className={rowClass}
                            >
                              <span className="w-11 shrink-0 text-[11px] font-black tabular-nums">
                                {format(new Date(appointment.start_time), "HH:mm")}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold">{appointmentTitle(appointment)}</span>
                                <span className={cn(
                                  "mt-0.5 block text-[10px]",
                                  state === "A pontuar" ? "text-destructive" : "text-muted-foreground",
                                )}>
                                  {getDashboardAppointmentMode(appointment)} · {state}
                                </span>
                              </span>
                              <ChevronDown className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform motion-reduce:transition-none",
                                expandedId === appointment.id && "rotate-180",
                              )} />
                            </button>
                          );
                        })}
                        {agendaItems.length > 4 ? (
                          <button type="button" onClick={() => navigate("/agenda")} className="px-3 py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground">
                            + {agendaItems.length - 4} na agenda
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <Empty>Nenhum compromisso neste período.</Empty>
                    )}
                    <div className="mt-2 flex items-center justify-between border-t border-foreground/[0.06] px-2 pt-3 dark:border-white/[0.045]">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {waitlistLoading ? "Lista de espera…" : `${activeWaitlist.length} na lista de espera`}
                      </span>
                      <MiniAction label="Abrir" onClick={() => navigate("/agenda")} />
                    </div>
                  </Group>

                  <Group
                    icon={Video}
                    title="Teleconsultas"
                    detail="online, presencial e registro externo"
                    className="border-t border-foreground/[0.07] dark:border-white/[0.05]"
                  >
                    {appointmentsLoading ? <LoadingRows count={2} /> : (
                      <>
                        {upcoming.filter((item) => item.type !== "block").slice(0, 2).map((appointment) => (
                          <button
                            key={appointment.id}
                            type="button"
                            onClick={() =>
                              appointment.type === "online" && features.hasTelemedicine
                                ? navigate("/teleconsulta", { state: { activeAppointmentId: appointment.id } })
                                : setExpandedId(appointment.id)
                            }
                            className={rowClass}
                          >
                            {appointment.type === "online"
                              ? <Video className="h-3.5 w-3.5 text-muted-foreground" />
                              : <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold">{appointmentTitle(appointment)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {getDashboardAppointmentMode(appointment)} · {format(new Date(appointment.start_time), "EEE HH:mm", { locale: ptBR })}
                              </span>
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))}
                        {teleSignals.map((notice) => (
                          <button key={notice.id} type="button" onClick={() => navigate(safeRoute(notice.actionUrl, "/teleconsulta"))} className={rowClass}>
                            <CircleAlert className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{notice.title}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))}
                        <div className="px-2 pt-2">
                          <MiniAction label="Registrar externa" onClick={() => navigate("/agenda")} />
                        </div>
                      </>
                    )}
                  </Group>
                </aside>

                <section className="relative flex min-w-0 flex-col justify-center px-5 py-8 sm:px-8 lg:px-10 xl:px-12">
                  <div className="mx-auto w-full max-w-[760px]">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.09] bg-background/58 shadow-sm backdrop-blur-2xl dark:border-white/[0.06] dark:bg-white/[0.035]">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Synapse</p>
                        <h1 className="mt-0.5 text-xl font-black tracking-[-0.045em] sm:text-2xl">Converse com a sua clínica.</h1>
                      </div>
                    </div>

                    <form
                      onSubmit={submit}
                      className="rounded-[28px] border border-foreground/[0.09] bg-background/48 p-2.5 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)] backdrop-blur-2xl transition focus-within:border-foreground/[0.16] focus-within:bg-background/64 dark:border-white/[0.06] dark:bg-white/[0.03] motion-reduce:transition-none"
                    >
                      <label htmlFor="dashboard-synapse-input" className="sr-only">Pergunte ao Synapse</label>
                      <textarea
                        id="dashboard-synapse-input"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendToSynapse(draft);
                          }
                        }}
                        rows={3}
                        placeholder="Pergunte sobre sua próxima sessão, agenda, prontuários ou financeiro…"
                        className="min-h-[88px] w-full resize-none bg-transparent px-3 py-2 text-[15px] font-medium leading-relaxed outline-none placeholder:text-muted-foreground/60"
                      />
                      <div className="flex items-center justify-between gap-3 px-1 pb-1">
                        <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">O Synapse organiza. Você decide e confirma.</p>
                        <div className="ml-auto flex gap-1.5">
                          <button type="button" onClick={() => openVoice()} aria-label="Iniciar conversa por voz" className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.09] bg-background/58 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.06] dark:bg-white/[0.035]">
                            <Mic className="h-4 w-4" />
                          </button>
                          <button type="submit" disabled={!draft.trim()} aria-label="Enviar ao Synapse" className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35">
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-label="Sugestões contextuais do Synapse">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => sendToSynapse(suggestion.prompt)}
                          className="min-w-0 rounded-[18px] border border-foreground/[0.08] bg-background/42 px-3.5 py-3 text-left shadow-[inset_0_1px_0_hsl(var(--background)/0.68)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.025] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                        >
                          <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">{suggestion.reason}</span>
                          <span className="mt-1 block truncate text-xs font-bold">{suggestion.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 min-h-[150px] rounded-[22px] border border-foreground/[0.07] bg-background/24 p-4 dark:border-white/[0.045] dark:bg-white/[0.015]">
                      {expandedAppointment ? (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Preparo integrado</p>
                              <h2 className="mt-1 truncate text-sm font-black">{appointmentTitle(expandedAppointment)}</h2>
                            </div>
                            <button type="button" onClick={() => setExpandedId(null)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Fechar</button>
                          </div>
                          {prepLoading ? <div className="mt-4"><LoadingRows count={2} /></div> : (
                            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="min-w-0">
                                <p className="line-clamp-3 text-xs font-medium leading-relaxed text-muted-foreground">
                                  {latestPrepNote?.ai_summary?.summary || latestPrepNote?.notes || "Ainda não há resumo recente confirmado para este contexto."}
                                </p>
                                {latestPrepNote?.ai_summary?.topics?.length ? (
                                  <p className="mt-2 truncate text-[10px] font-semibold text-foreground/75">
                                    Tópicos: {latestPrepNote.ai_summary.topics.slice(0, 3).join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-start gap-2">
                                {expandedAppointment.patient_id ? <MiniAction label="Ficha" onClick={() => navigate(`/pacientes/${expandedAppointment.patient_id}`)} /> : null}
                                <MiniAction
                                  label="Preparar"
                                  onClick={() => sendToSynapse(`Prepare a sessão com ${appointmentTitle(expandedAppointment)} usando apenas o contexto autorizado e destaque o que eu deveria revisar antes do atendimento.`)}
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex min-h-[116px] items-center">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Preparo sob demanda</p>
                            <p className="mt-2 max-w-lg text-xs font-medium leading-relaxed text-muted-foreground">
                              Expanda um compromisso na agenda para trazer o último resumo, tópicos e ações para esta mesma superfície.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <aside className="min-w-0 border-t border-foreground/[0.07] px-4 xl:border-l xl:border-t-0 dark:border-white/[0.05] lg:px-5">
                  <Group icon={Users} title="Pacientes e prontuários" detail={`${pendingPatients} cadastro${pendingPatients === 1 ? "" : "s"} em atenção`}>
                    {pendingPatientsLoading || notificationsLoading ? <LoadingRows /> : (
                      <>
                        {pendingPatients ? (
                          <button type="button" onClick={() => navigate("/pacientes")} className={rowClass}>
                            <CircleAlert className="h-3.5 w-3.5 text-destructive" />
                            <span className="min-w-0 flex-1 text-xs font-semibold">{pendingPatients} cadastro{pendingPatients === 1 ? "" : "s"} pede{pendingPatients === 1 ? "" : "m"} revisão</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ) : null}
                        {records.map((notice) => (
                          <button key={notice.id} type="button" onClick={() => navigate(safeRoute(notice.actionUrl, "/pacientes"))} className={rowClass}>
                            {notice.severity === "warning" || notice.severity === "destructive"
                              ? <CircleAlert className="h-3.5 w-3.5 text-destructive" />
                              : <FileCheck2 className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold">{notice.title}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{notice.message}</span>
                            </span>
                          </button>
                        ))}
                        {!pendingPatients && !records.length ? <Empty>Nenhuma revisão em destaque.</Empty> : null}
                      </>
                    )}
                  </Group>

                  <Group
                    icon={WalletCards}
                    title="Financeiro"
                    detail={financialConnected ? "conta conectada" : "gestão financeira"}
                    className="border-t border-foreground/[0.07] dark:border-white/[0.05]"
                    action={features.hasAdvancedFinance ? (
                      <TinySegments
                        value={financeView}
                        onChange={setFinanceView}
                        options={[{ value: "management", label: "Gestão" }, { value: "neurofinance", label: "Neuro" }]}
                      />
                    ) : null}
                  >
                    {financialAccountLoading || (financeView === "management" ? managerialLoading : neuroLoading) ? (
                      <LoadingRows />
                    ) : financeView === "neurofinance" && features.hasAdvancedFinance ? (
                      neuroError ? <Empty>Snapshot do NeuroFinance indisponível agora.</Empty> : (
                        <>
                          <div className={rowClass}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1 text-xs font-semibold">Saldo disponível</span>
                            <strong className="text-xs tabular-nums">{money.format(neuroBalance?.balance || 0)}</strong>
                          </div>
                          <div className={rowClass}>
                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1 text-xs font-semibold">Em processamento</span>
                            <strong className="text-xs tabular-nums">{money.format(neuroBalance?.pending || 0)}</strong>
                          </div>
                          <button type="button" onClick={() => navigate("/financeiro")} className={rowClass}>
                            <WalletCards className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1 text-xs font-semibold">Abrir NeuroFinance</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </>
                      )
                    ) : managerialError ? <Empty>Sinais financeiros indisponíveis agora.</Empty> : (
                      <>
                        <div className={rowClass}>
                          <WalletCards className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Pessoal · separado</span><span className="text-[10px] text-muted-foreground">Não misturado com a clínica</span></span>
                          <strong className="text-xs">—</strong>
                        </div>
                        <div className={rowClass}>
                          <WalletCards className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Clínica · resultado</span><span className="text-[10px] text-muted-foreground">Mês atual</span></span>
                          <strong className="text-xs tabular-nums">{money.format(managerial?.result || 0)}</strong>
                        </div>
                        <div className={rowClass}>
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Pacientes · a receber</span><span className="text-[10px] text-muted-foreground">Escopo geral</span></span>
                          <strong className="text-xs tabular-nums">{money.format(managerial?.receivable || 0)}</strong>
                        </div>
                        {prepAppointment?.patient_id ? (
                          <button type="button" onClick={() => navigate(`/pacientes/${prepAppointment.patient_id}`)} className={rowClass}>
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{appointmentTitle(prepAppointment)}</span><span className="text-[10px] text-muted-foreground">{prepAppointment.payment_status || "sem sinal financeiro"}</span></span>
                            <strong className="text-xs tabular-nums">{prepAppointment.price ? money.format(prepAppointment.price) : "—"}</strong>
                          </button>
                        ) : null}
                      </>
                    )}
                  </Group>
                </aside>
              </div>

              <footer className="relative z-10 grid border-t border-foreground/[0.07] dark:border-white/[0.05] lg:grid-cols-2">
                <Group icon={NotebookTabs} title="Notas e NeuroDrive" detail="contexto recente, sem ruído" className="px-4 lg:border-r lg:border-foreground/[0.07] lg:px-6 dark:lg:border-white/[0.05]">
                  <div className="grid gap-1 sm:grid-cols-2">
                    {latestPrepNote ? (
                      <button type="button" onClick={() => prepPatientId ? navigate(`/pacientes/${prepPatientId}`) : navigate("/notas")} className={rowClass}>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">Nota recente · {prepAppointment ? appointmentTitle(prepAppointment) : "contexto"}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{latestPrepNote.ai_summary?.summary || latestPrepNote.notes}</span></span>
                      </button>
                    ) : null}
                    {driveSignals.slice(0, 2).map((notice) => (
                      <button key={notice.id} type="button" onClick={() => navigate(safeRoute(notice.actionUrl, "/notas"))} className={rowClass}>
                        <FolderClock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{notice.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{notice.message}</span></span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                    {!latestPrepNote && !driveSignals.length ? <Empty>Nenhuma nota ou conexão nova em destaque.</Empty> : null}
                  </div>
                </Group>

                <Group icon={Sparkles} title="Synapse organizou" detail="leitura operacional do contexto atual" className="px-4 lg:px-6">
                  {contextSignals.length ? contextSignals.map(({ id, icon: Icon, text }) => (
                    <div key={id} className={rowClass}>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-foreground/75">{text}</p>
                    </div>
                  )) : <Empty>Nada urgente apareceu. O Synapse continua organizando o contexto sem decidir por você.</Empty>}
                </Group>
              </footer>
            </div>
          </DesktopWorkspaceShell>
        </main>
      </div>

      <DashboardSynapseVoiceOverlay
        isOpen={voiceOpen}
        initialPrompt={voicePrompt}
        onClose={() => setVoiceOpen(false)}
      />
    </>
  );
};

export default DesktopDashboardClinicalFlow;
