// Recorrido de inducción: bienvenida y pasos con foco sobre cada parte de la app.
import { html, useState, useEffect, useLayoutEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I, Estrella } from './ui.js?v=202611241437';

export const PASOS = [
  { sel: '[data-tour="dias"]', t: 'Tus días', d: 'Toca un día para verlo. Suelta aquí una tarea para moverla.' },
  { sel: '[data-tour="calendario"]', t: 'La mecha', d: 'Arrastra una tarea para cambiarle la hora. Toca un espacio libre para crear una.' },
  { sel: '[data-tour="vistas"]', t: 'Cómo lo ves', d: 'Día, semana, mes o tarjetas. Elige el que te acomode.' },
  { sel: '[data-tour="acomodo"]', t: 'Tu inicio', d: 'Widgets a un lado, arriba o solo calendario.' },
  { sel: '[data-tour="widgets"]', t: 'Widgets', d: 'Con el ícono de ajustes agregas, quitas o mueves widgets.' },
  { sel: '[data-tour="mas"]', t: 'Nueva tarea', d: 'También con la tecla N.' },
  { sel: '[data-tour="mapa"]', t: 'Mapa', d: 'Conecta tareas y personas con flechas para asignar y ordenar el flujo.' },
  { sel: '[data-tour="chat"]', t: 'Chat', d: 'Habla con el equipo y envía facturas.' },
  { sel: '[data-tour="buscar"]', t: 'Buscar', d: 'Encuentra todo. Atajo ⌘K.' },
];

export function Bienvenida({ empezar, saltar, nombre }) {
  return html`
    <div class="velo alto"></div>
    <div class="bienvenida" role="dialog" aria-modal="true" aria-label="Bienvenida">
      <div class="bv-estrella"><${Estrella} /></div>
      <h2>Hola, ${nombre}</h2>
      <p>Te enseñamos lo básico en un minuto.</p>
      <button class="btn prim ancho" onClick=${empezar}>Empezar recorrido</button>
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
      setR({ x: b.left - 6, y: b.top - 6, w: b.width + 12, h: Math.min(b.height + 12, innerHeight - 24) });
    };
    medir();
    addEventListener('resize', medir);
    return () => removeEventListener('resize', medir);
  }, [i]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') terminar(); if (e.key === 'ArrowRight' || e.key === 'Enter') sig(); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const sig = () => (i < PASOS.length - 1 ? setI(i + 1) : terminar());
  const abajo = r && r.y + r.h + 180 < innerHeight;
  const globo = r ? { left: Math.max(12, Math.min(r.x, innerWidth - 332)), top: abajo ? r.y + r.h + 12 : Math.max(12, r.y - 172) } : { left: innerWidth / 2 - 160, top: innerHeight / 2 - 80 };
  return html`
    <div class="tour-capa" onClick=${sig}></div>
    ${r && html`<div class="tour-hueco" style=${`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`}></div>`}
    <div class="tour-globo" style=${`left:${globo.left}px;top:${globo.top}px`} role="dialog" aria-live="polite">
      <div class="tg-cab"><b>${paso.t}</b><span class="num">${i + 1}/${PASOS.length}</span></div>
      <p>${paso.d}</p>
      <div class="tg-pie">
        <button class="btn fantasma chico" onClick=${terminar}>Saltar</button>
        <div class="tg-puntos">${PASOS.map((_, k) => html`<i key=${k} class=${k === i ? 'on' : ''}></i>`)}</div>
        <button class="btn prim chico" onClick=${sig}>${i < PASOS.length - 1 ? 'Siguiente' : 'Listo'}</button>
      </div>
    </div>`;
}
