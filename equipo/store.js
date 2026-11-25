// Capa de datos. En la fase 1 todo vive en el navegador (localStorage) con datos ficticios.
// Cuando haya acceso a Supabase, se reemplaza este archivo por llamadas a tablas con RLS
// manteniendo las mismas funciones públicas.
import { semilla, hoyISO, sumarDias, sumarDiasHabiles, ESTATUS, LAYOUT_INICIAL, VERSION_DATOS, fichaCliente, minutasEjemplo } from './datos.js?v=202611251031';

const CLAVE = 'ssam-equipo-datos';
const CLAVE_V4 = 'ssam-equipo-v4';
const DIA_MS = 86400000;
let estado = cargar();
const oyentes = new Set();
export let errorGuardado = false;

// Carga a prueba de fallos: lee, migra versiones viejas y repara lo que venga roto.
// Si nada sirve, arranca con los datos de ejemplo. Nunca deja la app en blanco.
function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE) || localStorage.getItem(CLAVE_V4);
    if (crudo) {
      const e = JSON.parse(crudo);
      if (e && (e.version === 4 || e.version === VERSION_DATOS)) return purgar(reparar(migrar(e)));
    }
  } catch (_) { /* datos ilegibles o sin almacenamiento: se usa la semilla */ }
  return semilla();
}
// v4 → v5: clientes con estado y satisfacción, proyectos con responsable, minutas; adiós a los flujos.
function migrar(e) {
  if (e.version === 4) {
    e.clientes = (e.clientes || []).map((c) => ({ ...fichaCliente(c.id), ...c }));
    e.proyectos = (e.proyectos || []).map((p) => ({ responsable: 'adan', entrega: null, ...p }));
    const H = hoyISO();
    e.minutas = minutasEjemplo(H, (d) => new Date(Date.now() - d * DIA_MS).toISOString());
    delete e.flujos;
    e.version = VERSION_DATOS;
  }
  return e;
}
// Repara datos incompletos: listas que falten, actividades sin título o con cliente inexistente.
function reparar(e) {
  const base = semilla();
  ['personas', 'clientes', 'proyectos', 'actividades', 'avisos', 'correos', 'minutas', 'eventos'].forEach((k) => { if (!Array.isArray(e[k])) e[k] = base[k]; });
  ['personal', 'layouts', 'prefs'].forEach((k) => { if (!e[k] || typeof e[k] !== 'object') e[k] = {}; });
  if (!e.chat || !Array.isArray(e.chat.mensajes)) e.chat = base.chat;
  if (!e.personas.length) e.personas = base.personas;
  if (!e.papeleraDias) e.papeleraDias = 30;
  const clientes = new Set(e.clientes.map((c) => c.id));
  const personas = new Set(e.personas.map((p) => p.id));
  e.actividades = e.actividades.filter((a) => a && a.id && typeof a.titulo === 'string').map((a) => ({
    colaboradores: [], checklist: [], enlaces: [], notas: '', historial: [], repeticion: { tipo: 'no', cada: 7 }, esfuerzo: 'S', estatus: 'pendiente', ...a,
    cliente: clientes.has(a.cliente) ? a.cliente : 'interno',
    responsable: personas.has(a.responsable) ? a.responsable : e.personas[0].id,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(a.fecha || '') ? a.fecha : hoyISO(),
  }));
  e.clientes.forEach((c) => { if (!Array.isArray(c.satisfaccion)) c.satisfaccion = []; if (!c.salud) c.salud = 'bien'; });
  e.minutas.forEach((m) => { if (!Array.isArray(m.acuerdos)) m.acuerdos = []; });
  return e;
}
function purgar(e) {
  const limite = Date.now() - e.papeleraDias * DIA_MS;
  e.actividades = e.actividades.filter((a) => !a.archivada || new Date(a.archivada).getTime() > limite);
  return e;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); errorGuardado = false; } catch (_) { errorGuardado = true; }
  oyentes.forEach((f) => f(estado));
}
// Si la app está abierta en dos pestañas, ambas ven lo mismo y no se pisan.
try {
  addEventListener('storage', (ev) => {
    if (ev.key !== CLAVE || !ev.newValue) return;
    try { estado = purgar(reparar(migrar(JSON.parse(ev.newValue)))); oyentes.forEach((f) => f(estado)); } catch (_) { /* se ignora un valor roto */ }
  });
} catch (_) { /* sin ventana */ }

export const store = {
  get: () => estado,
  suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); },
  restablecer() { estado = semilla(); guardar(); },
  // Respaldo: descarga todo en un archivo y lo restaura validándolo antes.
  exportar() { return JSON.stringify(estado, null, 1); },
  importar(texto) {
    let e;
    try { e = JSON.parse(texto); } catch (_) { return { ok: false, motivo: 'El archivo no es un respaldo válido.' }; }
    if (!e || !(e.version === 4 || e.version === VERSION_DATOS) || !Array.isArray(e.actividades)) return { ok: false, motivo: 'El archivo no es un respaldo del SSAM.' };
    estado = purgar(reparar(migrar(e))); guardar();
    return { ok: true, n: estado.actividades.length };
  },
};

const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const ahora = () => new Date().toISOString();
const nombreEstatus = (id) => ESTATUS.find((s) => s.id === id)?.nombre || id;
const persona = (id) => estado.personas.find((p) => p.id === id);
const act = (id) => estado.actividades.find((a) => a.id === id);
function log(a, quien, que, motivo) { a.historial = [...(a.historial || []), { cuando: ahora(), quien, que, ...(motivo ? { motivo } : {}) }]; }
function avisar(para, texto, actividad, tipo) {
  if (!para) return;
  estado.avisos = [{ id: uid('n'), para, cuando: ahora(), leido: false, tipo, texto, actividad }, ...estado.avisos].slice(0, 60);
}

// ---------- Consultas ----------
export function esAdmin(uId) { const p = persona(uId); return p && (p.permiso === 'admin' || p.permiso === 'dueno'); }
export function participa(a, uId) { return a.responsable === uId || a.colaboradores.includes(uId); }
export function dependenciaAbierta(a) {
  if (!a.dependeDe) return null;
  const d = act(a.dependeDe);
  return d && !d.archivada && d.estatus !== 'hecho' ? d : null;
}
export function estatusVisible(a) {
  if (a.estatus !== 'hecho' && dependenciaAbierta(a)) return 'bloqueado';
  return a.estatus;
}
export function vigentes() { return estado.actividades.filter((a) => !a.archivada); }

// ---------- Validación ----------
export function validar(a) {
  const e = {};
  if (!a.titulo || !a.titulo.trim()) e.titulo = 'Escribe un título.';
  if (!a.responsable) e.responsable = 'Elige quién la hace.';
  if (!a.fecha) e.fecha = 'Pon la fecha límite.';
  if (!a.cliente) e.cliente = 'Elige un cliente o «Interno Spark».';
  if (!a.proyecto) e.proyecto = 'Elige un proyecto.';
  if (!a.esfuerzo) e.esfuerzo = 'Elige el tamaño.';
  if (a.bloque && !a.bloque.inicio) e.bloque = 'Pon la hora de inicio o quita el bloque.';
  if (a.repeticion?.tipo === 'cada_n' && !(a.repeticion.cada >= 1)) e.repeticion = 'Indica cada cuántos días.';
  if (a.dependeDe && a.dependeDe === a.id) e.dependeDe = 'No puede depender de sí misma.';
  return e;
}

// ---------- Acciones ----------
export function nuevaVacia(uId, extra = {}) {
  return {
    id: null, titulo: '', estatus: 'pendiente', responsable: uId, colaboradores: [], cliente: null, proyecto: null,
    fecha: hoyISO(), esfuerzo: null, bloque: null, repeticion: { tipo: 'no', cada: 7 }, dependeDe: null,
    foco: null, checklist: [], enlaces: [], notas: '', asignadaPor: uId, ...extra,
  };
}

export function crear(borrador, uId) {
  const a = { ...borrador, id: uid('a'), creada: ahora(), archivada: null, cerrada: null, fechaOriginal: borrador.fecha, historial: [] };
  log(a, uId, 'creó la actividad');
  if (a.responsable !== uId) avisar(a.responsable, `${persona(uId)?.corto} te asignó «${a.titulo}».`, a.id, 'asignacion');
  estado.actividades = [...estado.actividades, a];
  guardar();
  return a;
}

// Guarda cambios de edición. Si cambia la fecha límite, exige motivo (se valida en la interfaz).
export function actualizar(id, cambios, uId, motivoFecha) {
  const a = act(id); if (!a) return;
  const antes = { ...a };
  Object.assign(a, cambios);
  if (cambios.fecha && cambios.fecha !== antes.fecha) {
    log(a, uId, `movió la fecha límite de ${antes.fecha} a ${cambios.fecha}`, motivoFecha);
    if (a.foco && cambios.fecha > hoyISO()) a.foco = null; // el foco es solo para hoy
  }
  if (cambios.responsable && cambios.responsable !== antes.responsable) {
    log(a, uId, `reasignó a ${persona(cambios.responsable)?.corto}`);
    if (cambios.responsable !== uId) avisar(cambios.responsable, `${persona(uId)?.corto} te asignó «${a.titulo}».`, a.id, 'asignacion');
  }
  if (cambios.titulo && cambios.titulo !== antes.titulo) log(a, uId, 'cambió el título');
  if (cambios.estatus && cambios.estatus !== antes.estatus) aplicarEstatus(a, antes.estatus, cambios.estatus, uId);
  estado.actividades = [...estado.actividades];
  guardar();
}

function aplicarEstatus(a, de, a_, uId) {
  log(a, uId, `cambió el estatus a ${nombreEstatus(a_)}`);
  if (a_ === 'hecho') {
    a.cerrada = ahora();
    if (a.asignadaPor && a.asignadaPor !== uId) avisar(a.asignadaPor, `${persona(uId)?.corto} cerró «${a.titulo}».`, a.id, 'cierre');
    if (a.repeticion && a.repeticion.tipo !== 'no') crearSiguiente(a, uId);
  } else if (de === 'hecho') {
    a.cerrada = null;
  }
}

function siguienteFecha(fecha, r) {
  if (r.tipo === 'diaria') return sumarDiasHabiles(fecha, 1);
  if (r.tipo === 'semanal') return sumarDias(fecha, 7);
  if (r.tipo === 'mensual') { const d = new Date(fecha + 'T12:00:00'); d.setMonth(d.getMonth() + 1); return hoyISO(d); }
  if (r.tipo === 'cada_n') return sumarDias(fecha, Math.max(1, r.cada | 0));
  return null;
}
function crearSiguiente(a, uId) {
  const f = siguienteFecha(a.fecha, a.repeticion);
  if (!f) return;
  const ya = estado.actividades.some((x) => x.serie === (a.serie || a.id) && x.fecha === f && !x.archivada);
  if (ya) return;
  const n = {
    ...a, id: uid('a'), serie: a.serie || a.id, estatus: 'pendiente', fecha: f, fechaOriginal: f, foco: null,
    cerrada: null, archivada: null, creada: ahora(), checklist: a.checklist.map((c) => ({ ...c, id: uid('c'), hecho: false })), historial: [],
  };
  log(n, uId, 'se creó por repetición');
  estado.actividades.push(n);
}

export function cambiarEstatus(id, nuevo, uId) {
  const a = act(id); if (!a || a.estatus === nuevo) return { ok: true };
  const dep = dependenciaAbierta(a);
  if (dep && (nuevo === 'en_curso' || nuevo === 'hecho')) return { ok: false, motivo: `Espera a «${dep.titulo}».` };
  actualizar(id, { estatus: nuevo }, uId);
  return { ok: true, repite: nuevo === 'hecho' && a.repeticion?.tipo !== 'no' };
}

// Un clic en el anillo avanza: Pendiente → En curso → Hecho → Pendiente. Esperando o Bloqueado → En curso.
export function siguienteEstatus(e) {
  return { pendiente: 'en_curso', en_curso: 'hecho', hecho: 'pendiente', esperando: 'en_curso', bloqueado: 'en_curso' }[e] || 'pendiente';
}

export function alternarFoco(id, uId) {
  const a = act(id); if (!a) return { ok: false };
  const hoy = hoyISO();
  if (a.foco === hoy) { a.foco = null; guardar(); return { ok: true, on: false }; }
  const enFoco = vigentes().filter((x) => x.responsable === a.responsable && x.foco === hoy && x.estatus !== 'hecho').length;
  if (enFoco >= 3) return { ok: false, motivo: 'Ya hay 3 actividades en foco hoy. Quita una primero.' };
  a.foco = hoy; log(a, uId, 'la marcó como foco de hoy'); guardar();
  return { ok: true, on: true };
}

export function archivar(id, uId) {
  const a = act(id); if (!a) return;
  a.archivada = ahora(); log(a, uId, 'la archivó');
  estado.actividades.forEach((x) => { if (x.dependeDe === id) x.dependeDe = null; });
  guardar();
}
export function restaurar(id, uId) { const a = act(id); if (!a) return; a.archivada = null; log(a, uId, 'la restauró'); guardar(); }
export function borrarDefinitivo(id, uId) {
  if (!esAdmin(uId)) return { ok: false, motivo: 'Solo un admin puede borrar para siempre.' };
  estado.actividades = estado.actividades.filter((a) => a.id !== id);
  guardar();
  return { ok: true };
}

export function marcarAvisosLeidos(uId) { estado.avisos.forEach((n) => { if (n.para === uId) n.leido = true; }); guardar(); }

export function horasEstimadas(a) { return ({ S: 1, M: 3, L: 6 })[a.esfuerzo] || 0; }

// ---------- Inicio personalizable y espacio personal ----------
export function layoutDe(uId) { return estado.layouts[uId] || LAYOUT_INICIAL; }
export function guardarLayout(uId, lista) { estado.layouts = { ...estado.layouts, [uId]: lista }; guardar(); }
export function personalDe(uId) { return estado.personal[uId] || { archivos: [], pendientes: [], nota: '' }; }
export function guardarPersonal(uId, cambios) { estado.personal = { ...estado.personal, [uId]: { ...personalDe(uId), ...cambios } }; guardar(); }

// Mover con arrastrar: a otra hora, a otro día o fuera de la mecha.
export function mover(id, { fecha, bloque }, uId, motivo) {
  const a = act(id); if (!a) return;
  const cambios = {};
  if (fecha && fecha !== a.fecha) cambios.fecha = fecha;
  if (bloque !== undefined) cambios.bloque = bloque;
  if (Object.keys(cambios).length) actualizar(id, cambios, uId, motivo);
}
export function visiblePara(a, uId) { return a.cliente !== 'personal' || a.responsable === uId; }

// ---------- Preferencias de vista por persona ----------
export function prefsDe(uId) { return { vista: 'dia', acomodo: 'derecha', ...(estado.prefs[uId] || {}) }; }
export function guardarPrefs(uId, cambios) { estado.prefs = { ...estado.prefs, [uId]: { ...prefsDe(uId), ...cambios } }; guardar(); }

// ---------- Eventos para el historial (chat, facturas, mapa) ----------
function evento(quien, que, extra = {}) { estado.eventos = [{ id: uid('v'), cuando: ahora(), quien, que, ...extra }, ...(estado.eventos || [])].slice(0, 300); }

// Historial global de solo lectura: cambios de actividades + eventos del sistema.
export function historialGlobal() {
  const deActs = estado.actividades.flatMap((a) => (a.historial || []).map((h) => ({ ...h, actividad: a.id, titulo: a.titulo, cliente: a.cliente })));
  return [...deActs, ...(estado.eventos || [])].sort((x, y) => y.cuando.localeCompare(x.cuando));
}

// ---------- Correo (simulado hasta conectar Gmail) ----------
export function marcarCorreo(id, leido = true) { const m = estado.correos.find((x) => x.id === id); if (m) { m.leido = leido; guardar(); } }
export function correoAActividad(id, uId) {
  const m = estado.correos.find((x) => x.id === id); if (!m) return null;
  m.leido = true; m.actividad = true;
  const a = crear(nuevaVacia(uId, { titulo: m.asunto, cliente: m.cliente, proyecto: 'g-' + m.cliente, esfuerzo: 'S', notas: `Desde el correo de ${m.de}` }), uId);
  return a;
}

// ---------- Chat interno ----------
export function enviarMensaje(canal, de, cuerpo) {
  const msj = { id: uid('x'), canal, de, cuando: ahora(), ...cuerpo };
  estado.chat.mensajes = [...estado.chat.mensajes, msj];
  marcarLeidoCanal(canal, de, false);
  if (msj.tipo === 'factura') { evento(de, `envió la factura ${msj.archivo} a ${persona(msj.para)?.corto}`); avisar(msj.para, `${persona(de)?.corto} te envió una factura.`, null, 'factura'); }
  guardar();
  return msj;
}
export function marcarLeidoCanal(canal, uId, guardarYa = true) {
  estado.chat.leidos = { ...estado.chat.leidos, [uId]: { ...(estado.chat.leidos[uId] || {}), [canal]: ahora() } };
  if (guardarYa) guardar();
}
export function sinLeerChat(uId) {
  const l = estado.chat.leidos[uId] || {};
  return estado.chat.mensajes.filter((m) => m.de !== uId && estado.chat.canales.find((c) => c.id === m.canal)?.miembros.includes(uId) && (!l[m.canal] || m.cuando > l[m.canal])).length;
}
export function canalDirecto(a, b) {
  const id = 'dm-' + [a, b].sort().join('-');
  if (!estado.chat.canales.some((c) => c.id === id)) { estado.chat.canales = [...estado.chat.canales, { id, miembros: [a, b] }]; guardar(); }
  return id;
}
export const ESTATUS_FACTURA = ['enviada', 'recibida', 'pagada'];
export function avanzarFactura(msjId, uId) {
  const m = estado.chat.mensajes.find((x) => x.id === msjId); if (!m) return { ok: false };
  if (m.para !== uId && persona(uId)?.permiso !== 'dueno') return { ok: false, motivo: 'Solo quien la recibe la puede marcar.' };
  const i = ESTATUS_FACTURA.indexOf(m.estatus);
  if (i >= ESTATUS_FACTURA.length - 1) return { ok: false };
  m.estatus = ESTATUS_FACTURA[i + 1];
  evento(uId, `marcó la factura ${m.archivo} como ${m.estatus}`);
  if (m.de !== uId) avisar(m.de, `Tu factura ${m.archivo} está ${m.estatus}.`, null, 'factura');
  estado.chat.mensajes = [...estado.chat.mensajes];
  guardar();
  return { ok: true };
}

// ---------- Clientes ----------
export const clienteDe = (id) => estado.clientes.find((c) => c.id === id);
export function crearCliente(d, uId) {
  const base = d.nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente';
  let id = base, k = 2;
  while (clienteDe(id)) id = base + '-' + k++;
  const c = { id, nombre: d.nombre.trim(), color: d.color, responsable: d.responsable, salud: d.salud || 'bien',
    satisfaccion: d.satisfaccion ? [{ fecha: hoyISO(), valor: d.satisfaccion }] : [] };
  estado.clientes = [...estado.clientes, c];
  estado.proyectos = [...estado.proyectos, { id: 'g-' + id, nombre: 'General', cliente: id, responsable: d.responsable, entrega: null }];
  evento(uId, `agregó el cliente ${c.nombre}`, { cliente: id });
  guardar();
  return c;
}
export function actualizarCliente(id, cambios, uId) {
  const c = clienteDe(id); if (!c) return;
  if (cambios.salud && cambios.salud !== c.salud) evento(uId, `marcó a ${c.nombre} como «${{ bien: 'Va bien', atencion: 'Atención', riesgo: 'En riesgo' }[cambios.salud]}»`, { cliente: id });
  Object.assign(c, cambios);
  estado.clientes = [...estado.clientes];
  guardar();
}
// Una calificación por día: si ya hay una de hoy, se reemplaza.
export function calificar(id, valor, uId) {
  const c = clienteDe(id); if (!c) return;
  const hoy = hoyISO();
  c.satisfaccion = [...c.satisfaccion.filter((s) => s.fecha !== hoy), { fecha: hoy, valor }];
  evento(uId, `calificó la satisfacción de ${c.nombre}`, { cliente: id });
  estado.clientes = [...estado.clientes];
  guardar();
}

// ---------- Proyectos ----------
export function crearProyecto(d, uId) {
  const p = { id: uid('p'), nombre: d.nombre.trim(), cliente: d.cliente, responsable: d.responsable, entrega: d.entrega || null };
  estado.proyectos = [...estado.proyectos, p];
  evento(uId, `creó el proyecto ${p.nombre}`, { cliente: d.cliente });
  if (d.responsable && d.responsable !== uId) avisar(d.responsable, `${persona(uId)?.corto} te puso a cargo del proyecto «${p.nombre}».`, null, 'asignacion');
  guardar();
  return p;
}
export function avanceProyecto(pid) {
  const l = vigentes().filter((a) => a.proyecto === pid);
  return { total: l.length, hechas: l.filter((a) => a.estatus === 'hecho').length };
}

// ---------- Minutas desde el correo ----------
// Cuando llega la transcripción de una junta, se arma la minuta sola y queda visible para todo el equipo.
// Hoy es simulado: al conectar Gmail + Supabase, un proceso lee el correo y extrae los acuerdos con IA.
const PLANTILLAS_JUNTA = [
  { cliente: 'solumed', titulo: 'Seguimiento Solumed', resumen: 'Se revisaron los resultados de la semana y el siguiente reporte.',
    acuerdos: [['Preparar el reporte de la semana', 'adan', 2], ['Proponer dos piezas nuevas', 'paco', 3]] },
  { cliente: 'endodx', titulo: 'Junta con Endodx', resumen: 'El cliente confirmó fechas y pidió ver avances el viernes.',
    acuerdos: [['Enviar avances antes del viernes', 'adan', 2], ['Ajustar la parrilla de contenido', 'paco', 1]] },
  { cliente: 'novartis', titulo: 'Alcance con Novartis', resumen: 'Se definió el siguiente paso del alcance y quién lo presenta.',
    acuerdos: [['Enviar el alcance revisado', 'carlos', 3], ['Armar la presentación', 'adan', 2]] },
];
export function simularTranscripcion(uId) {
  const t = PLANTILLAS_JUNTA[(estado.minutas.length) % PLANTILLAS_JUNTA.length];
  const H = hoyISO();
  const mid = uid('mi'), cid = uid('m');
  estado.correos = [{ id: cid, de: 'Notas de reunión', cliente: t.cliente, asunto: 'Transcripción · ' + t.titulo, cuando: ahora(), leido: false, tipo: 'transcripcion', minuta: mid }, ...estado.correos];
  const m = { id: mid, cliente: t.cliente, titulo: t.titulo, fecha: ahora(), correo: cid, asistentes: estado.personas.map((p) => p.id), resumen: t.resumen,
    acuerdos: t.acuerdos.map(([texto, responsable, dias]) => ({ id: uid('k'), texto, responsable, fecha: sumarDiasHabiles(H, dias), tarea: null })) };
  estado.minutas = [m, ...estado.minutas];
  evento(uId, `recibió la minuta «${m.titulo}»`, { cliente: t.cliente });
  estado.personas.forEach((p) => avisar(p.id, `Nueva minuta: ${m.titulo}.`, null, 'minuta'));
  guardar();
  return m;
}
// Un acuerdo de la minuta se vuelve tarea con un toque (ya trae responsable, fecha y cliente).
export function acuerdoATarea(mid, kid, uId) {
  const m = estado.minutas.find((x) => x.id === mid); const k = m?.acuerdos.find((x) => x.id === kid);
  if (!k || k.tarea) return null;
  const a = crear(nuevaVacia(k.responsable, { titulo: k.texto, cliente: m.cliente, proyecto: 'g-' + m.cliente, fecha: k.fecha, esfuerzo: 'S', asignadaPor: uId, notas: `De la minuta «${m.titulo}»` }), uId);
  k.tarea = a.id;
  estado.minutas = [...estado.minutas];
  guardar();
  return a;
}
