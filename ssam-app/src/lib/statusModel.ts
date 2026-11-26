// Status model aligned with the new 14-value material_status enum in the database.
// Order: ideacion, desarrollo_medico, revision_direccion, aprobacion_cliente_medico,
// desarrollo_grafico, revision_direccion_grafico, validacion_medica_final,
// aprobacion_cliente_grafico, sometimiento_final, crc, aprobado, produccion,
// implementado, archivado

import type { Client, Material, CommitmentDateChange } from "@/lib/api-types";

export const MATERIAL_STATUSES = [
  "ideacion",
  "desarrollo_medico",
  "revision_direccion",
  "aprobacion_cliente_medico",
  "desarrollo_grafico",
  "revision_direccion_grafico",
  "validacion_medica_final",
  "aprobacion_cliente_grafico",
  "sometimiento_final",
  "crc",
  "aprobado",
  "produccion",
  "implementado",
  "archivado",
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const STATUS_INDEX: Record<MaterialStatus, number> = {
  ideacion: 0,
  desarrollo_medico: 1,
  revision_direccion: 2,
  aprobacion_cliente_medico: 3,
  desarrollo_grafico: 4,
  revision_direccion_grafico: 5,
  validacion_medica_final: 6,
  aprobacion_cliente_grafico: 7,
  sometimiento_final: 8,
  crc: 9,
  aprobado: 10,
  produccion: 11,
  implementado: 12,
  archivado: 13,
};

const STATUS_LABELS: Record<MaterialStatus, string> = {
  ideacion: "Ideación",
  desarrollo_medico: "Desarrollo médico",
  revision_direccion: "Revisión de dirección",
  aprobacion_cliente_medico: "Aprobación cliente (médico)",
  desarrollo_grafico: "Desarrollo gráfico",
  revision_direccion_grafico: "Revisión de dirección gráfica",
  validacion_medica_final: "Validación médica final",
  aprobacion_cliente_grafico: "Aprobación cliente (gráfico)",
  sometimiento_final: "Sometimiento final",
  crc: "Aprobación",
  aprobado: "Aprobado",
  produccion: "Producción",
  implementado: "Implementado",
  archivado: "Archivado",
};

const STATUS_SHORT_LABELS: Record<MaterialStatus, string> = {
  ideacion: "Ideación",
  desarrollo_medico: "Des. médico",
  revision_direccion: "Rev. dirección",
  aprobacion_cliente_medico: "Aprob. cliente (médico)",
  desarrollo_grafico: "Des. gráfico",
  revision_direccion_grafico: "Rev. dirección gráfica",
  validacion_medica_final: "Validación médica",
  aprobacion_cliente_grafico: "Aprob. cliente (gráfico)",
  sometimiento_final: "Sometimiento",
  crc: "Aprobación",
  aprobado: "Aprobado",
  produccion: "Producción",
  implementado: "Implementado",
  archivado: "Archivado",
};

// "crc" se muestra como "Aprobación: " + la etiqueta de código interno del cliente.
export function statusLabel(
  status: MaterialStatus,
  client?: Client | null,
): string {
  if (status === "crc") {
    const etiqueta = client?.etiqueta_codigo_interno?.trim();
    return etiqueta ? `Aprobación: ${etiqueta}` : "Aprobación";
  }
  return STATUS_LABELS[status] ?? status;
}

export function statusShortLabel(status: MaterialStatus): string {
  return STATUS_SHORT_LABELS[status] ?? status;
}

// Columnas del Kanban: todos los estatus en orden, Archivado oculto por defecto.
export const KANBAN_STATUSES: MaterialStatus[] = MATERIAL_STATUSES.filter(
  (s) => s !== "archivado",
);
export const HIDDEN_KANBAN_STATUSES: MaterialStatus[] = ["archivado"];

// "Depende de": calculado a partir del estatus (espejo de la función DB depende_de).
export type Dependencia = "spark225" | "cliente" | "cliente_regulatorio";

export const DEPENDE_DE_META: Record<
  Dependencia,
  { label: string; classes: string }
> = {
  spark225: {
    // label sin el prefijo "Depende de:" — el badge lo agrega una sola vez
    label: "Spark225",
    classes: "bg-[#E37439]/12 text-[#E37439] border border-[#E37439]/25",
  },
  cliente: {
    label: "Cliente",
    classes: "bg-[#4E5964]/12 text-[#4E5964] border border-[#4E5964]/25",
  },
  cliente_regulatorio: {
    label: "Cliente · Regulatorio",
    classes: "bg-[#4E5964]/12 text-[#4E5964] border border-[#4E5964]/25",
  },
};

export function dependeDe(status: string): Dependencia {
  switch (status) {
    case "aprobacion_cliente_medico":
    case "aprobacion_cliente_grafico":
      return "cliente";
    case "crc":
    case "produccion":
    case "implementado":
      return "cliente_regulatorio";
    default:
      return "spark225";
  }
}

// Portal del cliente: 6 pasos (Planeado, En desarrollo, En revisión cliente,
// Aprobación regulatoria, Aprobado, Producción e implementación).
export const CLIENT_STEPS = [
  "Planeado",
  "En desarrollo",
  "En revisión cliente",
  "Aprobación regulatoria",
  "Aprobado",
  "Producción e implementación",
] as const;

export function clientStepIndex(status: string): number {
  switch (status) {
    case "ideacion":
      return 0;
    case "desarrollo_medico":
    case "revision_direccion":
    case "desarrollo_grafico":
    case "revision_direccion_grafico":
    case "validacion_medica_final":
      return 1;
    case "aprobacion_cliente_medico":
    case "aprobacion_cliente_grafico":
      return 2;
    case "sometimiento_final":
    case "crc":
      return 3;
    case "aprobado":
      return 4;
    case "produccion":
    case "implementado":
      return 5;
    default:
      return 0;
  }
}

// ─── FASE 2A: etiquetas de etapa en lenguaje para el cliente ─────────────────
// El cliente no ve los estatus internos (14 valores); ve 5 categorías simples.
// En desarrollo / Listo para tu revisión / En ajustes / Aprobado / Sometido.
const CLIENT_STATUS_LABELS: Record<string, string> = {
  ideacion: "Planeado",
  desarrollo_medico: "En desarrollo",
  revision_direccion: "En desarrollo",
  aprobacion_cliente_medico: "Listo para tu revisión",
  desarrollo_grafico: "En desarrollo",
  revision_direccion_grafico: "En desarrollo",
  validacion_medica_final: "En desarrollo",
  aprobacion_cliente_grafico: "Listo para tu revisión",
  sometimiento_final: "Sometido",
  crc: "Sometido",
  aprobado: "Aprobado",
  produccion: "En producción",
  implementado: "Implementado",
  archivado: "Archivado",
};

/** Etiqueta de etapa en lenguaje para el cliente (5 categorías). */
export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? "En desarrollo";
}

/** ¿Está el material en una etapa de aprobación del cliente? */
export function isClienteAprobacion(status: string): boolean {
  return (
    status === "aprobacion_cliente_medico" ||
    status === "aprobacion_cliente_grafico"
  );
}

export function isFechaVencida(
  fechaComprometida: string | null,
  status: string,
): boolean {
  if (!fechaComprometida) return false;
  if (
    status === "aprobado" ||
    status === "produccion" ||
    status === "implementado" ||
    status === "archivado"
  ) {
    return false;
  }
  return new Date(fechaComprometida) < new Date(new Date().toDateString());
}

// En riesgo: fecha comprometida dentro de los próximos 3 días y no aprobada.
export function isFechaEnRiesgo(
  fechaComprometida: string | null,
  status: string,
): boolean {
  if (!fechaComprometida) return false;
  if (
    status === "aprobado" ||
    status === "produccion" ||
    status === "implementado" ||
    status === "archivado"
  ) {
    return false;
  }
  if (isFechaVencida(fechaComprometida, status)) return false;
  const fecha = new Date(fechaComprometida);
  const hoy = new Date(new Date().toDateString());
  const diff = (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

// Paquete final atrasado: han pasado más de 24 h desde el registro de códigos
// y el paquete no está completo.
export function isPaqueteAtrasado(
  codigosRegistradosAt: string | null,
  paqueteCompleto: boolean,
): boolean {
  if (!codigosRegistradosAt || paqueteCompleto) return false;
  const diffMs = Date.now() - new Date(codigosRegistradosAt).getTime();
  return diffMs > 24 * 60 * 60 * 1000;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  // Una fecha sola (AAAA-MM-DD) se lee como mediodía local: si no, en México
  // se mostraba un día antes (se interpretaba como medianoche UTC).
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Re-export para conveniencia de los consumidores que usan el tipo Material.
export type { Material, CommitmentDateChange };
