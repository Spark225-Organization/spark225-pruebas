// Spark225 Home: el menú general del Inicio (igual que en Notion) y las bases Master con sus mismas vistas.
// Los nombres de las bases y de las vistas son los de Notion, porque el equipo ya los conoce;
// los valores (estatus, salud, fases) van en español.
// Mismo orden que Spark225 Home: Clients → Master Proyectos → Master Task Database → Master Minutas → Master Milestones → Master Riesgos y Decisiones.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, ESTADO_HITO, SALUD_HITO, ESTADO_RIESGO } from './datos.js?v=202611270810';
import { vigentes, visiblePara, saludProyecto, cumplimiento } from './store.js?v=202611270810';
import { I, Avatar, LogoCliente, Info, haceCuanto } from './ui.js?v=202611270810';
import { Lista } from './vistas.js?v=202611270810';
import { Columnas, TarjetaPipe } from './pipeline.js?v=202611270810';
import { useVista, BarraVistas, Kanban, TarjetaBase, CalendarioMes, FichaCal, GraficaBarras } from './vistas-notion.js?v=202611270810';

const fmt = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso.slice(0, 10) + 'T12:00:00')).replace('.', '') : '—');
const sinAcento = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- Spark225 Home (Inicio) ----------
export function BasesSpark({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const activos = db.clientes.filter((c) => !c.privado && (c.etapa || 'activo') === 'activo' && c.id !== 'interno');
  const enRiesgo = activos.filter((c) => cumplimiento((a) => a.cliente === c.id, hoy).salud === 'riesgo').length;
  const proys = db.proyectos.filter((p) => !p.id.startsWith('g-') && (p.fase || 'en_curso') !== 'terminado');
  const proyRiesgo = proys.filter((p) => saludProyecto(p, hoy).salud === 'en_riesgo').length;
  const vivas = vigentes().filter((a) => a.estatus !== 'hecho' && visiblePara(a, yo) && a.cliente !== 'personal');
  const vencidas = vivas.filter((a) => !a.sinFecha && a.fecha < hoy).length;
  const hitos = (db.hitos || []).filter((h) => h.estado !== 'cumplido');
  const hitosProx = hitos.filter((h) => h.fechaInterna && h.fechaInterna >= hoy && h.fechaInterna <= sumar(hoy, 14)).length;
  const riesgos = (db.riesgos || []).filter((r) => r.estado !== 'resuelto');
  const escalar = riesgos.filter((r) => r.escalar).length;
  const minutas = db.minutas.filter((m) => (m.fecha || '').slice(0, 10) >= sumar(hoy, -7)).length;
  const items = [
    ['#/clientes', 'clientes', 'Clients', `${activos.length} activos`, enRiesgo ? `${enRiesgo} en riesgo` : 'todos al día'],
    ['#/proyectos', 'foco', 'Master Proyectos', `${proys.length} vigentes`, proyRiesgo ? `${proyRiesgo} en riesgo` : 'sin alertas'],
    ['#/tareas', 'lista', 'Master Task Database', `${vivas.length} abiertas`, vencidas ? `${vencidas} vencidas` : 'nada vencido'],
    ['#/minutas', 'nota', 'Master Minutas', `${db.minutas.length} en total`, `${minutas} esta semana`],
    ['#/hitos', 'mapa', 'Master Milestones', `${hitos.length} por cumplir`, hitosProx ? `${hitosProx} en 2 semanas` : 'ninguno próximo'],
    ['#/riesgos', 'alerta', 'Master Riesgos y Decisiones', `${riesgos.length} abiertos`, escalar ? `${escalar} para Carlos` : 'nada por escalar'],
    ['#/tablero/enfoque', 'grafica', 'Focus Map', 'Prioridades del trimestre', 'captura el lunes'],
    ['#/reportes', 'documento', 'Reportes', 'Por área y periodo', 'PDF, PowerPoint y Excel'],
    ['#/rh/documentos', 'documento', 'Compañía', 'Organigrama y documentos', 'políticas, misión'],
  ];
  return html`<section class="bases" aria-label="Spark225 Home">
    <h2 class="bases-t">Spark225 Home <${Info} t="Las mismas bases que en el Spark225 Home de Notion, con sus mismas vistas. Los números son de hoy; en naranja lo que necesita atención." /></h2>
    <div class="bases-grid">${items.map(([href, ico, nombre, dato, alerta]) => {
      const hay = /vencidas|riesgo|para Carlos/.test(alerta);
      return html`<a key=${href} class="base" href=${href}>
        <span class="base-ico">${I(ico)}</span>
        <span class="base-txt"><b>${nombre}</b><small>${dato}</small><em class=${hay ? 'hay' : ''}>${alerta}</em></span>
      </a>`;
    })}</div>
  </section>`;
}
const sumar = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function Cabecera({ titulo, sub, ayuda }) {
  return html`<header class="cab-inicio"><div class="cab-dia"><h1>${titulo} ${ayuda && html`<${Info} t=${ayuda} />`}</h1>${sub && html`<span class="sub">${sub}</span>`}</div>
    <a class="btn fantasma chico" href="#/">${I('inicio')}Inicio</a></header>`;
}
function FiltroCliente({ db, valor, set, ids }) {
  const opciones = db.clientes.filter((c) => ids.has(c.id));
  return html`<select class="control chico" value=${valor} onChange=${(e) => set(e.target.value)} aria-label="Cliente"><option value="">Todos los clientes</option>${opciones.map((c) => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}</select>`;
}

// ---------- Master Task Database ----------
// Vistas de Notion que tienen sentido en el Portal. No se traen «Tasks» (es la vista personal de una persona y un cliente)
// ni las de archivo, porque las tareas archivadas no se sincronizan.
const VISTAS_TAREAS = [
  { id: 'operacion', nombre: 'Operación actual', tipo: 'tabla', ayuda: 'Las tareas abiertas de todo el equipo, por fecha compromiso de entrega.' },
  { id: 'board', nombre: 'Board', tipo: 'board', ayuda: 'Por estatus. Arrastra una tarjeta para cambiarla de estatus.' },
  { id: 'responsable', nombre: 'Responsable', tipo: 'board', ayuda: 'Las tareas abiertas de cada persona.' },
  { id: 'hoy', nombre: 'Today´s Task', tipo: 'tabla', ayuda: 'Las tareas con fecha compromiso de hoy.' },
  { id: 'chart', nombre: 'Chart', tipo: 'grafica', ayuda: 'Cuántas tareas abiertas tiene cada cliente.' },
  { id: 'calendario', nombre: 'Calendario', tipo: 'calendario', ayuda: 'Por fecha compromiso de entrega.' },
  { id: 'mi', nombre: 'Mi trabajo', tipo: 'tabla', ayuda: 'Tus tareas abiertas, de la más próxima a la más lejana.' },
  { id: 'sinproyecto', nombre: 'Sin proyecto', tipo: 'tabla', ayuda: 'Tareas abiertas que no están ligadas a un proyecto.' },
  { id: 'historial', nombre: 'Historial completado', tipo: 'tabla', ayuda: 'Tareas terminadas, de la entrega más reciente a la más antigua (últimos 60 días).' },
];
export function MaestroTareas({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const [v, elegir] = useVista(yo, 'tareas', VISTAS_TAREAS);
  const delEquipo = vigentes().filter((a) => visiblePara(a, yo) && a.cliente !== 'personal');
  const abiertas = delEquipo.filter((a) => a.estatus !== 'hecho');
  const cli = (id) => db.clientes.find((c) => c.id === id);
  const sinProyecto = (a) => !a.proyecto || a.proyecto.startsWith('g-');
  let cuerpo;
  if (v.id === 'operacion') cuerpo = html`<${Lista} ctx=${ctx} hoy=${hoy} equipo />`;
  else if (v.id === 'board') cuerpo = html`<${Columnas} lista=${delEquipo} ctx=${ctx} hoy=${hoy} todos />`;
  else if (v.id === 'responsable') {
    const columnas = db.personas.map((p) => ({ id: p.id, nombre: p.corto, icono: html`<${Avatar} p=${p} />`, lista: abiertas.filter((a) => a.responsable === p.id).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')) }))
      .filter((c) => c.lista.length);
    cuerpo = html`<${Kanban} columnas=${columnas} tarjeta=${(a) => html`<${TarjetaPipe} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} />`} />`;
  } else if (v.id === 'hoy') cuerpo = html`<${Lista} key="hoy" ctx=${ctx} hoy=${hoy} equipo porFijo="nada" filtro=${(a) => !a.sinFecha && a.fecha === hoy} />`;
  else if (v.id === 'chart') {
    const filas = db.clientes.map((c) => ({ id: c.id, nombre: c.nombre, logo: html`<${LogoCliente} c=${c} tam="s" />`, valor: abiertas.filter((a) => a.cliente === c.id).length }))
      .filter((f) => f.valor).sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre));
    cuerpo = html`<${GraficaBarras} titulo="Tareas abiertas por cliente" filas=${filas} unidad="tareas" />`;
  } else if (v.id === 'calendario') {
    cuerpo = html`<${CalendarioMes} hoy=${hoy} items=${delEquipo} fechaDe=${(a) => (a.sinFecha ? null : a.fecha)}
      ficha=${(a) => html`<${FichaCal} key=${a.id} color=${cli(a.cliente)?.color} texto=${a.titulo} hecha=${a.estatus === 'hecho'} onClick=${() => ctx.abrir(a.id)} />`} />`;
  } else if (v.id === 'mi') cuerpo = html`<${Lista} key="mi" ctx=${ctx} hoy=${hoy} soloMias porFijo="nada" filtro=${(a) => a.estatus !== 'hecho'} />`;
  else if (v.id === 'sinproyecto') cuerpo = html`<${Lista} key="sp" ctx=${ctx} hoy=${hoy} equipo porFijo="nada" filtro=${(a) => a.estatus !== 'hecho' && sinProyecto(a)} />`;
  else cuerpo = html`<${Lista} key="hist" ctx=${ctx} hoy=${hoy} equipo porFijo="nada" ordenInicial=${{ col: 'entrega', dir: -1 }} filtro=${(a) => a.estatus === 'hecho'} />`;
  return html`<${Cabecera} titulo="Master Task Database" sub="Las tareas de todo el equipo" ayuda="Todas las tareas del equipo, sincronizadas con Notion, con las mismas vistas que allá. Toca un encabezado de la tabla para ordenar." />
    <${BarraVistas} vistas=${VISTAS_TAREAS} actual=${v} elegir=${elegir} />
    ${cuerpo}`;
}

// ---------- Master Milestones ----------
const VISTAS_HITOS = [
  { id: 'default', nombre: 'Default view', tipo: 'tabla', ayuda: 'Todos los hitos y entregables, por fecha interna.' },
  { id: 'salud', nombre: 'Hitos por salud', tipo: 'board' },
  { id: 'abiertos', nombre: 'Compromisos abiertos', tipo: 'tabla', ayuda: 'Los que faltan por cumplir, por fecha contractual y luego por fecha interna.' },
];
const ORDEN_SALUD_HITO = ['en_riesgo', 'atencion', 'en_control', 'sin_evaluar'];
export function MaestroHitos({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const [v, elegir] = useVista(yo, 'hitos', VISTAS_HITOS);
  const [cli, setCli] = useState('');
  const todos = db.hitos || [];
  const proy = (id) => db.proyectos.find((p) => p.id === id);
  const per = (id) => db.personas.find((p) => p.id === id);
  const base = todos.filter((h) => !cli || h.cliente === cli);
  const tarde = (h) => h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna < hoy;
  const quien = (h) => (h.responsable ? html`<span class="ls-per"><${Avatar} p=${per(h.responsable)} />${per(h.responsable)?.corto}</span>` : h.aprobador || html`<span class="tenue">—</span>`);
  const tabla = (lista) => (lista.length === 0 ? html`<div class="ls-vacia"><p>No hay hitos con este filtro.</p></div>` : html`<div class="ls-marco"><table class="ls">
    <thead><tr><th class="c-tarea"><button disabled>Milestone</button></th><th class="c-cli"><button disabled>Proyecto</button></th><th><button disabled>Estado</button></th><th class="c-resp"><button disabled>Responsable</button></th><th><button disabled>Fecha interna</button></th><th class="c-cli"><button disabled>Fecha contractual</button></th><th><button disabled>Salud</button></th></tr></thead>
    <tbody>${lista.map((h) => {
      const p = proy(h.proyecto), c = db.clientes.find((x) => x.id === h.cliente);
      return html`<tr key=${h.id} class=${'ls-fila' + (tarde(h) ? ' vencida' : '')} tabindex="0" onClick=${() => { if (p) location.hash = '#/proyecto/' + p.id; else if (h.notion) window.open(h.notion, '_blank', 'noopener'); }}>
        <td class="c-tarea"><div class="ls-t">${I(h.estado === 'cumplido' ? 'check' : 'mapa')}<span><span class="ls-tit">${h.nombre}</span>${c && html`<small>${c.nombre}</small>`}</span></div></td>
        <td class="c-cli">${p ? p.nombre : html`<span class="tenue">—</span>`}</td>
        <td>${ESTADO_HITO[h.estado]}</td>
        <td class="c-resp">${quien(h)}</td>
        <td class=${tarde(h) ? 'rojo' : ''}>${fmt(h.fechaInterna)}</td><td class="c-cli">${fmt(h.fechaContractual)}</td>
        <td><span class=${'sp sp-' + (ORDEN_SALUD_HITO.includes(h.salud) ? h.salud : 'sin_evaluar')}><i></i>${SALUD_HITO[h.salud] || SALUD_HITO.sin_evaluar}</span></td></tr>`;
    })}</tbody></table></div>`);
  let cuerpo;
  if (v.id === 'default') cuerpo = tabla([...base].sort((a, b) => (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999')));
  else if (v.id === 'abiertos') cuerpo = tabla(base.filter((h) => h.estado !== 'cumplido').sort((a, b) => (a.fechaContractual || '9999').localeCompare(b.fechaContractual || '9999') || (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999')));
  else {
    const columnas = ORDEN_SALUD_HITO.map((s) => ({ id: s, nombre: SALUD_HITO[s], icono: html`<span class=${'sp sp-' + s}><i></i></span>`,
      lista: base.filter((h) => (ORDEN_SALUD_HITO.includes(h.salud) ? h.salud : 'sin_evaluar') === s).sort((a, b) => (a.fechaContractual || '9999').localeCompare(b.fechaContractual || '9999')) }));
    cuerpo = html`<${Kanban} columnas=${columnas} tarjeta=${(h) => {
      const p = proy(h.proyecto), c = db.clientes.find((x) => x.id === h.cliente);
      return html`<${TarjetaBase} key=${h.id} color=${c?.color} arriba=${[c?.nombre, p?.nombre].filter(Boolean).join(' · ')} titulo=${h.nombre}
        href=${p ? '#/proyecto/' + p.id : null} onClick=${() => h.notion && window.open(h.notion, '_blank', 'noopener')}
        abajo=${html`<span class=${'pcard-f num' + (tarde(h) ? ' rojo' : '')}>${h.fechaContractual ? `Contractual ${fmt(h.fechaContractual)}` : 'Sin fecha contractual'}</span><span class="vn-chip">${ESTADO_HITO[h.estado]}</span>${h.responsable && html`<${Avatar} p=${per(h.responsable)} />`}`} />`;
    }} />`;
  }
  return html`<${Cabecera} titulo="Master Milestones" sub="Hitos y entregables" ayuda="Los hitos de cada proyecto con su fecha interna (la nuestra) y la contractual (la del cliente). En rojo, los que ya pasaron su fecha interna sin cumplirse." />
    <${BarraVistas} vistas=${VISTAS_HITOS} actual=${v} elegir=${elegir} />
    <div class="ls-barra"><${FiltroCliente} db=${db} valor=${cli} set=${setCli} ids=${new Set(todos.map((h) => h.cliente))} /></div>
    ${cuerpo}`;
}

// ---------- Master Riesgos y Decisiones ----------
const VISTAS_RIESGOS = [
  { id: 'default', nombre: 'Default view', tipo: 'tabla', ayuda: 'Todos los riesgos, bloqueos, decisiones y cambios de alcance.' },
  { id: 'abiertos', nombre: 'Riesgos abiertos', tipo: 'lista', ayuda: 'Los que siguen abiertos, del más severo al menos severo.' },
  { id: 'carlos', nombre: 'Decisiones de Carlos', tipo: 'lista', ayuda: 'Lo que hay que escalar a Carlos y sigue abierto, por fecha límite.' },
];
const SEVERIDADES = ['Crítica', 'Alta', 'Media', 'Baja'];
const sev = (r) => { const i = SEVERIDADES.indexOf(r.severidad); return i < 0 ? 9 : i; };
export function MaestroRiesgos({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const [v, elegir] = useVista(yo, 'riesgos', VISTAS_RIESGOS);
  const [tipo, setTipo] = useState('');
  const todos = db.riesgos || [];
  const per = (id) => db.personas.find((p) => p.id === id);
  const tipos = [...new Set(todos.map((r) => r.tipo).filter(Boolean))];
  const base = todos.filter((r) => !tipo || r.tipo === tipo);
  const porFecha = (a, b) => (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999');
  const claseTipo = (t) => 'pp-tipo t-' + sinAcento(t).replace(/[^a-z]/g, '');
  const claseSev = (s) => 'pp-sev s-' + sinAcento(s);
  const tarjetas = (lista) => (lista.length === 0 ? html`<div class="ls-vacia"><p>Nada con este filtro.</p></div>` : html`<div class="pp-riesgos">${lista.map((x) => {
    const p = db.proyectos.find((q) => q.id === x.proyecto), c = db.clientes.find((q) => q.id === x.cliente);
    return html`<a key=${x.id} class=${'pp-riesgo' + (x.estado === 'resuelto' ? ' resuelto' : '')} href=${p ? '#/proyecto/' + p.id : x.notion} target=${p ? null : '_blank'} rel="noopener">
      <div class="pp-r-top"><span class=${claseTipo(x.tipo)}>${x.tipo || 'Registro'}</span>${x.severidad && html`<span class=${claseSev(x.severidad)}>${x.severidad}</span>`}
        ${x.escalar && html`<span class="pp-escalar">Escalar a Carlos</span>`}<span class="pp-r-estado">${ESTADO_RIESGO[x.estado]}</span></div>
      <b>${x.titulo}</b>
      <small class="tenue">${[c?.nombre, p?.nombre].filter(Boolean).join(' · ')}</small>
      ${(x.recomendacion || x.contexto) && html`<p>${x.recomendacion ? `Recomendación: ${x.recomendacion}` : x.contexto}</p>`}
      <span class="pp-r-pie">${x.responsable ? html`<${Avatar} p=${per(x.responsable)} />${per(x.responsable)?.corto}` : ''}${x.fechaLimite ? html`<span class=${x.estado !== 'resuelto' && x.fechaLimite < hoy ? 'rojo' : ''}>Límite ${fmt(x.fechaLimite)}</span>` : ''}</span>
    </a>`;
  })}</div>`);
  let cuerpo;
  if (v.id === 'abiertos') cuerpo = tarjetas(base.filter((r) => r.estado !== 'resuelto').sort((a, b) => sev(a) - sev(b) || porFecha(a, b)));
  else if (v.id === 'carlos') cuerpo = tarjetas(base.filter((r) => r.escalar && r.estado !== 'resuelto').sort(porFecha));
  else {
    const lista = [...base].sort((a, b) => (a.estado === 'resuelto') - (b.estado === 'resuelto') || sev(a) - sev(b) || porFecha(a, b));
    cuerpo = lista.length === 0 ? html`<div class="ls-vacia"><p>Nada con este filtro.</p></div>` : html`<div class="ls-marco"><table class="ls">
      <thead><tr><th class="c-tarea"><button disabled>Riesgo / Decisión</button></th><th class="c-cli"><button disabled>Proyecto</button></th><th><button disabled>Tipo</button></th><th><button disabled>Severidad</button></th><th><button disabled>Estado</button></th><th class="c-resp"><button disabled>Owner</button></th><th><button disabled>Fecha límite</button></th></tr></thead>
      <tbody>${lista.map((x) => {
        const p = db.proyectos.find((q) => q.id === x.proyecto), c = db.clientes.find((q) => q.id === x.cliente);
        return html`<tr key=${x.id} class=${'ls-fila' + (x.estado === 'resuelto' ? ' hecha' : '')} tabindex="0" onClick=${() => { if (p) location.hash = '#/proyecto/' + p.id; else if (x.notion) window.open(x.notion, '_blank', 'noopener'); }}>
          <td class="c-tarea"><div class="ls-t">${I(x.escalar ? 'alerta' : 'nota')}<span><span class="ls-tit">${x.titulo}</span>${c && html`<small>${c.nombre}${x.escalar ? ' · Escalar a Carlos' : ''}</small>`}</span></div></td>
          <td class="c-cli">${p ? p.nombre : html`<span class="tenue">—</span>`}</td>
          <td>${x.tipo ? html`<span class=${claseTipo(x.tipo)}>${x.tipo}</span>` : '—'}</td>
          <td>${x.severidad ? html`<span class=${claseSev(x.severidad)}>${x.severidad}</span>` : '—'}</td>
          <td>${ESTADO_RIESGO[x.estado]}</td>
          <td class="c-resp">${x.responsable ? html`<span class="ls-per"><${Avatar} p=${per(x.responsable)} />${per(x.responsable)?.corto}</span>` : html`<span class="tenue">—</span>`}</td>
          <td class=${x.estado !== 'resuelto' && x.fechaLimite && x.fechaLimite < hoy ? 'rojo' : ''}>${fmt(x.fechaLimite)}</td></tr>`;
      })}</tbody></table></div>`;
  }
  return html`<${Cabecera} titulo="Master Riesgos y Decisiones" sub="Riesgos, bloqueos y decisiones de los proyectos" ayuda="Riesgos, bloqueos, decisiones y cambios de alcance de todos los proyectos, con las mismas vistas que en Notion." />
    <${BarraVistas} vistas=${VISTAS_RIESGOS} actual=${v} elegir=${elegir} />
    <div class="ls-barra"><select class="control chico" value=${tipo} onChange=${(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>${tipos.map((t) => html`<option key=${t} value=${t}>${t}</option>`)}</select></div>
    ${cuerpo}`;
}

// ---------- Master Minutas ----------
const VISTAS_MINUTAS = [
  { id: 'todas', nombre: 'Todas', tipo: 'lista', ayuda: 'De la más reciente a la más antigua: las de Notion y las que llegan de las notas de Gemini a tu correo.' },
  { id: 'calendario', nombre: 'Calendario', tipo: 'calendario' },
  { id: 'estado', nombre: 'Por Estado', tipo: 'board', ayuda: 'Por estado en Notion. Las que llegan del correo (Gemini) van en su propia columna.' },
];
const ORDEN_ESTADO_MINUTA = ['Pendiente', 'Transcrita', 'Procesada', 'Archivada'];
export function MaestroMinutas({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const [v, elegir] = useVista(yo, 'minutas', VISTAS_MINUTAS);
  const [cli, setCli] = useState('');
  const [q, setQ] = useState('');
  const todas = [...db.minutas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const lista = todas.filter((m) => (!cli || m.cliente === cli) && (!q || sinAcento(m.titulo + ' ' + (m.resumen || '')).includes(sinAcento(q))));
  const cliDe = (m) => db.clientes.find((x) => x.id === m.cliente);
  const proyDe = (m) => db.proyectos.find((x) => x.id === m.proyecto);
  let cuerpo;
  if (lista.length === 0) cuerpo = html`<div class="ls-vacia"><p>No hay minutas con este filtro.</p></div>`;
  else if (v.id === 'calendario') {
    cuerpo = html`<${CalendarioMes} hoy=${hoy} items=${lista} fechaDe=${(m) => m.fecha}
      ficha=${(m) => html`<${FichaCal} key=${m.id} color=${cliDe(m)?.color} texto=${m.titulo} onClick=${() => ctx.abrirMinuta(m.id)} />`} />`;
  } else if (v.id === 'estado') {
    const estados = [...new Set(lista.filter((m) => m.fuente === 'notion').map((m) => m.estado || 'Sin estado'))]
      .sort((a, b) => (ORDEN_ESTADO_MINUTA.indexOf(a) + 1 || 99) - (ORDEN_ESTADO_MINUTA.indexOf(b) + 1 || 99));
    const columnas = [...estados.map((e) => ({ id: e, nombre: e, lista: lista.filter((m) => m.fuente === 'notion' && (m.estado || 'Sin estado') === e) })),
      { id: 'gemini', nombre: 'Del correo (Gemini)', lista: lista.filter((m) => m.fuente !== 'notion') }].filter((c) => c.lista.length);
    cuerpo = html`<${Kanban} columnas=${columnas} tarjeta=${(m) => html`<${TarjetaBase} key=${m.id} color=${cliDe(m)?.color} arriba=${[cliDe(m)?.nombre, m.categoria].filter(Boolean).join(' · ')}
      titulo=${m.titulo} onClick=${() => ctx.abrirMinuta(m.id)} abajo=${html`<span class="pcard-f num">${fmt(m.fecha)}</span>`} />`} />`;
  } else {
    const porMes = [];
    lista.forEach((m) => {
      const k = (m.fecha || '').slice(0, 7);
      const g = porMes.find((x) => x.k === k) || (porMes.push({ k, l: [] }), porMes[porMes.length - 1]);
      g.l.push(m);
    });
    const mes = (k) => (k ? new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(k + '-15T12:00:00')) : 'Sin fecha');
    cuerpo = porMes.map((g) => html`<section key=${g.k} class="pp-grupo"><h3>${mes(g.k)}<span class="num">${g.l.length}</span></h3>
      <ul class="ca-lista">${g.l.map((m) => {
        const c = cliDe(m), p = proyDe(m);
        return html`<li key=${m.id}><button onClick=${() => ctx.abrirMinuta(m.id)}>
          ${c ? html`<${LogoCliente} c=${c} tam="s" />` : I('nota')}<span class="cl-t">${m.titulo}</span><small class="tenue">${[c?.nombre, p?.nombre].filter(Boolean).join(' · ')}</small>
          ${m.fuente === 'notion' && html`<span class="pp-fase">${m.estado || 'Notion'}</span>`}<span class="num cl-f">${haceCuanto(m.fecha)}</span></button></li>`;
      })}</ul></section>`);
  }
  return html`<${Cabecera} titulo="Master Minutas" sub="Notas de juntas: Notion y Gemini" ayuda="Todas las minutas: las de Master Minutas en Notion y las que llegan solas de las notas de Gemini a tu correo. Abre una para ver el resumen y los acuerdos, y conviértelos en tareas." />
    <${BarraVistas} vistas=${VISTAS_MINUTAS} actual=${v} elegir=${elegir} />
    <div class="ls-barra">
      <input class="control chico bases-buscar" placeholder="Buscar en minutas" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar en minutas" />
      <${FiltroCliente} db=${db} valor=${cli} set=${setCli} ids=${new Set(todas.map((m) => m.cliente))} />
    </div>
    ${cuerpo}`;
}

// Accesos compactos de Spark225 Home (en «Mi trabajo»): una fila de botones en lugar de las tarjetas grandes.
export function AccesosSpark() {
  const items = [['#/clientes', 'clientes', 'Clients'], ['#/proyectos', 'foco', 'Master Proyectos'], ['#/tareas', 'lista', 'Master Task Database'], ['#/minutas', 'nota', 'Master Minutas'],
    ['#/hitos', 'mapa', 'Master Milestones'], ['#/riesgos', 'alerta', 'Master Riesgos y Decisiones'], ['#/tablero/enfoque', 'grafica', 'Focus Map'], ['#/reportes', 'documento', 'Reportes']];
  return html`<nav class="accesos" aria-label="Spark225 Home">${items.map(([href, ico, t]) => html`<a key=${href} href=${href}>${I(ico)}<span>${t}</span></a>`)}</nav>`;
}
