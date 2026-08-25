"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
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

import { DesktopWorkspaceShell } from "@/components/ui/desktop-workspace";
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

type OverviewItemProps = {
  icon: ElementType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  onClick?: () => void;
};

const OverviewItem = ({ icon: Icon, label, value, detail, onClick }: OverviewItemProps) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("dashboard-v3-overview-item", onClick && "dashboard-v3-overview-action")}
    >
      <span className="dashboard-v3-overview-icon"><Icon /></span>
      <span className="min-w-0">
        <span className="dashboard-v3-overview-label">{label}</span>
        <span className="dashboard-v3-overview-value">{value}</span>
        {detail ? <span className="dashboard-v3-overview-detail">{detail}</span> : null}
      </span>
    </Tag>
  );
};

const LoadingLine = () => <div className="dashboard-v3-loading-line" aria-hidden="true" />;

const SectionTitle = ({ icon: Icon, eyebrow, title, action }: {
  icon: ElementType<{ className?: string }>;
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) => (
  <div className="dashboard-v3-section-title">
    <span className="dashboard-v3-section-icon"><Icon /></span>
    <div className="min-w-0 flex-1">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </div>
    {action}
  </div>
);

export const DesktopDashboardClinicalFlowV3 = () => {
  const navigate = useNavigate();
  const { features } = useSubscription();
  const { data: profile } = useProfile();
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");
  const [agendaView, setAgendaView] = useState<"today" | "week">("today");
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
  const { isConnected: financialConnected } = useFinancialAccount();
  const {
    data: neuroBalance,
    isLoading: neuroLoading,
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
  const nextAppointment = upcoming[0] || null;
  const expandedAppointment = appointments.find((appointment) => appointment.id === expandedId) || null;
  const prepAppointment = expandedAppointment || nextAppointment;
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
    () => notifications.filter((item) =>
      item.category === "neurodrive" || /neurobox|neurovision|neurotime|neuropulse/i.test(`${item.title} ${item.message} ${item.type}`),
    ).slice(0, 2),
    [notifications],
  );
  const attentionNotifications = useMemo(
    () => notifications.filter((item) =>
      !item.isRead && ["prontuario", "agenda", "financeiro", "teleconsulta"].includes(item.category),
    ),
    [notifications],
  );

  const suggestions = useMemo(
    () => buildDashboardSynapseSuggestions({
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
    if (nextAppointment) {
      items.push({
        id: "next",
        icon: Clock3,
        text: `${appointmentTitle(nextAppointment)} é o próximo compromisso, às ${format(new Date(nextAppointment.start_time), "HH:mm")}.`,
      });
    }
    if (attentionNotifications.length) {
      items.push({
        id: "attention",
        icon: CircleAlert,
        text: `${attentionNotifications.length} atualização${attentionNotifications.length === 1 ? "" : "ões"} recente${attentionNotifications.length === 1 ? "" : "s"} pode${attentionNotifications.length === 1 ? "" : "m"} exigir sua revisão.`,
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
        text: `${activeWaitlist.length} pessoa${activeWaitlist.length === 1 ? "" : "s"} segue${activeWaitlist.length === 1 ? "" : "m"} na lista de espera.`,
      });
    }
    return items.slice(0, 3);
  }, [activeWaitlist.length, attentionNotifications.length, managerial?.receivable, nextAppointment]);

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

  const nextState = nextAppointment ? getDashboardAppointmentState(nextAppointment, now) : null;
  const nextMode = nextAppointment ? getDashboardAppointmentMode(nextAppointment) : null;
  const primaryRecord = records[0] || teleSignals[0] || null;

  return (
    <>
      <div className="dashboard-v3-page desktop-lumen-page desktop-content-offset">
        <main className="dashboard-v3-page-inner">
          <DesktopWorkspaceShell className="dashboard-v3-shell p-0 md:p-0">
            <div className="dashboard-v3-stage">
              <header className="dashboard-v3-header">
                <div className="dashboard-v3-greeting">
                  <p>{format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                  <h1>Seu dia clínico, {getFirstName(profile)}</h1>
                </div>
                <div className="dashboard-v3-live"><span /> Contexto vivo</div>
              </header>

              <div className="dashboard-v3-overview" aria-label="Resumo do consultório">
                <OverviewItem
                  icon={CalendarDays}
                  label="Hoje"
                  value={appointmentsLoading ? "…" : `${todayAppointments.length} sessão${todayAppointments.length === 1 ? "" : "ões"}`}
                  detail={`${appointments.length} nos próximos 7 dias`}
                  onClick={() => navigate("/agenda")}
                />
                <OverviewItem
                  icon={Clock3}
                  label="Próximo"
                  value={nextAppointment ? `${format(new Date(nextAppointment.start_time), "HH:mm")} · ${appointmentTitle(nextAppointment)}` : "Janela livre"}
                  detail={nextAppointment ? `${nextMode} · ${nextState}` : "Nenhum compromisso próximo"}
                  onClick={() => nextAppointment ? setExpandedId(nextAppointment.id) : navigate("/agenda")}
                />
                <OverviewItem
                  icon={CircleAlert}
                  label="Atenção"
                  value={notificationsLoading || pendingPatientsLoading ? "…" : `${attentionNotifications.length + pendingPatients} item${attentionNotifications.length + pendingPatients === 1 ? "" : "s"}`}
                  detail={primaryRecord?.title || "Nenhuma revisão crítica em destaque"}
                  onClick={() => navigate("/pacientes")}
                />
                <OverviewItem
                  icon={WalletCards}
                  label="A receber"
                  value={managerialLoading ? "…" : money.format(managerial?.receivable || 0)}
                  detail={financialConnected ? "NeuroFinance conectado" : "Gestão financeira"}
                  onClick={() => navigate("/financeiro")}
                />
              </div>

              <div className="dashboard-v3-clinical-scene">
                <aside className="dashboard-v3-day-rail" aria-label="Fluxo do dia">
                  <SectionTitle
                    icon={CalendarDays}
                    eyebrow="Fluxo do dia"
                    title="Agenda clínica"
                    action={
                      <div className="dashboard-v3-segmented" role="group" aria-label="Período da agenda">
                        <button type="button" data-active={agendaView === "today"} onClick={() => setAgendaView("today")}>Hoje</button>
                        <button type="button" data-active={agendaView === "week"} onClick={() => setAgendaView("week")}>7d</button>
                      </div>
                    }
                  />

                  <div className="dashboard-v3-timeline">
                    {appointmentsLoading ? (
                      <><LoadingLine /><LoadingLine /><LoadingLine /></>
                    ) : appointmentsError ? (
                      <p className="dashboard-v3-empty">Agenda indisponível agora.</p>
                    ) : agendaItems.length ? (
                      agendaItems.slice(0, 4).map((appointment, index) => {
                        const state = getDashboardAppointmentState(appointment, now);
                        return (
                          <button
                            type="button"
                            key={appointment.id}
                            className="dashboard-v3-timeline-row"
                            data-active={expandedId === appointment.id}
                            onClick={() => setExpandedId((current) => current === appointment.id ? null : appointment.id)}
                          >
                            <span className="dashboard-v3-time">{format(new Date(appointment.start_time), "HH:mm")}</span>
                            <span className="dashboard-v3-timeline-node" data-first={index === 0} />
                            <span className="dashboard-v3-timeline-copy">
                              <b>{appointmentTitle(appointment)}</b>
                              <small>{getDashboardAppointmentMode(appointment)} · {state}</small>
                            </span>
                            <ArrowRight />
                          </button>
                        );
                      })
                    ) : (
                      <div className="dashboard-v3-free-window">
                        <span className="dashboard-v3-free-orb"><Clock3 /></span>
                        <div><b>Janela livre</b><p>Nenhum compromisso neste período.</p></div>
                      </div>
                    )}
                  </div>

                  <button type="button" className="dashboard-v3-inline-link" onClick={() => navigate("/agenda")}> 
                    <span>{waitlistLoading ? "Lista de espera…" : `${activeWaitlist.length} na lista de espera`}</span><ArrowRight />
                  </button>

                  <div className="dashboard-v3-rail-divider" />

                  <SectionTitle icon={Video} eyebrow="Atendimento" title="Teleconsultas" />
                  <div className="dashboard-v3-tele-line">
                    {upcoming.filter((item) => item.type !== "block").slice(0, 1).map((appointment) => (
                      <button
                        type="button"
                        key={appointment.id}
                        onClick={() => appointment.type === "online" && features.hasTelemedicine
                          ? navigate("/teleconsulta", { state: { activeAppointmentId: appointment.id } })
                          : setExpandedId(appointment.id)}
                      >
                        <span>{appointment.type === "online" ? <Video /> : <Stethoscope />}</span>
                        <div><b>{appointmentTitle(appointment)}</b><small>{getDashboardAppointmentMode(appointment)} · {format(new Date(appointment.start_time), "EEE HH:mm", { locale: ptBR })}</small></div>
                        <ArrowRight />
                      </button>
                    ))}
                    {!upcoming.filter((item) => item.type !== "block").length ? <p className="dashboard-v3-empty">Nenhum atendimento próximo.</p> : null}
                  </div>
                </aside>

                <section className="dashboard-v3-synapse" aria-label="Synapse">
                  <div className="dashboard-v3-synapse-field" />
                  <div className="dashboard-v3-synapse-content">
                    <div className="dashboard-v3-synapse-title">
                      <span><Sparkles /></span>
                      <div>
                        <p>Synapse</p>
                        <h2>Converse com a sua clínica.</h2>
                        <small>Agenda, prontuários, notas e financeiro no mesmo contexto.</small>
                      </div>
                    </div>

                    <form onSubmit={submit} className="dashboard-v3-composer">
                      <label htmlFor="dashboard-v3-input" className="sr-only">Pergunte ao Synapse</label>
                      <textarea
                        id="dashboard-v3-input"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendToSynapse(draft);
                          }
                        }}
                        rows={4}
                        placeholder="Pergunte sobre sua próxima sessão, agenda, prontuários, notas ou financeiro…"
                      />
                      <div className="dashboard-v3-composer-footer">
                        <p>O Synapse organiza. Você decide e confirma.</p>
                        <div>
                          <button type="button" onClick={() => openVoice()} aria-label="Iniciar conversa por voz"><Mic /></button>
                          <button type="submit" disabled={!draft.trim()} aria-label="Enviar ao Synapse"><Send /></button>
                        </div>
                      </div>
                    </form>

                    <div className="dashboard-v3-suggestions" aria-label="Sugestões contextuais">
                      {suggestions.map((suggestion, index) => (
                        <button key={suggestion.id} type="button" onClick={() => sendToSynapse(suggestion.prompt)}>
                          <span>0{index + 1}</span>
                          <div><small>{suggestion.reason}</small><b>{suggestion.label}</b></div>
                          <ArrowRight />
                        </button>
                      ))}
                    </div>

                    <div className="dashboard-v3-focus-strip" data-expanded={Boolean(expandedAppointment)}>
                      <div className="dashboard-v3-focus-label">
                        <span><FileText /></span>
                        <div><small>{expandedAppointment ? "Contexto selecionado" : "Próxima sessão"}</small><b>{prepAppointment ? appointmentTitle(prepAppointment) : "Nenhum contexto em foco"}</b></div>
                      </div>
                      <div className="dashboard-v3-focus-copy">
                        {prepLoading ? "Carregando resumo…" : (latestPrepNote?.ai_summary?.summary || latestPrepNote?.notes || (prepAppointment ? "Sem resumo recente confirmado. O Synapse pode organizar o contexto autorizado sob demanda." : "Selecione um compromisso para preparar a sessão aqui."))}
                      </div>
                      <div className="dashboard-v3-focus-actions">
                        {prepAppointment?.patient_id ? <button type="button" onClick={() => navigate(`/pacientes/${prepAppointment.patient_id}`)}>Ficha</button> : null}
                        {prepAppointment ? <button type="button" onClick={() => sendToSynapse(`Prepare a sessão com ${appointmentTitle(prepAppointment)} usando apenas o contexto autorizado e destaque o que eu deveria revisar antes do atendimento.`)}>Preparar</button> : null}
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="dashboard-v3-attention-rail" aria-label="Atenção e financeiro">
                  <SectionTitle icon={CircleAlert} eyebrow="Leitura rápida" title="Atenção agora" />
                  <div className="dashboard-v3-attention-list">
                    {notificationsLoading || pendingPatientsLoading ? (
                      <><LoadingLine /><LoadingLine /></>
                    ) : (
                      <>
                        {pendingPatients > 0 ? (
                          <button type="button" onClick={() => navigate("/pacientes")}>
                            <span className="dashboard-v3-alert-dot" />
                            <div><b>{pendingPatients} cadastro{pendingPatients === 1 ? "" : "s"} em atenção</b><small>Revisar dados antes de usar o contexto clínico.</small></div>
                            <ArrowRight />
                          </button>
                        ) : null}
                        {records.slice(0, 2).map((notice) => (
                          <button type="button" key={notice.id} onClick={() => navigate(safeRoute(notice.actionUrl, "/pacientes"))}>
                            <span className={cn("dashboard-v3-alert-dot", (notice.severity === "warning" || notice.severity === "destructive") && "is-alert")} />
                            <div><b>{notice.title}</b><small>{notice.message}</small></div>
                            <ArrowRight />
                          </button>
                        ))}
                        {!pendingPatients && !records.length ? (
                          <div className="dashboard-v3-all-clear"><CheckCircle2 /><div><b>Nada crítico agora</b><small>Prontuários e cadastros sem destaque urgente.</small></div></div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="dashboard-v3-rail-divider" />

                  <SectionTitle icon={WalletCards} eyebrow="Consultório" title="Financeiro" />
                  <div className="dashboard-v3-finance-summary">
                    <div className="dashboard-v3-finance-main">
                      <small>A receber no mês</small>
                      <strong>{managerialLoading ? "…" : money.format(managerial?.receivable || 0)}</strong>
                      <p>{managerialError ? "Sinais indisponíveis agora" : `Resultado atual: ${money.format(managerial?.result || 0)}`}</p>
                    </div>
                    <div className="dashboard-v3-finance-secondary">
                      <span><small>NeuroFinance</small><b>{neuroLoading ? "…" : financialConnected ? money.format(neuroBalance?.balance || 0) : "Não conectado"}</b></span>
                      <span><small>Processando</small><b>{neuroLoading ? "…" : money.format(neuroBalance?.pending || 0)}</b></span>
                    </div>
                  </div>
                  <button type="button" className="dashboard-v3-inline-link" onClick={() => navigate("/financeiro")}><span>Abrir visão financeira</span><ArrowRight /></button>
                </aside>
              </div>

              <footer className="dashboard-v3-context-band">
                <div className="dashboard-v3-context-section dashboard-v3-context-note">
                  <span className="dashboard-v3-context-icon"><NotebookTabs /></span>
                  <div className="min-w-0 flex-1">
                    <small>Notas e NeuroDrive</small>
                    <b>{latestPrepNote ? `Nota recente · ${prepAppointment ? appointmentTitle(prepAppointment) : "contexto"}` : driveSignals[0]?.title || "Contexto recente"}</b>
                    <p>{latestPrepNote?.ai_summary?.summary || latestPrepNote?.notes || driveSignals[0]?.message || "Nenhuma nova conexão importante em destaque."}</p>
                  </div>
                  <button type="button" onClick={() => navigate("/notas")} aria-label="Abrir Notas"><ArrowRight /></button>
                </div>

                <div className="dashboard-v3-context-section dashboard-v3-context-synapse">
                  <span className="dashboard-v3-context-icon"><Sparkles /></span>
                  <div className="min-w-0 flex-1">
                    <small>Synapse organizou</small>
                    <div className="dashboard-v3-context-signals">
                      {contextSignals.length ? contextSignals.slice(0, 2).map(({ id, icon: Icon, text }) => (
                        <span key={id}><Icon /><em>{text}</em></span>
                      )) : <p>Nada urgente apareceu. O contexto continua organizado sem decisões automáticas.</p>}
                    </div>
                  </div>
                </div>
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

export default DesktopDashboardClinicalFlowV3;
