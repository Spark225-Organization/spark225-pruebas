// Arrastrar y soltar con pointer events: mouse al moverse 6 px; dedo con pulsación larga (300 ms).
// Los destinos se marcan con data-drop="tipo" y sus datos en data-*.
import { useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

let actual = null;
const oyentes = new Set();
const emitir = () => oyentes.forEach((f) => f());

export function useArrastre() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); oyentes.add(f); return () => oyentes.delete(f); }, []);
  return actual;
}

function destinoEn(x, y) {
  const el = document.elementFromPoint(x, y)?.closest('[data-drop]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { tipo: el.dataset.drop, el, ...el.dataset, offsetY: y - r.top, offsetX: x - r.left };
}

export function iniciarArrastre(e, { datos, etiqueta, color, alSoltar, alClic }) {
  if (e.button !== undefined && e.button !== 0) return;
  const tactil = e.pointerType === 'touch';
  const x0 = e.clientX, y0 = e.clientY;
  let empezado = false, timer = null;

  const empezar = (x, y) => {
    empezado = true;
    actual = { datos, etiqueta, color, x, y, destino: destinoEn(x, y) };
    document.body.classList.add('arrastrando');
    try { navigator.vibrate?.(8); } catch (_) { /* sin vibración */ }
    emitir();
  };
  const fin = () => {
    clearTimeout(timer);
    removeEventListener('pointermove', mov);
    removeEventListener('pointerup', arriba);
    removeEventListener('pointercancel', cancelar);
    removeEventListener('touchmove', bloquearScroll);
    if (empezado) {
      actual = null; document.body.classList.remove('arrastrando'); emitir();
      // El clic que el navegador dispara al soltar no debe abrir nada.
      const comer = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      addEventListener('click', comer, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', comer, { capture: true }), 0);
    }
  };
  const mov = (ev) => {
    const x = ev.clientX, y = ev.clientY;
    if (!empezado) {
      if (Math.hypot(x - x0, y - y0) < 6) return;
      if (tactil) { fin(); return; } // con el dedo, moverse antes de tiempo es hacer scroll
      empezar(x, y);
    }
    actual.x = x; actual.y = y; actual.destino = destinoEn(x, y);
    emitir();
  };
  const arriba = (ev) => {
    const d = empezado ? actual.destino : null;
    const fueArrastre = empezado;
    fin();
    if (fueArrastre) { if (d) alSoltar?.(d); } else alClic?.(ev);
  };
  const cancelar = () => fin();
  const bloquearScroll = (ev) => { if (empezado) ev.preventDefault(); };

  if (tactil) timer = setTimeout(() => empezar(x0, y0), 300);
  addEventListener('pointermove', mov);
  addEventListener('pointerup', arriba);
  addEventListener('pointercancel', cancelar);
  addEventListener('touchmove', bloquearScroll, { passive: false });
}
