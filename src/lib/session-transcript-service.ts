import { supabase } from "@/integrations/supabase/client";
import type { SessionTranscriptRecord } from "@/types/session-transcription";
import type { SessionTranscriptSegment } from "@/types/session-transcript-segment";

export const fetchOpenSessionTranscript = async (userId: string, appointmentId: string) => {
  const { data, error } = await supabase
    .from("session_transcripts")
    .select("*")
    .eq("user_id", userId)
    .eq("appointment_id", appointmentId)
    .is("deleted_at", null)
    .in("status", ["draft", "recording", "paused", "finalizing", "error"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as SessionTranscriptRecord | null;
};

export const fetchSessionTranscriptSegments = async (userId: string, transcriptId: string) => {
  const { data, error } = await supabase
    .from("session_transcript_segments")
    .select("*")
    .eq("user_id", userId)
    .eq("transcript_id", transcriptId)
    .order("sequence", { ascending: true });

  if (error) throw error;
  return (data || []) as SessionTranscriptSegment[];
};

export const upsertSessionTranscript = async (record: SessionTranscriptRecord) => {
  const { error } = await supabase
    .from("session_transcripts")
    .upsert(record, { onConflict: "id" });
  if (error) throw error;
};

export const upsertSessionTranscriptSegments = async (segments: SessionTranscriptSegment[]) => {
  if (!segments.length) return;
  const { error } = await supabase
    .from("session_transcript_segments")
    .upsert(segments, { onConflict: "transcript_id,client_segment_id" });
  if (error) throw error;
};

export const updateSessionTranscriptSyncTime = async (
  transcriptId: string,
  userId: string,
  syncedAt: string,
) => {
  const { error } = await supabase
    .from("session_transcripts")
    .update({ last_synced_at: syncedAt, updated_at: syncedAt })
    .eq("id", transcriptId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const subscribeToSessionTranscript = (
  transcriptId: string,
  onSegment: (segment: SessionTranscriptSegment) => void,
  onRecord: (record: SessionTranscriptRecord) => void,
) => {
  const channel = supabase
    .channel(`session-transcript:${transcriptId}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_transcript_segments",
        filter: `transcript_id=eq.${transcriptId}`,
      },
      (payload) => onSegment(payload.new as SessionTranscriptSegment),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "session_transcripts",
        filter: `id=eq.${transcriptId}`,
      },
      (payload) => onRecord(payload.new as SessionTranscriptRecord),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
