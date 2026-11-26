// Guía para instalar el Portal como app (iPhone, Android o computadora) y activar los avisos.
// Elige sola la pestaña según el dispositivo; se abre desde Perfil › Instalar en tu teléfono.
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I } from './ui.js?v=202611270330';
import { pedirAvisos, activarPush, pushDisponible } from './avisos.js?v=202611270330';

const ua = navigator.userAgent;
const esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esAndroid = /Android/.test(ua);
export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Chrome (Android y compu) avisa que se puede instalar: se guarda para ofrecer el botón «Instalar ahora».
let aviso = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; });

const PASOS = {
  iphone: [
    ['Abre <b>portal.spark225.com</b> en <b>Safari</b>.', 'En iPhone solo se instala desde Safari, no desde Chrome.'],
    ['Toca el botón <b>Compartir</b>: el cuadro con la flecha hacia arriba, abajo al centro.', null],
    ['Desliza y toca <b>Agregar a pantalla de inicio</b>, luego <b>Agregar</b>.', null],
    ['Abre <b>Colaboradores</b> desde tu pantalla de inicio y entra con Google.', 'Desde el ícono, no desde Safari: solo así te llegan los avisos.'],
    ['Vuelve aquí (Perfil › Instalar en tu teléfono) y toca <b>Activar avisos</b>.', 'Necesitas iOS 16.4 o más reciente.'],
  ],
  android: [
    ['Abre <b>portal.spark225.com</b> en <b>Chrome</b>.', null],
    ['Toca el menú <b>⋮</b> (arriba a la derecha) y luego <b>Instalar app</b>.', 'Si no aparece, busca «Agregar a la pantalla principal».'],
    ['Confirma con <b>Instalar</b>.', null],
    ['Abre <b>Colaboradores</b> desde tu pantalla y entra con Google.', null],
    ['Toca <b>Activar avisos</b> aquí y elige <b>Permitir</b>.', null],
  ],
  compu: [
    ['Abre <b>portal.spark225.com</b> en <b>Chrome</b>.', null],
    ['En la barra de direcciones, a la derecha, toca el ícono de <b>Instalar</b> (una pantalla con flecha).', 'O menú ⋮ › Transmitir, guardar y compartir › Instalar página como app. En Safari de Mac: Archivo › Agregar al Dock.'],
    ['Se abre en su propia ventana: ánclala a tu barra o Dock.', null],
    ['Toca <b>Activar avisos</b> aquí y elige <b>Permitir</b>.', null],
  ],
};

export function Instalar({ cerrar, toast, persona }) {
  const [tab, setTab] = useState(esIOS ? 'iphone' : esAndroid ? 'android' : 'compu');
  const [permiso, setPermiso] = useState('Notification' in window ? Notification.permission : 'no');
  const [puede, setPuede] = useState(!!aviso);
  useEffect(() => { const f = () => setPuede(true); addEventListener('beforeinstallprompt', f); return () => removeEventListener('beforeinstallprompt', f); }, []);
  useEffect(() => { const f = (e) => e.key === 'Escape' && cerrar(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);

  const yaInstalada = instalada();
  const instalarAhora = async () => {
    if (!aviso) return;
    aviso.prompt();
    const r = await aviso.userChoice.catch(() => null);
    aviso = null; setPuede(false);
    if (r?.outcome === 'accepted') toast('Listo: ya está instalada');
  };
  const activar = async () => {
    const r = await pedirAvisos();
    setPermiso(r);
    if (r === 'granted' && await activarPush(persona)) {
      const { avisoDePrueba } = await import('./nube.js?v=202611270330');
      const p = await avisoDePrueba().catch(() => ({}));
      return toast(p.ok ? 'Listo: te mandamos un aviso de prueba' : 'Avisos activados');
    }
    toast(r === 'granted' ? 'Avisos activados en este navegador' : r === 'denied' ? 'Los avisos están bloqueados: actívalos en los ajustes del navegador' : 'Instala primero la app para activar los avisos');
  };
  const probar = async () => {
    if (!(await activarPush(persona))) return toast('No pude dar de alta este dispositivo');
    const { avisoDePrueba } = await import('./nube.js?v=202611270330');
    const p = await avisoDePrueba().catch(() => ({}));
    toast(p.ok ? 'Enviado: debe llegarte en unos segundos' : 'No pude mandar el aviso de prueba');
  };
  const iosSinInstalar = esIOS && !yaInstalada;

  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="bienv instalar" role="dialog" aria-modal="true" aria-label="Instalar el Portal en tu teléfono">
      <button class="icon-btn inst-cerrar" aria-label="Cerrar" onClick=${cerrar}>${I('x')}</button>
      <div class="bienv-ico google">${I('celular')}</div>
      <h2>Instala el Portal en tu teléfono</h2>
      <p class="bienv-sub">Queda como una app más, con su ícono, y te avisa de lo importante: juntas por aceptar, notas de Gemini y tareas que te asignan.</p>

      <div class="inst-estado">
        <span class=${yaInstalada ? 'ok' : ''}>${I(yaInstalada ? 'check' : 'reloj')}${yaInstalada ? 'Instalada en este dispositivo' : 'Aún no instalada aquí'}</span>
        <span class=${permiso === 'granted' ? 'ok' : ''}>${I(permiso === 'granted' ? 'check' : 'campana')}${permiso === 'granted' ? 'Avisos activados' : permiso === 'denied' ? 'Avisos bloqueados' : 'Avisos sin activar'}</span>
      </div>

      <div class="segmentado inst-tabs" role="tablist">
        ${[['iphone', 'iPhone'], ['android', 'Android'], ['compu', 'Computadora']].map(([k, t]) => html`<button key=${k} role="tab" aria-selected=${tab === k} aria-pressed=${tab === k} onClick=${() => setTab(k)}>${t}</button>`)}
      </div>

      <ol class="inst-pasos">
        ${PASOS[tab].map(([t, nota], i) => html`<li key=${tab + i}><span class="inst-n">${i + 1}</span><span><span dangerouslySetInnerHTML=${{ __html: t }}></span>${nota && html`<small>${nota}</small>`}</span></li>`)}
      </ol>

      <div class="bienv-acc">
        ${puede && !yaInstalada && tab !== 'iphone' && html`<button class="btn prim" onClick=${instalarAhora}>Instalar ahora</button>`}
        ${permiso !== 'granted' && permiso !== 'no' && html`<button class=${'btn ' + (puede && !yaInstalada ? 'fantasma' : 'prim')} disabled=${iosSinInstalar} onClick=${activar}>Activar avisos</button>`}
        ${permiso === 'granted' && html`<button class="btn fantasma" onClick=${probar}>Mandarme un aviso de prueba</button><button class="btn prim" onClick=${cerrar}>Listo</button>`}
      </div>
      ${iosSinInstalar && permiso !== 'granted' && html`<p class="inst-nota">${I('alerta')}En iPhone, «Activar avisos» funciona después de instalarla y abrirla desde el ícono.</p>`}
      <p class="inst-nota tenue">${I('reloj')}Con los avisos activados te llegan aunque el Portal esté cerrado, como WhatsApp (pueden tardar hasta 5 minutos).</p>
    </div>`;
}
