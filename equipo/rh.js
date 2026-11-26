// Recursos Humanos: cómo está organizado Spark (organigrama por área, con «Tú estás aquí»),
// los documentos de la compañía y la lista del equipo.
import { html, useState } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { areasVigentes, guardarAreas, guardarDocumento, quitarDocumento, esAdmin, nube } from './store.js?v=202611262330';
import { I, Avatar, haceCuanto } from './ui.js?v=202611262330';

export const CATEGORIAS_DOCS = [
  { id: 'cultura', nombre: 'Misión, visión y valores', ayuda: 'Quiénes somos y cómo trabajamos.' },
  { id: 'politicas', nombre: 'Políticas', ayuda: 'Facturación, viajes, gastos y vacaciones.' },
  { id: 'productos', nombre: 'Productos y servicios', ayuda: 'Qué vendemos y cómo se entrega.' },
  { id: 'clientes', nombre: 'Cliente ideal', ayuda: 'A quién le vendemos y por qué nos eligen.' },
  { id: 'evaluaciones', nombre: 'Evaluaciones del equipo', ayuda: 'Solo las ve Dirección.', soloDireccion: true },
  { id: 'otros', nombre: 'Otros', ayuda: 'Plantillas, manuales y lo demás.' },
];

export const areaDe = (uId) => areasVigentes().find((a) => (a.personas || []).includes(uId));

export function RecursosHumanos({ ctx, pestana, Personas }) {
  const tabs = [['spark', 'Cómo es Spark', 'organigrama'], ['documentos', 'Documentos', 'documento'], ['personas', 'Personas', 'equipo']];
  return html`<div class="rh">
    <header class="cab-inicio">
      <div class="cab-dia"><h1>Recursos Humanos</h1></div>
      <nav class="segmentado" aria-label="Secciones">${tabs.map(([k, t, ico]) => html`<a key=${k} href=${'#/rh/' + k} role="button" aria-pressed=${pestana === k} class="seg-link">${I(ico)}<span>${t}</span></a>`)}</nav>
    </header>
    ${nube.sinRH && html`<p class="aviso-guardado">${I('alerta')}El organigrama y los documentos se guardan solo en este navegador hasta activar su espacio en la base (un paso de una vez).</p>`}
    ${pestana === 'spark' && html`<${Organigrama} ctx=${ctx} />`}
    ${pestana === 'documentos' && html`<${Documentos} ctx=${ctx} />`}
    ${pestana === 'personas' && Personas}
  </div>`;
}

// ---------- Organigrama ----------
function Organigrama({ ctx }) {
  const { db, yo, toast } = ctx;
  const admin = esAdmin(yo);
  const [edit, setEdit] = useState(null); // copia de trabajo de las áreas
  const areas = edit || areasVigentes();
  const raiz = areas.find((a) => a.raiz) || areas[0];
  const hijas = areas.filter((a) => a !== raiz);
  const conArea = new Set(areas.flatMap((a) => a.personas || []));
  const sinArea = db.personas.filter((p) => !conArea.has(p.id));
  const miArea = areas.find((a) => (a.personas || []).includes(yo));
  const propuesta = areas.some((a) => a.propuesta);

  const mover = (pid, aid) => setEdit(areas.map((a) => ({ ...a, personas: (a.personas || []).filter((x) => x !== pid).concat(a.id === aid ? [pid] : []) })));
  const renombrar = (aid, nombre) => setEdit(areas.map((a) => (a.id === aid ? { ...a, nombre } : a)));
  const agregar = () => setEdit([...areas, { id: 'ar' + Math.random().toString(36).slice(2, 7), nombre: 'Nueva área', personas: [] }]);
  const quitar = (aid) => setEdit(areas.filter((a) => a.id !== aid));
  const guardar = () => {
    if (areas.some((a) => !a.nombre.trim())) return toast('Ponle nombre a cada área');
    guardarAreas(areas.map((a) => ({ ...a, nombre: a.nombre.trim() })), yo); setEdit(null); toast('Organigrama guardado');
  };

  const Tarjeta = ({ a, top }) => {
    const gente = (a.personas || []).map((id) => db.personas.find((p) => p.id === id)).filter(Boolean);
    const aqui = a === miArea;
    return html`<section class=${'og-area' + (top ? ' raiz' : '') + (aqui ? ' aqui' : '')}>
      ${aqui && html`<span class="og-aqui">Tú estás aquí</span>`}
      ${edit ? html`<input class="control og-nombre-in" value=${a.nombre} aria-label="Nombre del área" onInput=${(e) => renombrar(a.id, e.target.value)} />`
        : html`<h3>${a.nombre}<span class="num">${gente.length}</span></h3>`}
      ${gente.length === 0 ? html`<p class="og-vacia">Sin personas aún</p>` : html`<ul>${gente.map((p) => html`<li key=${p.id} class=${p.id === yo ? 'yo' : ''}>
        <${Avatar} p=${p} grande /><span><b>${p.id === yo ? `${p.corto} (tú)` : p.corto}</b><small>${p.puesto || ''}</small></span>
        ${edit && html`<select class="control chico" aria-label=${`Área de ${p.corto}`} value=${a.id} onChange=${(e) => mover(p.id, e.target.value)}>${areas.map((x) => html`<option key=${x.id} value=${x.id}>${x.nombre}</option>`)}</select>`}
      </li>`)}</ul>`}
      ${edit && !top && !gente.length && html`<button class="enlace og-quitar" onClick=${() => quitar(a.id)}>Quitar área</button>`}
    </section>`;
  };

  return html`
    <div class="og-intro">
      <p>${miArea ? html`Así está organizado Spark. Tú estás en <b>${miArea.nombre}</b>.` : 'Así está organizado Spark.'}</p>
      ${admin && (edit
        ? html`<span class="og-acc"><button class="btn" onClick=${agregar}>${I('mas')}Área</button><button class="btn fantasma" onClick=${() => setEdit(null)}>Cancelar</button><button class="btn prim" onClick=${guardar}>Guardar</button></span>`
        : html`<button class="btn" onClick=${() => setEdit(areas.map((a) => ({ ...a, personas: [...(a.personas || [])] })))}>${I('ajustes')}Editar organigrama</button>`)}
    </div>
    ${propuesta && !edit && html`<p class="og-nota">${I('alerta')}Es una propuesta armada con el puesto de cada quien. ${admin ? 'Ajústala con «Editar organigrama» y guárdala.' : 'Dirección la va a confirmar.'}</p>`}
    <div class="organigrama">
      ${raiz && html`<${Tarjeta} a=${raiz} top />`}
      ${hijas.length > 0 && html`<div class="og-hijas" style=${`--n:${hijas.length}`}>${hijas.map((a) => html`<${Tarjeta} key=${a.id} a=${a} />`)}</div>`}
    </div>
    ${sinArea.length > 0 && html`<section class="og-sin">
      <h3>Sin área asignada</h3>
      <ul>${sinArea.map((p) => html`<li key=${p.id}><${Avatar} p=${p} /><span>${p.corto}</span>
        ${edit && html`<select class="control chico" value="" aria-label=${`Área de ${p.corto}`} onChange=${(e) => mover(p.id, e.target.value)}><option value="">Elegir área</option>${areas.map((x) => html`<option key=${x.id} value=${x.id}>${x.nombre}</option>`)}</select>`}</li>`)}</ul>
    </section>`}`;
}

// ---------- Documentos ----------
function Documentos({ ctx }) {
  const { db, yo, toast } = ctx;
  const admin = esAdmin(yo);
  const [form, setForm] = useState(null);
  const docs = (db.documentos || []).filter((d) => !d.soloDireccion || admin);
  const guardar = () => {
    if (!form.titulo?.trim()) return toast('Ponle título');
    if (!/^https?:\/\//i.test(form.url || '')) return toast('Pega el enlace de Drive (https://…)');
    guardarDocumento({ ...form, titulo: form.titulo.trim() }, yo); setForm(null); toast('Documento guardado');
  };
  return html`
    <p class="og-intro"><span>Todo lo de la compañía en un solo lugar. Cada documento abre su archivo en Drive.</span></p>
    <div class="docs-rejilla">${CATEGORIAS_DOCS.filter((c) => !c.soloDireccion || admin).map((cat) => {
      const lista = docs.filter((d) => d.categoria === cat.id);
      const abierto = form?.categoria === cat.id;
      return html`<section key=${cat.id} class="doc-cat">
        <h3>${I(cat.soloDireccion ? 'candado' : 'documento')}${cat.nombre}<span class="num">${lista.length}</span></h3>
        <p class="tb-sub">${cat.ayuda}</p>
        ${lista.length === 0 && !abierto && html`<p class="og-vacia">Aún no hay documentos.</p>`}
        <ul class="doc-lista">${lista.map((d) => {
          const quien = db.personas.find((p) => p.id === d.subidoPor);
          return html`<li key=${d.id}><a href=${d.url} target="_blank" rel="noopener">${I('drive')}<span><b>${d.titulo}</b><small>${quien ? quien.corto + ' · ' : ''}${haceCuanto(d.actualizado)}</small></span></a>
            ${admin && html`<button class="quitar" style="opacity:1" aria-label=${`Quitar ${d.titulo}`} onClick=${() => { quitarDocumento(d.id, yo); toast('Documento quitado'); }}>${I('x')}</button>`}</li>`;
        })}</ul>
        ${abierto ? html`<div class="doc-form">
          <input class="control" placeholder="Título, ej. Política de viajes" value=${form.titulo || ''} onInput=${(e) => setForm({ ...form, titulo: e.target.value })} />
          <input class="control" type="url" placeholder="Enlace de Drive" value=${form.url || ''} onInput=${(e) => setForm({ ...form, url: e.target.value.trim() })} />
          <label class="ls-hechas"><input type="checkbox" checked=${!!form.soloDireccion} onChange=${() => setForm({ ...form, soloDireccion: !form.soloDireccion })} />Solo lo ve Dirección</label>
          <span class="og-acc"><button class="btn fantasma" onClick=${() => setForm(null)}>Cancelar</button><button class="btn prim" onClick=${guardar}>Guardar</button></span>
        </div>` : admin && html`<button class="enlace" onClick=${() => setForm({ categoria: cat.id, soloDireccion: !!cat.soloDireccion })}>${I('mas')}Agregar documento</button>`}
      </section>`;
    })}</div>`;
}
