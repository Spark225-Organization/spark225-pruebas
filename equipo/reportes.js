// Reportes por área: el Portal arma el borrador con los datos (tareas, clientes, proyectos, Focus Map…),
// cada quien edita títulos, textos y gráficas, y lo presenta o lo descarga en PDF, PowerPoint o Excel.
// Reglas: sin precios ni cotizaciones de Spark225, sin datos de pacientes, y armar un reporte nunca cambia datos.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO } from './datos.js?v=202611270600';
import { reportesGuardados, crearReporte, actualizarReporte, quitarReporte, esAdmin, areasVigentes, nube } from './store.js?v=202611270600';
import { I, Avatar, Info, haceCuanto } from './ui.js?v=202611270600';
import { PERIODOS, rangoDe, textoPeriodo, AREAS_REPORTE, nombreArea, FUENTES, reporteNuevo, bloqueNuevo, calcularBloque, tituloBloque, graficaBloque } from './reportes-datos.js?v=202611270600';

// ---------- Colores (la hoja del reporte siempre es clara, como un documento) ----------
const MARCA = '#E47739';
const TONO = { bien_fuerte: '#006300', bien: '#0ca30c', atencion: '#fab219', riesgo: '#d03b3b', neutro: '#c3c2b7' };
const TONO_TXT = { bien_fuerte: 'Súper verde', bien: 'Va bien', atencion: 'Atención', riesgo: 'En riesgo', neutro: 'Sin medir' };
const CATEGORICOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']; // orden fijo validado; el resto va a «Otros»
const OTROS = '#898781';
const NOMBRE_GRAFICA = { kpis: 'Indicadores', barras: 'Barras', linea: 'Línea', dona: 'Dona', tabla: 'Tabla', texto: 'Texto' };
const ICONO_GRAFICA = { kpis: 'cuadricula', barras: 'grafica', linea: 'sube', dona: 'porcentaje', tabla: 'lista', texto: 'nota' };

// ---------- Lista de reportes ----------
export function ListaReportes({ ctx }) {
  const { db, yo } = ctx;
  const miArea = areasVigentes().find((a) => (a.personas || []).includes(yo))?.id;
  const [area, setArea] = useState(AREAS_REPORTE.some((a) => a.id === miArea) ? miArea : 'direccion');
  const [periodo, setPeriodo] = useState('mes');
  const [libre, setLibre] = useState(() => rangoDe('libre'));
  const guardados = reportesGuardados();
  const rango = periodo === 'libre' ? libre : rangoDe(periodo);
  const armar = () => {
    if (rango.desde > rango.hasta) { ctx.toast?.('La fecha inicial va antes que la final.'); return; }
    const r = crearReporte(reporteNuevo(area, periodo, rango, yo), yo);
    location.hash = '#/reporte/' + r.id;
  };
  const per = (id) => db.personas.find((p) => p.id === id);
  return html`<div class="rp-lista">
    <header class="cab-inicio"><div class="cab-dia"><h1>Reportes <${Info} t="El Portal arma el reporte con los datos de tareas, clientes, proyectos, hitos y el Focus Map. Tú cambias títulos, textos y gráficas, y lo presentas o lo descargas. Nunca incluye precios ni datos de pacientes." /></h1>
      <span class="sub">Arma un reporte por área, edítalo y descárgalo</span></div></header>

    <section class="ca-panel rp-nuevo">
      <h2>Nuevo reporte</h2>
      <fieldset class="rp-areas"><legend>Área</legend>
        ${AREAS_REPORTE.map((a) => html`<label key=${a.id} class=${'rp-area' + (area === a.id ? ' on' : '')}>
          <input type="radio" name="rp-area" value=${a.id} checked=${area === a.id} onChange=${() => setArea(a.id)} />
          <span class="rp-area-ico">${I(a.icono)}</span><b>${a.nombre}</b><small>${a.ayuda}</small></label>`)}
      </fieldset>
      <div class="rp-periodo"><span class="rp-etq">Periodo</span>
        <div class="segmentado chico rp-seg">${PERIODOS.map((p) => html`<button key=${p.id} aria-pressed=${periodo === p.id} onClick=${() => setPeriodo(p.id)}>${p.nombre}</button>`)}</div>
        ${periodo === 'libre' && html`<span class="rp-fechas"><input type="date" class="control chico" value=${libre.desde} onInput=${(e) => setLibre({ ...libre, desde: e.target.value })} aria-label="Desde" />
          <span>a</span><input type="date" class="control chico" value=${libre.hasta} onInput=${(e) => setLibre({ ...libre, hasta: e.target.value })} aria-label="Hasta" /></span>`}
        <span class="tenue rp-rango">${textoPeriodo(rango)}</span>
      </div>
      <button class="btn prim" onClick=${armar}>${I('grafica')}Armar reporte de ${nombreArea(area)}</button>
    </section>

    ${nube.sinRH && html`<p class="ca-nota">Los reportes se guardan en este navegador hasta activar el guardado en la base (un paso de una vez).</p>`}
    <section class="rp-guardados">
      <h2>Guardados <span class="num tenue">${guardados.length}</span></h2>
      ${guardados.length === 0 ? html`<div class="ls-vacia"><p>Aún no hay reportes. Elige un área y un periodo y toca «Armar reporte».</p></div>` : html`<ul class="ca-lista">${guardados.map((r) => html`<li key=${r.id}>
        <a href=${'#/reporte/' + r.id} class="rp-g">
          <span class="rp-g-ico">${I(AREAS_REPORTE.find((a) => a.id === r.area)?.icono || 'documento')}</span>
          <span class="cl-t">${r.titulo}<small class="tenue">${nombreArea(r.area)} · ${textoPeriodo(r.periodo)}</small></span>
          <${Avatar} p=${per(r.autor)} /><span class="num cl-f">${haceCuanto(r.editado)}</span></a>
        ${(r.autor === yo || esAdmin(yo)) && html`<button class="icon-btn peligro" aria-label=${`Quitar ${r.titulo}`} title="Quitar" onClick=${() => { if (confirm(`¿Quitar «${r.titulo}»? No se puede deshacer.`)) quitarReporte(r.id, yo); }}>${I('papelera')}</button>`}
      </li>`)}</ul>`}
    </section>
  </div>`;
}

// ---------- Editor ----------
export function EditorReporte({ id, ctx }) {
  const { db, yo } = ctx;
  const r = (db.reportes || []).find((x) => x.id === id);
  const [menu, setMenu] = useState(null); // 'agregar' | 'descargar'
  const [presentando, setPresentando] = useState(false);
  const [ocupado, setOcupado] = useState('');
  if (!r) return html`<div class="vacio">${I('documento')}<p>Ese reporte ya no está.</p><a class="btn" href="#/reportes">Volver a Reportes</a></div>`;
  const cambiar = (c) => actualizarReporte(r.id, c, yo);
  const cambiarBloque = (bid, c) => cambiar({ bloques: r.bloques.map((b) => (b.id === bid ? { ...b, ...c } : b)) });
  const mover = (i, d) => { const l = [...r.bloques]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; cambiar({ bloques: l }); };
  const quitar = (bid) => cambiar({ bloques: r.bloques.filter((b) => b.id !== bid) });
  const agregar = (fuente) => { cambiar({ bloques: [...r.bloques, bloqueNuevo(fuente, fuente === 'texto' ? 'Nota' : null)] }); setMenu(null); };
  const cambiarPeriodo = (tipo, rango = rangoDe(tipo)) => cambiar({ periodo: { tipo, ...rango } });
  const autor = db.personas.find((p) => p.id === r.autor);
  const calc = Object.fromEntries(r.bloques.map((b) => [b.id, calcularBloque(r, b)]));
  const descargar = async (tipo) => {
    setMenu(null);
    if (tipo === 'pdf') { imprimir(r); return; }
    setOcupado(tipo === 'ppt' ? 'Armando el PowerPoint…' : 'Armando el Excel…');
    try { if (tipo === 'ppt') await exportarPPT(r, calc, autor); else await exportarExcel(r, calc, autor); }
    catch (e) { console.warn(e); ctx.toast?.('No se pudo descargar. Revisa tu conexión e inténtalo otra vez.'); }
    setOcupado('');
  };

  return html`<div class="rp-editor">
    <div class="rp-barra">
      <a class="btn fantasma chico" href="#/reportes">${I('flecha')}Reportes</a>
      <span class="rp-per">
        <select class="control chico" value=${r.periodo.tipo} onChange=${(e) => cambiarPeriodo(e.target.value, e.target.value === 'libre' ? { desde: r.periodo.desde, hasta: r.periodo.hasta } : rangoDe(e.target.value))} aria-label="Periodo">
          ${PERIODOS.map((p) => html`<option key=${p.id} value=${p.id}>${p.nombre}</option>`)}</select>
        ${r.periodo.tipo === 'libre' && html`<input type="date" class="control chico" value=${r.periodo.desde} onChange=${(e) => e.target.value && cambiarPeriodo('libre', { desde: e.target.value, hasta: r.periodo.hasta })} aria-label="Desde" />
          <input type="date" class="control chico" value=${r.periodo.hasta} onChange=${(e) => e.target.value && cambiarPeriodo('libre', { desde: r.periodo.desde, hasta: e.target.value })} aria-label="Hasta" />`}
      </span>
      <span class="rp-acc">
        <span class="rel"><button class="btn chico" onClick=${() => setMenu(menu === 'agregar' ? null : 'agregar')} aria-expanded=${menu === 'agregar'}>${I('mas')}Agregar bloque</button>
          ${menu === 'agregar' && html`<div class="rp-menu" role="menu">${Object.entries(FUENTES).map(([k, f]) => html`<button key=${k} role="menuitem" onClick=${() => agregar(k)}>${I(ICONO_GRAFICA[f.graficas[0]] || 'lista')}${f.nombre}</button>`)}</div>`}</span>
        <button class="btn chico" onClick=${() => setPresentando(true)}>${I('externo')}Presentar</button>
        <span class="rel"><button class="btn prim chico" onClick=${() => setMenu(menu === 'descargar' ? null : 'descargar')} aria-expanded=${menu === 'descargar'} disabled=${!!ocupado}>${I('subir', 'rot-180')}${ocupado || 'Descargar'}</button>
          ${menu === 'descargar' && html`<div class="rp-menu der" role="menu">
            <button role="menuitem" onClick=${() => descargar('pdf')}>${I('documento')}<span>PDF<small>Para enviar o imprimir</small></span></button>
            <button role="menuitem" onClick=${() => descargar('ppt')}>${I('cuadricula')}<span>PowerPoint<small>Diapositivas y gráficas editables</small></span></button>
            <button role="menuitem" onClick=${() => descargar('xlsx')}>${I('lista')}<span>Excel<small>Los datos de cada bloque</small></span></button></div>`}</span>
      </span>
    </div>

    <article class="rp-hoja" aria-label=${r.titulo}>
      <${Portada} r=${r} autor=${autor} editar=${(t) => cambiar({ titulo: t || r.titulo })} />
      ${r.bloques.map((b, i) => html`<${Bloque} key=${b.id} b=${b} d=${calc[b.id]} primero=${i === 0} ultimo=${i === r.bloques.length - 1}
        cambiar=${(c) => cambiarBloque(b.id, c)} subir=${() => mover(i, -1)} bajar=${() => mover(i, 1)} quitar=${() => quitar(b.id)} />`)}
      <footer class="rp-pie">Spark225 · ${nombreArea(r.area)} · ${textoPeriodo(r.periodo)} · Preparado con los datos del Portal de colaboradores</footer>
    </article>
    ${presentando && html`<${Presentacion} r=${r} calc=${calc} autor=${autor} cerrar=${() => setPresentando(false)} />`}
  </div>`;
}

function Portada({ r, autor, editar, diapo }) {
  return html`<header class=${'rp-portada' + (diapo ? ' diapo' : '')}>
    <div class="rp-marca"><img src="./icons/iso.png" alt="" width="40" height="40" /><b>Spark225</b></div>
    ${editar ? html`<${Editable} valor=${r.titulo} clase="rp-titulo" etiqueta="Título del reporte" onCambio=${editar} />` : html`<h1 class="rp-titulo">${r.titulo}</h1>`}
    <p class="rp-meta">${nombreArea(r.area)} · ${textoPeriodo(r.periodo)}${autor ? ` · Preparado por ${autor.nombre || autor.corto}` : ''} · ${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
    <i class="rp-franja" aria-hidden="true"></i>
  </header>`;
}

function Bloque({ b, d, primero, ultimo, cambiar, subir, bajar, quitar }) {
  const fu = FUENTES[b.fuente] || { graficas: ['tabla'], nombre: 'Bloque' };
  const g = graficaBloque(b);
  const auto = d.resumen || '';
  if (b.oculto) return html`<section class="rp-bloque oculto solo-pantalla"><span>${I('ojo')}<b>${tituloBloque(b)}</b> no aparece en el reporte</span>
    <button class="btn fantasma chico" onClick=${() => cambiar({ oculto: false })}>Mostrar</button></section>`;
  return html`<section class="rp-bloque">
    <div class="rp-herr solo-pantalla" role="toolbar" aria-label=${`Opciones de ${tituloBloque(b)}`}>
      ${fu.graficas.length > 1 && html`<div class="segmentado chico" aria-label="Tipo de gráfica">${fu.graficas.map((t) => html`<button key=${t} aria-pressed=${g === t} onClick=${() => cambiar({ grafica: t })} title=${NOMBRE_GRAFICA[t]}>${I(ICONO_GRAFICA[t])}<span>${NOMBRE_GRAFICA[t]}</span></button>`)}</div>`}
      <span class="rp-herr-der">
        <button class="icon-btn" onClick=${subir} disabled=${primero} aria-label="Subir" title="Subir">${I('flecha', 'rot-arriba')}</button>
        <button class="icon-btn" onClick=${bajar} disabled=${ultimo} aria-label="Bajar" title="Bajar">${I('flecha', 'rot-abajo')}</button>
        <button class="icon-btn" onClick=${() => cambiar({ oculto: true })} aria-label="Ocultar del reporte" title="Ocultar del reporte">${I('ojo')}</button>
        <button class="icon-btn peligro" onClick=${quitar} aria-label="Quitar bloque" title="Quitar bloque">${I('x')}</button>
      </span>
    </div>
    <${Editable} valor=${tituloBloque(b)} clase="rp-h2" etiqueta="Título del bloque" onCambio=${(t) => cambiar({ titulo: t && t !== fu.nombre ? t : null })} />
    <${Editable} valor=${b.texto ?? auto} clase="rp-texto" multilinea etiqueta="Texto del bloque" vacio=${b.fuente === 'texto' ? 'Escribe aquí tus conclusiones, acuerdos o siguientes pasos.' : 'Escribe un comentario…'}
      onCambio=${(t) => cambiar({ texto: b.fuente !== 'texto' && t === auto ? null : t })} />
    ${b.texto !== null && b.fuente !== 'texto' && auto && html`<button class="rp-reset solo-pantalla" onClick=${() => cambiar({ texto: null })}>${I('reset')}Volver al texto automático</button>`}
    ${fu.captura && html`<${Captura} b=${b} d=${d} cambiar=${cambiar} />`}
    <div class=${fu.captura ? 'solo-impresion' : ''}><${Visual} tipo=${g} d=${d} /></div>
  </section>`;
}

// Texto editable en su lugar: se guarda al salir del campo.
function Editable({ valor, onCambio, clase = '', multilinea, etiqueta, vacio }) {
  const ref = useRef();
  useEffect(() => { const el = ref.current; if (el && document.activeElement !== el && el.innerText !== (valor || '')) el.innerText = valor || ''; }, [valor]);
  return html`<div ref=${ref} class=${'rp-editable ' + clase} contenteditable="true" role="textbox" aria-label=${etiqueta} aria-multiline=${!!multilinea} data-vacio=${vacio || ''} spellcheck="true"
    onBlur=${(e) => { const t = e.currentTarget.innerText.replace(/ /g, ' ').trim(); if (t !== (valor || '').trim()) onCambio(t); }}
    onKeyDown=${(e) => { if (!multilinea && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}></div>`;
}

// Captura de resultados de pauta (vienen de Meta, SCORE o Metricool; el Portal calcula costos y conversión).
function Captura({ b, d, cambiar }) {
  const filas = b.captura?.filas || [];
  const poner = (id, k, v) => cambiar({ captura: { filas: filas.map((f) => (f.id === id ? { ...f, [k]: v } : f)) } });
  const calc = Object.fromEntries((d.filasCaptura || []).map((x) => [x.id, x]));
  const mx = (v) => (v === null || v === undefined ? '—' : `$${v.toLocaleString('es-MX')}`);
  return html`<div class="rp-captura solo-pantalla">
    <div class="ls-marco"><table class="ls rp-cap">
      <thead><tr><th>Cliente</th><th>Inversión ($)</th><th>Leads</th><th>Citas agendadas</th><th>Citas asistidas</th><th>Costo por lead</th><th>Costo por cita asistida</th><th>Lead → cita</th><th><span class="sr">Quitar</span></th></tr></thead>
      <tbody>${filas.map((f) => html`<tr key=${f.id}>
        <td><input class="control chico" value=${f.cliente} onChange=${(e) => poner(f.id, 'cliente', e.target.value)} aria-label="Cliente" /></td>
        ${['inversion', 'leads', 'agendadas', 'asistidas'].map((k) => html`<td key=${k}><input class="control chico num" inputmode="decimal" value=${f[k]} onChange=${(e) => poner(f.id, k, e.target.value.replace(/[^0-9.]/g, ''))} aria-label=${k} /></td>`)}
        <td class="num">${mx(calc[f.id]?.cpl)}</td><td class="num">${mx(calc[f.id]?.cpc)}</td><td class="num">${calc[f.id]?.conv === null || calc[f.id]?.conv === undefined ? '—' : `${calc[f.id].conv} %`}</td>
        <td><button class="icon-btn peligro" onClick=${() => cambiar({ captura: { filas: filas.filter((x) => x.id !== f.id) } })} aria-label="Quitar fila">${I('x')}</button></td></tr>`)}</tbody>
    </table></div>
    <button class="btn fantasma chico" onClick=${() => cambiar({ captura: { filas: [...filas, { id: 'f' + Math.random().toString(36).slice(2, 8), cliente: '', inversion: '', leads: '', agendadas: '', asistidas: '' }] } })}>${I('mas')}Agregar cliente</button>
    <p class="tenue rp-nota-cap">Estas cifras se capturan a mano (vienen de Meta, SCORE o Metricool). En el PDF y la presentación se ve la tabla calculada.</p>
  </div>`;
}

// ---------- Visuales ----------
function Visual({ tipo, d }) {
  if (tipo === 'texto') return null;
  if (tipo === 'kpis' && d.kpis) return html`<${Kpis} kpis=${d.kpis} />`;
  if (tipo === 'barras' && d.serie?.puntos?.length) return html`<${Barras} s=${d.serie} />`;
  if (tipo === 'linea' && d.serie?.puntos?.length) return html`<${Linea} s=${d.serie} />`;
  if (tipo === 'dona' && d.serie?.puntos?.some((p) => p.valor)) return html`<${Dona} s=${d.serie} />`;
  if (d.tabla?.filas?.length) return html`<${Tabla} t=${d.tabla} />`;
  if (d.kpis) return html`<${Kpis} kpis=${d.kpis} />`;
  return html`<p class="rp-sin">Sin datos para mostrar en este periodo.</p>`;
}
function Kpis({ kpis }) {
  return html`<div class="rp-kpis">${kpis.map((k) => html`<div key=${k.etq} class="rp-kpi">
    <span class="rp-kpi-e">${k.etq}</span><b class="rp-kpi-v num">${k.valor}</b>
    ${k.tono && k.tono !== 'neutro' && html`<span class="rp-tono"><i style=${`background:${TONO[k.tono]}`}></i>${TONO_TXT[k.tono]}</span>`}
    <small class="rp-kpi-s">${k.sub}</small></div>`)}</div>`;
}
const fmtV = (v, s) => (v === null || v === undefined ? '—' : `${typeof v === 'number' ? v.toLocaleString('es-MX') : v}${s.unidad === '%' ? ' %' : ''}`);
function Barras({ s }) {
  const max = s.max || Math.max(1, ...s.puntos.map((p) => p.valor || 0));
  return html`<div class="rp-barras" role="table" aria-label="Gráfica de barras">
    ${s.puntos.map((p) => html`<div key=${p.etq} class="rp-b" role="row" title=${`${p.etq}: ${fmtV(p.valor, s)}${p.tono ? ' · ' + TONO_TXT[p.tono] : ''}`}>
      <span class="rp-b-n" role="rowheader">${p.etq}</span>
      <span class="rp-b-t" role="cell" aria-hidden="true"><i style=${`width:${Math.max(0.5, ((p.valor || 0) / max) * 100)}%;background:${p.tono ? TONO[p.tono] : MARCA}`}></i></span>
      <b class="num" role="cell">${fmtV(p.valor, s)}</b></div>`)}
    <span class="rp-unidad">${s.unidad}</span></div>`;
}
function Linea({ s }) {
  const W = 640, H = 220, L = 40, R = 16, T = 14, B = 30;
  const max = s.max || Math.max(1, ...s.puntos.map((p) => p.valor || 0));
  const n = s.puntos.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const tramos = []; let actual = [];
  s.puntos.forEach((p, i) => { if (p.valor === null || p.valor === undefined) { if (actual.length) tramos.push(actual); actual = []; } else actual.push([x(i), y(p.valor)]); });
  if (actual.length) tramos.push(actual);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const ultimo = [...s.puntos.keys()].reverse().find((i) => s.puntos[i].valor !== null && s.puntos[i].valor !== undefined);
  return html`<svg class="rp-linea" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`Línea: ${s.puntos.map((p) => `${p.etq} ${fmtV(p.valor, s)}`).join(', ')}`}>
    ${ticks.map((t) => html`<g key=${t}><line x1=${L} x2=${W - R} y1=${y(t)} y2=${y(t)} stroke="#e1e0d9" stroke-width="1" /><text x=${L - 8} y=${y(t) + 4} text-anchor="end" class="rp-ax">${t}</text></g>`)}
    ${s.meta && html`<line x1=${L} x2=${W - R} y1=${y(s.meta)} y2=${y(s.meta)} stroke="#4E5964" stroke-width="1.5" stroke-dasharray="5 4" /><text x=${W - R} y=${y(s.meta) - 6} text-anchor="end" class="rp-ax fuerte">Meta ${s.meta} %</text>`}
    ${tramos.map((t, k) => html`<polyline key=${k} points=${t.map((p) => p.join(',')).join(' ')} fill="none" stroke=${MARCA} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`)}
    ${s.puntos.map((p, i) => p.valor !== null && p.valor !== undefined && html`<circle key=${i} cx=${x(i)} cy=${y(p.valor)} r="4.5" fill=${MARCA} stroke="#fcfcfb" stroke-width="2"><title>${p.etq}: ${fmtV(p.valor, s)}</title></circle>`)}
    ${ultimo !== undefined && html`<text x=${x(ultimo)} y=${y(s.puntos[ultimo].valor) - 10} text-anchor="middle" class="rp-ax fuerte">${fmtV(s.puntos[ultimo].valor, s)}</text>`}
    ${s.puntos.map((p, i) => (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) && html`<text key=${'x' + i} x=${x(i)} y=${H - 8} text-anchor="middle" class="rp-ax">${p.etq}</text>`)}
  </svg>`;
}
function partesDona(s) {
  const pts = s.puntos.filter((p) => p.valor > 0);
  if (s.estados) return pts.map((p) => ({ ...p, color: TONO[p.tono] || OTROS }));
  const ord = [...pts].sort((a, b) => b.valor - a.valor);
  const top = ord.slice(0, CATEGORICOS.length).map((p, i) => ({ ...p, color: CATEGORICOS[i] }));
  const resto = ord.slice(CATEGORICOS.length).reduce((t, p) => t + p.valor, 0);
  return resto ? [...top, { etq: 'Otros', valor: resto, color: OTROS }] : top;
}
function Dona({ s }) {
  const partes = partesDona(s);
  const total = partes.reduce((t, p) => t + p.valor, 0);
  const R = 70, r = 46, C = 90;
  let a = -Math.PI / 2;
  const arco = (v) => {
    const ang = (v / total) * Math.PI * 2, gap = partes.length > 1 ? 0.025 : 0;
    const a0 = a + gap / 2, a1 = a + ang - gap / 2; a += ang;
    if (partes.length === 1) return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`;
    const p = (ang2, rad) => `${C + rad * Math.cos(ang2)} ${C + rad * Math.sin(ang2)}`;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p(a0, R)} A ${R} ${R} 0 ${grande} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${grande} 0 ${p(a0, r)} Z`;
  };
  return html`<div class="rp-dona"><svg viewBox="0 0 180 180" role="img" aria-label=${`Dona: ${partes.map((p) => `${p.etq} ${p.valor}`).join(', ')}`}>
      ${partes.map((p) => html`<path key=${p.etq} d=${arco(p.valor)} fill=${p.color}><title>${p.etq}: ${p.valor} (${Math.round((p.valor / total) * 100)} %)</title></path>`)}
      <text x="90" y="88" text-anchor="middle" class="rp-dona-t num">${total}</text><text x="90" y="106" text-anchor="middle" class="rp-ax">${s.unidad}</text></svg>
    <ul class="rp-leyenda">${partes.map((p) => html`<li key=${p.etq}><i style=${`background:${p.color}`}></i><span>${p.etq}</span><b class="num">${p.valor}</b><small class="num">${Math.round((p.valor / total) * 100)} %</small></li>`)}</ul></div>`;
}
function Tabla({ t, max }) {
  const filas = max ? t.filas.slice(0, max) : t.filas;
  return html`<div class="rp-tabla-m"><table class="rp-tabla"><thead><tr>${t.cols.map((c) => html`<th key=${c}>${c}</th>`)}</tr></thead>
    <tbody>${filas.map((f, i) => html`<tr key=${i} class=${t.negritas?.[i] ? 'fuerte' : ''}>${f.map((c, j) => html`<td key=${j} class=${typeof c === 'number' ? 'num' : ''}>${c === null || c === undefined || c === '' ? '—' : c}</td>`)}</tr>`)}</tbody></table>
    ${max && t.filas.length > max && html`<p class="rp-mas">y ${t.filas.length - max} más en el PDF y el Excel</p>`}</div>`;
}

// ---------- Presentación (pantalla completa, una diapositiva por bloque) ----------
function Presentacion({ r, calc, autor, cerrar }) {
  const visibles = r.bloques.filter((b) => !b.oculto);
  const total = visibles.length + 1;
  const [i, setI] = useState(0);
  const [escala, setEscala] = useState(() => Math.min(innerWidth / 1280, innerHeight / 720));
  const ref = useRef();
  useEffect(() => {
    const medir = () => setEscala(Math.min(innerWidth / 1280, innerHeight / 720));
    medir(); addEventListener('resize', medir);
    const tecla = (e) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(total - 1, x + 1)); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      if (e.key === 'Escape') cerrar();
    };
    addEventListener('keydown', tecla);
    ref.current?.requestFullscreen?.().catch(() => {});
    const salir = () => { if (!document.fullscreenElement) cerrar(); };
    document.addEventListener('fullscreenchange', salir);
    return () => { removeEventListener('resize', medir); removeEventListener('keydown', tecla); document.removeEventListener('fullscreenchange', salir); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, []);
  const b = visibles[i - 1];
  return html`<div class="rp-pres" ref=${ref} role="dialog" aria-modal="true" aria-label=${`Presentación: ${r.titulo}`}>
    <div class="rp-lienzo" style=${`transform:translate(-50%,-50%) scale(${escala})`}>
      ${i === 0 ? html`<${Portada} r=${r} autor=${autor} diapo />` : html`<section class="rp-diapo">
        <h2 class="rp-h2">${tituloBloque(b)}</h2>
        ${(b.texto ?? calc[b.id].resumen) && html`<p class="rp-texto">${b.texto ?? calc[b.id].resumen}</p>`}
        <div class="rp-diapo-v">${FUENTES[b.fuente]?.captura ? html`<${Tabla} t=${calc[b.id].tabla} max=${8} />` : graficaBloque(b) === 'tabla' || (!calc[b.id].serie && calc[b.id].tabla) ? html`<${Tabla} t=${calc[b.id].tabla || { cols: [], filas: [] }} max=${8} />` : html`<${Visual} tipo=${graficaBloque(b)} d=${calc[b.id]} />`}</div>
        <span class="rp-diapo-pie">Spark225 · ${nombreArea(r.area)} · ${textoPeriodo(r.periodo)}</span>
      </section>`}
    </div>
    <div class="rp-pres-ctrl">
      <button class="icon-btn" onClick=${() => setI(Math.max(0, i - 1))} disabled=${i === 0} aria-label="Anterior">${I('flecha')}</button>
      <span class="num">${i + 1} / ${total}</span>
      <button class="icon-btn" onClick=${() => setI(Math.min(total - 1, i + 1))} disabled=${i === total - 1} aria-label="Siguiente">${I('adelante')}</button>
      <button class="icon-btn" onClick=${cerrar} aria-label="Salir de la presentación">${I('x')}</button>
    </div>
  </div>`;
}

// ---------- Descargas ----------
const nombreArchivo = (r) => r.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'reporte-spark225';
function imprimir(r) {
  const antes = document.title;
  document.title = nombreArchivo(r);
  document.body.classList.add('imprimiendo-reporte');
  const fin = () => { document.title = antes; document.body.classList.remove('imprimiendo-reporte'); removeEventListener('afterprint', fin); };
  addEventListener('afterprint', fin);
  setTimeout(() => { print(); setTimeout(fin, 1000); }, 50);
}
const scripts = {};
function cargarScript(url) {
  if (!scripts[url]) scripts[url] = new Promise((ok, mal) => { const s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = () => { delete scripts[url]; mal(new Error('No se pudo cargar la librería')); }; document.head.appendChild(s); });
  return scripts[url];
}
const PPTX_URL = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const hx = (c) => c.replace('#', '').toUpperCase();
const plano = (v) => (v === null || v === undefined ? '' : String(v));

// «probar» devuelve el archivo en memoria (para revisar que se arma bien) en lugar de descargarlo.
export async function exportarPPT(r, calc, autor, probar) {
  await cargarScript(PPTX_URL);
  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 pulgadas
  pptx.title = r.titulo; pptx.company = 'Spark225'; pptx.author = autor?.nombre || 'Spark225';
  const tit = { fontFace: 'Sora', bold: true, color: '1E2329' }, cuerpo = { fontFace: 'Inter', color: '52514E' };
  const franja = (s) => { s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: 'F5C245' }, line: { color: 'F5C245' } }); s.addShape(pptx.ShapeType.rect, { x: 6.66, y: 0, w: 6.67, h: 0.12, fill: { color: 'E47739' }, line: { color: 'E47739' } }); };
  const pie = (s) => s.addText(`Spark225 · ${nombreArea(r.area)} · ${textoPeriodo(r.periodo)}`, { x: 0.6, y: 7.0, w: 12, h: 0.3, fontSize: 10, ...cuerpo, color: '898781' });
  // Portada
  const p = pptx.addSlide(); franja(p);
  try { p.addImage({ path: new URL('./icons/iso.png', location.href).href, x: 0.6, y: 0.7, w: 0.8, h: 0.8 }); } catch (_) { /* sin logo */ }
  p.addText('Spark225', { x: 1.55, y: 0.85, w: 4, h: 0.5, fontSize: 18, ...tit });
  p.addText(r.titulo, { x: 0.6, y: 2.4, w: 12, h: 1.6, fontSize: 36, ...tit, valign: 'top' });
  p.addText(`${nombreArea(r.area)} · ${textoPeriodo(r.periodo)}${autor ? ` · Preparado por ${autor.nombre || autor.corto}` : ''}`, { x: 0.6, y: 4.2, w: 12, h: 0.5, fontSize: 16, ...cuerpo });
  for (const b of r.bloques.filter((x) => !x.oculto)) {
    const d = calc[b.id], g = graficaBloque(b), texto = b.texto ?? d.resumen;
    const s = pptx.addSlide(); franja(s); pie(s);
    s.addText(tituloBloque(b), { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, ...tit });
    let y = 1.15;
    if (texto) { s.addText(texto, { x: 0.6, y, w: 12, h: b.fuente === 'texto' ? 5.4 : 0.9, fontSize: b.fuente === 'texto' ? 18 : 14, ...cuerpo, valign: 'top' }); y += 1.05; }
    if (b.fuente === 'texto') continue;
    const h = 6.8 - y;
    const pts = (d.serie?.puntos || []).filter((x) => x.valor !== null && x.valor !== undefined);
    if (g === 'kpis' && d.kpis) {
      const n = d.kpis.length, w = (12 - (n - 1) * 0.25) / n;
      d.kpis.forEach((k, i) => {
        const x = 0.6 + i * (w + 0.25);
        s.addShape(pptx.ShapeType.roundRect, { x, y: y + 0.2, w, h: 2.2, fill: { color: 'F4F2EE' }, line: { color: 'E1E0D9' }, rectRadius: 0.12 });
        s.addText(k.etq, { x: x + 0.2, y: y + 0.35, w: w - 0.4, h: 0.4, fontSize: 13, ...cuerpo });
        s.addText(String(k.valor), { x: x + 0.2, y: y + 0.8, w: w - 0.4, h: 0.8, fontSize: 34, ...tit });
        s.addText((k.tono && k.tono !== 'neutro' ? TONO_TXT[k.tono] + ' · ' : '') + k.sub, { x: x + 0.2, y: y + 1.6, w: w - 0.4, h: 0.6, fontSize: 11, ...cuerpo, color: '898781', valign: 'top' });
      });
    } else if ((g === 'barras' || g === 'linea') && pts.length) {
      const datos = [{ name: tituloBloque(b), labels: pts.map((x) => x.etq), values: pts.map((x) => x.valor) }];
      const comun = { x: 0.6, y, w: 12, h, chartColors: [hx(MARCA)], catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelFontFace: 'Inter', valAxisLabelFontFace: 'Inter', valGridLine: { color: 'E1E0D9', size: 0.5 }, showLegend: false, ...(d.serie.max ? { valAxisMaxVal: d.serie.max, valAxisMinVal: 0 } : {}) };
      if (g === 'barras') s.addChart(pptx.ChartType.bar, datos, { ...comun, barDir: 'bar', catAxisOrientation: 'maxMin', showValue: true, dataLabelColor: '52514E', dataLabelFontSize: 10, barGapWidthPct: 60 });
      else s.addChart(pptx.ChartType.line, datos, { ...comun, lineSize: 2, lineDataSymbol: 'circle', lineDataSymbolSize: 7, showValue: true, dataLabelPosition: 't', dataLabelFontSize: 10, dataLabelColor: '52514E' });
    } else if (g === 'dona' && pts.some((x) => x.valor)) {
      const partes = partesDona(d.serie);
      s.addChart(pptx.ChartType.doughnut, [{ name: tituloBloque(b), labels: partes.map((x) => x.etq), values: partes.map((x) => x.valor) }],
        { x: 0.6, y, w: 12, h, chartColors: partes.map((x) => hx(x.color)), holeSize: 58, showPercent: true, showLegend: true, legendPos: 'r', legendFontSize: 12, legendFontFace: 'Inter', dataLabelColor: 'FFFFFF', dataLabelFontSize: 11 });
    } else if (d.tabla?.filas?.length) {
      const porHoja = 11;
      for (let k = 0; k < d.tabla.filas.length; k += porHoja) {
        const hoja = k === 0 ? s : (() => { const n = pptx.addSlide(); franja(n); pie(n); n.addText(`${tituloBloque(b)} (continuación)`, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, ...tit }); return n; })();
        const filas = [d.tabla.cols.map((c) => ({ text: c, options: { bold: true, color: 'FFFFFF', fill: { color: '4E5964' } } })),
          ...d.tabla.filas.slice(k, k + porHoja).map((f, i) => f.map((c) => ({ text: plano(c), options: { bold: !!d.tabla.negritas?.[k + i] } })))];
        hoja.addTable(filas, { x: 0.6, y: k === 0 ? y : 1.2, w: 12, fontFace: 'Inter', fontSize: 11, color: '1E2329', border: { type: 'solid', color: 'E1E0D9', pt: 0.75 }, rowH: 0.38, autoPage: false });
      }
    } else {
      s.addText('Sin datos para mostrar en este periodo.', { x: 0.6, y, w: 12, h: 0.6, fontSize: 14, ...cuerpo });
    }
  }
  if (probar) return pptx.write({ outputType: 'blob' });
  await pptx.writeFile({ fileName: nombreArchivo(r) + '.pptx' });
}

export async function exportarExcel(r, calc, autor, probar) {
  await cargarScript(XLSX_URL);
  const X = window.XLSX;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[r.titulo], ['Área', nombreArea(r.area)], ['Periodo', textoPeriodo(r.periodo)], ['Del', r.periodo.desde], ['Al', r.periodo.hasta], ['Preparado por', autor?.nombre || autor?.corto || ''], ['Generado', hoyISO()], [], ['Datos del Portal de colaboradores de Spark225. Sin precios ni datos de pacientes.']]), 'Resumen');
  const usados = new Set(['Resumen']);
  for (const b of r.bloques.filter((x) => !x.oculto && x.fuente !== 'texto')) {
    const d = calc[b.id];
    const aoa = [[tituloBloque(b)], [b.texto ?? d.resumen ?? ''], []];
    if (d.kpis) { aoa.push(['Indicador', 'Valor', 'Detalle']); d.kpis.forEach((k) => aoa.push([k.etq, k.valor, k.sub])); aoa.push([]); }
    if (d.tabla?.filas?.length) { aoa.push(d.tabla.cols); d.tabla.filas.forEach((f) => aoa.push(f.map((c) => (typeof c === 'number' ? c : plano(c).trim())))); aoa.push([]); }
    if (d.serie?.puntos?.length && !d.tabla?.filas?.length) { aoa.push(['', d.serie.unidad]); d.serie.puntos.forEach((p) => aoa.push([p.etq, p.valor])); }
    let nombre = tituloBloque(b).replace(/[\[\]:*?/\\]/g, '').slice(0, 28) || 'Bloque', k = 2;
    while (usados.has(nombre)) nombre = `${nombre.slice(0, 26)} ${k++}`;
    usados.add(nombre);
    const hoja = X.utils.aoa_to_sheet(aoa);
    hoja['!cols'] = [{ wch: 48 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    X.utils.book_append_sheet(wb, hoja, nombre);
  }
  if (probar) return X.write(wb, { type: 'array', bookType: 'xlsx' });
  X.writeFile(wb, nombreArchivo(r) + '.xlsx');
}
