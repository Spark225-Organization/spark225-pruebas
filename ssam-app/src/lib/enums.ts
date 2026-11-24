// ─── Enum values centralizados (esquema real, valores en español) ───────────
// La base de datos usa enums con valores en español. Estas constantes tipadas
// son la ÚNICA fuente de verdad para comparaciones en toda la app; las
// pantallas deben importarlas en vez de comparar contra strings literales en
// inglés (active, pending, approved, etc.) que NO existen en el esquema.

/** entity_status: clients.estado, products.estado, indications.estado,
 *  business_units.estado, profiles.estado.
 *  Valores reales: "activo" | "inactivo". */
export const ENTITY_STATUS = {
  ACTIVO: "activo",
  INACTIVO: "inactivo",
} as const;
export type EntityStatus = (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];

/** ¿Es una entidad activa? Único selector para toda la app.
 *  Acepta el enum español ("activo"/"inactivo") y, por tolerancia, el inglés
 *  legacy ("active"/"inactive"); null se trata como activo (no penalizar). */
export function isEntityActive(s: string | null | undefined): boolean {
  if (!s) return true;
  const v = String(s).toLowerCase();
  return v === "activo" || v === "active";
}

/** ¿Es un cliente activo? Único selector para toda la app. */
export function isClienteActivo(
  c: { status?: string | null } | null | undefined,
): boolean {
  if (!c) return false;
  return isEntityActive(c.status);
}

/** material_status: 14 valores (espejo de statusModel.MATERIAL_STATUSES). */
export const MATERIAL_STATUS = {
  IDEACION: "ideacion",
  DESARROLLO_MEDICO: "desarrollo_medico",
  REVISION_DIRECCION: "revision_direccion",
  APROBACION_CLIENTE_MEDICO: "aprobacion_cliente_medico",
  DESARROLLO_GRAFICO: "desarrollo_grafico",
  REVISION_DIRECCION_GRAFICO: "revision_direccion_grafico",
  VALIDACION_MEDICA_FINAL: "validacion_medica_final",
  APROBACION_CLIENTE_GRAFICO: "aprobacion_cliente_grafico",
  SOMETIMIENTO_FINAL: "sometimiento_final",
  CRC: "crc",
  APROBADO: "aprobado",
  PRODUCCION: "produccion",
  IMPLEMENTADO: "implementado",
  ARCHIVADO: "archivado",
} as const;

/** Estatus terminales (ya entregados/cerrados). */
export const TERMINAL_STATUS_VALUES = new Set<string>([
  MATERIAL_STATUS.APROBADO,
  MATERIAL_STATUS.PRODUCCION,
  MATERIAL_STATUS.IMPLEMENTADO,
  MATERIAL_STATUS.ARCHIVADO,
]);

/** estado_pronostico (v_material_forecast). */
export const ESTADO_PRONOSTICO = {
  A_TIEMPO: "a_tiempo",
  JUSTO: "justo",
  TARDE: "tarde",
  SIN_FECHA: "sin_fecha",
} as const;

/** tipo de hito (v_material_timeline). */
export const TIMELINE_TIPO = {
  HECHO: "hecho",
  EN_CURSO: "en_curso",
  ESTIMADO: "estimado",
} as const;

/** depende_de (v_material_forecast / v_material_timeline). */
export const DEPENDE_DE = {
  SPARK225: "spark225",
  CLIENTE: "cliente",
  CLIENTE_REGULATORIO: "cliente_regulatorio",
} as const;

/** Categoría de cambio de fecha (commitment_date_changes.categoria). */
export const FECHA_CATEGORIA = {
  SPARK225: "spark225",
  CLIENTE: "cliente",
  REGULATORIO: "regulatorio",
  CAMBIO_ALCANCE: "cambio_alcance",
  OTRO: "otro",
} as const;
export type FechaCategoria =
  "spark225" | "cliente" | "regulatorio" | "cambio_alcance" | "otro";
