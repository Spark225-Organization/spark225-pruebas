// Modelo del portal del cliente: cómo se agrupan los materiales en lenguaje
// del cliente, qué cuenta en cada indicador y qué se le pide a él.
import type { Material, MaterialMetric, MaterialForecast, Indication } from "@/lib/api-types";

/** Momento del material visto por el cliente, en orden cronológico estricto
 *  (acordado con Carlos el 25 nov 2026): por revisar → en desarrollo →
 *  aprobados → por producirse → entregados. */
export type Momento =
  | "revisar"      // espera su aprobación (médica o gráfica)
  | "desarrollo"   // Spark225 lo está trabajando
  | "aprobado"     // el cliente lo aprobó; falta su código de aprobación regulatoria
  | "producir"     // con código o en producción
  | "entregado";   // paquete final entregado o implementado

export const MOMENTOS: { id: Momento; nombre: string; corto: string; color: string }[] = [
  { id: "revisar", nombre: "Por revisar", corto: "Por revisar", color: "#E37439" },
  { id: "desarrollo", nombre: "En desarrollo", corto: "En desarrollo", color: "#4E5964" },
  { id: "aprobado", nombre: "Aprobados", corto: "Aprobados", color: "#7A6FB0" },
  { id: "producir", nombre: "Por producirse", corto: "Por producirse", color: "#D99A12" },
  { id: "entregado", nombre: "Entregados", corto: "Entregados", color: "#2E9E5B" },
];

export function momento(m: Material): Momento {
  const s = m.status;
  if (s === "aprobacion_cliente_medico" || s === "aprobacion_cliente_grafico") return "revisar";
  if (m.paquete_final_entregado_at || s === "implementado") return "entregado";
  if (s === "sometimiento_final" || s === "crc") return "aprobado";
  if (s === "aprobado") return m.codigos_registrados_at ? "producir" : "aprobado";
  if (s === "produccion") return "producir";
  return "desarrollo";
}

/** Posición del momento (0 a 4) para la barra de avance. */
export const momentoIndice = (m: Material) => MOMENTOS.findIndex((x) => x.id === momento(m));

/** ¿El paso k ya quedó atrás? «Por revisar» y «En desarrollo» se alternan en
 *  cada ronda, así que estando en desarrollo la revisión no cuenta como hecha. */
export const pasoHecho = (k: number, actual: number) => k < actual && !(k === 0 && actual === 1);

/** Qué se le pide al cliente en este momento (vacío si nada). */
export function teToca(m: Material): string {
  const s = m.status;
  if (s === "aprobacion_cliente_medico") return "Revisar y aprobar el contenido médico";
  if (s === "aprobacion_cliente_grafico") return "Revisar y aprobar el diseño";
  if (s === "sometimiento_final" || s === "crc") return "Registrar el código de aprobación";
  if (!m.fecha_requerida_cliente && momento(m) !== "entregado") return "Registrar la fecha requerida";
  return "";
}

const DIA = 86400000;
const hoy = () => new Date(new Date().toDateString());
export const diasHasta = (f?: string | null) =>
  f ? Math.round((new Date(f).getTime() - hoy().getTime()) / DIA) : null;

/** Semáforo contra la fecha que necesita el cliente. */
export function semaforo(m: Material): { label: string; tono: "verde" | "ambar" | "rojo" | "gris" } {
  if (momento(m) === "entregado") return { label: "Entregado", tono: "verde" };
  const ref = m.fecha_requerida_cliente ?? m.fecha_comprometida;
  const d = diasHasta(ref);
  if (d == null) return { label: "Sin fecha", tono: "gris" };
  if (d < 0) return { label: `Vencido hace ${-d} d`, tono: "rojo" };
  if (d <= 3) return { label: d === 0 ? "Vence hoy" : `Vence en ${d} d`, tono: "ambar" };
  return { label: "A tiempo", tono: "verde" };
}

export const TONO_CLASE: Record<string, string> = {
  verde: "bg-[#2E9E5B]/12 text-[#1E7D47]",
  ambar: "bg-[#F5C245]/25 text-[#8A6200]",
  rojo: "bg-[#D64545]/12 text-[#B23A3A]",
  gris: "bg-[#9AA3AD]/15 text-[#4E5964]",
};

/** Fecha estimada de entrega: pronóstico si existe; si no, la fecha comprometida. */
export function cuandoLlega(m: Material, fc?: MaterialForecast): string | null {
  if (momento(m) === "entregado") return m.paquete_final_entregado_at ?? null;
  return fc?.entrega_estimada ?? m.fecha_comprometida ?? null;
}

export interface Indicadores {
  total: number;
  revisar: number;
  desarrollo: number;
  aprobados: number;
  producir: number;
  entregados: number;
  /** Entregados a tiempo contra la fecha requerida (o la comprometida). */
  entregadosATiempo: number;
}

export function indicadores(ms: Material[], metricas: Record<string, MaterialMetric | undefined>): Indicadores {
  const by = (x: Momento) => ms.filter((m) => momento(m) === x).length;
  const entregados = ms.filter((m) => momento(m) === "entregado");
  const aTiempo = entregados.filter((m) => {
    const met = metricas[m.id];
    if (met?.a_tiempo_vs_requerida != null) return met.a_tiempo_vs_requerida;
    if (met?.a_tiempo != null) return met.a_tiempo;
    return true;
  });
  return {
    total: ms.length,
    revisar: by("revisar"),
    desarrollo: by("desarrollo"),
    aprobados: by("aprobado"),
    producir: by("producir"),
    entregados: entregados.length,
    entregadosATiempo: aTiempo.length,
  };
}

/** Categorías de rechazo (junta con Carlos, 25 nov 2026). El id es el valor
 *  del catálogo motivo_devolucion de la base; «solicitud_fuera_plan» se agrega
 *  con clientes-sql/05-junta-25nov.sql. Una sola categoría por rechazo, para
 *  que las estadísticas sumen el 100 %. */
export const MOTIVOS_RECHAZO: { id: string; nombre: string; ayuda: string }[] = [
  { id: "solicitud_fuera_plan", nombre: "Solicitud adicional fuera de plan", ayuda: "Algo nuevo que no estaba en la solicitud original." },
  { id: "referencias_incorrectas", nombre: "Error en referencias científicas", ayuda: "Cita, número de referencia, fuente o formato del laboratorio." },
  { id: "error_diseno", nombre: "Problema de diseño", ayuda: "Colores, logo, tipografía, composición o elementos fuera de lugar." },
  { id: "ortografia_redaccion", nombre: "Falla ortográfica", ayuda: "Errores de ortografía, acentos, puntuación o redacción." },
  { id: "otro", nombre: "Otro", ayuda: "Cualquier motivo distinto; descríbelo en el texto." },
];

/** Nombre legible de cualquier motivo guardado (incluye los del catálogo anterior). */
const MOTIVOS_ANTERIORES: Record<string, string> = {
  contenido_no_sustentado: "Contenido médico no sustentado",
  texto_faltante: "Falta texto o leyenda",
  cambio_diseno_solicitado: "Cambio de diseño solicitado",
};
export const nombreMotivo = (id?: string | null) =>
  !id ? "Sin categoría" : MOTIVOS_RECHAZO.find((x) => x.id === id)?.nombre ?? MOTIVOS_ANTERIORES[id] ?? id;

/** Indicaciones médicas registradas para un producto (tabla indications).
 *  Pendiente: completar con la tabla de indicaciones de Paco (junta 25 nov). */
export const INDICACIONES_PENDIENTE = "Pendiente: tabla de indicaciones de Paco";
export function indicacionesDe(productoId: string | null | undefined, todas: Indication[]): string[] {
  if (!productoId) return [];
  return todas
    .filter((i) => i.producto_id === productoId && (i.status ?? "activo") !== "inactivo" && !/^\[DEMO\]/.test(i.name))
    .map((i) => i.name)
    .sort((a, b) => a.localeCompare(b, "es"));
}
