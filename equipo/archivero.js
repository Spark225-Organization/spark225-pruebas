// Clientes: cada cliente con su logo y su semáforo de entrega a tiempo.
// Al abrirlo ves todo lo suyo: datos, materiales, proyectos, tareas, minutas y quién lleva qué.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, CARITAS, ETAPAS_CLIENTE, PRIORIDADES } from './datos.js?v=202611261500';
import { vigentes, visiblePara, participa, estatusVisible, actualizarCliente, calificar, avanceProyecto, guardarPrefs, prefsDe, cumplimientoCliente, VENTANA_DIAS } from './store.js?v=202611261500';
import { I, Anillo, Avatar, LogoCliente, fechaRelativa, haceCuanto } from './ui.js?v=202611261500';

const ORDEN_SALUD = { riesgo: 0, atencion: 1, bien: 2 };
export const NOMBRE_SALUD = { bien: 'Va bien', atencion: 'Atención', riesgo: 'En riesgo' };
const ultimaSat = (c) => c.satisfaccion?.length ? c.satisfaccion[c.satisfaccion.length - 1].valor : 0;
const PRI = Object.fromEntries(PRIORIDADES.map((p) => [p.id, p.nombre]));

// Chip del semáforo: color + texto + forma, nunca solo color.
export function Semaforo({ cu, corto }) {
  if (cu.pct === null) return html`<span class="sema s-nada"><i></i>${corto ? 'Sin entregas' : `Sin entregas en ${VENTANA_DIAS} días`}</span>`;
  return html`<span class=${'sema s-' + cu.salud}><i></i><b class="num">${cu.pct} %</b>${corto ? '' : ` a tiempo · ${NOMBRE_SALUD[cu.salud]}`}</span>`;
}

export function Archivero({ ctx }) {
  const { db, yo } = ctx;
  const prefs = prefsDe(yo);
  const [solo, setSolo] = useState(false);
  const [etapa, setEtapa] = useState(prefs.clientesEtapa || 'activo');
  const hoy = hoyISO();
  const abiertas = vigentes().filter((a) => a.estatus !== 'hecho' && visiblePara(a, yo));
  const visibles = db.clientes.filter((c) => !c.privado && (!solo || c.responsable === yo));
  const porEtapa = (e) => visibles.filter((c) => (c.etapa || 'activo') === e);
  const lista = porEtapa(etapa).map((c) => ({ c, cu: cumplimientoCliente(c.id, hoy) }))
    .sort((a, b) => (ORDEN_SALUD[a.cu.salud] ?? 3) - (ORDEN_SALUD[b.cu.salud] ?? 3) || a.c.nombre.localeCompare(b.c.nombre));
  const elegirEtapa = (e) => { setEtapa(e); guardarPrefs(yo, { clientesEtapa: e }); };

  return html`
    <header class="cab-inicio">
      <div class="cab-dia"><h1>Clientes</h1><span class="sub num">${visibles.length} en total</span></div>
      <div class="segmentado" role="tablist">
        <button aria-pressed=${!solo} onClick=${() => setSolo(false)}>Todos</button>
        <button aria-pressed=${solo} onClick=${() => setSolo(true)}>Los que llevo</button>
      </div>
    </header>
    <div class="cli-etapas" role="tablist" aria-label="Etapa">
      ${ETAPAS_CLIENTE.map((e) => html`<button key=${e.id} role="tab" aria-selected=${etapa === e.id} onClick=${() => elegirEtapa(e.id)}>${e.nombre}<span class="num">${porEtapa(e.id).length}</span></button>`)}
    </div>
    ${etapa === 'activo' && html`<p class="cli-regla">El semáforo sale solo de la entrega a tiempo de los últimos ${VENTANA_DIAS} días, con más peso a lo de prioridad alta: <span class="sema s-bien"><i></i>95 % o más</span> <span class="sema s-atencion"><i></i>85 a 94 %</span> <span class="sema s-riesgo"><i></i>menos de 85 %</span></p>`}
    <div class="cli-grid" data-tour="archivero">
      ${lista.map(({ c, cu }) => {
        const suyas = abiertas.filter((a) => a.cliente === c.id);
        const venc = suyas.filter((a) => a.fecha < hoy).length;
        const r = db.personas.find((p) => p.id === c.responsable);
        const sat = ultimaSat(c);
        return html`<a key=${c.id} href=${'#/cliente/' + c.id} class="cli-card" style=${`--c:${c.color}`}>
          <div class="cc-top"><${LogoCliente} c=${c} tam="l" /><${Avatar} p=${r} /></div>
          <b class="cc-nombre">${c.nombre}</b>
          ${etapa === 'activo' ? html`<${Semaforo} cu=${cu} corto />` : html`<span class="sema s-nada"><i></i>${ETAPAS_CLIENTE.find((e) => e.id === etapa).uno}</span>`}
          <span class="cc-pie num">${suyas.length} ${suyas.length === 1 ? 'pendiente' : 'pendientes'}${venc ? html`<em>${venc} ${venc === 1 ? 'vencida' : 'vencidas'}</em>` : null}${sat ? html`<span class="cc-sat" title="Satisfacción">${CARITAS[sat - 1]}</span>` : null}</span>
        </a>`;
      })}
      <button class="cli-card nueva" onClick=${() => ctx.crear('cliente')}>
        <span class="cc-mas">${I('mas')}</span><b class="cc-nombre">Nuevo cliente</b>
      </button>
    </div>`;
}

// Reduce el logo a 160 px para guardarlo junto al cliente (sin depender de Drive).
function leerLogo(archivo) {
  return new Promise((ok, mal) => {
    if (!archivo || !/^image\//.test(archivo.type)) return mal(new Error('Elige una imagen (PNG, JPG o SVG).'));
    const img = new Image();
    img.onload = () => {
      const lado = 160, k = Math.min(1, lado / Math.max(img.width, img.height));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k) || lado, height: Math.round(img.height * k) || lado });
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      ok(cv.toDataURL('image/webp', 0.9));
    };
    img.onerror = () => mal(new Error('No pude leer esa imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

// ---------- Ficha del cliente ----------
export function DetalleCliente({ id, ctx }) {
  const { db, yo } = ctx;
  const c = db.clientes.find((x) => x.id === id);
  const [editando, setEditando] = useState(false);
  if (!c) return html`<div class="vacio">${I('clientes')}<p>Ese cliente ya no está.</p><a class="btn" href="#/clientes">Volver a Clientes</a></div>`;
  const hoy = hoyISO();
  const todas = vigentes().filter((a) => a.cliente === c.id && visiblePara(a, yo));
  const abiertas = todas.filter((a) => a.estatus !== 'hecho');
  const venc = abiertas.filter((a) => a.fecha < hoy);
  const hechas = todas.length - abiertas.length;
  const pct = todas.length ? Math.round((hechas / todas.length) * 100) : 0;
  const proyectos = db.proyectos.filter((p) => p.cliente === c.id);
  const cu = cumplimientoCliente(c.id, hoy);
  const sat = ultimaSat(c);
  const hist = (c.satisfaccion || []).slice(-6);
  const yaCalificado = hist.some((s) => s.fecha === hoy);
  const minutas = db.minutas.filter((m) => m.cliente === c.id);
  const r = db.personas.find((p) => p.id === c.responsable);
  const C = 2 * Math.PI * 30;
  const verPipeline = (persona) => { guardarPrefs(yo, { pipeCliente: c.id, pipePersona: persona || 'todos' }); location.hash = '#/pipeline'; };
  const mes = (iso) => new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(iso + 'T12:00:00')).replace('.', '');
  // Materiales: los enlaces del cliente y los que traen sus tareas (sin repetir y sin los de Notion).
  const deTareas = todas.flatMap((a) => (a.enlaces || []).filter((l) => l.id !== 'notion').map((l) => ({ ...l, tarea: a })));
  const materiales = [...(c.enlaces || []), ...deTareas.filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i && !(c.enlaces || []).some((x) => x.url === l.url))];
  const subirLogo = async (e) => {
    try { actualizarCliente(c.id, { logo: await leerLogo(e.target.files[0]) }, yo); ctx.toast('Logo actualizado'); }
    catch (err) { ctx.toast(err.message); }
    e.target.value = '';
  };

  return html`<div class="ficha-cli" style=${`--c:${c.color}`}>
    <header class="fc-cab">
      <a class="ca-volver" href="#/clientes">${I('flecha')}Clientes</a>
      <div class="fc-id">
        <label class="fc-logo" title="Cambiar logo">
          <${LogoCliente} c=${c} tam="xl" />
          <span class="fc-logo-btn">${I('subir')}<span>${c.logo ? 'Cambiar logo' : 'Subir logo'}</span></span>
          <input type="file" accept="image/*" class="oculto" onChange=${subirLogo} />
        </label>
        <div class="fc-tit">
          <h1>${c.nombre}</h1>
          <div class="fc-meta">
            <select class="control chico" value=${c.etapa || 'activo'} aria-label="Etapa" onChange=${(e) => { actualizarCliente(c.id, { etapa: e.target.value }, yo); ctx.toast(`${c.nombre}: ${ETAPAS_CLIENTE.find((x) => x.id === e.target.value).uno}`); }}>
              ${ETAPAS_CLIENTE.map((e) => html`<option key=${e.id} value=${e.id}>${e.uno}</option>`)}
            </select>
            <span class="ca-quien"><${Avatar} p=${r} />${r ? `Lleva la cuenta ${r.id === yo ? 'tú' : r.corto}` : ''}</span>
          </div>
        </div>
      </div>
      <div class="ca-acc">
        <button class="btn" onClick=${() => ctx.crear('proyecto', { cliente: c.id })}>${I('proyectos')}Proyecto</button>
        <button class="btn prim" onClick=${() => ctx.crear('tarea', { cliente: c.id })}>${I('mas')}Tarea</button>
      </div>
    </header>

    <div class="ca-resumen">
      <section class=${'ca-panel fc-entrega s-' + (cu.salud || 'nada')}>
        <h3>Entrega a tiempo<small>últimos ${VENTANA_DIAS} días</small></h3>
        <div class="fc-pct">
          <b class="num">${cu.pct === null ? '—' : cu.pct + ' %'}</b>
          ${cu.salud && html`<span class=${'sema s-' + cu.salud}><i></i>${NOMBRE_SALUD[cu.salud]}</span>`}
        </div>
        <p class="fc-expl">${cu.pct === null ? 'Aún no vence ninguna tarea de este cliente en el periodo.' : html`${cu.nATiempo} de ${cu.evaluadas.length} a tiempo. Lo de prioridad alta pesa el triple que lo de baja.`}</p>
        ${cu.tarde.length > 0 && html`<ul class="fc-tarde">${cu.tarde.slice(0, 4).map((x) => html`<li key=${x.a.id}><button onClick=${() => ctx.abrir(x.a.id)}>
          <span class="cl-t">${x.a.titulo}</span><span class=${'pri-txt pri-' + (x.a.prioridad || 'media')}>${PRI[x.a.prioridad] || 'Media'}</span><span class="num rojo">${x.diasTarde} d</span></button></li>`)}</ul>`}
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
      <section class="ca-bloque fc-datos">
        <h3>Datos del cliente<button class="enlace" onClick=${() => setEditando(!editando)}>${editando ? 'Listo' : 'Editar'}</button></h3>
        ${editando ? html`<${EditarDatos} c=${c} yo=${yo} />` : html`<dl>
          <div><dt>Carpeta de Drive</dt><dd>${c.drive ? html`<a href=${c.drive} target="_blank" rel="noopener">${I('drive')}Abrir carpeta</a>` : html`<span class="tenue">Sin carpeta</span>`}</dd></div>
          <div><dt>Sitio web</dt><dd>${c.web ? html`<a href=${c.web} target="_blank" rel="noopener">${c.web.replace(/^https?:\/\/(www\.)?/, '')}</a>` : html`<span class="tenue">—</span>`}</dd></div>
          <div><dt>Contacto</dt><dd>${c.contacto || html`<span class="tenue">—</span>`}</dd></div>
          <div><dt>Giro</dt><dd>${c.giro || html`<span class="tenue">—</span>`}</dd></div>
          ${c.notasCliente && html`<div class="ancho"><dt>Notas</dt><dd>${c.notasCliente}</dd></div>`}
        </dl>`}
      </section>

      <section class="ca-bloque">
        <h3>Materiales y enlaces<span class="num">${materiales.length}</span></h3>
        ${materiales.length === 0 ? html`<p class="ca-vacio">Pega aquí la carpeta de Drive del cliente (en Editar) o agrega enlaces a sus tareas.</p>`
          : html`<ul class="ca-lista">${materiales.slice(0, 10).map((l) => html`<li key=${l.url}><a class="fila-enlace" href=${l.url} target="_blank" rel="noopener">
            ${I(/drive|docs\.google/.test(l.url) ? 'drive' : 'enlace')}<span class="cl-t">${l.titulo}</span><span class="cl-f">${l.tarea ? l.tarea.titulo : 'Del cliente'}</span></a></li>`)}</ul>`}
      </section>

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
  </div>`;
}

function EditarDatos({ c, yo }) {
  const campo = (k, etiqueta, ph, tipo = 'text') => html`<label class="campo"><span>${etiqueta}</span>
    <input class="control" type=${tipo} placeholder=${ph} value=${c[k] || ''} onChange=${(e) => actualizarCliente(c.id, { [k]: e.target.value.trim() || null }, yo)} /></label>`;
  return html`<div class="fc-editar">
    ${campo('drive', 'Carpeta de Drive', 'https://drive.google.com/…', 'url')}
    ${campo('web', 'Sitio web', 'https://…', 'url')}
    ${campo('contacto', 'Contacto', 'Nombre y puesto')}
    ${campo('giro', 'Giro', 'Ej. Farmacéutica, oncología')}
    <label class="campo"><span>Notas</span><textarea class="control" rows="2" value=${c.notasCliente || ''} onChange=${(e) => actualizarCliente(c.id, { notasCliente: e.target.value.trim() || null }, yo)}></textarea></label>
  </div>`;
}
