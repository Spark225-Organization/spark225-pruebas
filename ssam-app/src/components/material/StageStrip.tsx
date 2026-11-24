import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Material, Client } from "@/lib/api-types";
import {
  MATERIAL_STATUSES,
  STATUS_INDEX,
  statusLabel,
  dependeDe,
  DEPENDE_DE_META,
  type MaterialStatus,
} from "@/lib/statusModel";

export const StageStrip = ({
  material,
  client,
}: {
  material: Material;
  client: Client | null;
}) => {
  const currentIdx = STATUS_INDEX[material.status as MaterialStatus];
  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <div className="flex border-b overflow-x-auto">
        {MATERIAL_STATUSES.map((status, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isApprovedOrLater = idx >= STATUS_INDEX.aprobado;
          return (
            <div
              key={status}
              className={cn(
                "min-w-[150px] px-3 py-3 text-center border-r last:border-r-0 transition-colors relative",
                isCurrent ? "bg-[#E37439]/5" : "",
              )}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-4 ring-background",
                    isCompleted
                      ? "bg-[#2E9E5B] text-white"
                      : isCurrent
                        ? "bg-[#E37439] text-white animate-pulse"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider leading-tight",
                    isCurrent
                      ? "text-[#E37439]"
                      : isCompleted
                        ? "text-[#2E9E5B]"
                        : isApprovedOrLater
                          ? "text-muted-foreground/70"
                          : "text-muted-foreground",
                  )}
                >
                  {statusLabel(status, client)}
                </span>
              </div>
              {isCurrent && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E37439]" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const DependenciaBadge = ({ status }: { status: MaterialStatus }) => {
  const dep = dependeDe(status);
  const meta = DEPENDE_DE_META[dep];
  // "Depende de:" se imprime una sola vez; meta.label ya no trae el prefijo.
  return <Badge className={meta.classes}>Depende de: {meta.label}</Badge>;
};
