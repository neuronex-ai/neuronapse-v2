import type {
  SessionTranscriptModality,
  SessionTranscriptProvider,
  SessionTranscriptSource,
} from "./session-transcription";

export interface SessionTranscriptSegment {
  id?: string;
  transcript_id: string;
  user_id: string;
  client_segment_id: string;
  sequence: number;
  source: SessionTranscriptSource;
  speaker_label: string | null;
  speaker_id: string | null;
  text: string;
  is_final: boolean;
  started_at_ms: number | null;
  ended_at_ms: number | null;
  confidence: number | null;
  captured_at: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}

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

export interface UseSessionTranscriptOptions {
  appointmentId: string;
  patientId?: string | null;
  modality: SessionTranscriptModality;
  provider?: SessionTranscriptProvider;
  language?: string;
  autoRestore?: boolean;
}

export interface FinalizedSessionTranscript {
  transcriptId: string;
  text: string;
  segments: SessionTranscriptSegment[];
}
