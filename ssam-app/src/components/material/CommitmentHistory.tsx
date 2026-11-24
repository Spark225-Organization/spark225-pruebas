import React, { useEffect, useState } from "react";
import { User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCommitmentHistory } from "@/data/operacion";
import type { CommitmentDateChange } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";

export const CommitmentHistory = ({ materialId }: { materialId: string }) => {
  const [changes, setChanges] = useState<CommitmentDateChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getCommitmentHistory(materialId);
      if (active) {
        setChanges(res.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [materialId]);

  if (loading) return <Skeleton className="h-20 rounded-lg" />;
  if (changes.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Sin cambios de fecha registrados.
      </p>
    );

  return (
    <div className="relative space-y-4 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
      {changes.map((c) => (
        <div key={c.id} className="relative pl-7">
          <div className="absolute left-0 top-0.5 h-4 w-4 rounded-full border-2 border-background bg-[#E37439]" />
          <p className="text-xs font-semibold">
            {c.fecha_anterior ? formatDate(c.fecha_anterior) : "Sin fecha"} →{" "}
            <span className="text-[#E37439]">{formatDate(c.fecha_nueva)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{c.motivo}</p>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <User className="h-3 w-3" />
            {c.changed_by_name ?? c.changed_by} · {formatDate(c.changed_at)}
          </p>
        </div>
      ))}
    </div>
  );
};
