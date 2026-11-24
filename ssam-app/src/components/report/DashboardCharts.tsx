import {
  BarChart,
  Bar,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  SPARK_COLORS,
  colorFor,
  tooltipStyle,
  axisProps,
} from "@/lib/chartTheme";
import { EmptyReport } from "@/components/reportPrimitives";
import { Gantt } from "@/components/Gantt";
import {
  statusLabel,
  MATERIAL_STATUSES,
  type MaterialStatus,
} from "@/lib/statusModel";
import type {
  MaterialMetric,
  StageDuration,
  MonthlyTrend,
  WorkloadRow,
} from "@/lib/api-types";
import { r1 } from "@/lib/reportMath";

const STAGE_LABELS: Record<string, string> = {};
for (const s of MATERIAL_STATUSES) STAGE_LABELS[s] = statusLabel(s);

export const TrendChart = ({ data }: { data: MonthlyTrend[] }) => (
  <ChartCard
    title="Tendencia: solicitados vs aprobados"
    desc="Volumen mensual."
  >
    {data.length ? (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={SPARK_COLORS.border} />
          <XAxis dataKey="mes" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="solicitados"
            stroke={SPARK_COLORS.primary}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Solicitados"
          />
          <Line
            type="monotone"
            dataKey="aprobados"
            stroke={SPARK_COLORS.green}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="Aprobados"
          />
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <EmptyReport />
    )}
  </ChartCard>
);

export const StageDistribution = ({
  metrics,
}: {
  metrics: MaterialMetric[];
}) => {
  const counts: Record<string, number> = {};
  for (const m of metrics) counts[m.status] = (counts[m.status] ?? 0) + 1;
  const data = MATERIAL_STATUSES.filter((s) => s !== "archivado").map(
    (s, i) => ({
      name: STAGE_LABELS[s],
      value: counts[s] ?? 0,
      fill: colorFor(i),
    }),
  );
  return (
    <ChartCard title="Distribución por etapa" desc="Materiales en cada etapa.">
      {data.some((d) => d.value > 0) ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const StageDurationsChart = ({
  durations,
}: {
  durations: StageDuration[];
}) => {
  const map: Record<string, { cola: number[]; trabajo: number[] }> = {};
  for (const d of durations) {
    if (!map[d.status]) map[d.status] = { cola: [], trabajo: [] };
    if (d.dias_en_cola != null) map[d.status].cola.push(d.dias_en_cola);
    if (d.dias_trabajo != null) map[d.status].trabajo.push(d.dias_trabajo);
  }
  const data = Object.entries(map).map(([status, v]) => ({
    status: STAGE_LABELS[status] ?? status,
    cola: r1(medianArr(v.cola)),
    trabajo: r1(medianArr(v.trabajo)),
  }));
  return (
    <ChartCard
      title="Tiempo promedio por etapa"
      desc="Días en cola vs días de trabajo."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              horizontal={false}
            />
            <XAxis type="number" {...axisProps} />
            <YAxis
              type="category"
              dataKey="status"
              width={120}
              {...axisProps}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="cola"
              stackId="a"
              fill={SPARK_COLORS.amber}
              radius={[4, 0, 0, 4]}
              name="Cola"
            />
            <Bar
              dataKey="trabajo"
              stackId="a"
              fill={SPARK_COLORS.primary}
              radius={[0, 4, 4, 0]}
              name="Trabajo"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const RondasScatter = ({ metrics }: { metrics: MaterialMetric[] }) => {
  const data = metrics
    .filter((m) => m.rondas_con_cliente != null)
    .map((m) => ({
      x: m.rondas_con_cliente ?? 0,
      y: m.ciclo_dias ?? 0,
      name: m.name,
    }));
  return (
    <ChartCard
      title="Rondas con cliente vs tiempo de ciclo"
      desc="Cada punto es un material."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={SPARK_COLORS.border} />
            <XAxis
              type="number"
              dataKey="x"
              name="Rondas con cliente"
              {...axisProps}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Días de ciclo"
              {...axisProps}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={data} fill={SPARK_COLORS.primary} />
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const WorkloadChart = ({ workload }: { workload: WorkloadRow[] }) => {
  const data = workload.map((w) => ({
    name: w.responsible_name ?? "—",
    activos: w.activos ?? 0,
    en_desarrollo: w.en_desarrollo ?? 0,
  }));
  const avg = data.length
    ? data.reduce((a, w) => a + w.activos, 0) / data.length
    : 0;
  return (
    <ChartCard
      title="Carga por persona"
      desc="Materiales activos por responsable y media del equipo."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              vertical={false}
            />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="activos"
              fill={SPARK_COLORS.primary}
              radius={[4, 4, 0, 0]}
              name="Activos"
            />
            <Bar
              dataKey="en_desarrollo"
              fill={SPARK_COLORS.amber}
              radius={[4, 4, 0, 0]}
              name="En desarrollo"
            />
            <ReferenceLine
              y={avg}
              stroke={SPARK_COLORS.red}
              strokeDasharray="4 4"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const StageFunnel = ({ metrics }: { metrics: MaterialMetric[] }) => {
  const counts: Record<string, number> = {};
  for (const m of metrics) counts[m.status] = (counts[m.status] ?? 0) + 1;
  const data = MATERIAL_STATUSES.map((s) => ({
    name: STAGE_LABELS[s],
    value: counts[s] ?? 0,
  }));
  return (
    <ChartCard
      title="Materiales por etapa (embudo)"
      desc="Cuántos materiales hay en cada una de las 14 etapas."
    >
      {data.some((d) => d.value > 0) ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              {...axisProps}
              angle={-35}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="value"
              fill={SPARK_COLORS.primary}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const GanttCard = ({
  durations,
  metrics,
}: {
  durations: StageDuration[];
  metrics: MaterialMetric[];
}) => {
  const ids = new Set(metrics.map((m) => m.material_id));
  const fechaMap: Record<string, string | null> = {};
  for (const m of metrics)
    fechaMap[m.material_id] = m.fecha_comprometida ?? null;
  return (
    <ChartCard
      title="Gantt de materiales activos"
      desc="Barras por etapa; marcador rojo = fecha comprometida, línea roja = hoy."
    >
      <Gantt
        rows={durations.filter((d) => ids.has(d.material_id))}
        fechaComprometidaMap={fechaMap}
        height={380}
      />
    </ChartCard>
  );
};

const ChartCard = ({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) => (
  <Card className="border border-[#DBDBDB] shadow-soft">
    <CardHeader className="pb-2">
      <CardTitle className="text-base text-[#0E1E2A]">{title}</CardTitle>
      {desc && <CardDescription>{desc}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

function medianArr(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type { MaterialStatus };
