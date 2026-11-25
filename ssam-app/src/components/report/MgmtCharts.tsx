import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Clock, User, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SPARK_COLORS, tooltipStyle, axisProps } from "@/lib/chartTheme";
import { EmptyReport } from "@/components/reportPrimitives";
import {
  statusLabel,
  MATERIAL_STATUSES,
  STATUS_INDEX,
  type MaterialStatus,
  dependeDe,
  type Dependencia,
} from "@/lib/statusModel";
import type {
  MaterialMetric,
  MonthlyTrend,
  MaterialForecast,
} from "@/lib/api-types";
import { r1, median, pct } from "@/lib/reportMath";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {};
for (const s of MATERIAL_STATUSES) STAGE_LABELS[s] = statusLabel(s);

const TERMINAL = new Set<MaterialStatus>([
  "aprobado",
  "produccion",
  "implementado",
  "archivado",
]);

const DEP_COLORS: Record<Dependencia, string> = {
  spark225: SPARK_COLORS.primary,
  cliente: "#1E3A5F",
  cliente_regulatorio: SPARK_COLORS.gray,
};

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
function fmtMesCorto(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

// ─── Ingreso vs aprobados por mes (6 meses) ────────────────────────────────────
export function IngresoVsAprobados6m({ data }: { data: MonthlyTrend[] }) {
  const last6 = data.slice(-6);
  return (
    <ChartCard
      title="Ingreso vs aprobados por mes"
      desc="Últimos 6 meses. Solicitados en gris azulado, aprobados en naranja."
    >
      {last6.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={last6}
            margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              vertical={false}
            />
            <XAxis dataKey="mes" {...axisProps} tickFormatter={fmtMesCorto} />
            <YAxis {...axisProps} width={32} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="solicitados"
              fill={SPARK_COLORS.slate}
              name="Solicitados"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="aprobados"
              fill={SPARK_COLORS.primary}
              name="Aprobados"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
}

// ─── Materiales activos por etapa (barras horizontales, color por depende_de) ─
export function ActivosPorEtapa({ metrics }: { metrics: MaterialMetric[] }) {
  const counts: Record<string, number> = {};
  for (const m of metrics) {
    if (TERMINAL.has(m.status as MaterialStatus)) continue;
    counts[m.status] = (counts[m.status] ?? 0) + 1;
  }
  const data = MATERIAL_STATUSES.filter((s) => !TERMINAL.has(s)).map((s) => ({
    name: STAGE_LABELS[s],
    value: counts[s] ?? 0,
    dep: dependeDe(s),
  }));
  const maxV = Math.max(1, ...data.map((d) => d.value));
  // totales por color
  const totByDep: Record<Dependencia, number> = {
    spark225: 0,
    cliente: 0,
    cliente_regulatorio: 0,
  };
  for (const d of data) totByDep[d.dep] += d.value;

  return (
    <ChartCard
      title="Materiales activos por etapa"
      desc="Coloreados según quién depende. Totales por color a la derecha."
    >
      {data.some((d) => d.value > 0) ? (
        <div className="space-y-2 pt-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-[150px] shrink-0 truncate text-xs text-[#4E5964]">
                {d.name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-[#F8F9FA]">
                <div
                  className="h-full rounded-md transition-all"
                  style={{
                    width: `${(d.value / maxV) * 100}%`,
                    backgroundColor: DEP_COLORS[d.dep],
                  }}
                  title={`${d.name}: ${d.value}`}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-[#0F1B2D]">
                {d.value}
              </span>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-3 border-t border-[#E4E7EC] pt-2 text-[11px]">
            <LegendDot
              color={DEP_COLORS.spark225}
              label={`Spark225: ${totByDep.spark225}`}
            />
            <LegendDot
              color={DEP_COLORS.cliente}
              label={`Cliente: ${totByDep.cliente}`}
            />
            <LegendDot
              color={DEP_COLORS.cliente_regulatorio}
              label={`Regulatorio: ${totByDep.cliente_regulatorio}`}
            />
          </div>
        </div>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#4E5964]">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ─── Desempeño por cliente y unidad ────────────────────────────────────────────
export interface ClientUnitRow {
  name: string;
  isUnit: boolean;
  activos: number;
  aTiempoPct: number | null;
  total: number;
  ciclo: number;
  sparkPct: number;
  clientePct: number;
  regPct: number;
  erroresSpark: number;
  enRiesgo: number;
}

export type AgruparPor = "cliente" | "producto" | "indicacion";
const NOMBRE_AGRUPAR: Record<AgruparPor, string> = { cliente: "Cliente / Unidad", producto: "Producto", indicacion: "Indicación" };

export function DesempenoClienteUnidad({
  rows,
  agrupar = "cliente",
  onAgrupar,
}: {
  rows: ClientUnitRow[];
  agrupar?: AgruparPor;
  onAgrupar?: (a: AgruparPor) => void;
}) {
  const selector = onAgrupar && (
    <div className="mb-3 inline-flex rounded-lg border border-[#E4E7EC] bg-white p-0.5" role="tablist" aria-label="Agrupar por">
      {(["cliente", "producto", "indicacion"] as AgruparPor[]).map((a) => (
        <button key={a} type="button" role="tab" aria-selected={agrupar === a} onClick={() => onAgrupar(a)} className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-colors", agrupar === a ? "bg-[#0F1B2D] text-white" : "text-[#4E5964] hover:bg-[#F8F9FA]")}>
          Por {a === "indicacion" ? "indicación" : a}
        </button>
      ))}
    </div>
  );
  if (!rows.length) return <>{selector}<EmptyReport /></>;
  return (
    <ChartCard
      title={agrupar === "cliente" ? "Desempeño por cliente y unidad" : `Desempeño por ${agrupar === "producto" ? "producto" : "indicación"}`}
      desc="A tiempo vs requerida, ciclo, quién retiene el tiempo, errores Spark y riesgo."
    >
      {selector}
      <div className="overflow-x-auto rounded-[10px] border border-[#E4E7EC]">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[11px] text-[#4E5964]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">
                {NOMBRE_AGRUPAR[agrupar]}
              </th>
              <th className="px-3 py-2 text-center font-semibold">Activos</th>
              <th className="px-3 py-2 text-center font-semibold">
                % a tiempo
              </th>
              <th className="px-3 py-2 text-center font-semibold">Ciclo</th>
              <th className="px-3 py-2 text-center font-semibold">
                Quién retiene
              </th>
              <th className="px-3 py-2 text-center font-semibold">
                Errores Spark por material
              </th>
              <th className="px-3 py-2 text-center font-semibold">En riesgo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EC]">
            {rows.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className={r.isUnit ? "bg-[#FAFBFC]" : "hover:bg-[#F8F9FA]"}
              >
                <td
                  className={cn(
                    "px-3 py-2 font-semibold text-[#0F1B2D]",
                    r.isUnit && "pl-6 font-medium text-[#4E5964]",
                  )}
                >
                  {r.isUnit ? "↳ " : ""}
                  {r.name}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {r.activos}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      r.aTiempoPct == null
                        ? "text-[#9AA4B2]"
                        : r.aTiempoPct >= 85
                          ? "text-[#2E9E5B]"
                          : r.aTiempoPct >= 70
                            ? "text-[#B5840A]"
                            : "text-[#D64545]",
                    )}
                  >
                    {r.aTiempoPct == null ? "N/D" : `${r.aTiempoPct}%`}
                  </span>
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-[#4E5964]">
                  {r.ciclo === 0 ? "—" : `${r.ciclo}d`}
                </td>
                <td className="px-3 py-2">
                  {r.total === 0 ? (
                    <span className="text-[#9AA4B2]">—</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="flex h-3 w-20 overflow-hidden rounded-sm">
                        <div
                          className="h-full"
                          style={{
                            width: `${r.sparkPct}%`,
                            backgroundColor: DEP_COLORS.spark225,
                          }}
                        />
                        <div
                          className="h-full"
                          style={{
                            width: `${r.clientePct}%`,
                            backgroundColor: DEP_COLORS.cliente,
                          }}
                        />
                        <div
                          className="h-full"
                          style={{
                            width: `${r.regPct}%`,
                            backgroundColor: DEP_COLORS.cliente_regulatorio,
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-[#4E5964]">
                        {r.sparkPct}%
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-[#4E5964]">
                  {r.total === 0 ? "—" : r1(r.erroresSpark)}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.enRiesgo > 0 ? (
                    <span className="font-semibold tabular-nums text-[#D64545]">
                      {r.enRiesgo}
                    </span>
                  ) : (
                    <span className="text-[#9AA4B2]">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ─── KPI card con barra de progreso y meta ─────────────────────────────────────
export function MgmtKpiCard({
  label,
  value,
  suffix,
  sub,
  delta,
  deltaInvert = false,
  progress,
  meta,
  stacked,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  sub?: string;
  delta?: number | null;
  deltaInvert?: boolean;
  progress?: number;
  meta?: number;
  stacked?: { spark: number; cliente: number; reg: number };
}) {
  const hasValue = value !== "—";
  const up = (delta ?? 0) >= 0;
  const good = deltaInvert ? !up : up;
  return (
    <Card className="border border-[#E4E7EC] bg-white shadow-none">
      <CardContent className="p-5">
        <p className="text-[13px] font-medium text-[#4E5964]">{label}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className="text-[36px] font-semibold leading-none tabular-nums text-[#0F1B2D]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {value}
          </span>
          {suffix && hasValue && (
            <span className="text-sm font-semibold text-[#4E5964]">
              {suffix}
            </span>
          )}
        </div>
        {sub && <p className="mt-1 text-[11px] text-[#9AA4B2]">{sub}</p>}
        {delta !== undefined && delta !== null && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px]">
            <span
              className={cn(
                "font-semibold tabular-nums",
                good ? "text-[#2E9E5B]" : "text-[#D64545]",
              )}
            >
              {up ? "▲" : "▼"} {Math.abs(delta ?? 0)}%
            </span>
            <span className="text-[#9AA4B2]">vs. periodo anterior</span>
          </div>
        )}
        {progress !== undefined && (
          <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F0F1F4]">
            <div
              className="h-full rounded-full bg-[#E37439]"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
            {meta !== undefined && (
              <div
                className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-[#0F1B2D]"
                style={{ left: `${Math.min(100, meta)}%` }}
                title={`Meta ${meta}%`}
              />
            )}
          </div>
        )}
        {stacked && (
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full"
              style={{
                width: `${stacked.spark}%`,
                backgroundColor: DEP_COLORS.spark225,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${stacked.cliente}%`,
                backgroundColor: DEP_COLORS.cliente,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${stacked.reg}%`,
                backgroundColor: DEP_COLORS.cliente_regulatorio,
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ChartCard wrapper ──────────────────────────────────────────────────────────
export const ChartCard = ({
  title,
  desc,
  children,
  className,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card
    className={`border border-[#E4E7EC] bg-white shadow-none ${className ?? ""}`}
  >
    <CardHeader className="pb-2">
      <CardTitle className="text-[15px] font-semibold text-[#0F1B2D]">
        {title}
      </CardTitle>
      {desc && <p className="text-xs text-[#4E5964]">{desc}</p>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

// ─── Estado pronóstico → color de borde ────────────────────────────────────────
export function estadoColor(e: MaterialForecast["estado_pronostico"]): string {
  switch (e) {
    case "a_tiempo":
      return "#2E9E5B";
    case "justo":
      return "#F5C245";
    case "tarde":
      return "#D64545";
    default:
      return "#9AA4B2";
  }
}

// ─── Insights (¿Qué hago hoy?) ─────────────────────────────────────────────────
export interface MgmtInsight {
  id: string;
  text: string;
  icon: React.ElementType;
  tone: "amber" | "red" | "navy" | "primary" | "slate";
  action: string;
  to?: string;
}

export function computeMgmtInsights(
  metrics: MaterialMetric[],
  forecast: MaterialForecast[],
  riesgoCount: number,
): MgmtInsight[] {
  if (metrics.length < 3) return [];
  const out: MgmtInsight[] = [];

  // Cola de Spark225
  const withCola = metrics.filter(
    (m) =>
      m.dias_en_cola != null && m.ciclo_dias != null && (m.ciclo_dias ?? 0) > 0,
  );
  if (withCola.length) {
    const colaPct =
      withCola.reduce(
        (acc, m) => acc + ((m.dias_en_cola ?? 0) / (m.ciclo_dias ?? 1)) * 100,
        0,
      ) / withCola.length;
    if (colaPct > 8) {
      out.push({
        id: "cola",
        text: `El ${Math.round(colaPct)}% del tiempo de ciclo es cola de Spark225 antes de iniciar.`,
        icon: Clock,
        tone: colaPct > 25 ? "red" : "amber",
        action: "Revisar asignaciones de inicio",
      });
    }
  }

  // Etapa más lenta (excluye terminales). Mediana por etapa —no promedio—
  // para ser consistente con el ciclo mediano del KPI y evitar que una etapa
  // con un material atípico domine el mensaje.
  const stageValues: Record<string, number[]> = {};
  for (const m of metrics) {
    if (TERMINAL.has(m.status as MaterialStatus)) continue;
    const dias =
      (m.dias_spark225 ?? 0) +
      (m.dias_cliente ?? 0) +
      (m.dias_regulatorio ?? 0);
    if (dias > 0) {
      (stageValues[m.status] ??= []).push(dias);
    }
  }
  const slowEntries = Object.entries(stageValues)
    .map(([s, arr]) => ({ s, med: median(arr) }))
    .sort((a, b) => b.med - a.med);
  const slow = slowEntries[0];
  if (slow) {
    out.push({
      id: "slow",
      text: `La etapa más lenta es ${statusLabel(slow.s as MaterialStatus)} con ${r1(slow.med)} días de mediana.`,
      icon: Clock,
      tone: "slate",
      action: "Priorizar esta etapa",
    });
  }

  // Esperando aprobación del cliente
  const esperandoCliente = forecast.filter((f) => f.depende_de === "cliente");
  if (esperandoCliente.length) {
    out.push({
      id: "espera",
      text: `${esperandoCliente.length} materiales están esperando aprobación del cliente.`,
      icon: User,
      tone: "amber",
      action: "Gestionar con el cliente",
    });
  }

  // Llegarían tarde
  const tarde = forecast.filter((f) => f.estado_pronostico === "tarde");
  if (tarde.length) {
    out.push({
      id: "tarde",
      text: `${tarde.length} materiales llegarían tarde según el pronóstico.`,
      icon: AlertTriangle,
      tone: "red",
      action: "Ir a /riesgo",
      to: "/riesgo",
    });
  }

  // En riesgo
  if (riesgoCount > 0) {
    out.push({
      id: "riesgo",
      text: `Hay ${riesgoCount} materiales en riesgo que requieren atención.`,
      icon: AlertTriangle,
      tone: "red",
      action: "Ir a /riesgo",
      to: "/riesgo",
    });
  }

  return out.slice(0, 5);
}

const TONE_DOT: Record<MgmtInsight["tone"], string> = {
  amber: "text-[#B5840A] bg-[#F5C245]/15",
  red: "text-[#D64545] bg-[#D64545]/12",
  navy: "text-[#0F1B2D] bg-[#0F1B2D]/10",
  primary: "text-[#E37439] bg-[#E37439]/12",
  slate: "text-[#4E5964] bg-[#4E5964]/10",
};

export function InsightList({ items }: { items: MgmtInsight[] }) {
  if (!items.length) return <EmptyReport />;
  return (
    <div className="space-y-2.5">
      {items.map((ins) => {
        const body = (
          <div
            key={ins.id}
            className="flex items-start gap-3 rounded-[10px] border border-[#E4E7EC] bg-white p-3"
          >
            <div className={`mt-0.5 rounded-md p-1.5 ${TONE_DOT[ins.tone]}`}>
              <ins.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-[#1F2124]">{ins.text}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#E37439]">
                {ins.action}
              </p>
            </div>
          </div>
        );
        return ins.to ? (
          <Link key={ins.id} to={ins.to} className="block">
            {body}
          </Link>
        ) : (
          body
        );
      })}
    </div>
  );
}

// Re-export para evitar imports rotos desde otros consumidores.
export { pct, median, STATUS_INDEX };
