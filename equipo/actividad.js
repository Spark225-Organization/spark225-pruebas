// Panel de una actividad: lo esencial arriba, el resto en «Más».
import { html, useState, useEffect, useRef, useMemo } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { ESTATUS, REPETICION, MOTIVOS_FECHA, ESFUERZO_HORAS, PRIORIDADES, hoyISO, sumarDias } from './datos.js?v=202611270120';
import { nuevaVacia, crear, actualizar, validar, archivar, restaurar, vigentes, dependenciaAbierta } from './store.js?v=202611270120';
import { I, Anillo, Avatar, haceCuanto, duracion, fechaCorta } from './ui.js?v=202611270120';

const copia = (x) => JSON.parse(JSON.stringify(x));
const uid = () => Math.random().toString(36).slice(2, 9);

export function CajonActividad({ cajon, yo, db, toast, cerrar, pedirMotivo }) {
  const original = useMemo(() => {
    if (cajon.id) return copia(db.actividades.find((a) => a.id === cajon.id));
    return { ...nuevaVacia(yo), proyecto: 'g-interno', cliente: 'interno', esfuerzo: 'S', ...(cajon.nuevo || {}) };
  }, []);
  const [b, setB] = useState(() => copia(original));
  const [errores, setErrores] = useState({});
  const [mas, setMas] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [nuevoCheck, setNuevoCheck] = useState('');
  const [nuevoEnlace, setNuevoEnlace] = useState('');
  const titulo = useRef();
  const esNueva = !original.id;
  const hoy = hoyISO();

  useEffect(() => { if (esNueva) titulo.current?.focus(); }, []);
  const set = (k, v) => { setB((x) => ({ ...x, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };
  const sucio = JSON.stringify(b) !== JSON.stringify(original);
  const intentarCerrar = () => (sucio ? setDescartar(true) : cerrar());

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape' && !descartar) { e.stopPropagation(); intentarCerrar(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); guardar(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const cliente = db.clientes.find((c) => c.id === b.cliente);
  const proyectos = db.proyectos.filter((p) => p.cliente === b.cliente);
  const posiblesDep = vigentes().filter((a) => a.id !== b.id && a.estatus !== 'hecho' && (!b.id || a.dependeDe !== b.id));
  const depAbierta = b.dependeDe ? dependenciaAbierta(b) : null;
  const responsable = db.personas.find((p) => p.id === b.responsable);

  function guardar() {
    const e = validar(b);
    if (depAbierta && (b.estatus === 'en_curso' || b.estatus === 'hecho') && b.estatus !== original.estatus) e.estatus = `Espera a «${depAbierta.titulo}»`;
    setErrores(e);
    if (Object.values(e).some(Boolean)) { if (e.proyecto || e.esfuerzo || e.repeticion) setMas(true); return; }
    if (esNueva) {
      const a = crear(b, yo);
      toast(a.responsable === yo ? 'Listo' : `Asignada a ${responsable?.corto}`);
      return cerrar();
    }
    const cambios = {};
    Object.keys(b).forEach((k) => { if (JSON.stringify(b[k]) !== JSON.stringify(original[k])) cambios[k] = b[k]; });
    if (!Object.keys(cambios).length) return cerrar();
    if (cambios.fecha) return pedirMotivo((m) => { actualizar(b.id, cambios, yo, m); toast('Guardado'); cerrar(); });
    actualizar(b.id, cambios, yo); toast('Guardado'); cerrar();
  }

  const dias = [0, 1, 2, 3, 4].map((n) => sumarDias(hoy, n));
  const etiquetaDia = (f) => (f === hoy ? 'Hoy' : f === sumarDias(hoy, 1) ? 'Mañana' : fechaCorta(f).split(' ').slice(0, 2).join(' '));

  return html`
    <div class="velo" onClick=${intentarCerrar}></div>
    <aside class="cajon" role="dialog" aria-modal="true" aria-label=${esNueva ? 'Nueva actividad' : b.titulo} style=${`--c:${cliente?.color || 'var(--tinta-3)'}`}>
      <div class="cajon-cab">
        <button class=${'icon-btn' + (b.foco === hoy ? ' activo' : '')} aria-pressed=${b.foco === hoy} title="Foco de hoy" onClick=${() => {
          if (b.foco === hoy) return set('foco', null);
          const n = vigentes().filter((a) => a.responsable === b.responsable && a.foco === hoy && a.id !== b.id && a.estatus !== 'hecho').length;
          if (n >= 3) return toast('Máximo 3 en foco');
          set('foco', hoy);
        }}>${I('foco')}</button>
        <span style="flex:1"></span>
        ${!esNueva && (original.archivada
          ? html`<button class="icon-btn" title="Restaurar" onClick=${() => { restaurar(original.id, yo); toast('Restaurada'); cerrar(); }}>${I('reset')}</button>`
          : html`<button class="icon-btn" title="Eliminar" aria-label="Eliminar" onClick=${() => { archivar(original.id, yo); toast('Eliminada', { texto: 'Deshacer', f: () => restaurar(original.id, yo) }); cerrar(); }}>${I('papelera')}</button>`)}
        <button class="icon-btn" onClick=${intentarCerrar} aria-label="Cerrar">${I('x')}</button>
      </div>

      <div class="cajon-cuerpo">
        <textarea ref=${titulo} class=${'titulo-campo' + (errores.titulo ? ' error' : '')} rows="2" placeholder="Nueva actividad" value=${b.titulo}
          onInput=${(e) => set('titulo', e.target.value)} aria-label="Título"></textarea>

        <div class="estatus-fila" role="radiogroup" aria-label="Estatus">
          ${ESTATUS.map((s) => html`<button key=${s.id} role="radio" aria-checked=${b.estatus === s.id} title=${s.nombre}
            class=${'est' + (b.estatus === s.id ? ' on' : '')} onClick=${() => set('estatus', s.id)}><${Anillo} estatus=${s.id} /><span>${s.nombre}</span></button>`)}
        </div>
        ${(errores.estatus || depAbierta) && html`<div class="aviso-dep">${I('cadena')}<span>${errores.estatus || depAbierta.titulo}</span></div>`}

        <div class="fila-ico" title="Cliente">
          ${I('clientes')}
          <div class="chips-scroll">${db.clientes.filter((c) => !c.privado || b.responsable === yo).map((c) => html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} aria-pressed=${b.cliente === c.id}
            onClick=${() => { setB((x) => ({ ...x, cliente: c.id, proyecto: db.proyectos.some((p) => p.id === x.proyecto && p.cliente === c.id) ? x.proyecto : 'g-' + c.id })); }}><i></i>${c.nombre}</button>`)}</div>
        </div>

        <div class="fila-ico" title="Fecha">
          ${I('semana')}
          <div class="chips-scroll">
            ${dias.map((f) => html`<button key=${f} class="chip-op" aria-pressed=${b.fecha === f} onClick=${() => set('fecha', f)}>${etiquetaDia(f)}</button>`)}
            <input type="date" class="control fecha-mini" value=${b.fecha} onInput=${(e) => set('fecha', e.target.value)} aria-label="Otra fecha" />
          </div>
        </div>

        <div class="fila-ico" title="Prioridad">
          ${I('alerta')}
          <div class="chips-scroll" role="radiogroup" aria-label="Prioridad">${PRIORIDADES.map((p) => html`<button key=${p.id} role="radio" class=${'chip-op pri-op pri-' + p.id} aria-checked=${b.prioridad === p.id} aria-pressed=${b.prioridad === p.id}
            onClick=${() => set('prioridad', b.prioridad === p.id ? null : p.id)}><i></i>${p.nombre}</button>`)}</div>
        </div>

        <div class="fila-ico" title="Hora">
          ${I('reloj')}
          ${b.bloque ? html`<div class="duo">
              <input type="time" class="control" value=${b.bloque.inicio} onInput=${(e) => set('bloque', { ...b.bloque, inicio: e.target.value })} aria-label="Hora" />
              <select class="control" value=${b.bloque.min} onChange=${(e) => set('bloque', { ...b.bloque, min: +e.target.value })} aria-label="Duración">
                ${[15, 30, 45, 60, 90, 120, 180, 240].map((m) => html`<option key=${m} value=${m}>${duracion(m)}</option>`)}
              </select>
              <button class="icon-btn" onClick=${() => set('bloque', null)} aria-label="Quitar hora">${I('x')}</button></div>`
            : html`<button class="chip-op" onClick=${() => set('bloque', { inicio: '10:00', min: 60 })}>${I('mas')}Hora</button>`}
        </div>

        <div class="fila-ico" title="Quién">
          ${I('persona')}
          <div class="chips-scroll">${db.personas.map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${b.responsable === p.id}
            onClick=${() => { set('responsable', p.id); set('colaboradores', b.colaboradores.filter((x) => x !== p.id)); }}><${Avatar} p=${p} />${p.corto}</button>`)}</div>
        </div>

        <div class="fila-ico" title="Colaboran">
          ${I('equipo')}
          <div class="chips-scroll">${db.personas.filter((p) => p.id !== b.responsable).map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${b.colaboradores.includes(p.id)}
            onClick=${() => set('colaboradores', b.colaboradores.includes(p.id) ? b.colaboradores.filter((x) => x !== p.id) : [...b.colaboradores, p.id])}><${Avatar} p=${p} />${p.corto}</button>`)}</div>
        </div>

        <div class="fila-ico arriba" title="Pasos">
          ${I('lista')}
          <div style="flex:1;min-width:0">
            <ul class="check-lista">${b.checklist.map((c) => html`<li key=${c.id}>
              <input type="checkbox" checked=${c.hecho} aria-label=${c.texto} onChange=${() => set('checklist', b.checklist.map((x) => (x.id === c.id ? { ...x, hecho: !x.hecho } : x)))} />
              <span class=${'txt' + (c.hecho ? ' hecho' : '')}>${c.texto}</span>
              <button class="quitar" aria-label=${`Quitar ${c.texto}`} onClick=${() => set('checklist', b.checklist.filter((x) => x.id !== c.id))}>${I('x')}</button></li>`)}</ul>
            <input class="control sutil" placeholder="+ Paso" value=${nuevoCheck} onInput=${(e) => setNuevoCheck(e.target.value)}
              onKeyDown=${(e) => { if (e.key === 'Enter' && nuevoCheck.trim()) { e.preventDefault(); set('checklist', [...b.checklist, { id: uid(), texto: nuevoCheck.trim(), hecho: false }]); setNuevoCheck(''); } }} aria-label="Nuevo paso" />
          </div>
        </div>

        <button class="mas-btn" aria-expanded=${mas} onClick=${() => setMas(!mas)}>${I('ajustes')}<span>Más</span>${I('flecha', mas ? 'rot-arriba' : 'rot-abajo')}</button>

        ${mas && html`<div class="mas-cuerpo">
          <label class="campo"><span>Proyecto</span>
            <select class=${'control' + (errores.proyecto ? ' error' : '')} value=${b.proyecto || ''} onChange=${(e) => set('proyecto', e.target.value || null)}>
              ${proyectos.map((p) => html`<option key=${p.id} value=${p.id}>${p.nombre}</option>`)}
            </select></label>
          <div class="campo"><span>Esfuerzo</span>
            <div class="segmentado" role="radiogroup">${['S', 'M', 'L'].map((t) => html`<button key=${t} role="radio" aria-pressed=${b.esfuerzo === t} aria-checked=${b.esfuerzo === t} onClick=${() => set('esfuerzo', t)} title=${`≈ ${ESFUERZO_HORAS[t]} h`}>${t}</button>`)}</div></div>
          <label class="campo"><span>Se repite</span>
            <div class="duo">
              <select class="control" value=${b.repeticion.tipo} onChange=${(e) => set('repeticion', { ...b.repeticion, tipo: e.target.value })}>${REPETICION.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}</select>
              ${b.repeticion.tipo === 'cada_n' && html`<input type="number" min="1" class="control" value=${b.repeticion.cada} onInput=${(e) => set('repeticion', { ...b.repeticion, cada: +e.target.value })} aria-label="Días" />`}
            </div></label>
          <label class="campo"><span>Espera a</span>
            <select class="control" value=${b.dependeDe || ''} onChange=${(e) => set('dependeDe', e.target.value || null)}>
              <option value="">—</option>${posiblesDep.map((a) => html`<option key=${a.id} value=${a.id}>${a.titulo}</option>`)}
            </select></label>
          <div class="campo"><span>Enlaces</span>
            <div><ul class="enlaces">${b.enlaces.map((l) => html`<li key=${l.id}>${I('enlace')}<a href=${l.url} target="_blank" rel="noopener">${l.titulo}</a><button class="quitar" style="opacity:1" onClick=${() => set('enlaces', b.enlaces.filter((x) => x.id !== l.id))} aria-label="Quitar">${I('x')}</button></li>`)}</ul>
            <input class="control sutil" placeholder="+ Pega un enlace de Drive" value=${nuevoEnlace} onInput=${(e) => setNuevoEnlace(e.target.value)}
              onKeyDown=${(e) => { if (e.key !== 'Enter') return; e.preventDefault(); const u = nuevoEnlace.trim(); if (!/^https?:\/\//i.test(u)) return toast('Pega un enlace https://'); set('enlaces', [...b.enlaces, { id: uid(), titulo: u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), url: u }]); setNuevoEnlace(''); }} /></div></div>
          ${b.estatus === 'hecho' && html`<label class="campo"><span>Entrega real</span><input type="date" class="control" value=${b.entregaReal || ''} onInput=${(e) => set('entregaReal', e.target.value || null)} /></label>`}
          <label class="campo"><span>Notas</span><textarea class="control" rows="3" placeholder="Escribe @nombre para avisarle" value=${b.notas} onInput=${(e) => set('notas', e.target.value)}></textarea></label>
          ${!esNueva && html`<div class="campo"><span>Historial</span><ul class="historial">${[...(original.historial || [])].reverse().map((h, i) => {
            const p = db.personas.find((x) => x.id === h.quien);
            return html`<li key=${i}><b>${p?.corto || '—'}</b> ${h.que}${h.motivo && html`<span class="motivo">${h.motivo}</span>`}<span class="cuando">${haceCuanto(h.cuando)}</span></li>`;
          })}</ul></div>`}
        </div>`}
      </div>

      <div class="cajon-pie">
        <button class="btn prim ancho" onClick=${guardar}>${esNueva ? 'Agregar' : 'Guardar'}</button>
      </div>
    </aside>
    ${descartar && html`
      <div class="velo alto" onClick=${() => setDescartar(false)}></div>
      <div class="hoja chica" role="alertdialog" aria-modal="true" aria-label="Cambios sin guardar">
        <div class="hoja-asa"></div>
        <div class="fila-btn"><button class="btn" onClick=${() => setDescartar(false)}>Seguir</button><button class="btn peligro" onClick=${cerrar}>Descartar</button></div>
      </div>`}`;
}

// Hoja de motivo al mover una fecha: un toque y listo.
export function HojaMotivo({ cancelar, elegir }) {
  return html`
    <div class="velo alto" onClick=${cancelar}></div>
    <div class="hoja chica" role="dialog" aria-modal="true" aria-label="¿Por qué se mueve?">
      <div class="hoja-asa"></div>
      <div class="hoja-t">¿Por qué se mueve?</div>
      <div class="opciones-motivo">${MOTIVOS_FECHA.map((m) => html`<button key=${m} onClick=${() => elegir(m)}>${m}</button>`)}</div>
    </div>`;
}
