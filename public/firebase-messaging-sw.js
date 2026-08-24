/* global firebase */

/*
 * NeuroNex AI unified service worker.
 *
 * Privacy rule: cache only the public shell, widget assets and static
 * same-origin app assets. API responses, Supabase traffic, authenticated JSON
 * and clinical data are never cached by this worker.
 */

const APP_NAME = 'NeuroNex AI';
const CACHE_NAME = 'neuronex-ai-pwa-v5';
const PWA_INTENT_SYNC_TAG = 'neuronex-pwa-intent-sync';
const PWA_PERIODIC_SYNC_TAG = 'neuronex-ai-periodic-refresh';
const WIDGET_TAG = 'neuronex-ai-safe-overview';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/pwa-192.png',
  '/pwa-512.png',
  '/favicon-dark.png',
  '/favicon-light.png',
  '/widgets/clinic-overview-template.json',
  '/widgets/clinic-overview-data.json',
];

const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image', 'manifest']);
const API_PATH_MARKERS = ['/api/', '/functions/v1/', '/auth/v1/', '/rest/v1/', '/storage/v1/', '/realtime/v1/'];

let messaging = null;

try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  const params = new URL(self.location.href).searchParams;
  const config = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
  };

  const missingConfig = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingConfig.length === 0) {
    firebase.initializeApp(config);
    messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};

      return showNeuroNotification({
        title: notification.title || APP_NAME,
        body: notification.body || 'Voce possui uma nova atualizacao.',
        tag: data.notificationId || 'neuronex-notification',
        actionUrl: data.actionUrl || '/dashboard',
        badgeCount: Number(data.unreadCount || data.badgeCount || 0),
      });
    });
  } else {
    console.info('[NeuroNex AI Worker] PWA ativa; Firebase aguardando configuracao.', missingConfig);
  }
} catch (error) {
  console.warn('[NeuroNex AI Worker] Firebase Messaging indisponivel; PWA continuara ativa.', error);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('neuronex-pwa-') || key.startsWith('neuronex-ai-pwa-'))
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      updateWidgets(),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'SET_BADGE') {
    event.waitUntil(setAppBadge(Number(event.data?.count || 0)));
    return;
  }
  if (type === 'CLEAR_BADGE') {
    event.waitUntil(clearAppBadge());
    return;
  }
  if (type === 'QUEUE_INTENT_SYNC') {
    event.waitUntil(requestIntentSync());
    return;
  }
  if (type === 'REFRESH_WIDGETS') {
    event.waitUntil(updateWidgets());
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (isApiLikePath(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/widgets/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  if (!payload || isFirebasePushPayload(payload)) return;

  const title = payload.title || payload.notificationTitle;
  const body = payload.body || payload.message;
  if (!title && !body) return;

  event.waitUntil(showNeuroNotification({
    title: title || APP_NAME,
    body: body || 'Nova atualizacao no NeuroNex AI.',
    tag: payload.notificationId || payload.tag || 'neuronex-direct-push',
    actionUrl: payload.actionUrl || payload.url || '/dashboard',
    badgeCount: Number(payload.unreadCount || payload.badgeCount || 0),
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.action === 'open-notes'
    ? '/notas'
    : event.notification.data?.actionUrl || '/dashboard';

  event.waitUntil(
    Promise.all([
      clearAppBadge(),
      openAppPath(actionUrl),
    ]),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === PWA_INTENT_SYNC_TAG) {
    event.waitUntil(notifyClientsToFlushQueue());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === PWA_PERIODIC_SYNC_TAG) {
    event.waitUntil(Promise.all([
      refreshShellCache(),
      updateWidgets(),
    ]));
  }
});

self.addEventListener('widgetinstall', (event) => {
  event.waitUntil(updateWidgets());
});

self.addEventListener('widgetresume', (event) => {
  event.waitUntil(updateWidgets());
});

self.addEventListener('widgetclick', (event) => {
  const action = typeof event.action === 'string' ? event.action : String(event.action?.verb || '');
  const target = action === 'new-note'
    ? '/pwa-intent?mode=new-note'
    : action === 'open-agenda'
      ? '/agenda'
      : '/dashboard';
  event.waitUntil(openAppPath(target));
});

function isApiLikePath(pathname) {
  return API_PATH_MARKERS.some((marker) => pathname.startsWith(marker) || pathname.includes(marker));
}

function readPushPayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

function isFirebasePushPayload(payload) {
  return Boolean(
    payload?.firebaseMessaging ||
    payload?.fcmMessageId ||
    payload?.from ||
    payload?.collapse_key ||
    payload?.notification ||
    payload?.data?.notificationId
  );
}

async function showNeuroNotification({ title, body, tag, actionUrl, badgeCount }) {
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;

  await setAppBadge(badgeCount);
  await self.registration.showNotification(title || APP_NAME, {
    body: body || 'Nova atualizacao no NeuroNex AI.',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: tag || 'neuronex-ai-notification',
    data: { actionUrl: actionUrl || '/dashboard' },
    actions: [
      { action: 'open-app', title: 'Abrir app' },
      { action: 'open-notes', title: 'Notas' },
    ],
  });
}

async function setAppBadge(count) {
  try {
    if (count > 0 && self.navigator?.setAppBadge) {
      await self.navigator.setAppBadge(count);
    } else if (self.navigator?.clearAppBadge) {
      await self.navigator.clearAppBadge();
    }
  } catch (error) {
    console.info('[NeuroNex AI Worker] Badge indisponivel.', error);
  }
}

async function clearAppBadge() {
  try {
    if (self.navigator?.clearAppBadge) await self.navigator.clearAppBadge();
  } catch (error) {
    console.info('[NeuroNex AI Worker] Nao foi possivel limpar badge.', error);
  }
}

async function requestIntentSync() {
  try {
    if (self.registration.sync?.register) {
      await self.registration.sync.register(PWA_INTENT_SYNC_TAG);
      return;
    }
  } catch (error) {
    console.info('[NeuroNex AI Worker] Background Sync nao pode ser registrado.', error);
  }
  await notifyClientsToFlushQueue();
}

async function notifyClientsToFlushQueue() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windows.length > 0) {
    windows.forEach((client) => client.postMessage({ type: 'NEURONEX_FLUSH_PWA_QUEUE' }));
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    await self.registration.showNotification(APP_NAME, {
      body: 'Ha anotacoes recebidas aguardando sincronizacao quando voce abrir o app.',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: 'neuronex-ai-offline-notes',
      data: { actionUrl: '/pwa-intent' },
    });
  }
}

async function networkNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/offline.html')) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkRequest = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkRequest;
    return cached;
  }

  return (await networkRequest) || Response.error();
}

async function refreshShellCache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    PRECACHE_URLS.map((url) =>
      fetch(url, { cache: 'no-store' })
        .then((response) => response.ok && response.type === 'basic' ? cache.put(url, response) : undefined)
        .catch(() => undefined),
    ),
  );
}

async function openAppPath(path) {
  const target = new URL(path || '/dashboard', self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of windows) {
    if ('navigate' in client) {
      await client.navigate(target);
      if ('focus' in client) return client.focus();
      return;
    }
  }

  if (self.clients.openWindow) return self.clients.openWindow(target);
}

async function updateWidgets() {
  if (!self.widgets?.getByTag || !self.widgets?.updateByTag) return;

  try {
    const widget = await self.widgets.getByTag(WIDGET_TAG);
    if (!widget?.definition) return;

    const templateUrl = widget.definition.msAcTemplate || widget.definition.ms_ac_template || '/widgets/clinic-overview-template.json';
    const dataUrl = widget.definition.data || '/widgets/clinic-overview-data.json';
    const [template, baseData] = await Promise.all([
      fetch(new URL(templateUrl, self.location.origin), { cache: 'no-store' }).then((response) => response.text()),
      fetch(new URL(dataUrl, self.location.origin), { cache: 'no-store' }).then((response) => response.json()).catch(() => ({})),
    ]);
    const data = JSON.stringify({
      headline: baseData.headline || 'Resumo seguro pronto. Abra o app para ver dados completos da clinica.',
      today: baseData.today || 'Painel disponivel',
      alerts: baseData.alerts || 'Sem dados sensiveis no widget',
      notes: baseData.notes || 'Criacao rapida ativa',
    });

    await self.widgets.updateByTag(WIDGET_TAG, { template, data });
  } catch (error) {
    console.info('[NeuroNex AI Worker] Widget ainda nao pode ser atualizado.', error);
  }
}
