// Inicio: elige cómo ver tu calendario (Día, Semana, Mes, Tarjetas) y cómo acomodar los widgets.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias, ESTATUS, VISTAS, ACOMODOS } from './datos.js?v=202611241457';
import { vigentes, participa, visiblePara, estatusVisible, prefsDe, guardarPrefs } from './store.js?v=202611241457';
import { I, Anillo, Avatar, fechaRelativa, fechaCorta } from './ui.js?v=202611241457';
import { DiaCal, useAhora, arrastrarActividad, teclasActividad } from './mecha.js?v=202611241457';
import { Widgets } from './widgets.js?v=202611241457';
import { useArrastre } from './arrastre.js?v=202611241457';

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
  } else { titulo = 'Tarjetas'; sub = ''; }

  const paso = vista === 'semana' ? 7 : vista === 'mes' ? 30 : 1;
  const mover = (n) => {
    if (vista === 'mes') { const d = new Date(fecha + 'T12:00:00'); d.setMonth(d.getMonth() + n, 1); setFecha(hoyISO(d)); }
    else setFecha(sumarDias(fecha, n * paso));
  };

  const cal = vista === 'dia' ? html`<${DiaCal} ctx=${ctx} ahora=${ahora} />`
    : vista === 'semana' ? html`<${Semana} ctx=${ctx} hoy=${hoy} />`
    : vista === 'mes' ? html`<${Mes} ctx=${ctx} hoy=${hoy} />`
    : html`<${Tarjetas} ctx=${ctx} hoy=${hoy} />`;
  const widgets = html`<${Widgets} ctx=${ctx} persona=${persona} editable=${propia} hoy=${hoy} ancho=${acomodo === 'arriba' || acomodo === 'widgets'} />`;

  return html`
    <header class="cab-inicio">
      <div class="cab-dia" data-tour="titulo">
        <h1>${titulo}</h1><span class="sub">${sub}</span>
        ${vista !== 'tarjetas' && vista !== 'dia' && html`<span class="nav-flechas">
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
    <div class=${'inicio a-' + acomodo}>
      ${acomodo !== 'widgets' && html`<section class="col-cal" data-tour="calendario">${cal}</section>`}
      ${acomodo !== 'calendario' && widgets}
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

function misActs(ctx) { return vigentes().filter((a) => participa(a, ctx.persona) && visiblePara(a, ctx.yo)); }
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
