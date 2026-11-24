// Piezas visuales compartidas: íconos, anillo de estatus, estrella de Spark, avatares y formato de fechas.
import { html } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO } from './datos.js';

const P = {
  hoy: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  sol: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  luna: 'M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z',
  mas: 'M12 5v14M5 12h14',
  buscar: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5',
  campana: 'M6 17V11a6 6 0 1112 0v6l1.5 2h-15L6 17zM10 21h4',
  semana: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clientes: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6',
  proyectos: 'M3 7h7l2 2h9v10H3z',
  equipo: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.5 3.5 0 010 6.5M18 14.8c1.8.7 3 2.6 3 5.2',
  papelera: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  archivar: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
  x: 'M6 6l12 12M18 6L6 18',
  repetir: 'M4 12a8 8 0 0113.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.7L4 16M4 20v-4h4',
  enlace: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  foco: 'M12 3l2.3 6.7H21l-5.5 4 2.1 6.8L12 16.4 6.4 20.5l2.1-6.8L3 9.7h6.7z',
  reloj: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lista: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  espera: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  cadena: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  tema: 'M12 3a9 9 0 100 18V3z M12 3a9 9 0 010 18',
  flecha: 'M15 6l-6 6 6 6',
  menu: 'M5 12h.01M12 12h.01M19 12h.01',
  reset: 'M4 4v6h6M20 20v-6h-6M5.6 15A8 8 0 0019 14M18.4 9A8 8 0 005 10',
  drive: 'M8 3h8l6 11-4 7H6l-4-7z M8 3l6 11M2 14h12M16 3L10 14',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
};
export function I(nombre, extra = '') {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'i ' + extra}><path d=${P[nombre] || ''} /></svg>`;
}

// Anillo de estatus: forma distinta por estado para no depender solo del color.
export function Anillo({ estatus }) {
  const r = 8.25;
  if (estatus === 'hecho') return html`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="M6 10.4l2.6 2.5L14 7.5" stroke="var(--noche)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  if (estatus === 'en_curso') return html`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r=${r} fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M10 3.6a6.4 6.4 0 010 12.8z" fill="currentColor" /></svg>`;
  if (estatus === 'esperando') return html`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r=${r} fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2.6" /></svg>`;
  if (estatus === 'bloqueado') return html`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r=${r} fill="none" stroke="var(--chispa)" stroke-width="1.6" /><path d="M4.5 15.5L15.5 4.5" stroke="var(--chispa)" stroke-width="1.6" /></svg>`;
  return html`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r=${r} fill="none" stroke="currentColor" stroke-width="1.6" /></svg>`;
}

// Chispa de cuatro puntas del isotipo de Spark: marca el «ahora» en la mecha.
export function Estrella() {
  return html`<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="g-chispa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5C245" /><stop offset="1" stop-color="#E47739" /></linearGradient></defs><path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5-.9-5.6-4.9-9.6-10.5-10.5C7.1 11.1 11.1 7.1 12 1.5z" fill="url(#g-chispa)" /></svg>`;
}

export function Avatar({ p, grande }) {
  if (!p) return null;
  const ini = p.nombre.split(' ').map((s) => s[0]).slice(0, 2).join('');
  return html`<span class=${'avatar' + (grande ? ' g' : '')} style=${`--av:${p.color}`} title=${p.nombre}>${ini}</span>`;
}

// ---------- Fechas ----------
const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCorto = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
export const fechaLarga = (iso) => fmtDia.format(new Date(iso + 'T12:00:00'));
export const fechaCorta = (iso) => fmtCorto.format(new Date(iso + 'T12:00:00')).replace(/\./g, '');
export function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
export function fechaRelativa(iso) {
  const n = diasEntre(hoyISO(), iso);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1 && n < 7) return `en ${n} días`;
  if (n < -1 && n > -7) return `hace ${-n} días`;
  return fechaCorta(iso);
}
export const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function duracion(min) { if (min < 60) return `${min} min`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h`; }
export function haceCuanto(isoFechaHora) {
  const s = (Date.now() - new Date(isoFechaHora).getTime()) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400); return d === 1 ? 'ayer' : `hace ${d} días`;
}
