import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { mutateSetFechaRequeridaCliente as mutReq } from "@/data/mutations";
import type { Material } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

// "Lo que necesita el cliente" — fecha_requerida_cliente. La captura el
// Cliente Externo desde su portal (o el Admin en su nombre). Es distinta de
// fecha_comprometida (la compromete Creativo/Diseño). Los KPIs de cumplimiento
// se miden contra este campo. El cambio queda registrado con su historial.
export const FechaRequeridaClienteCard = ({
  material,
  onDone,
}: {
  material: Material;
  onDone: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const hasValue = !!material.fecha_requerida_cliente;

  const openModal = () => {
    setFecha(
      material.fecha_requerida_cliente ?? new Date().toISOString().slice(0, 10),
    );
    setMotivo(material.motivo_fecha_requerida ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!fecha) {
      toast.error("Seleccione una fecha.");
      return;
    }
    // Si ya existe una fecha y se cambia, exigir motivo (auditoría).
    if (
      hasValue &&
      fecha !== material.fecha_requerida_cliente &&
      !motivo.trim()
    ) {
      toast.error("Indique el motivo del cambio de fecha.");
      return;
    }
    setSaving(true);
    const res = await mutReq(material.id, fecha, motivo.trim() || undefined);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Fecha requerida actualizada.");
    setOpen(false);
    onDone();
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#1E3A5F]" />
            Fecha requerida por el cliente
          </CardTitle>
          {hasValue ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={openModal}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Cambiar fecha
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-2 bg-[#1E3A5F] hover:bg-[#163049] text-white"
              onClick={openModal}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Registrar fecha
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5",
            "bg-muted/20",
          )}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            {material.fecha_requerida_cliente
              ? formatDate(material.fecha_requerida_cliente)
              : "Sin fecha registrada"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {hasValue
            ? "Fecha en la que se requiere el material. Los KPIs de cumplimiento se miden contra esta fecha."
            : "Registre la fecha en la que se requiere el material. Los KPIs de cumplimiento se miden contra esta fecha."}
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fecha requerida por el cliente</DialogTitle>
            <DialogDescription>
              Fecha en la que el cliente necesita este material. El cambio queda
              registrado con quién y cuándo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="fecha-req" className="text-sm font-medium">
                Fecha
              </label>
              <Input
                id="fecha-req"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border-[#DBDBDB] focus-visible:ring-[#1E3A5F]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="motivo-req" className="text-sm font-medium">
                Motivo del cambio{" "}
                {hasValue && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (obligatorio al cambiar la fecha)
                  </span>
                )}
              </label>
              <Input
                id="motivo-req"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. adelanto solicitado por el cliente"
                className="border-[#DBDBDB] focus-visible:ring-[#1E3A5F]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving || !fecha}
              className="bg-[#1E3A5F] hover:bg-[#163049] text-white"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FechaRequeridaClienteCard;
