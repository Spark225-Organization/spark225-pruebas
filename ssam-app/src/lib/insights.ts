import {
  Lightbulb,
  AlertTriangle,
  Clock,
  User,
  Repeat,
  MessageSquare,
} from "lucide-react";
import type { MaterialMetric } from "@/lib/api-types";
import { statusLabel, type MaterialStatus } from "@/lib/statusModel";

export interface Insight {
  id: string;
  text: string;
  icon: React.ElementType;
  tone: "amber" | "red" | "navy" | "primary" | "slate";
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeInsights(metrics: MaterialMetric[]): Insight[] {
  if (metrics.length < 3) return [];
  const out: Insight[] = [];

  // 1) % del tiempo de cola de Spark225
  const withCola = metrics.filter(
    (m) => m.dias_en_cola != null && m.ciclo_dias != null && m.ciclo_dias > 0,
  );
  if (withCola.length) {
    const colaPct =
      withCola.reduce(
        (acc, m) => acc + (m.dias_en_cola! / m.ciclo_dias!) * 100,
        0,
      ) / withCola.length;
    if (colaPct > 8) {
      const client = topClient(withCola);
      out.push({
        id: "cola",
        text: `El ${Math.round(colaPct)}% del tiempo de ciclo es cola de Spark225 antes de iniciar${
          client ? ` (más marcado en ${client})` : ""
        }.`,
        icon: Clock,
        tone: colaPct > 25 ? "red" : "amber",
      });
    }
  }

  // 2) Revisiones del cliente promedian N días
  const revisions = metrics.filter((m) => (m.dias_cliente ?? 0) > 0);
  if (revisions.length) {
    const avg =
      revisions.reduce((acc, m) => acc + (m.dias_cliente ?? 0), 0) /
      revisions.length;
    out.push({
      id: "rev",
      text: `Las revisiones del cliente promedian ${round1(avg)} días.`,
      icon: Lightbulb,
      tone: avg > 7 ? "amber" : "navy",
    });
  }

  // 3) Etapa más lenta
  const byStage: Record<string, number[]> = {};
  for (const m of metrics) {
    const key = m.status;
    if (m.ciclo_dias != null) (byStage[key] ||= []).push(0);
  }
  // Use dias_spark225/dias_cliente/dias_regulatorio grouping via stage names
  const stageMap: Record<string, number> = {};
  for (const m of metrics) {
    const s = m.status;
    const dias =
      (m.dias_spark225 ?? 0) +
      (m.dias_cliente ?? 0) +
      (m.dias_regulatorio ?? 0);
    if (dias > 0) stageMap[s] = (stageMap[s] ?? 0) + dias;
  }
  const slowEntry = Object.entries(stageMap).sort((a, b) => b[1] - a[1])[0];
  if (slowEntry) {
    out.push({
      id: "slow",
      text: `La etapa más lenta es ${statusLabel(slowEntry[0] as MaterialStatus)} con ${round1(
        slowEntry[1] / metrics.length,
      )} días en promedio.`,
      icon: Clock,
      tone: "slate",
    });
  }

  // 4) Responsable sobrecargado
  const byResp: Record<string, number> = {};
  for (const m of metrics) {
    if (
      m.responsible_name &&
      m.status !== "aprobado" &&
      m.status !== "archivado"
    )
      byResp[m.responsible_name] = (byResp[m.responsible_name] ?? 0) + 1;
  }
  const respVals = Object.values(byResp);
  if (respVals.length) {
    const avgResp = respVals.reduce((a, b) => a + b, 0) / respVals.length;
    const top = Object.entries(byResp).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= avgResp * 1.8) {
      out.push({
        id: "load",
        text: `${top[0]} tiene ${top[1]} materiales activos, el doble del promedio del equipo.`,
        icon: User,
        tone: "amber",
      });
    }
  }

  // 5) Cambios de fecha
  const cambios = metrics.filter((m) => (m.cambios_fecha ?? 0) > 0);
  if (cambios.length) {
    const total = cambios.reduce((a, m) => a + (m.cambios_fecha ?? 0), 0);
    const spark = cambios.reduce(
      (a, m) => a + (m.cambios_fecha_spark225 ?? 0),
      0,
    );
    const pct = Math.round((spark / total) * 100);
    out.push({
      id: "cambios",
      text: `${total} cambios de fecha este periodo; el ${pct}% atribuibles a Spark225.`,
      icon: Repeat,
      tone: "slate",
    });
  }

  // 6) Motivo de devolución más frecuente — approx via rechazos
  const rechazos = metrics.filter((m) => (m.rechazos ?? 0) > 0);
  if (rechazos.length) {
    out.push({
      id: "rechazos",
      text: `${rechazos.length} materiales han sido rechazados al menos una vez este periodo.`,
      icon: MessageSquare,
      tone: "red",
    });
  }

  return out.slice(0, 5);
}

function topClient(rows: MaterialMetric[]): string | null {
  const byClient: Record<string, number> = {};
  for (const r of rows) {
    if (r.client_name)
      byClient[r.client_name] =
        (byClient[r.client_name] ?? 0) + (r.dias_en_cola ?? 0);
  }
  const top = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? null;
}

export { median };
