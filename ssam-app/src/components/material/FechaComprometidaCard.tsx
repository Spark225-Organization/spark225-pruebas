import React, { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarPlus,
  History,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { mutateSetFecha } from "@/data/operacion";
import type { Material } from "@/lib/api-types";
import { isFechaVencida, formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

export const FechaComprometidaCard = ({
  material,
  onDone,
}: {
  material: Material;
  onDone: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [categoria, setCategoria] = useState("otro");
  const [saving, setSaving] = useState(false);

  const hasValue = !!material.fecha_comprometida;
  const vencida = isFechaVencida(material.fecha_comprometida, material.status);

  const openModal = () => {
    setFecha(
      material.fecha_comprometida ?? new Date().toISOString().slice(0, 10),
    );
    setMotivo("");
    setOpen(true);
  };

  const save = async () => {
    if (!motivo.trim()) {
      toast.error(
        "El motivo es obligatorio para cambiar la fecha comprometida.",
      );
      return;
    }
    setSaving(true);
    const res = await mutateSetFecha(
      material.id,
      fecha,
      motivo.trim(),
      categoria,
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Fecha comprometida actualizada.");
    setOpen(false);
    onDone();
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#E37439]" />
            Fecha comprometida
          </CardTitle>
          {hasValue ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={openModal}
            >
              <History className="h-3.5 w-3.5" /> Cambiar fecha
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white"
              onClick={openModal}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Capturar fecha
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5",
            vencida ? "border-[#D64545]/30 bg-[#D64545]/5" : "bg-muted/20",
          )}
        >
          {vencida ? (
            <AlertTriangle className="h-4 w-4 text-[#D64545] shrink-0" />
          ) : (
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span
            className={cn(
              "text-sm font-semibold",
              vencida ? "text-[#D64545]" : "text-foreground",
            )}
          >
            {material.fecha_comprometida
              ? formatDate(material.fecha_comprometida)
              : "Sin fecha capturada"}
          </span>
          {vencida && (
            <span className="text-[11px] text-[#D64545] ml-auto">Vencida</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {hasValue
            ? "Para modificar la fecha se requiere un motivo. El cambio queda registrado en el historial."
            : "Captura directamente la fecha comprometida para este material."}
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar fecha comprometida</DialogTitle>
            <DialogDescription>
              El motivo es obligatorio (candado de la base). El cambio queda
              registrado con quién y cuándo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Nueva fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border-[#DBDBDB] focus-visible:ring-[#E37439]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoría del cambio</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger
                  id="categoria"
                  className="border-[#DBDBDB] focus:ring-[#E37439]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spark225">Spark225</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="regulatorio">Regulatorio</SelectItem>
                  <SelectItem value="cambio_alcance">
                    Cambio de alcance
                  </SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">
                Motivo <span className="text-[#D64545]">*</span>
              </Label>
              <Textarea
                id="motivo"
                placeholder="¿Por qué se cambia la fecha comprometida?"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="min-h-[70px] border-[#DBDBDB] focus-visible:ring-[#E37439]"
              />
            </div>
            {hasValue && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Fecha anterior:{" "}
                <span className="font-semibold">
                  {formatDate(material.fecha_comprometida!)}
                </span>
              </div>
            )}
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
              disabled={saving || !motivo.trim()}
              className="bg-[#E37439] hover:bg-[#C45B24] text-white"
            >
              {saving ? "Guardando..." : "Guardar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
