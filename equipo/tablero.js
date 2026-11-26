// Tablero «Cómo va Spark225»: entrega a tiempo de toda la agencia, semáforo de clientes,
// tendencia por semana, cómo va cada persona y qué hay abierto por prioridad.
// Todo sale de las tareas del Portal (que ya traen lo de Notion). No hay cifras de ejemplo.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias, PRIORIDADES } from './datos.js?v=202611270830';
import { vigentes, visiblePara, cumplimiento, evaluarEntrega, VENTANA_DIAS, saludProyecto } from './store.js?v=202611270830';
import { I, Avatar, LogoCliente, Info, fechaCorta } from './ui.js?v=202611270830';
const T_ENTREGA = 'Porcentaje de tareas que se cerraron en su fecha compromiso, de las que vencieron en el periodo. Una tarea Alta pesa 3, una Media 2 y una Baja 1. Si la fecha la movió el cliente o algo externo, cuenta la nueva; si la movimos nosotros, cuenta la original. Verde: 95 % o más · amarillo: 85 a 94 % · rojo: menos de 85 %.';
import { Semaforo, NOMBRE_SALUD } from './archivero.js?v=202611270830';

const lunesDe = (iso) => { const d = new Date(iso + 'T12:00:00'); return sumarDias(iso, -((d.getDay() + 6) % 7)); };
const fmtDia = (iso) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T12:00:00')).replace('.', '');

export function Tablero({ ctx, pestana = 'enfoque' }) {
  const pestanas = html`<nav class="segmentado tb-pest" aria-label="Tablero">${[['enfoque', 'Focus Map', 'foco'], ['entregas', 'Entregas a tiempo', 'grafica'], ['orden', 'Orden y limpieza', 'check']].map(([k, t, ico]) => html`<a key=${k} href=${'#/tablero/' + k} role="button" aria-pressed=${pestana === k} class="seg-link">${I(ico)}<span>${t}</span></a>`)}</nav>`;
  // Focus Map: la app original, tal cual, con los datos en la base del Portal (ver focusmap/index.html).
  if (pestana === 'enfoque') {
    const tema = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    return html`<div class="tablero tb-fm">
      <header class="cab-inicio"><div class="cab-dia"><h1>Cómo va Spark225</h1></div>${pestanas}</header>
      <iframe class="fm-marco" src=${`./focusmap/?v=202611270830&tema=${tema}${ctx.enNube ? '' : '&demo=1'}`} title="Focus Map"></iframe>
      <a class="fm-abrir" href=${`./focusmap/?tema=${tema}${ctx.enNube ? '' : '&demo=1'}`} target="_blank" rel="noopener">${I('externo')}Abrir el Focus Map en pantalla completa</a>
    </div>`;
  }
  if (pestana === 'orden') return html`<div class="tablero">
    <header class="cab-inicio"><div class="cab-dia"><h1>Cómo va Spark225</h1><span class="sub">Lo que hay que acomodar</span></div>${pestanas}</header>
    <${OrdenLimpieza} ctx=${ctx} /></div>`;
  return html`<${TableroEntregas} ctx=${ctx} pestanas=${pestanas} />`;
}

function TableroEntregas({ ctx, pestanas }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const [ventana, setVentana] = useState(VENTANA_DIAS);
  const total = cumplimiento(() => true, hoy, ventana);
  const activos = db.clientes.filter((c) => !c.privado && (c.etapa || 'activo') === 'activo' && c.id !== 'interno');
  const porCliente = activos.map((c) => ({ c, cu: cumplimiento((a) => a.cliente === c.id, hoy, ventana) }))
    .sort((a, b) => (a.cu.pct ?? 101) - (b.cu.pct ?? 101));
  const conteo = { bien: 0, atencion: 0, riesgo: 0 };
  porCliente.forEach(({ cu }) => { if (cu.salud) conteo[cu.salud]++; });
  const abiertas = vigentes().filter((a) => a.estatus !== 'hecho' && visiblePara(a, yo) && a.cliente !== 'personal');
  const vencidas = abiertas.filter((a) => !a.sinFecha && a.fecha < hoy);
  const semana7 = abiertas.filter((a) => a.fecha >= hoy && a.fecha <= sumarDias(hoy, 6));

  return html`<div class="tablero">
    <header class="cab-inicio">
      <div class="cab-dia"><h1>Cómo va Spark225</h1><span class="sub">Entrega a tiempo, ponderada por prioridad</span></div>
      ${pestanas}
    </header>
    <div class="tb-periodo">
      <div class="segmentado chico" aria-label="Periodo">${[[7, '7 días'], [30, '30 días'], [90, '90 días']].map(([d, t]) => html`<button key=${d} aria-pressed=${ventana === d} onClick=${() => setVentana(d)}>${t}</button>`)}</div>
    </div>

    <section class=${'tb-hero s-' + (total.salud || 'nada')}>
      <div class="tb-num">
        <span class="tb-etq">Entrega a tiempo de Spark225 <${Info} t=${T_ENTREGA} /></span>
        <b class="num">${total.pct === null ? '—' : total.pct}<small>${total.pct === null ? '' : '%'}</small></b>
        ${total.salud ? html`<span class=${'sema s-' + total.salud}><i></i>${NOMBRE_SALUD[total.salud]}</span>` : html`<span class="sema s-nada"><i></i>Sin entregas en el periodo</span>`}
      </div>
      <dl class="tb-cifras num">
        <div><dt>A tiempo</dt><dd>${total.nATiempo}<small> de ${total.evaluadas.length}</small></dd></div>
        <div class=${vencidas.length ? 'rojo' : ''}><dt>Vencidas abiertas</dt><dd>${vencidas.length}</dd></div>
        <div><dt>Vencen esta semana</dt><dd>${semana7.length}</dd></div>
        <div><dt>Clientes en riesgo</dt><dd class=${conteo.riesgo ? 'rojo' : ''}>${conteo.riesgo}<small> de ${activos.length}</small></dd></div>
      </dl>
      <p class="tb-regla"><span class="sema s-bien"><i></i>95 % o más</span><span class="sema s-atencion"><i></i>85 a 94 %</span><span class="sema s-riesgo"><i></i>menos de 85 %</span><span class="tenue">Alta pesa 3, Media 2, Baja 1 · últimos ${ventana} días</span></p>
    </section>

    <div class="tb-rejilla">
      <section class="tb-panel tb-ancho">
        <h2>Entregas por semana <${Info} t="Cada barra es una semana: en verde, las tareas que vencían esa semana y se cerraron a tiempo; en rojo, las que se cerraron tarde o siguen abiertas. Arriba, el porcentaje a tiempo de esa semana." /></h2>
        <p class="tb-sub">Tareas que vencían cada semana: cuántas se cerraron a tiempo y cuántas tarde o siguen abiertas.</p>
        <${Semanas} hoy=${hoy} yo=${yo} />
      </section>

      <section class="tb-panel">
        <h2>Clientes activos <${Info} t="La misma entrega a tiempo, solo con las tareas de cada cliente activo. La raya vertical marca la meta de 95 %. Toca un cliente para ver qué llegó tarde." /></h2>
        <p class="tb-sub">${conteo.bien} van bien · ${conteo.atencion} en atención · ${conteo.riesgo} en riesgo</p>
        ${porCliente.length === 0 ? html`<p class="ca-vacio">Aún no hay clientes activos.</p>` : html`<ul class="tb-clientes">${porCliente.map(({ c, cu }) => html`<li key=${c.id}>
          <a href=${'#/cliente/' + c.id} title=${cu.pct === null ? 'Sin entregas en el periodo' : `${cu.nATiempo} de ${cu.evaluadas.length} a tiempo · ${NOMBRE_SALUD[cu.salud]}`}>
            <${LogoCliente} c=${c} tam="s" /><span class="tb-cn">${c.nombre}</span>
            <span class="tb-barra" aria-hidden="true"><i class=${'s-' + (cu.salud || 'nada')} style=${`width:${cu.pct ?? 0}%`}></i><span class="tb-meta" style="left:95%"></span></span>
            <${Semaforo} cu=${cu} corto /></a></li>`)}</ul>`}
      </section>

      <section class="tb-panel">
        <h2>Por persona <${Info} t="Entrega a tiempo de las tareas donde la persona es responsable, y cuántas tiene vencidas hoy." /></h2>
        <p class="tb-sub">Entrega a tiempo de lo que tiene a su cargo y lo que ya se le venció.</p>
        <ul class="tb-personas">${db.personas.map((p) => {
          const cu = cumplimiento((a) => a.responsable === p.id, hoy, ventana);
          const v = vencidas.filter((a) => a.responsable === p.id).length;
          return html`<li key=${p.id}><${Avatar} p=${p} /><span class="tb-cn">${p.id === yo ? 'Tú' : p.corto}</span>
            <span class="tb-barra" aria-hidden="true"><i class=${'s-' + (cu.salud || 'nada')} style=${`width:${cu.pct ?? 0}%`}></i><span class="tb-meta" style="left:95%"></span></span>
            <${Semaforo} cu=${cu} corto />${v ? html`<em class="num rojo">${v} vencida${v === 1 ? '' : 's'}</em>` : html`<em class="num tenue">al día</em>`}</li>`;
        })}</ul>
      </section>

      <section class="tb-panel">
        <h2>Abierto por prioridad <${Info} t="Tareas abiertas de todo el equipo según su prioridad. En rojo, cuántas ya pasaron su fecha." /></h2>
        <p class="tb-sub">${abiertas.length} tareas abiertas en total.</p>
        <${PorPrioridad} abiertas=${abiertas} hoy=${hoy} />
      </section>

      <section class="tb-panel tb-pronto">
        <h2>${I('grafica')}Lo que sigue en el tablero</h2>
        <p class="tb-sub">Entregables de Notion: entregas puntuales contra tardías, aprobadas a la primera contra con rondas extra y por qué hubo cambios. Se conecta cuando des el OK para leer Master Entregables.</p>
      </section>
    </div>
  </div>`;
}

// Barras apiladas por semana: verde = a tiempo, rojo = tarde o abierta vencida. Ocho semanas.
function Semanas({ hoy, yo }) {
  const lunes = lunesDe(hoy);
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(lunes, -7 * (7 - i)));
  const datos = semanas.map((ini) => {
    const fin = sumarDias(ini, 6);
    let bien = 0, mal = 0;
    for (const a of vigentes()) {
      if (a.cliente === 'personal' || !visiblePara(a, yo)) continue;
      const ev = evaluarEntrega(a, hoy);
      if (!ev || ev.limite < ini || ev.limite > fin) continue;
      ev.aTiempo ? bien++ : mal++;
    }
    return { ini, bien, mal, pct: bien + mal ? Math.round((bien / (bien + mal)) * 100) : null };
  });
  const max = Math.max(4, ...datos.map((d) => d.bien + d.mal));
  const W = 640, H = 200, base = 168, alto = 140, paso = W / datos.length, ancho = Math.min(44, paso - 18);
  const y = (n) => (n / max) * alto;
  if (datos.every((d) => !d.bien && !d.mal)) return html`<p class="ca-vacio">Aún no hay tareas vencidas en estas 8 semanas.</p>`;
  return html`
    <div class="tb-leyenda"><span><i class="s-bien"></i>A tiempo</span><span><i class="s-riesgo"></i>Tarde o vencida</span></div>
    <svg class="tb-semanas" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Entregas a tiempo y tarde por semana, últimas 8 semanas">
      ${[0.5, 1].map((k) => html`<line key=${k} x1="0" x2=${W} y1=${base - alto * k} y2=${base - alto * k} class="tb-grid" />`)}
      <line x1="0" x2=${W} y1=${base} y2=${base} class="tb-eje" />
      ${datos.map((d, i) => {
        const x = i * paso + (paso - ancho) / 2;
        const hb = y(d.bien), hm = y(d.mal);
        const gap = hb && hm ? 2 : 0;
        return html`<g key=${d.ini} class="tb-col">
          <title>${`Semana del ${fmtDia(d.ini)}: ${d.bien} a tiempo, ${d.mal} tarde${d.pct === null ? '' : ` (${d.pct} %)`}`}</title>
          <rect x=${i * paso} y="0" width=${paso} height=${H} class="tb-hit" />
          ${hb > 0 && html`<rect x=${x} y=${base - hb} width=${ancho} height=${hb} rx="4" class="f-bien" />`}
          ${hm > 0 && html`<rect x=${x} y=${base - hb - hm - gap} width=${ancho} height=${hm} rx="4" class="f-riesgo" />`}
          ${d.pct !== null && html`<text x=${x + ancho / 2} y=${base - hb - hm - gap - 6} text-anchor="middle" class="tb-val">${d.pct}%</text>`}
          <text x=${x + ancho / 2} y=${H - 10} text-anchor="middle" class="tb-x">${i === datos.length - 1 ? 'Esta' : fmtDia(d.ini)}</text>
        </g>`;
      })}
    </svg>
    <details class="tb-tabla"><summary>Ver como tabla</summary>
      <table><thead><tr><th>Semana</th><th>A tiempo</th><th>Tarde</th><th>%</th></tr></thead>
      <tbody>${datos.map((d) => html`<tr key=${d.ini}><td>${fmtDia(d.ini)}</td><td class="num">${d.bien}</td><td class="num">${d.mal}</td><td class="num">${d.pct ?? '—'}</td></tr>`)}</tbody></table>
    </details>`;
}

function PorPrioridad({ abiertas, hoy }) {
  const filas = PRIORIDADES.map((p) => {
    const l = abiertas.filter((a) => a.prioridad === p.id);
    return { ...p, n: l.length, venc: l.filter((a) => a.fecha < hoy).length };
  });
  const sin = abiertas.filter((a) => !a.prioridad);
  if (sin.length) filas.push({ id: 'nada', nombre: 'Sin prioridad', n: sin.length, venc: sin.filter((a) => a.fecha < hoy).length });
  const max = Math.max(1, ...filas.map((f) => f.n));
  return html`<ul class="tb-pri">${filas.map((f) => html`<li key=${f.id} class=${'pri-' + f.id}>
    <span class="tb-cn"><i></i>${f.nombre}</span>
    <span class="tb-barra" aria-hidden="true"><i style=${`width:${(f.n / max) * 100}%`}></i></span>
    <b class="num">${f.n}</b>${f.venc ? html`<em class="num rojo">${f.venc} vencida${f.venc === 1 ? '' : 's'}</em>` : html`<em></em>`}</li>`)}</ul>`;
}

// ---------- Highlights de Spark225 en el Inicio ----------
// Una franja corta: cómo va la agencia, lo que se cerró esta semana, los clientes y la próxima entrega.
export function HighlightsSpark({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const total = cumplimiento(() => true, hoy, VENTANA_DIAS);
  const lunes = lunesDe(hoy);
  const visibles = vigentes().filter((a) => visiblePara(a, yo) && a.cliente !== 'personal');
  const cerradas = visibles.filter((a) => a.estatus === 'hecho' && (a.cerrada || '').slice(0, 10) >= lunes)
    .sort((a, b) => (b.cerrada || '').localeCompare(a.cerrada || ''));
  const activos = db.clientes.filter((c) => !c.privado && (c.etapa || 'activo') === 'activo' && c.id !== 'interno');
  const salud = { bien: 0, atencion: 0, riesgo: 0 };
  activos.forEach((c) => { const s = cumplimiento((a) => a.cliente === c.id, hoy).salud; if (s) salud[s]++; });
  const proxima = db.proyectos.filter((p) => p.entrega && p.entrega >= hoy).sort((a, b) => a.entrega.localeCompare(b.entrega))[0];
  const cliProx = proxima && db.clientes.find((c) => c.id === proxima.cliente);
  const fmtRel = (iso) => { const d = Math.round((new Date(iso + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 864e5); return d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`; };

  return html`<section class="hl" aria-label="Highlights de Spark225">
    <a href="#/tablero/entregas" class=${'hl-it hl-main s-' + (total.salud || 'nada')}>
      <span class="hl-etq">Spark225 · entrega a tiempo <${Info} t=${T_ENTREGA} /></span>
      <b class="num">${total.pct === null ? '—' : total.pct + ' %'}</b>
      <span class="hl-sub">${total.salud ? html`<span class=${'sema s-' + total.salud}><i></i>${NOMBRE_SALUD[total.salud]}</span>` : 'Sin entregas en 30 días'}</span>
    </a>
    <a href="#/tablero/entregas" class="hl-it">
      <span class="hl-etq">Cerradas esta semana <${Info} t="Tareas de todo el equipo que se marcaron como terminadas desde el lunes." /></span>
      <b class="num">${cerradas.length}</b>
      <span class="hl-sub hl-caras">${cerradas.slice(0, 4).map((a) => html`<${Avatar} key=${a.id} p=${db.personas.find((p) => p.id === a.responsable)} />`)}${cerradas[0] ? html`<span class="hl-ult">${cerradas[0].titulo}</span>` : 'Aún nada'}</span>
    </a>
    <a href="#/clientes" class="hl-it">
      <span class="hl-etq">Clientes activos <${Info} t="Clientes en etapa «Activo». Los puntos cuentan cuántos van bien (95 % o más a tiempo), en atención (85 a 94 %) y en riesgo (menos de 85 %)." /></span>
      <b class="num">${activos.length}</b>
      <span class="hl-sub hl-semas"><span class="sema s-bien"><i></i>${salud.bien}</span><span class="sema s-atencion"><i></i>${salud.atencion}</span><span class="sema s-riesgo"><i></i>${salud.riesgo}</span></span>
    </a>
    ${proxima && html`<a href=${'#/cliente/' + proxima.cliente} class="hl-it">
      <span class="hl-etq">Próxima entrega</span>
      <b class="hl-proy">${cliProx && html`<${LogoCliente} c=${cliProx} tam="s" />`}${proxima.nombre}</b>
      <span class="hl-sub">${cliProx?.nombre} · ${fmtRel(proxima.entrega)}</span>
    </a>`}
  </section>`;
}

// ---------- Orden y limpieza ----------
// Lo que hace que se pierda información: tareas sin proyecto, estancadas o en revisión por mucho tiempo,
// y proyectos sin responsable o sin actualización ejecutiva reciente (mismos criterios que el «Dashboard Operativo» de Notion).
function OrdenLimpieza({ ctx }) {
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const dias = (iso) => Math.round((new Date(hoy + 'T12:00:00') - new Date(iso.slice(0, 10) + 'T12:00:00')) / 864e5);
  const ultimoMov = (a) => [a.creada, ...(a.historial || []).map((h) => h.cuando)].filter(Boolean).sort().pop() || hoy;
  const vivas = vigentes().filter((a) => a.estatus !== 'hecho' && visiblePara(a, yo) && a.cliente !== 'personal');
  const sinProyecto = vivas.filter((a) => !a.proyecto || a.proyecto.startsWith('g-'));
  const sinFecha = vivas.filter((a) => a.sinFecha);
  const estancadas = vivas.filter((a) => a.estatus !== 'esperando' && dias(ultimoMov(a)) > 7).sort((a, b) => ultimoMov(a).localeCompare(ultimoMov(b)));
  const revision = vivas.filter((a) => a.estatus === 'esperando' && dias(ultimoMov(a)) > 7);
  const activos = db.proyectos.filter((p) => !p.id.startsWith('g-') && (p.fase || 'en_curso') !== 'terminado' && p.fase !== 'por_iniciar');
  const sinResp = activos.filter((p) => !p.responsable);
  const sinAct = activos.filter((p) => { const s = saludProyecto(p, hoy); return s.salud !== 'programa' && (s.dias === null || s.dias > 21); });
  const per = (id) => db.personas.find((x) => x.id === id);
  const cli = (id) => db.clientes.find((c) => c.id === id);
  const filaTarea = (a, extra) => html`<li key=${a.id}><button onClick=${() => ctx.abrir(a.id)}><span class="cl-t">${a.titulo}</span><small class="tenue">${cli(a.cliente)?.nombre || ''}</small><${Avatar} p=${per(a.responsable)} /><span class="num cl-f">${extra}</span></button></li>`;
  const filaProy = (p, extra) => html`<li key=${p.id}><a class="fila-enlace" href=${'#/proyecto/' + p.id}><span class="cl-t">${p.nombre}</span><small class="tenue">${cli(p.cliente)?.nombre || ''}</small><span class="num cl-f">${extra}</span></a></li>`;
  const bloque = (titulo, ayuda, lista, fila, vacio) => html`<section class="tb-panel">
    <h2>${titulo}<span class=${'ol-n num' + (lista.length ? ' hay' : '')}>${lista.length}</span></h2><p class="tb-sub">${ayuda}</p>
    ${lista.length ? html`<ul class="ca-lista">${lista.slice(0, 12).map(fila)}</ul>${lista.length > 12 ? html`<p class="tb-sub">Y ${lista.length - 12} más.</p>` : ''}` : html`<p class="ca-vacio">${I('check')} ${vacio}</p>`}
  </section>`;
  return html`<div class="tb-rejilla">
    ${bloque('Tareas sin proyecto', 'Están en «General» del cliente. Ligarlas a su proyecto evita que se pierdan si alguien sale del equipo.', sinProyecto, (a) => filaTarea(a, fechaCorta(a.fecha)), 'Todas las tareas tienen proyecto.')}
    ${bloque('Tareas sin fecha compromiso', 'En Notion no tienen «Fecha Compromiso de Entrega», así que no se puede medir si llegan a tiempo. Ponles fecha.', sinFecha, (a) => filaTarea(a, 'sin fecha'), 'Todas tienen fecha.')}
    ${bloque('Tareas estancadas', 'Abiertas y sin ningún movimiento en más de 7 días.', estancadas, (a) => filaTarea(a, `${dias(ultimoMov(a))} d`), 'Nada estancado.')}
    ${bloque('En revisión hace más de 7 días', 'Esperan respuesta (del cliente o de otra persona) desde hace más de una semana.', revision, (a) => filaTarea(a, `${dias(ultimoMov(a))} d`), 'Nada esperando de más.')}
    ${bloque('Proyectos sin actualización ejecutiva', 'Activos y sin «Actualización ejecutiva» en más de 21 días (se actualiza en Notion).', sinAct, (p) => filaProy(p, saludProyecto(p, hoy).dias === null ? 'sin fecha' : `${saludProyecto(p, hoy).dias} d`), 'Todos al día.')}
    ${bloque('Proyectos sin responsable', 'Activos y sin «Project Owner» en Notion.', sinResp, (p) => filaProy(p, ''), 'Todos tienen responsable.')}
  </div>`;
}
