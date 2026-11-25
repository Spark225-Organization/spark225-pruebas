// API types matching the existing Supabase schema.
// These mirror the tables/views described in the database.

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  etiqueta_codigo_interno: string | null;
  etiqueta_codigo_regulatorio: string | null;
  etiqueta_sistema_aprobacion: string | null;
  especificaciones_impresion_default: string | null;
  // Esquema real: clients.estado es enum entity_status (activo/inactivo).
  // Mapeamos estado→status; el valor es "activo" | "inactivo" | null.
  status: "activo" | "inactivo" | "active" | "inactive" | null;
  created_at?: string;
}

export type ClientLabelPatch = Pick<
  Client,
  | "etiqueta_codigo_interno"
  | "etiqueta_codigo_regulatorio"
  | "etiqueta_sistema_aprobacion"
  | "especificaciones_impresion_default"
>;

export interface Product {
  id: string;
  name: string;
  client_id: string;
  client_name: string | null;
  category: string | null;
  status: "activo" | "inactivo" | "active" | "discontinued" | null;
  active_materials: number | null;
  created_at?: string;
}

export interface Indication {
  id: string;
  name: string;
  status: "activo" | "inactivo" | "active" | "inactive" | null;
  materials_count: number | null;
  created_at?: string;
}

export interface Material {
  id: string;
  folio?: number | null;
  name: string;
  client_id: string | null;
  client_name: string | null;
  product_id: string | null;
  product_name: string | null;
  indication_id: string | null;
  indication_name: string | null;
  status: string;
  responsible_id: string | null;
  responsible_name: string | null;
  version: string | null;
  fecha_comprometida: string | null;
  // Fecha que necesita el cliente (la captura el Cliente Externo desde su
  // portal, o el Admin en su nombre). Independiente de fecha_comprometida
  // (la compromete el rol Creativo/Diseño). Los KPIs de cumplimiento se
  // miden contra este campo.
  fecha_requerida_cliente: string | null;
  // Motivo del último cambio a fecha_requerida_cliente (texto libre).
  motivo_fecha_requerida?: string | null;
  // Switch de visibilidad del material hacia el cliente (portal). Sin este
  // switch activo, el cliente no ve el material. Lo maneja el lado interno.
  visible_para_cliente?: boolean | null;
  codigo_aprobacion_interna: string | null;
  codigo_regulatorio: string | null;
  id_sistema_aprobacion: string | null;
  codigos_registrados_at: string | null;
  paquete_final_entregado_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  status: "activo" | "inactivo" | "active" | "inactive" | "away" | null;
  avatar: string | null;
  created_at?: string;
}

export interface CommitmentDateChange {
  id: string;
  material_id: string;
  fecha_anterior: string | null;
  fecha_nueva: string;
  motivo: string;
  changed_by: string;
  changed_by_name: string | null;
  changed_at: string;
}

export interface FinalPackageItem {
  id: string;
  material_id: string;
  item_name?: string | null;
  detalle?: string | null;
  delivered?: boolean;
  entregado?: boolean;
  delivered_by?: string | null;
  entregado_by?: string | null;
  delivered_by_name?: string | null;
  entregado_by_name?: string | null;
  delivered_at?: string | null;
  entregado_at?: string | null;
}

export interface Comment {
  id: string;
  material_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  // Esquema real: comments.visibilidad es un enum con valores
  // "interno" (solo Spark225) | "visible_para_cliente".
  // El cliente solo ve los visible_para_cliente (RLS + filtro en el portal).
  // El frontend mapea visibilidad→interno (booleano) para compatibilidad.
  interno?: boolean | null;
  visibilidad?: "interno" | "visible_para_cliente" | null;
  // Ancla el comentario a una versión de archivo específica (file_versions.id).
  version_id?: string | null;
  // Respuesta a otro comentario (hilo).
  parent_id?: string | null;
  // El cliente marca que su comentario requiere un cambio (devolución).
  requiere_cambio?: boolean | null;
  // Estado del comentario (ej. abierto / resuelto).
  estado?: string | null;
  // Adjunto que el cliente sube con su comentario (URL en Storage/externa).
  adjunto_url?: string | null;
  adjunto_name?: string | null;
}

// Registro inmutable de cada decisión (aprobar / solicitar cambios) sobre una
// versión específica. Esquema real: tabla `approvals`
// (id, material_id, stage, decision[approval_decision enum], approver_id,
//  comentario, version_id [añadida por fase_real.sql], created_at).
// `usuario`/`usuario_name` se resuelven desde profiles vía approver_id.
export interface Approval {
  id: string;
  material_id: string;
  stage?: string | null;
  decision: "aprobado" | "cambios";
  approver_id?: string | null;
  /** Resuelto desde profiles(approver_id).nombre en el frontend. */
  usuario_name?: string | null;
  comentario?: string | null;
  /** Motivo del cambio (catálogo motivo_devolucion) cuando decision = cambios. */
  motivo?: string | null;
  version_id?: string | null;
  created_at: string;
}
// Alias legacy (algunos consumidores usaban ClientApproval).
export type ClientApproval = Approval;

export interface FileAsset {
  id: string;
  material_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
}

// Vista client_materials: acceso de solo lectura para el portal del cliente.
export interface ClientMaterial {
  id: string;
  name: string;
  product_name: string | null;
  status: string;
  fecha_comprometida: string | null;
  codigo_aprobacion_interna: string | null;
  codigo_regulatorio: string | null;
  id_sistema_aprobacion: string | null;
  etiqueta_codigo_interno: string | null;
  etiqueta_codigo_regulatorio: string | null;
  etiqueta_sistema_aprobacion: string | null;
}

// Vista paquetes_pendientes: materiales con códigos registrados cuyo
// paquete final aún no se entrega completo.
export interface PaquetePendiente {
  id: string;
  name: string;
  client_name: string | null;
  codigos_registrados_at: string | null;
}

// Vista materiales_en_riesgo: materiales con paquete final atrasado o
// fecha comprometida vencida. Columnas reales de la vista:
// material_id, titulo, cliente_id, status, responsable_principal_id,
// responsable (texto del rol del SLA), riesgo (motivo), dias (atraso).
export interface MaterialRiesgo {
  material_id: string;
  titulo: string | null;
  cliente_id: string | null;
  status: string;
  responsable_principal_id: string | null;
  responsable: string | null;
  riesgo: string | null;
  dias: number | null;
}

// Vista v_material_metrics: una fila por material con todos los indicadores.
export interface MaterialMetric {
  material_id: string;
  folio?: number | null;
  name: string;
  client_id: string | null;
  client_name: string | null;
  product_id: string | null;
  product_name: string | null;
  indication_id: string | null;
  indication_name: string | null;
  responsible_id: string | null;
  responsible_name: string | null;
  status: string;
  fecha_comprometida: string | null;
  fecha_comprometida_original: string | null;
  a_tiempo: boolean | null;
  a_tiempo_vs_actual: boolean | null;
  a_tiempo_vs_original: boolean | null;
  ciclo_dias: number | null;
  rondas_con_cliente: number | null;
  aprobado_primera_ronda: boolean | null;
  rechazos: number | null;
  dias_spark225: number | null;
  dias_cliente: number | null;
  dias_regulatorio: number | null;
  dias_en_cola: number | null;
  horas_paquete: number | null;
  cambios_fecha: number | null;
  cambios_fecha_spark225: number | null;
  created_at: string | null;
  updated_at: string | null;
  aprobado_at?: string | null;
  fecha_solicitud?: string | null;
  bloqueos?: number | null;
  comentarios_abiertos?: number | null;
  dependencia: string | null;
  // Columnas nuevas (v_material_metrics):
  fecha_requerida_cliente?: string | null;
  a_tiempo_vs_requerida?: boolean | null;
  errores_spark?: number | null;
  cambios_pedidos_cliente?: number | null;
  aprobado_sin_error_spark?: boolean | null;
  dias_respuesta_cliente?: number | null;
  revisiones_crc?: number | null;
  crc_primera?: boolean | null;
  // Campos para la tarjeta de material entregado (pueden no estar en la vista;
  // si no vienen, se muestran como "—"):
  paquete_final_entregado_at?: string | null;
  codigo_aprobacion_interna?: string | null;
}

// Vista v_stage_durations: duración de cada etapa por material.
export interface StageDuration {
  material_id: string;
  material_name: string;
  client_name: string | null;
  status: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias: number | null;
  dias_en_cola: number | null;
  dias_trabajo: number | null;
  en_curso: boolean | null;
  depende_de: string | null;
}

// Tabla candado_events: registro de bloqueos de transición.
export interface CandadoEvent {
  id: string;
  material_id: string;
  status_destino?: string | null;
  mensaje?: string | null;
  created_at: string;
}

// Vista v_material_forecast: pronóstico de entrega por material activo.
export interface MaterialForecast {
  material_id: string;
  titulo: string | null;
  client_id: string | null;
  status: string;
  depende_de: string | null;
  dias_en_etapa: number | null;
  entrega_estimada: string | null;
  entrega_estimada_max: string | null;
  fecha_comprometida: string | null;
  fecha_requerida_cliente: string | null;
  margen_dias: number | null;
  estado_pronostico: "a_tiempo" | "justo" | "tarde" | "sin_fecha" | null;
  // Enriquecido en el frontend desde materials.folio / v_material_hierarchy:
  folio?: number | null;
  cliente?: string | null;
  producto?: string | null;
  indicacion?: string | null;
  responsable?: string | null;
}

// Vista v_material_hierarchy: cliente, unidad, producto, indicación,
// responsable y folio por material (subtítulos y responsable del dashboard).
export interface MaterialHierarchy {
  material_id: string;
  folio?: number | null;
  cliente: string | null;
  unidad: string | null;
  producto: string | null;
  indicacion: string | null;
  responsable: string | null;
}

// Vista v_material_timeline: hitos por material para la línea de tiempo
// del detalle (orden, status, etapa_cliente, depende_de, inicio, fin, tipo).
export interface TimelineStage {
  material_id: string;
  orden: number;
  status: string;
  etapa_cliente?: string | null;
  depende_de?: string | null;
  inicio: string | null;
  fin: string | null;
  tipo: "hecho" | "en_curso" | "estimado";
}

// Vista v_monthly_trend: volumen mensual solicitado vs aprobado.
export interface MonthlyTrend {
  mes: string;
  solicitados: number | null;
  aprobados: number | null;
}

// Vista v_workload: carga por responsable.
export interface WorkloadRow {
  responsible_id: string;
  responsible_name: string;
  activos: number | null;
  en_desarrollo: number | null;
}

// Vista business_units: unidades de negocio (agrupan clientes/productos).
export interface BusinessUnit {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  status?: "activo" | "inactivo" | "active" | "inactive" | null;
}

// Vista v_client_kpis: KPIs agregados por cliente (portal del cliente).
export interface ClientKpi {
  total: number | null;
  en_curso: number | null;
  aprobados: number | null;
  a_tiempo: number | null;
  a_tiempo_pct: number | null;
  ciclo_dias_mediana: number | null;
  paquete_24h_pct: number | null;
  en_cancha_cliente: number | null;
}

// Vista v_client_timeline: hitos por material (portal del cliente, Gantt).
export interface ClientTimelineRow {
  material_id: string;
  name: string;
  product_name: string | null;
  etapa: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias: number | null;
  fecha_comprometida: string | null;
}
