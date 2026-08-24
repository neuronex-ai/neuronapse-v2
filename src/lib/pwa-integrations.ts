const PWA_INTENT_STORAGE_KEY = "neuronex:pwa-pending-intent";
const PWA_QUEUE_DB_NAME = "neuronex-pwa-outbox";
const PWA_QUEUE_STORE = "intents";
const PWA_INTENT_SYNC_TAG = "neuronex-pwa-intent-sync";
const PWA_PERIODIC_SYNC_TAG = "neuronex-ai-periodic-refresh";
const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;
const PERIODIC_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type PendingPwaIntent = {
  title: string;
  content: string;
  source: "file" | "share" | "protocol" | "note";
};

export type QueuedPwaIntent = PendingPwaIntent & {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

type LaunchFileHandle = {
  getFile: () => Promise<File>;
};

type LaunchParamsLike = {
  files?: LaunchFileHandle[];
  targetURL?: string;
};

type LaunchQueueLike = {
  setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void;
};

type WindowControlsOverlayLike = EventTarget & {
  visible: boolean;
};

type PwaWindow = Window & {
  launchQueue?: LaunchQueueLike;
};

type PwaNavigator = Navigator & {
  windowControlsOverlay?: WindowControlsOverlayLike;
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type RegistrationWithBackgroundApis = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
  periodicSync?: {
    register: (tag: string, options: { minInterval: number }) => Promise<void>;
  };
};

const isBrowser = () => typeof window !== "undefined" && typeof navigator !== "undefined";

const savePendingIntent = (intent: PendingPwaIntent) => {
  window.sessionStorage.setItem(PWA_INTENT_STORAGE_KEY, JSON.stringify(intent));
};

export const consumePendingPwaIntent = (): PendingPwaIntent | null => {
  const raw = window.sessionStorage.getItem(PWA_INTENT_STORAGE_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(PWA_INTENT_STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPwaIntent>;
    if (typeof parsed.title !== "string" || typeof parsed.content !== "string") return null;

    return {
      title: parsed.title,
      content: parsed.content,
      source: parsed.source === "file" || parsed.source === "share" || parsed.source === "protocol"
        ? parsed.source
        : "note",
    };
  } catch {
    return null;
  }
};

const fileTitle = (file: File) => {
  const withoutExtension = file.name.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "Arquivo importado";
};

const handleIncomingFile = async (handle: LaunchFileHandle) => {
  const file = await handle.getFile();

  if (file.size > MAX_TEXT_FILE_SIZE) {
    throw new Error("O arquivo excede o limite de 2 MB para importacao como nota.");
  }

  const content = await file.text();
  savePendingIntent({
    title: fileTitle(file),
    content,
    source: "file",
  });

  window.dispatchEvent(new CustomEvent("neuronex:pwa-intent-ready"));

  if (window.location.pathname !== "/pwa-intent") {
    window.location.assign("/pwa-intent?mode=file");
  }
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento local da PWA."));
  });

const openIntentDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PWA_QUEUE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PWA_QUEUE_STORE)) {
        const store = db.createObjectStore(PWA_QUEUE_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir fila offline da PWA."));
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Falha na transacao offline da PWA."));
    transaction.onabort = () => reject(transaction.error || new Error("Transacao offline da PWA abortada."));
  });

export const listQueuedPwaIntents = async (): Promise<QueuedPwaIntent[]> => {
  if (!isBrowser() || !("indexedDB" in window)) return [];
  const db = await openIntentDb();
  try {
    const transaction = db.transaction(PWA_QUEUE_STORE, "readonly");
    const records = await requestToPromise<QueuedPwaIntent[]>(transaction.objectStore(PWA_QUEUE_STORE).getAll());
    return records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } finally {
    db.close();
  }
};

export const queuePwaIntent = async (intent: PendingPwaIntent): Promise<QueuedPwaIntent | null> => {
  if (!isBrowser() || !("indexedDB" in window)) return null;

  const record: QueuedPwaIntent = {
    ...intent,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  const db = await openIntentDb();
  try {
    const transaction = db.transaction(PWA_QUEUE_STORE, "readwrite");
    transaction.objectStore(PWA_QUEUE_STORE).put(record);
    await transactionDone(transaction);
  } finally {
    db.close();
  }

  await requestPwaIntentSync();
  window.dispatchEvent(new CustomEvent("neuronex:pwa-intent-queued", { detail: record }));
  return record;
};

export const removeQueuedPwaIntent = async (id: string) => {
  if (!isBrowser() || !("indexedDB" in window)) return;
  const db = await openIntentDb();
  try {
    const transaction = db.transaction(PWA_QUEUE_STORE, "readwrite");
    transaction.objectStore(PWA_QUEUE_STORE).delete(id);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
};

export const markQueuedPwaIntentAttempt = async (record: QueuedPwaIntent, error: unknown) => {
  if (!isBrowser() || !("indexedDB" in window)) return;
  const db = await openIntentDb();
  try {
    const transaction = db.transaction(PWA_QUEUE_STORE, "readwrite");
    transaction.objectStore(PWA_QUEUE_STORE).put({
      ...record,
      attempts: record.attempts + 1,
      lastError: error instanceof Error ? error.message : "Falha ao sincronizar nota offline.",
    });
    await transactionDone(transaction);
  } finally {
    db.close();
  }
};

export const requestPwaIntentSync = async () => {
  if (!isBrowser() || !("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready as RegistrationWithBackgroundApis;
    if (registration.sync?.register) {
      await registration.sync.register(PWA_INTENT_SYNC_TAG);
      return true;
    }
    registration.active?.postMessage({ type: "QUEUE_INTENT_SYNC" });
  } catch (error) {
    console.warn("[NeuroNex PWA] Background Sync indisponivel.", error);
  }

  return false;
};

export const setPwaBadge = async (count?: number) => {
  if (!isBrowser()) return;
  const pwaNavigator = navigator as PwaNavigator;

  try {
    if (count && count > 0 && pwaNavigator.setAppBadge) {
      await pwaNavigator.setAppBadge(count);
      return;
    }
    if (pwaNavigator.clearAppBadge) await pwaNavigator.clearAppBadge();
  } catch (error) {
    console.warn("[NeuroNex PWA] Nao foi possivel atualizar o badge.", error);
  }
};

export const registerPwaLaunchHandlers = () => {
  const launchQueue = (window as PwaWindow).launchQueue;
  if (!launchQueue?.setConsumer) return;

  launchQueue.setConsumer(async (params) => {
    const firstFile = params.files?.[0];
    if (!firstFile) return;

    try {
      await handleIncomingFile(firstFile);
    } catch (error) {
      console.error("[NeuroNex PWA] Nao foi possivel importar o arquivo.", error);
    }
  });
};

const registerWindowControlsOverlay = () => {
  const overlay = (navigator as PwaNavigator).windowControlsOverlay;
  if (!overlay) return;

  const apply = () => {
    document.documentElement.dataset.windowControlsOverlay = overlay.visible ? "true" : "false";
  };

  overlay.addEventListener("geometrychange", apply);
  apply();
};

const registerPeriodicSync = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready as RegistrationWithBackgroundApis;
    registration.active?.postMessage({ type: "REFRESH_WIDGETS" });

    if (!registration.periodicSync?.register || !navigator.permissions?.query) return;

    const permission = await navigator.permissions.query(({
      name: "periodic-background-sync",
    } as unknown) as PermissionDescriptor);

    if (permission.state === "granted") {
      await registration.periodicSync.register(PWA_PERIODIC_SYNC_TAG, {
        minInterval: PERIODIC_SYNC_INTERVAL_MS,
      });
    }
  } catch (error) {
    console.info("[NeuroNex PWA] Periodic Sync nao esta ativo neste ambiente.", error);
  }
};

export const registerPwaBackgroundCapabilities = () => {
  if (!isBrowser()) return;

  registerWindowControlsOverlay();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NEURONEX_FLUSH_PWA_QUEUE") {
        window.dispatchEvent(new CustomEvent("neuronex:pwa-flush-request"));
      }
    });
    void registerPeriodicSync();
  }
};

export const buildIntentFromSearchParams = (params: URLSearchParams): PendingPwaIntent | null => {
  const mode = params.get("mode");

  if (mode === "new-note") {
    return {
      title: "Nova Nota",
      content: "",
      source: "note",
    };
  }

  const shareTitle = params.get("shareTitle")?.trim() ?? "";
  const shareText = params.get("shareText")?.trim() ?? "";
  const shareUrl = params.get("shareUrl")?.trim() ?? "";

  if (shareTitle || shareText || shareUrl) {
    return {
      title: shareTitle || "Conteudo compartilhado",
      content: [shareText, shareUrl].filter(Boolean).join("\n\n"),
      source: "share",
    };
  }

  const protocol = params.get("protocol")?.trim();
  if (protocol) {
    return {
      title: "Conteudo aberto pelo NeuroNex AI",
      content: protocol,
      source: "protocol",
    };
  }

  return null;
};
