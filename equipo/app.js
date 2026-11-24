import { html, render, useState, useEffect, useMemo, useRef, useCallback } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { ESTATUS, JORNADA, CAPACIDAD_SEMANA, hoyISO, sumarDias } from './datos.js';
import {
  store, vigentes, participa, estatusVisible, dependenciaAbierta, siguienteEstatus, cambiarEstatus,
  alternarFoco, archivar, restaurar, borrarDefinitivo, marcarAvisosLeidos, horasEstimadas, esAdmin,
} from './store.js';
import { I, Anillo, Estrella, Avatar, fechaLarga, fechaCorta, fechaRelativa, diasEntre, minutos, hhmm, duracion, haceCuanto } from './ui.js';
import { CajonActividad } from './actividad.js';

// ---------- Estado compartido de la interfaz ----------
function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.suscribir(() => set((x) => x + 1)), []);
  return store.get();
}
function useAhora() {
  const [t, set] = useState(() => new Date());
  useEffect(() => { const k = setInterval(() => set(new Date()), 30000); return () => clearInterval(k); }, []);
  return t;
}
function useRuta() {
  const leer = () => (location.hash.replace(/^#/, '') || '/');
  const [r, set] = useState(leer);
  useEffect(() => { const f = () => set(leer()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
const leerLocal = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
const escribirLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } };
const escribiendo = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

function App() {
  const db = useStore();
  const ruta = useRuta();
  const [yo, setYo] = useState(() => leerLocal('ssam-equipo-yo', 'u1'));
  const [tema, setTema] = useState(() => leerLocal('ssam-equipo-tema', 'dark'));
  const [cajon, setCajon] = useState(null); // { id } o { nuevo: {...} }
  const [menu, setMenu] = useState(null); // { x, y, actividad }
  const [paleta, setPaleta] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);
  const [menuYo, setMenuYo] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => { document.documentElement.dataset.theme = tema; escribirLocal('ssam-equipo-tema', tema); }, [tema]);
  useEffect(() => { escribirLocal('ssam-equipo-yo', yo); }, [yo]);

  const toast = useCallback((texto, accion) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, texto, accion }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const personaVista = ruta.startsWith('/persona/') ? ruta.split('/')[2] : yo;
  const abrir = (id) => setCajon({ id });
  const nueva = (extra = {}) => setCajon({ nuevo: { responsable: personaVista, ...extra } });

  const avanzar = (a) => {
    const de = a.estatus;
    const nuevo = siguienteEstatus(a.estatus);
    const r = cambiarEstatus(a.id, nuevo, yo);
    if (!r.ok) { toast(r.motivo); return; }
    if (nuevo === 'hecho') toast(r.repite ? `Hecho. La siguiente ya quedó agendada.` : `«${a.titulo}» quedó hecha.`, { texto: 'Deshacer', f: () => cambiarEstatus(a.id, de, yo) });
  };
  const ponerEstatus = (a, e) => { const r = cambiarEstatus(a.id, e, yo); if (!r.ok) toast(r.motivo); };
  const foco = (a) => { const r = alternarFoco(a.id, yo); if (!r.ok) toast(r.motivo); };
  const abrirMenu = (ev, a) => {
    ev.preventDefault(); ev.stopPropagation();
    const rc = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX || rc.left, y = ev.clientY || rc.bottom;
    setMenu({ x: Math.min(x, innerWidth - 248), y: Math.min(y, innerHeight - 300), a });
  };

  // Atajos globales: ⌘K buscar, N nueva actividad, Esc cerrar la capa de arriba.
  useEffect(() => {
    const f = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v); return; }
      if (e.key === 'Escape') {
        if (menu) return setMenu(null);
        if (menuYo) return setMenuYo(null);
        if (paleta) return setPaleta(false);
        if (avisosAbiertos) return setAvisosAbiertos(false);
        return;
      }
      if (escribiendo(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (cajon || paleta || menu) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); nueva(); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  const yoP = db.personas.find((p) => p.id === yo);
  const misAvisos = db.avisos.filter((n) => n.para === yo);
  const sinLeer = misAvisos.filter((n) => !n.leido).length;
  const ctx = { db, yo, abrir, nueva, avanzar, abrirMenu, foco, toast, ruta };

  let vista;
  if (ruta === '/' || ruta.startsWith('/persona/')) vista = html`<${Dia} ...${ctx} persona=${personaVista} />`;
  else if (ruta === '/equipo') vista = html`<${Equipo} ...${ctx} />`;
  else if (ruta === '/papelera') vista = html`<${Papelera} ...${ctx} />`;
  else vista = html`<${Proximamente} ruta=${ruta} />`;

  const enPapelera = vigentesArchivadas(db, yo).length;

  return html`
    <div class="app">
      <nav class="riel-nav" aria-label="Principal">
        <div class="marca"><img src="./icons/iso.png" alt="" /><div><b>SSAM</b><small>Equipo Spark225</small></div></div>
        <${NavItem} href="#/" icono="hoy" texto="Tu día" activo=${ruta === '/'} />
        <${NavItem} href="#/semana" icono="semana" texto="Semana" activo=${ruta === '/semana'} prox />
        <${NavItem} href="#/clientes" icono="clientes" texto="Clientes" activo=${ruta === '/clientes'} prox />
        <${NavItem} href="#/proyectos" icono="proyectos" texto="Proyectos" activo=${ruta === '/proyectos'} prox />
        <${NavItem} href="#/equipo" icono="equipo" texto="Equipo" activo=${ruta === '/equipo' || ruta.startsWith('/persona/')} />
        <div class="nav-sep"></div>
        <${NavItem} href="#/papelera" icono="papelera" texto="Papelera" activo=${ruta === '/papelera'} cuenta=${enPapelera || ''} />
        <div class="nav-pie">
          <button class="nav-item" onClick=${() => setTema(tema === 'dark' ? 'light' : 'dark')}>${I(tema === 'dark' ? 'sol' : 'luna')}${tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button>
          <button class="yo" onClick=${(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuYo({ x: r.left, y: r.top - 8 }); }} aria-haspopup="menu">
            <${Avatar} p=${yoP} grande />
            <div><span>${yoP?.nombre}</span><small>${yoP?.puesto} · ver como</small></div>
          </button>
        </div>
      </nav>

      <main class="principal">
        <div class="barra">
          <button class="buscar" onClick=${() => setPaleta(true)}>${I('buscar')}<span>Buscar actividades, personas o acciones</span><kbd>⌘K</kbd></button>
          <span style="flex:1"></span>
          <button class="icon-btn" aria-label=${`Avisos${sinLeer ? `, ${sinLeer} sin leer` : ''}`} onClick=${() => setAvisosAbiertos((v) => !v)}>${I('campana')}${sinLeer ? html`<span class="punto"></span>` : null}</button>
        </div>
        ${vista}
      </main>

      <nav class="nav-movil" aria-label="Principal móvil">
        <a href="#/" aria-current=${ruta === '/' ? 'page' : null}>${I('hoy')}Hoy</a>
        <a href="#/equipo" aria-current=${ruta === '/equipo' ? 'page' : null}>${I('equipo')}Equipo</a>
        <button class="nueva" onClick=${() => nueva()} aria-label="Nueva actividad"><span class="circ">${I('mas')}</span></button>
        <button onClick=${() => setPaleta(true)}>${I('buscar')}Buscar</button>
        <button onClick=${(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuYo({ x: Math.max(16, r.left - 160), y: r.top - 8 }); }}>${I('menu')}Más</button>
      </nav>

      ${cajon && html`<${CajonActividad} key=${cajon.id || 'nueva'} cajon=${cajon} yo=${yo} db=${db} toast=${toast} cerrar=${() => setCajon(null)} abrirMenu=${abrirMenu} />`}
      ${menu && html`<${MenuEstatus} menu=${menu} cerrar=${() => setMenu(null)} poner=${ponerEstatus} foco=${foco} abrir=${abrir} />`}
      ${menuYo && html`<${MenuYo} pos=${menuYo} db=${db} yo=${yo} setYo=${setYo} tema=${tema} setTema=${setTema} cerrar=${() => setMenuYo(null)} toast=${toast} />`}
      ${paleta && html`<${Paleta} db=${db} yo=${yo} cerrar=${() => setPaleta(false)} abrir=${abrir} nueva=${nueva} setTema=${() => setTema(tema === 'dark' ? 'light' : 'dark')} toast=${toast} />`}
      ${avisosAbiertos && html`<${Avisos} avisos=${misAvisos} yo=${yo} db=${db} abrir=${abrir} cerrar=${() => setAvisosAbiertos(false)} toast=${toast} />`}
      <div class="toasts" role="status" aria-live="polite">
        ${toasts.map((t) => html`<div class="toast" key=${t.id}><span>${t.texto}</span>${t.accion && html`<button onClick=${() => { t.accion.f(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>${t.accion.texto}</button>`}</div>`)}
      </div>
    </div>`;
}

function vigentesArchivadas(db, yo) {
  return db.actividades.filter((a) => a.archivada && (esAdmin(yo) || participa(a, yo)));
}

function NavItem({ href, icono, texto, activo, prox, cuenta }) {
  return html`<a class=${'nav-item' + (prox ? ' prox' : '')} href=${href} aria-current=${activo ? 'page' : null}>${I(icono)}${texto}${prox ? html`<span class="cuenta">fase 2</span>` : cuenta ? html`<span class="cuenta">${cuenta}</span>` : null}</a>`;
}

// ---------- Tu día ----------
function Dia(props) {
  const { db, yo, persona, nueva } = props;
  const ahora = useAhora();
  const hoy = hoyISO(ahora);
  const p = db.personas.find((x) => x.id === persona) || db.personas[0];
  const propia = persona === yo;
  const mias = vigentes().filter((a) => participa(a, persona));
  const deHoy = mias.filter((a) => a.fecha === hoy);
  const vencidas = mias.filter((a) => a.fecha < hoy && a.estatus !== 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const conHora = deHoy.filter((a) => a.bloque).sort((a, b) => minutos(a.bloque.inicio) - minutos(b.bloque.inicio));
  const sinHora = deHoy.filter((a) => !a.bloque).sort((a, b) => (a.estatus === 'hecho') - (b.estatus === 'hecho'));
  const enFoco = mias.filter((a) => a.foco === hoy && a.responsable === persona);
  const pendientesHoy = deHoy.filter((a) => a.estatus !== 'hecho').length + vencidas.length;

  const resumen = [
    `${fechaLarga(hoy)}`,
    pendientesHoy ? `${pendientesHoy} por cerrar` : 'todo cerrado',
    vencidas.length ? `${vencidas.length} ${vencidas.length === 1 ? 'vencida' : 'vencidas'}` : null,
  ].filter(Boolean).join(' · ');

  return html`
    <header class="cabeza">
      <div>
        <h1>${propia ? 'Tu día' : `Día de ${p.corto}`}</h1>
        <p>${resumen.charAt(0).toUpperCase() + resumen.slice(1)}</p>
      </div>
      <div class="acciones">
        ${!propia && html`<a class="btn fantasma" href="#/">${I('flecha')}Volver a tu día</a>`}
        <button class="btn prim" onClick=${() => nueva()}>${I('mas')}${propia ? 'Nueva actividad' : `Asignar a ${p.corto}`}<span class="tecla" style="background:rgba(255,255,255,.18);color:#fff">N</span></button>
      </div>
    </header>
    ${!propia && html`<div class="aviso-otra"><${Avatar} p=${p} /><span>Estás viendo el día de <b>${p.nombre}</b> (${p.puesto}). Lo que crees aquí se le asigna a ${p.corto}.</span></div>`}

    <div class="dia">
      <section aria-label="Timeline del día">
        ${vencidas.length > 0 && html`
          <h2 class="seccion-t vencido">${I('alerta', 'ico14')} Vencidas</h2>
          <div class="lista-suelta">${vencidas.map((a) => html`<${Tarjeta} key=${a.id} a=${a} ...${props} hoy=${hoy} />`)}</div>`}
        ${sinHora.length > 0 && html`
          <h2 class="seccion-t">Para hoy, sin hora</h2>
          <div class="lista-suelta">${sinHora.map((a) => html`<${Tarjeta} key=${a.id} a=${a} ...${props} hoy=${hoy} />`)}</div>`}
        <h2 class="seccion-t">La mecha de hoy</h2>
        <${Mecha} bloques=${conHora} ahora=${ahora} props=${props} hoy=${hoy} />
      </section>
      <aside class="widgets" aria-label="Resumen">
        <${WFoco} lista=${enFoco} deHoy=${deHoy} props=${props} propia=${propia} />
        <${WClientes} mias=${mias} db=${db} hoy=${hoy} props=${props} />
        <${WEsperando} mias=${mias} db=${db} props=${props} />
        <${WCarga} db=${db} hoy=${hoy} />
        <${WSigue} mias=${mias} db=${db} hoy=${hoy} props=${props} />
      </aside>
    </div>`;
}

function Mecha({ bloques, ahora, props, hoy }) {
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const ini = minutos(JORNADA.inicio), fin = minutos(JORNADA.fin);
  const filas = [];
  let puesta = false;
  const marca = html`<div class="ahora" key="ahora" aria-label=${`Ahora, ${hhmm(nowMin)}`}><div class="hora num">${hhmm(nowMin)}</div><div class="estrella"><${Estrella} /></div><div class="linea"></div></div>`;
  if (nowMin < ini) { filas.push(marca); puesta = true; }
  bloques.forEach((a) => {
    const s = minutos(a.bloque.inicio), e = s + a.bloque.min;
    if (!puesta && nowMin < s) { filas.push(marca); puesta = true; }
    const pasada = e <= nowMin;
    const cli = props.db.clientes.find((c) => c.id === a.cliente);
    const alto = Math.max(52, Math.min(132, a.bloque.min * 0.9));
    filas.push(html`
      <div class="mecha-fila" key=${a.id}>
        <div class=${'hora num' + (pasada ? ' pasada' : '')}>${a.bloque.inicio}</div>
        <div class=${'riel' + (pasada ? ' ceniza' : '')}><span class=${'capsula' + (pasada && a.estatus === 'hecho' ? ' pasada' : '')} style=${`--c:${cli?.color};height:${alto - 12}px`}></span></div>
        <div><${Tarjeta} a=${a} ...${props} hoy=${hoy} enMecha /></div>
      </div>`);
    if (!puesta && nowMin >= s && nowMin < e) { filas.push(marca); puesta = true; }
  });
  if (!puesta && nowMin <= fin) { filas.push(marca); puesta = true; }
  const quedan = Math.max(0, fin - Math.max(nowMin, ini));
  return html`
    <div class="mecha">
      <div class="extremo"><div class="hora num">${JORNADA.inicio}</div><div class="riel ${nowMin > ini ? 'ceniza' : ''}" style="height:100%"><span class="ico">${I('sol')}</span></div><div class="txt">Inicio de jornada</div></div>
      ${bloques.length === 0 && html`
        <div class="mecha-fila"><div></div><div class="riel"></div><div class="vacio" style="margin:6px 0"><h3>Nada agendado con hora</h3><p>Ponle hora a una actividad para verla en la mecha de hoy.</p><button class="btn" onClick=${() => props.nueva({ bloque: { inicio: hhmm(Math.ceil((nowMin + 1) / 30) * 30), min: 60 } })}>${I('mas')}Agendar actividad</button></div></div>`}
      ${filas}
      <div class="extremo"><div class="hora num">${JORNADA.fin}</div><div class="riel" style="height:100%"><span class="ico">${I('luna')}</span></div><div class="txt">${nowMin >= fin ? 'Jornada terminada' : `Fin de jornada · quedan ${duracion(quedan)}`}</div></div>
    </div>`;
}

function Tarjeta({ a, db, yo, abrir, avanzar, abrirMenu, foco, hoy, enMecha, persona }) {
  const cli = db.clientes.find((c) => c.id === a.cliente);
  const ev = estatusVisible(a);
  const dep = dependenciaAbierta(a);
  const colab = [a.responsable, ...a.colaboradores].filter((id) => id !== persona).map((id) => db.personas.find((p) => p.id === id));
  const hechos = a.checklist.filter((c) => c.hecho).length;
  const vencida = a.fecha < hoy && a.estatus !== 'hecho';
  const esperaDias = a.estatus === 'esperando' ? diasDesdeEstatus(a) : null;
  const nombreEv = ESTATUS.find((s) => s.id === ev)?.nombre;
  const onKey = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(a.id); }
    else if (e.key === 'e' || e.key === 'E') abrirMenu(e, a);
    else if (e.key === 'f' || e.key === 'F') foco(a);
    else if (e.key === 'x' || e.key === 'X') avanzar(a);
  };
  return html`
    <div class=${'tarjeta' + (a.estatus === 'hecho' ? ' hecha' : '')} role="button" tabindex="0" style=${`--c:${cli?.color}`}
      onClick=${() => abrir(a.id)} onKeyDown=${onKey} onContextMenu=${(e) => abrirMenu(e, a)}
      aria-label=${`${a.titulo}. ${nombreEv}. ${cli?.nombre}.`}>
      <div class="tarjeta-cuerpo">
        <div class="t-titulo">${a.titulo}</div>
        <div class="t-meta">
          <span class="cli">${cli?.nombre}</span>
          ${enMecha && a.bloque && html`<span class="num">${a.bloque.inicio}–${hhmm(minutos(a.bloque.inicio) + a.bloque.min)} (${duracion(a.bloque.min)})</span>`}
          ${!enMecha && a.bloque && !vencida && html`<span class="num">${I('reloj')} ${a.bloque.inicio}</span>`}
          ${vencida && html`<span class="alerta">Venció ${fechaRelativa(a.fecha)}</span>`}
          ${esperaDias !== null && html`<span>Esperando ${esperaDias === 0 ? 'desde hoy' : esperaDias === 1 ? 'desde ayer' : `hace ${esperaDias} días`}</span>`}
          ${dep && html`<span class="alerta">${I('cadena')} Espera a «${dep.titulo}»</span>`}
        </div>
        ${(a.foco === hoy || a.checklist.length || a.repeticion?.tipo !== 'no' || colab.length || a.responsable !== persona) && html`
          <div class="t-chips">
            ${a.foco === hoy && html`<span class="chip foco">${I('foco')}Foco</span>`}
            ${a.responsable !== persona && html`<span class="chip">Colaboras</span>`}
            ${a.checklist.length > 0 && html`<span class="chip num">${I('lista')}${hechos}/${a.checklist.length}</span>`}
            ${a.repeticion?.tipo !== 'no' && html`<span class="chip">${I('repetir')}Se repite</span>`}
            ${colab.length > 0 && html`<span class="avatares">${colab.slice(0, 4).map((p) => html`<${Avatar} p=${p} key=${p?.id} />`)}</span>`}
          </div>`}
      </div>
      <button class="anillo-btn" style=${`--c:${cli?.color}`} onClick=${(e) => { e.stopPropagation(); avanzar(a); }} onContextMenu=${(e) => abrirMenu(e, a)}
        aria-label=${`Estatus: ${nombreEv}. Clic para avanzar; clic derecho para elegir.`} title=${`${nombreEv} · clic avanza, clic derecho o E elige`}>
        <${Anillo} estatus=${ev} />
      </button>
    </div>`;
}

function diasDesdeEstatus(a) {
  const h = [...(a.historial || [])].reverse().find((x) => x.que.includes('Esperando'));
  const desde = h ? h.cuando.slice(0, 10) : (a.creada || '').slice(0, 10);
  return desde ? Math.max(0, diasEntre(desde, hoyISO())) : 0;
}

// ---------- Widgets ----------
function WFoco({ lista, deHoy, props, propia }) {
  const total = deHoy.length, hechas = deHoy.filter((a) => a.estatus === 'hecho').length;
  const pct = total ? hechas / total : 0;
  const C = 2 * Math.PI * 30;
  return html`
    <div class="w ancho w-foco">
      <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label=${`${hechas} de ${total} actividades de hoy cerradas`}>
        <circle cx="38" cy="38" r="30" fill="none" stroke="var(--grafito)" stroke-width="8" />
        <circle cx="38" cy="38" r="30" fill="none" stroke="url(#g-anillo)" stroke-width="8" stroke-linecap="round"
          stroke-dasharray=${C} stroke-dashoffset=${C * (1 - pct)} transform="rotate(-90 38 38)" style="transition:stroke-dashoffset 400ms var(--ease)" />
        <defs><linearGradient id="g-anillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5C245" /><stop offset="1" stop-color="#E47739" /></linearGradient></defs>
      </svg>
      <div>
        <div class="w-t"><span>Foco de hoy</span><span>${lista.length}/3</span></div>
        <div class="w-grande" style="margin-top:4px">${hechas} <small>de ${total} cerradas hoy</small></div>
        ${lista.length ? html`<ul class="foco-lista">${lista.map((a) => {
          const c = props.db.clientes.find((x) => x.id === a.cliente);
          return html`<li key=${a.id}><button onClick=${() => props.abrir(a.id)}><span class="bolita" style=${`--c:${c?.color}`}></span><span class=${a.estatus === 'hecho' ? 'hecha' : ''}>${a.titulo}</span></button></li>`;
        })}</ul>` : html`<p class="foco-vacio">${propia ? 'Marca hasta 3 actividades como foco con la tecla F o desde su panel.' : 'Sin foco marcado hoy.'}</p>`}
      </div>
    </div>`;
}

function WClientes({ mias, db, hoy, props }) {
  const porCliente = db.clientes.map((c) => {
    const del = mias.filter((a) => a.cliente === c.id);
    const abiertas = del.filter((a) => a.estatus !== 'hecho');
    return { c, del, abiertas, vencidas: abiertas.filter((a) => a.fecha < hoy), esperando: abiertas.filter((a) => a.estatus === 'esperando'), bloqueadas: abiertas.filter((a) => estatusVisible(a) === 'bloqueado') };
  }).filter((x) => x.abiertas.length).sort((a, b) => (b.vencidas.length - a.vencidas.length) || (b.abiertas.length - a.abiertas.length)).slice(0, 4);
  return porCliente.map(({ c, del, abiertas, vencidas, esperando, bloqueadas }) => {
    const prox = [...abiertas].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    let titular, color = null;
    if (vencidas.length) { titular = `${vencidas.length} ${vencidas.length === 1 ? 'vencida' : 'vencidas'}`; color = 'var(--brasa)'; }
    else if (bloqueadas.length) { titular = `${bloqueadas.length} ${bloqueadas.length === 1 ? 'bloqueada' : 'bloqueadas'}`; color = 'var(--brasa)'; }
    else if (esperando.length) titular = `${esperando.length} esperando`;
    else titular = 'Al día';
    const hechas = del.length - abiertas.length;
    return html`
      <button class="w w-cli" key=${c.id} style=${`--c:${c.color}`} onClick=${() => props.abrir(prox.id)} title=${`Abrir la próxima de ${c.nombre}`}>
        <div class="w-t"><span>${c.nombre}</span><span>${abiertas.length} ${abiertas.length === 1 ? 'abierta' : 'abiertas'}</span></div>
        <div class="w-grande" style=${color ? `color:${color}` : ''}>${titular}</div>
        <div class="w-pie">Próxima: ${fechaRelativa(prox.fecha)}</div>
        <div class="segmentos" aria-hidden="true">${del.slice(0, 8).map((_, i) => html`<i class=${i < hechas ? 'on' : ''}></i>`)}</div>
      </button>`;
  });
}

function WEsperando({ mias, db, props }) {
  const lista = mias.filter((a) => a.estatus === 'esperando').map((a) => ({ a, d: diasDesdeEstatus(a) })).sort((x, y) => y.d - x.d);
  if (!lista.length) return null;
  return html`
    <div class="w ancho">
      <div class="w-t"><span>Esperando al cliente</span><span>${lista.length}</span></div>
      <ul class="lista-w">${lista.slice(0, 4).map(({ a, d }) => {
        const c = db.clientes.find((x) => x.id === a.cliente);
        return html`<li key=${a.id}><button onClick=${() => props.abrir(a.id)}><span class="bolita" style=${`--c:${c?.color}`}></span><span class="lw-t">${a.titulo}</span><span class="lw-m" style=${d >= 3 ? 'color:var(--brasa)' : ''}>${d === 0 ? 'hoy' : d === 1 ? '1 día' : `${d} días`}</span></button></li>`;
      })}</ul>
    </div>`;
}

function inicioSemana(iso) { const d = new Date(iso + 'T12:00:00'); const w = (d.getDay() + 6) % 7; return sumarDias(iso, -w); }

function WCarga({ db, hoy }) {
  const lun = inicioSemana(hoy), dom = sumarDias(lun, 6);
  const filas = db.personas.map((p) => {
    const h = vigentes().filter((a) => a.responsable === p.id && a.estatus !== 'hecho' && a.fecha <= dom).reduce((s, a) => s + horasEstimadas(a), 0);
    return { p, h };
  }).sort((a, b) => b.h - a.h);
  return html`
    <div class="w ancho">
      <div class="w-t"><span>Carga del equipo esta semana</span><span>${fechaCorta(lun)} – ${fechaCorta(dom)}</span></div>
      <div class="carga">${filas.map(({ p, h }) => {
        const pct = Math.min(100, (h / CAPACIDAD_SEMANA) * 100);
        return html`
          <button key=${'b' + p.id} onClick=${() => { location.hash = '#/persona/' + p.id; }} title=${`Ver el día de ${p.nombre}`}>${p.corto}</button>
          <div class="barra-c" key=${'c' + p.id} role="img" aria-label=${`${p.corto}: ${h} de ${CAPACIDAD_SEMANA} horas`}><i class=${pct > 85 ? 'alta' : ''} style=${`width:${pct}%`}></i></div>
          <span class="h" key=${'h' + p.id}>${h} h</span>`;
      })}</div>
      <p class="nota-pie">Estimado con S = 1 h, M = 3 h y L = 6 h sobre ${CAPACIDAD_SEMANA} h por persona. Incluye lo vencido.</p>
    </div>`;
}

function WSigue({ mias, db, hoy, props }) {
  const lista = mias.filter((a) => a.fecha > hoy && a.estatus !== 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5);
  if (!lista.length) return null;
  return html`
    <div class="w ancho">
      <div class="w-t"><span>Lo que sigue</span><span>próximos días</span></div>
      <ul class="lista-w">${lista.map((a) => {
        const c = db.clientes.find((x) => x.id === a.cliente);
        return html`<li key=${a.id}><button onClick=${() => props.abrir(a.id)}><span class="bolita" style=${`--c:${c?.color}`}></span><span class="lw-t">${a.titulo}</span><span class="lw-m">${fechaRelativa(a.fecha)}</span></button></li>`;
      })}</ul>
    </div>`;
}

// ---------- Equipo (fase 1: acceso al día de cada persona) ----------
function Equipo({ db, yo }) {
  const hoy = hoyISO();
  const lun = inicioSemana(hoy), dom = sumarDias(lun, 6);
  const permiso = { dueno: 'Dueño', admin: 'Admin', colaborador: 'Colaborador' };
  return html`
    <header class="cabeza"><div><h1>Equipo</h1><p>Abre el día de cualquier persona para ver en qué va o asignarle algo.</p></div></header>
    <div class="widgets" style="position:static;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
      ${db.personas.map((p) => {
        const suyas = vigentes().filter((a) => participa(a, p.id));
        const abiertas = suyas.filter((a) => a.estatus !== 'hecho');
        const vencidas = abiertas.filter((a) => a.fecha < hoy).length;
        const h = vigentes().filter((a) => a.responsable === p.id && a.estatus !== 'hecho' && a.fecha <= dom).reduce((s, a) => s + horasEstimadas(a), 0);
        return html`
          <a class="w" key=${p.id} href=${p.id === yo ? '#/' : '#/persona/' + p.id} style="text-decoration:none;color:inherit;display:block">
            <div style="display:flex;gap:12px;align-items:center"><${Avatar} p=${p} grande /><div><div style="font-weight:500">${p.nombre}${p.id === yo ? ' (tú)' : ''}</div><div class="w-pie">${p.puesto} · ${permiso[p.permiso]}</div></div></div>
            <div class="w-grande">${abiertas.length} <small>abiertas${vencidas ? ` · ${vencidas} vencidas` : ''}</small></div>
            <div class="carga" style="grid-template-columns:minmax(0,1fr) 54px;margin-top:8px"><div class="barra-c"><i class=${h / CAPACIDAD_SEMANA > 0.85 ? 'alta' : ''} style=${`width:${Math.min(100, (h / CAPACIDAD_SEMANA) * 100)}%`}></i></div><span class="h">${h} h</span></div>
          </a>`;
      })}
    </div>`;
}

// ---------- Papelera ----------
function Papelera({ db, yo, toast }) {
  const [confirmar, setConfirmar] = useState(null);
  const lista = vigentesArchivadas(db, yo).sort((a, b) => b.archivada.localeCompare(a.archivada));
  const admin = esAdmin(yo);
  return html`
    <header class="cabeza"><div><h1>Papelera</h1><p>Lo archivado se queda ${db.papeleraDias} días y después se borra solo. ${admin ? 'Como admin puedes borrarlo antes.' : 'Solo un admin puede borrar antes.'}</p></div></header>
    ${lista.length === 0 ? html`<div class="vacio"><h3>La papelera está vacía</h3><p>Cuando archives una actividad, aparecerá aquí durante ${db.papeleraDias} días.</p></div>` : html`
      <div class="tabla-simple">${lista.map((a) => {
        const quedan = Math.max(0, db.papeleraDias - Math.floor((Date.now() - new Date(a.archivada).getTime()) / 86400000));
        const c = db.clientes.find((x) => x.id === a.cliente);
        return html`<div class="fila-papelera" key=${a.id}>
          <div class="cuerpo"><div class="t">${a.titulo}</div><div class="m">${c?.nombre} · archivada ${haceCuanto(a.archivada)} · se borra en ${quedan} ${quedan === 1 ? 'día' : 'días'}</div></div>
          <button class="btn" onClick=${() => { restaurar(a.id, yo); toast('Actividad restaurada.'); }}>Restaurar</button>
          ${admin && html`<button class="btn peligro" onClick=${() => setConfirmar(a)}>Borrar para siempre</button>`}
        </div>`;
      })}</div>`}
    ${confirmar && html`
      <div class="velo alto" onClick=${() => setConfirmar(null)}></div>
      <div class="modal-caja chico" role="alertdialog" aria-modal="true" aria-labelledby="t-borrar">
        <h2 id="t-borrar">¿Borrar para siempre?</h2>
        <p>«${confirmar.titulo}» y su historial se borran y no se pueden recuperar.</p>
        <div class="pie"><button class="btn fantasma" onClick=${() => setConfirmar(null)}>Cancelar</button><button class="btn prim" onClick=${() => { const r = borrarDefinitivo(confirmar.id, yo); toast(r.ok ? 'Borrada para siempre.' : r.motivo); setConfirmar(null); }}>Borrar para siempre</button></div>
      </div>`}`;
}

function Proximamente({ ruta }) {
  const info = {
    '/semana': ['Semana', ['Los 7 días con la carga de cada persona', 'Vencimientos y bloques agendados', 'Mover actividades de día sin arrastrar: con fecha rápida']],
    '/clientes': ['Clientes', ['Todo lo de un cliente: actividades, salud y lo que espera', 'Responsables del cliente', 'Exportar el estado del cliente']],
    '/proyectos': ['Proyectos', ['Actividades compartidas entre varias personas', 'Avance e hitos', 'Ficha de proyecto en PDF']],
  }[ruta] || ['Página no encontrada', ['Vuelve a «Tu día» desde el menú.']];
  return html`<header class="cabeza"><div><h1>${info[0]}</h1><p>Llega en la fase 2.</p></div></header>
    <div class="prox-caja"><h2>Qué va a mostrar</h2><ul>${info[1].map((t) => html`<li key=${t}>${t}</li>`)}</ul></div>`;
}

// ---------- Capas ----------
function MenuEstatus({ menu, cerrar, poner, foco, abrir }) {
  const ref = useRef();
  const a = menu.a;
  const cli = store.get().clientes.find((c) => c.id === a.cliente);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    const k = (e) => {
      const s = ESTATUS.find((x) => x.tecla === e.key);
      if (s) { e.preventDefault(); poner(a, s.id); cerrar(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const bs = [...ref.current.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement);
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
      }
    };
    setTimeout(() => addEventListener('mousedown', f), 0);
    addEventListener('keydown', k);
    return () => { removeEventListener('mousedown', f); removeEventListener('keydown', k); };
  }, []);
  const hoy = hoyISO();
  return html`
    <div class="menu" ref=${ref} role="menu" style=${`left:${menu.x}px;top:${menu.y}px;--c:${cli?.color}`}>
      ${ESTATUS.map((s) => html`<button key=${s.id} role="menuitemradio" aria-checked=${a.estatus === s.id} onClick=${() => { poner(a, s.id); cerrar(); }}><${Anillo} estatus=${s.id} />${s.nombre}<span class="tecla">${s.tecla}</span></button>`)}
      <div class="sep"></div>
      <button role="menuitem" onClick=${() => { foco(a); cerrar(); }}>${I('foco')}${a.foco === hoy ? 'Quitar del foco' : 'Foco de hoy'}<span class="tecla">F</span></button>
      <button role="menuitem" onClick=${() => { abrir(a.id); cerrar(); }}>${I('ojo')}Abrir<span class="tecla">↵</span></button>
    </div>`;
}

function MenuYo({ pos, db, yo, setYo, tema, setTema, cerrar, toast }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    setTimeout(() => addEventListener('mousedown', f), 0);
    return () => removeEventListener('mousedown', f);
  }, []);
  const h = 6 * 36 + 120;
  return html`
    <div class="menu" ref=${ref} role="menu" style=${`left:${Math.min(pos.x, innerWidth - 260)}px;top:${Math.max(12, pos.y - h)}px;min-width:240px`}>
      <div class="paleta-grupo">Modo prueba: ver como</div>
      ${db.personas.map((p) => html`<button key=${p.id} role="menuitemradio" aria-checked=${p.id === yo} onClick=${() => { setYo(p.id); location.hash = '#/'; cerrar(); toast(`Ahora ves el sistema como ${p.corto}.`); }}><${Avatar} p=${p} />${p.corto}<span class="tecla">${p.puesto.split(' ')[0]}</span></button>`)}
      <div class="sep"></div>
      <button role="menuitem" onClick=${() => { setTema(tema === 'dark' ? 'light' : 'dark'); cerrar(); }}>${I(tema === 'dark' ? 'sol' : 'luna')}${tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button>
      <button role="menuitem" onClick=${() => { store.restablecer(); cerrar(); toast('Datos de prueba restablecidos.'); }}>${I('reset')}Restablecer datos de prueba</button>
    </div>`;
}

function Avisos({ avisos, yo, db, abrir, cerrar, toast }) {
  const ref = useRef();
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.icon-btn')) cerrar(); };
    setTimeout(() => addEventListener('mousedown', f), 0);
    return () => { removeEventListener('mousedown', f); marcarAvisosLeidos(yo); };
  }, []);
  return html`
    <div class="avisos-panel" ref=${ref} role="dialog" aria-label="Avisos">
      <h2>Avisos <button onClick=${() => marcarAvisosLeidos(yo)}>Marcar todo como leído</button></h2>
      ${avisos.length === 0 ? html`<div class="paleta-vacia">Sin avisos por ahora.</div>` : avisos.slice(0, 12).map((n) => {
        const a = db.actividades.find((x) => x.id === n.actividad);
        return html`<div class=${'aviso-it' + (n.leido ? '' : ' nuevo')} key=${n.id}>
          <div class="cuerpo">${n.texto}<span class="cuando">${haceCuanto(n.cuando)}</span>
            ${a && !a.archivada && html`<div class="acc">
              <button class="btn" onClick=${() => { abrir(a.id); cerrar(); }}>Abrir</button>
              ${n.tipo === 'cierre' && a.estatus === 'hecho' && html`<button class="btn fantasma" onClick=${() => { cambiarEstatus(a.id, 'en_curso', yo); toast('La reabriste y se le avisó al responsable.'); }}>Reabrir</button>`}
            </div>`}
          </div></div>`;
      })}
    </div>`;
}

function Paleta({ db, yo, cerrar, abrir, nueva, setTema, toast }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q.trim());
  const acciones = [
    { g: 'Acciones', t: 'Nueva actividad', m: 'N', ico: 'mas', f: () => nueva() },
    { g: 'Acciones', t: 'Ir a tu día', ico: 'hoy', f: () => { location.hash = '#/'; } },
    { g: 'Acciones', t: 'Ver el equipo', ico: 'equipo', f: () => { location.hash = '#/equipo'; } },
    { g: 'Acciones', t: 'Abrir la papelera', ico: 'papelera', f: () => { location.hash = '#/papelera'; } },
    { g: 'Acciones', t: 'Cambiar entre modo claro y oscuro', ico: 'tema', f: setTema },
  ].filter((x) => !t || norm(x.t).includes(t));
  const acts = vigentes().filter((a) => !t || norm(a.titulo + ' ' + (db.clientes.find((c) => c.id === a.cliente)?.nombre || '')).includes(t))
    .sort((a, b) => (participa(b, yo) - participa(a, yo)) || a.fecha.localeCompare(b.fecha)).slice(0, t ? 8 : 5)
    .map((a) => { const c = db.clientes.find((x) => x.id === a.cliente); return { g: 'Actividades', t: a.titulo, m: fechaRelativa(a.fecha), c: c?.color, f: () => abrir(a.id) }; });
  const pers = db.personas.filter((p) => !t || norm(p.nombre + ' ' + p.puesto).includes(t)).slice(0, 5)
    .map((p) => ({ g: 'Personas', t: p.nombre, m: p.puesto, p, f: () => { location.hash = p.id === yo ? '#/' : '#/persona/' + p.id; } }));
  const res = [...acciones, ...acts, ...pers];
  useEffect(() => setSel(0), [q]);
  const ejecutar = (r) => { cerrar(); r.f(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && res[sel]) { e.preventDefault(); ejecutar(res[sel]); }
  };
  let ultimo = null;
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="modal-caja" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="paleta-in">${I('buscar')}<input autofocus placeholder="Busca una actividad, una persona o una acción" value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${onKey} aria-label="Buscar" /><span class="tecla">Esc</span></div>
      <div class="paleta-res" role="listbox">
        ${res.length === 0 ? html`<div class="paleta-vacia">Nada coincide con «${q}». Prueba con otra palabra.</div>` : res.map((r, i) => {
          const cab = r.g !== ultimo ? html`<div class="paleta-grupo" key=${'g' + r.g}>${r.g}</div>` : null; ultimo = r.g;
          return html`${cab}<button key=${r.g + i} class="paleta-op" role="option" aria-selected=${i === sel} onMouseEnter=${() => setSel(i)} onClick=${() => ejecutar(r)}>
            ${r.p ? html`<${Avatar} p=${r.p} />` : r.c ? html`<span class="bolita" style=${`--c:${r.c}`}></span>` : I(r.ico)}<span>${r.t}</span>${r.m && html`<span class="m">${r.m}</span>`}</button>`;
        })}
      </div>
    </div>`;
}

const raiz = document.getElementById('app');
raiz.textContent = '';
render(html`<${App} />`, raiz);

// Solo en HTTPS: en local se desactiva para no quedarse con versiones viejas en caché mientras se desarrolla.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
