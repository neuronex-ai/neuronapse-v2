/*
 * Legacy NeuroNex worker migration shim.
 *
 * The real PWA, offline and push logic now lives in /firebase-messaging-sw.js.
 * This file only cleans up older installations that may still have /sw.js
 * registered from previous packages.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) await client.navigate(client.url);
    }
  })());
});
