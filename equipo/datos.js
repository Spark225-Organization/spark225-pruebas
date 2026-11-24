// Datos de prueba FICTICIOS. pruebas.spark225.com es público: aquí no va nada real de clientes ni del equipo.
// Las fechas se calculan a partir de hoy para que el demo siempre se vea vivo.

export const ESFUERZO_HORAS = { S: 1, M: 3, L: 6 }; // Supuesto para la carga de la semana; se puede ajustar.
export const CAPACIDAD_SEMANA = 30; // Horas planeables por persona a la semana (supuesto).
export const JORNADA = { inicio: '09:00', fin: '19:00' };

export const ESTATUS = [
  { id: 'pendiente', nombre: 'Pendiente', tecla: '1' },
  { id: 'en_curso', nombre: 'En curso', tecla: '2' },
  { id: 'esperando', nombre: 'Esperando cliente', tecla: '3' },
  { id: 'bloqueado', nombre: 'Bloqueado', tecla: '4' },
  { id: 'hecho', nombre: 'Hecho', tecla: '5' },
];

export const MOTIVOS_FECHA = ['El cliente pidió el cambio', 'Dependencia externa', 'Carga del equipo', 'Error de captura', 'Otro'];

export const REPETICION = [
  { id: 'no', nombre: 'No se repite' },
  { id: 'diaria', nombre: 'Cada día hábil' },
  { id: 'semanal', nombre: 'Cada semana' },
  { id: 'mensual', nombre: 'Cada mes' },
  { id: 'cada_n', nombre: 'Cada N días' },
];

export function hoyISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return hoyISO(d);
}
export function sumarDiasHabiles(iso, n) {
  let d = iso, k = 0;
  while (k < n) { d = sumarDias(d, 1); const w = new Date(d + 'T12:00:00').getDay(); if (w !== 0 && w !== 6) k++; }
  return d;
}

export function semilla() {
  const H = hoyISO();
  const d = (n) => sumarDias(H, n);
  const ahora = new Date().toISOString();
  const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

  const personas = [
    { id: 'u1', nombre: 'Andrea Solís', corto: 'Andrea', puesto: 'Growth & Performance', permiso: 'admin', correo: 'andrea@spark225.com', color: '#7A6CE0', clientes: ['aurora', 'nexo', 'orbis', 'dermika'] },
    { id: 'u2', nombre: 'Rodrigo Vela', corto: 'Rodrigo', puesto: 'Dirección', permiso: 'dueno', correo: 'rodrigo@spark225.com', color: '#C2581F', clientes: ['aurora', 'nexo', 'vertice', 'orbis', 'dermika'] },
    { id: 'u3', nombre: 'Paula Ortiz', corto: 'Paula', puesto: 'Diseño', permiso: 'colaborador', correo: 'paula@spark225.com', color: '#1F8A73', clientes: ['aurora', 'dermika', 'vertice'] },
    { id: 'u4', nombre: 'Iván Reyes', corto: 'Iván', puesto: 'Medical', permiso: 'colaborador', correo: 'ivan@spark225.com', color: '#3478C6', clientes: ['orbis', 'nexo'] },
    { id: 'u5', nombre: 'Sofía Lara', corto: 'Sofía', puesto: 'Cuentas', permiso: 'colaborador', correo: 'sofia@spark225.com', color: '#B8467A', clientes: ['vertice', 'dermika', 'aurora'] },
  ];

  const clientes = [
    { id: 'interno', nombre: 'Interno Spark', color: '#8A96A3' },
    { id: 'aurora', nombre: 'Clínica Aurora', color: '#8B7CF6' },
    { id: 'nexo', nombre: 'Laboratorio Nexo', color: '#4A9BE8' },
    { id: 'vertice', nombre: 'Grupo Vértice', color: '#2BB59A' },
    { id: 'dermika', nombre: 'Dermika', color: '#E0628E' },
    { id: 'orbis', nombre: 'Orbis Pharma', color: '#A3C94A' },
  ];

  const proyectos = [
    { id: 'p-op', nombre: 'Operación interna', cliente: 'interno' },
    { id: 'p-2027', nombre: 'Plan 2027', cliente: 'interno' },
    { id: 'p-portal', nombre: 'Portal de clientes', cliente: 'interno' },
    { id: 'p-web', nombre: 'Relanzamiento web', cliente: 'aurora' },
    { id: 'p-q1', nombre: 'Campaña Q1', cliente: 'nexo' },
    { id: 'p-cont', nombre: 'Contenido mensual', cliente: 'vertice' },
    { id: 'p-social', nombre: 'Redes sociales', cliente: 'dermika' },
    { id: 'p-lanz', nombre: 'Lanzamiento de producto', cliente: 'orbis' },
  ];

  let n = 0;
  const A = (x) => ({
    id: 'a' + (++n), estatus: 'pendiente', colaboradores: [], checklist: [], enlaces: [], notas: '',
    repeticion: { tipo: 'no', cada: 7 }, dependeDe: null, foco: null, bloque: null,
    asignadaPor: x.responsable, creada: hace(3), archivada: null, cerrada: null,
    fechaOriginal: x.fecha, historial: [{ cuando: hace(3), quien: x.asignadaPor || x.responsable, que: 'creó la actividad' }],
    ...x,
  });

  const actividades = [
    A({ titulo: 'Daily del equipo', responsable: 'u1', cliente: 'interno', proyecto: 'p-op', fecha: H, esfuerzo: 'S',
      bloque: { inicio: '09:11', min: 20 }, repeticion: { tipo: 'diaria', cada: 1 }, estatus: 'hecho', cerrada: ahora,
      colaboradores: ['u2', 'u3', 'u4', 'u5'] }),
    A({ titulo: 'Deck de 5 láminas para la junta de dirección', responsable: 'u1', cliente: 'interno', proyecto: 'p-2027', fecha: H, esfuerzo: 'M',
      bloque: { inicio: '10:00', min: 90 }, estatus: 'en_curso', foco: H, colaboradores: ['u2'], asignadaPor: 'u2',
      checklist: [{ id: 'c1', texto: 'Estructura de las 5 láminas', hecho: true }, { id: 'c2', texto: 'Datos de cierre de noviembre', hecho: true }, { id: 'c3', texto: 'Propuesta de prioridades 2027', hecho: false }, { id: 'c4', texto: 'Revisión con Rodrigo', hecho: false }],
      enlaces: [{ id: 'e1', titulo: 'Carpeta del deck en Drive', url: 'https://drive.google.com/' }] }),
    A({ titulo: 'Revisar copy de la landing de servicios', responsable: 'u1', cliente: 'aurora', proyecto: 'p-web', fecha: H, esfuerzo: 'S',
      bloque: { inicio: '12:00', min: 45 }, foco: H, colaboradores: ['u3'] }),
    A({ titulo: 'Propuesta de contenido de enero', responsable: 'u1', cliente: 'dermika', proyecto: 'p-social', fecha: H, esfuerzo: 'M',
      bloque: { inicio: '13:30', min: 60 }, foco: H, colaboradores: ['u5'] }),
    A({ titulo: 'Pedir acceso al registrador del dominio', responsable: 'u2', cliente: 'interno', proyecto: 'p-portal', fecha: H, esfuerzo: 'S', asignadaPor: 'u1' }),
    A({ titulo: 'Configurar DNS de portal.spark225.com', responsable: 'u1', cliente: 'interno', proyecto: 'p-portal', fecha: H, esfuerzo: 'S',
      bloque: { inicio: '16:00', min: 45 }, dependeDe: 'a5' }),
    A({ titulo: 'Entrega de banners para la campaña Q1', responsable: 'u1', cliente: 'nexo', proyecto: 'p-q1', fecha: H, esfuerzo: 'M',
      estatus: 'esperando', colaboradores: ['u3'], historial: [{ cuando: hace(3), quien: 'u1', que: 'creó la actividad' }, { cuando: hace(1), quien: 'u1', que: 'cambió el estatus a Esperando cliente' }] }),
    A({ titulo: 'Reporte mensual de KPIs', responsable: 'u1', cliente: 'orbis', proyecto: 'p-lanz', fecha: d(-1), fechaOriginal: d(-3), esfuerzo: 'M',
      repeticion: { tipo: 'mensual', cada: 1 }, colaboradores: ['u4'],
      historial: [{ cuando: hace(6), quien: 'u1', que: 'creó la actividad' }, { cuando: hace(3), quien: 'u1', que: 'movió la fecha límite', motivo: 'Dependencia externa: faltaban los datos de la plataforma' }] }),
    A({ titulo: 'Validar claims del folleto con el área médica', responsable: 'u4', cliente: 'orbis', proyecto: 'p-lanz', fecha: d(1), esfuerzo: 'M', asignadaPor: 'u1', colaboradores: ['u1'] }),
    A({ titulo: 'Calendario de publicaciones de diciembre', responsable: 'u5', cliente: 'vertice', proyecto: 'p-cont', fecha: d(2), esfuerzo: 'M', estatus: 'en_curso' }),
    A({ titulo: 'Diseño de 6 piezas para redes', responsable: 'u3', cliente: 'dermika', proyecto: 'p-social', fecha: d(1), esfuerzo: 'L', estatus: 'en_curso', asignadaPor: 'u1' }),
    A({ titulo: 'Maquetar la nueva página de inicio', responsable: 'u3', cliente: 'aurora', proyecto: 'p-web', fecha: d(3), esfuerzo: 'L', asignadaPor: 'u1' }),
    A({ titulo: 'Retoque de fotografías de producto', responsable: 'u3', cliente: 'orbis', proyecto: 'p-lanz', fecha: d(2), esfuerzo: 'M' }),
    A({ titulo: 'Revisión de presupuesto de pauta Q1', responsable: 'u2', cliente: 'nexo', proyecto: 'p-q1', fecha: d(4), esfuerzo: 'S' }),
    A({ titulo: 'Plan de comunicación 2027 (LinkedIn y PR)', responsable: 'u1', cliente: 'interno', proyecto: 'p-2027', fecha: d(3), esfuerzo: 'L', colaboradores: ['u2', 'u5'] }),
    A({ titulo: 'Semáforo de KPIs por cliente', responsable: 'u1', cliente: 'interno', proyecto: 'p-op', fecha: d(2), esfuerzo: 'M' }),
    A({ titulo: 'Minuta de la junta con Grupo Vértice', responsable: 'u5', cliente: 'vertice', proyecto: 'p-cont', fecha: H, esfuerzo: 'S', estatus: 'hecho', cerrada: ahora, asignadaPor: 'u1' }),
    A({ titulo: 'Guion del video de lanzamiento', responsable: 'u4', cliente: 'orbis', proyecto: 'p-lanz', fecha: d(4), esfuerzo: 'M', estatus: 'bloqueado',
      notas: 'Falta la aprobación del área médica del cliente.' }),
    A({ titulo: 'Respuestas a comentarios del cliente', responsable: 'u5', cliente: 'aurora', proyecto: 'p-web', fecha: d(-2), esfuerzo: 'S', estatus: 'esperando' }),
    A({ titulo: 'Facturación mensual de colaboradores', responsable: 'u2', cliente: 'interno', proyecto: 'p-op', fecha: d(5), esfuerzo: 'S', repeticion: { tipo: 'mensual', cada: 1 } }),
  ];

  const avisos = [
    { id: 'n1', para: 'u1', cuando: hace(0.05), leido: false, tipo: 'cierre', texto: 'Sofía cerró «Minuta de la junta con Grupo Vértice».', actividad: 'a17' },
    { id: 'n2', para: 'u1', cuando: hace(0.6), leido: true, tipo: 'asignacion', texto: 'Rodrigo te asignó «Deck de 5 láminas para la junta de dirección».', actividad: 'a2' },
  ];

  return { version: 1, creado: H, personas, clientes, proyectos, actividades, avisos, papeleraDias: 30 };
}
