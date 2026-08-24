import { useAuth } from '@/components/auth/SessionContextProvider';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SessionNotesSyncState = 'restoring' | 'idle' | 'saving' | 'saved' | 'error';

interface SessionNotesDraftRecord {
  key: string;
  notes: string;
  savedAt: string;
}

const DATABASE_NAME = 'neuronex-session-notes';
const STORE_NAME = 'drafts';
const DATABASE_VERSION = 1;

const openDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const readDraft = async (key: string): Promise<SessionNotesDraftRecord | null> => {
  try {
    const database = await openDatabase();
    if (database) {
      const record = await new Promise<SessionNotesDraftRecord | undefined>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result as SessionNotesDraftRecord | undefined);
        request.onerror = () => reject(request.error);
      });
      database.close();
      if (record) return record;
    }
  } catch {
    // Restricted browsers use the fallback below.
  }

  const raw = localStorage.getItem(`session-notes:${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionNotesDraftRecord;
  } catch {
    return null;
  }
};

const writeDraft = async (record: SessionNotesDraftRecord) => {
  try {
    const database = await openDatabase();
    if (!database) throw new Error('indexeddb_unavailable');
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    localStorage.removeItem(`session-notes:${record.key}`);
  } catch {
    localStorage.setItem(`session-notes:${record.key}`, JSON.stringify(record));
  }
};

const removeDraft = async (key: string) => {
  try {
    const database = await openDatabase();
    if (database) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }
  } catch {
    // Fallback cleanup below.
  }
  localStorage.removeItem(`session-notes:${key}`);
};

export const useResilientSessionNotes = (appointmentId: string) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [syncState, setSyncState] = useState<SessionNotesSyncState>('restoring');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const restoredKeyRef = useRef<string | null>(null);
  const key = `${user?.id || 'anonymous'}:${appointmentId}`;

  useEffect(() => {
    if (restoredKeyRef.current === key) return;
    restoredKeyRef.current = key;
    setIsRestored(false);
    setSyncState('restoring');

    void readDraft(key)
      .then((record) => {
        setNotes(record?.notes || '');
        setLastSavedAt(record?.savedAt || null);
        setSyncState(record ? 'saved' : 'idle');
        setIsRestored(true);
      })
      .catch(() => {
        setSyncState('error');
        setIsRestored(true);
      });
  }, [key]);

  useEffect(() => {
    if (!isRestored || restoredKeyRef.current !== key) return;
    setSyncState('saving');
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      void writeDraft({ key, notes, savedAt })
        .then(() => {
          setLastSavedAt(savedAt);
          setSyncState('saved');
        })
        .catch(() => setSyncState('error'));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [isRestored, key, notes]);

  const clearDraft = useCallback(async () => {
    await removeDraft(key);
    setNotes('');
    setLastSavedAt(null);
    setSyncState('idle');
  }, [key]);

  return {
    notes,
    setNotes,
    syncState,
    lastSavedAt,
    clearDraft,
  };
};
