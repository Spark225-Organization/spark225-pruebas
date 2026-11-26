// Pipeline: todo lo pendiente del equipo en un solo lugar.
// Filtra por persona (yo, todos, alguien) y por cliente. Se ve en columnas por estatus o en lista por fecha.
// Arriba van las minutas que llegan del correo: son de todos.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias, ESTATUS } from './datos.js?v=202611270745';
import { vigentes, participa, visiblePara, estatusVisible, prefsDe, guardarPrefs, acuerdoATarea } from './store.js?v=202611270745';
import { I, Anillo, Avatar, fechaRelativa, haceCuanto } from './ui.js?v=202611270745';
import { arrastrarActividad, teclasActividad } from './mecha.js?v=202611270745';
import { useArrastre } from './arrastre.js?v=202611270745';

const finDeSemana = (iso) => { const d = new Date(iso + 'T12:00:00'); return sumarDias(iso, 6 - ((d.getDay() + 6) % 7)); };

export function filtrarPipeline(ctx, pr) {
  const quien = pr.pipePersona === 'yo' ? ctx.yo : pr.pipePersona;
  return vigentes().filter((a) => visiblePara(a, ctx.yo)
    && (quien === 'todos' || participa(a, quien))
    && (!pr.pipeCliente || a.cliente === pr.pipeCliente));
}

export function Pipeline({ ctx }) {
  const { db, yo } = ctx;
  const pr = { pipeVista: 'columnas', pipePersona: 'yo', pipeCliente: null, ...prefsDe(yo) };
  if (pr.pipeCliente && !db.clientes.some((c) => c.id === pr.pipeCliente)) pr.pipeCliente = null;
  const poner = (c) => guardarPrefs(yo, c);
  const hoy = hoyISO();
  const lista = filtrarPipeline(ctx, pr);
  const abiertas = lista.filter((a) => a.estatus !== 'hecho');
  const vencidas = abiertas.filter((a) => a.fecha < hoy).length;
  const quien = pr.pipePersona === 'yo' ? yo : pr.pipePersona;
  const baseCliente = vigentes().filter((a) => visiblePara(a, yo) && a.estatus !== 'hecho' && (quien === 'todos' || participa(a, quien)));
  const clientes = db.clientes.filter((c) => !c.privado || baseCliente.some((a) => a.cliente === c.id));
  const minutas = db.minutas.filter((m) => !pr.pipeCliente || m.cliente === pr.pipeCliente).slice(0, 8);

  return html`
    <header class="cab-inicio cab-pipe">
      <div class="cab-dia">
        <h1>Pipeline</h1>
        <span class="sub num">${abiertas.length} abiertas${vencidas ? html` · <b class="rojo">${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}</b>` : ''}</span>
      </div>
      <div class="segmentado vistas" role="tablist" aria-label="Forma de ver">
        ${[['columnas', 'columnas', 'Columnas'], ['lista', 'lista', 'Lista']].map(([id, ico, t]) => html`<button key=${id} role="tab" aria-selected=${pr.pipeVista === id} aria-pressed=${pr.pipeVista === id} onClick=${() => poner({ pipeVista: id })}>${I(ico)}<span>${t}</span></button>`)}
      </div>
    </header>

    <div class="pipe-filtros" data-tour="filtros">
      <div class="pf-grupo" role="group" aria-label="De quién">
        <button class="per-op" aria-pressed=${pr.pipePersona === 'yo'} onClick=${() => poner({ pipePersona: 'yo' })}><${Avatar} p=${db.personas.find((p) => p.id === yo)} />Mías</button>
        <button class="chip-op" aria-pressed=${pr.pipePersona === 'todos'} onClick=${() => poner({ pipePersona: 'todos' })}>${I('equipo')}Todos</button>
        ${db.personas.filter((p) => p.id !== yo).map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${pr.pipePersona === p.id} onClick=${() => poner({ pipePersona: p.id })}><${Avatar} p=${p} />${p.corto}</button>`)}
      </div>
      <div class="pf-grupo pf-clientes" role="group" aria-label="Cliente">
        <button class="chip-op" aria-pressed=${!pr.pipeCliente} onClick=${() => poner({ pipeCliente: null })}>Todos los clientes</button>
        ${clientes.map((c) => { const n = baseCliente.filter((a) => a.cliente === c.id).length; return html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} aria-pressed=${pr.pipeCliente === c.id} onClick=${() => poner({ pipeCliente: pr.pipeCliente === c.id ? null : c.id })}><i></i>${c.nombre}${n ? html`<em class="num">${n}</em>` : null}</button>`; })}
      </div>
    </div>

    ${minutas.length > 0 && html`<section class="pipe-minutas" aria-label="Minutas">
      <h3>${I('nota')}Minutas de juntas<span>Llegan solas del correo</span></h3>
      <div class="pm-fila">${minutas.map((m) => html`<${TarjetaMinuta} key=${m.id} m=${m} ctx=${ctx} />`)}</div>
    </section>`}

    ${lista.length === 0
      ? html`<div class="vacio">${I('check')}<p>Nada pendiente con este filtro.</p><button class="btn prim" onClick=${() => ctx.crear('tarea', { cliente: pr.pipeCliente || undefined })}>${I('mas')}Nueva tarea</button></div>`
      : pr.pipeVista === 'columnas' ? html`<${Columnas} lista=${lista} ctx=${ctx} hoy=${hoy} todos=${pr.pipePersona !== 'yo'} />`
      : html`<${ListaFechas} lista=${lista} ctx=${ctx} hoy=${hoy} todos=${pr.pipePersona !== 'yo'} />`}`;
}

// ---------- Columnas por estatus (arrastra para cambiarlo) ----------
export function Columnas({ lista, ctx, hoy, todos }) {
  const arr = useArrastre();
  const hace7 = sumarDias(hoy, -7);
  return html`<div class="pipe-cols">${ESTATUS.map((s) => {
    const l = lista.filter((a) => estatusVisible(a) === s.id && (s.id !== 'hecho' || (a.cerrada || '').slice(0, 10) >= hace7))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const sobre = arr?.destino?.tipo === 'estatus' && arr.destino.estatus === s.id;
    return html`<section key=${s.id} class=${'pipe-col e-' + s.id + (sobre ? ' sobre' : '')} data-drop="estatus" data-estatus=${s.id}>
      <h3><${Anillo} estatus=${s.id} />${s.nombre}<span class="num">${l.length}</span></h3>
      <div class="pc-lista">${l.map((a) => html`<${TarjetaPipe} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} todos=${todos} />`)}
        ${l.length === 0 && html`<div class="pc-vacia">Suelta aquí</div>`}</div>
    </section>`;
  })}</div>`;
}

export function TarjetaPipe({ a, ctx, hoy, todos }) {
  const arr = useArrastre();
  const c = ctx.db.clientes.find((x) => x.id === a.cliente);
  const p = ctx.db.personas.find((x) => x.id === a.responsable);
  const ev = estatusVisible(a);
  const venc = a.fecha < hoy && a.estatus !== 'hecho';
  return html`<div class=${'pcard' + (a.estatus === 'hecho' ? ' hecha' : '') + (arr?.datos?.actividad === a.id ? ' fantasma' : '')} style=${`--c:${c?.color}`}
    tabindex="0" role="button" aria-label=${a.titulo} onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
    <span class="pcard-cli">${c?.nombre}</span>
    <span class="pcard-t">${a.titulo}</span>
    <span class="pcard-pie">
      <span class=${'pcard-f num' + (venc ? ' rojo' : '')}>${venc ? I('alerta') : null}${fechaRelativa(a.fecha)}</span>
      ${(todos || a.responsable !== ctx.yo) && html`<${Avatar} p=${p} />`}
      <button class="anillo-mini" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${`Estatus: ${ESTATUS.find((s) => s.id === ev)?.nombre}. Avanzar`}><${Anillo} estatus=${ev} /></button>
    </span>
  </div>`;
}

// ---------- Lista por fecha: vencidas siempre arriba ----------
function ListaFechas({ lista, ctx, hoy, todos }) {
  const [verHechas, setVerHechas] = useState(false);
  const finSem = finDeSemana(hoy);
  const ab = lista.filter((a) => a.estatus !== 'hecho').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grupos = [
    { id: 'venc', t: 'Vencidas', l: ab.filter((a) => a.fecha < hoy), rojo: true },
    { id: 'hoy', t: 'Hoy', l: ab.filter((a) => a.fecha === hoy) },
    { id: 'sem', t: 'Esta semana', l: ab.filter((a) => a.fecha > hoy && a.fecha <= finSem) },
    { id: 'des', t: 'Después', l: ab.filter((a) => a.fecha > finSem) },
  ].filter((g) => g.l.length);
  const hechas = lista.filter((a) => a.estatus === 'hecho' && (a.cerrada || '').slice(0, 10) >= sumarDias(hoy, -7));
  return html`<div class="pipe-lista">
    ${grupos.map((g) => html`<section key=${g.id} class=${'pl-grupo' + (g.rojo ? ' venc' : '')}>
      <h3>${g.t}<span class="num">${g.l.length}</span></h3>
      ${g.l.map((a) => html`<${FilaPipe} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} todos=${todos} />`)}
    </section>`)}
    ${hechas.length > 0 && html`<section class="pl-grupo hechas">
      <button class="pl-toggle" onClick=${() => setVerHechas(!verHechas)} aria-expanded=${verHechas}>${I('check')}Hechas esta semana<span class="num">${hechas.length}</span>${I('flecha', verHechas ? 'rot-arriba' : 'rot-abajo')}</button>
      ${verHechas && hechas.map((a) => html`<${FilaPipe} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} todos=${todos} />`)}
    </section>`}
  </div>`;
}

function FilaPipe({ a, ctx, hoy, todos }) {
  const arr = useArrastre();
  const c = ctx.db.clientes.find((x) => x.id === a.cliente);
  const p = ctx.db.personas.find((x) => x.id === a.responsable);
  const ev = estatusVisible(a);
  const venc = a.fecha < hoy && a.estatus !== 'hecho';
  return html`<div class=${'pfila' + (a.estatus === 'hecho' ? ' hecha' : '') + (arr?.datos?.actividad === a.id ? ' fantasma' : '')} style=${`--c:${c?.color}`}
    tabindex="0" role="button" aria-label=${a.titulo} onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
    <button class="anillo-mini" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${`Estatus: ${ESTATUS.find((s) => s.id === ev)?.nombre}. Avanzar`}><${Anillo} estatus=${ev} /></button>
    <span class="pf-t">${a.titulo}</span>
    <span class="pf-cli"><i class="bolita"></i>${c?.nombre}</span>
    ${(todos || a.responsable !== ctx.yo) ? html`<${Avatar} p=${p} />` : html`<span class="pf-av-vacio"></span>`}
    <span class=${'pf-f num' + (venc ? ' rojo' : '')}>${fechaRelativa(a.fecha)}</span>
  </div>`;
}

// ---------- Minutas ----------
function TarjetaMinuta({ m, ctx }) {
  const c = ctx.db.clientes.find((x) => x.id === m.cliente);
  const sinTarea = m.acuerdos.filter((k) => !k.tarea).length;
  return html`<button class="pm-card" style=${`--c:${c?.color}`} onClick=${() => ctx.abrirMinuta(m.id)}>
    <span class="pm-cli"><i class="bolita"></i>${c?.nombre}<em>${haceCuanto(m.fecha)}</em></span>
    <b>${m.titulo}</b>
    <span class=${'pm-ac' + (sinTarea ? ' pend' : '')}>${sinTarea ? `${sinTarea} ${sinTarea === 1 ? 'acuerdo' : 'acuerdos'} sin tarea` : html`${I('check')}Todo asignado`}</span>
  </button>`;
}

export function HojaMinuta({ id, ctx, cerrar }) {
  const m = ctx.db.minutas.find((x) => x.id === id);
  if (!m) return null;
  const c = ctx.db.clientes.find((x) => x.id === m.cliente);
  const pend = (m.acuerdos || []).filter((k) => !k.tarea);
  const crearUna = (k) => { acuerdoATarea(m.id, k.id, ctx.yo); };
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="hoja hoja-minuta" role="dialog" aria-modal="true" aria-label=${m.titulo} style=${`--c:${c?.color}`}>
      <div class="hoja-asa"></div>
      <div class="hm-cab">
        <span class="pm-cli"><i class="bolita"></i>${c?.nombre}<em>${new Date(m.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</em></span>
        <h2 class="hoja-t">${m.titulo}</h2>
        <span class="hm-asis">${(m.asistentes || []).map((pid) => html`<${Avatar} key=${pid} p=${ctx.db.personas.find((p) => p.id === pid)} />`)}</span>
      </div>
      <p class="hm-res">${m.resumen || (m.fuente === 'notion' ? 'Esta minuta vive en Notion; ábrela para ver el detalle completo.' : '')}</p>
      ${m.fuente === 'notion' && (m.tareasNotion || []).length > 0 && html`<div class="hm-ac-cab"><span>Tareas que salieron de esta junta</span></div>
        <ul class="ca-lista">${(m.tareasNotion || []).map((nid) => ctx.db.actividades.find((a) => a.notion === nid)).filter(Boolean).map((a) => html`<li key=${a.id}><button onClick=${() => { cerrar(); ctx.abrir(a.id); }}><span class="cl-t">${a.titulo}</span><span class="num cl-f">${fechaRelativa(a.fecha)}</span></button></li>`)}</ul>`}
      <div class="hm-ac-cab"><span>Acuerdos</span>
        ${pend.length > 1 && html`<button class="btn chico" onClick=${() => { pend.forEach(crearUna); ctx.toast(`${pend.length} tareas creadas`); }}>${I('mas')}Crear todas</button>`}</div>
      <ul class="hm-acuerdos">${(m.acuerdos || []).map((k) => {
        const p = ctx.db.personas.find((x) => x.id === k.responsable);
        return html`<li key=${k.id}>
          <${Avatar} p=${p} />
          <div class="hm-k"><span>${k.texto}</span>${k.detalle && html`<em class="hm-det">${k.detalle}</em>`}<small>${p?.corto} · ${fechaRelativa(k.fecha)}</small></div>
          ${k.tarea ? html`<button class="hm-ok" onClick=${() => { cerrar(); ctx.abrir(k.tarea); }} title="Ver tarea">${I('check')}Tarea</button>`
            : html`<button class="btn chico prim" onClick=${() => { crearUna(k); ctx.toast(`Tarea creada para ${p?.corto}`); }}>Crear tarea</button>`}
        </li>`;
      })}</ul>
      <p class="hm-origen">${m.fuente === 'notion' ? html`${I('externo')}Viene de Master Minutas en Notion.${m.notion && html` <a href=${m.notion} target="_blank" rel="noopener">Abrir en Notion</a>`}${m.docs && html` · <a href=${m.docs} target="_blank" rel="noopener">Abrir el documento</a>`}` : html`${I('correo')}${m.origen ? html`Se armó sola con las notas que llegaron a tu correo. <a href=${m.origen} target="_blank" rel="noopener">Abrir correo</a>` : html`Se armó sola con la transcripción que llegó al correo. <span class="demo-tag">demo</span>`}`}</p>
    </div>`;
}
