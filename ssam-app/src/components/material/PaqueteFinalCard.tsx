import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, User, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  mutateMarkFinalPackageItem,
  getFinalPackageItems,
} from "@/data/operacion";
import type { Material, FinalPackageItem } from "@/lib/api-types";
import { isPaqueteAtrasado, formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const PaqueteFinalCard = ({
  material,
  onDone,
}: {
  material: Material;
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<FinalPackageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getFinalPackageItems(material.id);
    setItems(res.data ?? []);
    setLoading(false);
  }, [material.id]);

  useEffect(() => {
    load();
  }, [load]);

  const isDelivered = (i: FinalPackageItem) => i.delivered || i.entregado;
  const itemName = (i: FinalPackageItem) => i.detalle ?? i.item_name ?? "Item";
  const deliveredByName = (i: FinalPackageItem) =>
    i.delivered_by_name ??
    i.entregado_by_name ??
    i.delivered_by ??
    i.entregado_by;
  const deliveredAt = (i: FinalPackageItem) => i.delivered_at ?? i.entregado_at;

  const complete = items.length > 0 && items.every((i) => isDelivered(i));
  const atrasado = isPaqueteAtrasado(material.codigos_registrados_at, complete);

  const toggle = async (item: FinalPackageItem) => {
    if (!user) return;
    const nextVal = !isDelivered(item);
    const res = await mutateMarkFinalPackageItem(
      item.id,
      nextVal,
      user.id,
      user.name,
    );
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.data) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data! : i)));
    } else {
      await load();
    }
    onDone();
  };

  const deliveredCount = items.filter((i) => isDelivered(i)).length;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-[#E37439]" />
              Paquete final
            </CardTitle>
            <CardDescription className="mt-1">
              Marca cada entrega del paquete final.
            </CardDescription>
          </div>
          {complete ? (
            <Badge className="bg-[#2E9E5B]/12 text-[#2E9E5B] border border-[#2E9E5B]/25">
              Completo
            </Badge>
          ) : (
            <Badge className="bg-[#F5C245]/16 text-[#B5840A] border border-[#F5C245]/40">
              {items.length - deliveredCount}/{items.length} pendientes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {atrasado && (
          <div className="flex items-center gap-2 rounded-lg bg-[#D64545]/10 px-3 py-2.5 text-[#D64545] text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Paquete final atrasado: han pasado más de 24 h desde el registro de
            códigos y el paquete no está completo.
          </div>
        )}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay items definidos para el paquete final de este material.
          </p>
        ) : (
          items.map((item) => {
            const done = isDelivered(item);
            return (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-lg border bg-white px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(item)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#E37439]"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      done && "line-through text-muted-foreground",
                    )}
                  >
                    {itemName(item)}
                  </p>
                  {done && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {deliveredByName(item) ?? "—"} ·{" "}
                      {formatDate(deliveredAt(item))}
                    </p>
                  )}
                </div>
                {done && (
                  <CheckCircle2 className="h-4 w-4 text-[#2E9E5B] shrink-0" />
                )}
              </label>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
