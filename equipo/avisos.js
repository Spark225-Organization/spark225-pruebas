// Avisos del sistema (notificaciones). En celular se muestran a través del service worker,
// que es la forma que aceptan Android y iPhone; en la compu también funciona así.
export async function pedirAvisos() {
  if (!('Notification' in window)) return 'no';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch (_) { return 'default'; }
}

export async function notificar(cuerpo, { tag, url } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opciones = { body: cuerpo, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag, data: { url: url || location.href } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) return await reg.showNotification('Portal de colaboradores', opciones);
    new Notification('Portal de colaboradores', opciones);
  } catch (_) { /* sin notificaciones */ }
}

// Da de alta este dispositivo para recibir avisos con el Portal cerrado (Web Push).
const VAPID_PUBLICA = 'BA4S3y5d5Ms7ZQJ9heIlDRPqiP2nBCSCNV12mKogdJW9g43_hl72obFCEjpia0xM188nLk1Xm_OmsI4yCg8AlJQ';
const aBytes = (b64) => { const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export const pushDisponible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function activarPush(persona) {
  if (!persona || !pushDisponible() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) }));
    const { guardarSuscripcion } = await import('./nube.js?v=202611270700');
    const ua = navigator.userAgent;
    await guardarSuscripcion(persona, sub, /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Computadora');
    return true;
  } catch (_) { return false; }
}
