// Inicio: elige cómo ver tu calendario (Día, Semana, Mes, Tarjetas) y cómo acomodar los widgets.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias, ESTATUS, VISTAS, ACOMODOS, PRIORIDADES } from './datos.js?v=202611270745';
import { vigentes, participa, visiblePara, estatusVisible, prefsDe, guardarPrefs, enFiltroInicio, actualizar } from './store.js?v=202611270745';
import { I, Anillo, Avatar, fechaRelativa, fechaCorta } from './ui.js?v=202611270745';
import { DiaCal, useAhora, arrastrarActividad, teclasActividad } from './mecha.js?v=202611270745';
import { Widgets } from './widgets.js?v=202611270745';
import { HighlightsSpark } from './tablero.js?v=202611270745';
import { BasesSpark, AccesosSpark } from './bases.js?v=202611270745';
import { useArrastre } from './arrastre.js?v=202611270745';

const fmt = (o) => new Intl.DateTimeFormat('es-MX', o);
const lunesDe = (iso) => { const d = new Date(iso + 'T12:00:00'); return sumarDias(iso, -((d.getDay() + 6) % 7)); };
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function Inicio(ctx) {
  const { db, yo, persona, fecha, setFecha } = ctx;
  const ahora = useAhora();
  const hoy = hoyISO(ahora);
  const prefs = prefsDe(yo);
  const propia = persona === yo;
  const p = db.personas.find((x) => x.id === persona);
  const [menuAcomodo, setMenuAcomodo] = useState(false);
  const vista = prefs.vista, acomodo = prefs.acomodo;

  let titulo, sub;
  if (vista === 'dia') {
    titulo = fecha === hoy ? 'Hoy' : fechaRelativa(fecha) === 'mañana' ? 'Mañana' : fechaRelativa(fecha) === 'ayer' ? 'Ayer' : mayus(fmt({ weekday: 'long' }).format(new Date(fecha + 'T12:00:00')));
    sub = fmt({ day: 'numeric', month: 'long' }).format(new Date(fecha + 'T12:00:00'));
  } else if (vista === 'semana') {
    const l = lunesDe(fecha);
    titulo = 'Semana'; sub = `${fechaCorta(l)} – ${fechaCorta(sumarDias(l, 6))}`;
  } else if (vista === 'mes') {
    titulo = mayus(fmt({ month: 'long' }).format(new Date(fecha + 'T12:00:00'))); sub = fecha.slice(0, 4);
  } else if (propia) {
    // En Lista y Tarjetas el título es el día: siempre sabes dónde estás.
    titulo = 'Hoy'; sub = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(hoy + 'T12:00:00'));
  } else { titulo = vista === 'lista' ? 'Lista' : 'Tarjetas'; sub = ''; }
  const mostrarSpark = propia && (prefs.highlights !== false || prefs.bases !== false);
  const pest = mostrarSpark ? prefs.inicioPestana || 'trabajo' : 'trabajo';

  const paso = vista === 'semana' ? 7 : vista === 'mes' ? 30 : 1;
  const mover = (n) => {
    if (vista === 'mes') { const d = new Date(fecha + 'T12:00:00'); d.setMonth(d.getMonth() + n, 1); setFecha(hoyISO(d)); }
    else setFecha(sumarDias(fecha, n * paso));
  };

  const cal = vista === 'dia' ? html`<${DiaCal} ctx=${ctx} ahora=${ahora} />`
    : vista === 'semana' ? html`<${Semana} ctx=${ctx} hoy=${hoy} />`
    : vista === 'mes' ? html`<${Mes} ctx=${ctx} hoy=${hoy} />`
    : vista === 'lista' ? html`<${Lista} ctx=${ctx} hoy=${hoy} />`
    : html`<${Tarjetas} ctx=${ctx} hoy=${hoy} />`;
  const widgets = html`<${Widgets} ctx=${ctx} persona=${persona} editable=${propia} hoy=${hoy} ancho=${acomodo === 'arriba' || acomodo === 'widgets'} />`;

  return html`
    <header class="cab-inicio">
      <div class="cab-dia" data-tour="titulo">
        <h1>${titulo}</h1><span class="sub">${sub}</span>
        ${!['tarjetas', 'lista', 'dia'].includes(vista) && html`<span class="nav-flechas">
          <button class="icon-btn" onClick=${() => mover(-1)} aria-label="Anterior">${I('flecha')}</button>
          <button class="btn fantasma chico" onClick=${() => setFecha(hoy)}>Hoy</button>
          <button class="icon-btn" onClick=${() => mover(1)} aria-label="Siguiente">${I('flecha', 'rot-180')}</button></span>`}
        ${!propia && html`<a class="quien" href="#/" title="Volver a tu inicio"><${Avatar} p=${p} />${p.corto}${I('x')}</a>`}
      </div>
      <div class="cab-controles">
        <div class="segmentado vistas" role="tablist" aria-label="Vista" data-tour="vistas">
          ${VISTAS.map((v) => html`<button key=${v.id} role="tab" aria-selected=${vista === v.id} aria-pressed=${vista === v.id} onClick=${() => guardarPrefs(yo, { vista: v.id })} title=${v.nombre}>${I(v.icono)}<span>${v.nombre}</span></button>`)}
        </div>
        <div class="rel">
          <button class="icon-btn" aria-label="Acomodo del inicio" title="Acomodo" onClick=${() => setMenuAcomodo(!menuAcomodo)} data-tour="acomodo">${I('diseno')}</button>
          ${menuAcomodo && html`<${MenuAcomodo} actual=${acomodo} elegir=${(id) => { guardarPrefs(yo, { acomodo: id }); setMenuAcomodo(false); }} cerrar=${() => setMenuAcomodo(false)} />`}
        </div>
      </div>
    </header>
    ${(propia || mostrarSpark) && html`<div class="ini-fila">
      ${propia && html`<${ResumenHoy} ctx=${ctx} hoy=${hoy} />`}
      ${mostrarSpark && html`<div class="segmentado ini-pest" role="tablist" aria-label="Inicio">${[['trabajo', 'Mi trabajo', 'lista'], ['spark', 'Spark225', 'grafica']].map(([k, t, ico]) => html`<button key=${k} role="tab" aria-selected=${pest === k} aria-pressed=${pest === k} onClick=${() => guardarPrefs(yo, { inicioPestana: k })}>${I(ico)}<span>${t}</span></button>`)}</div>`}
    </div>`}
    ${pest === 'spark' ? html`
      ${prefs.highlights !== false && html`<${HighlightsSpark} ctx=${ctx} />`}
      ${prefs.bases !== false && html`<${BasesSpark} ctx=${ctx} />`}` : html`
      <${FiltroClientes} ctx=${ctx} />
      <div class=${'inicio a-' + acomodo}>
        ${acomodo !== 'widgets' && html`<section class="col-cal" data-tour="calendario">${cal}</section>`}
        ${acomodo !== 'calendario' && widgets}
      </div>
      ${propia && prefs.bases !== false && html`<${AccesosSpark} />`}`}`;
}

// Los números del día, arriba de todo: lo primero que ves al entrar. Tocar uno te lleva a la lista.
function ResumenHoy({ ctx, hoy }) {
  const { yo } = ctx;
  const mias = vigentes().filter((a) => participa(a, yo) && visiblePara(a, yo) && a.estatus !== 'hecho');
  const venc = mias.filter((a) => !a.sinFecha && a.fecha < hoy).length;
  const deHoy = mias.filter((a) => !a.sinFecha && a.fecha === hoy).length;
  const rev = mias.filter((a) => estatusVisible(a) === 'esperando').length;
  const ir = () => guardarPrefs(yo, { vista: 'lista', listaPor: 'semana', listaAlcance: 'mias', inicioPestana: 'trabajo' });
  const chip = (n, uno, varios, clase) => html`<button class=${'rh-chip ' + clase + (n ? '' : ' cero')} onClick=${ir}><b class="num">${n}</b>${n === 1 ? uno : varios}</button>`;
  return html`<div class="resumen-hoy" aria-label="Tu día">${chip(venc, 'vencida', 'vencidas', 'r')}${chip(deHoy, 'para hoy', 'para hoy', 'h')}${chip(rev, 'en revisión', 'en revisión', 'e')}</div>`;
}

// Filtro por cliente del Inicio: afecta calendario, tarjetas y widgets.
function FiltroClientes({ ctx }) {
  const { db, yo, persona } = ctx;
  const sel = prefsDe(yo).inicioCliente || null;
  const abiertas = vigentes().filter((a) => participa(a, persona) && visiblePara(a, yo) && a.estatus !== 'hecho');
  const clientes = db.clientes.filter((c) => abiertas.some((a) => a.cliente === c.id) || c.id === sel);
  if (clientes.length < 2 && !sel) return null;
  return html`<div class="pf-grupo pf-clientes filtro-inicio" role="group" aria-label="Filtrar por cliente">
    <button class="chip-op" aria-pressed=${!sel} onClick=${() => guardarPrefs(yo, { inicioCliente: null })}>Todos</button>
    ${clientes.map((c) => { const n = abiertas.filter((a) => a.cliente === c.id).length; return html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} aria-pressed=${sel === c.id} onClick=${() => guardarPrefs(yo, { inicioCliente: sel === c.id ? null : c.id })}><i></i>${c.nombre}${n ? html`<em class="num">${n}</em>` : null}</button>`; })}
  </div>`;
}

function MenuAcomodo({ actual, elegir, cerrar }) {
  const ref = useRef();
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    setTimeout(() => addEventListener('pointerdown', f), 0);
    return () => removeEventListener('pointerdown', f);
  }, []);
  return html`<div class="menu-acomodo" ref=${ref} role="menu">
    ${ACOMODOS.map((a) => html`<button key=${a.id} role="menuitemradio" aria-checked=${actual === a.id} onClick=${() => elegir(a.id)} title=${a.nombre}>
      <span class=${'mini-acomodo m-' + a.id}><i class="c"></i><i class="w"></i></span><span>${a.nombre}</span></button>`)}
  </div>`;
}

function misActs(ctx) { return vigentes().filter((a) => participa(a, ctx.persona) && visiblePara(a, ctx.yo) && enFiltroInicio(a, ctx.yo)); }
const colorDe = (ctx, a) => ctx.db.clientes.find((c) => c.id === a.cliente)?.color;

// Tarjeta compacta reutilizable (Semana y Mes).
function Ficha({ a, ctx, hoy, mini }) {
  const ev = estatusVisible(a);
  const arr = useArrastre();
  return html`<div class=${'ficha' + (mini ? ' mini' : '') + (a.estatus === 'hecho' ? ' hecha' : '') + (a.fecha < hoy && a.estatus !== 'hecho' ? ' vencida' : '') + (arr?.datos?.actividad === a.id ? ' fantasma' : '')}
    style=${`--c:${colorDe(ctx, a)}`} tabindex="0" role="button" aria-label=${a.titulo}
    onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
    ${!mini && html`<button class="anillo-mini" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${ev}><${Anillo} estatus=${ev} /></button>`}
    <span class="f-t">${a.titulo}</span>
    ${!mini && a.bloque && html`<span class="f-h num">${a.bloque.inicio}</span>`}
  </div>`;
}

// ---------- Semana: 7 columnas, arrastra entre días ----------
function Semana({ ctx, hoy }) {
  const arr = useArrastre();
  const l = lunesDe(ctx.fecha);
  const dias = [0, 1, 2, 3, 4, 5, 6].map((n) => sumarDias(l, n));
  const acts = misActs(ctx);
  return html`<div class="semana">${dias.map((f) => {
    const lista = acts.filter((a) => a.fecha === f).sort((a, b) => (a.bloque ? a.bloque.inicio : '99').localeCompare(b.bloque ? b.bloque.inicio : '99'));
    const d = new Date(f + 'T12:00:00');
    const sobre = arr?.destino?.tipo === 'dia' && arr.destino.fecha === f;
    return html`<div key=${f} class=${'sem-col' + (f === hoy ? ' hoy' : '') + (sobre ? ' sobre' : '')} data-drop="dia" data-fecha=${f}>
      <button class="sem-cab" onClick=${() => { ctx.setFecha(f); guardarPrefs(ctx.yo, { vista: 'dia' }); }}>
        <span>${fmt({ weekday: 'short' }).format(d).replace('.', '')}</span><b class="num">${d.getDate()}</b></button>
      <div class="sem-lista">${lista.map((a) => html`<${Ficha} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} />`)}</div>
      <button class="sem-mas" onClick=${() => ctx.nueva({ fecha: f })} aria-label="Agregar">${I('mas')}</button>
    </div>`;
  })}</div>`;
}

// ---------- Mes: cuadrícula con puntos y fichas mini ----------
function Mes({ ctx, hoy }) {
  const arr = useArrastre();
  const primero = ctx.fecha.slice(0, 8) + '01';
  const inicio = lunesDe(primero);
  const mes = ctx.fecha.slice(5, 7);
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const acts = misActs(ctx);
  const sem = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return html`<div class="mes">
    ${sem.map((s, i) => html`<div class="mes-sem" key=${'s' + i}>${s}</div>`)}
    ${dias.map((f) => {
      const lista = acts.filter((a) => a.fecha === f);
      const sobre = arr?.destino?.tipo === 'dia' && arr.destino.fecha === f;
      return html`<div key=${f} class=${'mes-dia' + (f.slice(5, 7) !== mes ? ' fuera' : '') + (f === hoy ? ' hoy' : '') + (sobre ? ' sobre' : '')} data-drop="dia" data-fecha=${f}
        onClick=${(e) => { if (e.target.closest('.ficha')) return; ctx.setFecha(f); guardarPrefs(ctx.yo, { vista: 'dia' }); }}>
        <span class="mes-num num">${+f.slice(8)}</span>
        ${lista.slice(0, 3).map((a) => html`<${Ficha} key=${a.id} a=${a} ctx=${ctx} hoy=${hoy} mini />`)}
        ${lista.length > 3 && html`<span class="mes-mas">+${lista.length - 3}</span>`}
      </div>`;
    })}
  </div>`;
}

// ---------- Tarjetas cuadradas: por estatus o por cliente; arrastra para cambiar ----------
function Tarjetas({ ctx, hoy }) {
  const [por, setPor] = useState('estatus');
  const arr = useArrastre();
  const acts = misActs(ctx).filter((a) => a.estatus !== 'hecho' || (a.cerrada || '').slice(0, 10) >= sumarDias(hoy, -2));
  const grupos = por === 'estatus'
    ? ESTATUS.map((s) => ({ id: s.id, nombre: s.nombre, lista: acts.filter((a) => estatusVisible(a) === s.id), drop: { 'data-drop': 'estatus', 'data-estatus': s.id }, icono: html`<${Anillo} estatus=${s.id} />` }))
    : ctx.db.clientes.filter((c) => !c.privado || ctx.persona === ctx.yo).map((c) => ({ id: c.id, nombre: c.nombre, color: c.color, lista: acts.filter((a) => a.cliente === c.id), drop: { 'data-drop': 'cliente', 'data-cliente': c.id } })).filter((g) => g.lista.length || arr);
  return html`
    <div class="segmentado chico tj-por">${[['estatus', 'Estatus'], ['cliente', 'Cliente']].map(([k, t]) => html`<button key=${k} aria-pressed=${por === k} onClick=${() => setPor(k)}>${t}</button>`)}</div>
    <div class="tarjetas">${grupos.map((g) => {
      const sobre = arr?.destino && (arr.destino.estatus === g.id || arr.destino.cliente === g.id);
      return html`<section key=${g.id} class=${'tj-grupo' + (sobre ? ' sobre' : '')} ...${g.drop} style=${g.color ? `--c:${g.color}` : ''}>
        <h3>${g.icono || html`<i class="bolita" style=${`--c:${g.color}`}></i>`}${g.nombre}<span class="num">${g.lista.length}</span></h3>
        <div class="tj-grid">${g.lista.map((a) => {
          const ev = estatusVisible(a);
          return html`<div key=${a.id} class=${'tj' + (a.estatus === 'hecho' ? ' hecha' : '') + (arr?.datos?.actividad === a.id ? ' fantasma' : '')} style=${`--c:${colorDe(ctx, a)}`}
            tabindex="0" role="button" aria-label=${a.titulo} onPointerDown=${(e) => arrastrarActividad(e, a, ctx)} onKeyDown=${(e) => teclasActividad(e, a, ctx)} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
            <div class="tj-top"><span class="tj-cli">${ctx.db.clientes.find((c) => c.id === a.cliente)?.nombre}</span>
              <button class="anillo-mini" onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${ev}><${Anillo} estatus=${ev} /></button></div>
            <div class="tj-t">${a.titulo}</div>
            <div class=${'tj-f' + (a.fecha < hoy && a.estatus !== 'hecho' ? ' alerta' : '')}>${fechaRelativa(a.fecha)}${a.bloque ? ` · ${a.bloque.inicio}` : ''}</div>
          </div>`;
        })}</div>
      </section>`;
    })}</div>`;
}

// ---------- Lista: las tareas en filas, como una tabla de Notion ----------
// Vencidas arriba y en rojo; agrupa por estatus, cliente o persona; ordena tocando el encabezado.
const PRI = Object.fromEntries(PRIORIDADES.map((p) => [p.id, p]));
const SIG_PRI = { alta: 'media', media: 'baja', baja: null, null: 'alta' };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

// Las vistas de Master Task Database usan esta misma lista: «filtro» decide qué tareas entran (incluidas las hechas),
// «porFijo» fija la agrupación, «soloMias» la limita a ti y «ordenInicial» cambia el orden de arranque.
export function Lista({ ctx, hoy, equipo, filtro, porFijo, soloMias, ordenInicial }) {
  const { db, yo, persona } = ctx;
  const prefs = prefsDe(yo);
  const por = porFijo || prefs.listaPor || 'semana';
  const alcance = equipo ? 'equipo' : soloMias ? 'mias' : prefs.listaAlcance || 'mias';
  const [orden, setOrden] = useState(ordenInicial || { col: 'fecha', dir: 1 });
  const [hechas, setHechas] = useState(false);
  const [soloVencidas, setSoloVencidas] = useState(false);

  const vencida = (a) => a.estatus !== 'hecho' && !a.sinFecha && a.fecha < hoy;
  const base = filtro
    ? (alcance === 'equipo' ? vigentes().filter((a) => visiblePara(a, yo)) : misActs(ctx)).filter(filtro)
    : (alcance === 'equipo' ? vigentes().filter((a) => visiblePara(a, yo) && enFiltroInicio(a, yo)) : misActs(ctx))
      .filter((a) => a.estatus !== 'hecho' || (hechas && (a.cerrada || '').slice(0, 10) >= sumarDias(hoy, -14)));
  const nVencidas = base.filter(vencida).length;
  const acts = soloVencidas ? base.filter(vencida) : base;

  const cli = (a) => db.clientes.find((c) => c.id === a.cliente);
  const per = (id) => db.personas.find((p) => p.id === id);
  const proy = (a) => db.proyectos.find((p) => p.id === a.proyecto);
  const llave = {
    titulo: (a) => (a.titulo || '').toLowerCase(),
    cliente: (a) => (cli(a)?.nombre || '').toLowerCase(),
    responsable: (a) => (per(a.responsable)?.corto || '').toLowerCase(),
    fecha: (a) => a.fecha || '9999',
    entrega: (a) => a.entregaReal || (a.cerrada || '').slice(0, 10) || a.fecha || '',
    prioridad: (a) => PRI[a.prioridad]?.orden ?? 9,
  };
  const ordenar = (lista) => [...lista].sort((x, y) => {
    if (orden.col === 'fecha' && vencida(x) !== vencida(y)) return vencida(x) ? -1 : 1; // vencidas siempre arriba
    const a = llave[orden.col](x), b = llave[orden.col](y);
    return (a < b ? -1 : a > b ? 1 : 0) * orden.dir || (x.fecha < y.fecha ? -1 : 1);
  });

  // Mi semana: cada tarea cae en un solo grupo (en revisión primero, luego por fecha).
  const tramo = (a) => (a.estatus === 'hecho' ? 'terminadas' : a.estatus === 'esperando' ? 'revision' : a.sinFecha ? 'despues' : a.fecha < hoy ? 'vencidas' : a.fecha === hoy ? 'hoy' : a.fecha <= sumarDias(hoy, 7) ? 'proximos' : 'despues');
  const TRAMOS = [['vencidas', 'Vencidas', 'alerta'], ['hoy', 'Hoy', 'hoy'], ['proximos', 'Próximos 7 días', 'semana'], ['revision', 'En revisión', 'espera'], ['despues', 'Más adelante', 'flecha'], ['terminadas', 'Terminadas', 'check']];
  const grupos = por === 'semana'
    ? TRAMOS.map(([id, nombre, ico]) => ({ id, nombre, icono: I(ico, id === 'despues' ? 'rot-180' : ''), lista: acts.filter((a) => tramo(a) === id) }))
    : por === 'estatus'
    ? ESTATUS.map((s) => ({ id: s.id, nombre: s.nombre, icono: html`<${Anillo} estatus=${s.id} />`, lista: acts.filter((a) => estatusVisible(a) === s.id) }))
    : por === 'cliente'
      ? db.clientes.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color, lista: acts.filter((a) => a.cliente === c.id) }))
      : por === 'persona'
        ? db.personas.map((p) => ({ id: p.id, nombre: p.corto, icono: html`<${Avatar} p=${p} />`, lista: acts.filter((a) => a.responsable === p.id) }))
        : [{ id: 'todas', nombre: null, lista: acts }];

  const encabezado = (col, texto, clase = '') => html`<th class=${clase} aria-sort=${orden.col === col ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}>
    <button onClick=${() => setOrden((o) => ({ col, dir: o.col === col ? -o.dir : 1 }))}>${texto}${orden.col === col && I('flecha', orden.dir > 0 ? 'rot-abajo' : 'rot-arriba')}</button></th>`;
  const cambiarPri = (e, a) => { e.stopPropagation(); actualizar(a.id, { prioridad: SIG_PRI[a.prioridad ?? null] }, yo); };
  const quien = persona === yo ? 'Mías' : per(persona)?.corto;
  const opcion = (k, t, valor, f) => html`<button key=${k} aria-pressed=${valor === k} onClick=${() => f(k)}>${t}</button>`;

  return html`
    <div class="ls-barra">
      ${!equipo && !soloMias && html`<div class="segmentado chico" aria-label="De quién">${[['mias', quien], ['equipo', 'Equipo']].map(([k, t]) => opcion(k, t, alcance, (v) => guardarPrefs(yo, { listaAlcance: v })))}</div>`}
      ${!porFijo && html`<div class="segmentado chico" aria-label="Agrupar por">${[['semana', 'Mi semana'], ['estatus', 'Estatus'], ['cliente', 'Cliente'], ['persona', 'Persona'], ['nada', 'Sin agrupar']].map(([k, t]) => opcion(k, t, por, (v) => guardarPrefs(yo, { listaPor: v })))}</div>`}
      ${nVencidas > 0 && html`<button class=${'ls-vencidas' + (soloVencidas ? ' on' : '')} aria-pressed=${soloVencidas} onClick=${() => setSoloVencidas(!soloVencidas)}>${I('alerta')}${nVencidas} ${nVencidas === 1 ? 'vencida' : 'vencidas'}</button>`}
      ${!filtro && html`<label class="ls-hechas"><input type="checkbox" checked=${hechas} onChange=${() => setHechas(!hechas)} />Ver hechas</label>`}
    </div>
    ${!acts.length ? html`<div class="ls-vacia"><p>${soloVencidas ? 'Nada vencido.' : 'No hay tareas con este filtro.'}</p><button class="btn prim" onClick=${() => ctx.nueva()}>Nueva tarea</button></div>` : html`
    <div class="ls-marco">
      <table class="ls">
        <thead><tr>
          ${encabezado('titulo', 'Tarea', 'c-tarea')}
          ${encabezado('cliente', 'Cliente', 'c-cli')}
          ${encabezado('responsable', 'Responsable', 'c-resp')}
          ${encabezado('fecha', 'Fecha', 'c-fecha')}
          ${encabezado('prioridad', 'Prioridad', 'c-pri')}
        </tr></thead>
        ${grupos.filter((g) => g.lista.length).map((g) => html`<tbody key=${g.id}>
          ${g.nombre && html`<tr class="ls-grupo"><th colspan="5" scope="rowgroup"><span>${g.icono || html`<i class="bolita" style=${`--c:${g.color}`}></i>`}${g.nombre}<b>${g.lista.length}</b></span></th></tr>`}
          ${ordenar(g.lista).map((a) => {
            const ev = estatusVisible(a), c = cli(a), r = per(a.responsable), v = vencida(a), pri = PRI[a.prioridad];
            const atraso = v ? diasEntre(a.fecha, hoy) : 0;
            return html`<tr key=${a.id} class=${'ls-fila' + (a.estatus === 'hecho' ? ' hecha' : '') + (v ? ' vencida' : '')} tabindex="0"
              onClick=${() => ctx.abrir(a.id)} onKeyDown=${(e) => { if (e.key === 'Enter') ctx.abrir(a.id); else teclasActividad(e, a, ctx); }} onContextMenu=${(e) => ctx.abrirMenu(e, a)}>
              <td class="c-tarea"><div class="ls-t">
                <button class="anillo-mini" onClick=${(e) => { e.stopPropagation(); ctx.avanzar(a); }} aria-label=${`Estatus: ${ev}. Avanzar`}><${Anillo} estatus=${ev} /></button>
                <span><span class="ls-tit">${a.titulo}</span>${proy(a) && proy(a).nombre !== 'General' && html`<small>${proy(a).nombre}</small>`}</span></div></td>
              <td class="c-cli">${c && html`<span class="ls-cli" style=${`--c:${c.color}`}><i></i>${c.nombre}</span>`}</td>
              <td class="c-resp">${r && html`<span class="ls-per"><${Avatar} p=${r} />${r.corto}</span>`}</td>
              <td class="c-fecha">${a.estatus === 'hecho' && a.entregaReal ? html`<span title="Fecha Entrega REAL">Entregada ${fechaRelativa(a.entregaReal)}</span>` : a.sinFecha ? html`<span class="tenue">Sin fecha</span>` : v ? html`<span class="ls-atraso">${atraso} ${atraso === 1 ? 'día' : 'días'} tarde</span>` : fechaRelativa(a.fecha)}</td>
              <td class="c-pri"><button class=${'ls-pri pri-' + (a.prioridad || 'nada')} onClick=${(e) => cambiarPri(e, a)} title="Cambiar prioridad" aria-label=${`Prioridad: ${pri?.nombre || 'sin prioridad'}. Cambiar`}>${pri ? html`<i></i>${pri.nombre}` : '—'}</button></td>
            </tr>`;
          })}
        </tbody>`)}
      </table>
    </div>`}`;
}
