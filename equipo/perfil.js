// Personaliza tu perfil: foto (subida, de Google o de Notion), color, nombre corto y puesto,
// y cómo se ve tu Portal (tema, color de acento, tamaño y los highlights del Inicio).
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { cambiarMiPerfil, prefsDe, guardarPrefs, esAdmin } from './store.js?v=202611270330';
import { I, Avatar } from './ui.js?v=202611270330';

export const ACENTOS = [
  { id: 'spark', nombre: 'Spark', color: '#E47739' },
  { id: 'azul', nombre: 'Azul', color: '#3B82E0' },
  { id: 'verde', nombre: 'Verde', color: '#1F9E78' },
  { id: 'violeta', nombre: 'Violeta', color: '#7C66E8' },
  { id: 'rosa', nombre: 'Rosa', color: '#D9507F' },
  { id: 'pizarra', nombre: 'Pizarra', color: '#4E5964' },
];
const COLORES_AVATAR = ['#E47739', '#4E5964', '#1F8A73', '#3B82E0', '#7C66E8', '#D9507F', '#C9862B', '#2BA3B8'];

// Aplica tus preferencias de interfaz a toda la app (se llama desde app.js).
export function aplicarInterfaz(prefs) {
  const r = document.documentElement;
  const ac = ACENTOS.find((a) => a.id === prefs.acento) || ACENTOS[0];
  r.style.setProperty('--chispa', ac.color);
  r.style.setProperty('--brasa-fondo', `color-mix(in srgb, ${ac.color} 14%, transparent)`);
  r.dataset.letra = prefs.letra || 'normal';
  r.dataset.densidad = prefs.densidad || 'comoda';
  r.dataset.menu = prefs.menu || 'abajo';
}

function reducirFoto(archivo) {
  return new Promise((ok, mal) => {
    if (!archivo || !/^image\//.test(archivo.type)) return mal(new Error('Elige una imagen.'));
    const img = new Image();
    img.onload = () => {
      // Recorte cuadrado al centro, 256 px.
      const lado = Math.min(img.width, img.height), t = 256;
      const cv = Object.assign(document.createElement('canvas'), { width: t, height: t });
      cv.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, t, t);
      URL.revokeObjectURL(img.src);
      ok(cv.toDataURL('image/webp', 0.86));
    };
    img.onerror = () => mal(new Error('No pude leer esa imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

export function EditarPerfil({ db, yo, tema, setTema, cerrar, toast, enNube }) {
  const p = db.personas.find((x) => x.id === yo);
  const prefs = prefsDe(yo);
  const [corto, setCorto] = useState(p.corto);
  const [puesto, setPuesto] = useState(p.puesto || '');
  const [ocupado, setOcupado] = useState('');
  useEffect(() => { const f = (e) => e.key === 'Escape' && cerrar(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);

  const guardar = async (cambios, ok) => {
    try { await cambiarMiPerfil(yo, cambios); if (ok) toast(ok); }
    catch (err) { toast(err.message); }
  };
  const subir = async (e) => {
    try { await guardar({ foto: await reducirFoto(e.target.files[0]) }, 'Foto actualizada'); }
    catch (err) { toast(err.message); }
    e.target.value = '';
  };
  const deGoogle = async () => {
    setOcupado('google');
    const { fotoDeGoogle } = await import('./nube.js?v=202611270330');
    const url = await fotoDeGoogle().catch(() => null);
    setOcupado('');
    if (!url) return toast('Tu cuenta de Google no tiene foto');
    guardar({ foto: url }, 'Listo: usamos tu foto de Google');
  };
  const deNotion = async (todos) => {
    setOcupado(todos ? 'equipo' : 'notion');
    const { fotosNotion } = await import('./nube.js?v=202611270330');
    const r = await fotosNotion(todos).catch((e) => ({ ok: false, error: e.message }));
    setOcupado('');
    if (!r?.ok) return toast(r?.error || 'No pude traer la foto de Notion');
    toast(todos ? `Listo: ${r.actualizadas} ${r.actualizadas === 1 ? 'foto' : 'fotos'} del equipo` : r.actualizadas ? 'Listo: usamos tu foto de Notion' : 'Tu cuenta de Notion no tiene foto');
  };
  const pref = (cambios) => guardarPrefs(yo, cambios);
  const guardarTexto = () => {
    const c = corto.trim(), pu = puesto.trim();
    if (!c) return toast('Escribe cómo te dicen');
    if (c !== p.corto || pu !== (p.puesto || '')) guardar({ corto: c, puesto: pu }, 'Perfil guardado');
  };

  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="bienv perfil-ed" role="dialog" aria-modal="true" aria-label="Personaliza tu perfil">
      <button class="icon-btn inst-cerrar" aria-label="Cerrar" onClick=${cerrar}>${I('x')}</button>
      <h2>Tu perfil</h2>

      <section class="pe-foto">
        <span class="pe-avatar"><${Avatar} p=${p} grande /></span>
        <div class="pe-foto-acc">
          <label class="btn prim chico">${I('subir')}Subir foto<input type="file" accept="image/*" class="oculto" onChange=${subir} /></label>
          ${enNube && html`<button class="btn chico" disabled=${!!ocupado} onClick=${deGoogle}>${ocupado === 'google' ? 'Buscando…' : 'Usar la de Google'}</button>`}
          ${enNube && html`<button class="btn chico" disabled=${!!ocupado} onClick=${() => deNotion(false)}>${ocupado === 'notion' ? 'Buscando…' : 'Usar la de Notion'}</button>`}
          ${p.foto && html`<button class="btn fantasma chico" onClick=${() => guardar({ foto: null }, 'Foto quitada')}>Quitar</button>`}
        </div>
      </section>
      ${enNube && esAdmin(yo) && html`<button class="enlace pe-equipo" disabled=${!!ocupado} onClick=${() => deNotion(true)}>${I('equipo')}${ocupado === 'equipo' ? 'Trayendo fotos…' : 'Traer las fotos de todo el equipo desde Notion'}</button>`}

      <section class="pe-campos">
        <label class="campo"><span>Cómo te dicen</span><input class="control" value=${corto} maxlength="24" onInput=${(e) => setCorto(e.target.value)} onBlur=${guardarTexto} /></label>
        <label class="campo"><span>Puesto</span><input class="control" value=${puesto} maxlength="60" onInput=${(e) => setPuesto(e.target.value)} onBlur=${guardarTexto} /></label>
      </section>

      <section class="pe-grupo">
        <h3>Tu color</h3>
        <p class="tb-sub">Así te reconocen en el calendario y en las tareas, si no tienes foto.</p>
        <div class="pe-colores" role="radiogroup" aria-label="Tu color">${COLORES_AVATAR.map((c) => html`<button key=${c} role="radio" aria-checked=${p.color === c} aria-label=${c} style=${`--c:${c}`} onClick=${() => guardar({ color: c })}></button>`)}</div>
      </section>

      <section class="pe-grupo">
        <h3>Cómo se ve tu Portal</h3>
        <div class="pe-fila"><span>Tema</span>
          <div class="segmentado chico">${[['dark', 'Oscuro'], ['light', 'Claro']].map(([k, t]) => html`<button key=${k} aria-pressed=${tema === k} onClick=${() => setTema(k)}>${t}</button>`)}</div></div>
        <div class="pe-fila"><span>Color de acento</span>
          <div class="pe-colores chicos" role="radiogroup" aria-label="Color de acento">${ACENTOS.map((a) => html`<button key=${a.id} role="radio" aria-checked=${(prefs.acento || 'spark') === a.id} title=${a.nombre} aria-label=${a.nombre} style=${`--c:${a.color}`} onClick=${() => pref({ acento: a.id })}></button>`)}</div></div>
        <div class="pe-fila"><span>Menú principal<small class="pe-nota">En el teléfono siempre va abajo</small></span>
          <div class="segmentado chico">${[['abajo', 'Abajo'], ['lado', 'A un lado']].map(([k, t]) => html`<button key=${k} aria-pressed=${(prefs.menu || 'abajo') === k} onClick=${() => pref({ menu: k })}>${t}</button>`)}</div></div>
        <div class="pe-fila"><span>Tamaño de letra</span>
          <div class="segmentado chico">${[['normal', 'Normal'], ['grande', 'Grande']].map(([k, t]) => html`<button key=${k} aria-pressed=${(prefs.letra || 'normal') === k} onClick=${() => pref({ letra: k })}>${t}</button>`)}</div></div>
        <div class="pe-fila"><span>Espacio</span>
          <div class="segmentado chico">${[['comoda', 'Cómodo'], ['compacta', 'Compacto']].map(([k, t]) => html`<button key=${k} aria-pressed=${(prefs.densidad || 'comoda') === k} onClick=${() => pref({ densidad: k })}>${t}</button>`)}</div></div>
        <label class="pe-fila"><span>Bases de Spark en el Inicio</span>
          <input type="checkbox" class="interruptor" checked=${prefs.bases !== false} onChange=${() => pref({ bases: prefs.bases === false })} /></label>
        <label class="pe-fila"><span>Highlights de Spark en el Inicio</span>
          <input type="checkbox" class="interruptor" checked=${prefs.highlights !== false} onChange=${() => pref({ highlights: prefs.highlights === false })} /></label>
      </section>

      <div class="bienv-acc"><button class="btn prim" onClick=${() => { guardarTexto(); cerrar(); }}>Listo</button></div>
    </div>`;
}
