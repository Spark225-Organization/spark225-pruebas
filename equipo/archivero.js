// Archivero de clientes: cada cliente es una carpeta. Al abrirla ves cómo va la cuenta,
// qué tan contento está, el avance de sus proyectos y qué le toca a cada quien.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, SALUD, CARITAS } from './datos.js?v=202611252130';
import { vigentes, visiblePara, participa, estatusVisible, actualizarCliente, calificar, avanceProyecto, guardarPrefs } from './store.js?v=202611252130';
import { I, Anillo, Avatar, fechaRelativa, haceCuanto } from './ui.js?v=202611252130';

const ORDEN_SALUD = { riesgo: 0, atencion: 1, bien: 2 };
const ultimaSat = (c) => c.satisfaccion?.length ? c.satisfaccion[c.satisfaccion.length - 1].valor : 0;
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Archivero({ ctx }) {
  const { db, yo } = ctx;
  const [solo, setSolo] = useState(false);
  const [abriendo, setAbriendo] = useState(null);
  const hoy = hoyISO();
  const abiertas = vigentes().filter((a) => a.estatus !== 'hecho' && visiblePara(a, yo));
  const lista = db.clientes.filter((c) => !c.privado && (!solo || c.responsable === yo))
    .sort((a, b) => (ORDEN_SALUD[a.salud] ?? 3) - (ORDEN_SALUD[b.salud] ?? 3) || a.nombre.localeCompare(b.nombre));
  const abrir = (e, c) => {
    e.preventDefault();
    if (reducido()) { location.hash = '#/cliente/' + c.id; return; }
    setAbriendo(c.id);
    setTimeout(() => { location.hash = '#/cliente/' + c.id; }, 380);
  };
  return html`
    <header class="cab-inicio">
      <div class="cab-dia"><h1>Clientes</h1><span class="sub num">${lista.length} carpetas</span></div>
      <div class="segmentado" role="tablist">
        <button aria-pressed=${!solo} onClick=${() => setSolo(false)}>Todos</button>
        <button aria-pressed=${solo} onClick=${() => setSolo(true)}>Los que llevo</button>
      </div>
    </header>
    <div class="archivero" data-tour="archivero">
      ${lista.map((c, k) => {
        const suyas = abiertas.filter((a) => a.cliente === c.id);
        const venc = suyas.filter((a) => a.fecha < hoy).length;
        const r = db.personas.find((p) => p.id === c.responsable);
        const sat = ultimaSat(c);
        const papeles = Math.min(3, Math.max(1, Math.ceil(suyas.length / 2)));
        return html`<a key=${c.id} href=${'#/cliente/' + c.id} class=${'folder' + (abriendo === c.id ? ' abriendo' : '')} style=${`--c:${c.color};--k:${k}`} onClick=${(e) => abrir(e, c)}>
          <span class="f-tab"><i class=${'semaforo s-' + c.salud}></i></span>
          ${Array.from({ length: papeles }).map((_, i) => html`<span key=${i} class=${'f-papel p' + (i + 1)}></span>`)}
          <span class="f-frente">
            <b class="f-nombre">${c.nombre}</b>
            <span class="f-pie">
              <span class="f-pend num">${suyas.length}<small>${suyas.length === 1 ? 'pendiente' : 'pendientes'}</small>${venc ? html`<em>${venc} ${venc === 1 ? 'vencida' : 'vencidas'}</em>` : null}</span>
              <span class="f-der">${sat ? html`<span class="f-sat" title="Satisfacción">${CARITAS[sat - 1]}</span>` : null}<${Avatar} p=${r} /></span>
            </span>
          </span>
        </a>`;
      })}
      <button class="folder nueva" onClick=${() => ctx.crear('cliente')} aria-label="Nuevo cliente">
        <span class="f-tab"></span><span class="f-frente"><span class="f-mas">${I('mas')}</span><b class="f-nombre">Nuevo cliente</b></span>
      </button>
    </div>`;
}

// ---------- Carpeta abierta ----------
export function DetalleCliente({ id, ctx }) {
  const { db, yo } = ctx;
  const c = db.clientes.find((x) => x.id === id);
  if (!c) return html`<div class="vacio">${I('carpeta')}<p>Ese cliente ya no está.</p><a class="btn" href="#/clientes">Volver al archivero</a></div>`;
  const hoy = hoyISO();
  const todas = vigentes().filter((a) => a.cliente === c.id && visiblePara(a, yo));
  const abiertas = todas.filter((a) => a.estatus !== 'hecho');
  const venc = abiertas.filter((a) => a.fecha < hoy);
  const hechas = todas.length - abiertas.length;
  const pct = todas.length ? Math.round((hechas / todas.length) * 100) : 0;
  const proyectos = db.proyectos.filter((p) => p.cliente === c.id);
  const sat = ultimaSat(c);
  const hist = (c.satisfaccion || []).slice(-6);
  const yaCalificado = hist.some((s) => s.fecha === hoy);
  const minutas = db.minutas.filter((m) => m.cliente === c.id);
  const r = db.personas.find((p) => p.id === c.responsable);
  const C = 2 * Math.PI * 30;
  const verPipeline = (persona) => { guardarPrefs(yo, { pipeCliente: c.id, pipePersona: persona || 'todos' }); location.hash = '#/pipeline'; };
  const mes = (iso) => new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(iso + 'T12:00:00')).replace('.', '');

  return html`<div class="carpeta-abierta" style=${`--c:${c.color}`}>
    <header class="ca-cab">
      <a class="ca-volver" href="#/clientes">${I('flecha')}Archivero</a>
      <div class="ca-tit">
        <span class="ca-tab"></span>
        <h1>${c.nombre}</h1>
        <span class="ca-quien"><${Avatar} p=${r} />${r ? `Lleva la cuenta ${r.id === yo ? 'tú' : r.corto}` : ''}</span>
      </div>
      <div class="ca-acc">
        <button class="btn" onClick=${() => ctx.crear('proyecto', { cliente: c.id })}>${I('proyectos')}Proyecto</button>
        <button class="btn prim" onClick=${() => ctx.crear('tarea', { cliente: c.id })}>${I('mas')}Tarea</button>
      </div>
    </header>

    <div class="ca-resumen">
      <section class="ca-panel">
        <h3>Cómo va la cuenta</h3>
        <div class="ca-salud" role="radiogroup" aria-label="Estado general">
          ${SALUD.map((s) => html`<button key=${s.id} role="radio" aria-checked=${c.salud === s.id} class=${'s-' + s.id} onClick=${() => { actualizarCliente(c.id, { salud: s.id }, yo); ctx.toast(`${c.nombre}: ${s.nombre}`); }}><i class="semaforo"></i>${s.nombre}</button>`)}
        </div>
      </section>

      <section class="ca-panel">
        <h3>Satisfacción</h3>
        <div class="ca-sat">
          <span class="ca-sat-grande">${sat ? CARITAS[sat - 1] : '·'}</span>
          <div class="ca-hist" aria-label="Historial de satisfacción">${hist.map((s, k) => html`<span key=${k} title=${s.fecha}><i style=${`height:${s.valor * 7}px`}></i><small>${mes(s.fecha)}</small></span>`)}</div>
        </div>
        <div class="ca-calificar" role="radiogroup" aria-label=${yaCalificado ? 'Cambiar la calificación de hoy' : 'Calificar hoy'}>
          ${CARITAS.map((x, k) => html`<button key=${k} role="radio" aria-checked=${yaCalificado && sat === k + 1} aria-label=${`${k + 1} de 5`} onClick=${() => { calificar(c.id, k + 1, yo); ctx.toast('Satisfacción guardada'); }}>${x}</button>`)}
        </div>
      </section>

      <section class="ca-panel ca-avance">
        <h3>Avance</h3>
        <div class="ca-anillo">
          <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label=${`${pct}% hecho`}>
            <circle cx="38" cy="38" r="30" fill="none" stroke="var(--grafito)" stroke-width="8" />
            <circle cx="38" cy="38" r="30" fill="none" stroke="var(--c)" stroke-width="8" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - pct / 100)} transform="rotate(-90 38 38)" />
            <text x="38" y="43" text-anchor="middle" class="anillo-num">${pct}%</text>
          </svg>
          <div class="ca-cifras num"><span><b>${abiertas.length}</b> abiertas</span><span class=${venc.length ? 'rojo' : ''}><b>${venc.length}</b> vencidas</span><span><b>${hechas}</b> hechas</span></div>
        </div>
      </section>
    </div>

    <div class="ca-cuerpo">
      <section class="ca-bloque">
        <h3>Proyectos<span class="num">${proyectos.length}</span></h3>
        <ul class="ca-proyectos">${proyectos.map((p) => {
          const av = avanceProyecto(p.id);
          const rp = db.personas.find((x) => x.id === p.responsable);
          return html`<li key=${p.id}>
            <div class="cp-t"><b>${p.nombre}</b><small>${p.entrega ? `Entrega ${fechaRelativa(p.entrega)}` : 'Sin fecha de entrega'}</small></div>
            <span class="cp-barra" title=${`${av.hechas} de ${av.total}`}><i style=${`width:${av.total ? (av.hechas / av.total) * 100 : 0}%`}></i></span>
            <span class="cp-n num">${av.hechas}/${av.total}</span>
            <${Avatar} p=${rp} />
          </li>`;
        })}</ul>
      </section>

      <section class="ca-bloque">
        <h3>Qué le toca a cada quien</h3>
        <div class="ca-personas">${db.personas.map((p) => {
          const suyas = abiertas.filter((a) => participa(a, p.id));
          const v = suyas.filter((a) => a.fecha < hoy).length;
          return html`<button key=${p.id} class="ca-per" onClick=${() => verPipeline(p.id === yo ? 'yo' : p.id)} disabled=${!suyas.length}>
            <${Avatar} p=${p} grande /><span>${p.id === yo ? 'Tú' : p.corto}</span><b class="num">${suyas.length}</b>${v ? html`<em class="num">${v} ${v === 1 ? 'vencida' : 'vencidas'}</em>` : null}</button>`;
        })}</div>
      </section>

      <section class="ca-bloque ca-pend">
        <h3>Lo que sigue<button class="enlace" onClick=${() => verPipeline()}>Ver en pipeline</button></h3>
        ${abiertas.length === 0 ? html`<p class="ca-vacio">Sin pendientes. ${I('check')}</p>` : html`<ul class="ca-lista">${[...abiertas].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6).map((a) => {
          const p = db.personas.find((x) => x.id === a.responsable);
          const ev = estatusVisible(a);
          return html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}>
            <span class="anillo-mini"><${Anillo} estatus=${ev} /></span><span class="cl-t">${a.titulo}</span><${Avatar} p=${p} />
            <span class=${'num cl-f' + (a.fecha < hoy ? ' rojo' : '')}>${fechaRelativa(a.fecha)}</span></button></li>`;
        })}</ul>`}
      </section>

      <section class="ca-bloque">
        <h3>Minutas<span class="num">${minutas.length}</span></h3>
        ${minutas.length === 0 ? html`<p class="ca-vacio">Cuando llegue la transcripción de una junta con ${c.nombre}, aparece aquí.</p>`
          : html`<ul class="ca-lista">${minutas.map((m) => html`<li key=${m.id}><button onClick=${() => ctx.abrirMinuta(m.id)}>
            ${I('nota')}<span class="cl-t">${m.titulo}</span><span class="num cl-f">${haceCuanto(m.fecha)}</span></button></li>`)}</ul>`}
      </section>
    </div>
    <p class="ca-nota">El estado y la satisfacción de esta demo son de ejemplo.</p>
  </div>`;
}
