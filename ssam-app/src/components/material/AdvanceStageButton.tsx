import React, { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mutateChangeStatus } from "@/data/operacion";
import type { Material, Client } from "@/lib/api-types";
import {
  MATERIAL_STATUSES,
  STATUS_INDEX,
  statusLabel,
  type MaterialStatus,
} from "@/lib/statusModel";

export const AdvanceStageButton = ({
  material,
  client,
  onDone,
}: {
  material: Material;
  client: Client | null;
  onDone: () => void;
}) => {
  const idx = STATUS_INDEX[material.status];
  const next = MATERIAL_STATUSES[idx + 1] as MaterialStatus | undefined;
  const [busy, setBusy] = useState(false);
  if (!next) return null;

  const advance = async () => {
    setBusy(true);
    const res = await mutateChangeStatus(material.id, next);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Avanzado a: ${statusLabel(next, client)}`);
    onDone();
  };

  return (
    <Button
      onClick={advance}
      disabled={busy}
      className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white shadow-soft"
    >
      <ShieldCheck className="h-4 w-4" />
      {busy ? "Procesando..." : `Avanzar a ${statusLabel(next, client)}`}
    </Button>
  );
};
