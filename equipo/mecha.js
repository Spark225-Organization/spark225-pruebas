// El día: la mecha (timeline) con arrastrar y soltar, la bandeja «sin hora» y el alta rápida.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, ESTATUS } from './datos.js?v=202611241437';
import { vigentes, participa, estatusVisible, dependenciaAbierta, visiblePara, crear, nuevaVacia } from './store.js?v=202611241437';
import { I, Anillo, Estrella, Avatar, minutos, hhmm, duracion, fechaRelativa } from './ui.js?v=202611241437';
import { iniciarArrastre, useArrastre } from './arrastre.js?v=202611241437';

const K = 1.15; // px por minuto
const SNAP = 15;

// Vista de día: bandeja «sin hora» + la mecha.
export function DiaCal({ ctx, ahora }) {
  const { yo, persona, fecha } = ctx;
  const hoy = hoyISO(ahora);
  const suyas = vigentes().filter((a) => participa(a, persona) && visiblePara(a, yo));
  const delDia = suyas.filter((a) => a.fecha === fecha);
  const vencidas = fecha === hoy ? suyas.filter((a) => a.fecha < hoy && a.estatus !== 'hecho') : [];
  return html`
    <${Bandeja} lista=${[...vencidas, ...delDia.filter((a) => !a.bloque)]} ctx=${ctx} hoy=${hoy} />
    <${Mecha} bloques=${delDia.filter((a) => a.bloque)} ctx=${ctx} ahora=${ahora} esHoy=${fecha === hoy} />`;
}

export function useAhora() {
  const [t, set] = useState(() => new Date());
  useEffect(() => { const k = setInterval(() => set(new Date()), 30000); return () => clearInterval(k); }, []);
  return t;
}

// ---------- Bandeja: lo de este día sin hora (y lo vencido, si es hoy) ----------
function Bandeja({ lista, ctx, hoy }) {
  const arr = useArrastre();
  const sobre = arr?.destino?.tipo === 'sinhora';
  if (!lista.length && !arr?.datos?.actividad) return null;
  return html`
    <div class=${'bandeja' + (sobre ? ' sobre' : '') + (lista.length ? '' : ' vacia')} data-drop="sinhora" aria-label="Sin hora">
      ${lista.length === 0 && html`<span class="bandeja-hint">${I('reloj')}</span>`}
      ${lista.map((a) => html`<${Pastilla} key=${a.id} a=${a} ctx=${ctx} vencida=${a.fecha < hoy} />`)}
    </div>`;
}

function Pastilla({ a, ctx, vencida }) {
  const cli = ctx.db.clientes.find((c) => c.id === a.cliente);
  const ev = estatusVisible(a);
  const arr = useArrastre();
  const yo = arr?.datos?.actividad === a.id;
  return html`
    <div class=${'pastilla' + (a.estatus === 'hecho' ? ' hecha' : '') + (vencida ? ' vencida' : '') + (yo ? ' fantasma' : '')} style=${`--c:${cli?.color}`}
      tabindex="0" role="button" aria-label=${a.titulo}
      onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
      <button class="anillo-mini" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${ESTATUS.find((s) => s.id === ev)?.nombre}><${Anillo} estatus=${ev} /></button>
      <span class="p-t">${a.titulo}</span>
      ${vencida && html`<span class="p-venc">${fechaRelativa(a.fecha)}</span>`}
    </div>`;
}

// ---------- La mecha ----------
function Mecha({ bloques, ctx, ahora, esHoy }) {
  const arr = useArrastre();
  const caja = useRef();
  const [rapido, setRapido] = useState(null);
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  let ini = 8 * 60, fin = 20 * 60;
  bloques.forEach((a) => { const s = minutos(a.bloque.inicio); ini = Math.min(ini, Math.floor(s / 60) * 60); fin = Math.max(fin, Math.ceil((s + a.bloque.min) / 60) * 60); });
  const alto = (fin - ini) * K;
  const carriles = asignarCarriles(bloques);
  const sobre = arr?.destino?.tipo === 'hora' && arr.destino.el === caja.current;
  const minSobre = sobre ? Math.max(ini, Math.min(fin - SNAP, ini + Math.round((arr.destino.offsetY - (arr.datos.dy || 0)) / K / SNAP) * SNAP)) : null;
  const ahoraY = (nowMin - ini) * K;

  const clicVacio = (e) => {
    if (e.target !== caja.current && !e.target.classList.contains('linea-h')) return;
    const r = caja.current.getBoundingClientRect();
    const m = ini + Math.floor((e.clientY - r.top) / K / 30) * 30;
    setRapido({ x: Math.min(e.clientX, innerWidth - 340), y: Math.min(e.clientY, innerHeight - 220), inicio: hhmm(m) });
  };

  const horas = [];
  for (let m = ini; m <= fin; m += 60) horas.push(m);

  return html`
    <div class=${'mecha' + (sobre ? ' sobre' : '')} ref=${caja} data-drop="hora" data-ini=${ini} style=${`height:${alto}px`} onClick=${clicVacio}>
      ${horas.map((m) => html`<div class="linea-h" key=${m} style=${`top:${(m - ini) * K}px`}><span class="num">${hhmm(m)}</span></div>`)}
      <div class="riel-m" style=${esHoy ? `--quemado:${Math.max(0, Math.min(alto, ahoraY))}px` : '--quemado:0px'}></div>
      ${bloques.map((a) => html`<${Bloque} key=${a.id} a=${a} ctx=${ctx} ini=${ini} carril=${carriles[a.id]} pasado=${esHoy && minutos(a.bloque.inicio) + a.bloque.min <= nowMin} />`)}
      ${esHoy && nowMin >= ini && nowMin <= fin && html`<div class="ahora-m" style=${`top:${ahoraY}px`}><span class="num">${hhmm(nowMin)}</span><span class="estrella"><${Estrella} /></span><i></i></div>`}
      ${sobre && html`<div class="guia" style=${`top:${(minSobre - ini) * K}px`}><span class="num">${hhmm(minSobre)}</span></div>`}
    </div>
    ${rapido && html`<${AltaRapida} pos=${rapido} ctx=${ctx} cerrar=${() => setRapido(null)} />`}`;
}

function asignarCarriles(bloques) {
  const orden = [...bloques].sort((a, b) => minutos(a.bloque.inicio) - minutos(b.bloque.inicio));
  const res = {};
  let grupo = [], finGrupo = -1;
  const cerrar = () => { const n = Math.max(1, ...grupo.map((g) => g.c + 1)); grupo.forEach((g) => { res[g.id] = { i: g.c, n }; }); grupo = []; };
  orden.forEach((a) => {
    const s = minutos(a.bloque.inicio), e = s + a.bloque.min;
    if (s >= finGrupo && grupo.length) cerrar();
    const usados = grupo.filter((g) => g.e > s).map((g) => g.c);
    let c = 0; while (usados.includes(c)) c++;
    grupo.push({ id: a.id, c, e });
    finGrupo = Math.max(finGrupo, e);
  });
  if (grupo.length) cerrar();
  return res;
}

function Bloque({ a, ctx, ini, carril, pasado }) {
  const cli = ctx.db.clientes.find((c) => c.id === a.cliente);
  const ev = estatusVisible(a);
  const dep = dependenciaAbierta(a);
  const arr = useArrastre();
  const s = minutos(a.bloque.inicio);
  const top = (s - ini) * K, h = Math.max(40, a.bloque.min * K - 4);
  const compacto = h < 58;
  const otros = a.colaboradores.map((id) => ctx.db.personas.find((p) => p.id === id)).filter(Boolean);
  const { i = 0, n = 1 } = carril || {};
  const arrastrandome = arr?.datos?.actividad === a.id;
  return html`
    <div class=${'bloque' + (a.estatus === 'hecho' ? ' hecha' : '') + (pasado ? ' pasado' : '') + (compacto ? ' compacto' : '') + (arrastrandome ? ' fantasma' : '')}
      style=${`--c:${cli?.color};top:${top}px;height:${h}px;--i:${i};--n:${n}`}
      tabindex="0" role="button" aria-label=${`${a.titulo}, ${a.bloque.inicio}`}
      onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
      <span class="capsula-m"></span>
      <div class="b-cuerpo">
        <div class="b-t">${a.foco === hoyISO() && html`<span class="estrellita">${I('foco')}</span>`}${a.titulo}</div>
        ${!compacto && html`<div class="b-m num">${a.bloque.inicio}–${hhmm(s + a.bloque.min)}${dep ? html` <span class="b-dep" title=${`Espera a «${dep.titulo}»`}>${I('cadena')}</span>` : null}
          ${otros.length > 0 && html`<span class="b-av">${otros.slice(0, 3).map((p) => html`<${Avatar} p=${p} key=${p.id} />`)}</span>`}</div>`}
      </div>
      <button class="anillo-btn" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} onContextMenu=${(e) => ctx.abrirMenu(e, a)}
        aria-label=${ESTATUS.find((x) => x.id === ev)?.nombre}><${Anillo} estatus=${ev} /></button>
    </div>`;
}

// Arrastrar una actividad: a otra hora de la mecha, a la bandeja, a un día de la barra o a la papelera.
export function arrastrarActividad(e, a, ctx) {
  const cli = ctx.db.clientes.find((c) => c.id === a.cliente);
  // Si se toma un bloque de la mecha, se respeta el punto donde se tomó para que la hora caiga en su borde superior.
  const dy = e.currentTarget.classList?.contains('bloque') ? e.clientY - e.currentTarget.getBoundingClientRect().top : 0;
  iniciarArrastre(e, {
    datos: { actividad: a.id, dy }, etiqueta: a.titulo, color: cli?.color,
    alClic: () => ctx.abrir(a.id),
    alSoltar: (d) => {
      if (d.tipo === 'papelera') return ctx.archivarConDeshacer(a);
      if (d.tipo === 'estatus') return ctx.ponerEstatus(a, d.estatus);
      if (d.tipo === 'cliente') return ctx.cambiarCliente(a, d.cliente);
      if (d.tipo === 'dia') return ctx.moverConRegla(a, { fecha: d.fecha });
      if (d.tipo === 'sinhora') return ctx.moverConRegla(a, { fecha: ctx.fecha, bloque: null });
      if (d.tipo === 'hora') {
        const ini = +d.ini;
        const m = ini + Math.round((d.offsetY - dy) / K / SNAP) * SNAP;
        return ctx.moverConRegla(a, { fecha: ctx.fecha, bloque: { inicio: hhmm(Math.max(0, m)), min: a.bloque?.min || 60 } });
      }
    },
  });
}

export function teclasActividad(e, a, ctx) {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.abrir(a.id); }
  else if (e.key === 'e' || e.key === 'E') ctx.abrirMenu(e, a);
  else if (e.key === 'f' || e.key === 'F') ctx.foco(a);
  else if (e.key === 'x' || e.key === 'X') ctx.avanzar(a);
}

// ---------- Alta rápida: título + cliente y listo ----------
export function AltaRapida({ pos, ctx, cerrar, sinHora }) {
  const [t, setT] = useState('');
  const [cli, setCli] = useState(() => ctx.ultimoCliente || 'interno');
  const [err, setErr] = useState(false);
  const ref = useRef();
  useEffect(() => {
    ref.current?.querySelector('input')?.focus();
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    const k = (e) => { if (e.key === 'Escape') cerrar(); };
    setTimeout(() => addEventListener('pointerdown', f), 0);
    addEventListener('keydown', k);
    return () => { removeEventListener('pointerdown', f); removeEventListener('keydown', k); };
  }, []);
  const borrador = () => nuevaVacia(ctx.persona, {
    titulo: t.trim(), cliente: cli, proyecto: 'g-' + cli, fecha: ctx.fecha, esfuerzo: 'S',
    bloque: pos.inicio ? { inicio: pos.inicio, min: 60 } : null, asignadaPor: ctx.yo,
  });
  const guardar = () => {
    if (!t.trim()) { setErr(true); return; }
    ctx.setUltimoCliente(cli);
    const a = crear(borrador(), ctx.yo);
    ctx.toast(a.responsable === ctx.yo ? 'Listo' : `Asignada a ${ctx.db.personas.find((p) => p.id === a.responsable)?.corto}`);
    cerrar();
  };
  const clientes = ctx.db.clientes.filter((c) => !c.privado || ctx.persona === ctx.yo);
  return html`
    <div class="rapida" ref=${ref} style=${`left:${pos.x}px;top:${pos.y}px`} role="dialog" aria-label="Nueva actividad">
      <div class="r-fila">
        ${pos.inicio && html`<span class="r-hora num">${pos.inicio}</span>`}
        <input class=${err ? 'error' : ''} placeholder="Nueva actividad" value=${t} onInput=${(e) => { setT(e.target.value); setErr(false); }}
          onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }} aria-label="Título" />
      </div>
      <div class="r-clientes">${clientes.map((c) => html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} aria-pressed=${cli === c.id} onClick=${() => setCli(c.id)}><i></i>${c.nombre}</button>`)}</div>
      <div class="r-pie">
        <button class="btn fantasma" onClick=${() => { cerrar(); ctx.abrirBorrador({ ...borrador(), titulo: t }); }}>${I('ajustes')}Más</button>
        <button class="btn prim" onClick=${guardar}>Agregar</button>
      </div>
    </div>`;
}
