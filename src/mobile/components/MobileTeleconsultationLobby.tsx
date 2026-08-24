"use client";

import { MediaReadinessPanel } from "@/components/teleconsulta/MediaReadinessPanel";
import { PreJoinActions } from "@/components/teleconsulta/PreJoinActions";
import { Button } from "@/components/ui/button";
import type { MediaDeviceChoice } from "@/hooks/use-media-readiness";
import { getInitials } from "@/lib/utils";
import { Patient } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CalendarClock, Loader2, Play, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

interface MobileTeleconsultationLobbyProps {
  patientName: string;
  patient?: Patient | null;
  appointmentId: string;
  appointmentStart?: string;
  meetLink: string;
  therapistName: string;
  isOnline: boolean;
  isLoadingToken: boolean;
  onJoin: (selection: MediaDeviceChoice) => void;
  onBack: () => void;
}

const emptySelection: MediaDeviceChoice = {
  audioEnabled: true,
  videoEnabled: true,
};

export const MobileTeleconsultationLobby = ({
  patientName,
  patient,
  appointmentId,
  appointmentStart,
  meetLink,
  therapistName,
  isOnline,
  isLoadingToken,
  onJoin,
  onBack,
}: MobileTeleconsultationLobbyProps) => {
  const [isReady, setIsReady] = useState(false);
  const [selection, setSelection] = useState<MediaDeviceChoice>({
    ...emptySelection,
    videoEnabled: isOnline,
  });

  const handleReadinessChange = useCallback((ready: boolean, nextSelection: MediaDeviceChoice) => {
    setIsReady(ready);
    setSelection(nextSelection);
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-[120px]" />

      <header className="relative z-20 flex items-center justify-between px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/45 bg-card/80 text-foreground shadow-sm backdrop-blur-xl transition active:scale-95 dark:border-white/10 dark:bg-white/[0.04]"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pré-entrada</p>
          <p className="mt-1 text-sm font-black tracking-[-0.02em] text-foreground">
            {isOnline ? "Teleconsulta" : "Sessão presencial"}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] text-xs font-black text-emerald-600 dark:text-emerald-300">
          {getInitials(patientName)}
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
        <section className="rounded-[28px] border border-border/40 bg-card/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sessão com</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">{patientName}</h1>
          {appointmentStart ? (
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {format(new Date(appointmentStart), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </div>
          ) : null}
        </section>

        <section className="mt-4">
          <MediaReadinessPanel
            variant="mobile"
            initialAudioEnabled
            initialVideoEnabled={isOnline}
            onReadinessChange={handleReadinessChange}
          />
        </section>

        <section className="mt-4 rounded-[26px] border border-border/40 bg-card/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-black text-foreground">Antes de entrar</p>
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground/70">
                {isOnline
                  ? "Confirme que o ambiente está reservado e que o paciente foi informado sobre o uso dos recursos da sessão."
                  : "Use um ambiente reservado e confirme o consentimento antes de iniciar qualquer captura de áudio da sessão presencial."}
              </p>
            </div>
          </div>
        </section>

        {isOnline ? (
          <section className="mt-4 rounded-[26px] border border-border/40 bg-card/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-3 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Enviar link da consulta</p>
            <PreJoinActions
              appointmentId={appointmentId}
              patient={patient}
              meetLink={meetLink}
              therapistName={therapistName}
            />
          </section>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/45 bg-background/92 px-5 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl dark:border-white/10">
        <Button
          type="button"
          disabled={!isReady || (isOnline && isLoadingToken)}
          onClick={() => onJoin(selection)}
          className="h-14 w-full rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.19em] text-background shadow-xl disabled:opacity-45"
        >
          {isOnline && isLoadingToken ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparando sala
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4 fill-current" />
              {isOnline ? "Entrar na sessão" : "Iniciar sessão presencial"}
            </>
          )}
        </Button>
        {!isReady ? (
          <p className="mt-2 text-center text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/55">
            Conclua o teste ou desligue o dispositivo indisponível
          </p>
        ) : null}
      </div>
    </div>
  );
};
