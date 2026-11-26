// Mapa de enfoque: prioridades del trimestre y sus KPI, con captura semanal (cierra el lunes 9:00).
// Mapa (cómo va cada prioridad) · Captura de la semana · Semana a semana · Estructura (solo Dirección).
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { datosEnfoque, guardarEnfoque, borrarEnfoque, esAdmin, nube } from './store.js?v=202611270120';
import { COLOR, TIPOS, colorKPI, colorPrioridad, validarCriterio, leerValor, cierreSemana, inicioSemana, semanaDeCarga } from './enfoque-datos.js?v=202611270120';
import { I, Avatar, Info } from './ui.js?v=202611270120';

const fmtCorta = (d) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
const fmtCierre = (d) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d).replace(/\./g, '');
const uid = (p) => p + Math.random().toString(36).slice(2, 8);

// *negritas* y _cursivas_ como en el original, sin HTML.
export function Texto({ t }) {
  return (t || '').split(/(\*[^*]+\*|_[^_]+_)/g).filter(Boolean).map((x, i) =>
    x.startsWith('*') && x.endsWith('*') ? html`<b key=${i}>${x.slice(1, -1)}</b>` : x.startsWith('_') && x.endsWith('_') ? html`<i key=${i}>${x.slice(1, -1)}</i>` : x);
}
function Ficha({ c, chico }) {
  return html`<span class=${'fm-c c-' + c + (chico ? ' chico' : '')} title=${`${COLOR[c].nombre}: ${COLOR[c].ayuda}`}>${COLOR[c].letra}</span>`;
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
  const fm = datosEnfoque();
  const admin = esAdmin(yo);
  const trim = fm.trimestres.find((t) => t.activo) || fm.trimestres[fm.trimestres.length - 1];
  const aj = fm.ajustes;
  if (!trim) return html`<${SinMapa} admin=${admin} yo=${yo} aj=${aj} toast=${toast} />`;
  return html`<${Mapa_} ctx=${ctx} fm=${fm} trim=${trim} aj=${aj} admin=${admin} />`;
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

function Mapa_({ ctx, fm, trim, aj, admin }) {
  const { db, yo, toast } = ctx;
  const [pest, setPest] = useState('mapa');
  const [ficha, setFicha] = useState(null); // id del KPI abierto
  const empresas = fm.prioridades.filter((p) => p.clase === 'empresa' && p.trimestre === trim.id).sort((a, b) => a.orden - b.orden);
  const kpisDe = (pid) => fm.prioridades.filter((p) => p.clase === 'kpi' && p.padre === pid).sort((a, b) => a.orden - b.orden);
  const todosKpi = empresas.flatMap((e) => kpisDe(e.id));
  const rep = (pid, w) => fm.reportes.find((r) => r.id === `${pid}_w${w}`);
  const wCarga = semanaDeCarga(trim, aj);
  const conReporte = [...new Set(fm.reportes.filter((r) => r.trimestre === trim.id).map((r) => r.semana))].filter((w) => w <= wCarga);
  const [wVer, setWVer] = useState(() => (conReporte.length ? Math.max(...conReporte) : wCarga));
  const cierre = cierreSemana(trim, aj, wCarga);
  const reportadas = todosKpi.filter((k) => rep(k.id, wCarga)).length;
  const per = (id) => db.personas.find((p) => p.id === id);

  const capturar = (k, w, valor) => {
    const id = `${k.id}_w${w}`, antes = rep(k.id, w);
    if (valor === '' || valor === null) { if (antes) borrarEnfoque('fm_reportes', id, yo); return; }
    if (antes && antes.valor === valor) return;
    const ahora = new Date().toISOString();
    guardarEnfoque('fm_reportes', { id, prioridad: k.id, trimestre: trim.id, semana: w, valor, capturado: ahora, primero: antes?.primero || ahora, quien: yo, nota: antes?.nota || null },
      yo, antes ? null : `capturó la semana ${w} del mapa de enfoque`);
  };
  const ctxFM = { fm, trim, aj, admin, yo, db, toast, empresas, kpisDe, rep, capturar, per, wCarga, abrirFicha: setFicha };

  return html`<div class="enfoque">
    <section class="fm-cab">
      <div class="fm-trim">
        <span class="fm-etq">${trim.nombre} · ${fmtCorta(new Date(trim.inicio + 'T12:00:00'))} al ${fmtCorta(new Date(trim.fin + 'T12:00:00'))}</span>
        <h2>${trim.tema}</h2>
        ${trim.exito && html`<p class="fm-exito"><b>Éxito del trimestre:</b> ${trim.exito.split('\n').map((l, i) => html`<span key=${i}>${l.trim()}</span>`)}</p>`}
        ${aj.metas?.[0] && html`<p class="fm-meta">${I('foco')}Empuja la meta del año: <b>${aj.metas[0].nombre}</b></p>`}
      </div>
      <div class="fm-carga">
        <span class="fm-etq">Carga de la semana ${wCarga} <${Info} t="Cada semana se captura el valor real de cada KPI; la captura cierra el lunes siguiente a las 9:00. Lo que se captura después del cierre queda marcado como tarde." /></span>
        <b class="num">${reportadas}<small> de ${todosKpi.length}</small></b>
        <span class="fm-sub">${reportadas === todosKpi.length ? 'Todo capturado' : `Faltan ${todosKpi.length - reportadas}`} · cierra ${fmtCierre(cierre)}</span>
        <button class="btn prim" onClick=${() => setPest('captura')}>Capturar semana ${wCarga}</button>
      </div>
    </section>
    ${nube.sinRH && html`<p class="aviso-guardado">${I('alerta')}Las capturas se guardan solo en este navegador hasta activar su espacio en la base (un paso de una vez).</p>`}

    <div class="segmentado fm-tabs" role="tablist">
      ${[['mapa', 'Mapa'], ['captura', 'Captura de la semana'], ['semanas', 'Semana a semana'], ...(admin ? [['estructura', 'Estructura']] : [])].map(([k, t]) => html`<button key=${k} role="tab" aria-pressed=${pest === k} onClick=${() => setPest(k)}>${t}</button>`)}
    </div>

    ${pest === 'mapa' && html`<${Mapa} c=${ctxFM} w=${wVer} setW=${setWVer} />`}
    ${pest === 'captura' && html`<${Captura} c=${ctxFM} />`}
    ${pest === 'semanas' && html`<${Semanas} c=${ctxFM} />`}
    ${pest === 'estructura' && admin && html`<${Estructura} c=${ctxFM} />`}
    ${ficha && html`<${FichaKPI} c=${ctxFM} k=${fm.prioridades.find((p) => p.id === ficha)} w=${wVer} cerrar=${() => setFicha(null)} />`}
  </div>`;
}

// ---------- Mapa ----------
function Mapa({ c, w, setW }) {
  const { empresas, kpisDe, rep, per, wCarga, trim, abrirFicha } = c;
  return html`
    <div class="fm-semana">
      <button class="icon-btn" disabled=${w <= 1} onClick=${() => setW(w - 1)} aria-label="Semana anterior">${I('flecha')}</button>
      <span><b>Semana ${w}</b> · del ${fmtCorta(inicioSemana(trim, w))}</span>
      <button class="icon-btn" disabled=${w >= wCarga} onClick=${() => setW(w + 1)} aria-label="Semana siguiente">${I('flecha', 'rot-180')}</button>
    </div>
    <div class="fm-leyenda">${['S', 'V', 'A', 'R', 'N'].map((k) => html`<span key=${k}><${Ficha} c=${k} chico />${COLOR[k].nombre}</span>`)}<${Info} t="Cada KPI tiene tres umbrales: súper verde, verde y rojo; entre verde y rojo es amarillo. La prioridad toma el promedio de sus KPI (súper verde 4, verde 3, amarillo 2, rojo 1); si alguno está en rojo, queda como máximo en amarillo." /></div>
    <div class="fm-mapa">${empresas.map((e, i) => {
      const kpis = kpisDe(e.id);
      const colores = kpis.map((k) => colorKPI(k.criterio, rep(k.id, w)?.valor));
      const ce = colorPrioridad(colores);
      const d = per(e.dueno);
      return html`<section key=${e.id} class=${'fm-prio c-' + ce}>
        <header><span class="fm-num">${i + 1}</span><h3><${Texto} t=${e.nombre} /></h3><${Avatar} p=${d} /></header>
        <p class="fm-estado"><${Ficha} c=${ce} />${COLOR[ce].nombre} · ${COLOR[ce].ayuda}</p>
        <ul class="fm-kpis">${kpis.map((k, j) => {
          const r = rep(k.id, w);
          return html`<li key=${k.id}><button onClick=${() => abrirFicha(k.id)}>
            <${Ficha} c=${colores[j]} chico /><span class="fm-kn">${k.icono} <${Texto} t=${k.nombre} /></span>
            <span class="fm-kv num">${mostrarValor(k.criterio, r?.valor)}</span><${Avatar} p=${per(k.dueno)} /></button></li>`;
        })}</ul>
      </section>`;
    })}</div>`;
}

// ---------- Captura de la semana ----------
function Captura({ c }) {
  const { empresas, kpisDe, rep, capturar, wCarga, yo, per, trim, aj, abrirFicha } = c;
  const mios = empresas.flatMap((e) => kpisDe(e.id)).filter((k) => k.dueno === yo).length;
  const [solo, setSolo] = useState(mios > 0);
  const [w, setW] = useState(wCarga);
  const cierre = cierreSemana(trim, aj, w);
  return html`
    <div class="fm-semana">
      <button class="icon-btn" disabled=${w <= 1} onClick=${() => setW(w - 1)} aria-label="Semana anterior">${I('flecha')}</button>
      <span><b>Semana ${w}</b> · cierra ${fmtCierre(cierre)}${cierre < new Date() ? html` <em class="rojo">· ya cerró</em>` : ''}</span>
      <button class="icon-btn" disabled=${w >= wCarga} onClick=${() => setW(w + 1)} aria-label="Semana siguiente">${I('flecha', 'rot-180')}</button>
      <label class="ls-hechas"><input type="checkbox" checked=${solo} onChange=${() => setSolo(!solo)} />Solo los míos</label>
    </div>
    <p class="tb-sub">Escribe el valor real de cada KPI; se guarda al salir del campo. Si lo dejas vacío, se borra la captura.</p>
    ${empresas.map((e) => {
      const kpis = kpisDe(e.id).filter((k) => !solo || k.dueno === yo);
      if (!kpis.length) return null;
      return html`<section key=${e.id} class="fm-cap-grupo"><h3><${Texto} t=${e.nombre} /></h3>
        ${kpis.map((k) => {
          const r = rep(k.id, w);
          const tarde = r && new Date(r.primero) > cierre;
          return html`<div key=${k.id} class="fm-cap">
            <div class="fm-cap-t"><button class="enlace-texto" onClick=${() => abrirFicha(k.id)}>${k.icono} <${Texto} t=${k.nombre} /></button>
              <small>${reglaTexto(k.criterio)} · ${per(k.dueno)?.corto || k.dueno}${tarde ? html` · <em class="ambar">capturado tarde</em>` : ''}</small></div>
            <${CampoValor} key=${k.id + w} k=${k} valor=${r?.valor} guardar=${(v) => capturar(k, w, v)} />
          </div>`;
        })}
      </section>`;
    })}`;
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
    <input class=${'control' + (err ? ' error' : '')} type=${t === 'fecha' ? 'date' : 'text'} inputmode=${t === 'fecha' ? null : 'decimal'} value=${txt}
      placeholder=${t.startsWith('pct') ? '%' : 'Valor'} aria-label=${`Valor de ${k.nombre}`}
      onInput=${(e) => setTxt(e.target.value)} onBlur=${confirmar} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />
    ${err && html`<small class="rojo">${err}</small>`}</div>`;
}

// ---------- Semana a semana ----------
function Semanas({ c }) {
  const { empresas, kpisDe, rep, trim, wCarga, capturar } = c;
  const [celda, setCelda] = useState(null);
  const ws = Array.from({ length: 13 }, (_, i) => i + 1);
  return html`
    <p class="tb-sub">Toca una celda para capturar o corregir ese valor.</p>
    <div class="fm-rejilla-marco"><table class="fm-rejilla">
      <thead><tr><th>Prioridad / KPI</th>${ws.map((w) => html`<th key=${w} class=${w === wCarga ? 'hoy' : ''}>S${w}<small>${fmtCorta(inicioSemana(trim, w))}</small></th>`)}</tr></thead>
      <tbody>${empresas.map((e) => {
        const kpis = kpisDe(e.id);
        return html`
          <tr key=${e.id} class="fm-fila-prio"><th><${Texto} t=${e.nombre} /></th>${ws.map((w) => {
            const ce = colorPrioridad(kpis.map((k) => colorKPI(k.criterio, rep(k.id, w)?.valor)));
            return html`<td key=${w} class=${'c-' + ce}>${w <= wCarga ? html`<${Ficha} c=${ce} chico />` : ''}</td>`;
          })}</tr>
          ${kpis.map((k) => html`<tr key=${k.id}><th class="fm-kpi-th">${k.icono} <${Texto} t=${k.nombre} /></th>${ws.map((w) => {
            const r = rep(k.id, w), col = colorKPI(k.criterio, r?.valor);
            return html`<td key=${w} class=${'fm-celda c-' + col}>${w <= wCarga ? html`<button onClick=${() => setCelda({ k, w })} aria-label=${`Semana ${w}: ${mostrarValor(k.criterio, r?.valor)}`}>${r ? mostrarValor(k.criterio, r.valor) : ''}</button>` : ''}</td>`;
          })}</tr>`)}`;
      })}</tbody>
    </table></div>
    ${celda && html`<div class="velo alto" onClick=${() => setCelda(null)}></div>
      <div class="bienv fm-modal" role="dialog" aria-modal="true" aria-label="Capturar valor">
        <h3>${celda.k.icono} <${Texto} t=${celda.k.nombre} /></h3>
        <p class="tb-sub">Semana ${celda.w} · ${reglaTexto(celda.k.criterio)}</p>
        <${CampoValor} k=${celda.k} valor=${rep(celda.k.id, celda.w)?.valor} guardar=${(v) => { capturar(celda.k, celda.w, v); }} />
        <div class="bienv-acc"><button class="btn prim" onClick=${() => setCelda(null)}>Listo</button></div>
      </div>`}`;
}

// ---------- Ficha del KPI (fuente, fórmula, ligas; Dirección edita la estructura) ----------
function FichaKPI({ c, k, w, cerrar }) {
  const { fm, admin, yo, rep, per, toast, db } = c;
  const meta = fm.fichas.find((f) => f.id === k.id) || { id: k.id, fuente: '', formula: '', ligas: [] };
  const [f, setF] = useState(meta);
  const [e, setE] = useState({ nombre: k.nombre, icono: k.icono, dueno: k.dueno, criterio: { ...k.criterio } });
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
    guardarEnfoque('fm_prioridades', { ...k, nombre: e.nombre.trim(), icono: e.icono, dueno: e.dueno, criterio: crit }, yo, `editó el KPI «${e.nombre.trim()}»`);
    toast('KPI guardado');
  };
  const setCrit = (campo, v) => setE({ ...e, criterio: { ...e.criterio, [campo]: v } });
  return html`<div class="velo alto" onClick=${cerrar}></div>
    <div class="bienv fm-modal fm-ficha" role="dialog" aria-modal="true" aria-label="Ficha del KPI">
      <button class="icon-btn inst-cerrar" aria-label="Cerrar" onClick=${cerrar}>${I('x')}</button>
      <h3>${k.icono} <${Texto} t=${k.nombre} /></h3>
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
          <label class="campo"><span>Ícono</span><input class="control" maxlength="4" value=${e.icono} onInput=${(ev) => setE({ ...e, icono: ev.target.value })} /></label>
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
    const k = { id: uid('k'), clase: 'kpi', trimestre: trim.id, padre: e.id, icono: '📌', nombre: 'Nuevo KPI', dueno: e.dueno, criterio: { tipo: 'mas', sv: 3, v: 2, r: 1 }, orden: kpisDe(e.id).length, creado: new Date().toISOString() };
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
      <ul class="fm-kpis">${kpisDe(e.id).map((k) => html`<li key=${k.id}><button onClick=${() => abrirFicha(k.id)}><span class="fm-kn">${k.icono} <${Texto} t=${k.nombre} /></span><small class="tenue">${reglaTexto(k.criterio)}</small></button></li>`)}</ul>
      <button class="enlace" onClick=${() => nuevoKPI(e)}>${I('mas')}Agregar KPI</button>
    </section>`)}
    <button class="btn" onClick=${nuevaPrioridad}>${I('mas')}Agregar prioridad de empresa</button>
    <p class="tb-sub" style="margin-top:12px">Hay ${empresas.length} de ${aj.maxEmpresa || 5} prioridades.</p>`;
}
