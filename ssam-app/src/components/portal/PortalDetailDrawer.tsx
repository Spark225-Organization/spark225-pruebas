import {
  X,
  MessageSquare,
  History,
  CalendarDays,
  CalendarClock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileViewer } from "@/components/portal/FileViewer";
import { ApprovalPanel } from "@/components/portal/ApprovalPanel";
import { CommentThread } from "@/components/portal/CommentThread";
import { FechaRequeridaClienteCard } from "@/components/material/FechaRequeridaClienteCard";
import { useOperacion } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import type { Material, Client } from "@/lib/api-types";
import {
  clientStatusLabel,
  isClienteAprobacion,
  formatDate,
} from "@/lib/statusModel";
import { cn } from "@/lib/utils";

/**
 * Drawer lateral derecho con el detalle del material para el cliente.
 * Muestra: etapa en lenguaje para el cliente, fecha que necesita (editable por
 * el cliente), fecha comprometida por Spark225, semáforo, visor de la versión
 * vigente + historial de versiones, panel de aprobación (solo en etapa de
 * aprobación de cliente) y comentarios Spark225↔cliente.
 * OCULTO al cliente: Depende de, errores Spark, quién retiene, KPIs internos,
 * responsables internos, códigos internos, datos DEMO y otros clientes.
 */
export const PortalDetailDrawer = ({
  materialId,
  open,
  onClose,
}: {
  materialId: string | null;
  open: boolean;
  onClose: () => void;
}) => {
  const data = useOperacion();
  const { can } = useAuth();

  const material: Material | null = materialId
    ? (data.materials.find((m) => m.id === materialId) ?? null)
    : null;

  const client: Client | null = material?.client_id
    ? (data.clientById[material.client_id] ?? null)
    : null;

  // Semáforo del cliente: vencido / en riesgo / a tiempo, contra la fecha que
  // necesita el cliente (no la comprometida por Spark225).
  const semaforo = (() => {
    if (!material?.fecha_requerida_cliente) return null;
    if (
      material.status === "aprobado" ||
      material.status === "produccion" ||
      material.status === "implementado" ||
      material.status === "archivado"
    )
      return { label: "Aprobado", tone: "green" };
    const req = new Date(material.fecha_requerida_cliente);
    const hoy = new Date(new Date().toDateString());
    const diff = (req.getTime() - hoy.getTime()) / 86400000;
    if (diff < 0) return { label: "Vencido", tone: "red" };
    if (diff <= 3) return { label: "En riesgo", tone: "amber" };
    return { label: "A tiempo", tone: "green" };
  })();

  const toneClass: Record<string, string> = {
    green: "bg-[#2E9E5B]/12 text-[#2E9E5B] border border-[#2E9E5B]/25",
    amber: "bg-[#F5C245]/20 text-[#B5840A] border border-[#F5C245]/40",
    red: "bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel derecho */}
      <aside
        role="dialog"
        aria-label="Detalle del material"
        className={cn(
          "fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#DBDBDB] px-5 py-4">
          <div className="min-w-0">
            {material?.folio != null && (
              <p className="text-[11px] font-mono font-bold text-[#9AA4B2] mb-0.5">
                #{material.folio}
              </p>
            )}
            <h2 className="text-lg font-bold text-[#0E1E2A] leading-snug truncate">
              {material?.name ?? "Material"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {material?.product_name ?? "—"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 rounded-full"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body scrollable */}
        <ScrollArea className="flex-1 px-5 py-4">
          {material ? (
            <div className="space-y-5">
              {/* Etapa + semáforo */}
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#DBDBDB] bg-[#F8F9FA]/60 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Etapa actual
                  </p>
                  <p className="text-sm font-bold text-[#0E1E2A] mt-0.5">
                    {clientStatusLabel(material.status)}
                  </p>
                </div>
                {semaforo && (
                  <Badge
                    className={cn(
                      "text-[11px] font-bold border-0",
                      toneClass[semaforo.tone],
                    )}
                  >
                    {semaforo.label}
                  </Badge>
                )}
              </div>

              {/* Fechas: la que necesita el cliente (editable) + comprometida por Spark225 */}
              <div className="grid gap-3">
                {can("captureFechaRequerida") && (
                  <FechaRequeridaClienteCard
                    material={material}
                    onDone={data.reload}
                  />
                )}
                <div className="rounded-[12px] border border-[#DBDBDB] bg-white px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock className="h-4 w-4 text-[#4E5964]" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Fecha comprometida por Spark225
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#0E1E2A]">
                    {material.fecha_comprometida
                      ? formatDate(material.fecha_comprometida)
                      : "Por definir"}
                  </p>
                </div>
              </div>

              {/* Aprobación (solo en etapa de aprobación de cliente) */}
              <ApprovalPanel material={material} onDone={data.reload} />

              {/* Archivos: versión vigente + historial */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#E37439]" />
                  <h3 className="text-sm font-bold text-[#0E1E2A]">
                    Archivos y versiones
                  </h3>
                </div>
                <FileViewer materialId={material.id} />
              </div>

              <Separator />

              {/* Comentarios Spark225↔cliente */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-[#E37439]" />
                  <h3 className="text-sm font-bold text-[#0E1E2A]">
                    Comentarios con Spark225
                  </h3>
                </div>
                <CommentThread materialId={material.id} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Selecciona un material para ver el detalle.
            </p>
          )}
        </ScrollArea>
      </aside>
    </>
  );
};

export type { Material, Client };
// Re-export History for consumers that may want the icon.
export { History };
