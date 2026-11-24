import { html, render, useState, useEffect, useRef, useCallback } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { ESTATUS, CAPACIDAD_SEMANA, hoyISO, sumarDias } from './datos.js?v=202611241419';
import {
  store, vigentes, participa, siguienteEstatus, cambiarEstatus, alternarFoco, archivar, restaurar,
  borrarDefinitivo, marcarAvisosLeidos, horasEstimadas, esAdmin, mover, visiblePara,
} from './store.js?v=202611241419';
import { I, Anillo, Avatar, fechaRelativa, haceCuanto } from './ui.js?v=202611241419';
import { CajonActividad, HojaMotivo } from './actividad.js?v=202611241419';
import { Dia, AltaRapida } from './mecha.js?v=202611241419';
import { useArrastre } from './arrastre.js?v=202611241419';
import { Galeria } from './widgets.js?v=202611241419';

function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.suscribir(() => set((x) => x + 1)), []);
  return store.get();
}
function useRuta() {
  const leer = () => location.hash.replace(/^#/, '') || '/';
  const [r, set] = useState(leer);
  useEffect(() => { const f = () => set(leer()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
const leerLocal = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
const escribirLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } };
const escribiendo = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

function App() {
  const db = useStore();
  const ruta = useRuta();
  const arr = useArrastre();
  const [yo, setYo] = useState(() => { const v = leerLocal('ssam-equipo-yo', 'adan'); return db.personas.some((p) => p.id === v) ? v : 'adan'; });
  const [tema, setTema] = useState(() => leerLocal('ssam-equipo-tema', 'dark'));
  const [fecha, setFecha] = useState(hoyISO());
  const [cajon, setCajon] = useState(null);
  const [menu, setMenu] = useState(null);
  const [paleta, setPaleta] = useState(false);
  const [avisos, setAvisos] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [rapida, setRapida] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [ultimoCliente, setUltimoCliente] = useState('interno');
  const [galeria, setGaleria] = useState(null);

  useEffect(() => { document.documentElement.dataset.theme = tema; escribirLocal('ssam-equipo-tema', tema); }, [tema]);
  useEffect(() => { escribirLocal('ssam-equipo-yo', yo); }, [yo]);

  const toast = useCallback((texto, accion) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, texto, accion }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const persona = ruta.startsWith('/persona/') ? ruta.split('/')[2] : yo;
  const vista = ruta === '/equipo' ? 'equipo' : ruta === '/papelera' ? 'papelera' : 'dia';

  const ctx = {
    db, yo, persona, fecha, toast, ultimoCliente, setUltimoCliente,
    abrirGaleria: (agregar) => setGaleria({ agregar }),
    abrir: (id) => setCajon({ id }),
    abrirBorrador: (b) => setCajon({ nuevo: b }),
    nueva: (extra = {}) => setCajon({ nuevo: { responsable: persona, fecha, ...extra } }),
    avanzar: (a) => {
      const de = a.estatus;
      const r = cambiarEstatus(a.id, siguienteEstatus(a.estatus), yo);
      if (!r.ok) return toast(r.motivo);
      if (siguienteEstatus(de) === 'hecho') toast(r.repite ? 'Hecho · ya quedó la siguiente' : 'Hecho', { texto: 'Deshacer', f: () => cambiarEstatus(a.id, de, yo) });
    },
    foco: (a) => { const r = alternarFoco(a.id, yo); if (!r.ok) toast('Máximo 3 en foco'); },
    abrirMenu: (ev, a) => {
      ev.preventDefault(); ev.stopPropagation();
      const rc = ev.currentTarget.getBoundingClientRect();
      setMenu({ x: Math.min(ev.clientX || rc.left, innerWidth - 240), y: Math.min(ev.clientY || rc.bottom, innerHeight - 300), a });
    },
    archivarConDeshacer: (a) => { archivar(a.id, yo); toast('Eliminada', { texto: 'Deshacer', f: () => restaurar(a.id, yo) }); },
    // Regla: si cambia el día, se pide el motivo (un toque). Si solo cambia la hora, se mueve directo.
    moverConRegla: (a, cambios) => {
      if (cambios.fecha && cambios.fecha !== a.fecha) {
        setMotivo({ ok: (m) => { mover(a.id, cambios, yo, m); toast(`Movida a ${fechaRelativa(cambios.fecha)}`, { texto: 'Deshacer', f: () => mover(a.id, { fecha: a.fecha, bloque: a.bloque }, yo, 'Deshacer') }); } });
      } else mover(a.id, cambios, yo);
    },
  };

  useEffect(() => {
    const f = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v); return; }
      if (e.key === 'Escape') { setMenu(null); setPerfil(false); setPaleta(false); setAvisos(false); setRapida(null); return; }
      if (escribiendo(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey || cajon || paleta || menu) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); ctx.nueva(); }
      if (e.key === 'ArrowRight' && vista === 'dia') setFecha((f) => sumarDias(f, 1));
      if (e.key === 'ArrowLeft' && vista === 'dia') setFecha((f) => sumarDias(f, -1));
      if (e.key === 't' || e.key === 'T') setFecha(hoyISO());
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  const yoP = db.personas.find((p) => p.id === yo);
  const misAvisos = db.avisos.filter((n) => n.para === yo);
  const sinLeer = misAvisos.filter((n) => !n.leido).length;
  const arrastrandoAlgo = !!arr;

  return html`
    <div class="app">
      <header class="top">
        <button class="yo-btn" onClick=${() => setPerfil(true)} aria-label="Tu perfil"><${Avatar} p=${yoP} grande /></button>
        ${vista === 'dia' ? html`<${Dias} fecha=${fecha} setFecha=${setFecha} db=${db} persona=${persona} yo=${yo} />` : html`<div class="dias"></div>`}
        <div class="top-der">
          <button class="icon-btn" onClick=${() => setPaleta(true)} aria-label="Buscar">${I('buscar')}</button>
          <button class="icon-btn" onClick=${() => setAvisos((v) => !v)} aria-label=${`Avisos${sinLeer ? `, ${sinLeer} nuevos` : ''}`}>${I('campana')}${sinLeer ? html`<span class="punto"></span>` : null}</button>
        </div>
      </header>

      <main class="principal">
        ${vista === 'dia' && html`<${Dia} ...${ctx} />`}
        ${vista === 'equipo' && html`<${Equipo} db=${db} yo=${yo} />`}
        ${vista === 'papelera' && html`<${Papelera} db=${db} yo=${yo} toast=${toast} />`}
      </main>

      <nav class=${'dock' + (arrastrandoAlgo ? ' modo-soltar' : '')} aria-label="Principal">
        ${arrastrandoAlgo
          ? html`<div class=${'zona-papelera' + (arr?.destino?.tipo === 'papelera' ? ' sobre' : '')} data-drop="papelera">${I('papelera')}<span>Eliminar</span></div>`
          : html`
            <a href="#/" class="dock-it" aria-current=${vista === 'dia' && persona === yo ? 'page' : null} onClick=${() => setFecha(hoyISO())}>${I('hoy')}<span>Hoy</span></a>
            <a href="#/equipo" class="dock-it" aria-current=${vista === 'equipo' || persona !== yo ? 'page' : null}>${I('equipo')}<span>Equipo</span></a>
            <button class="dock-mas" onClick=${() => ctx.nueva()} aria-label="Nueva actividad (N)">${I('mas')}</button>
            <button class="dock-it" onClick=${() => setPaleta(true)}>${I('buscar')}<span>Buscar</span></button>
            <a href="#/papelera" class="dock-it" aria-current=${vista === 'papelera' ? 'page' : null}>${I('papelera')}<span>Papelera</span></a>`}
      </nav>

      ${arr && html`<div class="fantasma-arr" style=${`left:${arr.x}px;top:${arr.y}px;--c:${arr.color || 'var(--chispa)'}`}><i></i>${arr.etiqueta}</div>`}
      ${cajon && html`<${CajonActividad} key=${cajon.id || 'nueva'} cajon=${cajon} yo=${yo} db=${db} toast=${toast} cerrar=${() => setCajon(null)}
        pedirMotivo=${(f) => setMotivo({ ok: f })} />`}
      ${motivo && html`<${HojaMotivo} cancelar=${() => setMotivo(null)} elegir=${(m) => { const f = motivo.ok; setMotivo(null); f(m); }} />`}
      ${menu && html`<${MenuEstatus} menu=${menu} cerrar=${() => setMenu(null)} ctx=${ctx} />`}
      ${perfil && html`<${Perfil} db=${db} yo=${yo} setYo=${(v) => { setYo(v); location.hash = '#/'; }} tema=${tema} setTema=${setTema} cerrar=${() => setPerfil(false)} toast=${toast} />`}
      ${paleta && html`<${Paleta} db=${db} yo=${yo} cerrar=${() => setPaleta(false)} ctx=${ctx} setTema=${() => setTema(tema === 'dark' ? 'light' : 'dark')} />`}
      ${avisos && html`<${Avisos} avisos=${misAvisos} yo=${yo} db=${db} abrir=${ctx.abrir} cerrar=${() => setAvisos(false)} toast=${toast} />`}
      ${galeria && html`<${Galeria} db=${db} agregar=${galeria.agregar} cerrar=${() => setGaleria(null)} />`}
      ${rapida && html`<${AltaRapida} pos=${rapida} ctx=${ctx} cerrar=${() => setRapida(null)} />`}
      <div class="toasts" role="status" aria-live="polite">
        ${toasts.map((t) => html`<div class="toast" key=${t.id}><span>${t.texto}</span>${t.accion && html`<button onClick=${() => { t.accion.f(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>${t.accion.texto}</button>`}</div>`)}
      </div>
    </div>`;
}

// ---------- Barra de días: navegar y soltar actividades ----------
function Dias({ fecha, setFecha, db, persona, yo }) {
  const arr = useArrastre();
  const hoy = hoyISO();
  const dias = [-1, 0, 1, 2, 3, 4, 5].map((n) => sumarDias(hoy, n));
  const fmtD = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
  const suyas = vigentes().filter((a) => participa(a, persona) && a.estatus !== 'hecho' && visiblePara(a, yo));
  return html`
    <div class="dias" role="tablist" aria-label="Días">
      ${dias.map((f) => {
        const n = suyas.filter((a) => a.fecha === f).length;
        const sobre = arr?.destino?.tipo === 'dia' && arr.destino.fecha === f;
        const d = new Date(f + 'T12:00:00');
        return html`<button key=${f} role="tab" aria-selected=${f === fecha} class=${'dia-chip' + (f === hoy ? ' hoy' : '') + (sobre ? ' sobre' : '')}
          data-drop="dia" data-fecha=${f} onClick=${() => setFecha(f)} aria-label=${fechaRelativa(f)}>
          <span class="dc-sem">${f === hoy ? 'Hoy' : fmtD.format(d).replace('.', '')}</span>
          <span class="dc-num num">${d.getDate()}</span>
          <span class="dc-puntos">${Array.from({ length: Math.min(n, 4) }).map((_, i) => html`<i key=${i}></i>`)}</span>
        </button>`;
      })}
    </div>`;
}

// ---------- Equipo ----------
function Equipo({ db, yo }) {
  const hoy = hoyISO();
  const d = new Date(hoy + 'T12:00:00');
  const dom = sumarDias(sumarDias(hoy, -((d.getDay() + 6) % 7)), 6);
  return html`
    <div class="equipo">
      ${db.personas.map((p) => {
        const abiertas = vigentes().filter((a) => participa(a, p.id) && a.estatus !== 'hecho' && visiblePara(a, yo));
        const venc = abiertas.filter((a) => a.fecha < hoy).length;
        const h = vigentes().filter((a) => a.responsable === p.id && a.estatus !== 'hecho' && a.fecha <= dom).reduce((s, a) => s + horasEstimadas(a), 0);
        return html`
          <a class="persona-card" key=${p.id} href=${p.id === yo ? '#/' : '#/persona/' + p.id}>
            <span class="pc-av" style=${`--av:${p.color}`}>${p.nombre.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>
            <span class="pc-n">${p.corto}</span>
            <span class="pc-p">${p.puesto}</span>
            <span class="pc-num num">${abiertas.length}${venc ? html`<em>${venc}</em>` : null}</span>
            <span class="barra-c" title=${`${h} de ${CAPACIDAD_SEMANA} h esta semana`}><i class=${h / CAPACIDAD_SEMANA > 0.85 ? 'alta' : ''} style=${`width:${Math.min(100, (h / CAPACIDAD_SEMANA) * 100)}%`}></i></span>
          </a>`;
      })}
    </div>`;
}

// ---------- Papelera ----------
function Papelera({ db, yo, toast }) {
  const lista = db.actividades.filter((a) => a.archivada && (esAdmin(yo) || participa(a, yo))).sort((a, b) => b.archivada.localeCompare(a.archivada));
  if (!lista.length) return html`<div class="vacio">${I('papelera')}<p>Vacía</p></div>`;
  return html`<div class="tabla-simple">${lista.map((a) => {
    const quedan = Math.max(0, db.papeleraDias - Math.floor((Date.now() - new Date(a.archivada).getTime()) / 86400000));
    const c = db.clientes.find((x) => x.id === a.cliente);
    return html`<div class="fila-papelera" key=${a.id} style=${`--c:${c?.color}`}>
      <span class="bolita"></span>
      <div class="cuerpo"><div class="t">${a.titulo}</div><div class="m num">${quedan} d</div></div>
      <button class="icon-btn" title="Restaurar" onClick=${() => { restaurar(a.id, yo); toast('Restaurada'); }}>${I('reset')}</button>
      ${esAdmin(yo) && html`<button class="icon-btn peligro" title="Borrar para siempre" onClick=${() => { if (confirm('¿Borrar para siempre? No se puede recuperar.')) { borrarDefinitivo(a.id, yo); toast('Borrada'); } }}>${I('x')}</button>`}
    </div>`;
  })}</div>`;
}

// ---------- Capas ----------
function cerrarAlTocarFuera(ref, cerrar) {
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    setTimeout(() => addEventListener('pointerdown', f), 0);
    return () => removeEventListener('pointerdown', f);
  }, []);
}

function MenuEstatus({ menu, cerrar, ctx }) {
  const ref = useRef();
  const a = menu.a;
  const cli = ctx.db.clientes.find((c) => c.id === a.cliente);
  cerrarAlTocarFuera(ref, cerrar);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const k = (e) => { const s = ESTATUS.find((x) => x.tecla === e.key); if (s) { e.preventDefault(); poner(s.id); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const poner = (e) => { const r = cambiarEstatus(a.id, e, ctx.yo); if (!r.ok) ctx.toast(r.motivo); cerrar(); };
  const hoy = hoyISO();
  return html`
    <div class="menu" ref=${ref} role="menu" style=${`left:${menu.x}px;top:${menu.y}px;--c:${cli?.color}`}>
      ${ESTATUS.map((s) => html`<button key=${s.id} role="menuitemradio" aria-checked=${a.estatus === s.id} onClick=${() => poner(s.id)}><${Anillo} estatus=${s.id} />${s.nombre}</button>`)}
      <div class="sep"></div>
      <button role="menuitem" onClick=${() => { ctx.foco(a); cerrar(); }}>${I('foco')}${a.foco === hoy ? 'Quitar foco' : 'Foco'}</button>
      <button role="menuitem" onClick=${() => { ctx.moverConRegla(a, { fecha: sumarDias(a.fecha < hoy ? hoy : a.fecha, 1) }); cerrar(); }}>${I('semana')}Mañana</button>
      <button role="menuitem" onClick=${() => { ctx.archivarConDeshacer(a); cerrar(); }}>${I('papelera')}Eliminar</button>
    </div>`;
}

function Perfil({ db, yo, setYo, tema, setTema, cerrar, toast }) {
  const p = db.personas.find((x) => x.id === yo);
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-label="Perfil">
      <div class="hoja-asa"></div>
      <div class="perfil-cab"><${Avatar} p=${p} grande /><div><b>${p.nombre}</b><span>${p.puesto}</span></div></div>
      <div class="perfil-op">
        <button class="op" onClick=${() => setTema(tema === 'dark' ? 'light' : 'dark')}>${I(tema === 'dark' ? 'sol' : 'luna')}<span>${tema === 'dark' ? 'Claro' : 'Oscuro'}</span></button>
        <button class="op" onClick=${() => { store.restablecer(); toast('Datos de prueba restablecidos'); cerrar(); }}>${I('reset')}<span>Reiniciar demo</span></button>
      </div>
      <div class="hoja-t chico">Ver como</div>
      <div class="ver-como">${db.personas.map((x) => html`<button key=${x.id} aria-pressed=${x.id === yo} onClick=${() => { setYo(x.id); cerrar(); }}><${Avatar} p=${x} grande /><span>${x.corto}</span></button>`)}</div>
    </div>`;
}

function Avisos({ avisos, yo, db, abrir, cerrar, toast }) {
  const ref = useRef();
  cerrarAlTocarFuera(ref, cerrar);
  useEffect(() => () => marcarAvisosLeidos(yo), []);
  return html`
    <div class="avisos-panel" ref=${ref} role="dialog" aria-label="Avisos">
      ${avisos.length === 0 ? html`<div class="paleta-vacia">${I('check')}</div>` : avisos.slice(0, 12).map((n) => {
        const a = db.actividades.find((x) => x.id === n.actividad);
        return html`<button class=${'aviso-it' + (n.leido ? '' : ' nuevo')} key=${n.id} onClick=${() => { if (a && !a.archivada) { abrir(a.id); cerrar(); } }}>
          <span class="cuerpo">${n.texto}<span class="cuando">${haceCuanto(n.cuando)}</span></span></button>`;
      })}
    </div>`;
}

function Paleta({ db, yo, cerrar, ctx, setTema }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q.trim());
  const acciones = [
    { t: 'Nueva actividad', ico: 'mas', f: () => ctx.nueva() },
    { t: 'Equipo', ico: 'equipo', f: () => { location.hash = '#/equipo'; } },
    { t: 'Papelera', ico: 'papelera', f: () => { location.hash = '#/papelera'; } },
    { t: 'Claro / oscuro', ico: 'tema', f: setTema },
  ].filter((x) => !t || norm(x.t).includes(t));
  const acts = vigentes().filter((a) => visiblePara(a, yo) && (!t || norm(a.titulo + ' ' + (db.clientes.find((c) => c.id === a.cliente)?.nombre || '')).includes(t)))
    .sort((a, b) => (participa(b, yo) - participa(a, yo)) || a.fecha.localeCompare(b.fecha)).slice(0, t ? 8 : 5)
    .map((a) => ({ t: a.titulo, m: fechaRelativa(a.fecha), c: db.clientes.find((x) => x.id === a.cliente)?.color, f: () => ctx.abrir(a.id) }));
  const pers = db.personas.filter((p) => t && norm(p.nombre + ' ' + p.puesto).includes(t))
    .map((p) => ({ t: p.nombre, p, f: () => { location.hash = p.id === yo ? '#/' : '#/persona/' + p.id; } }));
  const res = [...acts, ...pers, ...acciones];
  useEffect(() => setSel(0), [q]);
  const ejecutar = (r) => { cerrar(); r.f(); };
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="modal-caja" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="paleta-in">${I('buscar')}<input autofocus placeholder="Buscar" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar"
        onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === 'Enter' && res[sel]) { e.preventDefault(); ejecutar(res[sel]); } }} /></div>
      <div class="paleta-res" role="listbox">
        ${res.length === 0 ? html`<div class="paleta-vacia">Sin resultados</div>` : res.map((r, i) => html`
          <button key=${i} class="paleta-op" role="option" aria-selected=${i === sel} onMouseEnter=${() => setSel(i)} onClick=${() => ejecutar(r)}>
            ${r.p ? html`<${Avatar} p=${r.p} />` : r.c ? html`<span class="bolita" style=${`--c:${r.c}`}></span>` : I(r.ico)}<span>${r.t}</span>${r.m && html`<span class="m">${r.m}</span>`}</button>`)}
      </div>
    </div>`;
}

const raiz = document.getElementById('app');
raiz.textContent = '';
render(html`<${App} />`, raiz);

// Solo en HTTPS: en local se desactiva para no quedarse con versiones viejas en caché.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
