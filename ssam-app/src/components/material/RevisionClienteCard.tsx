import { useEffect, useState } from "react";
import { MessageSquare, CheckCircle2, Undo2, History } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getApprovals, getComments } from "@/data/operacion";
import type { ClientApproval, Comment } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

/**
 * Sección "Revisión del cliente" para el lado Spark225 (detalle interno).
 * Muestra el historial inmutable de aprobaciones del cliente (aprobar /
 * solicitar cambios) y los comentarios que el cliente dejó (los no internos).
 * No muestra comentarios internos: esos viven en el hilo colaborativo.
 */
export const RevisionClienteCard = ({ materialId }: { materialId: string }) => {
  const [approvals, setApprovals] = useState<ClientApproval[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, c] = await Promise.all([
        getApprovals(materialId),
        getComments(materialId),
      ]);
      if (!active) return;
      setApprovals(a.data ?? []);
      setComments(c.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [materialId]);

  const clientComments = (comments ?? []).filter((c) => !c.interno);
  const hasData = (approvals?.length ?? 0) > 0 || clientComments.length > 0;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-[#E37439]" />
          Revisión del cliente
        </CardTitle>
        <CardDescription>
          Aprobaciones y comentarios del cliente sobre este material.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvals === null || comments === null ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground py-2">
            El cliente aún no ha revisado este material.
          </p>
        ) : (
          <>
            {/* Historial de aprobaciones (inmutable) */}
            {approvals.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Decisiones del cliente
                </p>
                <div className="space-y-2">
                  {approvals.map((a) => {
                    const aprobado = a.decision === "aprobado";
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          aprobado
                            ? "border-[#2E9E5B]/25 bg-[#2E9E5B]/5"
                            : "border-[#D64545]/25 bg-[#D64545]/5",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[#0E1E2A]">
                            {aprobado ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#2E9E5B]" />
                            ) : (
                              <Undo2 className="h-3.5 w-3.5 text-[#D64545]" />
                            )}
                            {aprobado ? "Aprobado" : "Solicitó cambios"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                        {a.comentario && (
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {a.comentario}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{a.usuario_name ?? "Cliente"}</span>
                          {a.version_id && (
                            <Badge className="text-[9px] font-mono border-0 bg-muted text-muted-foreground h-4 px-1.5">
                              sobre v{idShort(a.version_id)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comentarios del cliente (no internos) */}
            {clientComments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" /> Comentarios del
                    cliente
                  </p>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2 pr-2">
                      {clientComments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg bg-[#E37439]/5 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0E1E2A]">
                              {c.author_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(c.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#0E1E2A] leading-relaxed">
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

function idShort(id: string): string {
  return id.slice(0, 4);
}
