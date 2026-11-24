import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  User,
  Repeat,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel, type MaterialStatus } from "@/lib/statusModel";
import { r1, median, pct } from "@/lib/reportMath";
import type { MaterialMetric } from "@/lib/api-types";

export type InsightTone = "amber" | "red" | "navy" | "primary" | "slate";

export interface Insight {
  id: string;
  text: string;
  icon: React.ElementType;
  tone: InsightTone;
}

const TONE_BORDER: Record<InsightTone, string> = {
  amber: "border-l-[#F5C245] bg-[#F5C245]/10",
  red: "border-l-[#D64545] bg-[#D64545]/10",
  navy: "border-l-[#0E1E2A] bg-[#0E1E2A]/10",
  primary: "border-l-[#E37439] bg-[#E37439]/10",
  slate: "border-l-[#4E5964] bg-[#4E5964]/10",
};

const TONE_ICON: Record<InsightTone, string> = {
  amber: "text-[#B5840A]",
  red: "text-[#D64545]",
  navy: "text-[#0E1E2A]",
  primary: "text-[#E37439]",
  slate: "text-[#4E5964]",
};

export const InsightRow = ({ ins }: { ins: Insight }) => (
  <div
    className={cn(
      "flex items-start gap-3 rounded-r-[10px] border-l-[3px] px-4 py-2.5",
      TONE_BORDER[ins.tone],
    )}
  >
    <ins.icon className={cn("h-4 w-4 mt-0.5 shrink-0", TONE_ICON[ins.tone])} />
    <span className="text-sm text-[#1F2124]">{ins.text}</span>
  </div>
);

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

export function computeInsights(metrics: MaterialMetric[]): Insight[] {
  if (metrics.length < 3) return [];
  const out: Insight[] = [];

  // 1) Cola de Spark225
  const withCola = metrics.filter(
    (m) => m.dias_en_cola != null && m.ciclo_dias != null && m.ciclo_dias > 0,
  );
  if (withCola.length) {
    const colaPct = (withCola.reduce(
      (acc, m) => acc + ((m.dias_en_cola ?? 0) / (m.ciclo_dias ?? 1)) * 100,
      0,
    ) / withCola.length) as number;
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

  // 2) Revisiones del cliente
  const revisions = metrics.filter((m) => (m.dias_cliente ?? 0) > 0);
  if (revisions.length) {
    const avg =
      revisions.reduce((acc, m) => acc + (m.dias_cliente ?? 0), 0) /
      revisions.length;
    out.push({
      id: "rev",
      text: `Las revisiones del cliente promedian ${r1(avg)} días.`,
      icon: Lightbulb,
      tone: avg > 7 ? "amber" : "navy",
    });
  }

  // 3) Etapa más lenta
  const stageMap: Record<string, number> = {};
  for (const m of metrics) {
    const dias =
      (m.dias_spark225 ?? 0) +
      (m.dias_cliente ?? 0) +
      (m.dias_regulatorio ?? 0);
    if (dias > 0) stageMap[m.status] = (stageMap[m.status] ?? 0) + dias;
  }
  const slow = Object.entries(stageMap).sort((a, b) => b[1] - a[1])[0];
  if (slow) {
    out.push({
      id: "slow",
      text: `La etapa más lenta es ${statusLabel(
        slow[0] as MaterialStatus,
      )} con ${r1(slow[1] / metrics.length)} días en promedio.`,
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
    out.push({
      id: "cambios",
      text: `${total} cambios de fecha este periodo; ${pct(
        spark,
        total,
      )}% atribuibles a Spark225.`,
      icon: Repeat,
      tone: "slate",
    });
  }

  // 6) Rechazos
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

export interface ClientAgg {
  id: string;
  name: string;
  activos: number;
  aTiempo: number;
  total: number;
  ciclo: number[];
  primera: number;
  spark: number;
  cliente: number;
  reg: number;
  alertas: number;
}

export function aggregateByClient(
  metrics: MaterialMetric[],
  alertas: { client_id?: string | null }[],
): ClientAgg[] {
  const map: Record<string, ClientAgg> = {};
  for (const m of metrics) {
    const key = m.client_id ?? "__s";
    if (!map[key])
      map[key] = {
        id: key,
        name: m.client_name ?? "Sin cliente",
        activos: 0,
        aTiempo: 0,
        total: 0,
        ciclo: [],
        primera: 0,
        spark: 0,
        cliente: 0,
        reg: 0,
        alertas: 0,
      };
    const c = map[key];
    c.total++;
    if (m.status !== "aprobado" && m.status !== "archivado") c.activos++;
    if (m.a_tiempo) c.aTiempo++;
    if (m.ciclo_dias != null) c.ciclo.push(m.ciclo_dias);
    if (m.aprobado_primera_ronda) c.primera++;
    c.spark += m.dias_spark225 ?? 0;
    c.cliente += m.dias_cliente ?? 0;
    c.reg += m.dias_regulatorio ?? 0;
  }
  for (const a of alertas) {
    const key = a.client_id ?? "__s";
    if (map[key]) map[key].alertas++;
  }
  return Object.values(map);
}

export const ClientCard = ({ c }: { c: ClientAgg }) => {
  const aTiempoPct = pct(c.aTiempo, c.total);
  const cicloMed = r1(median(c.ciclo));
  const primeraPct = pct(c.primera, c.total);
  const total = c.spark + c.cliente + c.reg || 1;
  return (
    <Link
      to={`?cliente=${encodeURIComponent(c.id)}`}
      className="block rounded-[12px] border border-[#DBDBDB] bg-white p-4 shadow-soft transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-[#0E1E2A] truncate">{c.name}</h4>
        {c.alertas > 0 && (
          <Badge className="bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25">
            {c.alertas} alerta{c.alertas > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <MiniStat label="Activos" value={c.activos} />
        <MiniStat label="% a tiempo" value={`${aTiempoPct}%`} />
        <MiniStat label="Ciclo" value={`${cicloMed}d`} />
        <MiniStat label="1ª ronda" value={`${primeraPct}%`} />
      </div>
      <div className="mt-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="bg-[#E37439]"
            style={{ width: `${(c.spark / total) * 100}%` }}
          />
          <div
            className="bg-[#4E5964]"
            style={{ width: `${(c.cliente / total) * 100}%` }}
          />
          <div
            className="bg-[#9AA3AD]"
            style={{ width: `${(c.reg / total) * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          <span>Spark225 {r1(c.spark)}d</span>
          <span>Cliente {r1(c.cliente)}d</span>
          <span>Reg. {r1(c.reg)}d</span>
        </div>
      </div>
    </Link>
  );
};

const MiniStat = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-[8px] bg-[#F8F9FA] py-1.5">
    <p className="text-sm font-extrabold text-[#0E1E2A]">{value}</p>
    <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
  </div>
);

export function useClientAgg(
  metrics: MaterialMetric[],
  alertas: { client_id?: string | null }[],
) {
  return useMemo(() => aggregateByClient(metrics, alertas), [metrics, alertas]);
}
