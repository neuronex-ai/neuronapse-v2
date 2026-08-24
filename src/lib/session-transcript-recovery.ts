import type { SessionTranscriptRecord } from "@/types/session-transcription";
import type { SessionTranscriptSegment } from "@/types/session-transcript-segment";

export interface SessionTranscriptRecoverySnapshot {
  version: 1;
  key: string;
  record: SessionTranscriptRecord | null;
  segments: SessionTranscriptSegment[];
  pendingSegments: SessionTranscriptSegment[];
  savedAt: string;
}

const DB_NAME = "neuronex-session-recovery";
const STORE_NAME = "transcripts";
const FALLBACK_PREFIX = "session-recovery:";

export const createSessionTranscriptUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
};

const openDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveSessionTranscriptRecovery = async (snapshot: SessionTranscriptRecoverySnapshot) => {
  try {
    const database = await openDatabase();
    if (!database) throw new Error("indexeddb_unavailable");
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(snapshot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`${FALLBACK_PREFIX}${snapshot.key}`, JSON.stringify(snapshot));
    }
  }
};

export const loadSessionTranscriptRecovery = async (key: string) => {
  try {
    const database = await openDatabase();
    if (database) {
      const snapshot = await new Promise<SessionTranscriptRecoverySnapshot | null>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve((request.result as SessionTranscriptRecoverySnapshot) || null);
        request.onerror = () => reject(request.error);
      });
      database.close();
      if (snapshot) return snapshot;
    }
  } catch {
    // Fallback below.
  }

  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionTranscriptRecoverySnapshot;
  } catch {
    return null;
  }
};

export const deleteSessionTranscriptRecovery = async (key: string) => {
  try {
    const database = await openDatabase();
    if (database) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }
  } catch {
    // Fallback cleanup still runs.
  }
  if (typeof localStorage !== "undefined") localStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
};

export const mergeTranscriptSegments = (...groups: SessionTranscriptSegment[][]) => {
  const byClientId = new Map<string, SessionTranscriptSegment>();
  groups.flat().forEach((segment) => {
    const previous = byClientId.get(segment.client_segment_id);
    if (!previous || (!previous.id && segment.id)) byClientId.set(segment.client_segment_id, segment);
  });
  return Array.from(byClientId.values()).sort((a, b) => a.sequence - b.sequence);
};
