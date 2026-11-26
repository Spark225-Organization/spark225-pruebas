// Ayuda de Spark225: un asistente propio (sin IA externa) preparado con las preguntas del equipo.
// Entiende la pregunta aunque venga con errores de dedazo, responde como alguien de Spark225,
// te lleva a la página, te enseña con una animación cómo se hace y te da un recorrido guiado en la pantalla real.
// También contesta con datos del Portal («¿qué tengo vencido?», «¿cómo va» y el nombre de un cliente) usando solo lo que tú ya puedes ver.
import { html, useState, useEffect, useLayoutEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { hoyISO, sumarDias } from './datos.js?v=202611270810';
import { vigentes, visiblePara, estatusVisible, saludProyecto, cumplimiento, areasVigentes } from './store.js?v=202611270810';
import { I, fechaRelativa } from './ui.js?v=202611270810';
import { TEMAS, CATEGORIAS, ESCENAS, RECORRIDOS, SUGERENCIAS, PAGINAS, SINONIMOS } from './ayuda-datos.js?v=202611270810';

// ---------- Texto: normalizar, quitar palabras vacías y comparar con tolerancia a errores ----------
const VACIAS = new Set(('a al ante algo alguna alguien como con cual cuales cuando de del donde el ella en era es esa ese eso esta este esto estoy fue hay la las le les lo los me mi mis muy necesito no nos o oye para pero por porque puedo puede pueden que quiero quisiera se ser si sin sobre su sus te tengo tu tus un una uno unos unas y ya yo hola buenas buenos dias tardes favor ayuda ayudame dime explica explicame saber hacer hago hace hacemos podria poder seria tiene tienen hacerlo esto eso aqui alla bien mas menos cosa cosas tal vez igual entonces pues osea ok gracias')
  .split(' '));
export const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const raiz = (w) => (w.length > 5 ? w.slice(0, 5) : w);
function palabras(t) {
  return norm(t).split(' ').filter((w) => w && !VACIAS.has(w) && !/^\d+$/.test(w)).map((w) => SINONIMOS[w] || w).flatMap((w) => w.split(' ')).map(raiz);
}
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Índice de temas: palabras de su título, sus claves y sus preguntas de ejemplo, con peso por rareza.
let INDICE = null;
function indice() {
  if (INDICE) return INDICE;
  const docs = TEMAS.map((t) => ({ t, w: new Set(palabras(`${t.titulo} ${t.claves || ''} ${(t.frases || []).join(' ')}`)), frases: (t.frases || []).map(norm) }));
  const df = {};
  docs.forEach((d) => d.w.forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  const vocab = Object.keys(df);
  INDICE = { docs, idf: (w) => Math.log(1 + TEMAS.length / (df[w] || 1)), vocab };
  return INDICE;
}
function corregir(w, vocab) {
  if (w.length < 4) return null;
  let mejor = null, md = 9;
  for (const v of vocab) { if (v[0] !== w[0] && v[1] !== w[1]) continue; const dd = distancia(w, v); if (dd < md) { md = dd; mejor = v; } }
  return md <= (w.length >= 7 ? 2 : 1) ? mejor : null;
}
export function buscarTemas(pregunta, max = 3) {
  const { docs, idf, vocab } = indice();
  let q = palabras(pregunta);
  q = q.map((w) => (docs.some((d) => d.w.has(w)) ? w : corregir(w, vocab) || w));
  if (!q.length) return [];
  const nq = norm(pregunta);
  return docs.map((d) => {
    let s = 0;
    q.forEach((w) => { if (d.w.has(w)) s += idf(w); });
    if (d.frases.some((f) => f === nq || (nq.length > 8 && f.includes(nq)))) s += 6;
    return { t: d.t, s: s / Math.sqrt(q.length + 1) };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, max);
}

// ---------- Respuestas con datos del Portal ----------
const fmtDia = (iso) => fechaRelativa(iso);
function entidades(ctx, nq) {
  const { db } = ctx;
  const palabrasQ = new Set(nq.split(' '));
  const cli = db.clientes.find((c) => { const n = norm(c.nombre); return n && (nq.includes(n) || n.split(' ').filter((w) => w.length > 3).some((w) => palabrasQ.has(w))); });
  const proy = db.proyectos.filter((p) => !p.id.startsWith('g-')).map((p) => { const ws = norm(p.nombre).split(' ').filter((w) => w.length > 3 && !/^spark/.test(w)); /* «Spark225» va en muchos nombres: no distingue */ const hit = ws.filter((w) => palabrasQ.has(w)).length; return { p, hit, ratio: ws.length ? hit / ws.length : 0 }; })
    .filter((x) => x.hit >= 2 || (x.hit >= 1 && x.ratio >= 0.5)).sort((a, b) => b.hit - a.hit || b.ratio - a.ratio)[0]?.p;
  const per = db.personas.find((p) => [p.corto, (p.nombre || '').split(' ')[0]].map(norm).some((n) => n && n.length > 2 && palabrasQ.has(n)));
  return { cli, proy, per };
}
function listaTareas(ctx, l, max = 6) {
  return l.slice(0, max).map((a) => ({ t: a.titulo, s: `${ctx.db.clientes.find((c) => c.id === a.cliente)?.nombre || ''}${a.sinFecha ? ' · sin fecha' : ` · ${fmtDia(a.fecha)}`}`, accion: () => ctx.abrir(a.id) }));
}
function respuestaDatos(ctx, pregunta) {
  const nq = norm(pregunta);
  const { db, yo } = ctx;
  const hoy = hoyISO();
  const mias = vigentes().filter((a) => (a.responsable === yo || (a.colaboradores || []).includes(yo)) && a.estatus !== 'hecho');
  const yoNombre = db.personas.find((p) => p.id === yo)?.corto || '';
  const es = (re) => re.test(nq);
  const { cli: cli0, proy, per } = entidades(ctx, nq);
  const cli = cli0 && cli0.id === 'interno' ? null : cli0; // «Spark225» es la empresa, no un cliente
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|oye)\b/.test(nq) && nq.split(' ').length <= 4) return { texto: `¡Hola${yoNombre ? ', ' + yoNombre : ''}! ¿En qué te ayudo? Pregúntame cómo hacer algo, pídeme que te lleve a una página o pregúntame por tus tareas.`, relacionadas: ['crear-tarea', 'armar-reporte', 'recorrido'] };
  if (/^(gracias|muchas gracias|mil gracias|ok|okey|va|listo|perfecto|genial|excelente)\b/.test(nq) && nq.split(' ').length <= 4) return { texto: 'Con gusto. Aquí sigo si necesitas algo más.' };
  // Navegación directa: «llévame a reportes», «abre master proyectos»
  const nav = nq.match(/^(?:llevame a|llevame al|ir a|ir al|vamos a|abre|abrir|abreme|muestrame|ensename la pagina de|quiero ver)\s+(.+)$/);
  if (nav) {
    const p = paginaDe(nav[1]) || (cli && { ruta: '#/cliente/' + cli.id, nombre: cli.nombre }) || (proy && { ruta: '#/proyecto/' + proy.id, nombre: proy.nombre });
    if (p) { const a = p.nombre.startsWith('el ') ? 'al ' + p.nombre.slice(3) : 'a ' + p.nombre; return { texto: `Va, te llevo ${a}.`, navegar: p.ruta, botones: [{ t: `Abrir ${p.nombre.replace(/^(el|la|tu) /, '')}`, ir: p.ruta }] }; }
  }
  if (es(/\b(vencid|atrasad|tarde|retrasad)/) && !es(/como (se|calcula|funciona)|regla|que significa/) && !per && !cli) {
    const v = mias.filter((a) => !a.sinFecha && a.fecha < hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return v.length
      ? { texto: `${yoNombre ? yoNombre + ', tienes' : 'Tienes'} ${v.length} ${v.length === 1 ? 'tarea vencida' : 'tareas vencidas'}. La más atrasada es «${v[0].titulo}» (${fmtDia(v[0].fecha)}). Toca una para abrirla y moverle la fecha o cerrarla.`, items: listaTareas(ctx, v), botones: [{ t: 'Ver solo mis vencidas', ir: '#/', antes: () => ctx.verVencidas?.() }], relacionadas: ['mover-tarea', 'regla-entrega'] }
      : { texto: 'No tienes tareas vencidas. Vas al día.', relacionadas: ['tareas-hoy'] };
  }
  if (es(/(que|cuales|cuantas|mis).*\b(hoy|para hoy|toca hoy)\b|\bhoy\b.*(tengo|toca|pendiente)/) && !per && !cli) {
    const h = mias.filter((a) => !a.sinFecha && a.fecha === hoy);
    return h.length ? { texto: `Hoy te tocan ${h.length} ${h.length === 1 ? 'tarea' : 'tareas'}:`, items: listaTareas(ctx, h, 8), botones: [{ t: 'Ver mi día', ir: '#/' }] } : { texto: 'Para hoy no tienes tareas con fecha. Revisa «Próximos 7 días» en tu Inicio.', botones: [{ t: 'Ir al Inicio', ir: '#/' }] };
  }
  if (es(/(en revision|por revisar|esperando revision)/) && !es(/como|que significa/)) {
    const r = vigentes().filter((a) => estatusVisible(a) === 'esperando' && visiblePara(a, yo));
    return { texto: r.length ? `Hay ${r.length} ${r.length === 1 ? 'tarea' : 'tareas'} en revisión:` : 'No hay tareas en revisión ahora.', items: listaTareas(ctx, r, 8) };
  }
  if (es(/(decision|decisiones|escalar|pendiente de carlos|para carlos)/) && !es(/como (escalo|se escala|marco)/)) {
    const d = (db.riesgos || []).filter((r) => r.escalar && r.estado !== 'resuelto');
    return { texto: d.length ? `${d.length} ${d.length === 1 ? 'tema espera' : 'temas esperan'} decisión de Carlos:` : 'No hay decisiones pendientes para Carlos.', items: d.slice(0, 6).map((r) => ({ t: r.titulo, s: r.fechaLimite ? `límite ${fmtDia(r.fechaLimite)}` : '', ir: '#/riesgos' })), botones: [{ t: 'Abrir Master Riesgos y Decisiones', ir: '#/riesgos' }] };
  }
  if (es(/\b(hitos?|entregables?)\b/) && es(/(proxim|siguient|semana|vienen|cerca|pendiente)/)) {
    const hs = (db.hitos || []).filter((h) => h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna <= sumarDias(hoy, 14)).sort((a, b) => a.fechaInterna.localeCompare(b.fechaInterna));
    return { texto: hs.length ? `En las próximas dos semanas vencen ${hs.length} ${hs.length === 1 ? 'hito' : 'hitos'} (fecha interna):` : 'No hay hitos con fecha interna en las próximas dos semanas.', items: hs.slice(0, 6).map((h) => ({ t: h.nombre, s: `${db.proyectos.find((p) => p.id === h.proyecto)?.nombre || ''} · ${fmtDia(h.fechaInterna)}`, ir: h.proyecto ? '#/proyecto/' + h.proyecto : '#/hitos' })), botones: [{ t: 'Abrir Master Milestones', ir: '#/hitos' }] };
  }
  const preguntaEstado = es(/(como va|como van|como esta|como estan|como vamos|estatus|status|salud|avance|que tal va)/);
  if (preguntaEstado && proy) {
    const s = saludProyecto(proy, hoy);
    const resp = db.personas.find((p) => p.id === proy.responsable);
    return { texto: `«${proy.nombre}» está ${{ en_riesgo: 'en riesgo', atencion: 'en atención', en_control: 'en control', sin_evaluar: 'sin evaluar', programa: 'como programa (su salud es la de sus unidades)' }[s.salud]}. ${s.razones[0] ? s.razones[0] + '. ' : ''}Tiene ${s.vivas} ${s.vivas === 1 ? 'tarea viva' : 'tareas vivas'}${s.vencidas ? ` y ${s.vencidas} vencidas` : ''}.${proy.proximoHito ? ` Próximo hito: ${proy.proximoHito}${proy.fechaProximoHito ? ` (${fmtDia(proy.fechaProximoHito)})` : ''}.` : ''}${resp ? ` Lo lleva ${resp.corto}.` : ''}`, botones: [{ t: 'Abrir el proyecto', ir: '#/proyecto/' + proy.id }] };
  }
  if (preguntaEstado && cli) {
    const cu = cumplimiento((a) => a.cliente === cli.id, hoy);
    const abiertas = vigentes().filter((a) => a.cliente === cli.id && a.estatus !== 'hecho');
    const ps = db.proyectos.filter((p) => p.cliente === cli.id && !p.id.startsWith('g-') && p.fase !== 'terminado').map((p) => saludProyecto(p, hoy).salud);
    return { texto: `${cli.nombre}: ${cu.pct === null ? 'sin tareas que medir en los últimos 30 días' : `${cu.pct} % de entregas a tiempo en los últimos 30 días (${{ bien: 'va bien', atencion: 'en atención', riesgo: 'en riesgo' }[cu.salud]})`}. Tiene ${abiertas.length} ${abiertas.length === 1 ? 'tarea abierta' : 'tareas abiertas'} y ${ps.length} ${ps.length === 1 ? 'proyecto vigente' : 'proyectos vigentes'}${ps.filter((x) => x === 'en_riesgo').length ? `, ${ps.filter((x) => x === 'en_riesgo').length} en riesgo` : ''}.`, botones: [{ t: `Abrir ${cli.nombre}`, ir: '#/cliente/' + cli.id }] };
  }
  if (preguntaEstado && es(/(spark|empresa|agencia|equipo|vamos)/)) {
    const cu = cumplimiento(() => true, hoy);
    return { texto: `Spark225 lleva ${cu.pct ?? '—'} % de entregas a tiempo en los últimos 30 días (ponderado por prioridad; la meta es 95 %). ${cu.tarde.length} ${cu.tarde.length === 1 ? 'entrega llegó' : 'entregas llegaron'} tarde o siguen pendientes.`, botones: [{ t: 'Ver «Cómo va Spark225»', ir: '#/tablero/entregas' }] };
  }
  if (per && es(/(cuantas|que tareas|que tiene|pendientes de|carga|trabajo de|que le toca)/)) {
    const l = vigentes().filter((a) => a.responsable === per.id && a.estatus !== 'hecho' && visiblePara(a, yo)).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const nv = l.filter((a) => !a.sinFecha && a.fecha < hoy).length;
    return { texto: `${per.corto} tiene ${l.length} ${l.length === 1 ? 'tarea abierta' : 'tareas abiertas'}${nv ? `, ${nv} ${nv === 1 ? 'vencida' : 'vencidas'}` : ''}.`, items: listaTareas(ctx, l), botones: [{ t: `Ver el día de ${per.corto}`, ir: '#/persona/' + per.id }] };
  }
  if (proy && es(/(quien|responsable|lleva|encargado)/)) {
    const resp = db.personas.find((p) => p.id === proy.responsable);
    return { texto: resp ? `«${proy.nombre}» lo lleva ${resp.nombre || resp.corto}.` : `«${proy.nombre}» no tiene responsable (Project Owner) en Notion; por eso cuenta como «atención».`, botones: [{ t: 'Abrir el proyecto', ir: '#/proyecto/' + proy.id }] };
  }
  if (es(/(mi area|en que area|mi departamento|donde estoy en el organigrama)/)) {
    const a = areasVigentes().find((x) => (x.personas || []).includes(yo));
    return { texto: a ? `Estás en ${a.nombre}.` : 'Aún no estás asignado a un área en el organigrama.', botones: [{ t: 'Ver el organigrama', ir: '#/rh' }] };
  }
  return null;
}
function paginaDe(texto) {
  const n = norm(texto);
  return PAGINAS.find((p) => p.claves.some((k) => n.includes(k))) || null;
}

// Arma la respuesta completa: datos del Portal primero, luego la base de temas.
export function responder(ctx, pregunta) {
  const d = respuestaDatos(ctx, pregunta);
  if (d) return d;
  const r = buscarTemas(pregunta, 4);
  if (r.length && r[0].s >= 1.15) {
    const t = r[0].t;
    const otras = r.slice(1).filter((x) => x.s >= 0.9 && x.t.id !== t.id).map((x) => x.t.id);
    return { tema: t, relacionadas: [...new Set([...(t.ver || []), ...otras])].slice(0, 3) };
  }
  if (r.length) return { texto: 'Creo que preguntas por alguno de estos temas. Toca el que buscas:', relacionadas: r.map((x) => x.t.id).slice(0, 3), duda: true };
  return { texto: 'No tengo eso claro todavía. Prueba con otras palabras (por ejemplo, «cómo muevo una tarea» o «cómo armo un reporte») o mira todos los temas.', botones: [{ t: 'Ver todos los temas', temas: true }], duda: true };
}

// ---------- Estado de la conversación (sobrevive al cambiar de página) ----------
const charla = { abierta: false, mensajes: [], oyentes: new Set() };
const avisar = () => charla.oyentes.forEach((f) => f({ ...charla }));
export const abrirAyuda = (pregunta) => { charla.abierta = true; avisar(); if (pregunta) setTimeout(() => window.dispatchEvent(new CustomEvent('ayuda-preguntar', { detail: pregunta })), 50); };
function useCharla() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); charla.oyentes.add(f); return () => charla.oyentes.delete(f); }, []);
  return charla;
}
const idM = () => 'm' + Math.random().toString(36).slice(2, 8);

// ---------- Botón y panel ----------
export function Ayuda({ ctx, ruta }) {
  const c = useCharla();
  const [recorrido, setRecorrido] = useState(null);
  useEffect(() => {
    const k = (e) => {
      const t = e.target;
      const escribiendo = t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      if (e.key === '?' && !escribiendo && !e.metaKey && !e.ctrlKey) { e.preventDefault(); charla.abierta = !charla.abierta; avisar(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const iniciarRecorrido = (id) => { const r = RECORRIDOS[id]; if (!r) return; charla.abierta = false; avisar(); setRecorrido(r); };
  return html`
    ${!c.abierta && !recorrido && html`<button class="ayuda-btn" onClick=${() => { charla.abierta = true; avisar(); }} aria-label="Ayuda: pregúntame cómo hacer algo" title="Ayuda (tecla ?)">
      <span class="ayuda-btn-ico">${I('ayuda')}</span><span class="ayuda-btn-t">Ayuda</span></button>`}
    ${c.abierta && html`<${Panel} ctx=${ctx} ruta=${ruta} iniciarRecorrido=${iniciarRecorrido} />`}
    ${recorrido && html`<${RecorridoGuiado} r=${recorrido} terminar=${() => setRecorrido(null)} />`}`;
}

function Panel({ ctx, ruta, iniciarRecorrido }) {
  const c = charla;
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [verTemas, setVerTemas] = useState(false);
  const fin = useRef(), campo = useRef();
  const yoP = ctx.db.personas.find((p) => p.id === ctx.yo);
  const cerrar = () => { charla.abierta = false; avisar(); };
  useEffect(() => { campo.current?.focus(); const k = (e) => { if (e.key === 'Escape') cerrar(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [c.mensajes.length, pensando]);
  const preguntar = (q) => {
    const p = String(q || '').trim(); if (!p) return;
    setTexto(''); setVerTemas(false);
    c.mensajes = [...c.mensajes, { id: idM(), yo: true, texto: p }]; avisar();
    setPensando(true);
    setTimeout(() => {
      const r = responder(ctx, p);
      c.mensajes = [...c.mensajes, { id: idM(), r }]; avisar();
      setPensando(false);
      if (r.navegar) setTimeout(() => { location.hash = r.navegar; }, 400);
    }, 380 + Math.min(500, p.length * 12));
  };
  const abrirTema = (id) => {
    const t = TEMAS.find((x) => x.id === id); if (!t) return;
    c.mensajes = [...c.mensajes, { id: idM(), yo: true, texto: t.titulo }, { id: idM(), r: { tema: t, relacionadas: (t.ver || []).slice(0, 3) } }]; avisar();
    setVerTemas(false);
  };
  useEffect(() => { const f = (e) => preguntar(e.detail); addEventListener('ayuda-preguntar', f); return () => removeEventListener('ayuda-preguntar', f); }, []);
  const clave = Object.keys(SUGERENCIAS).filter((k) => k !== '*' && ruta.startsWith(k)).sort((a, b) => b.length - a.length)[0] || '*';
  const sugeridas = (SUGERENCIAS[clave] || SUGERENCIAS['*']).map((id) => TEMAS.find((t) => t.id === id)).filter(Boolean);
  const ir = (b) => { if (b.antes) b.antes(); if (b.ir) location.hash = b.ir; if (b.temas) setVerTemas(true); if (b.recorrido) iniciarRecorrido(b.recorrido); };

  return html`<aside class="ayuda-panel" role="dialog" aria-label="Ayuda de Spark225">
    <header class="ay-cab">
      <img src="./icons/iso.png" alt="" width="32" height="32" />
      <div><b>Ayuda de Spark225</b><small>Pregúntame lo que sea del Portal</small></div>
      <button class="icon-btn" onClick=${() => setVerTemas(!verTemas)} aria-label="Ver todos los temas" title="Todos los temas">${I('lista')}</button>
      <button class="icon-btn" onClick=${cerrar} aria-label="Cerrar la ayuda">${I('x')}</button>
    </header>
    <div class="ay-cuerpo" aria-live="polite">
      ${verTemas ? html`<${Temas} abrir=${abrirTema} />` : html`
        <div class="ay-msg bot"><div class="ay-burbuja">
          <p>Hola${yoP ? `, ${yoP.corto}` : ''}. Soy la ayuda del Portal. Pregúntame cómo hacer algo, pídeme que te lleve a una página o pregúntame por tus tareas, un cliente o un proyecto.</p>
          <div class="ay-chips">${sugeridas.map((t) => html`<button key=${t.id} onClick=${() => abrirTema(t.id)}>${t.titulo}</button>`)}</div>
          <div class="ay-acciones"><button class="btn chico" onClick=${() => iniciarRecorrido('general')}>${I('brujula')}Recorrido por el Portal</button>
            <button class="btn fantasma chico" onClick=${() => setVerTemas(true)}>${I('lista')}Todos los temas</button></div>
        </div></div>
        ${c.mensajes.map((m) => (m.yo
          ? html`<div key=${m.id} class="ay-msg yo"><div class="ay-burbuja">${m.texto}</div></div>`
          : html`<${Respuesta} key=${m.id} r=${m.r} ir=${ir} abrirTema=${abrirTema} iniciarRecorrido=${iniciarRecorrido} />`))}
        ${pensando && html`<div class="ay-msg bot"><div class="ay-burbuja ay-escribe" aria-label="Escribiendo"><i></i><i></i><i></i></div></div>`}`}
      <div ref=${fin}></div>
    </div>
    <form class="ay-pie" onSubmit=${(e) => { e.preventDefault(); preguntar(texto); }}>
      <input ref=${campo} class="control" value=${texto} onInput=${(e) => setTexto(e.target.value)} placeholder="Ej. ¿cómo armo un reporte de marketing?" aria-label="Escribe tu pregunta" />
      <button class="btn prim" type="submit" aria-label="Preguntar" disabled=${!texto.trim()}>${I('enviar')}</button>
    </form>
  </aside>`;
}

function Respuesta({ r, ir, abrirTema, iniciarRecorrido }) {
  const t = r.tema;
  const [demo, setDemo] = useState(false);
  const botones = [
    ...(t?.ir ? [{ t: t.ir.texto || 'Llévame ahí', ir: t.ir.ruta, ico: 'adelante' }] : []),
    ...(t?.demo && ESCENAS[t.demo] ? [{ t: demo ? 'Ocultar animación' : 'Ver cómo se hace', ico: 'externo', fn: () => setDemo(!demo) }] : []),
    ...(t?.recorrido && RECORRIDOS[t.recorrido] ? [{ t: 'Hazme el recorrido', ico: 'brujula', fn: () => iniciarRecorrido(t.recorrido) }] : []),
    ...(r.botones || []),
  ];
  return html`<div class="ay-msg bot"><div class="ay-burbuja">
    ${t && html`<b class="ay-tit">${t.titulo}</b>`}
    ${(t?.r || r.texto) && html`<p>${t?.r || r.texto}</p>`}
    ${t?.pasos?.length && html`<ol class="ay-pasos">${t.pasos.map((p, i) => html`<li key=${i}>${p}</li>`)}</ol>`}
    ${t?.ojo && html`<p class="ay-ojo">${I('alerta')}<span>${t.ojo}</span></p>`}
    ${r.items?.length > 0 && html`<ul class="ay-items">${r.items.map((x, i) => html`<li key=${i}><button onClick=${() => (x.accion ? x.accion() : x.ir && (location.hash = x.ir))}><span>${x.t}</span>${x.s && html`<small>${x.s}</small>`}</button></li>`)}</ul>`}
    ${demo && t?.demo && html`<${Animacion} escena=${ESCENAS[t.demo]} />`}
    ${botones.length > 0 && html`<div class="ay-acciones">${botones.map((b, i) => html`<button key=${i} class=${'btn chico' + (i === 0 ? ' prim' : '')} onClick=${() => (b.fn ? b.fn() : ir(b))}>${b.ico ? I(b.ico) : null}${b.t}</button>`)}</div>`}
    ${r.relacionadas?.length > 0 && html`<div class="ay-rel"><small>${r.duda ? '' : 'También te puede servir'}</small><div class="ay-chips">${r.relacionadas.map((id) => TEMAS.find((x) => x.id === id)).filter(Boolean).map((x) => html`<button key=${x.id} onClick=${() => abrirTema(x.id)}>${x.titulo}</button>`)}</div></div>`}
  </div></div>`;
}

function Temas({ abrir }) {
  return html`<div class="ay-temas">${CATEGORIAS.map((cat) => html`<section key=${cat}><h3>${cat}</h3>
    <div class="ay-chips">${TEMAS.filter((t) => t.cat === cat).map((t) => html`<button key=${t.id} onClick=${() => abrir(t.id)}>${t.titulo}</button>`)}</div></section>`)}</div>`;
}

// ---------- Animaciones: una escena esquemática con cursor que muestra cómo se hace ----------
// escena = { alto, elementos: [{ id, x, y, w, h, t, tipo, oculto }], pasos: [{ a, accion, hasta, mostrar, ocultar, marcar, escribir: { id, texto }, cap }] }
export function Animacion({ escena }) {
  const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(quieto);
  const n = escena.pasos.length;
  useEffect(() => {
    if (pausa) return undefined;
    const t = setTimeout(() => setI((x) => (x + 1) % (n + 1)), i === n ? 1600 : 2000);
    return () => clearTimeout(t);
  }, [i, pausa]);
  const paso = escena.pasos[Math.min(i, n - 1)];
  // Estado acumulado de la escena hasta el paso actual
  const visibles = new Set(escena.elementos.filter((e) => !e.oculto).map((e) => e.id));
  const textos = {}, posiciones = {};
  escena.pasos.slice(0, Math.min(i, n - 1) + 1).forEach((p) => {
    (p.mostrar || []).forEach((id) => visibles.add(id));
    (p.ocultar || []).forEach((id) => visibles.delete(id));
    [].concat(p.escribir || []).forEach((w) => { textos[w.id] = w.texto; });
    if (p.accion === 'arrastrar' && p.hasta) { const dest = escena.elementos.find((e) => e.id === p.hasta); if (dest) posiciones[p.a] = { x: dest.x + 2, y: dest.y + (dest.h > 30 ? 12 : 0) }; }
  });
  const el = (id) => escena.elementos.find((e) => e.id === id);
  const destino = paso && (paso.accion === 'arrastrar' && paso.hasta ? el(paso.hasta) : el(paso.a));
  const cursor = destino ? { x: destino.x + destino.w / 2, y: destino.y + Math.min(destino.h / 2, 12) } : { x: 92, y: 92 };
  return html`<figure class="ay-anim">
    <div class="ay-esc" style=${`height:${escena.alto || 170}px`} aria-hidden="true">
      ${escena.elementos.map((e) => visibles.has(e.id) && html`<div key=${e.id} class=${`ae ae-${e.tipo || 'caja'}${paso && paso.marcar === e.id ? ' marca' : ''}${paso && paso.a === e.id && paso.accion === 'clic' ? ' clic' : ''}`}
        style=${`left:${(posiciones[e.id] || e).x}%;top:${(posiciones[e.id] || e).y}%;width:${e.w}%;height:${e.h}%;${e.color ? `--c:${e.color}` : ''}`}>${textos[e.id] ?? e.t}</div>`)}
      <span class=${'ae-cursor' + (paso?.accion === 'clic' ? ' toca' : '')} style=${`left:${cursor.x}%;top:${cursor.y}%`}></span>
    </div>
    <figcaption><span class="num">${Math.min(i + 1, n)}/${n}</span><span>${paso?.cap || ''}</span>
      <button class="icon-btn chico" onClick=${() => setPausa(!pausa)} aria-label=${pausa ? 'Reproducir' : 'Pausar'}>${I(pausa ? 'adelante' : 'pausa')}</button>
      <button class="icon-btn chico" onClick=${() => setI(Math.max(0, i - 1))} aria-label="Paso anterior">${I('flecha')}</button>
      <button class="icon-btn chico" onClick=${() => setI((x) => Math.min(n - 1, x + 1))} aria-label="Paso siguiente">${I('adelante')}</button></figcaption>
  </figure>`;
}

// ---------- Recorrido guiado en la pantalla real ----------
// r = { titulo, pasos: [{ ruta, sel, t, d, demo }] }: va a la página, resalta el elemento y explica.
function RecorridoGuiado({ r, terminar }) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState(null);
  const paso = r.pasos[i];
  useLayoutEffect(() => {
    let vivo = true, intentos = 0;
    if (paso.ruta && location.hash !== paso.ruta && !(paso.ruta === '#/' && location.hash === '')) location.hash = paso.ruta;
    const medir = () => {
      if (!vivo) return;
      const el = paso.sel && document.querySelector(paso.sel);
      if (!el) { if (intentos++ < 20) setTimeout(medir, 100); else setCaja(null); return; }
      if (!el.closest('.top, .dock')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      requestAnimationFrame(() => { const b = el.getBoundingClientRect(); setCaja({ x: b.left - 6, y: Math.max(6, b.top - 6), w: b.width + 12, h: Math.min(b.height + 12, innerHeight - 24) }); });
    };
    setCaja(null); setTimeout(medir, 120);
    addEventListener('resize', medir);
    return () => { vivo = false; removeEventListener('resize', medir); };
  }, [i]);
  const actual = useRef(0); actual.current = i;
  const sig = () => { if (actual.current < r.pasos.length - 1) { actual.current += 1; setI(actual.current); } else terminar(); };
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') terminar(); if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); sig(); } if (e.key === 'ArrowLeft') { actual.current = Math.max(0, actual.current - 1); setI(actual.current); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const ALTO = paso.demo ? 380 : 220, ANCHO = Math.min(340, innerWidth - 24);
  let g;
  if (!caja) g = { left: innerWidth / 2 - ANCHO / 2, top: innerHeight / 2 - ALTO / 2 };
  else if (caja.y + caja.h + ALTO + 12 < innerHeight) g = { left: caja.x, top: caja.y + caja.h + 12 };
  else if (caja.y - ALTO - 12 > 0) g = { left: caja.x, top: caja.y - ALTO - 12 };
  else g = { left: caja.x + caja.w + 16 + ANCHO < innerWidth ? caja.x + caja.w + 16 : caja.x - ANCHO - 16, top: innerHeight / 2 - ALTO / 2 };
  g.left = Math.max(12, Math.min(g.left, innerWidth - ANCHO - 12));
  g.top = Math.max(12, Math.min(g.top, innerHeight - ALTO - 12));
  return html`
    <div class="tour-capa" onClick=${sig}></div>
    ${caja && html`<div class="tour-hueco" style=${`left:${caja.x}px;top:${caja.y}px;width:${caja.w}px;height:${caja.h}px`}></div>`}
    <div class="tour-globo ay-globo" style=${`left:${g.left}px;top:${g.top}px;width:${ANCHO}px`} role="dialog" aria-live="polite" aria-label=${r.titulo}>
      <small class="ay-g-rec">${r.titulo}</small>
      ${paso.demo && ESCENAS[paso.demo] && html`<${Animacion} key=${paso.demo} escena=${ESCENAS[paso.demo]} />`}
      <div class="tg-cab"><b>${paso.t}</b><span class="num">${i + 1}/${r.pasos.length}</span></div>
      <p>${paso.d}</p>
      <div class="tg-pie">
        <button class="btn fantasma chico" onClick=${terminar}>Salir</button>
        <div class="tg-puntos">${r.pasos.map((_, k) => html`<i key=${k} class=${k === i ? 'on' : ''}></i>`)}</div>
        <span class="tg-nav">
          ${i > 0 && html`<button class="icon-btn chico" onClick=${() => setI(i - 1)} aria-label="Anterior">${I('flecha')}</button>`}
          <button class="btn prim chico" onClick=${sig}>${i < r.pasos.length - 1 ? 'Siguiente' : 'Listo'}</button>
        </span>
      </div>
    </div>`;
}
