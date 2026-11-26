// Service worker mínimo: permite instalar la app y abrirla sin conexión.
// Red primero para los archivos propios (así siempre ves la última versión publicada);
// caché primero para fuentes y librerías con versión fija.
const CACHE = 'ssam-equipo-202611270600';
const BASE = ['./', './index.html', './styles.css', './app.js', './actividad.js', './store.js', './datos.js', './ui.js', './mecha.js', './widgets.js', './arrastre.js', './vistas.js', './chat.js', './tour.js', './login.js', './nube.js', './nube-config.js', './google.js', './pipeline.js', './archivero.js', './asistente.js', './bienvenida.js', './instalar.js', './avisos.js', './tablero.js', './rh.js', './perfil.js', './proyectos.js', './bases.js', './vistas-notion.js', './reportes.js', './reportes-datos.js', './icons/iso.png', './icons/icon-192.png'];

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
    // «no-cache»: siempre pregunta al servidor si hay versión nueva (si no la hay, responde rápido con 304).
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
  } else if (/unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })));
  }
});

// Lista para la fase 3: aquí llegarán las notificaciones push del sistema.
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : { titulo: 'SSAM', texto: 'Tienes un aviso nuevo.' };
  e.waitUntil(self.registration.showNotification(d.titulo, { body: d.texto, icon: './icons/icon-192.png', badge: './icons/icon-192.png' }));
});

// Al tocar un aviso: abre el Portal (o lo trae al frente si ya está abierto).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const abierta = ws.find((w) => w.url.includes(self.registration.scope));
    if (abierta) return abierta.focus();
    return self.clients.openWindow(url.startsWith('http') && !url.includes(self.registration.scope) ? './' : url);
  }));
});

// Aviso que manda el servidor (aunque el Portal esté cerrado).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { cuerpo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Portal de colaboradores', {
    body: d.cuerpo || 'Tienes algo nuevo en el Portal.', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: d.tag, data: { url: './' },
  }));
});
