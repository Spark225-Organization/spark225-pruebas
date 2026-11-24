// Datos para presentar. Equipo y clientes con nombres reales (solo nombre, sin cifras).
// Las actividades son ejemplos: no hay datos de pacientes ni montos. Las fechas se calculan a partir de hoy.

export const ESFUERZO_HORAS = { S: 1, M: 3, L: 6 }; // Supuesto para la carga de la semana.
export const CAPACIDAD_SEMANA = 30; // Horas planeables por persona a la semana (supuesto).
export const JORNADA = { inicio: '08:00', fin: '20:00' };

export const ESTATUS = [
  { id: 'pendiente', nombre: 'Pendiente', tecla: '1' },
  { id: 'en_curso', nombre: 'En curso', tecla: '2' },
  { id: 'esperando', nombre: 'Esperando cliente', tecla: '3' },
  { id: 'bloqueado', nombre: 'Bloqueado', tecla: '4' },
  { id: 'hecho', nombre: 'Hecho', tecla: '5' },
];

export const MOTIVOS_FECHA = ['Lo pidió el cliente', 'Dependencia externa', 'Carga del equipo', 'Error de captura', 'Otro'];

export const REPETICION = [
  { id: 'no', nombre: 'No se repite' },
  { id: 'diaria', nombre: 'Cada día hábil' },
  { id: 'semanal', nombre: 'Cada semana' },
  { id: 'mensual', nombre: 'Cada mes' },
  { id: 'cada_n', nombre: 'Cada N días' },
];

// Catálogo de widgets que cada persona puede agregar a su inicio.
export const WIDGETS = [
  { tipo: 'foco', nombre: 'Foco de hoy', tam: 'm', icono: 'foco' },
  { tipo: 'cliente', nombre: 'Cliente', tam: 's', icono: 'clientes', porCliente: true },
  { tipo: 'esperando', nombre: 'Esperando cliente', tam: 's', icono: 'espera' },
  { tipo: 'carga', nombre: 'Carga del equipo', tam: 'm', icono: 'equipo' },
  { tipo: 'sigue', nombre: 'Lo que sigue', tam: 'm', icono: 'semana' },
  { tipo: 'archivos', nombre: 'Mis archivos', tam: 'm', icono: 'carpeta' },
  { tipo: 'personal', nombre: 'Mis pendientes', tam: 'm', icono: 'lista' },
  { tipo: 'nota', nombre: 'Nota rápida', tam: 's', icono: 'nota' },
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

export const LAYOUT_INICIAL = [
  { id: 'w1', tipo: 'foco' },
  { id: 'w2', tipo: 'cliente', cliente: 'carnot' },
  { id: 'w3', tipo: 'cliente', cliente: 'solumed' },
  { id: 'w4', tipo: 'personal' },
  { id: 'w5', tipo: 'esperando' },
  { id: 'w6', tipo: 'nota' },
  { id: 'w7', tipo: 'archivos' },
  { id: 'w8', tipo: 'carga' },
];

export function semilla() {
  const H = hoyISO();
  const d = (n) => sumarDias(H, n);
  const ahora = new Date().toISOString();
  const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

  const personas = [
    { id: 'adan', nombre: 'Adán Limones', corto: 'Adán', puesto: 'Sr. Growth & Performance', permiso: 'admin', color: '#E47739' },
    { id: 'carlos', nombre: 'Carlos Gómez', corto: 'Carlos', puesto: 'Dirección', permiso: 'dueno', color: '#4E5964' },
    { id: 'paco', nombre: 'Paco', corto: 'Paco', puesto: 'Creativo', permiso: 'colaborador', color: '#1F8A73' },
  ];

  const clientes = [
    { id: 'carnot', nombre: 'Carnot', color: '#8B7CF6' },
    { id: 'interno', nombre: 'Spark', color: '#8A96A3' },
    { id: 'solumed', nombre: 'Solumed', color: '#2BB59A' },
    { id: 'endodx', nombre: 'Endodx', color: '#4A9BE8' },
    { id: 'novartis', nombre: 'Novartis', color: '#E0628E' },
    { id: 'theramex', nombre: 'Theramex', color: '#A3C94A' },
    { id: 'eisai', nombre: 'Eisai', color: '#38B2C9' },
    { id: 'leadso', nombre: 'Leadso', color: '#C77DDB' },
    { id: 'personal', nombre: 'Personal', color: '#B9A27E', privado: true },
  ];

  // Cada cliente tiene un proyecto «General» para que crear sea rápido.
  const proyectos = [
    ...clientes.map((c) => ({ id: 'g-' + c.id, nombre: 'General', cliente: c.id })),
    { id: 'p-2027', nombre: 'Plan 2027', cliente: 'interno' },
    { id: 'p-portal', nombre: 'Portal de clientes', cliente: 'interno' },
    { id: 'p-meta', nombre: 'Campaña Meta', cliente: 'carnot' },
  ];

  let n = 0;
  const A = (x) => ({
    id: 'a' + (++n), estatus: 'pendiente', colaboradores: [], checklist: [], enlaces: [], notas: '',
    repeticion: { tipo: 'no', cada: 7 }, dependeDe: null, foco: null, bloque: null, esfuerzo: 'S',
    asignadaPor: x.responsable, creada: hace(3), archivada: null, cerrada: null,
    fechaOriginal: x.fecha, proyecto: 'g-' + x.cliente,
    historial: [{ cuando: hace(3), quien: x.asignadaPor || x.responsable, que: 'creó la actividad' }],
    ...x,
  });

  const actividades = [
    A({ titulo: 'Daily', responsable: 'adan', cliente: 'interno', fecha: H, bloque: { inicio: '09:11', min: 20 },
      repeticion: { tipo: 'diaria', cada: 1 }, estatus: 'hecho', cerrada: ahora, colaboradores: ['carlos', 'paco'] }),
    A({ titulo: 'Deck de 5 láminas', responsable: 'adan', cliente: 'interno', proyecto: 'p-2027', fecha: H, esfuerzo: 'M',
      bloque: { inicio: '10:00', min: 90 }, estatus: 'en_curso', foco: H, colaboradores: ['carlos'], asignadaPor: 'carlos',
      checklist: [{ id: 'c1', texto: 'Estructura', hecho: true }, { id: 'c2', texto: 'Cierre de noviembre', hecho: true }, { id: 'c3', texto: 'Prioridades 2027', hecho: false }, { id: 'c4', texto: 'Revisión con Carlos', hecho: false }] }),
    A({ titulo: 'Revisar campaña Meta', responsable: 'adan', cliente: 'carnot', proyecto: 'p-meta', fecha: H, bloque: { inicio: '12:00', min: 45 }, foco: H, colaboradores: ['paco'] }),
    A({ titulo: 'Propuesta Theramex', responsable: 'adan', cliente: 'theramex', fecha: H, esfuerzo: 'M', bloque: { inicio: '13:30', min: 60 }, foco: H }),
    A({ titulo: 'Acceso al registrador del dominio', responsable: 'carlos', cliente: 'interno', proyecto: 'p-portal', fecha: H, asignadaPor: 'adan' }),
    A({ titulo: 'DNS de portal.spark225.com', responsable: 'adan', cliente: 'interno', proyecto: 'p-portal', fecha: H, bloque: { inicio: '16:00', min: 45 }, dependeDe: 'a5' }),
    A({ titulo: 'Endodx · entregables día 5', responsable: 'adan', cliente: 'endodx', fecha: H, esfuerzo: 'M', estatus: 'esperando', colaboradores: ['paco'],
      historial: [{ cuando: hace(3), quien: 'adan', que: 'creó la actividad' }, { cuando: hace(1), quien: 'adan', que: 'cambió el estatus a Esperando cliente' }] }),
    A({ titulo: 'Reporte mensual Solumed', responsable: 'adan', cliente: 'solumed', fecha: d(-1), fechaOriginal: d(-3), esfuerzo: 'M', repeticion: { tipo: 'mensual', cada: 1 },
      historial: [{ cuando: hace(6), quien: 'adan', que: 'creó la actividad' }, { cuando: hace(3), quien: 'adan', que: 'movió la fecha límite', motivo: 'Dependencia externa' }] }),
    A({ titulo: 'Plan 2027 · LinkedIn y PR', responsable: 'adan', cliente: 'interno', proyecto: 'p-2027', fecha: d(1), esfuerzo: 'L', bloque: { inicio: '11:00', min: 120 }, colaboradores: ['carlos'] }),
    A({ titulo: 'KPIs con semáforo', responsable: 'adan', cliente: 'interno', fecha: d(2), esfuerzo: 'M' }),
    A({ titulo: 'Video con IA', responsable: 'adan', cliente: 'carnot', proyecto: 'p-meta', fecha: d(3), esfuerzo: 'M', colaboradores: ['paco'] }),
    A({ titulo: 'Alcance Novartis', responsable: 'adan', cliente: 'novartis', fecha: d(2), esfuerzo: 'M', colaboradores: ['carlos'] }),
    A({ titulo: 'Piezas campaña Carnot', responsable: 'paco', cliente: 'carnot', proyecto: 'p-meta', fecha: d(1), esfuerzo: 'L', estatus: 'en_curso', asignadaPor: 'adan' }),
    A({ titulo: 'Calendario de contenido Eisai', responsable: 'paco', cliente: 'eisai', fecha: d(2), esfuerzo: 'M' }),
    A({ titulo: 'Copys de redes Leadso', responsable: 'paco', cliente: 'leadso', fecha: H, esfuerzo: 'S', bloque: { inicio: '11:00', min: 60 } }),
    A({ titulo: 'Banners Solumed', responsable: 'paco', cliente: 'solumed', fecha: d(3), esfuerzo: 'M', asignadaPor: 'adan' }),
    A({ titulo: 'Revisión del SSAM', responsable: 'carlos', cliente: 'interno', fecha: d(1), esfuerzo: 'S', colaboradores: ['adan'] }),
    A({ titulo: 'Junta con Novartis', responsable: 'carlos', cliente: 'novartis', fecha: d(4), esfuerzo: 'S', bloque: { inicio: '10:00', min: 60 } }),
  ];

  const avisos = [
    { id: 'n1', para: 'adan', cuando: hace(0.05), leido: false, tipo: 'cierre', texto: 'Paco cerró «Copys de redes Leadso».', actividad: 'a15' },
    { id: 'n2', para: 'adan', cuando: hace(0.6), leido: true, tipo: 'asignacion', texto: 'Carlos te asignó «Deck de 5 láminas».', actividad: 'a2' },
  ];

  const personal = {
    adan: {
      archivos: [
        { id: 'f1', titulo: 'Drive Spark', url: 'https://drive.google.com/' },
        { id: 'f2', titulo: 'Master Entregables', url: 'https://www.notion.so/' },
        { id: 'f3', titulo: 'Tablero de KPIs', url: 'https://drive.google.com/' },
      ],
      pendientes: [
        { id: 'p1', texto: 'Leer Scaling Up, cap. 3', hecho: false },
        { id: 'p2', texto: 'Ordenar facturas del mes', hecho: false },
        { id: 'p3', texto: 'Respaldo de la Mac', hecho: true },
      ],
      nota: 'Llevar a la daily: estado del DNS y del portal.',
    },
  };

  return { version: 2, creado: H, personas, clientes, proyectos, actividades, avisos, personal, layouts: {}, papeleraDias: 30 };
}
