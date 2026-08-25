"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  Mic,
  NotebookTabs,
  Send,
  Sparkles,
  Stethoscope,
  Video,
  WalletCards,
} from "lucide-react";
import {
  type ElementType,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import type { Appointment } from "@/types";
import { WebGLShader } from "@/components/ui/web-gl-shader";

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
  appointment.patient_name?.trim() || (appointment.type === "block" ? "Bloqueio" : "Paciente");

const isCancelled = (appointment: Appointment) =>
  Boolean(appointment.archived_at) ||
  appointment.visibility_status === "archived" ||
  String(appointment.lifecycle_status || appointment.status || "").toLowerCase().includes("cancel");

const WidgetIcon = ({ icon: Icon }: { icon: ElementType<{ className?: string }> }) => (
  <span className="dashboard-v4-widget-icon"><Icon className="h-4 w-4" /></span>
);

export const DesktopDashboardClinicalFlowV4 = () => {
  const navigate = useNavigate();
  const { features } = useSubscription();
  const { data: profile } = useProfile();
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");
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
  const { data: neuroBalance, isLoading: neuroLoading } = useNeuroFinanceBalanceSnapshot(features.hasAdvancedFinance);

  const appointments = useMemo(
    () =>
      (appointmentData as Appointment[])
        .filter((appointment) => !isCancelled(appointment))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [appointmentData],
  );

  const upcoming = useMemo(() => getDashboardUpcomingAppointments(appointments, now), [appointments, now]);
  const nextAppointment = upcoming[0] || null;
  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => isSameDay(new Date(appointment.start_time), now)),
    [appointments, now],
  );
  const activeWaitlist = useMemo(
    () => waitlist.filter((entry) => entry.status === "active" || entry.status === "offered"),
    [waitlist],
  );
  const pendingPatients = Number(pendingPatientsRaw || 0);
  const attentionNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead && ["prontuario", "agenda", "financeiro", "teleconsulta"].includes(item.category)),
    [notifications],
  );
  const primaryAttention = attentionNotifications[0] || null;
  const teleNext = upcoming.find((appointment) => appointment.type !== "block") || null;
  const prepPatientId = nextAppointment?.patient_id || "";
  const { data: prepNotes = [], isLoading: prepLoading } = useSessionNotes(prepPatientId, { limit: 1 });
  const latestPrepNote = prepNotes[0];

  const dayBars = useMemo(() => {
    const values = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(startOfDay(now), index);
      return {
        key: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEEE", { locale: ptBR }).toUpperCase(),
        count: appointments.filter((appointment) => isSameDay(new Date(appointment.start_time), date)).length,
      };
    });
    const max = Math.max(1, ...values.map((item) => item.count));
    return values.map((item) => ({ ...item, ratio: item.count / max }));
  }, [appointments, now]);

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
  const attentionTotal = attentionNotifications.length + pendingPatients;

  return (
    <>
      <div className="dashboard-v4-page">
        <section className="dashboard-v4-hero" aria-labelledby="dashboard-v4-title">
          <div className="dashboard-v4-hero-content">
            <div className="dashboard-v4-context-kicker">
              <span className="dashboard-v4-live-dot" />
              <span>{format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              <span className="dashboard-v4-kicker-divider" />
              <span>{getFirstName(profile)}</span>
            </div>

            <div className="dashboard-v4-mark"><Sparkles /></div>
            <p className="dashboard-v4-eyebrow">Synapse</p>
            <h1 id="dashboard-v4-title">O que precisa de você hoje?</h1>
            <p className="dashboard-v4-subtitle">Converse com o contexto autorizado da sua clínica. O Synapse organiza; você decide.</p>

            <form className="dashboard-v4-composer" onSubmit={submit}>
              <div className="dashboard-v4-composer-shader" aria-hidden="true">
                <WebGLShader />
              </div>
              <label htmlFor="dashboard-v4-input" className="sr-only">Pergunte ao Synapse</label>
              <textarea
                id="dashboard-v4-input"
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendToSynapse(draft);
                  }
                }}
                placeholder="Pergunte sobre a próxima sessão, agenda, prontuários, notas ou financeiro…"
              />
              <div className="dashboard-v4-composer-actions">
                <span>Enter para enviar · Shift + Enter para nova linha</span>
                <div>
                  <button type="button" onClick={() => openVoice()} aria-label="Iniciar conversa por voz"><Mic /></button>
                  <button type="submit" disabled={!draft.trim()} aria-label="Enviar ao Synapse"><Send /></button>
                </div>
              </div>
            </form>

            <div className="dashboard-v4-suggestions" aria-label="Sugestões contextuais do Synapse">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <button key={suggestion.id} type="button" onClick={() => sendToSynapse(suggestion.prompt)}>
                  <span className="dashboard-v4-suggestion-index">0{index + 1}</span>
                  <span className="dashboard-v4-suggestion-copy">
                    <small>{suggestion.reason}</small>
                    <b>{suggestion.label}</b>
                  </span>
                  <ArrowRight />
                </button>
              ))}
            </div>

            <a href="#dashboard-context" className="dashboard-v4-scroll-cue">
              <span>Resumo do consultório</span><ChevronDown />
            </a>
          </div>
        </section>

        <section id="dashboard-context" className="dashboard-v4-context-section">
          <header className="dashboard-v4-context-header">
            <div>
              <p>Contexto autorizado</p>
              <h2>Seu consultório em um olhar.</h2>
            </div>
            <span>Atualizado agora</span>
          </header>

          <div className="dashboard-v4-widget-grid">
            <button type="button" className="dashboard-v4-widget dashboard-v4-widget-agenda" onClick={() => navigate("/agenda")}>
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={CalendarDays} /><span>Agenda</span><ArrowRight /></div>
              <div className="dashboard-v4-agenda-body">
                <div>
                  <small>Hoje</small>
                  <strong>{appointmentsLoading ? "…" : todayAppointments.length}</strong>
                  <p>{todayAppointments.length === 1 ? "sessão" : "sessões"}</p>
                </div>
                <div className="dashboard-v4-week-bars" aria-label="Sessões nos próximos sete dias">
                  {dayBars.map((item) => (
                    <span key={item.key}>
                      <i style={{ height: `${Math.max(10, item.ratio * 100)}%` }} />
                      <small>{item.label}</small>
                    </span>
                  ))}
                </div>
              </div>
              <div className="dashboard-v4-widget-foot">
                <span>{appointmentsError ? "Agenda indisponível" : `${appointments.length} em 7 dias`}</span>
                <span>{waitlistLoading ? "…" : `${activeWaitlist.length} espera`}</span>
              </div>
            </button>

            <button
              type="button"
              className="dashboard-v4-widget dashboard-v4-widget-session"
              onClick={() => nextAppointment?.patient_id ? navigate(`/pacientes/${nextAppointment.patient_id}`) : navigate("/agenda")}
            >
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={Clock3} /><span>Próxima sessão</span><ArrowRight /></div>
              <div className="dashboard-v4-session-time">{nextAppointment ? format(new Date(nextAppointment.start_time), "HH:mm") : "—"}</div>
              <h3>{nextAppointment ? appointmentTitle(nextAppointment) : "Janela livre"}</h3>
              <div className="dashboard-v4-session-meta">
                <span>{nextMode || "Sem compromisso próximo"}</span>
                {nextState ? <span>{nextState}</span> : null}
              </div>
            </button>

            <button type="button" className="dashboard-v4-widget dashboard-v4-widget-attention" onClick={() => navigate("/pacientes")}>
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={CircleAlert} /><span>Atenção</span><ArrowRight /></div>
              <div className="dashboard-v4-attention-count">{notificationsLoading || pendingPatientsLoading ? "…" : attentionTotal}</div>
              <p>{attentionTotal === 1 ? "item para revisar" : "itens para revisar"}</p>
              <div className="dashboard-v4-attention-dots" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => <span key={index} data-active={index < Math.min(5, attentionTotal)} />)}
              </div>
              <small>{primaryAttention?.title || "Nada crítico em destaque"}</small>
            </button>

            <button type="button" className="dashboard-v4-widget dashboard-v4-widget-finance" onClick={() => navigate("/financeiro")}>
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={WalletCards} /><span>Financeiro</span><ArrowRight /></div>
              <small>A receber</small>
              <strong>{managerialLoading ? "…" : money.format(managerial?.receivable || 0)}</strong>
              <div className="dashboard-v4-finance-split">
                <span><small>Resultado</small><b>{managerialError ? "—" : money.format(managerial?.result || 0)}</b></span>
                <span><small>NeuroFinance</small><b>{neuroLoading ? "…" : financialConnected ? money.format(neuroBalance?.balance || 0) : "Off"}</b></span>
              </div>
            </button>

            <button
              type="button"
              className="dashboard-v4-widget dashboard-v4-widget-tele"
              onClick={() => teleNext?.type === "online" && features.hasTelemedicine
                ? navigate("/teleconsulta", { state: { activeAppointmentId: teleNext.id } })
                : navigate("/agenda")}
            >
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={Video} /><span>Atendimento</span><ArrowRight /></div>
              <div className="dashboard-v4-tele-orb">{teleNext?.type === "online" ? <Video /> : <Stethoscope />}</div>
              <h3>{teleNext ? appointmentTitle(teleNext) : "Sem atendimento próximo"}</h3>
              <p>{teleNext ? `${getDashboardAppointmentMode(teleNext)} · ${format(new Date(teleNext.start_time), "EEE HH:mm", { locale: ptBR })}` : "Agenda livre"}</p>
            </button>

            <button type="button" className="dashboard-v4-widget dashboard-v4-widget-notes" onClick={() => navigate("/notas")}>
              <div className="dashboard-v4-widget-head"><WidgetIcon icon={NotebookTabs} /><span>Notas & NeuroDrive</span><ArrowRight /></div>
              <div className="dashboard-v4-notes-mark"><FileText /></div>
              <div className="dashboard-v4-notes-copy">
                <small>{nextAppointment ? appointmentTitle(nextAppointment) : "Contexto recente"}</small>
                <h3>{prepLoading ? "Carregando contexto…" : latestPrepNote ? "Nota recente disponível" : "Sem nota em destaque"}</h3>
                <p>{latestPrepNote?.ai_summary?.summary || latestPrepNote?.notes || "Abra o NeuroDrive para continuar organizando o contexto clínico."}</p>
              </div>
            </button>
          </div>

          <div className="dashboard-v4-context-footer">
            <CheckCircle2 />
            <span>Os widgets resumem contexto. Decisões e confirmações continuam com você.</span>
          </div>
        </section>
      </div>

      <DashboardSynapseVoiceOverlay
        isOpen={voiceOpen}
        initialPrompt={voicePrompt}
        onClose={() => setVoiceOpen(false)}
      />
    </>
  );
};

export default DesktopDashboardClinicalFlowV4;
