// Mapa de flujos, al estilo de un constructor de chatbots.
// Cada flujo es un lienzo con tareas, personas y notas unidas por flechas.
// Regla al conectar: tarea → persona asigna; tarea → tarea = «espera a».
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO } from './datos.js?v=202611241453';
import {
  vigentes, participa, estatusVisible, dependenciaAbierta, siguienteEstatus, cambiarEstatus, crear, nuevaVacia,
  flujoDe, crearFlujo, renombrarFlujo, borrarFlujo, flujosDeActividad, avanceFlujo, flujoAuto,
  moverNodo, agregarNodo, quitarNodo, editarNota, conectar, desconectar,
} from './store.js?v=202611241453';
import { I, Anillo, Avatar, fechaRelativa } from './ui.js?v=202611241453';
import { iniciarArrastre, useArrastre } from './arrastre.js?v=202611241453';

const TAM = { actividad: [240, 84], persona: [180, 62], nota: [200, 64] };
const NOMBRE_EST = { pendiente: 'Pendiente', en_curso: 'En curso', esperando: 'Esperando cliente', bloqueado: 'Bloqueado', hecho: 'Hecho' };
const copia = (x) => JSON.parse(JSON.stringify(x));

export function Mapa({ db, yo, abrir, toast }) {
  const [fid, setFid] = useState(() => db.flujos[0]?.id || null);
  const [autoDe, setAutoDe] = useState(null);
  const [tab, setTab] = useState('flujos');
  const [sel, setSel] = useState(null);
  const [selArista, setSelArista] = useState(null);
  const [pan, setPan] = useState({ x: 360, y: 120 });
  const [zoom, setZoom] = useState(1);
  const [linea, setLinea] = useState(null);
  const [mov, setMov] = useState(null);
  const [editando, setEditando] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const lienzo = useRef();
  const nombreRef = useRef();
  const arr = useArrastre();

  const flujo = fid === 'auto' ? flujoAuto(autoDe) : flujoDe(fid);
  const nodos = flujo?.nodos || [], aristas = flujo?.aristas || [];
  const av = flujo ? avanceFlujo(flujo) : { hechas: 0, total: 0, acts: [] };
  const pos = (n) => (mov && mov.id === n.id ? { x: mov.x, y: mov.y } : { x: n.x, y: n.y });
  const mundo = (cx, cy) => { const r = lienzo.current.getBoundingClientRect(); return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom }; };

  // Un flujo automático se guarda como flujo propio al primer cambio.
  const asegurar = () => {
    if (!flujo) return null;
    if (!flujo.auto) return flujo.id;
    const id = crearFlujo(flujo.nombre, yo, { nodos: copia(flujo.nodos), aristas: copia(flujo.aristas) });
    setFid(id); toast('Flujo guardado');
    return id;
  };

  const encuadrar = (foco) => {
    const el = lienzo.current; if (!el) return;
    const r = el.getBoundingClientRect();
    if (!nodos.length) { setZoom(1); setPan({ x: r.width / 2, y: r.height / 2 }); return; }
    const izq = r.width > 700 ? 300 : 0, der = r.width > 700 ? 330 : 0;
    if (foco) {
      const n = nodos.find((k) => k.id === foco);
      if (n) { setPan({ x: izq + (r.width - izq - der) / 2 - (n.x + TAM[n.tipo][0] / 2) * zoom, y: r.height / 2 - (n.y + TAM[n.tipo][1] / 2) * zoom }); return; }
    }
    const x0 = Math.min(...nodos.map((n) => n.x)), x1 = Math.max(...nodos.map((n) => n.x + TAM[n.tipo][0]));
    const y0 = Math.min(...nodos.map((n) => n.y)), y1 = Math.max(...nodos.map((n) => n.y + TAM[n.tipo][1]));
    const z = Math.max(0.5, Math.min(1, (r.width - izq - der - 80) / (x1 - x0 || 1), (r.height - 240) / (y1 - y0 || 1)));
    setZoom(z);
    setPan({ x: izq + (r.width - izq - der - (x1 - x0) * z) / 2 - x0 * z, y: 90 + (r.height - 200 - (y1 - y0) * z) / 2 - y0 * z });
  };
  useEffect(() => { encuadrar(flujo?.enfoque); }, [fid, autoDe]);

  useEffect(() => {
    const k = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selArista) { desconectar(asegurar(), selArista, yo); setSelArista(null); }
      if (e.key === 'Escape') { setSel(null); setSelArista(null); setNueva(false); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const panear = (e) => {
    if (e.target !== lienzo.current && !e.target.classList.contains('mapa-svg')) return;
    setSel(null); setSelArista(null);
    const x0 = e.clientX, y0 = e.clientY, p0 = { ...pan };
    const m = (ev) => setPan({ x: p0.x + ev.clientX - x0, y: p0.y + ev.clientY - y0 });
    const u = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };
  useEffect(() => {
    const el = lienzo.current;
    const rueda = (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) setZoom((z) => Math.max(0.4, Math.min(1.6, z - e.deltaY * 0.002))); else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY })); };
    el.addEventListener('wheel', rueda, { passive: false });
    return () => el.removeEventListener('wheel', rueda);
  });

  const moverInicio = (e, n) => {
    if (e.button !== 0 || e.target.closest('.puerto, .n-quitar, textarea, .n-anillo')) return;
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, p0 = pos(n);
    let movido = false;
    const m = (ev) => { const dx = (ev.clientX - x0) / zoom, dy = (ev.clientY - y0) / zoom; if (Math.abs(dx) + Math.abs(dy) > 3) movido = true; setMov({ id: n.id, x: p0.x + dx, y: p0.y + dy }); };
    const u = (ev) => {
      removeEventListener('pointermove', m); removeEventListener('pointerup', u);
      if (movido) moverNodo(asegurar(), n.id, p0.x + (ev.clientX - x0) / zoom, p0.y + (ev.clientY - y0) / zoom);
      else { setSel(n.id); setSelArista(null); }
      setMov(null);
    };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };
  const dobleClic = (n) => {
    if (n.tipo === 'actividad') abrir(n.ref);
    else if (n.tipo === 'persona') location.hash = n.ref === yo ? '#/' : '#/persona/' + n.ref;
    else setEditando(n.id);
  };

  const conectarInicio = (e, n) => {
    e.stopPropagation(); e.preventDefault();
    const [w, h] = TAM[n.tipo]; const p = pos(n);
    const desde = { x: p.x + w, y: p.y + h / 2 };
    setLinea({ desde, hasta: mundo(e.clientX, e.clientY) });
    const m = (ev) => setLinea({ desde, hasta: mundo(ev.clientX, ev.clientY) });
    const u = (ev) => {
      removeEventListener('pointermove', m); removeEventListener('pointerup', u);
      setLinea(null);
      const destino = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-nodo]');
      if (destino && destino.dataset.nodo !== n.id) { const r = conectar(asegurar(), n.id, destino.dataset.nodo, yo); if (r.ok) toast(r.efecto || 'Conectado'); }
    };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };

  const centroVista = () => { const r = lienzo.current.getBoundingClientRect(); return mundo(r.left + r.width / 2 - 120, r.top + r.height / 2 - 40); };
  const agregar = (nodo, donde) => {
    let id = asegurar();
    if (!id) { id = crearFlujo('Nuevo flujo', yo); setFid(id); }
    const c = donde || centroVista();
    return { id, n: agregarNodo(id, { ...nodo, x: c.x, y: c.y }, yo) };
  };
  const arrastrarDesdePanel = (e, nodo, etiqueta, alClic) => iniciarArrastre(e, {
    datos: { nodo: true }, etiqueta, alClic,
    alSoltar: (d) => { if (d.tipo !== 'lienzo') return; const r = d.el.getBoundingClientRect(); const w = mundo(r.left + d.offsetX, r.top + d.offsetY); agregar(nodo, { x: w.x - 110, y: w.y - 35 }); },
  });

  // Ver una tarea: abre su flujo; si no tiene, arma uno automático con su cadena y responsables.
  const verTarea = (aId) => {
    const f = flujosDeActividad(aId)[0];
    if (f) { const n = f.nodos.find((k) => k.ref === aId); setFid(f.id); setSel(n?.id); setTimeout(() => encuadrar(n?.id), 30); }
    else { setAutoDe(aId); setFid('auto'); setSel('auto-' + aId); }
  };
  const nuevoFlujo = () => { const id = crearFlujo('Nuevo flujo', yo); setFid(id); setSel(null); setTab('flujos'); setTimeout(() => nombreRef.current?.select(), 60); };

  const crearEnFlujo = (a) => {
    const previa = nodoSel?.tipo === 'actividad' ? nodoSel : null;
    let donde = previa ? { x: pos(previa).x + 320, y: pos(previa).y } : null;
    // Busca un hueco libre para no encimar la nueva tarea sobre otra.
    while (donde && nodos.some((k) => Math.abs(k.x - donde.x) < 230 && Math.abs(k.y - donde.y) < 95)) donde = { x: donde.x, y: donde.y + 110 };
    const { id, n } = agregar({ tipo: 'actividad', ref: a.id }, donde);
    if (previa) conectar(id, previa.id, n.id, yo);
    const pn = flujoDe(id).nodos.find((k) => k.tipo === 'persona' && k.ref === a.responsable);
    if (pn) conectar(id, n.id, pn.id, yo);
    setSel(n.id); setNueva(false); toast(previa ? 'Tarea creada después de la seleccionada' : 'Tarea creada en el flujo');
  };

  const pendientes = vigentes().filter((a) => participa(a, yo) && a.estatus !== 'hecho' && a.cliente !== 'personal').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const enEste = new Set(nodos.filter((n) => n.ref).map((n) => n.ref));
  const responsables = [...new Set(av.acts.map((a) => a.responsable))].map((id) => db.personas.find((p) => p.id === id));
  const curva = (a, b) => { const dx = Math.max(60, Math.abs(b.x - a.x) / 2); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };
  const nodoSel = nodos.find((n) => n.id === sel);
  const hoy = hoyISO();

  return html`
    <div class="mapa-wrap">
      <aside class="mapa-paleta" data-tour="paleta">
        <div class="segmentado chico ancho">${[['flujos', 'Flujos'], ['pendientes', 'Pendientes']].map(([k, t]) => html`<button key=${k} aria-pressed=${tab === k} onClick=${() => setTab(k)}>${t}</button>`)}</div>
        ${tab === 'flujos' ? html`
          <button class="btn prim ancho-btn" onClick=${nuevoFlujo}>${I('mas')}Nuevo flujo</button>
          <div class="paleta-lista">${db.flujos.map((f) => {
            const a = avanceFlujo(f);
            const gente = [...new Set(a.acts.map((x) => x.responsable))].map((id) => db.personas.find((p) => p.id === id));
            return html`<button key=${f.id} class=${'flujo-it' + (f.id === fid ? ' on' : '')} onClick=${() => { setFid(f.id); setSel(null); }}>
              <span class="fi-n">${f.nombre}</span>
              <span class="fi-barra"><i style=${`width:${a.total ? (a.hechas / a.total) * 100 : 0}%`}></i></span>
              <span class="fi-pie"><span class="num">${a.hechas}/${a.total}</span><span class="avatares-mini">${gente.map((p) => html`<${Avatar} key=${p?.id} p=${p} />`)}</span></span>
            </button>`;
          })}</div>`
        : html`<div class="paleta-lista">${pendientes.map((a) => {
            const c = db.clientes.find((x) => x.id === a.cliente);
            const enFlujo = flujosDeActividad(a.id).length > 0;
            return html`<div key=${a.id} class=${'pal-it' + (enEste.has(a.id) ? ' en' : '')} style=${`--c:${c?.color}`} role="button" tabindex="0"
              onPointerDown=${(e) => arrastrarDesdePanel(e, { tipo: 'actividad', ref: a.id }, a.titulo, () => verTarea(a.id))}
              onKeyDown=${(e) => e.key === 'Enter' && verTarea(a.id)}>
              <i class="bolita"></i><span class="pal-t">${a.titulo}</span>
              <span class=${'pal-f' + (a.fecha < hoy ? ' alerta' : '')}>${fechaRelativa(a.fecha)}</span>
              ${enFlujo && html`<span class="pal-ico" title="Tiene flujo">${I('mapa')}</span>`}
            </div>`;
          })}</div>`}
        <div class="pal-personas" title="Arrastra una persona al lienzo">
          ${db.personas.map((p) => html`<span key=${p.id} class="pal-av" title=${p.nombre} onPointerDown=${(e) => arrastrarDesdePanel(e, { tipo: 'persona', ref: p.id }, p.nombre, () => agregar({ tipo: 'persona', ref: p.id }))}><${Avatar} p=${p} grande /></span>`)}
        </div>
      </aside>

      <div class=${'lienzo' + (arr?.datos?.nodo ? ' sobre' : '')} ref=${lienzo} data-drop="lienzo" onPointerDown=${panear}
        style=${`background-position:${pan.x}px ${pan.y}px;background-size:${24 * zoom}px ${24 * zoom}px`}>
        <div class="mundo" style=${`transform:translate(${pan.x}px,${pan.y}px) scale(${zoom})`}>
          <svg class="mapa-svg" width="4000" height="3000">
            <defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--tinta-3)" /></marker>
              <marker id="flecha-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--chispa)" /></marker></defs>
            ${aristas.map((e) => {
              const a = nodos.find((n) => n.id === e.de), b = nodos.find((n) => n.id === e.a);
              if (!a || !b) return null;
              const pa = pos(a), pb = pos(b);
              const d = curva({ x: pa.x + TAM[a.tipo][0], y: pa.y + TAM[a.tipo][1] / 2 }, { x: pb.x - 4, y: pb.y + TAM[b.tipo][1] / 2 });
              const actA = a.tipo === 'actividad' ? db.actividades.find((x) => x.id === a.ref) : null;
              const on = selArista === e.id || sel === a.id || sel === b.id;
              return html`<g key=${e.id}><path d=${d} class="arista-hit" onPointerDown=${(ev) => { ev.stopPropagation(); setSelArista(e.id); setSel(null); }} />
                <path d=${d} class=${'arista' + (on ? ' on' : '') + (actA?.estatus === 'hecho' ? ' viva' : '')} marker-end=${on ? 'url(#flecha-on)' : 'url(#flecha)'} /></g>`;
            })}
            ${linea && html`<path d=${curva(linea.desde, linea.hasta)} class="arista on temp" />`}
          </svg>
          ${nodos.map((n) => {
            const p = pos(n);
            const [w, h] = TAM[n.tipo];
            let cuerpo, color, extra = '';
            if (n.tipo === 'actividad') {
              const a = db.actividades.find((x) => x.id === n.ref);
              if (!a || a.archivada) return null;
              const c = db.clientes.find((x) => x.id === a.cliente); color = c?.color;
              const r = db.personas.find((x) => x.id === a.responsable);
              const ev = estatusVisible(a);
              const prog = a.checklist.length ? a.checklist.filter((x) => x.hecho).length / a.checklist.length : (a.estatus === 'hecho' ? 1 : a.estatus === 'en_curso' ? 0.5 : 0);
              extra = ' e-' + ev;
              cuerpo = html`<div class="n-top"><span class="n-cli">${c?.nombre}</span>
                  <button class="n-anillo" title=${NOMBRE_EST[ev]} onPointerDown=${(e) => e.stopPropagation()} onClick=${(e) => { e.stopPropagation(); const r2 = cambiarEstatus(a.id, siguienteEstatus(a.estatus), yo); if (!r2.ok) toast(r2.motivo); }}><${Anillo} estatus=${ev} /></button></div>
                <div class="n-t">${a.titulo}</div>
                <div class="n-pie"><${Avatar} p=${r} /><span class=${a.fecha < hoy && a.estatus !== 'hecho' ? 'alerta' : ''}>${fechaRelativa(a.fecha)}</span><span class="n-prog"><i style=${`width:${prog * 100}%`}></i></span></div>`;
            } else if (n.tipo === 'persona') {
              const pe = db.personas.find((x) => x.id === n.ref);
              const carga = av.acts.filter((a) => a.responsable === n.ref && a.estatus !== 'hecho').length;
              cuerpo = html`<${Avatar} p=${pe} grande /><div><b>${pe?.corto}</b><span>${pe?.puesto}</span></div>${carga ? html`<em class="n-carga num">${carga}</em>` : null}`;
            } else {
              cuerpo = editando === n.id
                ? html`<textarea autofocus class="n-nota-campo" value=${n.texto} onBlur=${(e) => { editarNota(asegurar(), n.id, e.target.value); setEditando(null); }} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } }}></textarea>`
                : html`<span class="n-nota">${n.texto}</span>`;
            }
            return html`<div key=${n.id} class=${`nodo n-${n.tipo}` + extra + (mov?.id === n.id ? ' moviendo' : '') + (sel === n.id ? ' sel' : '')} data-nodo=${n.id}
              style=${`left:${p.x}px;top:${p.y}px;width:${w}px;min-height:${h}px;--c:${color || 'var(--tinta-3)'}`}
              onPointerDown=${(e) => moverInicio(e, n)} onDblClick=${() => dobleClic(n)}>
              <span class="puerto entrada"></span>
              ${cuerpo}
              <span class="puerto salida" title="Arrastra para conectar" onPointerDown=${(e) => conectarInicio(e, n)}></span>
              <button class="n-quitar" aria-label="Quitar del flujo" onPointerDown=${(e) => e.stopPropagation()} onClick=${() => { quitarNodo(asegurar(), n.id); setSel(null); }}>${I('x')}</button>
            </div>`;
          })}
        </div>

        ${flujo && html`
          <div class="flujo-cab">
            ${flujo.auto ? html`<span class="auto-tag">${I('brujula')}Automático</span><b class="fc-nombre">${flujo.nombre}</b>`
              : html`<input ref=${nombreRef} key=${flujo.id} class="fc-nombre" value=${flujo.nombre} aria-label="Nombre del flujo" onBlur=${(e) => renombrarFlujo(flujo.id, e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />`}
            <span class="fc-avance" title="Tareas cerradas"><span class="fi-barra"><i style=${`width:${av.total ? (av.hechas / av.total) * 100 : 0}%`}></i></span><span class="num">${av.hechas}/${av.total}</span></span>
            <span class="avatares-mini">${responsables.map((p) => html`<${Avatar} key=${p?.id} p=${p} />`)}</span>
            <span class="fc-sep"></span>
            <button class="btn chico" onClick=${() => setNueva(true)}>${I('mas')}Tarea</button>
            <button class="btn chico fantasma" onClick=${() => { const { n } = agregar({ tipo: 'nota', texto: 'Nota' }); setEditando(n.id); }}>${I('nota')}Nota</button>
            ${flujo.auto ? html`<button class="btn chico prim" onClick=${asegurar}>Guardar flujo</button>`
              : html`<button class="icon-btn chico" title="Borrar flujo" aria-label="Borrar flujo" onClick=${() => setConfirmarBorrar(true)}>${I('papelera')}</button>`}
          </div>`}

        ${flujo && nodos.length === 0 && html`<div class="lienzo-vacio">
          <div class="lv-anim"><span class="lv-n a"></span><span class="lv-l"></span><span class="lv-n b"></span></div>
          <p>Arrastra tareas de «Mis pendientes» o crea una</p>
          <button class="btn prim" onClick=${() => setNueva(true)}>${I('mas')}Nueva tarea</button>
        </div>`}
        ${!flujo && html`<div class="lienzo-vacio"><p>Elige un flujo o crea uno</p><button class="btn prim" onClick=${nuevoFlujo}>${I('mas')}Nuevo flujo</button></div>`}

        ${nodoSel && html`<${Inspector} n=${nodoSel} db=${db} yo=${yo} abrir=${abrir} toast=${toast} cerrar=${() => setSel(null)} av=${av}
          quitar=${() => { quitarNodo(asegurar(), nodoSel.id); setSel(null); }} />`}
        ${selArista && html`<button class="btn quitar-arista" onClick=${() => { desconectar(asegurar(), selArista, yo); setSelArista(null); }}>${I('x')}Quitar flecha</button>`}
        ${nueva && html`<${NuevaTarea} db=${db} yo=${yo} cerrar=${() => setNueva(false)} tras=${nodoSel?.tipo === 'actividad' ? db.actividades.find((a) => a.id === nodoSel.ref) : null} crearla=${crearEnFlujo} />`}
        ${confirmarBorrar && html`
          <div class="velo alto" onClick=${() => setConfirmarBorrar(false)}></div>
          <div class="hoja chica" role="alertdialog" aria-modal="true" aria-label="Borrar flujo">
            <div class="hoja-asa"></div>
            <div class="hoja-t">¿Borrar «${flujo.nombre}»?</div>
            <p class="hoja-p">Las tareas no se borran, solo el mapa.</p>
            <div class="fila-btn"><button class="btn" onClick=${() => setConfirmarBorrar(false)}>Cancelar</button>
              <button class="btn peligro" onClick=${() => { const resto = db.flujos.find((f) => f.id !== flujo.id); borrarFlujo(flujo.id, yo); setFid(resto?.id || null); setConfirmarBorrar(false); toast('Flujo borrado'); }}>Borrar</button></div>
          </div>`}

        <div class="mapa-zoom">
          <button class="icon-btn" onClick=${() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Acercar">${I('mas')}</button>
          <button class="icon-btn" onClick=${() => encuadrar()} aria-label="Encuadrar">${I('brujula')}</button>
          <button class="icon-btn" onClick=${() => setZoom((z) => Math.max(0.4, z - 0.1))} aria-label="Alejar">${I('menos')}</button>
        </div>
      </div>
    </div>`;
}

// Panel de la derecha: quién es responsable, en qué va y qué sigue.
function Inspector({ n, db, yo, abrir, toast, cerrar, quitar, av }) {
  if (n.tipo === 'nota') return null;
  if (n.tipo === 'persona') {
    const p = db.personas.find((x) => x.id === n.ref);
    const suyas = av.acts.filter((a) => a.responsable === n.ref);
    return html`<div class="inspector">
      <div class="in-cab"><${Avatar} p=${p} grande /><div class="in-quien"><b>${p?.nombre}</b><span>${p?.puesto}</span></div><button class="icon-btn chico" onClick=${cerrar} aria-label="Cerrar">${I('x')}</button></div>
      <div class="in-sec">En este flujo</div>
      <ul class="in-lista">${suyas.map((a) => html`<li key=${a.id}><button onClick=${() => abrir(a.id)}><span class="in-ring"><${Anillo} estatus=${estatusVisible(a)} /></span>${a.titulo}</button></li>`)}</ul>
      <a class="btn ancho-btn" href=${n.ref === yo ? '#/' : '#/persona/' + n.ref}>${I('hoy')}Ver su día</a>
    </div>`;
  }
  const a = db.actividades.find((x) => x.id === n.ref);
  if (!a) return null;
  const c = db.clientes.find((x) => x.id === a.cliente);
  const r = db.personas.find((x) => x.id === a.responsable);
  const ev = estatusVisible(a);
  const dep = dependenciaAbierta(a);
  const siguen = db.actividades.filter((x) => x.dependeDe === a.id && !x.archivada);
  const hechos = a.checklist.filter((x) => x.hecho).length;
  const hoy = hoyISO();
  return html`<div class="inspector" style=${`--c:${c?.color}`}>
    <div class="in-cab"><span class="in-cli">${c?.nombre}</span><button class="icon-btn chico" onClick=${cerrar} aria-label="Cerrar">${I('x')}</button></div>
    <h3 class="in-t">${a.titulo}</h3>
    <button class="in-estado" onClick=${() => { const r2 = cambiarEstatus(a.id, siguienteEstatus(a.estatus), yo); if (!r2.ok) toast(r2.motivo); }}>
      <span class="in-ring"><${Anillo} estatus=${ev} /></span><span>${NOMBRE_EST[ev]}</span></button>
    <div class="in-filas">
      <div class="in-fila">${I('persona')}<${Avatar} p=${r} /><span>${r?.nombre}</span></div>
      <div class=${'in-fila' + (a.fecha < hoy && a.estatus !== 'hecho' ? ' alerta' : '')}>${I('semana')}<span>${fechaRelativa(a.fecha)}${a.bloque ? ` · ${a.bloque.inicio}` : ''}</span></div>
      ${a.checklist.length > 0 && html`<div class="in-fila">${I('lista')}<span class="in-prog"><i style=${`width:${(hechos / a.checklist.length) * 100}%`}></i></span><span class="num">${hechos}/${a.checklist.length}</span></div>`}
      ${dep && html`<div class="in-fila alerta">${I('cadena')}<span>Espera a «${dep.titulo}»</span></div>`}
      ${siguen.length > 0 && html`<div class="in-fila">${I('flecha', 'rot-180')}<span>Luego: ${siguen.map((s) => s.titulo).join(', ')}</span></div>`}
    </div>
    ${a.checklist.length > 0 && html`<ul class="in-pasos">${a.checklist.map((p) => html`<li key=${p.id} class=${p.hecho ? 'hecho' : ''}>${p.hecho ? I('check') : html`<i class="in-punto"></i>`}<span>${p.texto}</span></li>`)}</ul>`}
    <div class="fila-btn"><button class="btn fantasma" onClick=${quitar}>Quitar</button><button class="btn prim" onClick=${() => abrir(a.id)}>Abrir</button></div>
  </div>`;
}

function NuevaTarea({ db, yo, cerrar, crearla, tras }) {
  const [t, setT] = useState('');
  const [cli, setCli] = useState(tras?.cliente || 'interno');
  const [resp, setResp] = useState(yo);
  const [err, setErr] = useState(false);
  const campo = useRef();
  useEffect(() => { setTimeout(() => campo.current?.focus(), 30); }, []);
  const ok = () => {
    if (!t.trim()) return setErr(true);
    const a = crear(nuevaVacia(resp, { titulo: t.trim(), cliente: cli, proyecto: 'g-' + cli, esfuerzo: 'S', asignadaPor: yo, fecha: hoyISO() }), yo);
    crearla(a);
  };
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="hoja chica" role="dialog" aria-modal="true" aria-label="Nueva tarea en el flujo">
      <div class="hoja-asa"></div>
      ${tras && html`<div class="nt-tras">${I('cadena')}Después de «${tras.titulo}»</div>`}
      <input ref=${campo} class=${'nt-titulo' + (err ? ' error' : '')} placeholder="Nueva tarea" value=${t} onInput=${(e) => { setT(e.target.value); setErr(false); }} onKeyDown=${(e) => e.key === 'Enter' && ok()} aria-label="Título" />
      <div class="chips-scroll nt-fila">${db.clientes.filter((c) => !c.privado).map((c) => html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} aria-pressed=${cli === c.id} onClick=${() => setCli(c.id)}><i></i>${c.nombre}</button>`)}</div>
      <div class="chips-scroll nt-fila">${db.personas.map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${resp === p.id} onClick=${() => setResp(p.id)}><${Avatar} p=${p} />${p.corto}</button>`)}</div>
      <button class="btn prim ancho" onClick=${ok}>Crear en el flujo</button>
    </div>`;
}
