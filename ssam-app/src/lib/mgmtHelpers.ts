import type {
  MaterialMetric,
  MaterialForecast,
  MaterialRiesgo,
  MaterialHierarchy,
  CandadoEvent,
  StageDuration,
  MonthlyTrend,
} from "@/lib/api-types";
import { r1, median, pct } from "@/lib/reportMath";
import { periodoRange, type FilterState } from "@/lib/useFilters";

const DAY = 1000 * 60 * 60 * 24;
export const TERMINAL_STATUSES = new Set<string>([
  "aprobado",
  "produccion",
  "implementado",
  "archivado",
]);

/** ¿Es un registro de demo? Marca el prefijo "[DEMO" en cualquier caso,
 *  sea "[DEMO]", "[DEMO LFB]" o "[demo] ...". Revisa cualquier texto. */
export function isDemoName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\[demo/i.test(name);
}

/** Conjunto de material_id que son DEMO. Se construye en operacion.ts desde
 *  la tabla base `materials` (titulo real con prefijo [DEMO) y se inyecta en
 *  todos los selectores. Así la detección DEMO NO depende de los campos que
 *  expongan las vistas (que pueden no traer el prefijo), sino del material_id,
 *  que es estable. */
export type DemoIdSet = Set<string>;

/** ¿Es un registro de demo en el forecast? Marca por material_id (mapa DEMO
 *  central) o, como respaldo, por titulo/producto/cliente. */
export function isDemoForecast(
  f: {
    material_id: string;
    titulo?: string | null;
    producto?: string | null;
    cliente?: string | null;
  },
  demoIds?: DemoIdSet,
): boolean {
  if (demoIds?.has(f.material_id)) return true;
  return (
    isDemoName(f.titulo) || isDemoName(f.producto) || isDemoName(f.cliente)
  );
}

/** ¿Es un registro de demo en v_material_metrics? Marca por material_id
 *  (mapa DEMO central) o, como respaldo, por name/product_name/client_name. */
export function isDemoMetric(
  m: {
    material_id: string;
    name?: string | null;
    product_name?: string | null;
    client_name?: string | null;
  },
  demoIds?: DemoIdSet,
): boolean {
  if (demoIds?.has(m.material_id)) return true;
  return (
    isDemoName(m.name) ||
    isDemoName(m.product_name) ||
    isDemoName(m.client_name)
  );
}

/** ¿Es un material activo (no terminal)? Única definición para toda la app. */
export function isActiveMaterial(status: string): boolean {
  return !TERMINAL_STATUSES.has(status);
}

/** Filtra el forecast por los filtros globales (cliente + DEMO).
 *  Única fuente para Dashboard, Planeación, En Riesgo y Clientes.
 *  Usa el mapa DEMO central (por material_id) además de los nombres. */
export function filterForecast(
  rows: MaterialForecast[],
  f: FilterState,
  demoIds?: DemoIdSet,
): MaterialForecast[] {
  return rows.filter((row) => {
    if (f.clientId && row.client_id !== f.clientId) return false;
    if (f.hideDemo && isDemoForecast(row, demoIds)) return false;
    return true;
  });
}

export function filterEntities(
  rows: MaterialMetric[],
  f: FilterState,
  demoIds?: DemoIdSet,
): MaterialMetric[] {
  return rows.filter((m) => {
    if (f.clientId && m.client_id !== f.clientId) return false;
    if (f.productId && m.product_id !== f.productId) return false;
    if (f.indicationId && m.indication_id !== f.indicationId) return false;
    if (f.responsibleId && m.responsible_id !== f.responsibleId) return false;
    // DEMO: marca por material_id (mapa central) y, como respaldo, por el
    // prefijo [DEMO en nombre, producto o cliente.
    if (f.hideDemo && isDemoMetric(m, demoIds)) return false;
    return true;
  });
}

export function inRange(
  d: string | null | undefined,
  desde: Date | null,
  hasta: Date,
): boolean {
  if (!d) return false;
  const x = new Date(d);
  if (desde && x < desde) return false;
  return x <= hasta;
}

export function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

// "Hoy" en zona America/Mexico_City como Date local a medianoche.
export function cdmxNow(): Date {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (ty: string) =>
    Number(parts.find((p) => p.type === ty)?.value ?? "0");
  return new Date(get("year"), get("month") - 1, get("day"));
}

// Interpreta una fecha de la base como día calendario en CDMX.
// Las date-only ("YYYY-MM-DD") se toman tal cual; las que tienen
// hora/zona se convierten con Intl a su día en CDMX.
export function cdmxDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(new Date(t));
    const get = (ty: string) =>
      Number(parts.find((p) => p.type === ty)?.value ?? "0");
    return new Date(get("year"), get("month") - 1, get("day"));
  } catch {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

export function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = cdmxDate(d) ?? new Date(d);
  return dt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

// Lunes de la semana de `d` (semana lun–dom) en calendario local.
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 = domingo
  const offset = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - offset);
  return x;
}

// ─── Folio ───────────────────────────────────────────────────────────────────
export function folioLabel(folio: number | null | undefined): string {
  return folio == null ? "—" : `#${folio}`;
}
export function folioMatch(
  folio: number | null | undefined,
  q: string,
): boolean {
  if (folio == null) return false;
  const s = String(folio);
  return s === q || s.startsWith(q);
}

// Une la jerarquía y el folio a una fila de forecast.
// El folio viene de v_material_hierarchy (columna folio agregada al final).
export function makeEnrich(
  hierarchy: MaterialHierarchy[],
  clientMap: Record<string, string>,
) {
  const hierMap: Record<string, MaterialHierarchy> = {};
  for (const h of hierarchy) hierMap[h.material_id] = h;
  return (f: MaterialForecast): MaterialForecast => {
    const h = hierMap[f.material_id];
    return {
      ...f,
      folio: f.folio ?? h?.folio ?? null,
      cliente:
        h?.cliente ?? (f.client_id ? clientMap[f.client_id] : null) ?? null,
      producto: h?.producto ?? null,
      indicacion: h?.indicacion ?? null,
      responsable: h?.responsable ?? null,
    };
  };
}

export function computeKpis(
  aprobadosPeriodo: MaterialMetric[],
  aprobadosPrevio: MaterialMetric[],
) {
  const reqTotal = aprobadosPeriodo.filter(
    (m) => m.a_tiempo_vs_requerida != null,
  ).length;
  const reqTrue = aprobadosPeriodo.filter(
    (m) => m.a_tiempo_vs_requerida === true,
  ).length;
  const reqPct = pct(reqTrue, reqTotal);
  const actTrue = aprobadosPeriodo.filter(
    (m) => m.a_tiempo_vs_actual === true,
  ).length;
  const actPct = pct(actTrue, reqTotal);
  const ciclos = aprobadosPeriodo
    .map((m) => m.ciclo_dias ?? 0)
    .filter((n) => n > 0);
  const ciclo = median(ciclos);
  const sc = [...ciclos].sort((a, b) => a - b);
  const p80 = sc.length ? sc[Math.floor(sc.length * 0.8)] : 0;
  const sinErrTotal = aprobadosPeriodo.filter(
    (m) => m.aprobado_sin_error_spark != null,
  ).length;
  const sinErrTrue = aprobadosPeriodo.filter(
    (m) => m.aprobado_sin_error_spark === true,
  ).length;
  const sinErrPct = pct(sinErrTrue, sinErrTotal);
  const primeraPct = pct(
    aprobadosPeriodo.filter((m) => m.aprobado_primera_ronda === true).length,
    sinErrTotal,
  );
  const totSpark = aprobadosPeriodo.reduce(
    (a, m) => a + (m.dias_spark225 ?? 0),
    0,
  );
  const totCliente = aprobadosPeriodo.reduce(
    (a, m) => a + (m.dias_cliente ?? 0),
    0,
  );
  const totReg = aprobadosPeriodo.reduce(
    (a, m) => a + (m.dias_regulatorio ?? 0),
    0,
  );
  const totDias = totSpark + totCliente + totReg;
  const sparkPct = totDias ? Math.round((totSpark / totDias) * 100) : 0;
  const clientePct = totDias ? Math.round((totCliente / totDias) * 100) : 0;
  const regPct = totDias ? Math.round((totReg / totDias) * 100) : 0;
  const prevReqPct = pct(
    aprobadosPrevio.filter((m) => m.a_tiempo_vs_requerida === true).length,
    aprobadosPrevio.filter((m) => m.a_tiempo_vs_requerida != null).length,
  );
  const prevCiclo = median(
    aprobadosPrevio.map((m) => m.ciclo_dias ?? 0).filter((n) => n > 0),
  );
  const prevSinErrPct = pct(
    aprobadosPrevio.filter((m) => m.aprobado_sin_error_spark === true).length,
    aprobadosPrevio.filter((m) => m.aprobado_sin_error_spark != null).length,
  );
  return {
    reqPct,
    reqTotal,
    actPct,
    ciclo,
    semanasPlaneacion: Math.ceil(p80 / 7),
    sinErrPct,
    sinErrTotal,
    primeraPct,
    sparkPct,
    clientePct,
    regPct,
    deltaReq: deltaPct(reqPct, prevReqPct),
    deltaCiclo:
      prevCiclo > 0
        ? Math.round(((prevCiclo - (ciclo || 0)) / prevCiclo) * 100)
        : null,
    deltaSinErr: deltaPct(sinErrPct, prevSinErrPct),
  };
}

export function computeBand(fForecast: MaterialForecast[]) {
  const ws = startOfWeek(cdmxNow());
  const horizon = new Date(ws);
  horizon.setDate(horizon.getDate() + 8 * 7);
  // Solo materiales ACTIVOS (no terminales): así "planeadas" es siempre un
  // subconjunto de "activos" y la banda no contradice a las tarjetas.
  const active = fForecast.filter((f) => isActiveMaterial(f.status));
  const inH = active.filter((f) => {
    if (!f.entrega_estimada) return false;
    const d = cdmxDate(f.entrega_estimada);
    if (!d) return false;
    return d >= ws && d < horizon;
  });
  const aTiempo = inH.filter((f) => f.estado_pronostico === "a_tiempo").length;
  const justo = inH.filter((f) => f.estado_pronostico === "justo").length;
  const tarde = inH.filter((f) => f.estado_pronostico === "tarde").length;
  // Materiales en la ventana sin estado pronosticado (sin fecha requerida).
  const sinFecha = inH.length - aTiempo - justo - tarde;
  return {
    planeadas: inH.length,
    aTiempo,
    justo,
    tarde,
    sinFecha,
    esperando: active.filter((f) => f.depende_de === "cliente").length,
  };
}

// ─── Agregado de "Salud por cliente" (única fuente de verdad) ─────────────────
// Usa exactamente las mismas reglas que las tarjetas por cliente de MgmtPlanning:
//  - entregaVencida: la fecha estimada de entrega ya pasó (CDMX).
//  - llegariaTarde: estado_pronostico === "tarde" pero la entrega aún no vence.
//  - bloqueados: el material tiene un candado activo.
//  - aTiempo: activos sin entrega vencida ni proyección tardía.
//  - enRiesgo: materiales distintos que son vencida O tarde O bloqueados.
// Sirve para los KPI compactos y los Insights, de modo que no haya
// contradicción entre el número del KPI, el Insight y la suma de tarjetas.
export function computeSaludAggregate(
  forecast: MaterialForecast[],
  blockedIds: Set<string>,
) {
  const tMs = cdmxNow().getTime();
  let activos = 0;
  let aTiempo = 0;
  let vencida = 0;
  let llegariaTarde = 0;
  let bloqueados = 0;
  const riskIds = new Set<string>();
  // Para el % a tiempo, el denominador son los activos CON fecha requerida:
  // un material sin fecha requerida no puede contar como "no a tiempo".
  let conFechaRequerida = 0;
  let aTiempoConFecha = 0;
  for (const f of forecast) {
    if (!isActiveMaterial(f.status)) continue;
    activos++;
    const entrega = f.entrega_estimada ? cdmxDate(f.entrega_estimada) : null;
    const entregaVencida = entrega != null && entrega.getTime() < tMs;
    const blocked = blockedIds.has(f.material_id);
    const tarde = !entregaVencida && f.estado_pronostico === "tarde";
    const aT = !entregaVencida && !tarde;
    if (entregaVencida) vencida++;
    if (tarde) llegariaTarde++;
    if (blocked) bloqueados++;
    if (aT) aTiempo++;
    // % a tiempo (proyección): solo sobre los que tienen fecha requerida.
    if (f.fecha_requerida_cliente) {
      conFechaRequerida++;
      if (aT) aTiempoConFecha++;
    }
    if (entregaVencida || tarde || blocked) riskIds.add(f.material_id);
  }
  // % a tiempo: si ningún material tiene fecha requerida → N/D (no 100%).
  const aTiempoPct =
    conFechaRequerida === 0
      ? null
      : Math.round((aTiempoConFecha / conFechaRequerida) * 100);
  return {
    activos,
    aTiempo,
    vencida,
    llegariaTarde,
    bloqueados,
    enRiesgo: riskIds.size,
    aTiempoPct,
  };
}

// ─── Filas de "Desempeño por cliente" ──────────────────────────────────────────
// Agrupa por el nombre del cliente (f.cliente, el mismo campo que las tarjetas
// de MgmtPlanning) y usa computeSaludAggregate para % a tiempo y en riesgo,
// de modo que la tabla coincida con las tarjetas. El ciclo / quién retiene /
// errores Spark vienen de los aprobados del periodo (v_material_metrics) con la
// MISMA función que los KPIs globales (computeKpis), así no hay contradicción.
// Se omite la fila "Sin cliente" (problema de calidad de dato a corregir en la
// base) y las filas sin activos ni aprobados (no aportan a la lectura).
export function computeClientRows(
  forecast: MaterialForecast[],
  metrics: MaterialMetric[],
  candado: CandadoEvent[],
  desde: Date | null,
  hasta: Date,
  hideDemo = false,
  demoIds?: DemoIdSet,
) {
  const blockedIds = new Set(candado.map((c) => c.material_id));
  const fcByClient: Record<string, MaterialForecast[]> = {};
  for (const f of forecast) {
    if (!isActiveMaterial(f.status)) continue;
    if (hideDemo && isDemoForecast(f, demoIds)) continue;
    const key = f.cliente ?? "Sin cliente";
    if (key === "Sin cliente") continue;
    (fcByClient[key] ??= []).push(f);
  }
  const mByClient: Record<string, MaterialMetric[]> = {};
  for (const m of metrics) {
    if (hideDemo && isDemoMetric(m, demoIds)) continue;
    const key = m.client_name ?? "Sin cliente";
    if (key === "Sin cliente") continue;
    (mByClient[key] ??= []).push(m);
  }
  const names = new Set([
    ...Object.keys(fcByClient),
    ...Object.keys(mByClient),
  ]);
  const rows: Array<{
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
  }> = [];
  for (const name of names) {
    const fc = fcByClient[name] ?? [];
    const ms = mByClient[name] ?? [];
    const salud = computeSaludAggregate(fc, blockedIds);
    // Aprobados del periodo (mismo criterio que los KPIs globales).
    const aprob = ms.filter((m) => inRange(m.aprobado_at, desde, hasta));
    // Ocultar clientes con 0 activos (la tabla es por cliente activo).
    if (salud.activos === 0) continue;
    // Ciclo mediano de los aprobados (igual que el KPI global).
    const ciclos = aprob.map((m) => m.ciclo_dias ?? 0).filter((n) => n > 0);
    const ciclo = median(ciclos);
    // Quién retiene el tiempo: % sobre el total de días (igual que el KPI).
    const ts = aprob.reduce((a, m) => a + (m.dias_spark225 ?? 0), 0);
    const tc = aprob.reduce((a, m) => a + (m.dias_cliente ?? 0), 0);
    const tr = aprob.reduce((a, m) => a + (m.dias_regulatorio ?? 0), 0);
    const td = ts + tc + tr;
    // Errores Spark por material aprobado (promedio).
    const errs = aprob.reduce((a, m) => a + (m.errores_spark ?? 0), 0);
    rows.push({
      name,
      isUnit: false,
      activos: salud.activos,
      aTiempoPct: salud.aTiempoPct,
      total: aprob.length,
      ciclo: r1(ciclo),
      sparkPct: td ? Math.round((ts / td) * 100) : 0,
      clientePct: td ? Math.round((tc / td) * 100) : 0,
      regPct: td ? Math.round((tr / td) * 100) : 0,
      erroresSpark: aprob.length ? errs / aprob.length : 0,
      enRiesgo: salud.enRiesgo,
    });
  }
  return rows.sort((a, b) => b.enRiesgo - a.enRiesgo || b.activos - a.activos);
}

// ─── Tendencia mensual (6 meses) calculada en el frontend ──────────────────────
// Construye una serie de los últimos 6 meses calendario terminando en el mes de
// `hasta`, contando solicitados por fecha_solicitud y aprobados por aprobado_at.
// Así la gráfica siempre muestra meses reales (oct 26, nov 26...) aunque la
// vista v_monthly_trend venga vacía o concentrada en un solo mes; los meses
// sin actividad quedan en 0.
export function computeMonthlyTrend(
  metrics: MaterialMetric[],
  hasta: Date,
  months = 6,
): MonthlyTrend[] {
  const end = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  const series: MonthlyTrend[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
    series.push({ mes: key, solicitados: 0, aprobados: 0 });
  }
  const idx: Record<string, number> = {};
  series.forEach((s, i) => (idx[s.mes.slice(0, 7)] = i));
  for (const m of metrics) {
    if (m.fecha_solicitud) {
      const k = String(m.fecha_solicitud).slice(0, 7);
      if (k in idx) series[idx[k]].solicitados! += 1;
    }
    if (m.aprobado_at) {
      const k = String(m.aprobado_at).slice(0, 7);
      if (k in idx) series[idx[k]].aprobados! += 1;
    }
  }
  return series;
}

export function computeWeeks(fForecast: MaterialForecast[]) {
  const today = cdmxNow();
  const tMs = today.getTime();
  const ws = startOfWeek(today);
  const arr: { start: Date; items: MaterialForecast[] }[] = [];
  for (let i = 0; i < 8; i++) {
    const start = new Date(ws);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    arr.push({
      start,
      items: fForecast
        .filter((f) => {
          if (!f.entrega_estimada) return false;
          const d = cdmxDate(f.entrega_estimada);
          if (!d) return false;
          if (d.getTime() < tMs) return false; // vencidos van aparte
          return d >= start && d < end;
        })
        .sort(
          (a, b) =>
            (cdmxDate(a.entrega_estimada)?.getTime() ?? 0) -
            (cdmxDate(b.entrega_estimada)?.getTime() ?? 0),
        ),
    });
  }
  return arr;
}

// Materiales con entrega_estimada anterior a hoy (CDMX).
export function computeVencidos(
  fForecast: MaterialForecast[],
): MaterialForecast[] {
  const tMs = cdmxNow().getTime();
  return fForecast
    .filter((f) => {
      if (!f.entrega_estimada) return false;
      const d = cdmxDate(f.entrega_estimada);
      return d != null && d.getTime() < tMs;
    })
    .sort(
      (a, b) =>
        (cdmxDate(a.entrega_estimada)?.getTime() ?? 0) -
        (cdmxDate(b.entrega_estimada)?.getTime() ?? 0),
    );
}

export function filterActiveForecast(
  fForecast: MaterialForecast[],
  tableFilter: "todos" | "tarde" | "cliente" | "14d",
  search: string,
): MaterialForecast[] {
  let rows = fForecast.filter((f) => !TERMINAL_STATUSES.has(f.status));
  if (tableFilter === "tarde")
    rows = rows.filter((f) => f.estado_pronostico === "tarde");
  if (tableFilter === "cliente")
    rows = rows.filter((f) => f.depende_de === "cliente");
  if (tableFilter === "14d") {
    const lim = new Date();
    lim.setDate(lim.getDate() + 14);
    rows = rows.filter(
      (f) => f.entrega_estimada && new Date(f.entrega_estimada) <= lim,
    );
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const isNumeric = /^\d+$/.test(q);
    rows = rows.filter(
      (f) =>
        (isNumeric && f.folio != null && String(f.folio) === q) ||
        (f.titulo ?? "").toLowerCase().includes(q) ||
        (f.producto ?? "").toLowerCase().includes(q) ||
        (f.indicacion ?? "").toLowerCase().includes(q) ||
        (f.cliente ?? "").toLowerCase().includes(q) ||
        folioMatch(f.folio, q) ||
        f.material_id.toLowerCase().includes(q),
    );
  }
  // Ordenar: coincidencia exacta de folio primero, luego por entrega estimada.
  return rows.sort((a, b) => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const isNumeric = /^\d+$/.test(q);
    if (isNumeric) {
      const aExact = a.folio != null && String(a.folio) === q ? 0 : 1;
      const bExact = b.folio != null && String(b.folio) === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
    }
    const da = a.entrega_estimada
      ? new Date(a.entrega_estimada).getTime()
      : Infinity;
    const db = b.entrega_estimada
      ? new Date(b.entrega_estimada).getTime()
      : Infinity;
    return da - db;
  });
}

// Devuelve el material_id con coincidencia exacta de folio (si la búsqueda
// es numérica y hay un folio que coincide exactamente), o null.
export function exactFolioMatch(
  fForecast: MaterialForecast[],
  search: string,
): string | null {
  const q = search.trim().toLowerCase().replace(/^#/, "");
  if (!q || !/^\d+$/.test(q)) return null;
  const exact = fForecast.find((f) => f.folio != null && String(f.folio) === q);
  return exact ? exact.material_id : null;
}

export function computeAtencion(
  fForecast: MaterialForecast[],
): MaterialForecast[] {
  const rows = fForecast.filter(
    (f) =>
      f.estado_pronostico === "tarde" ||
      f.estado_pronostico === "justo" ||
      f.depende_de === "cliente",
  );
  const byId: Record<string, MaterialForecast> = {};
  for (const r of rows) byId[r.material_id] = r;
  return Object.values(byId).sort((a, b) => {
    const ra =
      a.estado_pronostico === "tarde"
        ? 0
        : a.estado_pronostico === "justo"
          ? 1
          : 2;
    const rb =
      b.estado_pronostico === "tarde"
        ? 0
        : b.estado_pronostico === "justo"
          ? 1
          : 2;
    return ra - rb;
  });
}

export { periodoRange, inRange as inRangeDate };
