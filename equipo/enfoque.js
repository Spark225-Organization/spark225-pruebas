// Mapa de enfoque: prioridades del trimestre y sus KPI, con captura semanal (cierra el lunes 9:00).
// Mapa (cómo va cada prioridad) · Captura de la semana · Semana a semana · Estructura (solo Dirección).
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { datosEnfoque, guardarEnfoque, borrarEnfoque, esAdmin, nube } from './store.js?v=202611270230';
import { COLOR, TIPOS, colorKPI, colorPrioridad, validarCriterio, leerValor, cierreSemana, inicioSemana, semanaDeCarga } from './enfoque-datos.js?v=202611270230';
import { I, Avatar, Info, IconoKPI } from './ui.js?v=202611270230';

const fmtCorta = (d) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
const fmtCierre = (d) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d).replace(/\./g, '');
const uid = (p) => p + Math.random().toString(36).slice(2, 8);

// *negritas* y _cursivas_ como en el original, sin HTML.
export function Texto({ t }) {
  return (t || '').split(/(\*[^*]+\*|_[^_]+_)/g).filter(Boolean).map((x, i) =>
    x.startsWith('*') && x.endsWith('*') ? html`<b key=${i}>${x.slice(1, -1)}</b>` : x.startsWith('_') && x.endsWith('_') ? html`<i key=${i}>${x.slice(1, -1)}</i>` : x);
}
function Ficha({ c, chico }) {
  return html`<span class=${'fmx-chip c-' + c + (chico ? ' sm' : '')} title=${`${COLOR[c].nombre}: ${COLOR[c].ayuda}`}>${COLOR[c].letra}</span>`;
}
function mostrarValor(criterio, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (criterio.tipo === 'si_no') return v ? 'Sí' : 'No';
  if (criterio.tipo === 'fecha') return fmtCorta(new Date(v + 'T12:00:00'));
  return Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + (criterio.tipo.startsWith('pct') ? ' %' : '');
}
function reglaTexto(c) {
  if (c.tipo === 'si_no') return 'Sí = verde · No = rojo';
  const f = (x) => (c.tipo === 'fecha' ? fmtCorta(new Date(x + 'T12:00:00')) : x + (c.tipo.startsWith('pct') ? ' %' : ''));
  if (c.tipo === 'fecha') return `Súper verde antes del ${f(c.sv)} · verde hasta ${f(c.v)} · rojo desde ${f(c.r)}`;
  return c.tipo === 'menos' || c.tipo === 'pct_menos'
    ? `Súper verde ≤ ${f(c.sv)} · verde ≤ ${f(c.v)} · rojo ≥ ${f(c.r)}`
    : `Súper verde ≥ ${f(c.sv)} · verde ≥ ${f(c.v)} · rojo ≤ ${f(c.r)}`;
}

export function MapaEnfoque({ ctx }) {
  const { db, yo, toast } = ctx;
  const [tid, setTid] = useState(null);
  const fm = datosEnfoque();
  const admin = esAdmin(yo);
  const trim = fm.trimestres.find((t) => t.id === tid) || fm.trimestres.find((t) => t.activo) || fm.trimestres[fm.trimestres.length - 1];
  const aj = fm.ajustes;
  if (!trim) return html`<${SinMapa} admin=${admin} yo=${yo} aj=${aj} toast=${toast} />`;
  return html`<${Mapa_} key=${trim.id} ctx=${ctx} fm=${fm} trim=${trim} aj=${aj} admin=${admin} trimestres=${fm.trimestres} setTid=${setTid} />`;
}

// Sin trimestre cargado: Dirección crea uno; los demás ven un aviso.
function SinMapa({ admin, yo, aj, toast }) {
  const [t, setT] = useState({ nombre: '', inicio: '', fin: '', tema: '' });
  const crear = () => {
    if (!t.nombre.trim() || !t.inicio || !t.fin) return toast('Faltan nombre, inicio y fin');
    if (new Date(t.inicio + 'T12:00:00').getDay() !== 1) return toast('El trimestre empieza en lunes');
    guardarEnfoque('fm_ajustes', aj, yo);
    guardarEnfoque('fm_trimestres', { id: uid('q'), nombre: t.nombre.trim(), tema: t.tema.trim(), exito: '', inicio: t.inicio, fin: t.fin, activo: true }, yo, `creó el trimestre ${t.nombre.trim()} del mapa de enfoque`);
  };
  return html`<section class="tb-panel fm-vacio">
    <h2>${I('foco')}El mapa de enfoque todavía no está cargado</h2>
    <p class="tb-sub">${admin ? 'Carga el trimestre actual desde la base (lo prepara Adán) o crea uno nuevo aquí.' : 'Dirección lo va a cargar. En cuanto esté, aquí capturas tus KPI cada lunes.'}</p>
    ${admin && html`<div class="fm-edit">
      <label class="campo"><span>Nombre</span><input class="control" placeholder="Ej. 1Q 2027" value=${t.nombre} onInput=${(e) => setT({ ...t, nombre: e.target.value })} /></label>
      <label class="campo"><span>Empieza (lunes)</span><input class="control" type="date" value=${t.inicio} onInput=${(e) => setT({ ...t, inicio: e.target.value })} /></label>
      <label class="campo"><span>Termina</span><input class="control" type="date" value=${t.fin} onInput=${(e) => setT({ ...t, fin: e.target.value })} /></label>
      <label class="campo ancho"><span>Tema</span><input class="control" value=${t.tema} onInput=${(e) => setT({ ...t, tema: e.target.value })} /></label>
    </div>
    <div class="bienv-acc"><button class="btn prim" onClick=${crear}>Crear trimestre</button></div>`}
  </section>`;
}

// Semana ISO del año (como el encabezado del original).
const semanaISO = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia); const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - ini) / 864e5 + 1) / 7); };
// Valor corto para las celdas: 16.9k, 27%, Sí, 1/12.
const compacto = (c, v) => {
  if (v === null || v === undefined || v === '') return '';
  if (c.tipo === 'si_no') return v ? 'Sí' : 'No';
  if (c.tipo === 'fecha') { const d = new Date(v + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; }
  const n = Number(v);
  return (Math.abs(n) >= 1000 ? (n / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + 'k' : n.toLocaleString('es-MX', { maximumFractionDigits: 1 })) + (c.tipo.startsWith('pct') ? '%' : '');
};
// Umbrales en una línea, como el original: «S ≥ 12 · V ≥ 10 · R ≤ 4».
const umbrales = (c) => {
  if (c.tipo === 'si_no') return 'Sí = V · No = R';
  const f = (x) => (c.tipo === 'fecha' ? compacto(c, x) : x + (c.tipo.startsWith('pct') ? '%' : ''));
  const menos = c.tipo === 'menos' || c.tipo === 'pct_menos' || c.tipo === 'fecha';
  return menos ? `S ≤ ${f(c.sv)} · V ≤ ${f(c.v)} · R ≥ ${f(c.r)}` : `S ≥ ${f(c.sv)} · V ≥ ${f(c.v)} · R ≤ ${f(c.r)}`;
};
const sinMarcas = (t) => (t || '').replace(/[*_]/g, '');
function Dueno({ p }) {
  if (!p) return null;
  return html`<span class="fmx-own"><i>${p.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</i>${p.corto}</span>`;
}

function Mapa_({ ctx, fm, trim, aj, admin, trimestres, setTid }) {
  const { db, yo, toast } = ctx;
  const [pest, setPest] = useState('mapa');
  const [ficha, setFicha] = useState(null); // id del KPI abierto
  const [reporte, setReporte] = useState(false);
  const empresas = fm.prioridades.filter((p) => p.clase === 'empresa' && p.trimestre === trim.id).sort((a, b) => a.orden - b.orden);
  const kpisDe = (pid) => fm.prioridades.filter((p) => p.clase === 'kpi' && p.padre === pid).sort((a, b) => a.orden - b.orden);
  const todosKpi = empresas.flatMap((e) => kpisDe(e.id));
  const rep = (pid, w) => fm.reportes.find((r) => r.id === `${pid}_w${w}`);
  const wCarga = semanaDeCarga(trim, aj);
  const conReporte = [...new Set(fm.reportes.filter((r) => r.trimestre === trim.id).map((r) => r.semana))].filter((w) => w <= wCarga);
  // El Mapa pinta la semana más reciente que tenga algún reporte (como el original).
  const [wVer, setWVer] = useState(() => (conReporte.length ? Math.max(...conReporte) : wCarga));
  const per = (id) => db.personas.find((p) => p.id === id);
  const capturar = (k, w, valor, nota) => {
    const id = `${k.id}_w${w}`, antes = rep(k.id, w);
    if (valor === '' || valor === null) { if (antes) borrarEnfoque('fm_reportes', id, yo); return; }
    if (antes && antes.valor === valor && JSON.stringify(antes.nota || null) === JSON.stringify(nota || null)) return;
    const ahora = new Date().toISOString();
    guardarEnfoque('fm_reportes', { id, prioridad: k.id, trimestre: trim.id, semana: w, valor, capturado: ahora, primero: antes?.primero || ahora, quien: yo, nota: nota || antes?.nota || null },
      yo, antes ? null : `capturó la semana ${w} del mapa de enfoque`);
  };
  const c = { fm, trim, aj, admin, yo, db, toast, empresas, kpisDe, todosKpi, rep, capturar, per, wCarga, wVer, setWVer, abrirFicha: setFicha, abrirReporte: () => setReporte(true) };

  return html`<div class="fmx">
    <header class="fmx-band">
      <div class="fmx-marca"><span class="fmx-eyebrow">Spark225 · Prioridades del trimestre</span><b>Mapa de enfoque</b></div>
      <label class="fmx-trimsel"><span class="fmx-eyebrow">Trimestre</span>
        <select value=${trim.id} onChange=${(e) => setTid(e.target.value)}>${trimestres.map((t) => html`<option key=${t.id} value=${t.id}>${t.nombre}${t.activo ? ' (activo)' : ''}</option>`)}</select></label>
    </header>
    ${nube.sinRH && html`<p class="fmx-aviso">${I('alerta')}Las capturas se guardan solo en este navegador hasta activar su espacio en la base.</p>`}
    <nav class="fmx-tabs" role="tablist">
      ${[['mapa', 'Mapa'], ['semanas', 'Semana a semana'], ...(admin ? [['estructura', 'Estructura']] : [])].map(([k, t]) => html`<button key=${k} class="fmx-tab" role="tab" aria-selected=${pest === k} onClick=${() => setPest(k)}>${t}</button>`)}
    </nav>
    ${pest === 'mapa' && html`<${Mapa} c=${c} />`}
    ${pest === 'semanas' && html`<${Semanas} c=${c} />`}
    ${pest === 'estructura' && admin && html`<${Estructura} c=${c} />`}
    ${reporte && html`<${ReporteSemanal} c=${c} cerrar=${() => setReporte(false)} />`}
    ${ficha && fm.prioridades.some((p) => p.id === ficha) && html`<${FichaKPI} c=${c} k=${fm.prioridades.find((p) => p.id === ficha)} w=${wVer} cerrar=${() => setFicha(null)} />`}
  </div>`;
}

// ---------- Mapa ----------
function Mapa({ c }) {
  const { empresas, kpisDe, todosKpi, rep, wCarga, wVer: w, setWVer, trim, aj, admin } = c;
  const cierre = cierreSemana(trim, aj, wCarga);
  const vencido = cierre < new Date();
  const reportadas = todosKpi.filter((k) => rep(k.id, wCarga)).length;
  const faltan = todosKpi.length - reportadas;
  const mezcla = { S: 0, V: 0, A: 0, R: 0, N: 0 };
  todosKpi.forEach((k) => { mezcla[colorKPI(k.criterio, rep(k.id, w)?.valor)]++; });
  const exportar = () => {
    const ws = Array.from({ length: 13 }, (_, i) => i + 1);
    const filas = [['Prioridad', 'KPI', 'Captura', 'Criterio', ...ws.map((x) => `Semana ${x}`)]];
    empresas.forEach((e) => kpisDe(e.id).forEach((k) => filas.push([sinMarcas(e.nombre), sinMarcas(k.nombre), c.per(k.dueno)?.corto || '', umbrales(k.criterio), ...ws.map((x) => compacto(k.criterio, rep(k.id, x)?.valor))])));
    const csv = '﻿' + filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `mapa-de-enfoque-${trim.nombre.replace(/\s+/g, '-')}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return html`
    <section class="fmx-panel fmx-reportbar">
      <div class="fmx-rb-txt">
        <p><b>Carga de la semana ${wCarga}</b> · ${reportadas} de ${todosKpi.length} reportadas · ${faltan ? `faltan ${faltan}` : 'completa'} · cierre: ${fmtCierre(cierre)}${vencido ? html`<span class="fmx-venc"> · vencido</span>` : ''}
          <${Info} t="Cada semana se captura el valor real de cada KPI. La captura cierra el lunes siguiente a las 9:00; lo que entra después queda marcado como tarde." /></p>
        <div class="fmx-track"><i style=${`width:${todosKpi.length ? (reportadas / todosKpi.length) * 100 : 0}%`}></i></div>
      </div>
      <div class="fmx-mezcla" aria-label=${`Colores de la semana ${w}`}>${['S', 'V', 'A', 'R', 'N'].map((k) => html`<span key=${k} class="fmx-pill muted"><${Ficha} c=${k} chico />${mezcla[k]}</span>`)}</div>
      <button class="fmx-btn prim" onClick=${c.abrirReporte}>Cargar semana ${wCarga}</button>
    </section>

    <section class="fmx-panel fmx-qhead">
      <div class="fmx-q-izq">
        <h2>${trim.tema || trim.nombre}</h2>
        ${trim.exito && html`<p><b>Éxito:</b> ${trim.exito.split('\n').map((l) => l.trim()).filter(Boolean).join(' · ')}</p>`}
      </div>
      <div class="fmx-q-der"><span class="fmx-qlabel">${trim.nombre}</span><span class="fmx-pill muted">Semana ${semanaISO(new Date())} del año · ${wCarga} de 13</span></div>
      ${aj.metas?.length > 0 && html`<div class="fmx-metas"><span class="fmx-eyebrow">Metas del año</span>${aj.metas.map((m) => html`<span key=${m.id} class="fmx-pill">${m.nombre}</span>`)}</div>`}
    </section>

    <section class="fmx-panel">
      <div class="fmx-ph">
        <h3>Prioridades de empresa</h3>
        <span class=${'fmx-pill ' + (empresas.length > (aj.maxEmpresa || 5) ? 'warn' : 'muted')}>${empresas.length} / ${aj.maxEmpresa || 5}</span>
        <span class="fmx-semsel">color de la semana
          <button aria-label="Semana anterior" disabled=${w <= 1} onClick=${() => setWVer(w - 1)}>${I('flecha')}</button><b>${w}</b>
          <button aria-label="Semana siguiente" disabled=${w >= wCarga} onClick=${() => setWVer(w + 1)}>${I('flecha', 'rot-180')}</button></span>
        <${Info} t="El color de cada prioridad es el promedio de sus KPI (súper verde 4, verde 3, amarillo 2, rojo 1). Si algún KPI está en rojo, la prioridad queda como máximo en amarillo." />
        <button class="fmx-btn fmx-der" onClick=${exportar}>${I('archivar')}Descargar para Excel</button>
      </div>
      <div class="fmx-plist">${empresas.map((e, i) => html`<${FilaPrioridad} key=${e.id} e=${e} i=${i} c=${c} w=${w} />`)}</div>
    </section>

    <section class="fmx-legend">
      <p><b>Leyenda</b>${['S', 'V', 'A', 'R', 'N'].map((k) => html`<span key=${k}><${Ficha} c=${k} chico />${COLOR[k].nombre} <em>(${COLOR[k].ayuda.toLowerCase()})</em></span>`)}</p>
      <p class="fmx-faint">Tu acceso: ${admin ? 'Dirección: editas la estructura y capturas.' : 'Capturas los KPI de la semana.'} · Trimestre del ${fmtCorta(new Date(trim.inicio + 'T12:00:00'))} al ${fmtCorta(new Date(trim.fin + 'T12:00:00'))}.</p>
    </section>`;
}

function FilaPrioridad({ e, i, c, w }) {
  const [abierta, setAbierta] = useState(false);
  const kpis = c.kpisDe(e.id);
  const colores = kpis.map((k) => colorKPI(k.criterio, c.rep(k.id, w)?.valor));
  const ce = colorPrioridad(colores);
  return html`<div class="fmx-prow">
    <div class="fmx-prow-main">
      <span class=${'fmx-stripe c-' + ce}><span>Prioridad</span></span>
      <span class="fmx-num">${i + 1}</span>
      <div class="fmx-pcuerpo">
        <div class="fmx-pnombre"><${Texto} t=${e.nombre} /> <${Dueno} p=${c.per(e.dueno)} /></div>
        <div class="fmx-pmeta">${c.trim.nombre} · ${kpis.length} ${kpis.length === 1 ? 'prioridad individual' : 'prioridades individuales'} · ${COLOR[ce].nombre}</div>
        <button class="fmx-ver" onClick=${() => setAbierta(!abierta)} aria-expanded=${abierta}>${I('flecha', abierta ? 'rot-abajo' : 'rot-180')}${abierta ? 'Ocultar individuales' : 'Ver individuales'}</button>
      </div>
      <div class="fmx-kchips">${kpis.map((k, j) => {
        const r = c.rep(k.id, w);
        const tip = `${sinMarcas(k.nombre)}\n${COLOR[colores[j]].nombre} · ${c.per(k.dueno)?.corto || ''}\nValor: ${r ? mostrarValor(k.criterio, r.valor) : 'sin reporte'}\nSemana ${w} · clic para ver la ficha`;
        return html`<button key=${k.id} class=${'fmx-chip c-' + colores[j]} data-tip=${tip} aria-label=${tip.replace(/\n/g, '. ')} onClick=${() => c.abrirFicha(k.id)}>${COLOR[colores[j]].letra}</button>`;
      })}</div>
    </div>
    ${abierta && html`<div class="fmx-kids">${kpis.map((k, j) => {
      const r = c.rep(k.id, w);
      return html`<div key=${k.id} class="fmx-kid">
        <${IconoKPI} tipo=${k.criterio.tipo} />
        <div class="fmx-kid-t">
          <div><button class="enlace-texto" onClick=${() => c.abrirFicha(k.id)}><${Texto} t=${k.nombre} /></button> <${Dueno} p=${c.per(k.dueno)} /></div>
          <small class="fmx-mono">${umbrales(k.criterio)} · reportado: ${r ? `${compacto(k.criterio, r.valor)} (${c.per(r.quien)?.corto || r.quien})` : '—'}</small>
          ${r?.nota && (r.nota.causa || r.nota.accion) && html`<p class=${'fmx-nota c-' + colores[j]}>${r.nota.causa && html`<b>Causa:</b> ${r.nota.causa} `}${r.nota.accion && html`<b>Acción:</b> ${r.nota.accion}`}${r.nota.fecha ? ` · ${compacto({ tipo: 'fecha' }, r.nota.fecha)}` : ''}</p>`}
        </div>
        <${Ficha} c=${colores[j]} chico />
      </div>`;
    })}</div>`}
  </div>`;
}

// ---------- Reporte semanal (como el original: todo en una ventana y «Guardar reporte») ----------
function ReporteSemanal({ c, cerrar }) {
  const { empresas, kpisDe, rep, capturar, wCarga, trim, aj, yo, per, fm, toast } = c;
  const [w, setW] = useState(wCarga);
  const [solo, setSolo] = useState(() => kpisDe && empresas.flatMap((e) => kpisDe(e.id)).some((k) => k.dueno === yo));
  const inicial = (sem) => Object.fromEntries(empresas.flatMap((e) => kpisDe(e.id)).map((k) => { const r = rep(k.id, sem); return [k.id, { v: r ? String(r.valor) : '', nota: r?.nota || {} }]; }));
  const [vals, setVals] = useState(() => inicial(wCarga));
  useEffect(() => setVals(inicial(w)), [w]);
  useEffect(() => { const h = (ev) => ev.key === 'Escape' && cerrar(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, []);
  const cierre = cierreSemana(trim, aj, w);
  const valorDe = (k) => { const t = vals[k.id]?.v ?? ''; if (k.criterio.tipo === 'si_no') return t === '' ? '' : t === 'true'; return leerValor(k.criterio.tipo, t); };
  const set = (k, campo, v) => setVals((x) => ({ ...x, [k.id]: campo === 'v' ? { ...x[k.id], v } : { ...x[k.id], nota: { ...x[k.id].nota, [campo]: v } } }));
  const guardar = () => {
    let n = 0;
    for (const k of empresas.flatMap((e) => kpisDe(e.id))) {
      const v = valorDe(k);
      if (v === undefined) return toast(`«${sinMarcas(k.nombre)}» necesita un número.`);
      const antes = rep(k.id, w);
      const nota = vals[k.id]?.nota && Object.values(vals[k.id].nota).some(Boolean) ? vals[k.id].nota : null;
      if ((antes ? antes.valor : '') === v && JSON.stringify(antes?.nota || null) === JSON.stringify(nota)) continue;
      capturar(k, w, v, nota); n++;
    }
    toast(n ? `Reporte guardado: ${n} ${n === 1 ? 'valor' : 'valores'}` : 'Sin cambios'); cerrar();
  };
  return html`<div class="velo alto" onClick=${cerrar}></div>
    <div class="fmx fmx-modal" role="dialog" aria-modal="true" aria-label="Reporte semanal">
      <header class="fmx-modal-cab">
        <span class="fmx-eyebrow">${trim.nombre} · semana ${semanaISO(inicioSemana(trim, w))} del año · cierre ${fmtCierre(cierre)}</span>
        <h2>Reporte semanal</h2>
        <button class="fmx-x" aria-label="Cerrar" onClick=${cerrar}>${I('x')}</button>
        <div class="fmx-modal-sem">
          <button disabled=${w <= 1} onClick=${() => setW(w - 1)} aria-label="Semana anterior">${I('flecha')}</button><b>Semana ${w} de 13</b>
          <button disabled=${w >= wCarga} onClick=${() => setW(w + 1)} aria-label="Semana siguiente">${I('flecha', 'rot-180')}</button>
          <label class="fmx-solo"><input type="checkbox" checked=${solo} onChange=${() => setSolo(!solo)} />Solo los míos</label>
        </div>
      </header>
      <div class="fmx-modal-cuerpo">
        ${empresas.map((e) => {
          const kpis = kpisDe(e.id).filter((k) => !solo || k.dueno === yo);
          if (!kpis.length) return null;
          return html`<div key=${e.id} class="fmx-rep-grupo"><span class="fmx-eyebrow">${sinMarcas(e.nombre)}</span>
            ${kpis.map((k) => {
              const v = valorDe(k);
              const col = v === undefined ? 'N' : colorKPI(k.criterio, v);
              const ult = w > 1 ? rep(k.id, w - 1) : null;
              const ficha = fm.fichas.find((f) => f.id === k.id);
              const t = k.criterio.tipo;
              return html`<div key=${k.id} class="fmx-rep">
                <div class="fmx-rep-t"><b><${IconoKPI} tipo=${t} /><${Texto} t=${k.nombre} /></b>
                  <small class="fmx-mono">${per(k.dueno)?.corto || ''} · ${umbrales(k.criterio)} · último: ${ult ? compacto(k.criterio, ult.valor) : '—'}</small>
                  ${ficha?.fuente ? html`<small class="fmx-fuente">Fuente: ${ficha.fuente}</small>` : html`<small class="fmx-fuente warn">Sin fuente: captúrala al abrir el KPI.</small>`}</div>
                ${t === 'si_no' ? html`<select class="fmx-in" value=${vals[k.id]?.v ?? ''} onChange=${(ev) => set(k, 'v', ev.target.value)} aria-label="Valor"><option value="">—</option><option value="true">Sí</option><option value="false">No</option></select>`
                  : html`<input class="fmx-in" type=${t === 'fecha' ? 'date' : 'text'} inputmode=${t === 'fecha' ? null : 'decimal'} placeholder=${t.startsWith('pct') ? '%' : 'Valor'} value=${vals[k.id]?.v ?? ''} aria-label="Valor" onInput=${(ev) => set(k, 'v', ev.target.value)} />`}
                <${Ficha} c=${col} chico />
                ${(col === 'A' || col === 'R') && html`<div class="fmx-notebox">
                  <input class="fmx-in" placeholder="Causa" value=${vals[k.id]?.nota?.causa || ''} onInput=${(ev) => set(k, 'causa', ev.target.value)} />
                  <input class="fmx-in" placeholder="Acción" value=${vals[k.id]?.nota?.accion || ''} onInput=${(ev) => set(k, 'accion', ev.target.value)} />
                  <input class="fmx-in" type="date" value=${vals[k.id]?.nota?.fecha || ''} aria-label="Fecha compromiso" onInput=${(ev) => set(k, 'fecha', ev.target.value)} />
                </div>`}
              </div>`;
            })}</div>`;
        })}
      </div>
      <footer class="fmx-modal-pie"><button class="fmx-btn" onClick=${cerrar}>Cancelar</button><button class="fmx-btn prim" onClick=${guardar}>Guardar reporte</button></footer>
    </div>`;
}

function CampoValor({ k, valor, guardar }) {
  const t = k.criterio.tipo;
  const [txt, setTxt] = useState(valor === undefined || valor === null ? '' : String(valor));
  const [err, setErr] = useState('');
  const vivo = t === 'si_no' ? colorKPI(k.criterio, valor) : colorKPI(k.criterio, leerValor(t, txt) === undefined ? null : leerValor(t, txt));
  const confirmar = () => {
    const v = leerValor(t, txt);
    if (v === undefined) return setErr('Escribe un número.');
    setErr(''); guardar(v);
  };
  if (t === 'si_no') return html`<div class="fm-campo"><${Ficha} c=${vivo} />
    <div class="segmentado chico">${[[true, 'Sí'], [false, 'No']].map(([b, n]) => html`<button key=${n} aria-pressed=${valor === b} onClick=${() => guardar(valor === b ? '' : b)}>${n}</button>`)}</div></div>`;
  return html`<div class="fm-campo"><${Ficha} c=${vivo} />
    <input class=${'fmx-in' + (err ? ' error' : '')} type=${t === 'fecha' ? 'date' : 'text'} inputmode=${t === 'fecha' ? null : 'decimal'} value=${txt}
      placeholder=${t.startsWith('pct') ? '%' : 'Valor'} aria-label=${`Valor de ${k.nombre}`}
      onInput=${(e) => setTxt(e.target.value)} onBlur=${confirmar} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />
    ${err && html`<small class="rojo">${err}</small>`}</div>`;
}

// ---------- Semana a semana (prioridad en banda oscura, celdas que se llenan con el valor) ----------
function Semanas({ c }) {
  const { empresas, kpisDe, rep, trim, wCarga, capturar, per } = c;
  const [celda, setCelda] = useState(null);
  const ws = Array.from({ length: 13 }, (_, i) => i + 1);
  return html`
    <div class="fmx-panel fmx-grid-marco"><table class="fmx-grid">
      <thead><tr><th class="fmx-namecol"><span class="fmx-faint">semana del año</span></th>${ws.map((w) => html`<th key=${w} class=${w === wCarga ? 'cur' : ''} title=${`Semana ${w} del trimestre · del ${fmtCorta(inicioSemana(trim, w))}`}>${semanaISO(inicioSemana(trim, w))}</th>`)}</tr></thead>
      <tbody>${empresas.map((e, i) => {
        const kpis = kpisDe(e.id);
        return html`
          <tr key=${e.id} class="fmx-co"><th class="fmx-namecol"><div class="fmx-nc"><span class="fmx-num osc">${i + 1}</span><span class="fmx-co-n"><${Texto} t=${e.nombre} /></span> <${Dueno} p=${per(e.dueno)} /></div></th>${ws.map((w) => {
            const ce = colorPrioridad(kpis.map((k) => colorKPI(k.criterio, rep(k.id, w)?.valor)));
            return html`<td key=${w}><span class=${'fmx-roll c-' + (w <= wCarga ? ce : 'N')}>${w <= wCarga && ce !== 'N' ? COLOR[ce].letra : ''}</span></td>`;
          })}</tr>
          ${kpis.map((k) => html`<tr key=${k.id} class="fmx-kidrow"><th class="fmx-namecol"><div class="fmx-nc"><${IconoKPI} tipo=${k.criterio.tipo} /><span><${Texto} t=${k.nombre} /> <small class="fmx-faint">${per(k.dueno)?.corto || ''}</small></span></div></th>${ws.map((w) => {
            const r = rep(k.id, w), col = colorKPI(k.criterio, r?.valor);
            return html`<td key=${w}><button class=${'fmx-cell' + (r ? ' filled c-' + col : '') + (w === wCarga ? ' cur' : '') + (w > wCarga ? ' future' : '') + (r?.nota ? ' has-note' : '')} disabled=${w > wCarga}
              onClick=${() => setCelda({ k, w })} aria-label=${`Semana ${w}: ${r ? mostrarValor(k.criterio, r.valor) : 'sin reporte'}`}>${r ? compacto(k.criterio, r.valor) : '+'}</button></td>`;
          })}</tr>`)}
          <tr class="fmx-esp"><td colspan="14"></td></tr>`;
      })}</tbody>
    </table></div>
    ${celda && html`<div class="velo alto" onClick=${() => setCelda(null)}></div>
      <div class="fmx fmx-modal chico" role="dialog" aria-modal="true" aria-label="Capturar valor">
        <header class="fmx-modal-cab"><span class="fmx-eyebrow">Semana ${celda.w} · ${umbrales(celda.k.criterio)}</span><h2><${Texto} t=${celda.k.nombre} /></h2>
          <button class="fmx-x" aria-label="Cerrar" onClick=${() => setCelda(null)}>${I('x')}</button></header>
        <div class="fmx-modal-cuerpo"><${CampoValor} k=${celda.k} valor=${rep(celda.k.id, celda.w)?.valor} guardar=${(v) => capturar(celda.k, celda.w, v)} /></div>
        <footer class="fmx-modal-pie"><button class="fmx-btn prim" onClick=${() => setCelda(null)}>Listo</button></footer>
      </div>`}`;
}

// ---------- Ficha del KPI (fuente, fórmula, ligas; Dirección edita la estructura) ----------
function FichaKPI({ c, k, w, cerrar }) {
  const { fm, admin, yo, rep, per, toast, db } = c;
  const meta = fm.fichas.find((f) => f.id === k.id) || { id: k.id, fuente: '', formula: '', ligas: [] };
  const [f, setF] = useState(meta);
  const [e, setE] = useState({ nombre: k.nombre, dueno: k.dueno, criterio: { ...k.criterio } });
  const [nuevaLiga, setNuevaLiga] = useState('');
  useEffect(() => { const h = (ev) => ev.key === 'Escape' && cerrar(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, []);
  const r = rep(k.id, w);
  const col = colorKPI(k.criterio, r?.valor);
  const guardarFicha = () => guardarEnfoque('fm_fichas', { ...f, actualizado: new Date().toISOString(), quien: yo }, yo);
  const guardarEstructura = () => {
    const error = validarCriterio(e.criterio);
    if (error) return toast(error);
    if (!e.nombre.trim()) return toast('Ponle nombre al KPI');
    const crit = e.criterio.tipo === 'si_no' ? { tipo: 'si_no' } : e.criterio.tipo === 'fecha' ? e.criterio : { ...e.criterio, sv: +e.criterio.sv, v: +e.criterio.v, r: +e.criterio.r };
    guardarEnfoque('fm_prioridades', { ...k, nombre: e.nombre.trim(), dueno: e.dueno, criterio: crit }, yo, `editó el KPI «${e.nombre.trim()}»`);
    toast('KPI guardado');
  };
  const setCrit = (campo, v) => setE({ ...e, criterio: { ...e.criterio, [campo]: v } });
  return html`<div class="velo alto" onClick=${cerrar}></div>
    <div class="bienv fm-modal fm-ficha fmx-ficha" role="dialog" aria-modal="true" aria-label="Ficha del KPI">
      <button class="icon-btn inst-cerrar" aria-label="Cerrar" onClick=${cerrar}>${I('x')}</button>
      <h3><${IconoKPI} tipo=${k.criterio.tipo} /><${Texto} t=${k.nombre} /></h3>
      <p class="fm-estado"><${Ficha} c=${col} />Semana ${w}: <b>${mostrarValor(k.criterio, r?.valor)}</b> · ${COLOR[col].nombre}</p>
      <p class="tb-sub">${reglaTexto(k.criterio)} · Captura: ${per(k.dueno)?.corto || k.dueno}</p>

      <h4>De dónde sale el dato</h4>
      <label class="campo"><span>Fuente</span><input class="control" placeholder="Ej. Metricool, GHL, Master Entregables" value=${f.fuente} onInput=${(ev) => setF({ ...f, fuente: ev.target.value })} onBlur=${guardarFicha} /></label>
      <label class="campo"><span>Cómo se calcula</span><textarea class="control" rows="2" value=${f.formula} onInput=${(ev) => setF({ ...f, formula: ev.target.value })} onBlur=${guardarFicha}></textarea></label>
      <ul class="doc-lista">${(f.ligas || []).map((l) => html`<li key=${l.url}><a href=${l.url} target="_blank" rel="noopener">${I('enlace')}<span><b>${l.nombre}</b></span></a>
        <button class="quitar" style="opacity:1" aria-label="Quitar liga" onClick=${() => { const n = { ...f, ligas: f.ligas.filter((x) => x.url !== l.url) }; setF(n); guardarEnfoque('fm_fichas', n, yo); }}>${I('x')}</button></li>`)}</ul>
      <input class="control sutil" placeholder="+ Pega una liga (https://…)" value=${nuevaLiga} onInput=${(ev) => setNuevaLiga(ev.target.value)}
        onKeyDown=${(ev) => { if (ev.key !== 'Enter') return; const u = nuevaLiga.trim(); if (!/^https:\/\//i.test(u)) return toast('La liga debe empezar con https://'); const n = { ...f, ligas: [...(f.ligas || []), { nombre: u.replace(/^https:\/\/(www\.)?/, '').slice(0, 50), url: u }] }; setF(n); guardarEnfoque('fm_fichas', n, yo); setNuevaLiga(''); }} />

      ${admin && html`<h4>Estructura (solo Dirección)</h4>
        <div class="fm-edit">
          <label class="campo ancho"><span>Nombre</span><input class="control" value=${e.nombre} onInput=${(ev) => setE({ ...e, nombre: ev.target.value })} /></label>
          <label class="campo"><span>Lo captura</span><select class="control" value=${e.dueno} onChange=${(ev) => setE({ ...e, dueno: ev.target.value })}>${db.personas.map((p) => html`<option key=${p.id} value=${p.id}>${p.corto}</option>`)}</select></label>
          <label class="campo ancho"><span>Tipo</span><select class="control" value=${e.criterio.tipo} onChange=${(ev) => setE({ ...e, criterio: ev.target.value === 'si_no' ? { tipo: 'si_no' } : { tipo: ev.target.value, sv: '', v: '', r: '' } })}>${TIPOS.map((t) => html`<option key=${t.id} value=${t.id}>${t.nombre}</option>`)}</select></label>
          ${e.criterio.tipo !== 'si_no' && ['sv', 'v', 'r'].map((u) => html`<label key=${u} class="campo"><span>${{ sv: 'Súper verde', v: 'Verde', r: 'Rojo' }[u]}</span>
            <input class="control" type=${e.criterio.tipo === 'fecha' ? 'date' : 'text'} inputmode="decimal" value=${e.criterio[u]} onInput=${(ev) => setCrit(u, ev.target.value)} /></label>`)}
        </div>
        <div class="bienv-acc">
          <button class="btn fantasma" onClick=${() => { if (!confirm('¿Borrar este KPI y sus capturas?')) return; c.fm.reportes.filter((x) => x.prioridad === k.id).forEach((x) => borrarEnfoque('fm_reportes', x.id, yo)); borrarEnfoque('fm_prioridades', k.id, yo, `borró el KPI «${k.nombre}»`); cerrar(); }}>Borrar KPI</button>
          <button class="btn prim" onClick=${guardarEstructura}>Guardar estructura</button>
        </div>`}
    </div>`;
}

// ---------- Estructura (Dirección): trimestre, prioridades y reglas ----------
function Estructura({ c }) {
  const { trim, aj, empresas, kpisDe, yo, toast, db, fm, abrirFicha } = c;
  const [t, setT] = useState({ tema: trim.tema, exito: trim.exito });
  const guardarTrim = () => guardarEnfoque('fm_trimestres', { ...trim, tema: t.tema.trim(), exito: t.exito.trim() }, yo, 'editó el trimestre del mapa de enfoque');
  const nuevaPrioridad = () => {
    if (empresas.length >= (aj.maxEmpresa || 5)) return toast(`El tope es de ${aj.maxEmpresa || 5} prioridades de empresa`);
    guardarEnfoque('fm_prioridades', { id: uid('p'), clase: 'empresa', trimestre: trim.id, padre: null, nombre: 'Nueva prioridad', dueno: yo, meta: aj.metas?.[0]?.id || null, orden: empresas.length, creado: new Date().toISOString() }, yo, 'agregó una prioridad al mapa de enfoque');
  };
  const nuevoKPI = (e) => {
    const k = { id: uid('k'), clase: 'kpi', trimestre: trim.id, padre: e.id, nombre: 'Nuevo KPI', dueno: e.dueno, criterio: { tipo: 'mas', sv: 3, v: 2, r: 1 }, orden: kpisDe(e.id).length, creado: new Date().toISOString() };
    guardarEnfoque('fm_prioridades', k, yo, 'agregó un KPI al mapa de enfoque');
    abrirFicha(k.id);
  };
  return html`
    <section class="tb-panel">
      <h2>Trimestre ${trim.nombre}</h2>
      <label class="campo"><span>Tema</span><input class="control" value=${t.tema} onInput=${(e) => setT({ ...t, tema: e.target.value })} onBlur=${guardarTrim} /></label>
      <label class="campo"><span>Cómo se ve el éxito (una línea por punto)</span><textarea class="control" rows="3" value=${t.exito} onInput=${(e) => setT({ ...t, exito: e.target.value })} onBlur=${guardarTrim}></textarea></label>
      <div class="pe-fila"><span>La captura cierra</span>
        <span class="og-acc"><select class="control chico" value=${aj.limiteDia} onChange=${(e) => guardarEnfoque('fm_ajustes', { ...aj, limiteDia: +e.target.value }, yo)}>
          ${[[7, 'Lunes siguiente'], [8, 'Martes siguiente'], [4, 'Viernes'], [6, 'Domingo']].map(([v, n]) => html`<option key=${v} value=${v}>${n}</option>`)}</select>
        <select class="control chico" value=${aj.limiteHora} onChange=${(e) => guardarEnfoque('fm_ajustes', { ...aj, limiteHora: +e.target.value }, yo)}>
          ${[8, 9, 10, 12, 15, 18].map((h) => html`<option key=${h} value=${h}>${h}:00</option>`)}</select></span></div>
    </section>
    ${empresas.map((e, i) => html`<section key=${e.id} class="tb-panel fm-est">
      <div class="fm-est-cab"><span class="fm-num">${i + 1}</span>
        <input class="control" value=${e.nombre} aria-label="Nombre de la prioridad" onChange=${(ev) => guardarEnfoque('fm_prioridades', { ...e, nombre: ev.target.value.trim() || e.nombre }, yo)} />
        <select class="control chico" value=${e.dueno} aria-label="Responsable" onChange=${(ev) => guardarEnfoque('fm_prioridades', { ...e, dueno: ev.target.value }, yo)}>${db.personas.map((p) => html`<option key=${p.id} value=${p.id}>${p.corto}</option>`)}</select>
        <button class="icon-btn" aria-label="Quitar prioridad" onClick=${() => { if (kpisDe(e.id).length) return toast('Primero borra sus KPI'); borrarEnfoque('fm_prioridades', e.id, yo, 'quitó una prioridad del mapa de enfoque'); }}>${I('x')}</button></div>
      <ul class="fm-kpis">${kpisDe(e.id).map((k) => html`<li key=${k.id}><button onClick=${() => abrirFicha(k.id)}><span class="fm-kn"><${IconoKPI} tipo=${k.criterio.tipo} /><${Texto} t=${k.nombre} /></span><small class="tenue">${reglaTexto(k.criterio)}</small></button></li>`)}</ul>
      <button class="enlace" onClick=${() => nuevoKPI(e)}>${I('mas')}Agregar KPI</button>
    </section>`)}
    <button class="btn" onClick=${nuevaPrioridad}>${I('mas')}Agregar prioridad de empresa</button>
    <p class="tb-sub" style="margin-top:12px">Hay ${empresas.length} de ${aj.maxEmpresa || 5} prioridades.</p>`;
}
