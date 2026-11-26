// Portal del cliente. Misma estructura limpia que la vista de administrador
// (junta con Carlos, 25 nov 2026): encabezado con conteos y cambio de vista,
// lo que espera su revisión, indicadores por etapa en orden cronológico
// (por revisar → en desarrollo → aprobados → por producirse → entregados),
// tabla de materiales con búsqueda y filtros, y abajo sus productos con sus
// indicaciones médicas y las próximas entregas.
import { useMemo, useState } from "react";
import {
  Search,
  LayoutList,
  Columns3,
  GanttChartSquare,
  ArrowRight,
  CalendarClock,
  Truck,
  FolderOpen,
  FileText,
  ChevronRight,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Gantt } from "@/components/Gantt";
import { MaterialFicha } from "@/components/portal/MaterialFicha";
import { useOperacion } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import type { Material, ClientTimelineRow, MaterialMetric, MaterialForecast } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MOMENTOS,
  type Momento,
  momento,
  teToca,
  semaforo,
  TONO_CLASE,
  cuandoLlega,
  indicadores,
  diasHasta,
  momentoIndice,
  pasoHecho,
  indicacionesDe,
  INDICACIONES_PENDIENTE,
} from "@/lib/portalModelo";
import { cn } from "@/lib/utils";

type Vista = "lista" | "tablero" | "tiempo";

const fechaCorta = (f?: string | null) => (f ? formatDate(f) : "—");

const ClientPortal = () => {
  const { user } = useAuth();
  const data = useOperacion();
  const [vista, setVista] = useState<Vista>("lista");
  const [buscar, setBuscar] = useState("");
  const [producto, setProducto] = useState<string>("");
  const [indicacion, setIndicacion] = useState<string>("");
  const [momentoSel, setMomentoSel] = useState<Momento | "">("");
  const [ocultarEntregados, setOcultarEntregados] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Solo sus materiales visibles (la base ya lo filtra; aquí se refuerza).
  const mios: Material[] = useMemo(() => {
    const cid = user?.clientId ?? null;
    return data.materials.filter(
      (m) =>
        !!cid &&
        (m.client_id ?? (m as any).cliente_id) === cid &&
        m.visible_para_cliente !== false &&
        !data.demoIds.has(m.id) &&
        m.status !== "archivado",
    );
  }, [data.materials, data.demoIds, user?.clientId]);

  const metricas = useMemo(() => {
    const r: Record<string, MaterialMetric> = {};
    for (const x of data.metrics) r[x.material_id] = x;
    return r;
  }, [data.metrics]);
  const pronostico = useMemo(() => {
    const r: Record<string, MaterialForecast> = {};
    for (const x of data.forecast) r[x.material_id] = x;
    return r;
  }, [data.forecast]);

  const ind = useMemo(() => indicadores(mios, metricas), [mios, metricas]);
  const porRevisar = useMemo(
    () => mios.filter((m) => momento(m) === "revisar").sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? "")),
    [mios],
  );

  // Productos con sus indicaciones médicas (tabla indications, por producto)
  // y su avance. Si el producto aún no tiene indicaciones registradas, se usan
  // las de sus materiales; la lista completa llega con la tabla de Paco.
  const carpetas = useMemo(() => {
    const map = new Map<string, { nombre: string; materiales: Material[]; indicaciones: Set<string>; productoId: string | null }>();
    for (const m of mios) {
      const k = m.product_name ?? "Sin producto";
      if (!map.has(k)) map.set(k, { nombre: k, materiales: [], indicaciones: new Set(), productoId: m.product_id ?? null });
      const c = map.get(k)!;
      c.materiales.push(m);
    }
    for (const c of map.values()) {
      const medicas = indicacionesDe(c.productoId, data.indications);
      for (const n of medicas) c.indicaciones.add(n);
      if (!medicas.length) for (const m of c.materiales) if (m.indication_name) c.indicaciones.add(m.indication_name);
    }
    return [...map.values()].sort((a, b) => b.materiales.length - a.materiales.length);
  }, [mios, data.indications]);

  const productos = useMemo(() => carpetas.map((c) => c.nombre), [carpetas]);
  const indicaciones = useMemo(() => {
    const s = new Set<string>();
    for (const m of mios) if ((!producto || m.product_name === producto) && m.indication_name) s.add(m.indication_name);
    return [...s].sort();
  }, [mios, producto]);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return mios.filter((m) => {
      if (producto && (m.product_name ?? "Sin producto") !== producto) return false;
      if (indicacion && m.indication_name !== indicacion) return false;
      if (momentoSel && momento(m) !== momentoSel) return false;
      if (ocultarEntregados && momento(m) === "entregado") return false;
      if (q) {
        const t = `${m.name} ${m.product_name ?? ""} ${m.indication_name ?? ""} #${m.folio ?? ""}`.toLowerCase();
        if (!t.includes(q)) return false;
      }
      return true;
    });
  }, [mios, producto, indicacion, momentoSel, ocultarEntregados, buscar]);

  const proximas = useMemo(
    () =>
      mios
        .filter((m) => momento(m) !== "entregado")
        .map((m) => ({ m, f: cuandoLlega(m, pronostico[m.id]) }))
        .filter((x) => x.f)
        .sort((a, b) => a.f!.localeCompare(b.f!))
        .slice(0, 5),
    [mios, pronostico],
  );

  const hayFiltro = !!(producto || indicacion || momentoSel || buscar || ocultarEntregados);
  const limpiar = () => {
    setProducto("");
    setIndicacion("");
    setMomentoSel("");
    setBuscar("");
    setOcultarEntregados(false);
  };
  const irA = (m: Momento) => {
    setMomentoSel((x) => (x === m ? "" : m));
    document.getElementById("materiales")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const timeline: ClientTimelineRow[] = useMemo(() => {
    const ids = new Set(filtrados.map((m) => m.id));
    return data.clientTimeline.filter((r) => ids.has(r.material_id));
  }, [data.clientTimeline, filtrados]);

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const nombre = (user?.name ?? "").split(/[\s(]/)[0];
  const material = abierto ? mios.find((m) => m.id === abierto) ?? null : null;

  const activos = mios.filter((m) => momento(m) !== "entregado").length;

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Encabezado, como en la vista de administrador */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-[#7A8590] first-letter:uppercase">
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#0E1E2A]">Hola{nombre ? `, ${nombre}` : ""}</h1>
          <p className="text-[#4E5964]">
            {ind.revisar > 0 ? (
              <span className="font-semibold text-[#E37439]">
                {ind.revisar} {ind.revisar === 1 ? "material pendiente" : "materiales pendientes"} de tu revisión
              </span>
            ) : (
              "Sin materiales pendientes de tu revisión"
            )}
            {" · "}
            <span className="font-medium text-[#0E1E2A]">{activos} activos</span>
            {" · "}
            {ind.entregados} entregados
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-[#E3E6EA] bg-white p-1" role="tablist" aria-label="Vista">
          {(
            [
              ["lista", "Tabla", LayoutList],
              ["tablero", "Tablero", Columns3],
              ["tiempo", "Línea de tiempo", GanttChartSquare],
            ] as [Vista, string, typeof LayoutList][]
          ).map(([v, t, Ico]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                vista === v ? "bg-[#0E1E2A] text-white" : "text-[#4E5964] hover:bg-[#F6F7F8]",
              )}
            >
              <Ico className="h-3.5 w-3.5" /> {t}
            </button>
          ))}
        </div>
      </div>

      {/* Lo que espera su revisión (lo único que depende del cliente) */}
      {porRevisar.length > 0 && (
        <section aria-label="Pendientes de tu revisión" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {porRevisar.map((m, i) => {
            const espera = Math.max(0, -(diasHasta(m.updated_at) ?? 0));
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setAbierto(m.id)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="ssam-subir ssam-latido group flex flex-col gap-2 rounded-2xl border border-[#E37439]/35 bg-white p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#E37439]">
                    {m.status === "aprobacion_cliente_medico" ? "Contenido médico" : "Diseño"} · {espera === 0 ? "recibido hoy" : `en espera desde hace ${espera} d`}
                  </span>
                  {m.folio != null && <span className="font-mono text-[#9AA4B2]">#{m.folio}</span>}
                </div>
                <p className="text-[15px] font-bold leading-snug text-[#0E1E2A]">{m.name}</p>
                <p className="text-xs text-[#4E5964]">
                  {m.product_name ?? "—"}
                  {m.indication_name ? ` · ${m.indication_name}` : ""}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[#E37439] px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-[#C45B24]">
                  Revisar <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </section>
      )}

      {/* Etapas en orden cronológico; cada una filtra la tabla */}
      <section aria-label="Materiales por etapa">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {MOMENTOS.map((x, i) => {
            const valor = mios.filter((m) => momento(m) === x.id).length;
            const activo = momentoSel === x.id;
            const extra =
              x.id === "revisar" ? "dependen de ti"
              : x.id === "desarrollo" ? "con Spark225"
              : x.id === "aprobado" ? "en trámite de código"
              : x.id === "producir" ? "con código o en producción"
              : ind.entregados ? `${ind.entregadosATiempo} a tiempo` : "aún ninguno";
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => irA(x.id)}
                aria-pressed={activo}
                className={cn(
                  "flex flex-col items-start rounded-2xl border bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]",
                  activo ? "border-[#0E1E2A]" : "border-[#E3E6EA]",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#4E5964]">
                  <span className="text-[10px] font-bold tabular-nums text-[#9AA4B2]">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
                  {x.nombre}
                </span>
                <span className="mt-1 text-[28px] font-bold leading-none tabular-nums text-[#0E1E2A]">{valor}</span>
                <span className="mt-1 text-[11px] text-[#7A8590]">{extra}</span>
              </button>
            );
          })}
        </div>
        {ind.total > 0 && (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#EEF0F2]" aria-hidden="true">
            {MOMENTOS.map((x) => {
              const n = mios.filter((m) => momento(m) === x.id).length;
              return n ? <span key={x.id} style={{ width: `${(n / ind.total) * 100}%`, background: x.color }} title={`${x.nombre}: ${n}`} /> : null;
            })}
          </div>
        )}
      </section>

      {/* Materiales: tarjeta con búsqueda, filtros y tabla, como el administrador */}
      <Card id="materiales" className="scroll-mt-6 border-none shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-[#0E1E2A]">Materiales</h2>
            <p className="text-xs text-[#7A8590]">
              {filtrados.length} de {mios.length}
              {hayFiltro && (
                <button type="button" onClick={limpiar} className="ml-2 inline-flex items-center gap-0.5 font-semibold text-[#E37439] hover:underline">
                  <X className="h-3 w-3" /> quitar filtros
                </button>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8590]" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por nombre, producto o #folio"
                className="h-9 w-full rounded-xl border border-[#E3E6EA] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20"
              />
            </div>
            <Selector valor={producto} cambiar={(v) => { setProducto(v); setIndicacion(""); }} vacio="Todos los productos" opciones={productos} />
            <Selector valor={indicacion} cambiar={setIndicacion} vacio="Todas las indicaciones" opciones={indicaciones} />
            <Selector
              valor={momentoSel}
              cambiar={(v) => setMomentoSel(v as Momento | "")}
              vacio="Todas las etapas"
              opciones={MOMENTOS.map((x) => x.id)}
              etiqueta={(id) => MOMENTOS.find((x) => x.id === id)?.nombre ?? id}
            />
            <button
              type="button"
              onClick={() => setOcultarEntregados((v) => !v)}
              aria-pressed={ocultarEntregados}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
                ocultarEntregados ? "border-[#0E1E2A] bg-[#0E1E2A] text-white" : "border-[#E3E6EA] bg-white text-[#4E5964] hover:bg-[#F6F7F8]",
              )}
            >
              {ocultarEntregados ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {ocultarEntregados ? "Entregados ocultos" : "Ocultar entregados"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DBDBDB] bg-white py-14 text-center">
              <p className="text-sm font-semibold text-[#0E1E2A]">
                {mios.length === 0 ? "Aún no hay materiales en tu portal" : "Ningún material coincide con estos filtros"}
              </p>
              <p className="mt-1 text-xs text-[#7A8590]">
                {mios.length === 0 ? "Spark225 los habilitará aquí en cuanto arranquen." : "Quita algún filtro para ver más."}
              </p>
            </div>
          ) : vista === "lista" ? (
            <Lista materiales={filtrados} pronostico={pronostico} abrir={setAbierto} />
          ) : vista === "tablero" ? (
            <Tablero materiales={filtrados} abrir={setAbierto} />
          ) : (
            <Gantt
              rows={timeline.map((r) => ({
                material_id: r.material_id,
                material_name: r.name,
                client_name: r.product_name ?? null,
                status: r.etapa,
                fecha_inicio: r.fecha_inicio,
                fecha_fin: r.fecha_fin,
                dias: r.dias ?? 0,
                dias_en_cola: 0,
                dias_trabajo: r.dias ?? 0,
                en_curso: false,
                depende_de: null,
              }))}
              fechaComprometidaMap={Object.fromEntries(timeline.filter((r) => r.fecha_comprometida).map((r) => [r.material_id, r.fecha_comprometida]))}
              height={340}
              showToday
            />
          )}
        </CardContent>
      </Card>

      {/* Productos con indicaciones médicas + próximas entregas */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0E1E2A]">
              <FolderOpen className="h-4 w-4 text-[#E37439]" /> Productos
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Producto</TableHead>
                    <TableHead>
                      Indicaciones médicas
                      <span className="ml-1.5 whitespace-nowrap rounded-full bg-[#F5C245]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[#8A6200]" title={INDICACIONES_PENDIENTE}>
                        en actualización
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Materiales</TableHead>
                    <TableHead className="text-right">Por revisar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carpetas.map((c) => {
                    const activo = producto === c.nombre;
                    const pend = c.materiales.filter((m) => momento(m) === "revisar").length;
                    return (
                      <TableRow
                        key={c.nombre}
                        onClick={() => {
                          setProducto(activo ? "" : c.nombre);
                          setIndicacion("");
                          document.getElementById("materiales")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={cn("cursor-pointer hover:bg-muted/30", activo && "bg-[#FFF7F2]")}
                        aria-selected={activo}
                      >
                        <TableCell className="font-semibold text-[#0E1E2A]">{c.nombre}</TableCell>
                        <TableCell>
                          {c.indicaciones.size ? (
                            <div className="flex flex-wrap gap-1">
                              {[...c.indicaciones].map((n) => (
                                <span key={n} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4E5964]">{n}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9AA4B2]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.materiales.length}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", pend ? "font-semibold text-[#E37439]" : "text-[#9AA4B2]")}>{pend}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0E1E2A]">
              <Truck className="h-4 w-4 text-[#E37439]" /> Próximas entregas
            </h2>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-[#7A8590]">Sin entregas programadas por el momento.</p>
            ) : (
              <ol className="space-y-2">
                {proximas.map(({ m, f }) => {
                  const d = diasHasta(f);
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => setAbierto(m.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[#F6F7F8]">
                        <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-[#F6F7F8] py-1">
                          <span className="text-[10px] uppercase text-[#7A8590]">{new Date(f!).toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" })}</span>
                          <span className="text-lg font-bold leading-none text-[#0E1E2A]">{new Date(f!).getUTCDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#0E1E2A]">{m.name}</span>
                          <span className="block text-xs text-[#7A8590]">
                            Fecha estimada de entrega {d != null && d >= 0 ? (d === 0 ? "hoy" : `en ${d} días`) : "vencida"} · {MOMENTOS.find((x) => x.id === momento(m))!.corto}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      <MaterialFicha material={material} onClose={() => setAbierto(null)} onCambio={data.reload} />
    </div>
  );
};

function Selector({
  valor,
  cambiar,
  vacio,
  opciones,
  etiqueta = (x: string) => x,
}: {
  valor: string;
  cambiar: (v: string) => void;
  vacio: string;
  opciones: string[];
  etiqueta?: (x: string) => string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => cambiar(e.target.value)}
      className={cn(
        "h-9 rounded-xl border bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#E37439]/20",
        valor ? "border-[#E37439] text-[#0E1E2A]" : "border-[#E3E6EA] text-[#4E5964]",
      )}
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {etiqueta(o)}
        </option>
      ))}
    </select>
  );
}

/** Avance en las 5 etapas del cliente, en orden cronológico. */
export function Pasos({ material }: { material: Material }) {
  const i = momentoIndice(material);
  return (
    <span className="flex h-1 gap-0.5" title={MOMENTOS[i]?.nombre}>
      {MOMENTOS.map((x, k) => (
        <span key={x.id} className={cn("flex-1 rounded-full", pasoHecho(k, i) ? "bg-[#2E9E5B]" : k === i ? "bg-[#E37439]" : "bg-[#E3E6EA]")} />
      ))}
    </span>
  );
}

/** Tabla de materiales con la misma estructura que la del administrador. */
function Lista({ materiales, pronostico, abrir }: { materiales: Material[]; pronostico: Record<string, MaterialForecast>; abrir: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[280px]">Material / Producto</TableHead>
            <TableHead className="min-w-[160px]">Etapa actual</TableHead>
            <TableHead className="whitespace-nowrap">Fecha requerida</TableHead>
            <TableHead className="whitespace-nowrap">Fecha estimada de entrega</TableHead>
            <TableHead>Acción requerida</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Abrir</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materiales.map((m) => {
            const sem = semaforo(m);
            const toca = teToca(m);
            const mom = MOMENTOS.find((x) => x.id === momento(m))!;
            return (
              <TableRow key={m.id} onClick={() => abrir(m.id)} className="group cursor-pointer hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E37439]/8 text-[#E37439] transition-colors group-hover:bg-[#E37439] group-hover:text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold leading-none text-[#0E1E2A]">{m.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded border px-1 font-mono text-[10px] text-[#7A8590]">{m.folio != null ? `#${m.folio}` : "—"}</span>
                        <span className="truncate text-xs text-[#7A8590]">
                          {m.product_name ?? "—"}
                          {m.indication_name ? ` · ${m.indication_name}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#4E5964]">
                      <span className="h-2 w-2 rounded-full" style={{ background: mom.color }} />
                      {mom.nombre}
                    </span>
                    <Pasos material={m} />
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex flex-col gap-1 text-xs text-[#4E5964]">
                    {fechaCorta(m.fecha_requerida_cliente)}
                    <span className={cn("w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold", TONO_CLASE[sem.tono])}>{sem.label}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-xs text-[#4E5964]">
                    <CalendarClock className="h-3 w-3 text-[#9AA4B2]" />
                    {fechaCorta(cuandoLlega(m, pronostico[m.id]))}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs", toca ? "font-semibold text-[#E37439]" : "text-[#9AA4B2]")}>{toca || "Ninguna por ahora"}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4E5964] group-hover:text-[#0E1E2A]">
                    Detalles <ChevronRight className="h-4 w-4" />
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Tablero({ materiales, abrir }: { materiales: Material[]; abrir: (id: string) => void }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {MOMENTOS.map((col) => {
        const items = materiales.filter((m) => momento(m) === col.id);
        return (
          <div key={col.id} className="flex w-64 shrink-0 flex-col rounded-2xl bg-[#F3F4F6] p-2.5">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0E1E2A]">
                <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                {col.nombre}
              </span>
              <span className="text-xs tabular-nums text-[#7A8590]">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 && <p className="px-1.5 py-4 text-center text-[11px] text-[#9AA4B2]">Nada aquí</p>}
              {items.map((m, i) => {
                const sem = semaforo(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => abrir(m.id)}
                    style={{ animationDelay: `${i * 30}ms` }}
                    className={cn(
                      "ssam-subir rounded-xl border bg-white p-3 text-left shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]",
                      col.id === "revisar" ? "border-[#E37439]/40" : "border-transparent",
                    )}
                  >
                    <p className="text-[13px] font-semibold leading-snug text-[#0E1E2A]">{m.name}</p>
                    <p className="mt-1 truncate text-[11px] text-[#7A8590]">
                      {m.product_name ?? "—"}
                      {m.indication_name ? ` · ${m.indication_name}` : ""}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", TONO_CLASE[sem.tono])}>{sem.label}</span>
                      {m.folio != null && <span className="font-mono text-[10px] text-[#9AA4B2]">#{m.folio}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ClientPortal;
