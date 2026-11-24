import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import {
  statusLabel,
  MATERIAL_STATUSES,
  type MaterialStatus,
} from "@/lib/statusModel";
import { r1, median, pct } from "@/lib/reportMath";
import type {
  MaterialMetric,
  StageDuration,
  WorkloadRow,
} from "@/lib/api-types";

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

// ─── Eficiencia ──────────────────────────────────────────────────────────────

export const CicloMedianoChart = ({
  metrics,
}: {
  metrics: MaterialMetric[];
}) => {
  const data = [
    {
      name: "Ciclo total",
      value: r1(median(metrics.map((m) => m.ciclo_dias ?? 0))),
      fill: SPARK_COLORS.primary,
    },
    {
      name: "Spark225",
      value: r1(median(metrics.map((m) => m.dias_spark225 ?? 0))),
      fill: SPARK_COLORS.navy,
    },
    {
      name: "Cliente",
      value: r1(median(metrics.map((m) => m.dias_cliente ?? 0))),
      fill: SPARK_COLORS.slate,
    },
    {
      name: "Regulatorio",
      value: r1(median(metrics.map((m) => m.dias_regulatorio ?? 0))),
      fill: SPARK_COLORS.gray,
    },
  ];
  return (
    <ChartCard title="Tiempo de ciclo (mediana)" desc="Desglose por actor.">
      {metrics.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              vertical={false}
            />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const ColaVsTrabajoChart = ({
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
  const data = Object.entries(map).map(([s, v]) => ({
    name: statusLabel(s as MaterialStatus),
    cola: r1(median(v.cola)),
    trabajo: r1(median(v.trabajo)),
  }));
  return (
    <ChartCard
      title="Cola vs trabajo por etapa"
      desc="Días en cola (amber) vs días de trabajo (naranja)."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={SPARK_COLORS.border}
              horizontal={false}
            />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="name" width={130} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="cola"
              stackId="a"
              fill={SPARK_COLORS.amber}
              name="Cola"
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="trabajo"
              stackId="a"
              fill={SPARK_COLORS.primary}
              name="Trabajo"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const EtapasTiempoChart = ({
  durations,
}: {
  durations: StageDuration[];
}) => {
  const map: Record<string, number[]> = {};
  for (const d of durations) {
    if (d.dias != null) (map[d.status] ||= []).push(d.dias);
  }
  const data = MATERIAL_STATUSES.map((s, i) => ({
    name: statusLabel(s),
    dias: r1(median(map[s] ?? [])),
    fill: colorFor(i),
  })).filter((d) => d.dias > 0);
  return (
    <ChartCard
      title="Tiempo promedio por etapa"
      desc="Días promedio invertidos en cada etapa."
    >
      {data.length ? (
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
              angle={-30}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

// ─── Calidad ─────────────────────────────────────────────────────────────────

export const PrimeraRondaDonut = ({
  metrics,
}: {
  metrics: MaterialMetric[];
}) => {
  const primera = metrics.filter((m) => m.aprobado_primera_ronda).length;
  const resto = metrics.length - primera;
  const data = [
    { name: "A la primera", value: primera, fill: SPARK_COLORS.green },
    { name: "Con devoluciones", value: resto, fill: SPARK_COLORS.red },
  ];
  return (
    <ChartCard
      title="Aprobación a la primera ronda"
      desc="Materiales aprobados sin devoluciones."
    >
      {metrics.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport />
      )}
    </ChartCard>
  );
};

export const DevolucionesChart = ({
  metrics,
}: {
  metrics: MaterialMetric[];
}) => {
  const data = metrics
    .filter((m) => (m.rechazos ?? 0) > 0)
    .map((m) => ({
      name: m.name,
      rechazos: m.rechazos ?? 0,
    }))
    .sort((a, b) => b.rechazos - a.rechazos)
    .slice(0, 10);
  return (
    <ChartCard
      title="Devoluciones por material"
      desc="Top 10 materiales con más rechazos."
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
            <YAxis type="category" dataKey="name" width={160} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="rechazos"
              fill={SPARK_COLORS.red}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport title="Sin devoluciones" />
      )}
    </ChartCard>
  );
};

// ─── Cumplimiento ────────────────────────────────────────────────────────────

export const CambiosFechaCategoriaChart = ({
  metrics,
}: {
  metrics: MaterialMetric[];
}) => {
  const data = [
    {
      name: "Spark225",
      value: metrics.reduce((a, m) => a + (m.cambios_fecha_spark225 ?? 0), 0),
      fill: SPARK_COLORS.primary,
    },
    {
      name: "Cliente",
      value: metrics.reduce(
        (a, m) =>
          a +
          Math.max(0, (m.cambios_fecha ?? 0) - (m.cambios_fecha_spark225 ?? 0)),
        0,
      ),
      fill: SPARK_COLORS.slate,
    },
  ].filter((d) => d.value > 0);
  return (
    <ChartCard
      title="Cambios de fecha por categoría"
      desc="Atribuibles a Spark225 vs cliente."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyReport title="Sin cambios de fecha" />
      )}
    </ChartCard>
  );
};

// ─── Equipo ──────────────────────────────────────────────────────────────────

export const CargaEquipoChart = ({ workload }: { workload: WorkloadRow[] }) => {
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
      desc="Materiales activos y en desarrollo con media del equipo."
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
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

export { pct };
