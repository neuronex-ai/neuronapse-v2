"use client";

import { Mic, MicOff, PhoneOff, RefreshCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSynapseVoice } from "@/hooks/use-synapse-voice";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import { cn } from "@/lib/utils";

type DashboardSynapseVoiceOverlayProps = {
  isOpen: boolean;
  initialPrompt: string;
  onClose: () => void;
};

const SYSTEM_INSTRUCTION =
  "Você é o Synapse por voz no dashboard clínico. Fale em português brasileiro de forma curta, natural e humana. Organize contexto e sugira próximos passos, mas nunca tome decisões clínicas nem confirme ações pelo profissional. Nunca leia rotas, links, códigos ou IDs em voz alta.";

const toFriendlyVoiceError = (error: string | null) => {
  if (!error) return null;
  if (/microfone/i.test(error)) return error;
  if (/sess[aã]o inv[aá]lida/i.test(error)) {
    return "Sua sessão expirou. Entre novamente para usar o modo voz.";
  }
  return "Não consegui iniciar a conversa por voz agora. Tente novamente.";
};

export const DashboardSynapseVoiceOverlay = ({
  isOpen,
  initialPrompt,
  onClose,
}: DashboardSynapseVoiceOverlayProps) => {
  const [isStarting, setIsStarting] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const autoStartedRef = useRef(false);
  const seededPromptRef = useRef<string | null>(null);

  const {
    isLoading: voiceConfigLoading,
    refresh: refreshVoiceConfig,
    error: voiceConfigError,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceSessionId,
    conversationId: voiceConversationId,
    voiceSessionId: voiceRunSessionId,
    inputSampleRate: voiceInputSampleRate,
    outputSampleRate: voiceOutputSampleRate,
  } = useVoiceConfig();

  const {
    isConnected,
    isSpeaking,
    isListening,
    isProcessing,
    isToolActive,
    activeToolLabel,
    activeToolMessage,
    lastResponse,
    startSession,
    endSession,
    toggleListening,
    sendTextMessage,
    error: runtimeError,
  } = useSynapseVoice({
    token: null,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceSessionId,
    conversationId: voiceConversationId,
    voiceSessionId: voiceRunSessionId,
    inputSampleRate: voiceInputSampleRate,
    outputSampleRate: voiceOutputSampleRate,
    systemInstruction: SYSTEM_INSTRUCTION,
    language: "pt-BR",
    context: {
      currentContext: "dashboard",
      source: "dashboard-clinical-flow",
    },
    onResponseText: setLocalMessage,
  });

  const error = toFriendlyVoiceError(runtimeError || voiceConfigError);

  const beginSession = useCallback(async () => {
    if (isConnected || isStarting) return;
    setIsStarting(true);
    setLocalMessage("Preparando a conversa...");
    try {
      const config = await refreshVoiceConfig();
      await startSession({
        token: config.token,
        model: config.model,
        voiceName: config.voiceName,
        gatewayUrl: config.gatewayUrl,
        provider: config.provider,
        sessionId: config.sessionId,
        conversationId: config.conversationId,
        voiceSessionId: config.voiceSessionId,
        inputSampleRate: config.inputSampleRate,
        outputSampleRate: config.outputSampleRate,
        context: {
          currentContext: "dashboard",
          source: "dashboard-clinical-flow",
        },
      });
    } catch (caught: unknown) {
      const message =
        caught instanceof Error ? caught.message : "Não foi possível iniciar o modo voz.";
      setLocalMessage(toFriendlyVoiceError(message) || message);
    } finally {
      setIsStarting(false);
    }
  }, [isConnected, isStarting, refreshVoiceConfig, startSession]);

  useEffect(() => {
    if (!isOpen) {
      autoStartedRef.current = false;
      seededPromptRef.current = null;
      return;
    }

    if (!autoStartedRef.current) {
      autoStartedRef.current = true;
      void beginSession();
    }
  }, [beginSession, isOpen]);

  useEffect(() => {
    const prompt = initialPrompt.trim();
    if (!isOpen || !isConnected || !prompt || seededPromptRef.current === prompt) return;

    seededPromptRef.current = prompt;
    sendTextMessage(prompt);
    setLocalMessage("Contexto inicial enviado ao Synapse.");
  }, [initialPrompt, isConnected, isOpen, sendTextMessage]);

  useEffect(() => {
    if (!isOpen && isConnected) endSession();
  }, [endSession, isConnected, isOpen]);

  const handleClose = useCallback(() => {
    endSession();
    autoStartedRef.current = false;
    seededPromptRef.current = null;
    setLocalMessage("");
    onClose();
  }, [endSession, onClose]);

  const handleRestart = useCallback(() => {
    endSession();
    autoStartedRef.current = false;
    seededPromptRef.current = null;
    setLocalMessage("");
    window.setTimeout(() => {
      autoStartedRef.current = true;
      void beginSession();
    }, 180);
  }, [beginSession, endSession]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isOpen]);

  const statusText = error
    ? error
    : isStarting || voiceConfigLoading
      ? "Preparando a conversa..."
      : isToolActive
        ? activeToolMessage || (activeToolLabel ? `Consultando ${activeToolLabel}...` : "Consultando o sistema...")
        : isProcessing
          ? "Organizando o contexto..."
          : isSpeaking
            ? lastResponse || localMessage || "Respondendo..."
            : isListening
              ? "Ouvindo você..."
              : isConnected
                ? localMessage || "Pode falar naturalmente."
                : localMessage || "Conectando ao Synapse...";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/72 px-5 py-8 backdrop-blur-3xl"
      role="dialog"
      aria-modal="true"
      aria-label="Conversa por voz com o Synapse"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,hsl(var(--foreground)/0.055),transparent_34%)] dark:bg-[radial-gradient(circle_at_50%_38%,hsl(var(--foreground)/0.09),transparent_38%)]" />

      <div className="relative w-full max-w-[620px] overflow-hidden rounded-[36px] border border-foreground/[0.1] bg-background/76 p-5 shadow-[0_38px_120px_-70px_hsl(var(--foreground)/0.72)] ring-1 ring-background/75 backdrop-blur-3xl dark:border-white/[0.075] dark:bg-white/[0.035] dark:ring-white/[0.02] sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.09] bg-background/72 dark:border-white/[0.065] dark:bg-white/[0.04]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">
                Synapse · voz
              </p>
              <h2 className="mt-1 truncate text-lg font-black tracking-[-0.035em]">
                Conversa com contexto do dashboard
              </h2>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-10 w-10 shrink-0 rounded-full border border-foreground/[0.08] bg-background/52 dark:border-white/[0.055] dark:bg-white/[0.025]"
            aria-label="Fechar conversa por voz"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {initialPrompt.trim() ? (
          <div className="mt-6 rounded-[22px] border border-foreground/[0.07] bg-background/38 px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">
              Ponto de partida
            </p>
            <p className="mt-1.5 line-clamp-3 text-xs font-medium leading-relaxed text-foreground/80">
              {initialPrompt}
            </p>
          </div>
        ) : null}

        <div className="flex min-h-[250px] flex-col items-center justify-center py-7 text-center">
          <button
            type="button"
            onClick={() => (isConnected ? toggleListening() : void beginSession())}
            disabled={isStarting || voiceConfigLoading}
            aria-label={isConnected ? "Alternar escuta do Synapse" : "Iniciar conversa por voz"}
            className={cn(
              "relative flex h-24 w-24 items-center justify-center rounded-full border bg-foreground text-background shadow-[0_24px_74px_-42px_hsl(var(--foreground)/0.72)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none",
              isListening
                ? "border-foreground/80"
                : "border-foreground/55",
            )}
          >
            {!error && (isListening || isSpeaking) ? (
              <span className="absolute inset-[-10px] rounded-full border border-foreground/[0.1]" aria-hidden="true" />
            ) : null}
            {isListening ? (
              <MicOff className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </button>

          <p
            className={cn(
              "mt-6 max-w-md text-sm font-semibold leading-relaxed",
              error ? "text-destructive" : "text-foreground/75",
            )}
            aria-live="polite"
          >
            {statusText}
          </p>
          <p className="mt-2 text-[10px] font-medium text-muted-foreground">
            Nenhuma decisão é confirmada sem você.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-foreground/[0.07] pt-4 dark:border-white/[0.05]">
          <Button
            type="button"
            variant="outline"
            onClick={handleRestart}
            disabled={isStarting || voiceConfigLoading}
            className="h-10 rounded-full border-foreground/[0.08] bg-background/46 px-4 text-[10px] font-black uppercase tracking-[0.1em] dark:border-white/[0.055] dark:bg-white/[0.025]"
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Reiniciar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-10 rounded-full border-foreground/[0.08] bg-background/46 px-4 text-[10px] font-black uppercase tracking-[0.1em] dark:border-white/[0.055] dark:bg-white/[0.025]"
          >
            <PhoneOff className="mr-2 h-3.5 w-3.5" />
            Encerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSynapseVoiceOverlay;
