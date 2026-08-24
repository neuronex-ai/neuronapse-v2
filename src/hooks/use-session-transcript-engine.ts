import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  createSessionTranscriptUuid,
  deleteSessionTranscriptRecovery,
  fetchOpenSessionTranscript,
  fetchSessionTranscriptSegments,
  loadSessionTranscriptRecovery,
  mergeTranscriptSegments,
  saveSessionTranscriptRecovery,
  type SessionCaptureState,
  type SessionTranscriptConsentMethod,
  type SessionTranscriptConsentStatus,
  type SessionTranscriptModality,
  type SessionTranscriptProvider,
  type SessionTranscriptRecord,
  type SessionTranscriptRecoverySnapshot,
  type SessionTranscriptSegment,
  type SessionTranscriptSource,
  type SessionTranscriptSyncState,
  upsertSessionTranscript,
  upsertSessionTranscriptSegments,
} from '@/hooks/use-jitsi-token';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface AppendTranscriptSegmentInput {
  source: SessionTranscriptSource;
  text: string;
  speakerLabel?: string | null;
  speakerId?: string | null;
  isFinal?: boolean;
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  clientSegmentId?: string;
}

interface UseSessionTranscriptOptions {
  appointmentId: string;
  patientId?: string | null;
  modality: SessionTranscriptModality;
  provider?: SessionTranscriptProvider;
  language?: string;
  autoRestore?: boolean;
}

const captureStateFromRecord = (record: SessionTranscriptRecord | null): SessionCaptureState => {
  if (!record) return 'idle';
  if (record.consent_status !== 'granted') return 'awaiting_consent';
  if (record.status === 'draft') return 'ready';
  if (record.status === 'recording') return 'recording';
  if (record.status === 'paused') return 'paused';
  if (record.status === 'finalizing') return 'finalizing';
  if (record.status === 'completed') return 'completed';
  if (record.status === 'error') return 'error';
  return 'idle';
};

export const useSessionTranscript = ({
  appointmentId,
  patientId = null,
  modality,
  provider = 'mixed',
  language = 'pt-BR',
  autoRestore = true,
}: UseSessionTranscriptOptions) => {
  const { user } = useAuth();
  const [record, setRecord] = useState<SessionTranscriptRecord | null>(null);
  const [segments, setSegments] = useState<SessionTranscriptSegment[]>([]);
  const [pendingSegments, setPendingSegments] = useState<SessionTranscriptSegment[]>([]);
  const [captureState, setCaptureState] = useState<SessionCaptureState>('idle');
  const [syncState, setSyncState] = useState<SessionTranscriptSyncState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const recordRef = useRef<SessionTranscriptRecord | null>(null);
  const segmentsRef = useRef<SessionTranscriptSegment[]>([]);
  const pendingRef = useRef<SessionTranscriptSegment[]>([]);
  const sequenceRef = useRef(0);
  const restoredKeyRef = useRef<string | null>(null);
  const flushingRef = useRef<Promise<void> | null>(null);
  const recoveryKey = user ? `${user.id}:${appointmentId}` : `anonymous:${appointmentId}`;

  const applyRecord = useCallback((next: SessionTranscriptRecord | null) => {
    recordRef.current = next;
    setRecord(next);
    setCaptureState(captureStateFromRecord(next));
  }, []);

  const applySegments = useCallback((next: SessionTranscriptSegment[]) => {
    const merged = mergeTranscriptSegments(next);
    segmentsRef.current = merged;
    setSegments(merged);
  }, []);

  const applyPending = useCallback((next: SessionTranscriptSegment[]) => {
    const merged = mergeTranscriptSegments(next);
    pendingRef.current = merged;
    setPendingSegments(merged);
  }, []);

  const persistRecovery = useCallback(async () => {
    if (!user) return;
    const snapshot: SessionTranscriptRecoverySnapshot = {
      version: 1,
      key: recoveryKey,
      record: recordRef.current,
      segments: segmentsRef.current,
      pendingSegments: pendingRef.current,
      savedAt: new Date().toISOString(),
    };
    await saveSessionTranscriptRecovery(snapshot);
  }, [recoveryKey, user]);

  const syncRecord = useCallback(async (next: SessionTranscriptRecord) => {
    if (!isOnline) {
      setSyncState('offline');
      await persistRecovery();
      return;
    }
    await upsertSessionTranscript(next);
    setSyncState('synced');
  }, [isOnline, persistRecovery]);

  const ensureTranscript = useCallback(async () => {
    if (!user) throw new Error('Usuário não autenticado.');
    if (recordRef.current) return recordRef.current;

    const now = new Date().toISOString();
    const next: SessionTranscriptRecord = {
      id: createSessionTranscriptUuid(),
      user_id: user.id,
      patient_id: patientId,
      appointment_id: appointmentId,
      modality,
      provider,
      status: 'draft',
      language,
      consent_status: 'pending',
      consent_method: null,
      consent_notes: null,
      consent_recorded_at: null,
      started_at: null,
      paused_at: null,
      ended_at: null,
      finalized_at: null,
      reviewed_at: null,
      summary_note_id: null,
      retention_policy: 'manual',
      retention_until: null,
      last_synced_at: null,
      error_code: null,
      error_message: null,
      metadata: {},
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    applyRecord(next);
    await persistRecovery();
    try {
      await syncRecord(next);
      setLastError(null);
    } catch (error) {
      setSyncState('error');
      setLastError(error instanceof Error ? error.message : 'Falha ao criar a transcrição.');
    }
    return next;
  }, [appointmentId, applyRecord, language, modality, patientId, persistRecovery, provider, syncRecord, user]);

  const updateRecord = useCallback(async (patch: Partial<SessionTranscriptRecord>) => {
    const current = await ensureTranscript();
    const next: SessionTranscriptRecord = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    applyRecord(next);
    await persistRecovery();
    try {
      await syncRecord(next);
      setLastError(null);
    } catch (error) {
      setSyncState(isOnline ? 'error' : 'offline');
      setLastError(error instanceof Error ? error.message : 'Falha ao sincronizar a transcrição.');
    }
    return next;
  }, [applyRecord, ensureTranscript, isOnline, persistRecovery, syncRecord]);

  const flushPendingSegments = useCallback(async () => {
    if (flushingRef.current) return flushingRef.current;
    if (!user || !recordRef.current || pendingRef.current.length === 0) return;
    if (!isOnline) {
      setSyncState('offline');
      await persistRecovery();
      return;
    }

    flushingRef.current = (async () => {
      setSyncState('syncing');
      while (pendingRef.current.length > 0) {
        const batch = pendingRef.current.slice(0, 50);
        const sentIds = new Set(batch.map((segment) => segment.client_segment_id));
        await upsertSessionTranscriptSegments(batch);
        applyPending(pendingRef.current.filter((segment) => !sentIds.has(segment.client_segment_id)));
      }
      const syncedAt = new Date().toISOString();
      if (recordRef.current) {
        const next = { ...recordRef.current, last_synced_at: syncedAt, updated_at: syncedAt };
        applyRecord(next);
        await supabase
          .from('session_transcripts')
          .update({ last_synced_at: syncedAt })
          .eq('id', next.id)
          .eq('user_id', user.id);
      }
      setSyncState('synced');
      setLastError(null);
      await persistRecovery();
    })()
      .catch(async (error) => {
        setSyncState('error');
        setLastError(error instanceof Error ? error.message : 'Falha ao sincronizar segmentos.');
        await persistRecovery();
      })
      .finally(() => {
        flushingRef.current = null;
      });

    return flushingRef.current;
  }, [applyPending, applyRecord, isOnline, persistRecovery, user]);

  const recordConsent = useCallback(async (
    status: SessionTranscriptConsentStatus,
    method?: SessionTranscriptConsentMethod,
    notes?: string,
  ) => {
    const now = new Date().toISOString();
    return updateRecord({
      consent_status: status,
      consent_method: method || null,
      consent_notes: notes?.trim() || null,
      consent_recorded_at: status === 'pending' ? null : now,
      status: status === 'granted' ? 'draft' : recordRef.current?.status === 'recording' ? 'paused' : 'draft',
      paused_at: status === 'revoked' ? now : recordRef.current?.paused_at || null,
    });
  }, [updateRecord]);

  const start = useCallback(async () => {
    const current = await ensureTranscript();
    if (current.consent_status !== 'granted') {
      setCaptureState('awaiting_consent');
      throw new Error('Registre o consentimento antes de iniciar a transcrição.');
    }
    const now = new Date().toISOString();
    await updateRecord({
      status: 'recording',
      started_at: current.started_at || now,
      paused_at: null,
      error_code: null,
      error_message: null,
    });
  }, [ensureTranscript, updateRecord]);

  const pause = useCallback(async () => {
    if (!recordRef.current) return;
    await updateRecord({ status: 'paused', paused_at: new Date().toISOString() });
    await flushPendingSegments();
  }, [flushPendingSegments, updateRecord]);

  const resume = useCallback(async () => {
    const current = await ensureTranscript();
    if (current.consent_status !== 'granted') throw new Error('O consentimento não está ativo.');
    await updateRecord({ status: 'recording', paused_at: null });
  }, [ensureTranscript, updateRecord]);

  const appendSegment = useCallback(async (input: AppendTranscriptSegmentInput) => {
    const text = input.text.trim();
    if (!text) return null;
    const current = await ensureTranscript();
    if (current.consent_status !== 'granted') throw new Error('Não é permitido capturar áudio sem consentimento registrado.');
    if (current.status !== 'recording') throw new Error('A transcrição precisa estar em gravação.');
    if (!user) throw new Error('Usuário não autenticado.');

    const segment: SessionTranscriptSegment = {
      transcript_id: current.id,
      user_id: user.id,
      client_segment_id: input.clientSegmentId || createSessionTranscriptUuid(),
      sequence: Date.now() * 1000 + (sequenceRef.current++ % 1000),
      source: input.source,
      speaker_label: input.speakerLabel || null,
      speaker_id: input.speakerId || null,
      text,
      is_final: input.isFinal ?? true,
      started_at_ms: input.startedAtMs ?? null,
      ended_at_ms: input.endedAtMs ?? null,
      confidence: input.confidence ?? null,
      captured_at: new Date().toISOString(),
      metadata: input.metadata || {},
    };

    applySegments(mergeTranscriptSegments(segmentsRef.current, [segment]));
    applyPending(mergeTranscriptSegments(pendingRef.current, [segment]));
    setSyncState(isOnline ? 'pending' : 'offline');
    await persistRecovery();
    return segment;
  }, [applyPending, applySegments, ensureTranscript, isOnline, persistRecovery, user]);

  const finalize = useCallback(async () => {
    const current = await ensureTranscript();
    setCaptureState('finalizing');
    await updateRecord({ status: 'finalizing' });
    await flushPendingSegments();
    const now = new Date().toISOString();
    await updateRecord({ status: 'completed', ended_at: now, finalized_at: now });
    return {
      transcriptId: current.id,
      text: segmentsRef.current
        .map((segment) => segment.speaker_label ? `${segment.speaker_label}: ${segment.text}` : segment.text)
        .join('\n'),
      segments: segmentsRef.current,
    };
  }, [ensureTranscript, flushPendingSegments, updateRecord]);

  const markReviewed = useCallback(() => updateRecord({ reviewed_at: new Date().toISOString() }), [updateRecord]);
  const linkSummaryNote = useCallback((summaryNoteId: string) => updateRecord({ summary_note_id: summaryNoteId }), [updateRecord]);
  const abandon = useCallback(async () => {
    await flushPendingSegments();
    await updateRecord({ status: 'abandoned', ended_at: new Date().toISOString() });
  }, [flushPendingSegments, updateRecord]);

  const retrySync = useCallback(async () => {
    if (recordRef.current) await syncRecord(recordRef.current);
    await flushPendingSegments();
  }, [flushPendingSegments, syncRecord]);

  const clearRecovery = useCallback(async () => {
    await deleteSessionTranscriptRecovery(recoveryKey);
    applyRecord(null);
    applySegments([]);
    applyPending([]);
    setSyncState('idle');
    setLastError(null);
  }, [applyPending, applyRecord, applySegments, recoveryKey]);

  useEffect(() => {
    if (!autoRestore || !user || restoredKeyRef.current === recoveryKey) return;
    restoredKeyRef.current = recoveryKey;
    setCaptureState('restoring');

    void (async () => {
      try {
        const local = await loadSessionTranscriptRecovery(recoveryKey);
        const nextRecord = local?.record || (isOnline ? await fetchOpenSessionTranscript(user.id, appointmentId) : null);
        if (!nextRecord) {
          setCaptureState('idle');
          return;
        }
        applyRecord(nextRecord);
        const remote = isOnline ? await fetchSessionTranscriptSegments(user.id, nextRecord.id) : [];
        const localSegments = (local?.segments || []).filter((segment) => segment.transcript_id === nextRecord.id);
        const localPending = (local?.pendingSegments || []).filter((segment) => segment.transcript_id === nextRecord.id);
        applySegments(mergeTranscriptSegments(remote, localSegments, localPending));
        applyPending(localPending);
        if (isOnline) await syncRecord(nextRecord);
        await persistRecovery();
      } catch (error) {
        setCaptureState('error');
        setSyncState('error');
        setLastError(error instanceof Error ? error.message : 'Falha ao restaurar a transcrição.');
      }
    })();
  }, [appointmentId, applyPending, applyRecord, applySegments, autoRestore, isOnline, persistRecovery, recoveryKey, syncRecord, user]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void retrySync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
      if (recordRef.current?.status === 'recording') setCaptureState('reconnecting');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [retrySync]);

  useEffect(() => {
    if (!record?.id || !user) return;
    const channel = supabase
      .channel(`session-transcript:${record.id}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_transcript_segments',
        filter: `transcript_id=eq.${record.id}`,
      }, (payload) => {
        applySegments(mergeTranscriptSegments(segmentsRef.current, [payload.new as SessionTranscriptSegment]));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_transcripts',
        filter: `id=eq.${record.id}`,
      }, (payload) => applyRecord(payload.new as SessionTranscriptRecord))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyRecord, applySegments, record?.id, user]);

  useEffect(() => {
    if (pendingSegments.length === 0 || !isOnline) return;
    const timer = window.setTimeout(() => void flushPendingSegments(), 700);
    return () => window.clearTimeout(timer);
  }, [flushPendingSegments, isOnline, pendingSegments.length]);

  const transcriptText = useMemo(
    () => segments.map((segment) => segment.speaker_label ? `${segment.speaker_label}: ${segment.text}` : segment.text).join('\n'),
    [segments],
  );

  return {
    transcriptId: record?.id || null,
    record,
    segments,
    transcriptText,
    captureState,
    syncState,
    lastError,
    isOnline,
    pendingCount: pendingSegments.length,
    consentStatus: record?.consent_status || 'pending',
    ensureTranscript,
    recordConsent,
    start,
    pause,
    resume,
    appendSegment,
    flushPendingSegments,
    finalize,
    markReviewed,
    linkSummaryNote,
    abandon,
    retrySync,
    clearRecovery,
  };
};
