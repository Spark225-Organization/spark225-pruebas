// Bases de Spark: el menú general del Inicio (como el «Spark225 Home» de Notion) y las páginas maestras
// de Tareas, Hitos y entregables, Riesgos y decisiones y Minutas, con filtros simples.
// Mismo orden que Notion: Clientes → Proyectos → Hitos → Tareas → Riesgos → Minutas.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, ESTADO_HITO, SALUD_HITO, ESTADO_RIESGO } from './datos.js?v=202611270230';
import { vigentes, visiblePara, saludProyecto, cumplimiento } from './store.js?v=202611270230';
import { I, Avatar, LogoCliente, Info, haceCuanto } from './ui.js?v=202611270230';
import { Lista } from './vistas.js?v=202611270230';

const fmt = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso.slice(0, 10) + 'T12:00:00')).replace('.', '') : '—');

// ---------- Menú general (Inicio) ----------
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
    ['#/clientes', 'clientes', 'Clientes', `${activos.length} activos`, enRiesgo ? `${enRiesgo} en riesgo` : 'todos al día'],
    ['#/proyectos', 'foco', 'Proyectos', `${proys.length} vigentes`, proyRiesgo ? `${proyRiesgo} en riesgo` : 'sin alertas'],
    ['#/tareas', 'lista', 'Tareas', `${vivas.length} abiertas`, vencidas ? `${vencidas} vencidas` : 'nada vencido'],
    ['#/hitos', 'mapa', 'Hitos y entregables', `${hitos.length} por cumplir`, hitosProx ? `${hitosProx} en 2 semanas` : 'ninguno próximo'],
    ['#/riesgos', 'alerta', 'Riesgos y decisiones', `${riesgos.length} abiertos`, escalar ? `${escalar} para Carlos` : 'nada por escalar'],
    ['#/minutas', 'nota', 'Minutas', `${db.minutas.length} en total`, `${minutas} esta semana`],
    ['#/tablero/enfoque', 'grafica', 'Mapa de enfoque', 'Prioridades del trimestre', 'captura el lunes'],
    ['#/rh/documentos', 'documento', 'Compañía', 'Organigrama y documentos', 'políticas, misión'],
  ];
  return html`<section class="bases" aria-label="Bases de Spark">
    <h2 class="bases-t">Bases de Spark <${Info} t="Como el inicio de Notion: cada base abre su lista completa con filtros. Los números son de hoy; en naranja lo que necesita atención." /></h2>
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

// ---------- Tareas (todo el equipo) ----------
export function MaestroTareas({ ctx }) {
  return html`<${Cabecera} titulo="Tareas" sub="Todo el equipo · Master Task Database" ayuda="Todas las tareas del equipo, sincronizadas con Notion. Agrupa por semana, estatus, cliente o persona y ordena tocando el encabezado." />
    <${Lista} ctx=${ctx} hoy=${hoyISO()} equipo />`;
}

// ---------- Hitos y entregables ----------
export function MaestroHitos({ ctx }) {
  const { db } = ctx;
  const hoy = hoyISO();
  const [ver, setVer] = useState('pendientes');
  const [cli, setCli] = useState('');
  const todos = db.hitos || [];
  const lista = todos.filter((h) => (ver === 'pendientes' ? h.estado !== 'cumplido' : ver === 'cumplidos' ? h.estado === 'cumplido' : true) && (!cli || h.cliente === cli))
    .sort((a, b) => (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999'));
  const proy = (id) => db.proyectos.find((p) => p.id === id);
  const per = (id) => db.personas.find((p) => p.id === id);
  return html`<${Cabecera} titulo="Hitos y entregables" sub="Master Milestones" ayuda="Los hitos de cada proyecto con su fecha interna (la nuestra) y la contractual (la del cliente). En rojo, los que ya pasaron su fecha interna sin cumplirse." />
    <div class="ls-barra">
      <div class="segmentado chico">${[['pendientes', 'Por cumplir'], ['cumplidos', 'Cumplidos'], ['todos', 'Todos']].map(([k, t]) => html`<button key=${k} aria-pressed=${ver === k} onClick=${() => setVer(k)}>${t}</button>`)}</div>
      <${FiltroCliente} db=${db} valor=${cli} set=${setCli} ids=${new Set(todos.map((h) => h.cliente))} />
    </div>
    ${lista.length === 0 ? html`<div class="ls-vacia"><p>No hay hitos con este filtro.</p></div>` : html`<div class="ls-marco"><table class="ls">
      <thead><tr><th class="c-tarea"><button disabled>Hito</button></th><th class="c-cli"><button disabled>Proyecto</button></th><th><button disabled>Estado</button></th><th class="c-resp"><button disabled>Responsable</button></th><th><button disabled>Interna</button></th><th class="c-cli"><button disabled>Contractual</button></th><th><button disabled>Salud</button></th></tr></thead>
      <tbody>${lista.map((h) => {
        const tarde = h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna < hoy;
        const p = proy(h.proyecto), c = db.clientes.find((x) => x.id === h.cliente);
        return html`<tr key=${h.id} class=${'ls-fila' + (tarde ? ' vencida' : '')} tabindex="0" onClick=${() => { location.hash = p ? '#/proyecto/' + p.id : ''; }}>
          <td class="c-tarea"><div class="ls-t">${I(h.estado === 'cumplido' ? 'check' : 'mapa')}<span><span class="ls-tit">${h.nombre}</span>${c && html`<small>${c.nombre}</small>`}</span></div></td>
          <td class="c-cli">${p ? p.nombre : html`<span class="tenue">—</span>`}</td>
          <td>${ESTADO_HITO[h.estado]}</td>
          <td class="c-resp">${h.responsable ? html`<span class="ls-per"><${Avatar} p=${per(h.responsable)} />${per(h.responsable)?.corto}</span>` : h.aprobador || html`<span class="tenue">—</span>`}</td>
          <td class=${tarde ? 'rojo' : ''}>${fmt(h.fechaInterna)}</td><td class="c-cli">${fmt(h.fechaContractual)}</td>
          <td><span class=${'sp sp-' + (h.salud === 'en_riesgo' ? 'en_riesgo' : h.salud === 'atencion' ? 'atencion' : h.salud === 'en_control' ? 'en_control' : 'sin_evaluar')}><i></i>${SALUD_HITO[h.salud]}</span></td></tr>`;
      })}</tbody></table></div>`}`;
}

// ---------- Riesgos y decisiones ----------
export function MaestroRiesgos({ ctx }) {
  const { db } = ctx;
  const hoy = hoyISO();
  const [ver, setVer] = useState('abiertos');
  const [tipo, setTipo] = useState('');
  const todos = db.riesgos || [];
  const lista = todos.filter((r) => (ver === 'abiertos' ? r.estado !== 'resuelto' : ver === 'escalar' ? r.escalar && r.estado !== 'resuelto' : true) && (!tipo || r.tipo === tipo))
    .sort((a, b) => (b.escalar - a.escalar) || ['Crítica', 'Alta', 'Media', 'Baja'].indexOf(a.severidad) - ['Crítica', 'Alta', 'Media', 'Baja'].indexOf(b.severidad) || (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999'));
  const per = (id) => db.personas.find((p) => p.id === id);
  const tipos = [...new Set(todos.map((r) => r.tipo).filter(Boolean))];
  return html`<${Cabecera} titulo="Riesgos y decisiones" sub="Master Riesgos y Decisiones" ayuda="Riesgos, bloqueos, decisiones y cambios de alcance de todos los proyectos. Primero lo que hay que escalar a Carlos; luego por severidad y fecha límite." />
    <div class="ls-barra">
      <div class="segmentado chico">${[['abiertos', 'Abiertos'], ['escalar', 'Para Carlos'], ['todos', 'Todos']].map(([k, t]) => html`<button key=${k} aria-pressed=${ver === k} onClick=${() => setVer(k)}>${t}</button>`)}</div>
      <select class="control chico" value=${tipo} onChange=${(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>${tipos.map((t) => html`<option key=${t} value=${t}>${t}</option>`)}</select>
    </div>
    ${lista.length === 0 ? html`<div class="ls-vacia"><p>Nada con este filtro.</p></div>` : html`<div class="pp-riesgos">${lista.map((x) => {
      const p = db.proyectos.find((q) => q.id === x.proyecto), c = db.clientes.find((q) => q.id === x.cliente);
      return html`<a key=${x.id} class=${'pp-riesgo' + (x.estado === 'resuelto' ? ' resuelto' : '')} href=${p ? '#/proyecto/' + p.id : x.notion} target=${p ? null : '_blank'} rel="noopener">
        <div class="pp-r-top"><span class=${'pp-tipo t-' + (x.tipo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')}>${x.tipo || 'Registro'}</span>${x.severidad && html`<span class=${'pp-sev s-' + x.severidad.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}>${x.severidad}</span>`}
          ${x.escalar && html`<span class="pp-escalar">Escalar a Carlos</span>`}<span class="pp-r-estado">${ESTADO_RIESGO[x.estado]}</span></div>
        <b>${x.titulo}</b>
        <small class="tenue">${[c?.nombre, p?.nombre].filter(Boolean).join(' · ')}</small>
        ${(x.recomendacion || x.contexto) && html`<p>${x.recomendacion ? `Recomendación: ${x.recomendacion}` : x.contexto}</p>`}
        <span class="pp-r-pie">${x.responsable ? html`<${Avatar} p=${per(x.responsable)} />${per(x.responsable)?.corto}` : ''}${x.fechaLimite ? html`<span class=${x.estado !== 'resuelto' && x.fechaLimite < hoy ? 'rojo' : ''}>Límite ${fmt(x.fechaLimite)}</span>` : ''}</span>
      </a>`;
    })}</div>`}`;
}

// ---------- Minutas ----------
export function MaestroMinutas({ ctx }) {
  const { db } = ctx;
  const [cli, setCli] = useState('');
  const [q, setQ] = useState('');
  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const todas = [...db.minutas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const lista = todas.filter((m) => (!cli || m.cliente === cli) && (!q || norm(m.titulo + ' ' + (m.resumen || '')).includes(norm(q))));
  const porMes = [];
  lista.forEach((m) => {
    const k = (m.fecha || '').slice(0, 7);
    const g = porMes.find((x) => x.k === k) || (porMes.push({ k, l: [] }), porMes[porMes.length - 1]);
    g.l.push(m);
  });
  const mes = (k) => (k ? new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(k + '-15T12:00:00')) : 'Sin fecha');
  return html`<${Cabecera} titulo="Minutas" sub="Notas de juntas: Gemini y Master Minutas" ayuda="Todas las minutas: las que llegan solas de las notas de Gemini a tu correo y las de Master Minutas en Notion. Abre una para ver el resumen y los acuerdos, y conviértelos en tareas." />
    <div class="ls-barra">
      <input class="control chico bases-buscar" placeholder="Buscar en minutas" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar en minutas" />
      <${FiltroCliente} db=${db} valor=${cli} set=${setCli} ids=${new Set(todas.map((m) => m.cliente))} />
    </div>
    ${lista.length === 0 ? html`<div class="ls-vacia"><p>No hay minutas con este filtro.</p></div>` : porMes.map((g) => html`<section key=${g.k} class="pp-grupo"><h3>${mes(g.k)}<span class="num">${g.l.length}</span></h3>
      <ul class="ca-lista">${g.l.map((m) => {
        const c = db.clientes.find((x) => x.id === m.cliente), p = db.proyectos.find((x) => x.id === m.proyecto);
        return html`<li key=${m.id}><button onClick=${() => ctx.abrirMinuta(m.id)}>
          ${c ? html`<${LogoCliente} c=${c} tam="s" />` : I('nota')}<span class="cl-t">${m.titulo}</span><small class="tenue">${[c?.nombre, p?.nombre].filter(Boolean).join(' · ')}</small>
          ${m.fuente === 'notion' && html`<span class="pp-fase">Notion</span>`}<span class="num cl-f">${haceCuanto(m.fecha)}</span></button></li>`;
      })}</ul></section>`)}`;
}
