import { useSessionTranscript } from '@/hooks/use-session-transcript-engine';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import type {
  SessionTranscriptConsentMethod,
  SessionTranscriptModality,
} from '@/hooks/use-jitsi-token';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSessionCaptureOptions {
  appointmentId: string;
  patientId?: string | null;
  modality: SessionTranscriptModality;
  therapistName: string;
  language?: string;
}

export const useSessionCapture = ({
  appointmentId,
  patientId,
  modality,
  therapistName,
  language = 'pt-BR',
}: UseSessionCaptureOptions) => {
  const transcript = useSessionTranscript({
    appointmentId,
    patientId,
    modality,
    provider: modality === 'online' ? 'jitsi' : 'browser_speech',
    language,
  });
  const {
    appendSegment,
    recordConsent,
    start,
    pause,
    resume,
    finalize,
  } = transcript;
  const [interimText, setInterimText] = useState('');
  const [isCaptureEnabled, setIsCaptureEnabled] = useState(false);
  const captureEnabledRef = useRef(false);

  const setCaptureEnabled = useCallback((enabled: boolean) => {
    captureEnabledRef.current = enabled;
    setIsCaptureEnabled(enabled);
  }, []);

  const appendLocalSpeech = useCallback((text: string) => {
    if (!captureEnabledRef.current) return;
    void appendSegment({
      source: 'browser_speech',
      speakerLabel: 'Áudio da sessão',
      text,
      metadata: { capturedBy: therapistName },
    });
  }, [appendSegment, therapistName]);

  const speech = useSpeechRecognition({
    lang: language,
    continuous: true,
    onResult: appendLocalSpeech,
    onInterimResult: setInterimText,
  });
  const {
    isSupported: speechSupported,
    isListening,
    lastError: speechError,
    startListening,
    stopListening,
  } = speech;

  const grantConsent = useCallback(async (
    method: SessionTranscriptConsentMethod = 'verbal',
    notes?: string,
  ) => {
    await recordConsent('granted', method, notes);
  }, [recordConsent]);

  const declineConsent = useCallback(async (notes?: string) => {
    setCaptureEnabled(false);
    stopListening();
    setInterimText('');
    await recordConsent('declined', 'verbal', notes);
  }, [recordConsent, setCaptureEnabled, stopListening]);

  const startCapture = useCallback(async () => {
    await start();
    setCaptureEnabled(true);
    if (modality === 'in_person' && speechSupported) startListening();
  }, [modality, setCaptureEnabled, speechSupported, start, startListening]);

  const pauseCapture = useCallback(async () => {
    setCaptureEnabled(false);
    stopListening();
    setInterimText('');
    await pause();
  }, [pause, setCaptureEnabled, stopListening]);

  const resumeCapture = useCallback(async () => {
    await resume();
    setCaptureEnabled(true);
    if (modality === 'in_person' && speechSupported) startListening();
  }, [modality, resume, setCaptureEnabled, speechSupported, startListening]);

  const appendJitsiSegment = useCallback((entry: {
    participant: { name: string };
    text: string;
  }) => {
    if (!captureEnabledRef.current || modality !== 'online') return;
    void appendSegment({
      source: 'jitsi',
      speakerLabel: entry.participant.name || 'Participante',
      text: entry.text,
    });
  }, [appendSegment, modality]);

  const finalizeCapture = useCallback(async () => {
    setCaptureEnabled(false);
    stopListening();
    setInterimText('');
    return finalize();
  }, [finalize, setCaptureEnabled, stopListening]);

  const revokeConsent = useCallback(async (notes?: string) => {
    setCaptureEnabled(false);
    stopListening();
    setInterimText('');
    await recordConsent('revoked', 'verbal', notes);
  }, [recordConsent, setCaptureEnabled, stopListening]);

  useEffect(() => () => {
    captureEnabledRef.current = false;
    stopListening();
  }, [stopListening]);

  return {
    ...transcript,
    interimText,
    isCaptureEnabled,
    speechSupported,
    speechError,
    isListening,
    grantConsent,
    declineConsent,
    revokeConsent,
    startCapture,
    pauseCapture,
    resumeCapture,
    appendJitsiSegment,
    finalizeCapture,
  };
};
