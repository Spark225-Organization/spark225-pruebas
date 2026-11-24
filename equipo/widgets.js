// Inicio personalizable: cada persona agrega, quita y reordena sus widgets.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { WIDGETS, CAPACIDAD_SEMANA, sumarDias } from './datos.js?v=202611241453';
import { vigentes, participa, estatusVisible, horasEstimadas, layoutDe, guardarLayout, personalDe, guardarPersonal, visiblePara, historialGlobal, marcarCorreo, correoAActividad, sinLeerChat, prefsDe, guardarPrefs } from './store.js?v=202611241453';
import { I, Avatar, fechaRelativa, diasEntre, minutos, hhmm, duracion, haceCuanto } from './ui.js?v=202611241453';
import { hoyISO } from './datos.js?v=202611241453';
import { iniciarArrastre, useArrastre } from './arrastre.js?v=202611241453';

const uid = () => Math.random().toString(36).slice(2, 8);

export function Widgets({ ctx, persona, editable, hoy, ancho }) {
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
    <aside class=${'widgets' + (editando ? ' editando' : '') + (ancho ? ' ancho' : '')} aria-label="Widgets" data-tour="widgets">
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
  if (t === 'proxima') return html`<${WProxima} ...${props} />`;
  if (t === 'jornada') return html`<${WJornada} ...${props} />`;
  if (t === 'cumplimiento') return html`<${WCumplimiento} ...${props} />`;
  if (t === 'facturas') return html`<${WFacturas} ...${props} />`;
  if (t === 'correo') return html`<${WCorreo} ...${props} />`;
  if (t === 'chat') return html`<${WChat} ...${props} />`;
  if (t === 'clientes') return html`<${WClientes} ...${props} />`;
  if (t === 'minimes') return html`<${WMiniMes} ...${props} />`;
  if (t === 'historial') return html`<${WHistorial} ...${props} />`;
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

function useMinuto() {
  const [t, set] = useState(() => new Date());
  useEffect(() => { const k = setInterval(() => set(new Date()), 30000); return () => clearInterval(k); }, []);
  return t;
}

// Lo siguiente: el próximo bloque con cuenta regresiva.
function WProxima({ ctx, suyas, hoy }) {
  const ahora = useMinuto();
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  const sig = suyas.filter((a) => a.fecha === hoy && a.bloque && a.estatus !== 'hecho' && minutos(a.bloque.inicio) + a.bloque.min > m)
    .sort((a, b) => minutos(a.bloque.inicio) - minutos(b.bloque.inicio))[0];
  if (!sig) return html`<div class="w">${cab('reloj', 'Lo siguiente')}<div class="w-grande">${I('check')}</div></div>`;
  const c = ctx.db.clientes.find((x) => x.id === sig.cliente);
  const falta = minutos(sig.bloque.inicio) - m;
  return html`<button class="w w-prox" style=${`--c:${c?.color}`} onClick=${() => ctx.abrir(sig.id)}>
    ${cab('reloj', falta <= 0 ? 'Ahora' : 'En')}
    <div class="w-grande num">${falta <= 0 ? sig.bloque.inicio : duracion(falta)}</div>
    <div class="prox-t"><span class="bolita"></span>${sig.titulo}</div>
  </button>`;
}

// Jornada: cuánto queda del día laboral.
function WJornada() {
  const ahora = useMinuto();
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  const ini = 9 * 60, fin = 19 * 60;
  const pct = Math.max(0, Math.min(1, (m - ini) / (fin - ini)));
  return html`<div class="w">
    ${cab('sol', 'Jornada')}
    <div class="w-grande num">${m >= fin ? I('luna') : duracion(Math.max(0, fin - Math.max(m, ini)))}</div>
    <span class="barra-c jornada"><i style=${`width:${pct * 100}%`}></i></span>
  </div>`;
}

// A tiempo: porcentaje de lo cerrado esta semana antes de su fecha original.
function WCumplimiento({ persona, hoy }) {
  const l = sumarDias(hoy, -((new Date(hoy + 'T12:00:00').getDay() + 6) % 7));
  const cerradas = vigentes().filter((a) => a.responsable === persona && a.estatus === 'hecho' && (a.cerrada || '').slice(0, 10) >= l);
  const aTiempo = cerradas.filter((a) => (a.cerrada || '').slice(0, 10) <= (a.fechaOriginal || a.fecha)).length;
  const pct = cerradas.length ? Math.round((aTiempo / cerradas.length) * 100) : null;
  return html`<div class="w">
    ${cab('check', 'A tiempo')}
    <div class="w-grande num" style=${pct !== null && pct < 80 ? 'color:var(--brasa)' : ''}>${pct === null ? '—' : pct + '%'}</div>
    <div class="w-pie num">${aTiempo}/${cerradas.length}</div>
  </div>`;
}

function WFacturas({ ctx, persona }) {
  const mias = ctx.db.chat.mensajes.filter((m) => m.tipo === 'factura' && (m.de === persona || m.para === persona));
  const abiertas = mias.filter((m) => m.estatus !== 'pagada').length;
  return html`<button class="w" onClick=${() => ctx.abrirChat()}>
    ${cab('factura', 'Facturas')}
    <div class="w-grande num">${abiertas}</div>
    <div class="w-pie num">${mias.length - abiertas} ${I('check')}</div>
  </button>`;
}

// Correo: simulado hasta conectar Gmail. Un toque lo vuelve actividad.
function WCorreo({ ctx }) {
  const l = ctx.db.correos;
  const nuevos = l.filter((m) => !m.leido).length;
  return html`<div class="w">
    ${cab('correo', 'Correo', nuevos || null)}
    <ul class="correos">${l.slice(0, 4).map((m) => {
      const c = ctx.db.clientes.find((x) => x.id === m.cliente);
      return html`<li key=${m.id} class=${m.leido ? '' : 'nuevo'} style=${`--c:${c?.color}`}>
        <button class="c-cuerpo" onClick=${() => marcarCorreo(m.id, !m.leido)}>
          <span class="c-de">${m.de}<em>${haceCuanto(m.cuando)}</em></span><span class="c-as">${m.asunto}</span></button>
        ${m.actividad ? html`<span class="c-ok" title="Ya es actividad">${I('check')}</span>`
          : html`<button class="icon-btn chico" title="Convertir en actividad" aria-label="Convertir en actividad" onClick=${() => { correoAActividad(m.id, ctx.yo); ctx.toast('Ahora es actividad'); }}>${I('mas')}</button>`}
      </li>`;
    })}</ul>
    <div class="demo-tag">demo</div>
  </div>`;
}

function WChat({ ctx }) {
  const ult = [...ctx.db.chat.mensajes].filter((m) => ctx.db.chat.canales.find((c) => c.id === m.canal)?.miembros.includes(ctx.yo)).slice(-3).reverse();
  const n = sinLeerChat(ctx.yo);
  return html`<button class="w" onClick=${() => ctx.abrirChat()}>
    ${cab('chat', 'Chat', n || null)}
    <ul class="chat-mini">${ult.map((m) => { const p = ctx.db.personas.find((x) => x.id === m.de); return html`<li key=${m.id}><${Avatar} p=${p} /><span>${m.tipo === 'factura' ? html`${I('factura')} ${m.archivo}` : m.texto}</span></li>`; })}</ul>
  </button>`;
}

function WClientes({ ctx, suyas, hoy }) {
  const l = ctx.db.clientes.filter((c) => !c.privado).map((c) => {
    const ab = suyas.filter((a) => a.cliente === c.id && a.estatus !== 'hecho');
    return { c, n: ab.length, alerta: ab.some((a) => a.fecha < hoy || estatusVisible(a) === 'bloqueado') };
  });
  return html`<div class="w">
    ${cab('clientes', 'Clientes')}
    <div class="clientes-mini">${l.map(({ c, n, alerta }) => html`<span key=${c.id} class="cm" style=${`--c:${c.color}`} title=${c.nombre}>
      <i></i><b class="num">${n}</b>${alerta ? html`<em></em>` : null}<small>${c.nombre}</small></span>`)}</div>
  </div>`;
}

function WMiniMes({ ctx, suyas, hoy }) {
  const ini = hoy.slice(0, 8) + '01';
  const lun = sumarDias(ini, -((new Date(ini + 'T12:00:00').getDay() + 6) % 7));
  const dias = Array.from({ length: 35 }, (_, i) => sumarDias(lun, i));
  return html`<div class="w">
    ${cab('semana', new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(hoy + 'T12:00:00')))}
    <div class="minimes">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => html`<span class="mm-s" key=${'s' + i}>${d}</span>`)}
      ${dias.map((f) => { const n = suyas.filter((a) => a.fecha === f && a.estatus !== 'hecho').length; return html`<button key=${f}
        class=${'mm-d' + (f === hoy ? ' hoy' : '') + (f.slice(5, 7) !== hoy.slice(5, 7) ? ' fuera' : '')} onClick=${() => { ctx.setFecha(f); guardarPrefs(ctx.yo, { vista: 'dia' }); }}>
        <span class="num">${+f.slice(8)}</span>${n ? html`<i style=${`opacity:${Math.min(1, 0.35 + n * 0.25)}`}></i>` : null}</button>`; })}
    </div>
  </div>`;
}

function WHistorial({ ctx }) {
  const l = historialGlobal().slice(0, 4);
  return html`<button class="w" onClick=${() => { location.hash = '#/historial'; }}>
    ${cab('historial', 'Movimientos')}
    <ul class="hist-mini">${l.map((h, i) => { const p = ctx.db.personas.find((x) => x.id === h.quien); return html`<li key=${i}><${Avatar} p=${p} /><span><b>${p?.corto}</b> ${h.que}${h.titulo ? html` · <em>${h.titulo}</em>` : null}</span></li>`; })}</ul>
  </button>`;
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
