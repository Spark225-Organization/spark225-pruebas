// Capa de datos. En la fase 1 todo vive en el navegador (localStorage) con datos ficticios.
// Cuando haya acceso a Supabase, se reemplaza este archivo por llamadas a tablas con RLS
// manteniendo las mismas funciones públicas.
import { semilla, hoyISO, sumarDias, sumarDiasHabiles, ESTATUS, LAYOUT_INICIAL } from './datos.js';

const CLAVE = 'ssam-equipo-v2';
const DIA_MS = 86400000;
let estado = cargar();
const oyentes = new Set();

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const e = JSON.parse(crudo);
      if (e && e.version === 2) return purgar(e);
    }
  } catch (_) { /* almacenamiento no disponible: se usa la semilla en memoria */ }
  return semilla();
}
function purgar(e) {
  const limite = Date.now() - e.papeleraDias * DIA_MS;
  e.actividades = e.actividades.filter((a) => !a.archivada || new Date(a.archivada).getTime() > limite);
  return e;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (_) { /* sin almacenamiento */ }
  oyentes.forEach((f) => f(estado));
}

export const store = {
  get: () => estado,
  suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); },
  restablecer() { estado = semilla(); guardar(); },
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
