// Proyectos como en Notion: portafolio del lunes (por cliente, con salud) y página de cada proyecto
// con sus pestañas Actividades, Hitos, Riesgos y decisiones, Minutas y Unidades.
// Los datos del proyecto, hitos y riesgos vienen de Notion (solo lectura); las tareas se editan aquí.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, ESTATUS, FASES_PROYECTO, SALUD_PROYECTO, ESTADO_HITO, SALUD_HITO, ESTADO_RIESGO, PRIORIDADES } from './datos.js?v=202611270230';
import { vigentes, visiblePara, estatusVisible, saludProyecto, prefsDe, guardarPrefs } from './store.js?v=202611270230';
import { I, Anillo, Avatar, LogoCliente, Info, fechaRelativa, haceCuanto } from './ui.js?v=202611270230';
const T_SALUD = 'Regla de Notion. Rojo: 6 o más tareas vencidas o más de 35 días sin actualización ejecutiva. Amarillo: 3 a 5 vencidas, más de 21 días sin actualización, sin responsable, con una decisión requerida o sin tareas vivas. Sin evaluar: por iniciar o terminado. Un programa no tiene salud propia: la tienen sus unidades.';

const FASE = Object.fromEntries(FASES_PROYECTO.map((f) => [f.id, f.nombre]));
const PRI = Object.fromEntries(PRIORIDADES.map((p) => [p.id, p.nombre]));
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: iso.slice(0, 4) === hoyISO().slice(0, 4) ? undefined : 'numeric' }).format(new Date(iso + 'T12:00:00')).replace('.', '') : '—');

export function NavClientes({ actual }) {
  return html`<nav class="segmentado" aria-label="Clientes y proyectos">${[['clientes', 'Clientes', 'clientes'], ['proyectos', 'Proyectos', 'foco']].map(([k, t, ico]) => html`<a key=${k} href=${'#/' + k} role="button" aria-pressed=${actual === k} class="seg-link">${I(ico)}<span>${t}</span></a>`)}</nav>`;
}
export function ChipSalud({ s, razones }) {
  return html`<span class=${'sp sp-' + s} title=${(razones || []).join(' · ')}><i></i>${SALUD_PROYECTO[s]?.nombre || s}</span>`;
}

// ---------- Portafolio ----------
export function Portafolio({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const prefs = prefsDe(yo);
  const [ver, setVer] = useState(prefs.portafolio || 'activos');
  const [mios, setMios] = useState(false);
  const elegir = (v) => { setVer(v); guardarPrefs(yo, { portafolio: v }); };
  // El proyecto «General» de cada cliente solo aparece si tiene tareas abiertas (son tareas sin proyecto específico).
  const lista = db.proyectos.filter((p) => !p.id.startsWith('g-') || vigentes().some((a) => a.proyecto === p.id && a.estatus !== 'hecho'))
    .filter((p) => (ver === 'todos' ? true : ver === 'terminados' ? p.fase === 'terminado' : p.fase !== 'terminado'))
    .filter((p) => !mios || p.responsable === yo || (p.equipo || []).includes(yo))
    .map((p) => ({ p, s: saludProyecto(p, hoy) }));
  const cuenta = { en_riesgo: 0, atencion: 0, en_control: 0 };
  lista.forEach(({ s }) => { if (cuenta[s.salud] !== undefined) cuenta[s.salud]++; });
  // Agrupado por cliente; el cliente con el peor proyecto va primero. Las unidades van debajo de su programa.
  const porCliente = db.clientes.map((c) => {
    const suyos = lista.filter(({ p }) => p.cliente === c.id);
    const raiz = suyos.filter(({ p }) => !p.programa || !suyos.some((x) => x.p.id === p.programa));
    const filas = raiz.sort((a, b) => SALUD_PROYECTO[a.s.salud].orden - SALUD_PROYECTO[b.s.salud].orden || a.p.nombre.localeCompare(b.p.nombre))
      .flatMap((r) => [r, ...suyos.filter(({ p }) => p.programa === r.p.id).map((u) => ({ ...u, unidad: true }))]);
    return { c, filas, peor: Math.min(9, ...suyos.map(({ s }) => SALUD_PROYECTO[s.salud].orden)) };
  }).filter((g) => g.filas.length).sort((a, b) => a.peor - b.peor || a.c.nombre.localeCompare(b.c.nombre));

  return html`
    <header class="cab-inicio">
      <div class="cab-dia"><h1>Proyectos <${Info} t=${T_SALUD} /></h1><span class="sub num">${lista.length} ${lista.length === 1 ? 'proyecto' : 'proyectos'}</span></div>
      <${NavClientes} actual="proyectos" />
    </header>
    <div class="ls-barra">
      <div class="segmentado chico">${[['activos', 'Activos'], ['terminados', 'Terminados'], ['todos', 'Todos']].map(([k, t]) => html`<button key=${k} aria-pressed=${ver === k} onClick=${() => elegir(k)}>${t}</button>`)}</div>
      <label class="ls-hechas"><input type="checkbox" checked=${mios} onChange=${() => setMios(!mios)} />Solo donde participo</label>
    </div>
    <p class="cli-regla"><${ChipSalud} s="en_riesgo" /> ${cuenta.en_riesgo} <${ChipSalud} s="atencion" /> ${cuenta.atencion} <${ChipSalud} s="en_control" /> ${cuenta.en_control}
      <span class="tenue">Rojo: 6+ vencidas o más de 35 días sin actualización ejecutiva · Amarillo: 3–5 vencidas, más de 21 días, sin responsable, decisión requerida o sin tareas vivas (regla de Notion).</span></p>
    ${porCliente.length === 0 ? html`<div class="ls-vacia"><p>No hay proyectos con este filtro.</p></div>` : html`<div class="ls-marco"><table class="ls pf">
      <thead><tr><th class="c-tarea"><button disabled>Proyecto</button></th><th><button disabled>Salud</button></th><th class="c-cli"><button disabled>Fase</button></th><th class="c-resp"><button disabled>Responsable</button></th><th><button disabled>Tareas</button></th><th class="c-hito"><button disabled>Próximo hito</button></th></tr></thead>
      ${porCliente.map(({ c, filas }) => html`<tbody key=${c.id}>
        <tr class="ls-grupo"><th colspan="6" scope="rowgroup"><a class="pf-cli" href=${'#/cliente/' + c.id}><${LogoCliente} c=${c} tam="s" />${c.nombre}<b>${filas.length}</b></a></th></tr>
        ${filas.map(({ p, s, unidad }) => html`<tr key=${p.id} class=${'ls-fila' + (s.salud === 'en_riesgo' ? ' vencida' : '')} tabindex="0" onClick=${() => { location.hash = '#/proyecto/' + p.id; }} onKeyDown=${(e) => e.key === 'Enter' && (location.hash = '#/proyecto/' + p.id)}>
          <td class="c-tarea"><div class=${'ls-t' + (unidad ? ' pf-unidad' : '')}>${I(s.salud === 'programa' ? 'columnas' : 'foco')}<span><span class="ls-tit">${p.nombre}</span>${p.decision ? html`<small class="ambar">Decisión requerida</small>` : p.bloqueo ? html`<small>Bloqueo: ${p.bloqueo}</small>` : null}</span></div></td>
          <td><${ChipSalud} s=${s.salud} razones=${s.razones} /><small class="pf-razon">${s.salud === 'en_control' ? '' : s.razones[0]}</small></td>
          <td class="c-cli">${FASE[p.fase || 'en_curso']}${p.esperaCliente ? html`<small class="pf-razon">Esperando cliente</small>` : null}</td>
          <td class="c-resp">${p.responsable ? html`<span class="ls-per"><${Avatar} p=${db.personas.find((x) => x.id === p.responsable)} />${db.personas.find((x) => x.id === p.responsable)?.corto}</span>` : html`<span class="tenue">—</span>`}</td>
          <td class="num">${s.vivas}${s.vencidas ? html` <span class="ls-atraso">· ${s.vencidas} vencidas</span>` : ''}</td>
          <td class="c-hito">${p.proximoHito ? html`<span class="pf-hito">${p.proximoHito}</span><small class=${p.fechaProximoHito && p.fechaProximoHito < hoy ? 'rojo' : 'tenue'}>${fmt(p.fechaProximoHito)}</small>` : html`<span class="tenue">—</span>`}</td>
        </tr>`)}
      </tbody>`)}
    </table></div>`}`;
}

// ---------- Página del proyecto ----------
export function DetalleProyecto({ id, ctx }) {
  const { db, yo } = ctx;
  const p = db.proyectos.find((x) => x.id === id);
  const [pest, setPest] = useState('actividades');
  const [hechas, setHechas] = useState(false);
  if (!p) return html`<div class="vacio">${I('foco')}<p>Ese proyecto ya no está.</p><a class="btn" href="#/proyectos">Volver a Proyectos</a></div>`;
  const hoy = hoyISO();
  const c = db.clientes.find((x) => x.id === p.cliente);
  const s = saludProyecto(p, hoy);
  const r = db.personas.find((x) => x.id === p.responsable);
  const tareas = vigentes().filter((a) => a.proyecto === p.id && visiblePara(a, yo));
  const hitos = (db.hitos || []).filter((h) => h.proyecto === p.id).sort((a, b) => (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999'));
  const riesgos = (db.riesgos || []).filter((x) => x.proyecto === p.id).sort((a, b) => (a.estado === 'resuelto') - (b.estado === 'resuelto') || (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999'));
  const minutas = db.minutas.filter((m) => m.proyecto === p.id || (!m.proyecto && m.cliente === p.cliente));
  const unidades = db.proyectos.filter((x) => x.programa === p.id);
  const programa = p.programa && db.proyectos.find((x) => x.id === p.programa);
  const per = (pid) => db.personas.find((x) => x.id === pid);
  const tabs = [['actividades', 'Actividades', tareas.filter((a) => a.estatus !== 'hecho').length], ['hitos', 'Hitos', hitos.length], ['riesgos', 'Riesgos y decisiones', riesgos.filter((x) => x.estado !== 'resuelto').length], ['minutas', 'Minutas', minutas.length], ...(unidades.length ? [['unidades', 'Unidades', unidades.length]] : [])];
  const tarjeta = (titulo, cuerpo, extra, clase = '') => cuerpo && html`<section class=${'ca-panel pp-dato ' + clase}><h3>${titulo}${extra ? html`<small>${extra}</small>` : null}</h3><p>${cuerpo}</p></section>`;

  return html`<div class="ficha-cli proyecto" style=${`--c:${c?.color || 'var(--chispa)'}`}>
    <header class="fc-cab">
      <a class="ca-volver" href="#/proyectos">${I('flecha')}Proyectos</a>
      <div class="fc-id">
        ${c && html`<a href=${'#/cliente/' + c.id} title=${c.nombre}><${LogoCliente} c=${c} tam="l" /></a>`}
        <div class="fc-tit">
          <span class="pp-cli">${c?.nombre || 'Sin cliente'}${programa ? html` · <a href=${'#/proyecto/' + programa.id}>${programa.nombre}</a>` : ''}</span>
          <h1>${p.nombre}</h1>
          <div class="fc-meta"><${ChipSalud} s=${s.salud} razones=${s.razones} /><span class="pp-fase">${FASE[p.fase || 'en_curso']}</span>${p.esperaCliente ? html`<span class="pp-fase ambar">Esperando cliente</span>` : null}
            <span class="ca-quien"><${Avatar} p=${r} />${r ? `Responsable: ${r.id === yo ? 'tú' : r.corto}` : 'Sin responsable'}</span></div>
        </div>
      </div>
      <div class="ca-acc">
        ${p.drive && html`<a class="btn" href=${p.drive} target="_blank" rel="noopener">${I('drive')}Drive</a>`}
        ${p.notion && html`<a class="btn" href=${p.notion} target="_blank" rel="noopener">${I('externo')}Editar en Notion</a>`}
        <button class="btn prim" onClick=${() => ctx.crear('tarea', { cliente: p.cliente, proyecto: p.id })}>${I('mas')}Tarea</button>
      </div>
    </header>

    <div class="pp-resumen">
      <section class=${'ca-panel pp-salud sp-' + s.salud}>
        <h3>Salud <${Info} t=${T_SALUD} /></h3>
        <p class="pp-salud-t"><${ChipSalud} s=${s.salud} /></p>
        <ul>${s.razones.map((x) => html`<li key=${x}>${x}</li>`)}</ul>
        <dl class="num"><div><dt>Vivas</dt><dd>${s.vivas}</dd></div><div><dt>Vencidas</dt><dd class=${s.vencidas ? 'rojo' : ''}>${s.vencidas}</dd></div><div><dt>Días sin señal</dt><dd>${s.dias ?? '—'}</dd></div></dl>
      </section>
      ${tarjeta('Decisión requerida', p.decision, null, 'pp-alerta')}
      ${tarjeta('Bloqueo principal', p.bloqueo, null, 'pp-alerta')}
      ${tarjeta('Próximo hito', p.proximoHito, p.fechaProximoHito && fmt(p.fechaProximoHito))}
      ${tarjeta('Objetivo', p.objetivo)}
      ${tarjeta('Actualización ejecutiva', p.actualizacion, p.fechaActualizacion && fmt(p.fechaActualizacion))}
      ${tarjeta('KPI de éxito', p.kpiExito, p.resultado && `Actual: ${p.resultado}`)}
    </div>

    <div class="segmentado fm-tabs" role="tablist">${tabs.map(([k, t, n]) => html`<button key=${k} role="tab" aria-pressed=${pest === k} onClick=${() => setPest(k)}>${t}<span class="num pp-n">${n}</span></button>`)}</div>

    ${pest === 'actividades' && html`
      <label class="ls-hechas pp-hechas"><input type="checkbox" checked=${hechas} onChange=${() => setHechas(!hechas)} />Ver terminadas</label>
      ${tareas.length === 0 ? html`<div class="ls-vacia"><p>Este proyecto aún no tiene tareas.</p><button class="btn prim" onClick=${() => ctx.crear('tarea', { cliente: p.cliente, proyecto: p.id })}>Agregar tarea</button></div>`
        : ESTATUS.filter((e) => hechas || e.id !== 'hecho').map((e) => {
          const l = tareas.filter((a) => estatusVisible(a) === e.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
          if (!l.length) return null;
          return html`<section key=${e.id} class="pp-grupo"><h3><${Anillo} estatus=${e.id} />${e.nombre}<span class="num">${l.length}</span></h3>
            <ul class="ca-lista">${l.map((a) => {
              const v = a.estatus !== 'hecho' && a.fecha < hoy;
              return html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}>
                <span class="cl-t">${a.titulo}</span>${a.prioridad && html`<span class=${'pri-txt pri-' + a.prioridad}>${PRI[a.prioridad]}</span>`}<${Avatar} p=${per(a.responsable)} />
                <span class=${'num cl-f' + (v ? ' rojo' : '')}>${fechaRelativa(a.fecha)}</span></button></li>`;
            })}</ul></section>`;
        })}`}

    ${pest === 'hitos' && (hitos.length === 0 ? html`<div class="ls-vacia"><p>Sin hitos en Notion para este proyecto.</p></div>` : html`<div class="ls-marco"><table class="ls">
      <thead><tr><th class="c-tarea"><button disabled>Hito</button></th><th><button disabled>Estado</button></th><th class="c-resp"><button disabled>Responsable</button></th><th><button disabled>Fecha interna</button></th><th class="c-cli"><button disabled>Fecha contractual</button></th><th><button disabled>Salud</button></th></tr></thead>
      <tbody>${hitos.map((h) => {
        const tarde = h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna < hoy;
        return html`<tr key=${h.id} class=${'ls-fila' + (tarde ? ' vencida' : '')} onClick=${() => window.open(h.notion, '_blank', 'noopener')} tabindex="0">
          <td class="c-tarea"><div class="ls-t">${I(h.estado === 'cumplido' ? 'check' : 'foco')}<span><span class="ls-tit">${h.nombre}</span>${h.criterio && html`<small>${h.criterio}</small>`}</span></div></td>
          <td>${ESTADO_HITO[h.estado]}</td>
          <td class="c-resp">${h.responsable ? html`<span class="ls-per"><${Avatar} p=${per(h.responsable)} />${per(h.responsable)?.corto}</span>` : h.aprobador || '—'}</td>
          <td class=${tarde ? 'rojo' : ''}>${fmt(h.fechaInterna)}</td><td class="c-cli">${fmt(h.fechaContractual)}</td>
          <td><span class=${'sp sp-' + ({ en_control: 'en_control', atencion: 'atencion', en_riesgo: 'en_riesgo' }[h.salud] || 'sin_evaluar')}><i></i>${SALUD_HITO[h.salud]}</span></td></tr>`;
      })}</tbody></table></div>`)}

    ${pest === 'riesgos' && (riesgos.length === 0 ? html`<div class="ls-vacia"><p>Sin riesgos ni decisiones registrados.</p></div>` : html`<div class="pp-riesgos">${riesgos.map((x) => html`
      <a key=${x.id} class=${'pp-riesgo' + (x.estado === 'resuelto' ? ' resuelto' : '')} href=${x.notion} target="_blank" rel="noopener">
        <div class="pp-r-top"><span class=${'pp-tipo t-' + (x.tipo || '').toLowerCase().replace(/[^a-z]/g, '')}>${x.tipo || 'Registro'}</span>${x.severidad && html`<span class=${'pp-sev s-' + x.severidad.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}>${x.severidad}</span>`}
          ${x.escalar && html`<span class="pp-escalar">Escalar a Carlos</span>`}<span class="pp-r-estado">${ESTADO_RIESGO[x.estado]}</span></div>
        <b>${x.titulo}</b>
        ${(x.recomendacion || x.contexto) && html`<p>${x.recomendacion ? `Recomendación: ${x.recomendacion}` : x.contexto}</p>`}
        ${x.resolucion && html`<p class="tenue">Resolución: ${x.resolucion}</p>`}
        <span class="pp-r-pie">${x.responsable ? html`<${Avatar} p=${per(x.responsable)} />${per(x.responsable)?.corto}` : ''}${x.fechaLimite ? html`<span class=${x.estado !== 'resuelto' && x.fechaLimite < hoy ? 'rojo' : ''}>Límite ${fmt(x.fechaLimite)}</span>` : ''}</span>
      </a>`)}</div>`)}

    ${pest === 'minutas' && (minutas.length === 0 ? html`<div class="ls-vacia"><p>Cuando llegue la minuta de una junta de este proyecto, aparece aquí.</p></div>` : html`<ul class="ca-lista pp-minutas">${minutas.map((m) => html`<li key=${m.id}><button onClick=${() => ctx.abrirMinuta(m.id)}>
      ${I('nota')}<span class="cl-t">${m.titulo}</span>${!m.proyecto && html`<small class="tenue">del cliente</small>`}<span class="num cl-f">${haceCuanto(m.fecha)}</span></button></li>`)}</ul>`)}

    ${pest === 'unidades' && html`<ul class="ca-proyectos">${unidades.map((u) => {
      const su = saludProyecto(u, hoy);
      return html`<li key=${u.id}><a class="cp-t" href=${'#/proyecto/' + u.id}><b>${u.nombre}</b><small>${FASE[u.fase || 'en_curso']} · ${su.vivas} tareas vivas</small></a><${ChipSalud} s=${su.salud} razones=${su.razones} /><${Avatar} p=${per(u.responsable)} /></li>`;
    })}</ul>`}

    ${p.deNotion && html`<p class="ca-nota">Los datos del proyecto, los hitos y los riesgos vienen de Notion y se actualizan cada 15 minutos. Las tareas se editan aquí.</p>`}
  </div>`;
}
