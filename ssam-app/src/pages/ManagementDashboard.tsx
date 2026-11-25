import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  MaterialMetric,
  StageDuration,
  MonthlyTrend,
  CandadoEvent,
  MaterialForecast,
  MaterialHierarchy,
  TimelineStage,
} from "@/lib/api-types";
import { useFilters, periodoRange } from "@/lib/useFilters";
import { r1, pct } from "@/lib/reportMath";
import { MgmtHeader } from "@/components/MgmtHeader";
import {
  MgmtKpiCard,
  IngresoVsAprobados6m,
  ActivosPorEtapa,
  DesempenoClienteUnidad,
  type ClientUnitRow,
  type AgruparPor,
} from "@/components/report/MgmtCharts";
import { SectionTitle, CompactChip } from "@/components/MgmtSubcomponents";
import { MgmtPlanning } from "@/components/MgmtPlanning";
import { searchFolioEverywhere, isDelivered } from "@/lib/mgmtSearch";
import {
  useOperacion,
  periodWindows,
  selectMetrics,
  selectAprobados,
  selectSalud,
  selectTendencia,
  selectSaludPorCliente,
  selectBloqueosPeriodo,
} from "@/data/operacion";
import {
  filterActiveForecast,
  filterForecast,
  filterEntities,
  computeBand,
  computeKpis,
  inRange,
  isActiveMaterial,
} from "@/lib/mgmtHelpers";

const DAY = 1000 * 60 * 60 * 24;

export const ManagementDashboard = () => {
  const { state: filters } = useFilters();
  const data = useOperacion();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Métricas y agregados desde la capa única de datos.
  const fMetrics = useMemo(() => selectMetrics(data, filters), [data, filters]);
  const fForecast = useMemo(
    () => filterForecast(data.forecast, filters, data.demoIds),
    [data.forecast, filters, data.demoIds],
  );
  const aprobadosPeriodo = useMemo(
    () => selectAprobados(data, filters, false),
    [data, filters],
  );
  const aprobadosPrevio = useMemo(
    () => selectAprobados(data, filters, true),
    [data, filters],
  );
  const { desde, hasta } = useMemo(
    () => periodoRange(filters.periodo, filters.fechaDesde, filters.fechaHasta),
    [filters],
  );

  // Agregado de "Salud por cliente": única fuente de verdad.
  const salud = useMemo(() => selectSalud(data, filters), [data, filters]);
  const bloqueosPeriodo = useMemo(
    () => selectBloqueosPeriodo(data, filters),
    [data, filters],
  );

  const kpis = useMemo(
    () => computeKpis(aprobadosPeriodo, aprobadosPrevio),
    [aprobadosPeriodo, aprobadosPrevio],
  );

  const esperandoCliente = useMemo(
    () => fForecast.filter((f) => f.depende_de === "cliente").length,
    [fForecast],
  );
  // KPIs que dependen del histórico: si no hay datos en el periodo → null
  // ("—" en pantalla), nunca 0%.
  const crcPrimeraPct = useMemo(() => {
    const total = aprobadosPeriodo.filter((m) => m.crc_primera != null).length;
    if (total === 0) return null;
    return pct(
      aprobadosPeriodo.filter((m) => m.crc_primera === true).length,
      total,
    );
  }, [aprobadosPeriodo]);
  const diasRespuestaCliente = useMemo(() => {
    const v = aprobadosPeriodo
      .map((m) => m.dias_respuesta_cliente ?? 0)
      .filter((n) => n > 0);
    return v.length
      ? r1([...v].sort((a, b) => a - b)[Math.floor(v.length / 2)])
      : null;
  }, [aprobadosPeriodo]);
  const paq24Pct = useMemo(() => {
    const total = aprobadosPeriodo.filter(
      (m) => m.horas_paquete != null,
    ).length;
    if (total === 0) return null;
    return pct(
      aprobadosPeriodo.filter((m) => (m.horas_paquete ?? Infinity) <= 24)
        .length,
      total,
    );
  }, [aprobadosPeriodo]);

  const banda = useMemo(() => computeBand(fForecast), [fForecast]);

  const activeForecast = useMemo(
    () => filterActiveForecast(fForecast, "todos", search),
    [fForecast, search],
  );

  // ─── Búsqueda de folio entre TODOS los materiales (no solo activos) ───────
  const folioSearch = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    if (!q || !/^\d+$/.test(q)) return null;
    const activeMatch = fForecast.find(
      (f) => f.folio != null && String(f.folio) === q,
    );
    if (activeMatch) return null;
    return searchFolioEverywhere(data.metrics, filters.clientId, q);
  }, [search, fForecast, data.metrics, filters.clientId]);

  const deliveredMetric = useMemo(
    () =>
      folioSearch?.picked && isDelivered(folioSearch.picked.status)
        ? folioSearch.picked
        : null,
    [folioSearch],
  );
  const deliveredOptions = useMemo(
    () => folioSearch?.options ?? [],
    [folioSearch],
  );

  const [pickedDeliveredId, setPickedDeliveredId] = useState<string | null>(
    null,
  );
  const pickedDeliveredMetric = useMemo(
    () => data.metrics.find((m) => m.material_id === pickedDeliveredId) ?? null,
    [data.metrics, pickedDeliveredId],
  );
  const effectiveDeliveredMetric =
    deliveredMetric ??
    (pickedDeliveredMetric && isDelivered(pickedDeliveredMetric.status)
      ? pickedDeliveredMetric
      : null);
  useEffect(() => {
    setPickedDeliveredId(null);
  }, [search]);

  const selectedMetric = useMemo(
    () => data.metrics.find((m) => m.material_id === selectedId) ?? null,
    [data.metrics, selectedId],
  );
  const selectedForecast = useMemo(
    () => fForecast.find((f) => f.material_id === selectedId) ?? null,
    [fForecast, selectedId],
  );
  const selectedTimeline = useMemo(
    () => data.timeline.filter((d) => d.material_id === selectedId),
    [data.timeline, selectedId],
  );

  // Selección por defecto: primer 'tarde', si no el primero de la lista.
  useEffect(() => {
    if (selectedId || !fForecast.length) return;
    const tarde = fForecast.find((f) => f.estado_pronostico === "tarde");
    if (tarde) {
      setSelectedId(tarde.material_id);
      return;
    }
    if (activeForecast.length) setSelectedId(activeForecast[0].material_id);
  }, [fForecast, activeForecast, selectedId]);

  useEffect(() => {
    if (deliveredMetric || deliveredOptions.length > 0) return;
    if (
      search.trim() &&
      activeForecast.length &&
      !activeForecast.some((f) => f.material_id === selectedId)
    ) {
      setSelectedId(activeForecast[0].material_id);
    }
  }, [search, activeForecast, selectedId, deliveredMetric, deliveredOptions]);

  const trendData = useMemo(
    () => selectTendencia(data, filters),
    [data, filters],
  );

  // La tabla de desempeño se puede ver por cliente, producto o indicación.
  const [agrupar, setAgrupar] = useState<AgruparPor>("cliente");
  const clientUnitRows = useMemo<ClientUnitRow[]>(
    () => selectSaludPorCliente(data, filters, agrupar),
    [data, filters, agrupar],
  );

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-[14px]" />
        <Skeleton className="h-16 rounded-[14px]" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-[14px]" />
          ))}
        </div>
      </div>
    );
  }

  const noStack =
    kpis.sparkPct === 0 && kpis.clientePct === 0 && kpis.regPct === 0;

  return (
    <div className="min-h-full bg-[#F5F6F8]">
      <div className="mx-auto max-w-[1440px] px-8 py-6">
        <MgmtHeader search={search} onSearch={setSearch} />

        {/* Banda resumen */}
        <div className="mb-4 rounded-[14px] bg-[#0F1B2D] px-5 py-4 text-[13px] text-white/90">
          <span className="font-semibold text-white">{salud.activos}</span>{" "}
          materiales activos (no terminales). Próximas 8 semanas:{" "}
          <span className="font-semibold text-white">{banda.planeadas}</span> de
          esos activos tienen fecha de entrega en la ventana.{" "}
          <span className="font-semibold text-[#7FD0A6]">{banda.aTiempo}</span>{" "}
          llegan antes de la fecha que necesita el cliente,{" "}
          <span className="font-semibold text-[#F5C245]">{banda.justo}</span>{" "}
          justas y{" "}
          <span className="font-semibold text-[#F0A0A0]">{banda.tarde}</span>{" "}
          llegarían tarde.
          {banda.sinFecha > 0 && (
            <>
              {" "}
              <span className="font-semibold text-white/70">
                {banda.sinFecha}
              </span>{" "}
              sin fecha requerida.
            </>
          )}{" "}
          Hay{" "}
          <span className="font-semibold text-white">{banda.esperando}</span>{" "}
          materiales esperando aprobación del cliente.
        </div>

        <SectionTitle title="¿Cumplimos al cliente?" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MgmtKpiCard
            label="A tiempo vs fecha que necesita el cliente"
            value={kpis.reqTotal === 0 ? "—" : kpis.reqPct}
            suffix={kpis.reqTotal === 0 ? undefined : "%"}
            sub={
              kpis.reqTotal === 0
                ? "Histórico · entregados en el periodo"
                : `Histórico (${kpis.reqTotal} entregados) · vs comprometida: ${kpis.actPct}%`
            }
            delta={kpis.reqTotal === 0 ? null : kpis.deltaReq}
            progress={kpis.reqTotal === 0 ? undefined : kpis.reqPct}
            meta={85}
          />
          <MgmtKpiCard
            label="Ciclo mediano"
            value={kpis.ciclo === 0 ? "—" : r1(kpis.ciclo)}
            suffix={kpis.ciclo === 0 ? undefined : "d"}
            sub={
              kpis.ciclo === 0
                ? undefined
                : `Para planear: pedir con ≥ ${kpis.semanasPlaneacion} semanas`
            }
            delta={kpis.ciclo === 0 ? null : kpis.deltaCiclo}
            deltaInvert
          />
          <MgmtKpiCard
            label="Aprobado sin errores de Spark225"
            value={kpis.sinErrTotal === 0 ? "—" : kpis.sinErrPct}
            suffix={kpis.sinErrTotal === 0 ? undefined : "%"}
            sub={
              kpis.sinErrTotal === 0
                ? undefined
                : `a la primera incl. cambios del cliente: ${kpis.primeraPct}%`
            }
            delta={kpis.sinErrTotal === 0 ? null : kpis.deltaSinErr}
          />
          <MgmtKpiCard
            label="¿Quién retiene el tiempo?"
            value={noStack ? "—" : `${kpis.sparkPct}%`}
            sub={noStack ? undefined : "Spark225 del tiempo total"}
            stacked={
              noStack
                ? undefined
                : {
                    spark: kpis.sparkPct,
                    cliente: kpis.clientePct,
                    reg: kpis.regPct,
                  }
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <CompactChip
            label="En riesgo"
            value={salud.enRiesgo}
            tone={salud.enRiesgo > 0 ? "red" : "slate"}
            to="/riesgo"
          />
          <CompactChip
            label="Esperando aprob. cliente"
            value={esperandoCliente}
            tone={esperandoCliente > 0 ? "amber" : "slate"}
          />
          <CompactChip
            label="Aprobación interna a la primera"
            value={crcPrimeraPct == null ? "—" : `${crcPrimeraPct}%`}
            tone={
              crcPrimeraPct == null
                ? "slate"
                : crcPrimeraPct >= 70
                  ? "green"
                  : "amber"
            }
          />
          <CompactChip
            label="Días respuesta cliente"
            value={diasRespuestaCliente ?? "—"}
            suffix={diasRespuestaCliente ? "d" : undefined}
            tone="slate"
          />
          <CompactChip
            label="Paquete final <24h"
            value={paq24Pct == null ? "—" : `${paq24Pct}%`}
            tone={
              paq24Pct == null ? "slate" : paq24Pct >= 70 ? "green" : "amber"
            }
          />
          <CompactChip
            label="Bloqueos en el periodo"
            value={bloqueosPeriodo}
            tone={bloqueosPeriodo > 0 ? "amber" : "slate"}
          />
        </div>

        <div className="mt-8">
          <MgmtPlanning
            forecast={fForecast}
            metrics={filterEntities(data.metrics, filters, data.demoIds)}
            candado={data.candado}
            clientMap={data.clientMap}
          />
        </div>

        <div className="mt-4">
          {salud.enRiesgo > 0 ? (
            <Link
              to="/riesgo"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#E37439] hover:underline"
            >
              Ver {salud.enRiesgo} materiales en riesgo →
            </Link>
          ) : (
            <p className="text-[13px] text-[#4E5964]">
              Sin materiales en riesgo en este momento.
            </p>
          )}
        </div>

        <SectionTitle title="Flujo y tendencias" className="mt-6" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActivosPorEtapa metrics={fMetrics} />
          <IngresoVsAprobados6m data={trendData} />
        </div>
        <div className="mt-4">
          <DesempenoClienteUnidad rows={clientUnitRows} agrupar={agrupar} onAgrupar={setAgrupar} />
        </div>
      </div>
    </div>
  );
};
