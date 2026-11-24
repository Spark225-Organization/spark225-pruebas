import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Download,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOperacion } from "@/data/operacion";
import type { FilterState } from "@/lib/useFilters";
import {
  folioLabel,
  filterForecast,
  isActiveMaterial,
} from "@/lib/mgmtHelpers";
import {
  MaterialDetailPanel,
  internalLabel,
} from "@/components/MgmtDetailPanel";
import { estadoColor } from "@/components/report/MgmtCharts";
import { AgendaRow, AGENDA_HEADERS } from "@/components/planning/AgendaRow";
import { cn } from "@/lib/utils";
import {
  rangeWeeks,
  bucketWeeks,
  weekLabel,
  isThisWeek,
  dayLabel,
  estadoCounts,
  exportCsv,
  type RangeKey,
} from "@/lib/planningHelpers";

const ALL = "__all__";

type ChipKey = "todos" | "tarde" | "justo" | "sinfecha" | "cliente";
const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "tarde", label: "Llegarían tarde" },
  { key: "justo", label: "Justos" },
  { key: "sinfecha", label: "Sin fecha requerida" },
  { key: "cliente", label: "Esperando al cliente" },
];

// Patchea los filtros en la URL (mismo convenio que useFilters.patch).
function useFilterPatch() {
  const [, setSearchParams] = useSearchParams();
  return (changes: Partial<FilterState>) =>
    setSearchParams((prev) => {
      const map: Record<string, string | null | undefined> = {
        cliente: changes.clientId ?? null,
        unidad: changes.unitId ?? null,
        producto: changes.productId ?? null,
        indicacion: changes.indicationId ?? null,
        responsable: changes.responsibleId ?? null,
        formato: changes.format ?? null,
        periodo: changes.periodo ?? null,
        desde: changes.fechaDesde ?? null,
        hasta: changes.fechaHasta ?? null,
        demo:
          changes.hideDemo === undefined
            ? undefined
            : changes.hideDemo
              ? null
              : "0",
      };
      for (const [k, v] of Object.entries(map)) {
        if (v === undefined) continue;
        if (v === null || v === undefined) prev.delete(k);
        else prev.set(k, String(v));
      }
      return prev;
    });
}

export default function Planeacion() {
  const [searchParams] = useSearchParams();
  const filters: FilterState = {
    clientId: searchParams.get("cliente") || null,
    unitId: searchParams.get("unidad") || null,
    productId: searchParams.get("producto") || null,
    indicationId: searchParams.get("indicacion") || null,
    responsibleId: searchParams.get("responsable") || null,
    format: searchParams.get("formato") || null,
    periodo: (searchParams.get("periodo") as FilterState["periodo"]) || "90d",
    fechaDesde: searchParams.get("desde") || null,
    fechaHasta: searchParams.get("hasta") || null,
    hideDemo: searchParams.get("demo") !== "0",
  };
  const patch = useFilterPatch();

  const data = useOperacion();

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [range, setRange] = useState<RangeKey>("8w");
  const [view, setView] = useState<"agenda" | "calendario">("agenda");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // fForecast: ya viene enriquecido desde la capa única de datos; filtrado
  // con la MISMA función que el dashboard (cliente + DEMO, incluyendo cliente).
  const fForecast = useMemo(
    () => filterForecast(data.forecast, filters, data.demoIds),
    [data.forecast, filters, data.demoIds],
  );

  const filtered = useMemo(() => {
    let rows = fForecast;
    if (filters.unitId) {
      const unit = data.businessUnits.find((u) => u.id === filters.unitId);
      if (unit?.client_id)
        rows = rows.filter((f) => f.client_id === unit.client_id);
    }
    if (chip === "tarde")
      rows = rows.filter((f) => f.estado_pronostico === "tarde");
    if (chip === "justo")
      rows = rows.filter((f) => f.estado_pronostico === "justo");
    if (chip === "sinfecha")
      rows = rows.filter(
        (f) =>
          !f.fecha_requerida_cliente || f.estado_pronostico === "sin_fecha",
      );
    if (chip === "cliente")
      rows = rows.filter((f) => f.depende_de === "cliente");
    if (search.trim()) {
      const q = search.trim().toLowerCase().replace(/^#/, "");
      rows = rows.filter(
        (f) =>
          (f.titulo ?? "").toLowerCase().includes(q) ||
          (f.producto ?? "").toLowerCase().includes(q) ||
          (f.indicacion ?? "").toLowerCase().includes(q) ||
          (f.cliente ?? "").toLowerCase().includes(q) ||
          (f.folio != null && String(f.folio).includes(q)),
      );
    }
    return [...rows].sort((a, b) => {
      const da = a.entrega_estimada
        ? new Date(a.entrega_estimada).getTime()
        : Infinity;
      const db = b.entrega_estimada
        ? new Date(b.entrega_estimada).getTime()
        : Infinity;
      return da - db;
    });
  }, [fForecast, filters.unitId, data.businessUnits, chip, search]);

  const buckets = useMemo(
    () => bucketWeeks(filtered, rangeWeeks(range)),
    [filtered, range],
  );
  const counts = useMemo(() => estadoCounts(filtered), [filtered]);

  const drawerMetric = useMemo(
    () => data.metrics.find((m) => m.material_id === drawerId) ?? null,
    [data.metrics, drawerId],
  );
  const drawerForecast = useMemo(
    () => fForecast.find((f) => f.material_id === drawerId) ?? null,
    [fForecast, drawerId],
  );
  const drawerTimeline = useMemo(
    () => data.timeline.filter((t) => t.material_id === drawerId),
    [data.timeline, drawerId],
  );

  const currentWeek = useMemo(
    () => buckets.weeks.find((w) => isThisWeek(w.start))?.items ?? [],
    [buckets],
  );
  const reportThisWeek = currentWeek.length;
  const reportLate = currentWeek.filter(
    (f) => f.estado_pronostico === "tarde",
  ).length;

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-[14px]" />
        <Skeleton className="h-40 rounded-[14px]" />
        <Skeleton className="h-60 rounded-[14px]" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F5F6F8]">
      <div className="mx-auto max-w-[1440px] px-8 py-6">
        {/* Encabezado */}
        <div className="mb-4">
          <h1 className="text-[24px] font-semibold leading-tight text-[#0F1B2D]">
            Planeación de entregas
          </h1>
          <p className="mt-0.5 text-[13px] text-[#4E5964]">
            Fechas estimadas según el tiempo típico de cada etapa con cada
            cliente
          </p>
        </div>

        {/* Fila de controles */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA4B2]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca por folio, título, producto o indicación"
              className="h-10 rounded-[10px] border-[#E4E7EC] bg-white pl-9 pr-3 text-sm text-[#0F1B2D] placeholder:text-[#9AA4B2]"
              aria-label="Buscador de planeación"
            />
          </div>

          <div className="w-[180px]">
            <Select
              value={filters.clientId ?? ALL}
              onValueChange={(v) => patch({ clientId: v === ALL ? null : v })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los clientes</SelectItem>
                {data.clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Select
              value={filters.unitId ?? ALL}
              onValueChange={(v) => patch({ unitId: v === ALL ? null : v })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todas las unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las unidades</SelectItem>
                {data.businessUnits
                  .filter(
                    (u) =>
                      !filters.clientId || u.client_id === filters.clientId,
                  )
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[10px] border border-[#E4E7EC] bg-white p-1">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChip(c.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  chip === c.key
                    ? "bg-[#E37439] text-white"
                    : "text-[#4E5964] hover:bg-[#F8F9FA]",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-[10px] border border-[#E4E7EC] bg-white p-1">
            {(
              [
                ["4w", "Próximas 4 sem."],
                ["8w", "8 semanas"],
                ["all", "Todo"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  range === k
                    ? "bg-[#E37439] text-white"
                    : "text-[#4E5964] hover:bg-[#F8F9FA]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-[10px] border border-[#E4E7EC] bg-white p-1">
            <button
              onClick={() => setView("agenda")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                view === "agenda"
                  ? "bg-[#E37439] text-white"
                  : "text-[#4E5964] hover:bg-[#F8F9FA]",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
            </button>
            <button
              onClick={() => setView("calendario")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                view === "calendario"
                  ? "bg-[#E37439] text-white"
                  : "text-[#4E5964] hover:bg-[#F8F9FA]",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" /> Calendario
            </button>
          </div>
        </div>

        {/* Leyenda */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-[#4E5964]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#2E9E5B]" />
            Llega antes de la fecha que necesita el cliente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#F5C245]" />
            Justo (≤ 3 días de margen)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#D64545]" />
            Llegaría tarde
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#9AA4B2]" />
            Sin fecha requerida
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[14px] border border-[#E4E7EC] bg-white p-10 text-center">
            <p className="text-sm text-[#4E5964]">
              No hay materiales que coincidan con los filtros actuales.
            </p>
          </div>
        ) : view === "agenda" ? (
          <div className="space-y-5">
            {buckets.vencidos.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#D64545]" />
                  <h2 className="text-[13px] font-semibold text-[#D64545]">
                    Vencidos
                  </h2>
                  <span className="text-[11px] text-[#9AA4B2]">
                    · {buckets.vencidos.length} entrega
                    {buckets.vencidos.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-[10px] border border-[#D64545]/30 bg-white">
                  <table className="w-full min-w-[1024px] text-sm">
                    <thead className="bg-[#D64545]/8 text-[11px] text-[#D64545]">
                      <tr>
                        {AGENDA_HEADERS.map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E7EC]">
                      {buckets.vencidos.map((f) => (
                        <AgendaRow
                          key={f.material_id}
                          f={f}
                          onSelect={setDrawerId}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {buckets.weeks.map((w, i) => {
              const tarde = w.items.filter(
                (f) => f.estado_pronostico === "tarde",
              ).length;
              return (
                <section key={i}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2
                      className={cn(
                        "text-[13px] font-semibold",
                        isThisWeek(w.start)
                          ? "text-[#E37439]"
                          : "text-[#0F1B2D]",
                      )}
                    >
                      {weekLabel(w.start)}
                    </h2>
                    {isThisWeek(w.start) && (
                      <span className="rounded-full bg-[#E37439]/12 px-2 py-0.5 text-[10px] font-bold text-[#E37439]">
                        Esta semana
                      </span>
                    )}
                    <span className="text-[11px] text-[#9AA4B2]">
                      · {w.items.length} entrega
                      {w.items.length === 1 ? "" : "s"}
                      {tarde > 0 ? ` · ${tarde} tarde` : ""}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-[10px] border border-[#E4E7EC] bg-white">
                    <table className="w-full min-w-[1024px] text-sm">
                      <thead className="bg-[#F8F9FA] text-[11px] text-[#4E5964]">
                        <tr>
                          {AGENDA_HEADERS.map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-semibold"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E7EC]">
                        {w.items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={AGENDA_HEADERS.length}
                              className="px-3 py-4 text-center text-[11px] text-[#9AA4B2]"
                            >
                              Sin entregas esta semana
                            </td>
                          </tr>
                        ) : (
                          w.items.map((f) => (
                            <AgendaRow
                              key={f.material_id}
                              f={f}
                              onSelect={setDrawerId}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3">
              {buckets.weeks.map((w, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex w-[240px] shrink-0 flex-col rounded-[14px] border bg-white p-3",
                    isThisWeek(w.start)
                      ? "border-[#E37439]"
                      : "border-[#E4E7EC]",
                  )}
                >
                  <p className="mb-2 text-[11px] font-semibold text-[#4E5964]">
                    {weekLabel(w.start)}
                  </p>
                  <div className="space-y-2">
                    {w.items.length === 0 ? (
                      <p className="text-[11px] text-[#9AA4B2]">—</p>
                    ) : (
                      w.items.map((f) => (
                        <button
                          key={f.material_id}
                          onClick={() => setDrawerId(f.material_id)}
                          className="block w-full rounded-lg bg-[#F8F9FA] p-2 text-left transition-colors hover:bg-[#F0F1F4]"
                          style={{
                            borderLeft: `3px solid ${estadoColor(f.estado_pronostico)}`,
                          }}
                        >
                          <p className="text-[11px] font-semibold leading-snug text-[#0F1B2D]">
                            {folioLabel(f.folio)} · {f.titulo ?? f.material_id}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#9AA4B2]">
                            {dayLabel(f.entrega_estimada)} ·{" "}
                            {internalLabel(f.status, 0)}
                          </p>
                          <p className="text-[10px] text-[#9AA4B2]">
                            {f.cliente ?? "—"} · {f.indicacion ?? "—"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pie: resumen + exportar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[#4E5964]">
            <span className="font-semibold text-[#0F1B2D]">
              {filtered.filter((f) => isActiveMaterial(f.status)).length}{" "}
              activos
            </span>{" "}
            ·{" "}
            <span className="text-[#4E5964]">
              {filtered.filter((f) => !isActiveMaterial(f.status)).length}{" "}
              terminales
            </span>{" "}
            · {counts.total} en la vista · {counts.aTiempo} a tiempo ·{" "}
            {counts.justos} justos · {counts.tarde} tarde · {counts.sinFecha}{" "}
            sin fecha
          </p>
          <button
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E37439] px-3.5 py-2 text-[12px] font-semibold text-[#E37439] transition-colors hover:bg-[#E37439] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Drawer lateral derecho con el detalle del material */}
      <Sheet open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent
          side="right"
          className="w-full max-w-[460px] overflow-y-auto border-[#E4E7EC] bg-[#F8F9FA] p-4 sm:max-w-[460px]"
        >
          <SheetHeader className="mb-3">
            <SheetTitle className="text-[15px] font-semibold text-[#0F1B2D]">
              Detalle del material
            </SheetTitle>
          </SheetHeader>
          <MaterialDetailPanel
            metric={drawerMetric}
            forecast={drawerForecast}
            timeline={drawerTimeline}
            clientName={
              drawerForecast?.cliente ?? drawerMetric?.client_name ?? null
            }
          />
          {drawerId && (
            <Link
              to={`/materials/${drawerId}`}
              className="mt-3 block rounded-[10px] border border-[#E37439] px-3 py-2 text-center text-[12px] font-semibold text-[#E37439] transition-colors hover:bg-[#E37439] hover:text-white"
            >
              Abrir ficha completa
            </Link>
          )}
        </SheetContent>
      </Sheet>

      <span className="sr-only" aria-hidden="true">
        Semana actual: {reportThisWeek} entregas · Tarde: {reportLate}
      </span>
    </div>
  );
}
