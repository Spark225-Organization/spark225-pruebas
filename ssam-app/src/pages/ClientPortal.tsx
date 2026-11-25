import { useMemo, useState } from "react";
import {
  Search,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  FileText,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalDetailDrawer } from "@/components/portal/PortalDetailDrawer";
import { KpiCard, EmptyReport } from "@/components/reportPrimitives";
import { Gantt } from "@/components/Gantt";
import { useOperacion } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import type { Material, ClientTimelineRow } from "@/lib/api-types";
import {
  clientStatusLabel,
  clientStepIndex,
  CLIENT_STEPS,
  isClienteAprobacion,
  formatDate,
} from "@/lib/statusModel";
import { SPARK_COLORS } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "esperan" | "proceso" | "aprobados";

/**
 * Portal del cliente (FASE 2A).
 * Reemplaza el correo como canal de revisión/aprobación entre Spark225 y el
 * cliente. El cliente solo ve SUS materiales (RLS por client_id). Lista con
 * folio, título, producto, etapa en lenguaje para el cliente, fecha que
 * necesita, fecha comprometida por Spark225 y semáforo. Filtros rápidos.
 * Contador de pendientes de aprobar. Detalle en drawer lateral con visor de
 * versión vigente, historial de versiones, fecha editable y comentarios.
 */
const ClientPortal = () => {
  const { user } = useAuth();
  const data = useOperacion();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // El cliente solo ve sus materiales: RLS filtra en la base por client_id,
  // pero reforzamos en el frontend. Además, Spark225 debe haber habilitado el
  // material con el switch "Visible para el cliente" (materials.visible_para_
  // cliente). Sin ese switch, el cliente no ve el material en su portal.
  // Ocultamos también datos DEMO y archivados.
  const myMaterials: Material[] = useMemo(() => {
    const cid = user?.clientId ?? null;
    return data.materials.filter(
      (m) =>
        // Sin laboratorio asignado no se muestra nada (antes mostraba todo).
        !!cid &&
        (m.client_id ?? (m as any).cliente_id) === cid &&
        m.visible_para_cliente !== false &&
        !data.demoIds.has(m.id) &&
        m.status !== "archivado",
    );
  }, [data.materials, data.demoIds, user?.clientId]);

  // Timeline del cliente (v_client_timeline) para el Gantt del portal.
  // RLS filtra por client_id en la base; aquí solo quitamos datos DEMO.
  const myTimeline: ClientTimelineRow[] = useMemo(
    () => data.clientTimeline.filter((r) => !data.demoIds.has(r.material_id)),
    [data.clientTimeline, data.demoIds],
  );

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const classify = (m: Material) => {
    if (
      m.status === "aprobado" ||
      m.status === "produccion" ||
      m.status === "implementado"
    )
      return "aprobados";
    if (isClienteAprobacion(m.status)) return "esperan";
    return "proceso";
  };

  const filtered = useMemo(() => {
    let list = myMaterials;
    if (filtro !== "todos") list = list.filter((m) => classify(m) === filtro);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.product_name ?? "").toLowerCase().includes(q) ||
          (m.folio != null && `#${m.folio}`.includes(q)),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myMaterials, filtro, search]);

  const pendientes = myMaterials.filter(
    (m) => classify(m) === "esperan",
  ).length;
  const enProceso = myMaterials.filter((m) => classify(m) === "proceso").length;
  const aprobados = myMaterials.filter(
    (m) => classify(m) === "aprobados",
  ).length;

  // Semáforo por material (contra la fecha que necesita el cliente).
  const semaforo = (m: Material) => {
    if (!m.fecha_requerida_cliente) return { label: "Sin fecha", tone: "gray" };
    if (
      m.status === "aprobado" ||
      m.status === "produccion" ||
      m.status === "implementado"
    )
      return { label: "Aprobado", tone: "green" };
    const req = new Date(m.fecha_requerida_cliente);
    const hoy = new Date(new Date().toDateString());
    const diff = (req.getTime() - hoy.getTime()) / 86400000;
    if (diff < 0) return { label: "Vencido", tone: "red" };
    if (diff <= 3) return { label: "En riesgo", tone: "amber" };
    return { label: "A tiempo", tone: "green" };
  };

  const toneClass: Record<string, string> = {
    green: "bg-[#2E9E5B]/12 text-[#2E9E5B] border border-[#2E9E5B]/25",
    amber: "bg-[#F5C245]/20 text-[#B5840A] border border-[#F5C245]/40",
    red: "bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25",
    gray: "bg-[#9AA3AD]/12 text-[#4E5964] border border-[#DBDBDB]",
  };

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-[12px]" />
        <Skeleton className="h-12 rounded-[12px]" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Materiales</h1>
        <p className="text-muted-foreground max-w-2xl mt-1">
          Bienvenido{user ? `, ${user.name}` : ""}. Sigue el avance de tus
          materiales, revisa las versiones y aprueba o solicita cambios aquí.
          Spark225 es notificado al instante.
        </p>
      </div>

      {/* Contador de pendientes de aprobar */}
      {pendientes > 0 && (
        <div className="flex items-center gap-3 rounded-[12px] border border-[#E37439]/30 bg-[#E37439]/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-[#E37439] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[#0E1E2A]">
              {pendientes} material{pendientes !== 1 ? "es" : ""} esperan tu
              aprobación
            </p>
            <p className="text-xs text-muted-foreground">
              Revisa la versión vigente y aprueba o solicita cambios.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-[#E37439] hover:bg-[#C45B24] text-white"
            onClick={() => setFiltro("esperan")}
          >
            Ver pendientes
          </Button>
        </div>
      )}

      {/* Filtros rápidos + buscador */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["todos", "Todos", myMaterials.length],
              ["esperan", "Esperan mi aprobación", pendientes],
              ["proceso", "En proceso", enProceso],
              ["aprobados", "Aprobados", aprobados],
            ] as [Filtro, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filtro === key
                  ? "bg-[#E37439] text-white"
                  : "border border-[#DBDBDB] bg-white text-[#4E5964] hover:bg-[#F8F9FA]",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  filtro === key ? "bg-white/20" : "bg-[#F8F9FA]",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
          <Input
            placeholder="Buscar #folio, título o producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-[#DBDBDB] focus-visible:ring-[#E37439]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyReport
          title={
            myMaterials.length === 0
              ? "Aún no hay datos suficientes"
              : "Sin materiales en este filtro"
          }
          desc={
            myMaterials.length === 0
              ? "Cuando Spark225 habilite el acceso a tus materiales, aparecerán aquí con su avance y versiones."
              : "Prueba con otro filtro o limpia la búsqueda."
          }
        />
      ) : (
        <Card className="border border-[#DBDBDB] shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#0E1E2A]">
              Materiales
            </CardTitle>
            <CardDescription>
              {filtered.length} material{filtered.length !== 1 ? "es" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#DBDBDB]">
              {filtered.map((m) => {
                const sem = semaforo(m);
                return (
                  <button
                    key={m.id}
                    onClick={() => openDetail(m.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8F9FA]/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E37439]/8 text-[#E37439]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {m.folio != null && (
                          <span className="text-[10px] font-mono font-bold text-[#9AA4B2]">
                            #{m.folio}
                          </span>
                        )}
                        <p className="truncate text-sm font-bold text-[#0E1E2A]">
                          {m.name}
                        </p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">
                        {m.product_name ?? "—"}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 text-xs shrink-0">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {m.fecha_requerida_cliente
                          ? formatDate(m.fecha_requerida_cliente)
                          : "Sin fecha"}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {m.fecha_comprometida
                          ? formatDate(m.fecha_comprometida)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className="text-[10px] font-semibold border-0 bg-[#0E1E2A]/8 text-[#0E1E2A]">
                        {clientStatusLabel(m.status)}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[9px] font-bold border-0",
                          toneClass[sem.tone],
                        )}
                      >
                        {sem.label}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gantt del cliente (solo sus materiales) */}
      {myTimeline.length > 0 && (
        <Card className="border border-[#DBDBDB] shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#0E1E2A]">
              Línea de tiempo de tus materiales
            </CardTitle>
            <CardDescription>
              Avance por etapa con fecha comprometida por Spark225.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Gantt
              rows={myTimeline.map((r) => ({
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
              fechaComprometidaMap={Object.fromEntries(
                myTimeline
                  .filter((r) => r.fecha_comprometida)
                  .map((r) => [r.material_id, r.fecha_comprometida]),
              )}
              height={300}
              showToday
            />
          </CardContent>
        </Card>
      )}

      <PortalDetailDrawer
        materialId={selectedId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default ClientPortal;
