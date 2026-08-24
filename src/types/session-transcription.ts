export type SessionTranscriptModality = "online" | "in_person";
export type SessionTranscriptProvider = "jitsi" | "browser_speech" | "manual" | "mixed";
export type SessionTranscriptStatus = "draft" | "recording" | "paused" | "finalizing" | "completed" | "error" | "abandoned";
export type SessionCaptureState = "idle" | "restoring" | "awaiting_consent" | "ready" | "recording" | "paused" | "reconnecting" | "finalizing" | "completed" | "error";
export type SessionTranscriptConsentStatus = "pending" | "granted" | "declined" | "revoked";
export type SessionTranscriptConsentMethod = "verbal" | "written" | "digital" | "legacy";
export type SessionTranscriptSource = "jitsi" | "browser_speech" | "manual" | "imported";
export type SessionTranscriptSyncState = "idle" | "pending" | "syncing" | "synced" | "offline" | "error";

export interface SessionTranscriptRecord {
  id: string;
  user_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  modality: SessionTranscriptModality;
  provider: SessionTranscriptProvider;
  status: SessionTranscriptStatus;
  language: string;
  consent_status: SessionTranscriptConsentStatus;
  consent_method: SessionTranscriptConsentMethod | null;
  consent_notes: string | null;
  consent_recorded_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  finalized_at: string | null;
  reviewed_at: string | null;
  summary_note_id: string | null;
  retention_policy: "manual" | "keep" | "delete_after_summary";
  retention_until: string | null;
  last_synced_at: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
