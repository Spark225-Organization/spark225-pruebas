// Inicio personalizable: cada persona agrega, quita y reordena sus widgets.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { WIDGETS, CAPACIDAD_SEMANA, sumarDias } from './datos.js?v=202611241419';
import { vigentes, participa, estatusVisible, horasEstimadas, layoutDe, guardarLayout, personalDe, guardarPersonal, visiblePara } from './store.js?v=202611241419';
import { I, Avatar, fechaRelativa, diasEntre } from './ui.js?v=202611241419';
import { hoyISO } from './datos.js?v=202611241419';
import { iniciarArrastre, useArrastre } from './arrastre.js?v=202611241419';

const uid = () => Math.random().toString(36).slice(2, 8);

export function Widgets({ ctx, persona, editable, hoy }) {
  const [editando, setEditando] = useState(false);
  const arr = useArrastre();
  const lista = layoutDe(persona).filter((w) => w.tipo !== 'cliente' || ctx.db.clientes.some((c) => c.id === w.cliente));
  const quitar = (id) => guardarLayout(persona, lista.filter((w) => w.id !== id));
  const reordenar = (id, antesDe) => {
    if (id === antesDe) return;
    const w = lista.find((x) => x.id === id);
    const resto = lista.filter((x) => x.id !== id);
    const i = antesDe ? resto.findIndex((x) => x.id === antesDe) : resto.length;
    resto.splice(i < 0 ? resto.length : i, 0, w);
    guardarLayout(persona, resto);
  };
  const agregar = (w) => { guardarLayout(persona, [...layoutDe(persona), { id: 'w' + uid(), ...w }]); ctx.toast('Agregado'); };

  const suyas = vigentes().filter((a) => participa(a, persona) && visiblePara(a, ctx.yo));
  const datos = { ctx, persona, hoy, suyas, editable };

  return html`
    <aside class=${'widgets' + (editando ? ' editando' : '')} aria-label="Widgets">
      ${editable && html`<div class="w-barra">
        <button class=${'btn ' + (editando ? 'prim' : 'fantasma')} onClick=${() => setEditando(!editando)} aria-pressed=${editando} aria-label=${editando ? 'Terminar de editar' : 'Editar widgets'} title="Editar widgets">${editando ? 'Listo' : I('ajustes')}</button>
      </div>`}
      ${lista.map((w) => {
        const def = WIDGETS.find((x) => x.tipo === w.tipo);
        const sobre = arr?.destino?.tipo === 'widget' && arr.destino.wid === w.id && arr.datos.widget !== w.id;
        return html`
          <div key=${w.id} class=${`w-celda t-${def?.tam || 's'}` + (sobre ? ' sobre' : '') + (arr?.datos?.widget === w.id ? ' fantasma' : '')}
            data-drop="widget" data-wid=${w.id}
            onPointerDown=${editando ? (e) => iniciarArrastre(e, { datos: { widget: w.id }, etiqueta: def?.nombre, alSoltar: (d) => {
              if (d.tipo === 'widget') reordenar(w.id, d.wid);
              if (d.tipo === 'papelera') quitar(w.id);
            } }) : null}>
            ${editando && html`<button class="w-quitar" aria-label=${`Quitar ${def?.nombre}`} onPointerDown=${(e) => e.stopPropagation()} onClick=${() => quitar(w.id)}>${I('menos')}</button>`}
            <${Widget} w=${w} ...${datos} />
          </div>`;
      })}
      ${editando && html`<button class="w-celda t-s w-agregar" onClick=${() => ctx.abrirGaleria(agregar)} aria-label="Agregar widget">${I('mas')}</button>`}
    </aside>`;
}

function Widget(props) {
  const t = props.w.tipo;
  if (t === 'foco') return html`<${WFoco} ...${props} />`;
  if (t === 'cliente') return html`<${WCliente} ...${props} />`;
  if (t === 'esperando') return html`<${WEsperando} ...${props} />`;
  if (t === 'carga') return html`<${WCarga} ...${props} />`;
  if (t === 'sigue') return html`<${WSigue} ...${props} />`;
  if (t === 'archivos') return html`<${WArchivos} ...${props} />`;
  if (t === 'personal') return html`<${WPersonal} ...${props} />`;
  if (t === 'nota') return html`<${WNota} ...${props} />`;
  return null;
}

const cab = (icono, texto, extra) => html`<div class="w-t">${I(icono)}<span>${texto}</span>${extra ? html`<b class="num">${extra}</b>` : null}</div>`;

function WFoco({ ctx, suyas, hoy, persona }) {
  const deHoy = suyas.filter((a) => a.fecha === hoy);
  const foco = suyas.filter((a) => a.foco === hoy && a.responsable === persona);
  const hechas = deHoy.filter((a) => a.estatus === 'hecho').length;
  const pct = deHoy.length ? hechas / deHoy.length : 0;
  const C = 2 * Math.PI * 28;
  return html`<div class="w w-foco">
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label=${`${hechas} de ${deHoy.length}`}>
      <defs><linearGradient id="g-anillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5C245" /><stop offset="1" stop-color="#E47739" /></linearGradient></defs>
      <circle cx="36" cy="36" r="28" fill="none" stroke="var(--grafito)" stroke-width="8" />
      <circle cx="36" cy="36" r="28" fill="none" stroke="url(#g-anillo)" stroke-width="8" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - pct)} transform="rotate(-90 36 36)" style="transition:stroke-dashoffset 400ms var(--ease)" />
      <text x="36" y="41" text-anchor="middle" class="anillo-num">${hechas}/${deHoy.length}</text>
    </svg>
    <div class="foco-der">
      ${cab('foco', 'Foco', `${foco.length}/3`)}
      <ul class="lista-w">${foco.map((a) => {
        const c = ctx.db.clientes.find((x) => x.id === a.cliente);
        return html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}><span class="bolita" style=${`--c:${c?.color}`}></span><span class=${'lw-t' + (a.estatus === 'hecho' ? ' tachado' : '')}>${a.titulo}</span></button></li>`;
      })}</ul>
    </div>
  </div>`;
}

function WCliente({ w, ctx, suyas, hoy }) {
  const c = ctx.db.clientes.find((x) => x.id === w.cliente);
  const del = suyas.filter((a) => a.cliente === c.id);
  const abiertas = del.filter((a) => a.estatus !== 'hecho');
  const venc = abiertas.filter((a) => a.fecha < hoy).length;
  const bloq = abiertas.filter((a) => estatusVisible(a) === 'bloqueado').length;
  const esp = abiertas.filter((a) => a.estatus === 'esperando').length;
  const prox = [...abiertas].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const alerta = venc || bloq;
  return html`<button class="w w-cli" style=${`--c:${c.color}`} onClick=${() => prox && ctx.abrir(prox.id)}>
    <div class="w-t"><span class="cli-n">${c.nombre}</span></div>
    <div class="w-grande num" style=${alerta ? 'color:var(--brasa)' : ''}>${abiertas.length}</div>
    <div class="w-chips">
      ${venc > 0 && html`<span class="mini alerta">${venc} ${I('alerta')}</span>`}
      ${bloq > 0 && html`<span class="mini alerta">${bloq} ${I('cadena')}</span>`}
      ${esp > 0 && html`<span class="mini">${esp} ${I('espera')}</span>`}
      ${!abiertas.length && html`<span class="mini">${I('check')}</span>`}
    </div>
  </button>`;
}

function diasEsperando(a) {
  const h = [...(a.historial || [])].reverse().find((x) => x.que.includes('Esperando'));
  const desde = (h ? h.cuando : a.creada || '').slice(0, 10);
  return desde ? Math.max(0, diasEntre(desde, hoyISO())) : 0;
}

function WEsperando({ ctx, suyas }) {
  const l = suyas.filter((a) => a.estatus === 'esperando').map((a) => ({ a, d: diasEsperando(a) })).sort((x, y) => y.d - x.d);
  return html`<div class="w">
    ${cab('espera', 'Esperando')}
    <div class="w-grande num">${l.length}</div>
    <ul class="lista-w">${l.slice(0, 3).map(({ a, d }) => html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}><span class="lw-t">${a.titulo}</span><span class=${'lw-m num' + (d >= 3 ? ' alerta' : '')}>${d}d</span></button></li>`)}</ul>
  </div>`;
}

function inicioSemana(iso) { const d = new Date(iso + 'T12:00:00'); return sumarDias(iso, -((d.getDay() + 6) % 7)); }

function WCarga({ ctx, hoy }) {
  const dom = sumarDias(inicioSemana(hoy), 6);
  const filas = ctx.db.personas.map((p) => ({ p, h: vigentes().filter((a) => a.responsable === p.id && a.estatus !== 'hecho' && a.fecha <= dom).reduce((s, a) => s + horasEstimadas(a), 0) }));
  return html`<div class="w">
    ${cab('equipo', 'Semana')}
    <div class="carga">${filas.map(({ p, h }) => html`
      <a key=${p.id} href=${p.id === ctx.yo ? '#/' : '#/persona/' + p.id} class="carga-f" title=${`${p.nombre}: ${h} de ${CAPACIDAD_SEMANA} h`}>
        <${Avatar} p=${p} />
        <span class="barra-c"><i class=${h / CAPACIDAD_SEMANA > 0.85 ? 'alta' : ''} style=${`width:${Math.min(100, (h / CAPACIDAD_SEMANA) * 100)}%`}></i></span>
        <span class="h num">${h}h</span>
      </a>`)}</div>
  </div>`;
}

function WSigue({ ctx, suyas, hoy }) {
  const l = suyas.filter((a) => a.fecha > hoy && a.estatus !== 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 4);
  return html`<div class="w">
    ${cab('semana', 'Lo que sigue')}
    <ul class="lista-w">${l.map((a) => { const c = ctx.db.clientes.find((x) => x.id === a.cliente); return html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}><span class="bolita" style=${`--c:${c?.color}`}></span><span class="lw-t">${a.titulo}</span><span class="lw-m">${fechaRelativa(a.fecha)}</span></button></li>`; })}</ul>
  </div>`;
}

function WArchivos({ persona, ctx }) {
  const pr = personalDe(persona);
  const [nuevo, setNuevo] = useState(null);
  const propia = persona === ctx.yo;
  const agregar = () => {
    const url = (nuevo.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return ctx.toast('Pega un enlace https://');
    guardarPersonal(persona, { archivos: [...pr.archivos, { id: uid(), titulo: nuevo.titulo.trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url }] });
    setNuevo(null);
  };
  return html`<div class="w">
    ${cab('carpeta', 'Mis archivos')}
    <ul class="archivos">${pr.archivos.map((f) => html`<li key=${f.id}>
      <a href=${f.url} target="_blank" rel="noopener">${I('carpeta')}<span>${f.titulo}</span></a>
      ${propia && html`<button class="quitar" aria-label=${`Quitar ${f.titulo}`} onClick=${() => guardarPersonal(persona, { archivos: pr.archivos.filter((x) => x.id !== f.id) })}>${I('x')}</button>`}
    </li>`)}</ul>
    ${propia && (nuevo
      ? html`<div class="agregar-col"><input class="control" placeholder="Nombre" value=${nuevo.titulo} onInput=${(e) => setNuevo({ ...nuevo, titulo: e.target.value })} />
          <input class="control" placeholder="https://" value=${nuevo.url} onInput=${(e) => setNuevo({ ...nuevo, url: e.target.value })} onKeyDown=${(e) => e.key === 'Enter' && agregar()} />
          <div class="fila-btn"><button class="btn fantasma" onClick=${() => setNuevo(null)}>${I('x')}</button><button class="btn" onClick=${agregar}>${I('check')}</button></div></div>`
      : html`<button class="btn fantasma mas-chico" onClick=${() => setNuevo({ titulo: '', url: '' })} aria-label="Agregar archivo">${I('mas')}</button>`)}
  </div>`;
}

function WPersonal({ persona, ctx }) {
  const pr = personalDe(persona);
  const [t, setT] = useState('');
  const propia = persona === ctx.yo;
  if (!propia) return html`<div class="w">${cab('lista', 'Pendientes')}<div class="w-pie">${I('ojo')}</div></div>`;
  const agregar = () => { if (!t.trim()) return; guardarPersonal(persona, { pendientes: [...pr.pendientes, { id: uid(), texto: t.trim(), hecho: false }] }); setT(''); };
  const abiertos = pr.pendientes.filter((x) => !x.hecho).length;
  return html`<div class="w">
    ${cab('lista', 'Mis pendientes', abiertos || null)}
    <ul class="check-lista">${pr.pendientes.map((x) => html`<li key=${x.id}>
      <input type="checkbox" checked=${x.hecho} aria-label=${x.texto} onChange=${() => guardarPersonal(persona, { pendientes: pr.pendientes.map((y) => (y.id === x.id ? { ...y, hecho: !y.hecho } : y)) })} />
      <span class=${'txt' + (x.hecho ? ' hecho' : '')}>${x.texto}</span>
      <button class="quitar" aria-label=${`Quitar ${x.texto}`} onClick=${() => guardarPersonal(persona, { pendientes: pr.pendientes.filter((y) => y.id !== x.id) })}>${I('x')}</button></li>`)}</ul>
    <input class="control sutil" placeholder="+ Agregar" value=${t} onInput=${(e) => setT(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') agregar(); }} aria-label="Nuevo pendiente personal" />
  </div>`;
}

function WNota({ persona, ctx }) {
  const pr = personalDe(persona);
  const [v, setV] = useState(pr.nota);
  const t = useRef();
  const propia = persona === ctx.yo;
  useEffect(() => () => clearTimeout(t.current), []);
  return html`<div class="w w-nota">
    ${cab('nota', 'Nota')}
    ${propia ? html`<textarea class="nota-campo" value=${v} placeholder="Escribe…" aria-label="Nota rápida"
      onInput=${(e) => { setV(e.target.value); clearTimeout(t.current); const val = e.target.value; t.current = setTimeout(() => guardarPersonal(persona, { nota: val }), 400); }}></textarea>`
      : html`<div class="w-pie">${I('ojo')}</div>`}
  </div>`;
}

// ---------- Galería para agregar widgets ----------
export function Galeria({ db, agregar, cerrar }) {
  const [cli, setCli] = useState(false);
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-label="Agregar widget">
      <div class="hoja-asa"></div>
      ${!cli ? html`<div class="galeria">${WIDGETS.map((w) => html`
        <button key=${w.tipo} class=${'g-op t-' + w.tam} onClick=${() => (w.porCliente ? setCli(true) : (agregar({ tipo: w.tipo }), cerrar()))}>
          <span class="g-ico">${I(w.icono)}</span><span>${w.nombre}</span></button>`)}</div>`
      : html`<div class="galeria">${db.clientes.filter((c) => !c.privado).map((c) => html`
        <button key=${c.id} class="g-op g-cli" style=${`--c:${c.color}`} onClick=${() => { agregar({ tipo: 'cliente', cliente: c.id }); cerrar(); }}><span class="g-ico"></span><span>${c.nombre}</span></button>`)}</div>`}
    </div>`;
}
