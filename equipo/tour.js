// Recorrido de inducción: bienvenida y pasos con foco sobre cada parte de la app.
// Cada paso trae una mini animación que muestra el gesto (arrastrar, tocar, conectar).
import { html, useState, useEffect, useLayoutEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I, Estrella } from './ui.js?v=202611270300';

export const PASOS = [
  { sel: '[data-tour="dias"]', demo: 'dias', t: 'Tus días', d: 'Toca un día para verlo. Para mover una tarea a otro día, arrástrala y suéltala sobre el día que quieras.' },
  { sel: '[data-tour="calendario"]', demo: 'mecha', t: 'La mecha de hoy', d: 'Tu día como línea de tiempo. Arrastra una tarea hacia arriba o abajo para cambiarle la hora.' },
  { sel: '[data-tour="widgets"]', demo: 'widgets', t: 'Tus widgets', d: 'Agrega, quita y reordena. En Correo, la transcripción de una junta se vuelve minuta sola.' },
  { sel: '[data-tour="mas"]', demo: 'asis', t: 'Crear', d: 'Tarea, proyecto o cliente. Te pregunta una cosa a la vez y listo. Atajo para tarea: N.' },
  { sel: '[data-tour="pipeline"]', demo: 'pipe', t: 'Pipeline', d: 'Todo lo pendiente. Filtra por persona y cliente, y arrastra una tarea para cambiar su estatus.' },
  { sel: '[data-tour="clientes"]', demo: 'folder', t: 'Clientes', d: 'Un archivero: abre la carpeta de un cliente y ves cómo va, su satisfacción y qué le toca a cada quien.' },
  { sel: '[data-tour="chat"]', demo: 'chat', t: 'Chat del equipo', d: 'Escribe al equipo y envía facturas. La factura avanza: Enviada, Recibida, Pagada.' },
  { sel: '[data-tour="buscar"]', demo: 'buscar', t: 'Buscar', d: 'Encuentra tareas, clientes o personas. Atajo: ⌘K.' },
];

// Escenas animadas pequeñas, solo CSS.
function Demo({ tipo }) {
  if (tipo === 'dias') return html`<div class="demo d-dias">
    ${['Lun', 'Mar', 'Mié', 'Jue'].map((d, i) => html`<span key=${d} class=${'dd-chip' + (i === 2 ? ' meta' : '')}><small>${d}</small><b>${23 + i}</b></span>`)}
    <span class="dd-pill">Deck</span><span class="dd-cursor"></span></div>`;
  if (tipo === 'mecha') return html`<div class="demo d-mecha">
    <span class="dm-h" style="top:10px">10:00</span><span class="dm-h" style="top:46px">11:00</span><span class="dm-h" style="top:82px">12:00</span>
    <span class="dm-riel"></span><span class="dm-bloque"><i></i>Revisar campaña</span><span class="dm-cursor"></span></div>`;
  if (tipo === 'vistas') return html`<div class="demo d-vistas"><div class="dv-seg"><span class="dv-on"></span><span>Día</span><span>Semana</span><span>Mes</span><span>Tarjetas</span></div>
    <div class="dv-esc"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
  if (tipo === 'acomodo') return html`<div class="demo d-acomodo"><span class="da-c">Calendario</span><span class="da-w">Widgets</span></div>`;
  if (tipo === 'widgets') return html`<div class="demo d-widgets"><span class="dw a"><em>–</em></span><span class="dw b"></span><span class="dw c"></span><span class="dw mas">+</span></div>`;
  if (tipo === 'mas') return html`<div class="demo d-mas"><span class="dx-btn">+</span><span class="dx-card"><b>Nueva tarea</b><i></i><i></i></span></div>`;
  if (tipo === 'asis') return html`<div class="demo d-asis"><span class="da-barra"><i></i></span>
    <span class="da-q q1">¿Qué hay que hacer?</span><span class="da-q q2">¿Para qué cliente?</span><span class="da-q q3">¿Para cuándo?</span>
    <span class="da-ops"><i></i><i></i><i></i></span></div>`;
  if (tipo === 'pipe') return html`<div class="demo d-pipe"><span class="dpp-col c1"></span><span class="dpp-col c2"></span><span class="dpp-col c3"></span>
    <span class="dpp-card fija f1"></span><span class="dpp-card fija f2"></span><span class="dpp-card mueve"></span><span class="dpp-cursor"></span></div>`;
  if (tipo === 'folder') return html`<div class="demo d-folder"><span class="dfo"><span class="dfo-tab"></span><span class="dfo-papel"></span><span class="dfo-frente">Carnot</span></span></div>`;
  if (tipo === 'chat') return html`<div class="demo d-chat"><span class="dc-b o">¿Cómo vamos?</span><span class="dc-b m">Ya casi</span>
    <span class="dc-f"><b>Factura.pdf</b><span><i class="s1">Enviada</i><i class="s2">Recibida</i><i class="s3">Pagada</i></span></span></div>`;
  if (tipo === 'buscar') return html`<div class="demo d-buscar"><span class="db-caja"><span class="db-txt">carnot</span></span><span class="db-r r1"></span><span class="db-r r2"></span></div>`;
  return null;
}

export function Bienvenida({ empezar, saltar, nombre, area, verSpark }) {
  return html`
    <div class="velo alto"></div>
    <div class="bienvenida" role="dialog" aria-modal="true" aria-label="Bienvenida">
      <div class="bv-estrella"><${Estrella} /></div>
      <h2>Hola, ${nombre}</h2>
      <p>Aquí organizas tu día, el de tu equipo y los flujos de cada proyecto.</p>
      <div class="bv-gestos">
        <span><i class="g-arr"></i>Arrastra</span><span><i class="g-toc"></i>Toca</span><span><i class="g-con"></i>Conecta</span>
      </div>
      ${area && html`<button class="bv-area" onClick=${verSpark}>${I('organigrama')}<span>Así está organizado Spark: tú estás en <b>${area}</b></span>${I('flecha', 'rot-180')}</button>`}
      <button class="btn prim ancho" onClick=${empezar}>Ver cómo funciona</button>
      <button class="btn fantasma ancho" onClick=${saltar}>Ahora no</button>
    </div>`;
}

export function Recorrido({ terminar }) {
  const [i, setI] = useState(0);
  const [r, setR] = useState(null);
  const paso = PASOS[i];
  useLayoutEffect(() => {
    const medir = () => {
      const el = document.querySelector(paso.sel);
      if (!el) { setR(null); return; }
      if (!el.closest('.top, .dock')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const b = el.getBoundingClientRect();
      setR({ x: b.left - 6, y: Math.max(6, b.top - 6), w: b.width + 12, h: Math.min(b.height + 12, innerHeight - 24) });
    };
    medir();
    addEventListener('resize', medir);
    return () => removeEventListener('resize', medir);
  }, [i]);
  const sig = () => (i < PASOS.length - 1 ? setI(i + 1) : terminar());
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') terminar(); if (e.key === 'ArrowRight' || e.key === 'Enter') sig(); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const ALTO = 330, ANCHO = Math.min(340, innerWidth - 24);
  const abajo = r && r.y + r.h + ALTO + 12 < innerHeight;
  const arriba = r && r.y - ALTO - 12 > 0;
  let globo;
  if (!r) globo = { left: innerWidth / 2 - ANCHO / 2, top: innerHeight / 2 - ALTO / 2 };
  else if (abajo) globo = { left: r.x, top: r.y + r.h + 12 };
  else if (arriba) globo = { left: r.x, top: r.y - ALTO - 12 };
  else globo = { left: r.x + r.w + 16 + ANCHO < innerWidth ? r.x + r.w + 16 : r.x - ANCHO - 16, top: innerHeight / 2 - ALTO / 2 };
  globo.left = Math.max(12, Math.min(globo.left, innerWidth - ANCHO - 12));
  globo.top = Math.max(12, Math.min(globo.top, innerHeight - ALTO - 12));
  return html`
    <div class="tour-capa" onClick=${sig}></div>
    ${r && html`<div class="tour-hueco" style=${`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`}></div>`}
    <div class="tour-globo" style=${`left:${globo.left}px;top:${globo.top}px;width:${ANCHO}px`} role="dialog" aria-live="polite">
      <${Demo} key=${paso.demo} tipo=${paso.demo} />
      <div class="tg-cab"><b>${paso.t}</b><span class="num">${i + 1}/${PASOS.length}</span></div>
      <p>${paso.d}</p>
      <div class="tg-pie">
        <button class="btn fantasma chico" onClick=${terminar}>Saltar</button>
        <div class="tg-puntos">${PASOS.map((_, k) => html`<i key=${k} class=${k === i ? 'on' : ''}></i>`)}</div>
        <span class="tg-nav">
          ${i > 0 && html`<button class="icon-btn chico" onClick=${() => setI(i - 1)} aria-label="Anterior">${I('flecha')}</button>`}
          <button class="btn prim chico" onClick=${sig}>${i < PASOS.length - 1 ? 'Siguiente' : 'Listo'}</button>
        </span>
      </div>
    </div>`;
}
