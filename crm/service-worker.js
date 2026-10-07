// Future Secure Providers CRM Service Worker
const CACHE_NAME = 'fsp-crm-v49';
const RUNTIME_CACHE = 'fsp-crm-runtime-v49';
const APP_SHELL = ['./', './index.html?v=46', './manifest.json?v=47', '../pwa-icon.svg'];

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
             .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents: always use network first so CRM UI updates immediately; cache only as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then(async response => {
        if (response && response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put('./index.html?v=46', response.clone());
        }
        return response;
      }).catch(async () => (await caches.match('./index.html?v=46')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    );
    return;
  }

  // Manifest: network first so install metadata never gets stuck on an old cached version.
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(fetch(request).then(response => {
      if (response && response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }

  // Same-origin static assets: cache first, then network and refresh runtime cache.
  if (/\.(?:js|css|png|jpg|jpeg|svg|gif|json|woff2?|ttf|eot|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (_) { data = { body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Future Secure Providers CRM', {
    body: data.body || 'New notification',
    icon: '../pwa-icon.svg',
    badge: '../pwa-icon.svg',
    tag: data.tag || 'fsp-crm-notification',
    requireInteraction: !!data.requireInteraction
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow('./') : undefined;
    })
  );
});

self.addEventListener('push',event=>{
 let data={title:'FSP CRM',body:'New lead received',url:'./'};
 try{if(event.data)data={...data,...event.data.json()};}catch(e){}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'../pwa-icon.svg',badge:'../pwa-icon.svg',tag:'fsp-new-lead',renotify:true,data:{url:data.url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c){c.navigate(target);return c.focus();}}return clients.openWindow(target);}));
});
