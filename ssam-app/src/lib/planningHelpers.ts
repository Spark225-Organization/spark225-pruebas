// Helpers específicos de la página de Planeación: agrupación por semana
// (lun–dom en America/Mexico_City), grupo de vencidos, conteos por estado
// de pronóstico y exportación CSV. Reutiliza los tipos de v_material_forecast
// y los helpers de fecha CDMX del dashboard de dirección.

import { startOfWeek, cdmxNow, cdmxDate } from "@/lib/mgmtHelpers";
import type { MaterialForecast } from "@/lib/api-types";

export type RangeKey = "4w" | "8w" | "all";

export function rangeWeeks(range: RangeKey): number {
  if (range === "4w") return 4;
  if (range === "8w") return 8;
  return 52; // "Todo": cubrimos el año adelante
}

export interface WeekBucket {
  start: Date;
  items: MaterialForecast[];
}
export interface WeekBuckets {
  vencidos: MaterialForecast[];
  weeks: WeekBucket[];
}

// Agrupa los forecast en semanas lun–dom (CDMX) dentro del rango, más un
// grupo inicial "Vencidos" con los de entrega_estimada anterior a hoy.
export function bucketWeeks(
  forecast: MaterialForecast[],
  weeks: number,
): WeekBuckets {
  const today = cdmxNow();
  const tMs = today.getTime();
  const monday = startOfWeek(today);
  const dateMs = (f: MaterialForecast) =>
    cdmxDate(f.entrega_estimada)?.getTime() ?? null;

  const vencidos = forecast
    .filter((f) => {
      const m = dateMs(f);
      return m != null && m < tMs;
    })
    .sort((a, b) => (dateMs(a) ?? 0) - (dateMs(b) ?? 0));

  const arr: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(monday);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    arr.push({
      start,
      items: forecast
        .filter((f) => {
          const m = dateMs(f);
          if (m == null) return false;
          if (m < tMs) return false; // ya están en vencidos
          const d = cdmxDate(f.entrega_estimada)!;
          return d >= start && d < end;
        })
        .sort((a, b) => (dateMs(a) ?? 0) - (dateMs(b) ?? 0)),
    });
  }
  return { vencidos, weeks: arr };
}

// Etiqueta del encabezado de cada semana: 'Semana del 26 oct al 1 nov'.
export function weekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `Semana del ${fmt(start)} al ${fmt(end)}`;
}

// ¿Es esta la semana que contiene hoy?
export function isThisWeek(start: Date): boolean {
  return start.getTime() === startOfWeek(cdmxNow()).getTime();
}

// Día de la semana + fecha exacta, ej. 'Sáb 31 oct' (CDMX).
export function dayLabel(dStr: string | null): string {
  if (!dStr) return "—";
  const d = cdmxDate(dStr) ?? new Date(dStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

// 'hace N d' a partir de dias_en_etapa.
export function haceStr(dias: number | null | undefined): string {
  if (dias == null) return "";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 d";
  return `hace ${Math.round(dias)} d`;
}

// Texto del margen con color: +12 d (verde), −63 d (rojo), 0–3 d (ámbar).
export function margenPill(
  margen: number | null | undefined,
): { text: string; cls: string; bg: string } | null {
  if (margen == null) return null;
  if (margen > 3)
    return {
      text: `+${margen} d`,
      cls: "text-[#2E9E5B]",
      bg: "bg-[#2E9E5B]/12",
    };
  if (margen < 0)
    return {
      text: `−${Math.abs(margen)} d`,
      cls: "text-[#D64545]",
      bg: "bg-[#D64545]/12",
    };
  return { text: `${margen} d`, cls: "text-[#B5840A]", bg: "bg-[#F5C245]/15" };
}

// Conteos por estado_pronostico para el pie de página.
export function estadoCounts(forecast: MaterialForecast[]) {
  const total = forecast.length;
  const aTiempo = forecast.filter(
    (f) => f.estado_pronostico === "a_tiempo",
  ).length;
  const justos = forecast.filter((f) => f.estado_pronostico === "justo").length;
  const tarde = forecast.filter((f) => f.estado_pronostico === "tarde").length;
  const sinFecha = forecast.filter(
    (f) => !f.fecha_requerida_cliente || f.estado_pronostico === "sin_fecha",
  ).length;
  return { total, aTiempo, justos, tarde, sinFecha };
}

// Exportación CSV con las mismas columnas de la vista Agenda.
export function exportCsv(rows: MaterialForecast[]) {
  const header = [
    "Entrega",
    "Entrega max",
    "Folio",
    "Material",
    "Cliente",
    "Producto",
    "Indicacion",
    "Etapa",
    "Responsable",
    "Lo necesita",
    "Margen dias",
    "Estado",
  ];
  const body = rows.map((f) => [
    f.entrega_estimada ?? "",
    f.entrega_estimada_max ?? "",
    f.folio ?? "",
    f.titulo ?? "",
    f.cliente ?? "",
    f.producto ?? "",
    f.indicacion ?? "",
    f.status ?? "",
    f.responsable ?? "",
    f.fecha_requerida_cliente ?? "",
    f.margen_dias ?? "",
    f.estado_pronostico ?? "",
  ]);
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...body].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planeacion_entregas.csv";
  a.click();
  URL.revokeObjectURL(url);
}
