// Capa única de datos de operación (SSAM).
// Una sola fuente viva: TanStack Query con queryKey raíz ["operacion"].
// Todas las pantallas consumen useOperacion(); ninguna llama a Supabase ni
// calcula métricas por su cuenta. Las mutaciones (mutations.ts) invalidan
// ["operacion"], que se recarga desde las vistas (v_material_metrics,
// v_material_forecast, v_material_timeline, materiales_en_riesgo).
// Realtime + BroadcastChannel (realtime.ts) mantienen la copia viva entre
// pestañas con debounce de 300 ms.

import { useMemo, useCallback } from "react";
import {
  QueryClient,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Client,
  Product,
  Indication,
  TeamMember,
  Material,
  MaterialMetric,
  StageDuration,
  MonthlyTrend,
  WorkloadRow,
  BusinessUnit,
  CandadoEvent,
  MaterialForecast,
  MaterialHierarchy,
  TimelineStage,
  MaterialRiesgo,
  PaquetePendiente,
  ClientKpi,
  ClientTimelineRow,
  Comment,
} from "@/lib/api-types";
import { median, pct, r1 } from "@/lib/reportMath";
import { periodoRange, type FilterState } from "@/lib/useFilters";
import {
  computeSaludAggregate,
  computeClientRows,
  computeMonthlyTrend,
  inRange,
  filterEntities,
  filterForecast,
  makeEnrich,
  cdmxNow,
  cdmxDate,
  startOfWeek,
  isDemoName,
  isDemoForecast,
  isDemoMetric,
  isActiveMaterial,
  TERMINAL_STATUSES,
  type DemoIdSet,
} from "@/lib/mgmtHelpers";

// ─── QueryClient único ───────────────────────────────────────────────────
export const operacionQueryKey: QueryKey = ["operacion"];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

/** Invalida la única copia de datos: refresca todas las pantallas a la vez. */
// Varias invalidaciones seguidas (mutación + recarga manual + aviso en vivo)
// se juntan en una sola recarga.
let recargaPendiente: Promise<void> | null = null;
export function invalidateOperacion() {
  if (!recargaPendiente) {
    recargaPendiente = new Promise<void>((listo) =>
      setTimeout(async () => {
        recargaPendiente = null;
        await queryClient.invalidateQueries({ queryKey: operacionQueryKey });
        listo();
      }, 200),
    );
  }
  return recargaPendiente;
}

export interface CalidadItem {
  material_id: string;
  name: string;
  cliente: string | null;
  issues: string[];
}

export interface OperacionData {
  loading: boolean;
  error: string | null;
  clients: Client[];
  products: Product[];
  indications: Indication[];
  team: TeamMember[];
  materials: Material[];
  metrics: MaterialMetric[];
  forecast: MaterialForecast[];
  durations: StageDuration[];
  trend: MonthlyTrend[];
  workload: WorkloadRow[];
  businessUnits: BusinessUnit[];
  candado: CandadoEvent[];
  hierarchy: MaterialHierarchy[];
  timeline: TimelineStage[];
  riesgo: MaterialRiesgo[];
  paquetes: PaquetePendiente[];
  clientKpis: ClientKpi | null;
  clientTimeline: ClientTimelineRow[];
  clientMap: Record<string, string>;
  clientById: Record<string, Client>;
  teamById: Record<string, TeamMember>;
  /** Comentarios NO internos (los del cliente) por material, para el badge
   *  "comentario nuevo del cliente" en Kanban y Materiales. RLS filtra por
   *  client_id; los internos se excluyen. */
  comentariosCliente: Record<
    string,
    { count: number; lastAt: string | null; lastBy: string | null }
  >;
  /** Conjunto de material_id que son [DEMO]. Se construye desde la tabla base
   *  `materials` (titulo real con prefijo [DEMO) y se inyecta en TODOS los
   *  selectores, de modo que la detección DEMO no dependa de los campos que
   *  expongan las vistas. Es la ÚNICA fuente de verdad para el filtro DEMO. */
  demoIds: DemoIdSet;
}

const EMPTY: OperacionData = {
  loading: true,
  error: null,
  clients: [],
  products: [],
  indications: [],
  team: [],
  materials: [],
  metrics: [],
  forecast: [],
  durations: [],
  trend: [],
  workload: [],
  businessUnits: [],
  candado: [],
  hierarchy: [],
  timeline: [],
  riesgo: [],
  paquetes: [],
  clientKpis: null,
  clientTimeline: [],
  clientMap: {},
  clientById: {},
  teamById: {},
  comentariosCliente: {},
  demoIds: new Set<string>(),
};

async function safe<T>(
  name: string,
  fn: () => Promise<{ data: T[] | null; error: string | null }>,
  errors: string[],
): Promise<T[]> {
  try {
    const r = await fn();
    if (r.error) {
      errors.push(`${name}: ${r.error}`);
      // Registrar el error en consola: nunca se traga en silencio.
      console.error(`[operacion] ${name}:`, r.error);
      return [];
    }
    return r.data ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${name}: ${msg}`);
    console.error(`[operacion] ${name} (throw):`, msg);
    return [];
  }
}

/** Carga TODAS las tablas base y vistas de Supabase una sola vez. */
async function loadOperacion(): Promise<OperacionData> {
  const errors: string[] = [];
  const [
    clientList,
    products,
    indications,
    team,
    materials,
    metrics,
    durations,
    trend,
    workload,
    businessUnits,
    candado,
    forecastRaw,
    hierarchy,
    timeline,
    riesgo,
    paquetes,
    clientKpisRaw,
    clientTimelineRaw,
    commentsRaw,
  ] = await Promise.all([
    safe("clients", () => api.clients.list(), errors),
    safe("products", () => api.products.list(), errors),
    safe("indications", () => api.indications.list(), errors),
    safe("profiles", () => api.team.list(), errors),
    safe("materials", () => api.materials.list(), errors),
    safe("v_material_metrics", () => api.metrics.list(), errors),
    safe("v_stage_durations", () => api.stageDurations.list(), errors),
    safe("v_monthly_trend", () => api.monthlyTrend.list(), errors),
    safe("v_workload", () => api.workload.list(), errors),
    safe("business_units", () => api.businessUnits.list(), errors),
    safe("candado_events", () => api.candadoEvents.list(), errors),
    safe("v_material_forecast", () => api.forecast.list(), errors),
    safe("v_material_hierarchy", () => api.hierarchy.list(), errors),
    safe("v_material_timeline", () => api.timeline.list(), errors),
    safe("materiales_en_riesgo", () => api.riesgo.list(), errors),
    safe("paquetes_pendientes", () => api.paquetesPendientes.list(), errors),
    safe(
      "v_client_kpis",
      () =>
        api.clientKpis.get().then((r) => ({
          data: r.data ? [r.data] : [],
          error: r.error,
        })),
      errors,
    ),
    safe("v_client_timeline", () => api.clientTimeline.list(), errors),
    // Comentarios para el badge "comentario nuevo del cliente" en
    // Kanban/Materiales. RLS filtra por client_id; excluimos los internos.
    safe("comments", () => api.comments.allForBadge(), errors),
  ]);

  const clientMap: Record<string, string> = {};
  const clientById: Record<string, Client> = {};
  for (const cl of clientList) {
    clientMap[cl.id] = cl.name;
    clientById[cl.id] = cl;
  }
  const teamById: Record<string, TeamMember> = {};
  for (const tm of team) teamById[tm.id] = tm;

  // Mapa de jerarquía por material_id (v_material_hierarchy trae cliente,
  // producto, indicación, responsable y folio resueltos para TODOS los
  // materiales, incluidos los terminales/históricos que las vistas de
  // forecast/metrics dejan sin client_id).
  const hierMap: Record<string, MaterialHierarchy> = {};
  for (const h of hierarchy) hierMap[h.material_id] = h;

  // Cliente canonico: client_id -> clients.name (no client_name de la vista).
  // Si la vista no trae client_id, se resuelve el nombre desde la jerarquía.
  const enrichedMetrics: MaterialMetric[] = metrics.map((row) => {
    const h = hierMap[row.material_id];
    return {
      ...row,
      client_name: row.client_id
        ? (clientMap[row.client_id] ?? row.client_name ?? null)
        : (row.client_name ?? h?.cliente ?? null),
      responsible_name: row.responsible_name ?? h?.responsable ?? null,
    };
  });

  const enrich = makeEnrich(hierarchy, clientMap);
  const forecast: MaterialForecast[] = forecastRaw.map(enrich);

  // Enriquecer materials (tabla base) con los joins que viven en metrics y
  // hierarchy: la tabla base no tiene client_id/product_id/indication_id, así
  // que los tomamos de v_material_metrics (que sí trae los IDs) y los nombres
  // de v_material_hierarchy. Sin esto, Kanban y Materiales no muestran cliente.
  const metricById: Record<string, MaterialMetric> = {};
  for (const m of enrichedMetrics) metricById[m.material_id] = m;
  const enrichedMaterials: Material[] = materials.map((m) => {
    const met = metricById[m.id];
    const h = hierMap?.[m.id];
    return {
      ...m,
      client_id: met?.client_id ?? (m as any).cliente_id ?? m.client_id ?? null,
      client_name:
        (met?.client_id ? clientMap[met.client_id] : null) ??
        h?.cliente ??
        m.client_name ??
        null,
      product_id: met?.product_id ?? (m as any).producto_id ?? m.product_id ?? null,
      product_name: met?.product_name ?? h?.producto ?? m.product_name ?? null,
      indication_id: met?.indication_id ?? (m as any).indicacion_id ?? m.indication_id ?? null,
      indication_name:
        met?.indication_name ?? h?.indicacion ?? m.indication_name ?? null,
      responsible_id: met?.responsible_id ?? m.responsible_id ?? null,
      responsible_name:
        met?.responsible_name ?? h?.responsable ?? m.responsible_name ?? null,
      folio: m.folio ?? h?.folio ?? met?.folio ?? null,
    } as Material;
  });

  // ─── Mapa DEMO central ───────────────────────────────────────────────────
  // Se construye desde TODAS las fuentes posibles para que la detección DEMO
  // sea robusta sin importar qué campos expongan las vistas:
  //  1. Tabla base `materials` (titulo real con prefijo [DEMO).
  //  2. v_material_metrics (name / product_name / client_name).
  //  3. v_material_forecast (titulo / producto / cliente).
  //  4. v_material_hierarchy (cliente / producto).
  // Cualquier material_id que aparezca con [DEMO en cualquiera se marca. Así
  // los KPIs históricos, la gráfica por etapa, "quién retiene" y la tabla por
  // cliente filtran DEMO de forma idéntica al dashboard.
  const demoIds: DemoIdSet = new Set<string>();
  for (const m of materials) if (isDemoName(m.name)) demoIds.add(m.id);
  for (const m of enrichedMetrics)
    if (
      isDemoName(m.name) ||
      isDemoName(m.product_name) ||
      isDemoName(m.client_name)
    )
      demoIds.add(m.material_id);
  for (const f of forecast)
    if (isDemoName(f.titulo) || isDemoName(f.producto) || isDemoName(f.cliente))
      demoIds.add(f.material_id);
  for (const h of hierarchy)
    if (isDemoName(h.cliente) || isDemoName(h.producto))
      demoIds.add(h.material_id);

  // Comentarios NO internos (del cliente) por material, para el badge en
  // Kanban/Materiales. RLS filtra por client_id; los internos se excluyen.
  const comentariosCliente: Record<
    string,
    { count: number; lastAt: string | null; lastBy: string | null }
  > = {};
  for (const c of commentsRaw) {
    if (c.interno) continue;
    const cur = comentariosCliente[c.material_id] ?? {
      count: 0,
      lastAt: null,
      lastBy: null,
    };
    cur.count += 1;
    if (!cur.lastAt || (c.created_at && c.created_at > cur.lastAt)) {
      cur.lastAt = c.created_at ?? cur.lastAt;
      cur.lastBy = c.author_name ?? cur.lastBy;
    }
    comentariosCliente[c.material_id] = cur;
  }

  return {
    loading: false,
    error: errors.length ? errors.join("; ") : null,
    clients: clientList,
    products,
    indications,
    team,
    materials: enrichedMaterials,
    metrics: enrichedMetrics,
    forecast,
    durations,
    trend,
    workload,
    businessUnits,
    candado,
    hierarchy,
    timeline,
    riesgo,
    paquetes,
    clientKpis: clientKpisRaw[0] ?? null,
    clientTimeline: clientTimelineRaw,
    clientMap,
    clientById,
    teamById,
    comentariosCliente,
    demoIds,
  };
}

/** Hook que carga la operación una sola vez y la comparte con toda la app. */
export function useOperacion(): OperacionData & { reload: () => void } {
  const qc = useQueryClient();
  const query = useQuery<OperacionData>({
    queryKey: operacionQueryKey,
    queryFn: loadOperacion,
  });
  void qc;
  const reload = useCallback(() => {
    void invalidateOperacion();
  }, []);
  // El mismo objeto mientras no cambien los datos: las pantallas no recalculan de más.
  const base = query.data ?? EMPTY;
  const loading = !query.data && query.isLoading;
  const err = query.error?.message ?? base.error;
  return useMemo(
    () => ({ ...base, loading, error: err, reload }),
    [base, loading, err, reload],
  );
}

// ─── Selectores únicos (fuente de verdad para todas las pantallas) ──────────
export function periodWindows(f: FilterState) {
  const { desde, hasta } = periodoRange(f.periodo, f.fechaDesde, f.fechaHasta);
  const span = desde ? hasta.getTime() - desde.getTime() : 90 * 86400000;
  const prevHasta = desde
    ? new Date(desde.getTime() - 1)
    : new Date(hasta.getTime() - 90 * 86400000);
  return {
    desde,
    hasta,
    prevDesde: new Date(prevHasta.getTime() - span),
    prevHasta,
  };
}

export function selectMetrics(data: OperacionData, f: FilterState) {
  return filterEntities(data.metrics, f, data.demoIds);
}

export function selectAprobados(
  data: OperacionData,
  f: FilterState,
  previo = false,
) {
  const w = periodWindows(f);
  const desde = previo ? w.prevDesde : w.desde;
  const hasta = previo ? w.prevHasta : w.hasta;
  return filterEntities(data.metrics, f, data.demoIds).filter((m) =>
    inRange(m.aprobado_at, desde, hasta),
  );
}

export function selectSalud(data: OperacionData, f: FilterState) {
  const fForecast = filterForecast(data.forecast, f, data.demoIds);
  const blockedIds = new Set(data.candado.map((c) => c.material_id));
  return computeSaludAggregate(fForecast, blockedIds);
}

export function selectEnRiesgo(data: OperacionData, f: FilterState) {
  // Misma definición que selectEnRiesgoMateriales: vencida ∪ tarde ∪ bloqueado,
  // contando material_id distintos. Se calcula desde el forecast filtrado
  // (cliente + DEMO) para no contradecir al dashboard ni a /riesgo.
  const rows = selectEnRiesgoMateriales(data, f);
  return new Set(rows.map((r) => r.material_id)).size;
}

export type MotivoRiesgo = "entrega_vencida" | "llegaria_tarde" | "bloqueado";

export interface RiesgoUnifiedRow {
  material_id: string;
  titulo: string | null;
  cliente: string | null;
  status: string;
  motivo: MotivoRiesgo;
  motivoLabel: string;
  dias: number | null;
  responsable: string | null;
  folio: number | null;
}

const MOTIVO_LABEL: Record<MotivoRiesgo, string> = {
  entrega_vencida: "Entrega vencida",
  llegaria_tarde: "Tarde (sin bloqueo)",
  bloqueado: "Bloqueado",
};
const MOTIVO_PRIO: Record<MotivoRiesgo, number> = {
  entrega_vencida: 0,
  bloqueado: 1,
  llegaria_tarde: 2,
};

export function selectEnRiesgoMateriales(
  data: OperacionData,
  f: FilterState,
): RiesgoUnifiedRow[] {
  const tMs = cdmxNow().getTime();
  const blockedIds = new Set(data.candado.map((c) => c.material_id));
  const fForecast = filterForecast(data.forecast, f, data.demoIds);
  const rows: RiesgoUnifiedRow[] = [];
  for (const fc of fForecast) {
    if (!isActiveMaterial(fc.status)) continue;
    const entrega = fc.entrega_estimada ? cdmxDate(fc.entrega_estimada) : null;
    const vencida = entrega != null && entrega.getTime() < tMs;
    const tarde = !vencida && fc.estado_pronostico === "tarde";
    const bloqueado = blockedIds.has(fc.material_id);
    if (!vencida && !tarde && !bloqueado) continue;
    let dias: number | null = null;
    if (vencida && entrega)
      dias = Math.floor((tMs - entrega.getTime()) / 86400000);
    else if (tarde && fc.margen_dias != null) dias = fc.margen_dias;
    let motivo: MotivoRiesgo = "llegaria_tarde";
    if (vencida) motivo = "entrega_vencida";
    else if (bloqueado) motivo = "bloqueado";
    rows.push({
      material_id: fc.material_id,
      titulo: fc.titulo,
      cliente: fc.cliente ?? null,
      status: fc.status,
      motivo,
      motivoLabel: MOTIVO_LABEL[motivo],
      dias,
      responsable: fc.responsable ?? null,
      folio: fc.folio ?? null,
    });
  }
  rows.sort(
    (a, b) =>
      MOTIVO_PRIO[a.motivo] - MOTIVO_PRIO[b.motivo] ||
      (b.dias ?? -Infinity) - (a.dias ?? -Infinity),
  );
  return rows;
}

export function selectBloqueosPeriodo(data: OperacionData, f: FilterState) {
  const w = periodWindows(f);
  const allowed = new Set(
    filterEntities(data.metrics, f, data.demoIds).map((m) => m.material_id),
  );
  return data.candado.filter(
    (c) =>
      allowed.has(c.material_id) && inRange(c.created_at, w.desde, w.hasta),
  ).length;
}

export function selectTendencia(data: OperacionData, f: FilterState) {
  // Siempre se calcula en el frontend para garantizar 6 meses calendario
  // reales (oct 26, nov 26...) contando solicitados por fecha_solicitud y
  // aprobados por aprobado_at. La vista v_monthly_trend puede venir vacía o
  // concentrada en un solo mes, lo que producía "sep 26" repetido en las 6
  // barras. computeMonthlyTrend respeta el filtro hideDemo.
  const w = periodWindows(f);
  return computeMonthlyTrend(selectMetrics(data, f), w.hasta, 6);
}

export function selectSaludPorCliente(
  data: OperacionData,
  f: FilterState,
  agrupar: "cliente" | "producto" | "indicacion" = "cliente",
) {
  const w = periodWindows(f);
  const fc = filterForecast(data.forecast, f, data.demoIds);
  return computeClientRows(
    fc,
    filterEntities(data.metrics, f, data.demoIds),
    data.candado,
    w.desde,
    w.hasta,
    f.hideDemo,
    data.demoIds,
    agrupar,
  );
}

// Estado de entidad: el esquema real usa enum entity_status con valores en
// español ("activo"/"inactivo"). El único selector vive en src/lib/enums.ts
// y se re-exporta aquí para que toda la app lo consuma desde la capa única.
export { isEntityActive, isClienteActivo } from "@/lib/enums";
export {
  ENTITY_STATUS,
  MATERIAL_STATUS,
  TERMINAL_STATUS_VALUES,
  ESTADO_PRONOSTICO,
  TIMELINE_TIPO,
  DEPENDE_DE,
  FECHA_CATEGORIA,
} from "@/lib/enums";

export function selectCalidad(
  data: OperacionData,
  f?: FilterState,
): {
  total: number;
  items: CalidadItem[];
} {
  // Mapa de jerarquía para resolver nombre y responsable de TODOS los
  // materiales (incluidos los terminales/históricos que las vistas dejan
  // sin client_id/responsible_name). Es la MISMA fuente que usa /riesgo.
  const hierMap: Record<string, MaterialHierarchy> = {};
  for (const h of data.hierarchy) hierMap[h.material_id] = h;
  const matMap: Record<string, Material> = {};
  for (const mat of data.materials) matMap[mat.id] = mat;
  const hideDemo = f?.hideDemo ?? true;
  const items: CalidadItem[] = [];
  for (const m of data.metrics) {
    // El filtro DEMO es global: respeta hideDemo (prefijo [DEMO en nombre,
    // producto o cliente, o material_id en el mapa DEMO central) igual que el
    // resto de las pantallas.
    if (hideDemo && isDemoMetric(m, data.demoIds)) continue;
    if (f?.clientId && m.client_id !== f.clientId) continue;
    const h = hierMap[m.material_id];
    // Nombre del MATERIAL: el de la tabla materials (titulo), no el de la
    // métrica (que puede ser el producto). Igual que /riesgo.
    const mat = matMap[m.material_id];
    const name = mat?.name || m.name || h?.producto || m.material_id;
    // Responsable: el de la métrica, o el de la jerarquía (igual que /riesgo).
    const responsable = m.responsible_name ?? h?.responsable ?? null;
    const issues: string[] = [];
    // Solo se marca lo que realmente falta para la trazabilidad y los
    // reportes: responsable, fecha requerida (si no es terminal),
    // fecha de solicitud, y consistencia aprobado >= solicitud.
    if (!responsable) issues.push("sin responsable");
    if (!m.fecha_requerida_cliente && !TERMINAL_STATUSES.has(m.status))
      issues.push("sin fecha requerida");
    if (!m.fecha_solicitud) issues.push("sin fecha de solicitud");
    if (
      m.aprobado_at &&
      m.fecha_solicitud &&
      new Date(m.aprobado_at) < new Date(m.fecha_solicitud)
    )
      issues.push("aprobado antes de la solicitud");
    if (issues.length) {
      items.push({
        material_id: m.material_id,
        name,
        cliente: m.client_id
          ? (data.clientMap[m.client_id] ?? null)
          : (h?.cliente ?? null),
        issues,
      });
    }
  }
  return { total: items.length, items };
}

// Re-export de mutaciones y lecturas (módulos enfocados).
export {
  mutateChangeStatus,
  mutateSetFecha,
  mutateSetFechaRequeridaCliente,
  mutateSetVisibleCliente,
  mutateIniciarTrabajo,
  mutateUpdateMaterial,
  mutateUpdateClientLabels,
  mutateMarkFinalPackageItem,
  mutateCreateComment,
  mutateCreateClient,
  mutateUpdateClient,
  mutateRemoveClient,
  mutateCreateProduct,
  mutateUpdateProduct,
  mutateRemoveProduct,
  mutateCreateIndication,
  mutateUpdateIndication,
  mutateRemoveIndication,
  getCommitmentHistory,
  getFinalPackageItems,
  getComments,
  getApprovals,
  fetchProfiles,
  mutateClientDecision,
} from "./mutations";

// Realtime + BroadcastChannel.
export { startRealtime, stopRealtime, useRealtimeStatus } from "./realtime";
export type { RtStatus } from "./realtime";

export const resetOperacionCache = invalidateOperacion;

export {
  computeSaludAggregate,
  computeMonthlyTrend,
  computeClientRows,
  filterEntities,
  makeEnrich,
  inRange,
  cdmxNow,
  cdmxDate,
  startOfWeek,
  isDemoName,
  TERMINAL_STATUSES,
  median,
  pct,
  r1,
  periodoRange,
};

export type { FilterState };
