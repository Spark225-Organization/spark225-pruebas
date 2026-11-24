import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { mutateUpdateMaterial } from "@/data/operacion";
import type { Material, Client } from "@/lib/api-types";

export const CodigosClienteCard = ({
  material,
  client,
  onDone,
}: {
  material: Material;
  client: Client | null;
  onDone: () => void;
}) => {
  const [vals, setVals] = useState({
    codigo_aprobacion_interna: "",
    codigo_regulatorio: "",
    id_sistema_aprobacion: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVals({
      codigo_aprobacion_interna: material.codigo_aprobacion_interna ?? "",
      codigo_regulatorio: material.codigo_regulatorio ?? "",
      id_sistema_aprobacion: material.id_sistema_aprobacion ?? "",
    });
  }, [material]);

  const save = async () => {
    setSaving(true);
    const res = await mutateUpdateMaterial(material.id, vals);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Códigos del cliente actualizados.");
    onDone();
  };

  const labels = {
    interno: client?.etiqueta_codigo_interno ?? "Código interno",
    regulatorio: client?.etiqueta_codigo_regulatorio ?? "Código regulatorio",
    sistema: client?.etiqueta_sistema_aprobacion ?? "Sistema de aprobación",
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Códigos del cliente</CardTitle>
        <CardDescription>
          Usa las etiquetas que {client?.name ?? "este laboratorio"} define para
          sus códigos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <CodeInput
          label={labels.interno}
          value={vals.codigo_aprobacion_interna}
          onChange={(v) =>
            setVals((s) => ({ ...s, codigo_aprobacion_interna: v }))
          }
        />
        <CodeInput
          label={labels.regulatorio}
          value={vals.codigo_regulatorio}
          onChange={(v) => setVals((s) => ({ ...s, codigo_regulatorio: v }))}
        />
        <CodeInput
          label={labels.sistema}
          value={vals.id_sistema_aprobacion}
          onChange={(v) => setVals((s) => ({ ...s, id_sistema_aprobacion: v }))}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="bg-[#E37439] hover:bg-[#C45B24] text-white"
        >
          {saving ? "Guardando..." : "Guardar códigos"}
        </Button>
      </CardFooter>
    </Card>
  );
};

const CodeInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold">{label}</Label>
    <Input
      value={value}
      placeholder="—"
      onChange={(e) => onChange(e.target.value)}
      className="border-[#DBDBDB] focus-visible:ring-[#E37439] font-mono text-sm"
    />
  </div>
);
