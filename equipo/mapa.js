// Mapa de flujo libre, al estilo de un constructor de chatbots: nodos que se mueven y flechas que se conectan.
// Regla al conectar: actividad → persona asigna; actividad → actividad = «espera a».
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { vigentes, estatusVisible, moverNodo, agregarNodo, quitarNodo, editarNota, conectar, desconectar } from './store.js?v=202611241437';
import { I, Anillo, Avatar, fechaRelativa } from './ui.js?v=202611241437';
import { iniciarArrastre, useArrastre } from './arrastre.js?v=202611241437';

const TAM = { actividad: [230, 76], persona: [170, 60], nota: [190, 64] };

export function Mapa({ db, yo, abrir, toast }) {
  const [pan, setPan] = useState({ x: 300, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [linea, setLinea] = useState(null); // conexión en curso
  const [sel, setSel] = useState(null); // arista seleccionada
  const [mov, setMov] = useState(null); // nodo moviéndose { id, x, y }
  const [editando, setEditando] = useState(null);
  const [tab, setTab] = useState('actividades');
  const lienzo = useRef();
  const arr = useArrastre();
  const { nodos, aristas } = db.mapa;
  const pos = (n) => (mov && mov.id === n.id ? { x: mov.x, y: mov.y } : { x: n.x, y: n.y });
  const mundo = (cx, cy) => { const r = lienzo.current.getBoundingClientRect(); return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom }; };

  useEffect(() => {
    const k = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { desconectar(sel, yo); setSel(null); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // Mover el lienzo arrastrando el fondo.
  const panear = (e) => {
    if (e.target !== lienzo.current && !e.target.classList.contains('mapa-svg')) return;
    setSel(null);
    const x0 = e.clientX, y0 = e.clientY, p0 = { ...pan };
    const m = (ev) => setPan({ x: p0.x + ev.clientX - x0, y: p0.y + ev.clientY - y0 });
    const u = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };
  const rueda = (e) => { if (!e.ctrlKey && !e.metaKey) { setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY })); e.preventDefault(); return; } e.preventDefault(); setZoom((z) => Math.max(0.4, Math.min(1.6, z - e.deltaY * 0.002))); };
  useEffect(() => { const el = lienzo.current; el.addEventListener('wheel', rueda, { passive: false }); return () => el.removeEventListener('wheel', rueda); });

  // Mover un nodo.
  const moverInicio = (e, n) => {
    if (e.button !== 0 || e.target.closest('.puerto, .n-quitar, textarea')) return;
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, p0 = pos(n);
    let movido = false;
    const m = (ev) => { const dx = (ev.clientX - x0) / zoom, dy = (ev.clientY - y0) / zoom; if (Math.abs(dx) + Math.abs(dy) > 3) movido = true; setMov({ id: n.id, x: p0.x + dx, y: p0.y + dy }); };
    const u = (ev) => {
      removeEventListener('pointermove', m); removeEventListener('pointerup', u);
      if (movido) moverNodo(n.id, p0.x + (ev.clientX - x0) / zoom, p0.y + (ev.clientY - y0) / zoom);
      else if (n.tipo === 'actividad') abrir(n.ref);
      else if (n.tipo === 'persona') location.hash = n.ref === yo ? '#/' : '#/persona/' + n.ref;
      else if (n.tipo === 'nota') setEditando(n.id);
      setMov(null);
    };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };

  // Conectar desde el puerto de salida.
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
      if (destino && destino.dataset.nodo !== n.id) { const r = conectar(n.id, destino.dataset.nodo, yo); if (r.ok) toast(r.efecto || 'Conectado'); }
    };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  };

  const enMapa = new Set(nodos.filter((n) => n.ref).map((n) => n.ref));
  const sueltas = vigentes().filter((a) => a.estatus !== 'hecho' && !enMapa.has(a.id) && a.cliente !== 'personal').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const personasFuera = db.personas.filter((p) => !enMapa.has(p.id));
  const centro = () => { const r = lienzo.current.getBoundingClientRect(); return mundo(r.left + r.width / 2 - 100, r.top + r.height / 2 - 30); };
  const agregarDesdePaleta = (e, nodo, etiqueta) => iniciarArrastre(e, {
    datos: { nodo: true }, etiqueta,
    alClic: () => { const c = centro(); agregarNodo({ ...nodo, x: c.x + Math.random() * 60, y: c.y + Math.random() * 60 }, yo); },
    alSoltar: (d) => { if (d.tipo !== 'lienzo') return; const r = d.el.getBoundingClientRect(); const w = mundo(r.left + d.offsetX, r.top + d.offsetY); agregarNodo({ ...nodo, x: w.x - 100, y: w.y - 30 }, yo); },
  });

  const curva = (a, b) => { const dx = Math.max(60, Math.abs(b.x - a.x) / 2); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };

  return html`
    <div class="mapa-wrap">
      <aside class="mapa-paleta" data-tour="paleta">
        <div class="segmentado chico">${[['actividades', 'Tareas'], ['personas', 'Personas']].map(([k, t]) => html`<button key=${k} aria-pressed=${tab === k} onClick=${() => setTab(k)}>${t}</button>`)}</div>
        <div class="paleta-lista">
          ${tab === 'actividades' ? sueltas.map((a) => {
            const c = db.clientes.find((x) => x.id === a.cliente);
            return html`<div key=${a.id} class="pal-it" style=${`--c:${c?.color}`} onPointerDown=${(e) => agregarDesdePaleta(e, { tipo: 'actividad', ref: a.id }, a.titulo)}><i class="bolita"></i><span>${a.titulo}</span></div>`;
          }) : personasFuera.map((p) => html`<div key=${p.id} class="pal-it" onPointerDown=${(e) => agregarDesdePaleta(e, { tipo: 'persona', ref: p.id }, p.nombre)}><${Avatar} p=${p} /><span>${p.nombre}</span></div>`)}
          ${(tab === 'actividades' ? sueltas : personasFuera).length === 0 && html`<div class="pal-vacio">${I('check')}</div>`}
        </div>
        <button class="btn nota-btn" onPointerDown=${(e) => agregarDesdePaleta(e, { tipo: 'nota', texto: 'Nueva nota' }, 'Nota')}>${I('nota')}Nota</button>
      </aside>

      <div class=${'lienzo' + (arr?.datos?.nodo ? ' sobre' : '')} ref=${lienzo} data-drop="lienzo" onPointerDown=${panear} style=${`--z:${zoom};background-position:${pan.x}px ${pan.y}px;background-size:${24 * zoom}px ${24 * zoom}px`}>
        <div class="mundo" style=${`transform:translate(${pan.x}px,${pan.y}px) scale(${zoom})`}>
          <svg class="mapa-svg" width="4000" height="3000">
            <defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--tinta-3)" /></marker>
              <marker id="flecha-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--chispa)" /></marker></defs>
            ${aristas.map((e) => {
              const a = nodos.find((n) => n.id === e.de), b = nodos.find((n) => n.id === e.a);
              if (!a || !b) return null;
              const pa = pos(a), pb = pos(b);
              const d = curva({ x: pa.x + TAM[a.tipo][0], y: pa.y + TAM[a.tipo][1] / 2 }, { x: pb.x - 4, y: pb.y + TAM[b.tipo][1] / 2 });
              const on = sel === e.id;
              return html`<g key=${e.id}><path d=${d} class="arista-hit" onPointerDown=${(ev) => { ev.stopPropagation(); setSel(e.id); }} />
                <path d=${d} class=${'arista' + (on ? ' on' : '')} marker-end=${on ? 'url(#flecha-on)' : 'url(#flecha)'} /></g>`;
            })}
            ${linea && html`<path d=${curva(linea.desde, linea.hasta)} class="arista on temp" />`}
          </svg>
          ${nodos.map((n) => {
            const p = pos(n);
            const [w, h] = TAM[n.tipo];
            let cuerpo, color;
            if (n.tipo === 'actividad') {
              const a = db.actividades.find((x) => x.id === n.ref);
              if (!a || a.archivada) return null;
              const c = db.clientes.find((x) => x.id === a.cliente); color = c?.color;
              const r = db.personas.find((x) => x.id === a.responsable);
              cuerpo = html`<div class="n-top"><span class="n-cli">${c?.nombre}</span><span class="n-anillo"><${Anillo} estatus=${estatusVisible(a)} /></span></div>
                <div class="n-t">${a.titulo}</div><div class="n-pie"><${Avatar} p=${r} /><span>${fechaRelativa(a.fecha)}</span></div>`;
            } else if (n.tipo === 'persona') {
              const pe = db.personas.find((x) => x.id === n.ref);
              cuerpo = html`<${Avatar} p=${pe} grande /><div><b>${pe?.corto}</b><span>${pe?.puesto}</span></div>`;
            } else {
              cuerpo = editando === n.id
                ? html`<textarea autofocus class="n-nota-campo" value=${n.texto} onBlur=${(e) => { editarNota(n.id, e.target.value); setEditando(null); }} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } }}></textarea>`
                : html`<span class="n-nota">${n.texto}</span>`;
            }
            return html`<div key=${n.id} class=${`nodo n-${n.tipo}` + (mov?.id === n.id ? ' moviendo' : '')} data-nodo=${n.id}
              style=${`left:${p.x}px;top:${p.y}px;width:${w}px;min-height:${h}px;--c:${color || 'var(--tinta-3)'}`} onPointerDown=${(e) => moverInicio(e, n)}>
              <span class="puerto entrada"></span>
              ${cuerpo}
              <span class="puerto salida" title="Arrastra para conectar" onPointerDown=${(e) => conectarInicio(e, n)}></span>
              <button class="n-quitar" aria-label="Quitar del mapa" onPointerDown=${(e) => e.stopPropagation()} onClick=${() => quitarNodo(n.id)}>${I('x')}</button>
            </div>`;
          })}
        </div>
        ${sel && html`<button class="btn quitar-arista" onClick=${() => { desconectar(sel, yo); setSel(null); }}>${I('x')}Quitar flecha</button>`}
        <div class="mapa-zoom">
          <button class="icon-btn" onClick=${() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Acercar">${I('mas')}</button>
          <button class="icon-btn" onClick=${() => { setZoom(1); setPan({ x: 300, y: 40 }); }} aria-label="Centrar">${I('brujula')}</button>
          <button class="icon-btn" onClick=${() => setZoom((z) => Math.max(0.4, z - 0.1))} aria-label="Alejar">${I('menos')}</button>
        </div>
        <div class="mapa-leyenda"><span>${I('enlace')} Tarea → persona = asignar</span><span>Tarea → tarea = espera a</span></div>
      </div>
    </div>`;
}
