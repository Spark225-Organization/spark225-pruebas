// Asistentes para crear: una pregunta a la vez, con guía y sin formularios largos.
// Sirve para tarea, cliente y proyecto. Enter avanza, Esc cierra, cada respuesta se puede corregir en el resumen.
import { html, useState, useEffect, useLayoutEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias, SALUD, CARITAS, COLORES_CLIENTE, PRIORIDADES, ETAPAS_CLIENTE } from './datos.js?v=202611270800';
import { crear, nuevaVacia, crearCliente, crearProyecto } from './store.js?v=202611270800';
import { I, Avatar, LogoCliente, Carita, fechaRelativa, fechaCorta } from './ui.js?v=202611270800';

// ---------- Opciones de fecha que entiende cualquiera ----------
function opcionesFecha(conSinFecha) {
  const h = hoyISO();
  const dow = new Date(h + 'T12:00:00').getDay();
  const viernes = sumarDias(h, (5 - dow + 7) % 7);
  const lunes = sumarDias(h, ((8 - dow) % 7) || 7);
  const d = new Date(h + 'T12:00:00'); d.setMonth(d.getMonth() + 1, 0);
  const finMes = hoyISO(d);
  const l = [
    { id: h, nombre: 'Hoy' },
    { id: sumarDias(h, 1), nombre: 'Mañana' },
    { id: viernes, nombre: viernes === h ? 'Hoy viernes' : 'Este viernes' },
    { id: lunes, nombre: 'Próxima semana' },
    { id: finMes, nombre: 'Fin de mes' },
  ];
  const vistos = new Set();
  const unicas = l.filter((o) => (vistos.has(o.id) ? false : vistos.add(o.id)));
  return conSinFecha ? [...unicas, { id: '', nombre: 'Sin fecha' }] : unicas;
}

// ---------- Asistente genérico ----------
export function Asistente({ titulo, pasos, inicial, textoCrear, alCrear, cerrar, Vista }) {
  const [v, setV] = useState(inicial);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState('');
  const activos = pasos.filter((p) => !p.si || p.si(v));
  const enResumen = i >= activos.length;
  const paso = activos[i];
  const total = activos.length + 1;

  const listo = (p, val) => (p.opcional ? true : p.tipo === 'texto' ? !!(val || '').trim() : val !== undefined && val !== null && val !== '__');
  const ir = (n) => { setDir(n > i ? 1 : -1); setError(''); setI(Math.max(0, Math.min(activos.length, n))); };
  const siguiente = (valorNuevo) => {
    let val = valorNuevo !== undefined ? valorNuevo : v[paso.id];
    // Respaldo: si el navegador no avisó del texto (autocompletar, acentos), se lee del campo.
    if (paso.tipo === 'texto') {
      const dom = document.querySelector('.asis-texto input')?.value;
      if (dom !== undefined && dom !== val) { val = dom; setV((x) => ({ ...x, [paso.id]: dom })); }
    }
    if (!listo(paso, val)) { setError(paso.falta || 'Responde para seguir.'); return; }
    ir(i + 1);
  };
  const elegir = (val) => { setV((x) => ({ ...x, [paso.id]: val })); setTimeout(() => siguiente(val), 170); };
  const terminar = () => { const r = alCrear(v); if (r === false) return; cerrar(); };

  // El teclado siempre usa el estado más reciente (vía ref), aunque se escriba muy rápido.
  const ultimo = useRef();
  ultimo.current = { enResumen, siguiente, terminar, cerrar };
  useEffect(() => {
    const k = (e) => {
      const u = ultimo.current;
      if (e.key === 'Escape') { e.preventDefault(); u.cerrar(); }
      else if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement?.type === 'date') return;
        if (document.activeElement?.tagName === 'BUTTON') return; // un botón enfocado ya responde a Enter por sí solo
        e.preventDefault(); u.enResumen ? u.terminar() : u.siguiente();
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="asis" role="dialog" aria-modal="true" aria-label=${titulo}>
      <div class="asis-top">
        <span class="asis-tit">${titulo}</span>
        <span class="asis-n num">${Math.min(i + 1, total)} de ${total}</span>
        <button class="icon-btn chico" onClick=${cerrar} aria-label="Cerrar">${I('x')}</button>
      </div>
      <div class="asis-barra"><i style=${`width:${((i + 1) / total) * 100}%`}></i></div>
      <div class=${'asis-paso ' + (dir > 0 ? 'de-der' : 'de-izq')} key=${enResumen ? 'resumen' : paso.id}>
        ${enResumen
          ? html`<h2 class="asis-q">¿Todo bien?</h2>
            <p class="asis-ayuda">Toca cualquier dato para corregirlo.</p>
            ${Vista && html`<div class="asis-vista"><${Vista} v=${v} /></div>`}
            <ul class="asis-resumen">${activos.map((p, k) => html`<li key=${p.id}><button onClick=${() => ir(k)}><span>${p.corto}</span><b>${p.resumen(v[p.id], v) || '—'}</b>${I('flecha', 'rot-180')}</button></li>`)}</ul>`
          : html`<h2 class="asis-q">${paso.pregunta}</h2>
            ${paso.ayuda && html`<p class="asis-ayuda">${paso.ayuda}</p>`}
            <${Campo} paso=${paso} valor=${v[paso.id]} todo=${v} poner=${(val) => { setError(''); setV((x) => ({ ...x, [paso.id]: val })); }} elegir=${elegir} />
            ${error && html`<p class="asis-error" role="alert">${I('alerta')}${error}</p>`}`}
      </div>
      <div class="asis-pie">
        ${i > 0 ? html`<button class="btn fantasma" onClick=${() => ir(i - 1)}>Atrás</button>` : html`<span></span>`}
        ${enResumen
          ? html`<button class="btn prim asis-crear" onClick=${terminar}>${I('check')}${textoCrear}</button>`
          : html`<button class="btn prim" onClick=${() => siguiente()}>${paso.opcional && (v[paso.id] === undefined || v[paso.id] === null) ? 'Omitir' : 'Siguiente'}<kbd>↵</kbd></button>`}
      </div>
    </div>`;
}

// Un tipo de campo por pregunta: texto grande, chips, personas, fecha, color, estado o caritas.
function Campo({ paso, valor, todo, poner, elegir }) {
  const ref = useRef();
  useLayoutEffect(() => { ref.current?.focus({ preventScroll: true }); const t = setTimeout(() => { if (!ref.current?.contains?.(document.activeElement) && document.activeElement !== ref.current) ref.current?.focus({ preventScroll: true }); }, 80); return () => clearTimeout(t); }, [paso.id]);
  const t = paso.tipo;
  if (t === 'texto') return html`<div class="asis-texto">
    <input ref=${ref} value=${valor || ''} placeholder=${paso.placeholder || ''} maxlength="120" onInput=${(e) => poner(e.target.value)} aria-label=${paso.pregunta} />
    ${paso.sugerencias && !valor && html`<div class="asis-sug">${paso.sugerencias.map((s) => html`<button key=${s} onClick=${() => { poner(s + ' '); ref.current?.focus(); }}>${s}…</button>`)}</div>`}
  </div>`;
  if (t === 'opciones') {
    const ops = typeof paso.opciones === 'function' ? paso.opciones(todo) : paso.opciones;
    return html`<div class="asis-ops" role="radiogroup">${ops.map((o, k) => html`<button key=${o.id} ref=${k === 0 ? ref : null} role="radio" aria-label=${o.nombre + (o.sub ? ", " + o.sub : "")} aria-checked=${valor === o.id} class="asis-op" style=${o.color ? `--c:${o.color}` : ''} onClick=${() => elegir(o.id)}>
      ${o.color && html`<i class="bolita"></i>`}${o.persona && html`<${Avatar} p=${o.persona} grande />`}<span>${o.nombre}</span>${o.sub && html`<small>${o.sub}</small>`}</button>`)}</div>`;
  }
  if (t === 'fecha') {
    const ops = opcionesFecha(paso.sinFecha);
    const otra = valor && !ops.some((o) => o.id === valor);
    return html`<div class="asis-ops fechas" role="radiogroup">
      ${ops.map((o, k) => html`<button key=${o.id || 'sin'} ref=${k === 0 ? ref : null} role="radio" aria-checked=${valor === o.id} class="asis-op" onClick=${() => elegir(o.id)}>
        <span>${o.nombre}</span>${o.id && html`<small>${fechaCorta(o.id)}</small>`}</button>`)}
      <label class=${'asis-op otra' + (otra ? ' sel' : '')}><span>Otra fecha</span><input type="date" value=${otra ? valor : ''} min=${hoyISO()} onChange=${(e) => e.target.value && poner(e.target.value)} /></label>
    </div>`;
  }
  if (t === 'color') return html`<div class="asis-colores" role="radiogroup">${COLORES_CLIENTE.map((c, k) => html`<button key=${c} ref=${k === 0 ? ref : null} role="radio" aria-checked=${valor === c} aria-label=${'Color ' + (k + 1)} style=${`--c:${c}`} onClick=${() => elegir(c)}></button>`)}</div>`;
  if (t === 'salud') return html`<div class="asis-ops salud" role="radiogroup">${SALUD.map((s, k) => html`<button key=${s.id} ref=${k === 0 ? ref : null} role="radio" aria-checked=${valor === s.id} class=${'asis-op s-' + s.id} onClick=${() => elegir(s.id)}><i class="semaforo"></i><span>${s.nombre}</span></button>`)}</div>`;
  if (t === 'caritas') return html`<div class="asis-caritas" role="radiogroup">${CARITAS.map((c, k) => html`<button key=${k} ref=${k === 0 ? ref : null} role="radio" aria-checked=${valor === k + 1} aria-label=${`${k + 1} de 5`} onClick=${() => elegir(k + 1)}><${Carita} n=${k + 1} tam=${30} /></button>`)}
    <button class="asis-nose" aria-checked=${valor === 0} onClick=${() => elegir(0)}>Aún no sé</button></div>`;
  return null;
}

// ---------- Tarea ----------
export function AsistenteTarea({ ctx, inicial = {}, cerrar }) {
  const { db, yo } = ctx;
  const clientes = db.clientes.filter((c) => !c.privado);
  const opsCliente = [...clientes, ...db.clientes.filter((c) => c.privado)].map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }));
  const proyectosDe = (cid) => db.proyectos.filter((p) => p.cliente === cid);
  const nombreP = (id) => db.personas.find((p) => p.id === id)?.corto;
  const pasos = [
    { id: 'titulo', tipo: 'texto', corto: 'Tarea', pregunta: '¿Qué hay que hacer?', ayuda: 'Empieza con un verbo, así se entiende sola.', placeholder: 'Ej. Enviar el reporte de noviembre',
      sugerencias: ['Enviar', 'Revisar', 'Llamar a', 'Preparar'], falta: 'Escribe qué hay que hacer.', resumen: (x) => x?.trim() },
    { id: 'cliente', tipo: 'opciones', corto: 'Cliente', pregunta: '¿Para qué cliente?', opciones: opsCliente, falta: 'Elige un cliente (o Spark225 si es interno).',
      resumen: (x) => db.clientes.find((c) => c.id === x)?.nombre },
    { id: 'proyecto', tipo: 'opciones', corto: 'Proyecto', pregunta: '¿De qué proyecto?', si: (v) => proyectosDe(v.cliente).length > 1,
      ayuda: 'Toda tarea va ligada a su proyecto para que no se pierda si alguien deja el equipo.',
      opciones: (v) => proyectosDe(v.cliente).filter((p) => p.fase !== 'terminado').sort((a, b) => a.id.startsWith('g-') - b.id.startsWith('g-')).map((p) => ({ id: p.id, nombre: p.id.startsWith('g-') ? 'General (aún sin proyecto)' : p.nombre })),
      resumen: (x) => db.proyectos.find((p) => p.id === x)?.nombre },
    { id: 'responsable', tipo: 'opciones', corto: 'Quién', pregunta: '¿Quién la hace?', ayuda: 'Le llega un aviso si no eres tú.',
      opciones: db.personas.map((p) => ({ id: p.id, nombre: p.id === yo ? 'Yo' : p.corto, sub: p.puesto, persona: p })), resumen: (x) => (x === yo ? 'Yo' : nombreP(x)) },
    { id: 'fecha', tipo: 'fecha', corto: 'Para cuándo', pregunta: '¿Para cuándo?', falta: 'Elige una fecha.', resumen: (x) => fechaRelativa(x) },
    { id: 'prioridad', tipo: 'opciones', corto: 'Prioridad', pregunta: '¿Qué tan urgente es?', falta: 'Elige una prioridad.',
      opciones: PRIORIDADES.map((p) => ({ id: p.id, nombre: p.nombre })), resumen: (x) => PRIORIDADES.find((p) => p.id === x)?.nombre },
  ];
  const Vista = ({ v }) => {
    const c = db.clientes.find((x) => x.id === v.cliente);
    return html`<div class="tj vista-tj" style=${`--c:${c?.color || 'var(--chispa)'}`}>
      <div class="tj-top"><span class="tj-cli">${c?.nombre}</span><${Avatar} p=${db.personas.find((p) => p.id === v.responsable)} /></div>
      <div class="tj-t">${v.titulo}</div><div class="tj-f">${fechaRelativa(v.fecha)}</div></div>`;
  };
  return html`<${Asistente} titulo="Nueva tarea" textoCrear="Crear tarea" pasos=${pasos} Vista=${Vista} cerrar=${cerrar}
    inicial=${{ responsable: ctx.persona || yo, fecha: undefined, ...inicial }}
    alCrear=${(v) => {
      const proyecto = v.proyecto && proyectosDe(v.cliente).some((p) => p.id === v.proyecto) ? v.proyecto : 'g-' + v.cliente;
      const a = crear(nuevaVacia(v.responsable, { titulo: v.titulo.trim(), cliente: v.cliente, proyecto, fecha: v.fecha, prioridad: v.prioridad || 'media', esfuerzo: 'S', asignadaPor: yo }), yo);
      ctx.setUltimoCliente(v.cliente);
      ctx.toast(a.responsable === yo ? 'Tarea creada' : `Tarea creada para ${nombreP(a.responsable)}`, { texto: 'Ver', f: () => ctx.abrir(a.id) });
    }} />`;
}

// ---------- Cliente ----------
export function AsistenteCliente({ ctx, cerrar }) {
  const { db, yo } = ctx;
  const libre = COLORES_CLIENTE.find((c) => !db.clientes.some((x) => x.color === c)) || COLORES_CLIENTE[0];
  const pasos = [
    { id: 'nombre', tipo: 'texto', corto: 'Nombre', pregunta: '¿Cómo se llama el cliente?', placeholder: 'Ej. Clínica del Valle', falta: 'Escribe el nombre.', resumen: (x) => x?.trim() },
    { id: 'color', tipo: 'color', corto: 'Color', pregunta: 'Elige su color', ayuda: 'Así lo reconoces en todo el Portal.', resumen: (x) => html`<i class="bolita" style=${`--c:${x}`}></i>` },
    { id: 'responsable', tipo: 'opciones', corto: 'Lleva la cuenta', pregunta: '¿Quién lleva la cuenta?',
      opciones: db.personas.map((p) => ({ id: p.id, nombre: p.id === yo ? 'Yo' : p.corto, sub: p.puesto, persona: p })), resumen: (x) => db.personas.find((p) => p.id === x)?.corto },
    { id: 'etapa', tipo: 'opciones', corto: 'Etapa', pregunta: '¿En qué etapa está?', ayuda: 'El semáforo se calcula solo con la entrega a tiempo.',
      opciones: ETAPAS_CLIENTE.map((e) => ({ id: e.id, nombre: e.nombre, sub: e.ayuda })), resumen: (x) => ETAPAS_CLIENTE.find((e) => e.id === x)?.nombre },
    { id: 'satisfaccion', tipo: 'caritas', corto: 'Satisfacción', pregunta: '¿Qué tan contento está?', ayuda: 'Lo puedes actualizar cada mes desde su ficha.', resumen: (x) => (x ? html`<${Carita} n=${x} tam=${18} />` : 'Aún no sé') },
  ];
  const Vista = ({ v }) => html`<div class="cli-card mini" style=${`--c:${v.color}`}><${LogoCliente} c=${{ nombre: v.nombre || '?', color: v.color }} /><b>${v.nombre}</b></div>`;
  return html`<${Asistente} titulo="Nuevo cliente" textoCrear="Crear cliente" pasos=${pasos} Vista=${Vista} cerrar=${cerrar}
    inicial=${{ color: libre, responsable: yo, etapa: 'activo', satisfaccion: undefined }}
    alCrear=${(v) => {
      if (db.clientes.some((c) => c.nombre.toLowerCase() === v.nombre.trim().toLowerCase())) { ctx.toast('Ya existe un cliente con ese nombre'); return false; }
      const c = crearCliente(v, yo);
      ctx.toast(`${c.nombre} ya está en Clientes`, { texto: 'Abrir', f: () => { location.hash = '#/cliente/' + c.id; } });
    }} />`;
}

// ---------- Proyecto ----------
export function AsistenteProyecto({ ctx, inicial = {}, cerrar }) {
  const { db, yo } = ctx;
  const pasos = [
    { id: 'nombre', tipo: 'texto', corto: 'Proyecto', pregunta: '¿Cómo se llama el proyecto?', placeholder: 'Ej. Lanzamiento de la nueva sede', falta: 'Escribe el nombre.', resumen: (x) => x?.trim() },
    { id: 'cliente', tipo: 'opciones', corto: 'Cliente', pregunta: '¿De qué cliente?', opciones: db.clientes.filter((c) => !c.privado).map((c) => ({ id: c.id, nombre: c.nombre, color: c.color })),
      resumen: (x) => db.clientes.find((c) => c.id === x)?.nombre },
    { id: 'responsable', tipo: 'opciones', corto: 'A cargo', pregunta: '¿Quién está a cargo?',
      opciones: db.personas.map((p) => ({ id: p.id, nombre: p.id === yo ? 'Yo' : p.corto, sub: p.puesto, persona: p })), resumen: (x) => db.personas.find((p) => p.id === x)?.corto },
    { id: 'entrega', tipo: 'fecha', sinFecha: true, corto: 'Entrega', pregunta: '¿Cuándo se entrega?', resumen: (x) => (x ? fechaRelativa(x) : 'Sin fecha') },
  ];
  return html`<${Asistente} titulo="Nuevo proyecto" textoCrear="Crear proyecto" pasos=${pasos} cerrar=${cerrar}
    inicial=${{ responsable: yo, ...inicial }}
    alCrear=${(v) => { const p = crearProyecto(v, yo); ctx.toast(`Proyecto «${p.nombre}» creado`); }} />`;
}

// ---------- Menú del botón +: qué quieres crear ----------
export function MenuCrear({ elegir, cerrar }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    const k = (e) => { if (e.key === 'Escape') cerrar(); };
    setTimeout(() => addEventListener('pointerdown', f), 0);
    addEventListener('keydown', k);
    return () => { removeEventListener('pointerdown', f); removeEventListener('keydown', k); };
  }, []);
  const ops = [['tarea', 'lista', 'Tarea', 'N'], ['proyecto', 'proyectos', 'Proyecto'], ['cliente', 'carpeta', 'Cliente']];
  return html`<div class="menu-crear" ref=${ref} role="menu" aria-label="Crear">
    ${ops.map(([id, ico, t, kbd]) => html`<button key=${id} role="menuitem" onClick=${() => elegir(id)}><span class="mc-ico">${I(ico)}</span><span>${t}</span>${kbd && html`<kbd>${kbd}</kbd>`}</button>`)}
  </div>`;
}
