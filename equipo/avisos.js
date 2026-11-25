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
