import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StorageService, type StoredFile } from "@/lib/storage";
import { mutateClientDecision } from "@/data/operacion";
import type { Material } from "@/lib/api-types";
import { isClienteAprobacion } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

/**
 * Panel de aprobación del cliente. Solo visible cuando el material está en una
 * etapa de aprobación de cliente (medico o gráfico).
 * - "Aprobar" avanza la etapa a la siguiente (client_decision → aprobado).
 * - "Solicitar cambios" regresa a la etapa de desarrollo correspondiente y
 *   exige un comentario (se notifica a Spark225).
 * La decisión es siempre sobre una versión específica (la vigente); si se
 * sube una versión nueva, la aprobación previa no aplica a ella (lo garantiza
 * el registro inmutable con version_id).
 */
export const ApprovalPanel = ({
  material,
  onDone,
}: {
  material: Material;
  onDone: () => void;
}) => {
  const [open, setOpen] = useState<"aprobado" | "cambios" | null>(null);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  // Versión sobre la que se decide: la última que se subió (no la de número
  // más alto entre todos los archivos). "error" impide decidir a ciegas.
  const [vigente, setVigente] = useState<StoredFile | null>(null);
  const [versionEstado, setVersionEstado] = useState<"cargando" | "ok" | "sin_archivos" | "error">("cargando");

  const canDecide = isClienteAprobacion(material.status);

  // Resuelve la versión vigente (mayor versión) al abrir el panel.
  const openDialog = async (decision: "aprobado" | "cambios") => {
    setComentario("");
    setOpen(decision);
    setVigente(null);
    setVersionEstado("cargando");
    try {
      const fs = await StorageService.listStrict(material.id);
      const ultima = [...fs].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "") || b.version - a.version)[0];
      setVigente(ultima ?? null);
      setVersionEstado(ultima ? "ok" : "sin_archivos");
    } catch {
      setVersionEstado("error");
    }
  };

  const confirm = async () => {
    if (open === "cambios" && !comentario.trim()) {
      toast.error("Para solicitar cambios debes incluir un comentario.");
      return;
    }
    if (versionEstado === "error" || versionEstado === "cargando") {
      toast.error("No pudimos confirmar qué versión estás revisando. Cierra y vuelve a intentarlo.");
      return;
    }
    setBusy(true);
    const res = await mutateClientDecision(
      material.id,
      open!,
      vigente?.id ?? null,
      comentario.trim(),
    );
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      open === "aprobado"
        ? "Material aprobado. Spark225 fue notificado."
        : "Cambios solicitados. Spark225 fue notificado.",
    );
    setOpen(null);
    onDone();
  };

  if (!canDecide) return null;

  return (
    <div className="rounded-[12px] border border-[#E37439]/30 bg-[#E37439]/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-[#E37439]" />
        <p className="text-sm font-bold text-[#0E1E2A]">
          Tu revisión es requerida
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Revisa la versión vigente del archivo y aprueba o solicita cambios. Tu
        decisión queda registrada y se notifica a Spark225.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="gap-2 bg-[#2E9E5B] hover:bg-[#238048] text-white"
          onClick={() => openDialog("aprobado")}
        >
          <CheckCircle2 className="h-4 w-4" /> Aprobar
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-[#D64545]/30 text-[#D64545] hover:bg-[#D64545]/5"
          onClick={() => openDialog("cambios")}
        >
          <Undo2 className="h-4 w-4" /> Solicitar cambios
        </Button>
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {open === "aprobado" ? "Aprobar material" : "Solicitar cambios"}
            </DialogTitle>
            <DialogDescription>
              {open === "aprobado"
                ? "Confirmas que la versión vigente del material cumple con lo solicitado. La etapa avanza y se notifica a Spark225."
                : "Describe los cambios necesarios. El material regresa a desarrollo y se notifica a Spark225. El comentario es obligatorio."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-[#DBDBDB] bg-[#F8F9FA] px-3 py-2 text-xs text-[#4E5964]">
              {versionEstado === "cargando" && "Buscando la versión vigente…"}
              {versionEstado === "ok" && vigente && (
                <>
                  Tu decisión aplica a <b className="text-[#0E1E2A]">{vigente.name}</b> · versión {vigente.version}
                </>
              )}
              {versionEstado === "sin_archivos" && "Este material aún no tiene archivos; la decisión queda registrada sin versión."}
              {versionEstado === "error" && (
                <span className="text-[#D64545]">No pudimos leer los archivos. Cierra y vuelve a intentarlo.</span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-comentario">
                {open === "cambios" ? (
                  <>
                    Comentario <span className="text-[#D64545]">*</span>
                  </>
                ) : (
                  "Comentario (opcional)"
                )}
              </Label>
              <Textarea
                id="ap-comentario"
                placeholder={
                  open === "cambios"
                    ? "Describe qué cambios necesitas…"
                    : "Comentario para Spark225 (opcional)…"
                }
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[90px] border-[#DBDBDB] focus-visible:ring-[#E37439]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirm}
              disabled={busy || versionEstado === "cargando" || versionEstado === "error" || (open === "cambios" && !comentario.trim())}
              className={cn(
                open === "aprobado"
                  ? "bg-[#2E9E5B] hover:bg-[#238048] text-white"
                  : "bg-[#E37439] hover:bg-[#C45B24] text-white",
              )}
            >
              {busy
                ? "Procesando…"
                : open === "aprobado"
                  ? "Confirmar aprobación"
                  : "Enviar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export type { StoredFile };
