// Vistas como en Notion: cada base Master del Portal tiene las mismas vistas guardadas que en Notion,
// con sus mismos nombres, y el Portal recuerda la última que usó cada persona.
// Aquí viven las piezas que comparten: el selector de vistas, el Board, el Calendario y el Chart.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { sumarDias } from './datos.js?v=202611270745';
import { prefsDe, guardarPrefs } from './store.js?v=202611270745';
import { I } from './ui.js?v=202611270745';

const ICONO_TIPO = { tabla: 'lista', board: 'columnas', calendario: 'calendario', grafica: 'grafica', lista: 'lista' };

// La vista elegida se guarda por persona y por base (prefs.vistas = { tareas: 'board', ... }).
export function useVista(yo, base, vistas) {
  const guardada = (prefsDe(yo).vistas || {})[base];
  const [id, setId] = useState(vistas.some((v) => v.id === guardada) ? guardada : vistas[0].id);
  const elegir = (nueva) => { setId(nueva); guardarPrefs(yo, { vistas: { ...(prefsDe(yo).vistas || {}), [base]: nueva } }); };
  return [vistas.find((v) => v.id === id) || vistas[0], elegir];
}

export function BarraVistas({ vistas, actual, elegir }) {
  return html`<div class="vn-barra">
    <div class="segmentado vistas vistas-notion" role="tablist" aria-label="Vistas">${vistas.map((v) => html`<button key=${v.id} role="tab"
      aria-selected=${actual.id === v.id} aria-pressed=${actual.id === v.id} onClick=${() => elegir(v.id)}>${I(ICONO_TIPO[v.tipo] || 'lista')}<span>${v.nombre}</span></button>`)}</div>
    ${actual.ayuda && html`<p class="vn-ayuda">${actual.ayuda}</p>`}
  </div>`;
}

// Board: columnas por una propiedad (estatus, fase, salud, persona…). «tarjeta» pinta cada elemento.
export function Kanban({ columnas, tarjeta, vacia = 'Nada aquí' }) {
  return html`<div class="pipe-cols vn-kanban" style=${`--n:${columnas.length}`}>${columnas.map((c) => html`<section key=${c.id} class="pipe-col">
    <h3>${c.icono || null}<span class="vn-col-t">${c.nombre}</span><span class="num">${c.lista.length}</span></h3>
    <div class="pc-lista">${c.lista.length ? c.lista.map(tarjeta) : html`<div class="pc-vacia">${vacia}</div>`}</div>
  </section>`)}</div>`;
}

// Tarjeta sencilla para los Board de proyectos, hitos y minutas.
export function TarjetaBase({ color, arriba, titulo, nota, abajo, onClick, href }) {
  const cuerpo = html`${arriba && html`<span class="pcard-cli">${arriba}</span>`}<span class="pcard-t">${titulo}</span>${nota && html`<small class="vn-nota">${nota}</small>`}${abajo && html`<span class="pcard-pie vn-pie">${abajo}</span>`}`;
  return href
    ? html`<a class="pcard vn-card" style=${`--c:${color || 'var(--tinta-3)'}`} href=${href}>${cuerpo}</a>`
    : html`<button class="pcard vn-card" style=${`--c:${color || 'var(--tinta-3)'}`} onClick=${onClick}>${cuerpo}</button>`;
}

// Calendario del mes: cada elemento cae en su fecha. Flechas para cambiar de mes.
const mesLargo = (iso) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(iso + '-15T12:00:00'));
export function CalendarioMes({ items, fechaDe, ficha, hoy }) {
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [abierto, setAbierto] = useState(null);
  const primero = mes + '-01';
  const inicio = sumarDias(primero, -((new Date(primero + 'T12:00:00').getDay() + 6) % 7));
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const mover = (n) => { const d = new Date(primero + 'T12:00:00'); d.setMonth(d.getMonth() + n); setMes(d.toISOString().slice(0, 7)); setAbierto(null); };
  const delDia = (f) => items.filter((x) => (fechaDe(x) || '').slice(0, 10) === f);
  const sem = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const lista = abierto ? delDia(abierto) : [];
  return html`<div class="vn-cal">
    <div class="vn-cal-cab">
      <button class="icon-btn" onClick=${() => mover(-1)} aria-label="Mes anterior">${I('flecha')}</button>
      <b>${mesLargo(mes)}</b>
      <button class="icon-btn" onClick=${() => mover(1)} aria-label="Mes siguiente">${I('adelante')}</button>
      ${mes !== hoy.slice(0, 7) && html`<button class="btn fantasma chico" onClick=${() => { setMes(hoy.slice(0, 7)); setAbierto(null); }}>Hoy</button>`}
    </div>
    <div class="mes vn-mes">
      ${sem.map((s, i) => html`<div class="mes-sem" key=${'s' + i}>${s}</div>`)}
      ${dias.map((f) => {
        const l = delDia(f);
        return html`<div key=${f} class=${'mes-dia' + (f.slice(0, 7) !== mes ? ' fuera' : '') + (f === hoy ? ' hoy' : '') + (abierto === f ? ' abierto' : '')}>
          <span class="mes-num num">${+f.slice(8)}</span>
          ${l.slice(0, 3).map(ficha)}
          ${l.length > 3 && html`<button class="mes-mas" onClick=${() => setAbierto(abierto === f ? null : f)}>+${l.length - 3} más</button>`}
        </div>`;
      })}
    </div>
    ${abierto && html`<section class="vn-dia"><h3>${new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(abierto + 'T12:00:00'))}<span class="num">${lista.length}</span>
      <button class="icon-btn" onClick=${() => setAbierto(null)} aria-label="Cerrar">${I('x')}</button></h3><div class="vn-dia-l">${lista.map(ficha)}</div></section>`}
  </div>`;
}
// Elemento del calendario: una pastilla con el color del cliente.
export function FichaCal({ color, texto, hecha, onClick }) {
  return html`<button class=${'vn-ev' + (hecha ? ' hecha' : '')} style=${`--c:${color || 'var(--tinta-3)'}`} onClick=${onClick} title=${texto}>${texto}</button>`;
}

// Chart: barras horizontales de mayor a menor, un solo color; el número va al final de cada barra.
export function GraficaBarras({ titulo, filas, unidad }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const total = filas.reduce((s, f) => s + f.valor, 0);
  return html`<section class="ca-panel vn-graf">
    <h3>${titulo}<small class="num">${total} ${unidad}</small></h3>
    <div class="vn-gf-l" role="table" aria-label=${titulo}>${filas.map((f) => html`<div key=${f.id} class="vn-gf" role="row" title=${`${f.nombre}: ${f.valor} ${unidad}`}>
      <span class="vn-gf-n" role="rowheader">${f.logo || null}<span>${f.nombre}</span></span>
      <span class="vn-gf-b" role="cell" aria-hidden="true"><i style=${`width:${(f.valor / max) * 100}%`}></i></span>
      <b class="num" role="cell">${f.valor}</b>
    </div>`)}</div>
  </section>`;
}
