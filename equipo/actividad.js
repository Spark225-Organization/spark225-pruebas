// Panel de una actividad: crear y editar con todas las reglas de la fase 1.
import { html, useState, useEffect, useRef, useMemo } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { ESTATUS, REPETICION, MOTIVOS_FECHA, ESFUERZO_HORAS, hoyISO } from './datos.js';
import { nuevaVacia, crear, actualizar, validar, archivar, restaurar, vigentes, dependenciaAbierta, alternarFoco } from './store.js';
import { I, Anillo, Avatar, fechaLarga, haceCuanto, duracion } from './ui.js';

const copia = (x) => JSON.parse(JSON.stringify(x));
const uid = () => Math.random().toString(36).slice(2, 9);

export function CajonActividad({ cajon, yo, db, toast, cerrar }) {
  const original = useMemo(() => {
    if (cajon.id) return copia(db.actividades.find((a) => a.id === cajon.id));
    return nuevaVacia(yo, cajon.nuevo || {});
  }, []);
  const [b, setB] = useState(() => copia(original));
  const [errores, setErrores] = useState({});
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [nuevoCheck, setNuevoCheck] = useState('');
  const [nuevoEnlace, setNuevoEnlace] = useState({ titulo: '', url: '' });
  const [errEnlace, setErrEnlace] = useState('');
  const titulo = useRef();
  const esNueva = !original.id;
  const hoy = hoyISO();

  useEffect(() => { if (esNueva) titulo.current?.focus(); }, []);
  const set = (k, v) => { setB((x) => ({ ...x, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };
  const sucio = JSON.stringify(b) !== JSON.stringify(original);
  const intentarCerrar = () => (sucio ? setDescartar(true) : cerrar());

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape' && !pedirMotivo && !descartar) { e.stopPropagation(); intentarCerrar(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); guardar(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const cliente = db.clientes.find((c) => c.id === b.cliente);
  const proyectosDelCliente = db.proyectos.filter((p) => !b.cliente || p.cliente === b.cliente);
  const posiblesDep = vigentes().filter((a) => a.id !== b.id && a.estatus !== 'hecho' && (!b.id || a.dependeDe !== b.id));
  const depAbierta = b.dependeDe ? dependenciaAbierta({ ...b, dependeDe: b.dependeDe }) : null;
  const responsable = db.personas.find((p) => p.id === b.responsable);
  const fechaMovida = !esNueva && b.fecha !== original.fecha;

  function guardar(motivo) {
    const e = validar(b);
    if (depAbierta && (b.estatus === 'en_curso' || b.estatus === 'hecho') && b.estatus !== original.estatus) {
      e.estatus = `Espera a «${depAbierta.titulo}». Ciérrala primero o quita la dependencia.`;
    }
    setErrores(e);
    if (Object.values(e).some(Boolean)) { toast('Faltan datos. Revisa los campos marcados.'); return; }
    if (fechaMovida && !motivo) { setPedirMotivo(true); return; }
    if (esNueva) {
      const a = crear(b, yo);
      toast(a.responsable === yo ? 'Actividad creada.' : `Actividad asignada a ${responsable?.corto}.`);
    } else {
      const cambios = {};
      Object.keys(b).forEach((k) => { if (JSON.stringify(b[k]) !== JSON.stringify(original[k])) cambios[k] = b[k]; });
      if (Object.keys(cambios).length) { actualizar(b.id, cambios, yo, motivo); toast('Cambios guardados.'); }
    }
    cerrar();
  }

  const quitarCheck = (id) => set('checklist', b.checklist.filter((c) => c.id !== id));
  const agregarCheck = () => { const t = nuevoCheck.trim(); if (!t) return; set('checklist', [...b.checklist, { id: uid(), texto: t, hecho: false }]); setNuevoCheck(''); };
  const agregarEnlace = () => {
    const url = nuevoEnlace.url.trim();
    if (!/^https?:\/\//i.test(url)) { setErrEnlace('Pega un enlace completo que empiece con https://'); return; }
    set('enlaces', [...b.enlaces, { id: uid(), titulo: nuevoEnlace.titulo.trim() || url.replace(/^https?:\/\//, '').slice(0, 48), url }]);
    setNuevoEnlace({ titulo: '', url: '' }); setErrEnlace('');
  };

  return html`
    <div class="velo" onClick=${intentarCerrar}></div>
    <aside class="cajon" role="dialog" aria-modal="true" aria-label=${esNueva ? 'Nueva actividad' : 'Editar actividad'} style=${`--c:${cliente?.color || 'var(--tinta-3)'}`}>
      <div class="cajon-cab">
        <span class="que">${esNueva ? 'Nueva actividad' : `Creada ${haceCuanto(original.creada)}`}</span>
        <button class="icon-btn" onClick=${intentarCerrar} aria-label="Cerrar">${I('x')}</button>
      </div>

      <div class="cajon-cuerpo">
        <div>
          <textarea ref=${titulo} class="titulo-campo" rows="2" placeholder="¿Qué hay que hacer?" value=${b.titulo}
            onInput=${(e) => set('titulo', e.target.value)} aria-label="Título" aria-invalid=${!!errores.titulo}></textarea>
          ${errores.titulo && html`<div class="err" style="margin-top:2px">${errores.titulo}</div>`}
        </div>

        <div>
          <div class="segmentado" role="radiogroup" aria-label="Estatus" style="flex-wrap:wrap">
            ${ESTATUS.map((s) => html`<button key=${s.id} role="radio" aria-pressed=${b.estatus === s.id} aria-checked=${b.estatus === s.id}
              onClick=${() => set('estatus', s.id)} style="display:inline-flex;align-items:center;gap:6px;color:${b.estatus === s.id ? 'var(--tinta)' : ''}">
              <span style=${`width:16px;height:16px;display:inline-grid;color:${cliente?.color || 'var(--tinta-2)'}`}><${Anillo} estatus=${s.id} /></span>${s.nombre}</button>`)}
          </div>
          ${errores.estatus && html`<div class="err" style="margin-top:6px">${errores.estatus}</div>`}
        </div>

        ${depAbierta && html`<div class="aviso-dep">${I('cadena')}<span>Esta actividad espera a «${depAbierta.titulo}». Se ve como bloqueada hasta que esa se cierre.</span></div>`}

        <div class="fila-estado">
          <button class="interruptor" role="switch" aria-checked=${b.foco === hoy} onClick=${() => {
            if (b.foco === hoy) return set('foco', null);
            const n = vigentes().filter((a) => a.responsable === b.responsable && a.foco === hoy && a.id !== b.id && a.estatus !== 'hecho').length;
            if (n >= 3) return toast('Ya hay 3 actividades en foco hoy. Quita una primero.');
            set('foco', hoy);
          }}><span class="pista"></span>Foco de hoy</button>
        </div>

        <div class="campos">
          <span class="lab req">Responsable</span>
          <div class="personas-sel" role="radiogroup" aria-label="Responsable">
            ${db.personas.map((p) => html`<button key=${p.id} class="per-op" role="radio" aria-pressed=${b.responsable === p.id} aria-checked=${b.responsable === p.id}
              onClick=${() => { set('responsable', p.id); if (b.colaboradores.includes(p.id)) set('colaboradores', b.colaboradores.filter((x) => x !== p.id)); }}><${Avatar} p=${p} />${p.corto}</button>`)}
          </div>
          ${errores.responsable && html`<div class="err">${errores.responsable}</div>`}

          <span class="lab">Colaboran</span>
          <div class="personas-sel" aria-label="Colaboradores">
            ${db.personas.filter((p) => p.id !== b.responsable).map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${b.colaboradores.includes(p.id)}
              onClick=${() => set('colaboradores', b.colaboradores.includes(p.id) ? b.colaboradores.filter((x) => x !== p.id) : [...b.colaboradores, p.id])}><${Avatar} p=${p} />${p.corto}</button>`)}
          </div>

          <span class="lab req">Cliente</span>
          <div class=${'clientes-sel' + (errores.cliente ? ' error' : '')} role="radiogroup" aria-label="Cliente">
            ${db.clientes.map((c) => html`<button key=${c.id} class="cli-op" style=${`--c:${c.color}`} role="radio" aria-pressed=${b.cliente === c.id} aria-checked=${b.cliente === c.id}
              onClick=${() => { const pr = db.proyectos.filter((p) => p.cliente === c.id); setB((x) => ({ ...x, cliente: c.id, proyecto: pr.some((p) => p.id === x.proyecto) ? x.proyecto : (pr.length === 1 ? pr[0].id : null) })); setErrores((e) => ({ ...e, cliente: null, proyecto: null })); }}><i></i>${c.nombre}</button>`)}
          </div>
          ${errores.cliente && html`<div class="err">${errores.cliente}</div>`}

          <label class="req" for="f-proy">Proyecto</label>
          <select id="f-proy" class=${'control' + (errores.proyecto ? ' error' : '')} value=${b.proyecto || ''} onChange=${(e) => set('proyecto', e.target.value || null)}>
            <option value="">${b.cliente ? 'Elige un proyecto' : 'Primero elige el cliente'}</option>
            ${proyectosDelCliente.map((p) => html`<option key=${p.id} value=${p.id}>${p.nombre}</option>`)}
          </select>
          ${errores.proyecto && html`<div class="err">${errores.proyecto}</div>`}

          <label class="req" for="f-fecha">Fecha límite</label>
          <div>
            <input id="f-fecha" type="date" class=${'control' + (errores.fecha ? ' error' : '')} value=${b.fecha || ''} onInput=${(e) => set('fecha', e.target.value)} />
            ${!esNueva && original.fechaOriginal && original.fechaOriginal !== b.fecha && html`<div class="w-pie" style="margin-top:4px">Fecha original: ${fechaLarga(original.fechaOriginal)}. El cumplimiento se mide contra ésta.</div>`}
          </div>
          ${errores.fecha && html`<div class="err">${errores.fecha}</div>`}

          <span class="lab req">Esfuerzo</span>
          <div>
            <div class=${'segmentado' + (errores.esfuerzo ? ' error' : '')} role="radiogroup" aria-label="Esfuerzo">
              ${['S', 'M', 'L'].map((t) => html`<button key=${t} role="radio" aria-pressed=${b.esfuerzo === t} aria-checked=${b.esfuerzo === t} onClick=${() => set('esfuerzo', t)} title=${`Aproximadamente ${ESFUERZO_HORAS[t]} h`}>${t} · ${ESFUERZO_HORAS[t]} h</button>`)}
            </div>
          </div>
          ${errores.esfuerzo && html`<div class="err">${errores.esfuerzo}</div>`}

          <span class="lab">Agendar</span>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="interruptor" role="switch" aria-checked=${!!b.bloque} onClick=${() => set('bloque', b.bloque ? null : { inicio: '10:00', min: 60 })}><span class="pista"></span>Ponerle hora en la mecha</button>
            ${b.bloque && html`<div class="duo">
              <input type="time" class="control" aria-label="Hora de inicio" value=${b.bloque.inicio} onInput=${(e) => set('bloque', { ...b.bloque, inicio: e.target.value })} />
              <select class="control" aria-label="Duración" value=${b.bloque.min} onChange=${(e) => set('bloque', { ...b.bloque, min: +e.target.value })}>
                ${[15, 20, 30, 45, 60, 90, 120, 180, 240].map((m) => html`<option key=${m} value=${m}>${duracion(m)}</option>`)}
              </select></div>`}
          </div>
          ${errores.bloque && html`<div class="err">${errores.bloque}</div>`}

          <label for="f-rep">Se repite</label>
          <div class="duo">
            <select id="f-rep" class="control" value=${b.repeticion.tipo} onChange=${(e) => set('repeticion', { ...b.repeticion, tipo: e.target.value })}>
              ${REPETICION.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}
            </select>
            ${b.repeticion.tipo === 'cada_n' && html`<input type="number" min="1" max="365" class="control" aria-label="Cada cuántos días" value=${b.repeticion.cada} onInput=${(e) => set('repeticion', { ...b.repeticion, cada: +e.target.value })} />`}
          </div>
          ${errores.repeticion && html`<div class="err">${errores.repeticion}</div>`}

          <label for="f-dep">Espera a</label>
          <select id="f-dep" class="control" value=${b.dependeDe || ''} onChange=${(e) => set('dependeDe', e.target.value || null)}>
            <option value="">No depende de otra</option>
            ${posiblesDep.map((a) => html`<option key=${a.id} value=${a.id}>${a.titulo}</option>`)}
          </select>
        </div>

        <section class="bloque-sec">
          <h3>Pasos <span>${b.checklist.filter((c) => c.hecho).length}/${b.checklist.length}</span></h3>
          <ul class="check-lista">
            ${b.checklist.map((c) => html`<li key=${c.id}>
              <input type="checkbox" checked=${c.hecho} aria-label=${c.texto} onChange=${() => set('checklist', b.checklist.map((x) => (x.id === c.id ? { ...x, hecho: !x.hecho } : x)))} />
              <span class=${'txt' + (c.hecho ? ' hecho' : '')}>${c.texto}</span>
              <button class="quitar" aria-label=${`Quitar «${c.texto}»`} onClick=${() => quitarCheck(c.id)}>${I('x')}</button></li>`)}
          </ul>
          <div class="agregar">
            <input class="control" placeholder="Agregar un paso y presionar Enter" value=${nuevoCheck} onInput=${(e) => setNuevoCheck(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCheck(); } }} aria-label="Nuevo paso" />
            <button class="btn" onClick=${agregarCheck}>Agregar</button>
          </div>
        </section>

        <section class="bloque-sec">
          <h3>Enlaces a Drive <span>${b.enlaces.length || ''}</span></h3>
          <ul class="enlaces">
            ${b.enlaces.map((l) => html`<li key=${l.id}>${I('enlace')}<a href=${l.url} target="_blank" rel="noopener">${l.titulo}</a><button class="quitar" style="opacity:1" aria-label=${`Quitar enlace ${l.titulo}`} onClick=${() => set('enlaces', b.enlaces.filter((x) => x.id !== l.id))}>${I('x')}</button></li>`)}
          </ul>
          <div class="agregar">
            <input class="control" style="flex:0.8" placeholder="Nombre" value=${nuevoEnlace.titulo} onInput=${(e) => setNuevoEnlace({ ...nuevoEnlace, titulo: e.target.value })} aria-label="Nombre del enlace" />
            <input class="control" placeholder="https://drive.google.com/…" value=${nuevoEnlace.url} onInput=${(e) => { setNuevoEnlace({ ...nuevoEnlace, url: e.target.value }); setErrEnlace(''); }} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEnlace(); } }} aria-label="Enlace" />
            <button class="btn" onClick=${agregarEnlace}>Agregar</button>
          </div>
          ${errEnlace && html`<div class="err" style="margin-top:6px">${errEnlace}</div>`}
        </section>

        <section class="bloque-sec">
          <h3><label for="f-notas">Notas</label></h3>
          <textarea id="f-notas" class="control" rows="3" placeholder="Contexto, acuerdos o lo que haga falta saber" value=${b.notas} onInput=${(e) => set('notas', e.target.value)}></textarea>
        </section>

        ${!esNueva && html`<section class="bloque-sec">
          <h3>Historial</h3>
          <ul class="historial">
            ${[...(original.historial || [])].reverse().map((h, i) => {
              const p = db.personas.find((x) => x.id === h.quien);
              return html`<li key=${i}><b>${p?.corto || 'Sistema'}</b> ${h.que}${h.motivo && html`<span class="motivo">Motivo: ${h.motivo}</span>`}<span class="cuando">${haceCuanto(h.cuando)}</span></li>`;
            })}
          </ul>
        </section>`}
      </div>

      <div class="cajon-pie">
        ${!esNueva && (original.archivada
          ? html`<button class="btn" onClick=${() => { restaurar(original.id, yo); toast('Actividad restaurada.'); cerrar(); }}>Restaurar</button>`
          : html`<button class="btn peligro" onClick=${() => { archivar(original.id, yo); toast('Actividad archivada. Queda 30 días en la papelera.', { texto: 'Deshacer', f: () => restaurar(original.id, yo) }); cerrar(); }}>${I('archivar')}Archivar</button>`)}
        <span class="espacio"></span>
        <button class="btn fantasma" onClick=${intentarCerrar}>Cancelar</button>
        <button class="btn prim" onClick=${() => guardar()}>${esNueva ? 'Crear actividad' : 'Guardar'}</button>
      </div>
    </aside>

    ${pedirMotivo && html`<${ModalMotivo} de=${original.fecha} a=${b.fecha} cancelar=${() => setPedirMotivo(false)} confirmar=${(m) => { setPedirMotivo(false); guardar(m); }} />`}
    ${descartar && html`
      <div class="velo alto" onClick=${() => setDescartar(false)}></div>
      <div class="modal-caja chico" role="alertdialog" aria-modal="true" aria-labelledby="t-desc">
        <h2 id="t-desc">Tienes cambios sin guardar</h2>
        <p>Si cierras ahora, se pierden.</p>
        <div class="pie"><button class="btn fantasma" onClick=${() => setDescartar(false)}>Seguir editando</button><button class="btn prim" onClick=${cerrar}>Descartar cambios</button></div>
      </div>`}`;
}

function ModalMotivo({ de, a, cancelar, confirmar }) {
  const [m, setM] = useState(null);
  const [detalle, setDetalle] = useState('');
  const [err, setErr] = useState('');
  const ok = () => {
    if (!m) return setErr('Elige un motivo.');
    if (m === 'Otro' && !detalle.trim()) return setErr('Escribe el motivo.');
    confirmar(detalle.trim() ? `${m}: ${detalle.trim()}` : m);
  };
  return html`
    <div class="velo alto" onClick=${cancelar}></div>
    <div class="modal-caja chico" role="dialog" aria-modal="true" aria-labelledby="t-mot">
      <h2 id="t-mot">¿Por qué cambia la fecha?</h2>
      <p>De ${fechaLarga(de)} a ${fechaLarga(a)}. Queda en el historial y el cumplimiento se sigue midiendo contra la fecha original.</p>
      <div class="opciones-motivo">${MOTIVOS_FECHA.map((x) => html`<button key=${x} aria-pressed=${m === x} onClick=${() => { setM(x); setErr(''); }}>${x}</button>`)}</div>
      <textarea class="control" rows="2" placeholder=${m === 'Otro' ? 'Escribe el motivo' : 'Detalle opcional'} value=${detalle} onInput=${(e) => { setDetalle(e.target.value); setErr(''); }} aria-label="Detalle del motivo"></textarea>
      ${err && html`<div class="err" style="margin-top:6px">${err}</div>`}
      <div class="pie"><button class="btn fantasma" onClick=${cancelar}>Cancelar</button><button class="btn prim" onClick=${ok}>Mover fecha</button></div>
    </div>`;
}
