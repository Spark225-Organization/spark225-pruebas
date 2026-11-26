// Clientes: cada cliente con su logo y su semáforo de entrega a tiempo.
// Al abrirlo ves todo lo suyo: datos, materiales, proyectos, tareas, minutas y quién lleva qué.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, CARITAS, ETAPAS_CLIENTE, PRIORIDADES, SALUD_PROYECTO, FASES_PROYECTO } from './datos.js?v=202611270800';
import { vigentes, visiblePara, participa, estatusVisible, actualizarCliente, calificar, avanceProyecto, guardarPrefs, prefsDe, cumplimientoCliente, VENTANA_DIAS, saludProyecto } from './store.js?v=202611270800';
import { I, Anillo, Avatar, LogoCliente, Info, Carita, fechaRelativa, haceCuanto, Migas } from './ui.js?v=202611270800';
import { NavClientes, ChipSalud } from './proyectos.js?v=202611270800';
const FASE_NOMBRE = Object.fromEntries(FASES_PROYECTO.map((f) => [f.id, f.nombre]));

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
      <div class="cab-dia"><h1>Clients</h1><span class="sub num">${visibles.length} en total</span></div>
      <${NavClientes} actual="clientes" />
    </header>
    <div class="ls-barra"><label class="ls-hechas"><input type="checkbox" checked=${solo} onChange=${() => setSolo(!solo)} />Solo los que llevo</label></div>
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
        const ps = db.proyectos.filter((p) => p.cliente === c.id && !p.id.startsWith('g-') && (p.fase || 'en_curso') !== 'terminado');
        const enR = ps.filter((p) => saludProyecto(p, hoy).salud === 'en_riesgo').length;
        return html`<a key=${c.id} href=${'#/cliente/' + c.id} class="cli-card" style=${`--c:${c.color}`}>
          <div class="cc-top"><${LogoCliente} c=${c} tam="l" /><${Avatar} p=${r} /></div>
          <b class="cc-nombre">${c.nombre}</b>
          ${ps.length > 0 && html`<span class="cc-proy">${ps.length} ${ps.length === 1 ? 'proyecto' : 'proyectos'}${enR ? html` · <em>${enR} en riesgo</em>` : ''}</span>`}
          ${etapa === 'activo' ? html`<${Semaforo} cu=${cu} corto />` : html`<span class="sema s-nada"><i></i>${ETAPAS_CLIENTE.find((e) => e.id === etapa).uno}</span>`}
          <span class="cc-pie num">${suyas.length} ${suyas.length === 1 ? 'pendiente' : 'pendientes'}${venc ? html`<em>${venc} ${venc === 1 ? 'vencida' : 'vencidas'}</em>` : null}${sat ? html`<span class="cc-sat" title="Satisfacción"><${Carita} n=${sat} tam=${20} /></span>` : null}</span>
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
  const [pest, setPest] = useState(prefsDe(yo).fichaPest || 'proyectos');
  const elegirPest = (k) => { setPest(k); guardarPrefs(yo, { fichaPest: k }); };
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
  const hitosCli = (db.hitos || []).filter((h) => h.cliente === c.id).sort((a, b) => (a.estado === 'cumplido') - (b.estado === 'cumplido') || (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999'));
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
      <${Migas} partes=${[{ t: 'Clients', href: '#/clientes' }, { t: c.nombre }]} />
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

    <div class="segmentado fc-pest" role="tablist" aria-label="Secciones del cliente">${[['proyectos', 'Proyectos', 'proyectos', proyectos.filter((p) => !p.id.startsWith('g-') && p.fase !== 'terminado').length], ['resumen', 'Resumen', 'grafica'], ['hitos', 'Hitos', 'mapa', hitosCli.length], ['minutas', 'Minutas', 'nota', minutas.length], ['materiales', 'Materiales', 'carpeta', materiales.length]]
      .map(([k, t, ico, n]) => html`<button key=${k} role="tab" aria-selected=${pest === k} aria-pressed=${pest === k} onClick=${() => elegirPest(k)}>${I(ico)}<span>${t}</span>${n !== undefined ? html`<span class="num pp-n">${n}</span>` : null}</button>`)}</div>

    ${pest === 'proyectos' && html`<${ArbolProyectos} c=${c} ctx=${ctx} abiertas=${abiertas} proyectos=${proyectos} hoy=${hoy} />`}

    ${pest === 'resumen' && html`
    <div class="ca-resumen">
      <section class=${'ca-panel fc-entrega s-' + (cu.salud || 'nada')}>
        <h3>Entrega a tiempo<small>últimos ${VENTANA_DIAS} días</small> <${Info} t="De las tareas de este cliente que vencieron en los últimos 30 días, cuántas se cerraron a tiempo. Alta pesa 3, Media 2, Baja 1. Si la fecha la movió el cliente, cuenta la nueva. Verde: 95 % o más · amarillo: 85 a 94 % · rojo: menos de 85 %." /></h3>
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
          <span class="ca-sat-grande"><${Carita} n=${sat} tam=${52} /></span>
          <div class="ca-hist" aria-label="Historial de satisfacción">${hist.map((s, k) => html`<span key=${k} title=${s.fecha}><i style=${`height:${s.valor * 7}px`}></i><small>${mes(s.fecha)}</small></span>`)}</div>
        </div>
        <div class="ca-calificar" role="radiogroup" aria-label=${yaCalificado ? 'Cambiar la calificación de hoy' : 'Calificar hoy'}>
          ${CARITAS.map((x, k) => html`<button key=${k} role="radio" aria-checked=${yaCalificado && sat === k + 1} aria-label=${`${k + 1} de 5`} onClick=${() => { calificar(c.id, k + 1, yo); ctx.toast('Satisfacción guardada'); }}><${Carita} n=${k + 1} tam=${26} /></button>`)}
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
        <h3>Qué le toca a cada quien</h3>
        <div class="ca-personas">${db.personas.map((p) => {
          const suyas = abiertas.filter((a) => participa(a, p.id));
          const v = suyas.filter((a) => a.fecha < hoy).length;
          return html`<button key=${p.id} class="ca-per" onClick=${() => verPipeline(p.id === yo ? 'yo' : p.id)} disabled=${!suyas.length}>
            <${Avatar} p=${p} grande /><span>${p.id === yo ? 'Tú' : p.corto}</span><b class="num">${suyas.length}</b>${v ? html`<em class="num">${v} ${v === 1 ? 'vencida' : 'vencidas'}</em>` : null}</button>`;
        })}</div>
      </section>
    </div>`}

    ${pest === 'hitos' && html`<section class="ca-bloque">${hitosCli.length ? html`<ul class="ca-lista">${hitosCli.map((h) => { const p = db.proyectos.find((x) => x.id === h.proyecto); const tarde = h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna < hoy;
        return html`<li key=${h.id}><a class="fila-enlace" href=${p ? '#/proyecto/' + p.id : '#/hitos'}>${I(h.estado === 'cumplido' ? 'check' : 'mapa')}<span class="cl-t">${h.nombre}</span><span class="cl-f">${p?.nombre || ''}</span><span class=${'num cl-f' + (tarde ? ' rojo' : '')}>${h.fechaInterna ? fechaRelativa(h.fechaInterna) : '—'}</span></a></li>`; })}</ul>`
        : html`<p class="ca-vacio">Sin hitos en Notion para ${c.nombre}.</p>`}</section>`}

    ${pest === 'minutas' && html`<div class="ca-cuerpo">
      <section class="ca-bloque">
        <h3>Minutas<span class="num">${minutas.length}</span></h3>
        ${minutas.length === 0 ? html`<p class="ca-vacio">Cuando llegue la transcripción de una junta con ${c.nombre}, aparece aquí.</p>`
          : html`<ul class="ca-lista">${minutas.map((m) => html`<li key=${m.id}><button onClick=${() => ctx.abrirMinuta(m.id)}>
            ${I('nota')}<span class="cl-t">${m.titulo}</span><span class="num cl-f">${haceCuanto(m.fecha)}</span></button></li>`)}</ul>`}
      </section>
    </div>`}

    ${pest === 'materiales' && html`<div class="ca-cuerpo">
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
    </div>`}
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

// ---------- Proyectos del cliente con sus tareas (cliente → proyectos → tareas) ----------
function ArbolProyectos({ c, ctx, abiertas, proyectos, hoy }) {
  const { db } = ctx;
  const [verTerminados, setVerTerminados] = useState(false);
  const reales = proyectos.filter((p) => !p.id.startsWith('g-'));
  const ordenFecha = (a, b) => (a.sinFecha ? 1 : 0) - (b.sinFecha ? 1 : 0) || (a.fecha || '').localeCompare(b.fecha || '');
  const conSalud = reales.map((p) => ({ p, s: saludProyecto(p, hoy), tareas: abiertas.filter((a) => a.proyecto === p.id).sort(ordenFecha) }));
  const vivos = conSalud.filter((x) => (x.p.fase || 'en_curso') !== 'terminado')
    .sort((a, b) => SALUD_PROYECTO[a.s.salud].orden - SALUD_PROYECTO[b.s.salud].orden || b.tareas.length - a.tareas.length || a.p.nombre.localeCompare(b.p.nombre));
  const terminados = conSalud.filter((x) => x.p.fase === 'terminado');
  const sueltas = abiertas.filter((a) => !a.proyecto || a.proyecto.startsWith('g-') || !reales.some((p) => p.id === a.proyecto)).sort(ordenFecha);
  const [abiertos, setAbiertos] = useState(() => new Set(vivos.filter((x) => x.tareas.length).slice(0, 2).map((x) => x.p.id)));
  const alternar = (id) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fila = (a) => {
    const r = db.personas.find((x) => x.id === a.responsable);
    const v = !a.sinFecha && a.fecha < hoy;
    return html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}>
      <span class="anillo-mini"><${Anillo} estatus=${estatusVisible(a)} /></span><span class="cl-t">${a.titulo}</span><${Avatar} p=${r} />
      <span class=${'num cl-f' + (v ? ' rojo' : '')}>${a.sinFecha ? 'Sin fecha' : fechaRelativa(a.fecha)}</span></button></li>`;
  };
  const hijos = (tareas, proyecto) => html`<div class="ap-hijos">
    ${tareas.length ? html`<ul class="ca-lista">${tareas.map(fila)}</ul>` : html`<p class="ca-vacio">Sin tareas abiertas.</p>`}
    <button class="btn fantasma chico" onClick=${() => ctx.crear('tarea', { cliente: c.id, ...(proyecto ? { proyecto } : {}) })}>${I('mas')}${proyecto ? 'Tarea en este proyecto' : 'Tarea sin proyecto'}</button></div>`;
  const nodo = ({ p, s, tareas }) => {
    const abierto = abiertos.has(p.id);
    const r = db.personas.find((x) => x.id === p.responsable);
    const venc = tareas.filter((a) => !a.sinFecha && a.fecha < hoy).length;
    return html`<li key=${p.id} class=${'ap-proy' + (abierto ? ' abierto' : '')}>
      <div class="ap-cab">
        <button class="ap-toggle" onClick=${() => alternar(p.id)} aria-expanded=${abierto} aria-label=${`${abierto ? 'Ocultar' : 'Ver'} las tareas de ${p.nombre}`}>${I('adelante', abierto ? 'rot-90' : '')}</button>
        <a class="ap-nombre" href=${'#/proyecto/' + p.id}><b>${p.nombre}</b>
          <small>${FASE_NOMBRE[p.fase || 'en_curso']}${p.proximoHito ? ` · Próximo hito: ${p.proximoHito}${p.fechaProximoHito ? ` (${fechaRelativa(p.fechaProximoHito)})` : ''}` : ''}</small></a>
        <${ChipSalud} s=${s.salud} razones=${s.razones} />
        <button class="ap-n num" onClick=${() => alternar(p.id)} title="Tareas abiertas">${tareas.length}<span>${tareas.length === 1 ? 'tarea' : 'tareas'}</span>${venc ? html`<em>${venc} vencidas</em>` : null}</button>
        <${Avatar} p=${r} />
      </div>
      ${abierto && hijos(tareas, p.id)}
    </li>`;
  };
  const abiertoG = abiertos.has('general');
  return html`<section class="ap-arbol">
    <div class="ap-barra"><span class="tenue">${vivos.length} ${vivos.length === 1 ? 'proyecto vigente' : 'proyectos vigentes'} · ${abiertas.length} ${abiertas.length === 1 ? 'tarea abierta' : 'tareas abiertas'}</span>
      <span><button class="enlace" onClick=${() => setAbiertos(new Set([...vivos.map((x) => x.p.id), 'general']))}>Desplegar todo</button>
      <button class="enlace" onClick=${() => setAbiertos(new Set())}>Plegar todo</button></span></div>
    ${!vivos.length && !sueltas.length ? html`<div class="ls-vacia"><p>${c.nombre} aún no tiene proyectos ni tareas abiertas.</p><button class="btn prim" onClick=${() => ctx.crear('proyecto', { cliente: c.id })}>Crear proyecto</button></div>` : html`<ul class="ap-lista">
      ${vivos.map(nodo)}
      ${sueltas.length > 0 && html`<li class=${'ap-proy ap-general' + (abiertoG ? ' abierto' : '')}>
        <div class="ap-cab">
          <button class="ap-toggle" onClick=${() => alternar('general')} aria-expanded=${abiertoG} aria-label=${`${abiertoG ? 'Ocultar' : 'Ver'} las tareas sin proyecto`}>${I('adelante', abiertoG ? 'rot-90' : '')}</button>
          <span class="ap-nombre"><b>General</b><small>Tareas del cliente sin proyecto</small></span>
          <button class="ap-n num" onClick=${() => alternar('general')}>${sueltas.length}<span>${sueltas.length === 1 ? 'tarea' : 'tareas'}</span></button>
        </div>
        ${abiertoG && hijos(sueltas, null)}
      </li>`}
    </ul>`}
    ${terminados.length > 0 && html`<button class="enlace ap-term" onClick=${() => setVerTerminados(!verTerminados)}>${verTerminados ? 'Ocultar' : 'Ver'} ${terminados.length} ${terminados.length === 1 ? 'proyecto terminado' : 'proyectos terminados'}</button>
      ${verTerminados && html`<ul class="ap-lista">${terminados.map(nodo)}</ul>`}`}
  </section>`;
}
