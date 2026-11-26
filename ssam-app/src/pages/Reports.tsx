import { useMemo } from "react";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperacion, selectMetrics } from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import { isDemoName } from "@/lib/mgmtHelpers";
import type {
  MaterialMetric,
  StageDuration,
  WorkloadRow,
} from "@/lib/api-types";
import { r1, median, pct } from "@/lib/reportMath";
import { exportCsv, EmptyReport } from "@/components/reportPrimitives";
import { FilterBar } from "@/components/FilterBar";
import {
  CicloMedianoChart,
  ColaVsTrabajoChart,
  EtapasTiempoChart,
  PrimeraRondaDonut,
  DevolucionesChart,
  CambiosFechaCategoriaChart,
  CargaEquipoChart,
} from "@/components/report/ReportCharts";
import { useClientAgg } from "@/components/report/Insights";
import { RechazosPorCategoria } from "@/components/report/RechazosPorCategoria";

const Reports = () => {
  const { state: filters } = useFilters();
  const data = useOperacion();
  const fm = useMemo(() => selectMetrics(data, filters), [data, filters]);
  const byClient = useClientAgg(fm, []);
  // El filtro DEMO es global: workload y durations se filtran por nombre del
  // responsable / material demo para que las gráficas de equipo coincidan con
  // el resto de las pantallas.
  const workload = useMemo(
    () =>
      filters.hideDemo
        ? data.workload.filter((w) => !isDemoName(w.responsible_name))
        : data.workload,
    [data.workload, filters.hideDemo],
  );
  // El filtro DEMO es global: durations se filtra por material_id contra los
  // métricos que pasaron el filtro (cliente + DEMO) para que las gráficas de
  // equipo coincidan con el resto de las pantallas.
  const durations = useMemo(() => {
    const allowed = new Set(fm.map((m) => m.material_id));
    return data.durations.filter((d) => allowed.has(d.material_id));
  }, [data.durations, fm]);

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-[12px]" />
        <Skeleton className="h-[420px] rounded-[12px]" />
      </div>
    );
  }

  const exportEficiencia = () =>
    exportCsv(
      "eficiencia.csv",
      fm.map((m) => ({
        material: m.name,
        cliente: m.client_name ?? "",
        ciclo_dias: m.ciclo_dias ?? "",
        dias_spark225: m.dias_spark225 ?? "",
        dias_cliente: m.dias_cliente ?? "",
        dias_regulatorio: m.dias_regulatorio ?? "",
        dias_en_cola: m.dias_en_cola ?? "",
        responsable: m.responsible_name ?? "",
      })),
    );

  const exportCalidad = () =>
    exportCsv(
      "calidad.csv",
      fm.map((m) => ({
        material: m.name,
        cliente: m.client_name ?? "",
        aprobado_primera: m.aprobado_primera_ronda ? "sí" : "no",
        rondas_con_cliente: m.rondas_con_cliente ?? "",
        rechazos: m.rechazos ?? "",
        responsable: m.responsible_name ?? "",
      })),
    );

  const exportCumplimiento = () =>
    exportCsv(
      "cumplimiento.csv",
      fm.map((m) => ({
        material: m.name,
        cliente: m.client_name ?? "",
        a_tiempo: m.a_tiempo ? "sí" : "no",
        a_tiempo_vs_original: m.a_tiempo_vs_original ? "sí" : "no",
        cambios_fecha: m.cambios_fecha ?? "",
        cambios_fecha_spark225: m.cambios_fecha_spark225 ?? "",
        horas_paquete: m.horas_paquete ?? "",
      })),
    );

  const exportEquipo = () =>
    exportCsv(
      "carga_equipo.csv",
      workload.map((w) => ({
        responsable: w.responsible_name ?? "",
        activos: w.activos ?? 0,
        en_desarrollo: w.en_desarrollo ?? 0,
      })),
    );

  const exportClientes = () =>
    exportCsv(
      "clientes.csv",
      byClient.map((c) => ({
        cliente: c.name,
        total: c.total,
        activos: c.activos,
        pct_a_tiempo: pct(c.aTiempo, c.total),
        ciclo_mediana: r1(median(c.ciclo)),
        pct_primera_ronda: pct(c.primera, c.total),
        alertas: c.alertas,
      })),
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Reportes y Métricas
          </h1>
          <p className="text-muted-foreground">
            Análisis de eficiencia, calidad, cumplimiento, clientes y equipo.
          </p>
        </div>
      </div>

      <FilterBar />

      <Tabs defaultValue="eficiencia" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="eficiencia">Eficiencia</TabsTrigger>
          <TabsTrigger value="calidad">Calidad</TabsTrigger>
          <TabsTrigger value="cumplimiento">Cumplimiento</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="eficiencia" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportEficiencia}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {fm.length === 0 ? (
            <EmptyReport />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <CicloMedianoChart metrics={fm} />
              <ColaVsTrabajoChart durations={durations} />
              <div className="lg:col-span-2">
                <EtapasTiempoChart durations={durations} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calidad" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportCalidad}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {fm.length === 0 ? (
            <EmptyReport />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <PrimeraRondaDonut metrics={fm} />
              <DevolucionesChart metrics={fm} />
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <RechazosPorCategoria />
          </div>
        </TabsContent>

        <TabsContent value="cumplimiento" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportCumplimiento}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {fm.length === 0 ? (
            <EmptyReport />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <CambiosFechaCategoriaChart metrics={fm} />
              <Card className="border border-[#DBDBDB] shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#0E1E2A]">
                    Paquete final &lt; 24h
                  </CardTitle>
                  <CardDescription>
                    % de materiales con paquete final entregado en menos de 24h.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-extrabold text-[#0E1E2A]">
                    {pct(
                      fm.filter((m) => (m.horas_paquete ?? Infinity) <= 24)
                        .length,
                      fm.length,
                    )}
                    %
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportClientes}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {byClient.length === 0 ? (
            <EmptyReport />
          ) : (
            <Card className="border border-[#DBDBDB] shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">
                  Comparativo por cliente
                </CardTitle>
                <CardDescription>
                  Resumen de eficiencia y cumplimiento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-[10px] border border-[#DBDBDB]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F8F9FA]/70 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">
                          Cliente
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          Total
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          Activos
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          % a tiempo
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          Ciclo (d)
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          % 1ª ronda
                        </th>
                        <th className="px-4 py-2.5 text-center font-semibold">
                          Alertas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DBDBDB]">
                      {byClient.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-semibold text-[#0E1E2A]">
                            {c.name}
                          </td>
                          <td className="px-4 py-2.5 text-center">{c.total}</td>
                          <td className="px-4 py-2.5 text-center">
                            {c.activos}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {pct(c.aTiempo, c.total)}%
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {r1(median(c.ciclo))}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {pct(c.primera, c.total)}%
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {c.alertas > 0 ? (
                              <Badge className="bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25">
                                {c.alertas}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="equipo" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportEquipo}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
          {workload.length === 0 ? (
            <EmptyReport />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <CargaEquipoChart workload={workload} />
              <Card className="border border-[#DBDBDB] shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Desempeño por persona
                  </CardTitle>
                  <CardDescription>
                    Materiales activos y en desarrollo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-[10px] border border-[#DBDBDB]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F8F9FA]/70 text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Responsable
                          </th>
                          <th className="px-4 py-2.5 text-center font-semibold">
                            Activos
                          </th>
                          <th className="px-4 py-2.5 text-center font-semibold">
                            En desarrollo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DBDBDB]">
                        {workload.map((w) => (
                          <tr
                            key={w.responsible_id}
                            className="hover:bg-muted/30"
                          >
                            <td className="px-4 py-2.5 font-semibold text-[#0E1E2A]">
                              {w.responsible_name ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {w.activos ?? 0}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {w.en_desarrollo ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
