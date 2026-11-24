// Service worker mínimo: permite instalar la app y abrirla sin conexión.
// Red primero para los archivos propios (así siempre ves la última versión publicada);
// caché primero para fuentes y librerías con versión fija.
const CACHE = 'ssam-equipo-v2';
const BASE = ['./', './index.html', './styles.css', './app.js', './actividad.js', './store.js', './datos.js', './ui.js', './mecha.js', './widgets.js', './arrastre.js', './icons/iso.png', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const propio = url.origin === location.origin;
  if (propio) {
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
  } else if (/unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })));
  }
});

// Lista para la fase 3: aquí llegarán las notificaciones push del sistema.
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : { titulo: 'SSAM', texto: 'Tienes un aviso nuevo.' };
  e.waitUntil(self.registration.showNotification(d.titulo, { body: d.texto, icon: './icons/icon-192.png', badge: './icons/icon-192.png' }));
});
