// Capa de datos. En la fase 1 todo vive en el navegador (localStorage) con datos ficticios.
// Cuando haya acceso a Supabase, se reemplaza este archivo por llamadas a tablas con RLS
// manteniendo las mismas funciones públicas.
import { semilla, hoyISO, sumarDias, sumarDiasHabiles, ESTATUS, LAYOUT_INICIAL } from './datos.js?v=202611241452';

const CLAVE = 'ssam-equipo-v4';
const DIA_MS = 86400000;
let estado = cargar();
const oyentes = new Set();

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const e = JSON.parse(crudo);
      if (e && e.version === 4) return purgar(e);
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

// ---------- Flujos (mapas) ----------
export const flujoDe = (fid) => estado.flujos.find((f) => f.id === fid);
export function crearFlujo(nombre, uId, base = {}) {
  const f = { id: uid('f'), nombre: nombre || 'Nuevo flujo', creador: uId, creado: ahora(), nodos: base.nodos || [], aristas: base.aristas || [] };
  estado.flujos = [...estado.flujos, f];
  evento(uId, `creó el flujo «${f.nombre}»`);
  guardar(); return f.id;
}
export function renombrarFlujo(fid, nombre) { const f = flujoDe(fid); if (f && nombre.trim()) { f.nombre = nombre.trim(); estado.flujos = [...estado.flujos]; guardar(); } }
export function borrarFlujo(fid, uId) { const f = flujoDe(fid); estado.flujos = estado.flujos.filter((x) => x.id !== fid); if (f) evento(uId, `borró el flujo «${f.nombre}»`); guardar(); }
export function flujosDeActividad(aId) { return estado.flujos.filter((f) => f.nodos.some((n) => n.tipo === 'actividad' && n.ref === aId)); }
// Avance de un flujo: tareas cerradas sobre el total de tareas vivas que contiene.
export function avanceFlujo(f) {
  const acts = f.nodos.filter((n) => n.tipo === 'actividad').map((n) => act(n.ref)).filter((a) => a && !a.archivada);
  return { hechas: acts.filter((a) => a.estatus === 'hecho').length, total: acts.length, acts };
}
// Flujo automático de una tarea que no está en ningún flujo: su cadena de dependencias y responsables.
export function flujoAuto(aId) {
  const base = act(aId); if (!base) return null;
  const cadena = [];
  let x = base; const vistos = new Set();
  while (x && x.dependeDe && !vistos.has(x.id)) { vistos.add(x.id); x = act(x.dependeDe); if (x) cadena.unshift(x); }
  cadena.push(base);
  let sig = estado.actividades.find((y) => y.dependeDe === base.id && !y.archivada);
  while (sig && !cadena.includes(sig)) { cadena.push(sig); sig = estado.actividades.find((y) => y.dependeDe === sig.id && !y.archivada); }
  const nodos = [], aristas = [];
  cadena.forEach((a, i) => {
    nodos.push({ id: 'auto-' + a.id, tipo: 'actividad', ref: a.id, x: i * 320, y: 120 });
    if (i > 0) aristas.push({ id: 'ae-' + i, de: 'auto-' + cadena[i - 1].id, a: 'auto-' + a.id });
  });
  const personas = [...new Set(cadena.map((a) => a.responsable))];
  personas.forEach((pid, k) => {
    const suyas = cadena.map((a, i) => ({ a, i })).filter(({ a }) => a.responsable === pid);
    nodos.push({ id: 'auto-p-' + pid, tipo: 'persona', ref: pid, x: cadena.length * 320 + 20, y: 40 + k * 120 + (personas.length === 1 ? 90 : 0) });
    suyas.forEach(({ a }) => aristas.push({ id: 'ap-' + a.id, de: 'auto-' + a.id, a: 'auto-p-' + pid }));
  });
  return { id: 'auto', auto: true, nombre: base.titulo, creador: null, nodos, aristas, enfoque: 'auto-' + aId };
}

export function moverNodo(fid, id, x, y) { const n = flujoDe(fid)?.nodos.find((k) => k.id === id); if (n) { n.x = Math.round(x); n.y = Math.round(y); guardar(); } }
export function agregarNodo(fid, nodo, uId) {
  const f = flujoDe(fid); if (!f) return null;
  const n = { id: uid('n'), ...nodo };
  f.nodos = [...f.nodos, n];
  guardar(); return n;
}
export function quitarNodo(fid, id) {
  const f = flujoDe(fid); if (!f) return;
  f.nodos = f.nodos.filter((n) => n.id !== id);
  f.aristas = f.aristas.filter((e) => e.de !== id && e.a !== id);
  guardar();
}
export function editarNota(fid, id, texto) { const n = flujoDe(fid)?.nodos.find((k) => k.id === id); if (n) { n.texto = texto; guardar(); } }
// Conectar aplica la regla: actividad → persona asigna; actividad → actividad crea la dependencia.
export function conectar(fid, de, a, uId) {
  const f = flujoDe(fid); if (!f) return { ok: false };
  if (de === a || f.aristas.some((e) => e.de === de && e.a === a)) return { ok: false };
  const nDe = f.nodos.find((n) => n.id === de), nA = f.nodos.find((n) => n.id === a);
  let efecto = null;
  if (nDe?.tipo === 'actividad' && nA?.tipo === 'persona') { actualizar(nDe.ref, { responsable: nA.ref }, uId); efecto = `Asignada a ${persona(nA.ref)?.corto}`; }
  else if (nDe?.tipo === 'persona' && nA?.tipo === 'actividad') { actualizar(nA.ref, { responsable: nDe.ref }, uId); efecto = `Asignada a ${persona(nDe.ref)?.corto}`; }
  else if (nDe?.tipo === 'actividad' && nA?.tipo === 'actividad') { actualizar(nA.ref, { dependeDe: nDe.ref }, uId); log(act(nA.ref), uId, `ahora espera a «${act(nDe.ref)?.titulo}»`); efecto = 'Ahora espera a la anterior'; }
  f.aristas = [...f.aristas, { id: uid('e'), de, a }];
  guardar();
  return { ok: true, efecto };
}
export function desconectar(fid, id, uId) {
  const f = flujoDe(fid); const e = f?.aristas.find((x) => x.id === id); if (!e) return;
  const nDe = f.nodos.find((n) => n.id === e.de), nA = f.nodos.find((n) => n.id === e.a);
  if (nDe?.tipo === 'actividad' && nA?.tipo === 'actividad' && act(nA.ref)?.dependeDe === nDe.ref) actualizar(nA.ref, { dependeDe: null }, uId);
  f.aristas = f.aristas.filter((x) => x.id !== id);
  guardar();
}
