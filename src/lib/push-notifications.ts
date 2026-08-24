import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
  type Unsubscribe,
} from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

type PushQueryResult = {
  data?: unknown[] | null;
  error?: Error | { message?: string } | null;
};

type PushQueryFilter = PromiseLike<PushQueryResult> & {
  eq: (column: string, value: unknown) => PushQueryFilter;
  limit: (count: number) => PushQueryFilter;
};

type PushTable = {
  upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<PushQueryResult>;
  update: (values: Record<string, unknown>) => PushQueryFilter;
  select: (columns: string) => PushQueryFilter;
};

const db = supabase as unknown as {
  from: (table: 'push_subscriptions') => PushTable;
};
const CLIENT_TIMEOUT_MS = 15_000;
const TOKEN_TIMEOUT_MS = 15_000;
const PUSH_FLOW_TIMEOUT_MS = 20_000;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

type PushLogStep =
  | 'push:permission'
  | 'push:worker-registered'
  | 'push:sdk-loaded'
  | 'push:get-token-start'
  | 'push:get-token-success'
  | 'push:subscription-upsert'
  | 'push:settings-save';

let firebaseAppPromise: Promise<FirebaseApp> | null = null;
let messagingClientPromise: Promise<Messaging> | null = null;

export function logPushStep(step: PushLogStep, details?: Record<string, unknown>) {
  console.info(`[${step}]`, details || {});
}

function getMissingFirebaseConfig() {
  return requiredConfigKeys.filter((key) => !config[key]);
}

export function getWebPushAvailability() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'Ambiente sem navegador.' };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Notificacoes nativas exigem HTTPS ou localhost.' };
  }
  if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') {
    return { supported: false, reason: 'Este navegador nao oferece Service Worker/Notification para push nativo.' };
  }
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    return { supported: false, reason: 'Firebase Web Push ainda nao foi configurado.' };
  }
  const missingConfig = getMissingFirebaseConfig();
  if (missingConfig.length > 0) {
    return { supported: false, reason: `Firebase Web Push incompleto: ${missingConfig.join(', ')}.` };
  }
  if (Notification.permission === 'denied') {
    return { supported: false, reason: 'As notificacoes estao bloqueadas neste navegador.' };
  }
  return { supported: true, reason: 'Aparecem no Windows, Android e PWA mesmo com a aba fechada.' };
}

export function getWebPushPermission() {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission;
}

async function assertPushEnvironment() {
  if (!window.isSecureContext) {
    throw new Error('Notificacoes nativas exigem HTTPS ou localhost.');
  }
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    throw new Error('Configure VITE_FIREBASE_VAPID_KEY para ativar notificacoes nativas.');
  }
  const missingConfig = getMissingFirebaseConfig();
  if (missingConfig.length > 0) {
    throw new Error(`Configure Firebase Web Push: ${missingConfig.join(', ')}.`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function createFirebaseApp() {
  const app = getApps().length ? getApp() : initializeApp(config);
  logPushStep('push:sdk-loaded', { projectId: config.projectId });
  return app;
}

function getFirebaseApp() {
  if (!firebaseAppPromise) {
    firebaseAppPromise = Promise.resolve()
      .then(createFirebaseApp)
      .catch((error) => {
        firebaseAppPromise = null;
        throw error;
      });
  }
  return firebaseAppPromise;
}

async function createMessagingClient() {
  await assertPushEnvironment();
  const supported = await isSupported();
  if (!supported) {
    throw new Error('Notificacoes nativas nao sao suportadas neste navegador.');
  }
  return getMessaging(await getFirebaseApp());
}

export async function getMessagingClient() {
  if (!messagingClientPromise) {
    messagingClientPromise = createMessagingClient().catch((error) => {
      messagingClientPromise = null;
      throw error;
    });
  }

  try {
    return await withTimeout(
      messagingClientPromise,
      CLIENT_TIMEOUT_MS,
      'Tempo esgotado ao inicializar o Firebase Messaging.',
    );
  } catch (error) {
    messagingClientPromise = null;
    throw error;
  }
}

const serviceWorkerUrl = () => `/firebase-messaging-sw.js?${new URLSearchParams(Object.entries(config).map(([key, value]) => [key, value || '']))}`;

const getStoredDeviceId = () => localStorage.getItem('neuronex_device_id');

const getOrCreateDeviceId = () => {
  const stored = getStoredDeviceId();
  if (stored) return stored;
  const deviceId = crypto.randomUUID();
  localStorage.setItem('neuronex_device_id', deviceId);
  return deviceId;
};

const deviceInfo = () => {
  const agent = navigator.userAgent;
  const browser = /Edg/i.test(agent) ? 'Edge' : /Chrome/i.test(agent) ? 'Chrome' : /Firefox/i.test(agent) ? 'Firefox' : /Safari/i.test(agent) ? 'Safari' : 'Outro';
  const deviceId = getOrCreateDeviceId();
  return { device_name: `${browser} em ${navigator.platform || 'dispositivo'}`, browser, platform: navigator.platform || 'unknown', device_id: deviceId };
};

async function requestNotificationPermission() {
  if (Notification.permission === 'denied') {
    throw new Error('As notificacoes estao bloqueadas. Libere a permissao no navegador e tente novamente.');
  }

  logPushStep('push:permission', { before: Notification.permission });
  const permission = await Notification.requestPermission();
  logPushStep('push:permission', { after: permission });
  if (permission !== 'granted') throw new Error('A permissao de notificacoes nao foi concedida.');
}

async function registerPushWorker() {
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl()).catch((error) => {
    throw new Error(error instanceof Error ? `Falha ao registrar notificacoes: ${error.message}` : 'Falha ao registrar notificacoes nativas.');
  });
  logPushStep('push:worker-registered', { scope: registration.scope, state: registration.active?.state });
  return registration;
}

async function resolveFcmToken(messaging: Messaging, registration: ServiceWorkerRegistration) {
  logPushStep('push:get-token-start', { scope: registration.scope });
  const token = await withTimeout(
    getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    }),
    TOKEN_TIMEOUT_MS,
    'Tempo esgotado ao obter token de notificacao do Firebase.',
  );
  if (!token) throw new Error('O navegador nao retornou um token de notificacao.');
  logPushStep('push:get-token-success', { tokenSuffix: token.slice(-8) });
  return token;
}

async function enablePushNotificationsInner(userId: string) {
  if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') throw new Error('Notificacoes nativas nao sao suportadas neste dispositivo.');
  await assertPushEnvironment();
  await requestNotificationPermission();
  const registration = await registerPushWorker();
  const messaging = await getMessagingClient();
  const token = await resolveFcmToken(messaging, registration);
  logPushStep('push:subscription-upsert', { userId, deviceId: getOrCreateDeviceId() });
  const { error } = await db.from('push_subscriptions').upsert({ user_id: userId, fcm_token: token, ...deviceInfo(), enabled: true, permission: 'granted', last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,fcm_token' });
  if (error) throw error;
  return token as string;
}

export const enablePushNotifications = (userId: string) => withTimeout(
  enablePushNotificationsInner(userId),
  PUSH_FLOW_TIMEOUT_MS,
  'Tempo esgotado ao ativar notificacoes nativas. Tente novamente em alguns instantes.',
);

export const disablePushNotifications = async (userId: string) => {
  const messaging = await getMessagingClient().catch(() => null);
  if (messaging) await deleteToken(messaging).catch(() => false);
  const deviceId = getStoredDeviceId();
  let query = db.from('push_subscriptions').update({ enabled: false, permission: typeof Notification === 'undefined' ? 'default' : Notification.permission }).eq('user_id', userId);
  if (deviceId) query = query.eq('device_id', deviceId);
  const { error } = await query;
  if (error) throw error;
};

export const hasActivePushSubscription = async (userId: string) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const deviceId = getStoredDeviceId();
  if (!deviceId) return false;
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .eq('enabled', true)
    .limit(1);
  if (error) {
    console.warn('[push:subscription-check]', error);
    return false;
  }
  return Boolean(data?.length);
};

export const listenForForegroundPush = async (handler: (title: string, body: string, actionUrl?: string) => void): Promise<Unsubscribe> => {
  const messaging = await getMessagingClient();
  return onMessage(messaging, (payload: MessagePayload) => handler(payload.notification?.title || 'NeuroNex AI', payload.notification?.body || 'Nova atualizacao.', payload.data?.actionUrl));
};
