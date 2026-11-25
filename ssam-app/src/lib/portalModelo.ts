// Modelo del portal del cliente: cómo se agrupan los materiales en lenguaje
// del cliente, qué cuenta en cada indicador y qué se le pide a él.
import type { Material, MaterialMetric, MaterialForecast } from "@/lib/api-types";

/** Momento del material visto por el cliente (en orden). */
export type Momento =
  | "revisar"      // espera su aprobación
  | "desarrollo"   // Spark225 lo está trabajando
  | "regulatorio"  // sometido / aprobación interna del laboratorio
  | "producir"     // aprobado, falta producirlo
  | "entregar"     // en producción o con paquete pendiente
  | "entregado";   // paquete final entregado o implementado

export const MOMENTOS: { id: Momento; nombre: string; corto: string; color: string }[] = [
  { id: "revisar", nombre: "Esperan tu revisión", corto: "Por revisar", color: "#E37439" },
  { id: "desarrollo", nombre: "En desarrollo", corto: "En desarrollo", color: "#4E5964" },
  { id: "regulatorio", nombre: "En aprobación regulatoria", corto: "Regulatorio", color: "#7A6FB0" },
  { id: "producir", nombre: "Aprobados por producirse", corto: "Por producirse", color: "#D99A12" },
  { id: "entregar", nombre: "Por entregarse", corto: "Por entregarse", color: "#2F7FB8" },
  { id: "entregado", nombre: "Entregados", corto: "Entregados", color: "#2E9E5B" },
];

export function momento(m: Material): Momento {
  const s = m.status;
  if (s === "aprobacion_cliente_medico" || s === "aprobacion_cliente_grafico") return "revisar";
  if (s === "sometimiento_final" || s === "crc") return "regulatorio";
  if (m.paquete_final_entregado_at || s === "implementado") return "entregado";
  if (s === "produccion") return "entregar";
  if (s === "aprobado") return m.codigos_registrados_at ? "entregar" : "producir";
  return "desarrollo";
}

/** Qué se le pide al cliente en este momento (vacío si nada). */
export function teToca(m: Material): string {
  const s = m.status;
  if (s === "aprobacion_cliente_medico") return "Revisar y aprobar el contenido médico";
  if (s === "aprobacion_cliente_grafico") return "Revisar y aprobar el diseño";
  if (s === "sometimiento_final" || s === "crc") return "Registrar los códigos de aprobación";
  if (!m.fecha_requerida_cliente && momento(m) !== "entregado") return "Indicar la fecha que lo necesitas";
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

/** Cuándo lo va a recibir: pronóstico si existe, si no la fecha comprometida. */
export function cuandoLlega(m: Material, fc?: MaterialForecast): string | null {
  if (momento(m) === "entregado") return m.paquete_final_entregado_at ?? null;
  return fc?.entrega_estimada ?? m.fecha_comprometida ?? null;
}

export interface Indicadores {
  total: number;
  revisar: number;
  aprobadosATiempo: number;
  aprobados: number;
  producir: number;
  entregar: number;
  entregados: number;
  desarrollo: number;
}

export function indicadores(ms: Material[], metricas: Record<string, MaterialMetric | undefined>): Indicadores {
  const by = (x: Momento) => ms.filter((m) => momento(m) === x).length;
  const aprob = ms.filter((m) => ["producir", "entregar", "entregado"].includes(momento(m)));
  const aTiempo = aprob.filter((m) => {
    const met = metricas[m.id];
    if (met?.a_tiempo_vs_requerida != null) return met.a_tiempo_vs_requerida;
    if (met?.a_tiempo != null) return met.a_tiempo;
    return true;
  });
  return {
    total: ms.length,
    revisar: by("revisar"),
    desarrollo: by("desarrollo") + by("regulatorio"),
    aprobados: aprob.length,
    aprobadosATiempo: aTiempo.length,
    producir: by("producir"),
    entregar: by("entregar"),
    entregados: by("entregado"),
  };
}

/** Motivos de cambio: mismos valores que el catálogo motivo_devolucion de la base. */
export const MOTIVOS_CAMBIO: { id: string; nombre: string; ayuda: string }[] = [
  { id: "ortografia_redaccion", nombre: "Ortografía o redacción", ayuda: "Typos, acentos, puntuación o frases poco claras." },
  { id: "referencias_incorrectas", nombre: "Referencias", ayuda: "Cita, número de referencia o formato del laboratorio." },
  { id: "contenido_no_sustentado", nombre: "Contenido médico", ayuda: "Un dato, claim o indicación que no está respaldado." },
  { id: "texto_faltante", nombre: "Falta texto o leyenda", ayuda: "Leyendas regulatorias, IPP, registro o datos que faltan." },
  { id: "error_diseno", nombre: "Error de diseño", ayuda: "Colores, logo, tipografía o elementos fuera de lugar." },
  { id: "cambio_diseno_solicitado", nombre: "Cambio de diseño", ayuda: "Ajuste de estilo, colores o composición que prefieres." },
  { id: "otro", nombre: "Petición adicional u otro", ayuda: "Algo nuevo que no estaba en la solicitud original." },
];
