import { useMemo } from "react";
import { AlertTriangle, Package, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOperacion,
  selectEnRiesgoMateriales,
  type RiesgoUnifiedRow,
} from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import { internalLabel } from "@/components/MgmtDetailPanel";
import { folioLabel } from "@/lib/mgmtHelpers";
import { cn } from "@/lib/utils";
import type { FilterState } from "@/lib/useFilters";

const MOTIVO_TONE: Record<string, string> = {
  entrega_vencida: "bg-[#D64545]/12 text-[#D64545] border-[#D64545]/25",
  llegaria_tarde: "bg-[#F5C245]/16 text-[#B5840A] border-[#F5C245]/40",
  bloqueado: "bg-[#0E1E2A]/10 text-[#0E1E2A] border-[#0E1E2A]/20",
};

const Riesgo = () => {
  const data = useOperacion();
  const { state: filters } = useFilters();

  const riesgoRows = useMemo(
    () => selectEnRiesgoMateriales(data, filters),
    [data, filters],
  );

  // Agrupar por motivo para el resumen.
  const porMotivo = useMemo(() => {
    const g: Record<string, RiesgoUnifiedRow[]> = {};
    for (const r of riesgoRows) (g[r.motivo] ??= []).push(r);
    return g;
  }, [riesgoRows]);

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-[12px]" />
        <Skeleton className="h-40 rounded-[12px]" />
      </div>
    );
  }

  const total = riesgoRows.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D64545]/10 text-[#D64545]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">En Riesgo</h1>
        </div>
        <p className="text-muted-foreground">
          Materiales con entrega vencida, que llegarían tarde (sin bloqueo) o
          bloqueados por candado.{" "}
          {total > 0
            ? `${total} materiales en riesgo.`
            : "Sin materiales en riesgo."}
        </p>
      </div>

      {/* Resumen por motivo */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ["entrega_vencida", "Entrega vencida"],
            ["llegaria_tarde", "Tarde (sin bloqueo)"],
            ["bloqueado", "Bloqueado"],
          ] as const
        ).map(([k, label]) => (
          <Card key={k} className="border border-[#DBDBDB] shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="text-[#4E5964]">{label}</span>
                <Badge className={cn("shrink-0", MOTIVO_TONE[k])}>
                  {porMotivo[k]?.length ?? 0}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Nota: un material puede aparecer en más de un motivo (p. ej. vencida y
        bloqueado). El total de la tabla cuenta materiales únicos.
      </p>

      {/* Tabla principal agrupada por motivo */}
      <Card className="border border-[#DBDBDB] shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#D64545]" />
              Materiales en riesgo
            </CardTitle>
            <Badge className="bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25">
              {total}
            </Badge>
          </div>
          <CardDescription>
            Misma definición que el dashboard: entrega vencida ∪ tarde (sin
            bloqueo) ∪ bloqueado por candado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <EmptyState text="No hay materiales en riesgo en este momento." />
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#E4E7EC]">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[#F8F9FA] text-[11px] text-[#4E5964]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">
                      Estado
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Material
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Etapa</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Responsable
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Impacto
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {riesgoRows.map((r) => (
                    <tr
                      key={r.material_id}
                      className={cn(
                        "hover:bg-muted/30",
                        r.motivo === "entrega_vencida" && "bg-[#D64545]/5",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <Badge
                          className={cn("text-[10px]", MOTIVO_TONE[r.motivo])}
                        >
                          {r.motivoLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-[#4E5964]">
                        {folioLabel(r.folio)}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[#0F1B2D] line-clamp-2">
                          {r.titulo ?? r.material_id}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[#4E5964]">
                        {r.cliente ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[#4E5964]">
                        {internalLabel(r.status, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-[#4E5964]">
                        {r.responsable ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.motivo === "entrega_vencida" ? (
                          <span className="text-[12px] font-bold text-[#D64545]">
                            +{r.dias ?? 0} d
                          </span>
                        ) : r.motivo === "llegaria_tarde" ? (
                          <span className="text-[12px] font-semibold text-[#B5840A]">
                            {r.dias != null ? `${r.dias} d` : "—"}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#4E5964]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to={`/materials/${r.material_id}`}
                          className="inline-flex items-center text-[#E37439] hover:underline"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección adicional: paquetes finales pendientes */}
      <Card className="border border-[#DBDBDB] shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-[#D64545]" />
                Paquetes finales pendientes
              </CardTitle>
              <CardDescription className="mt-1">
                Materiales con códigos registrados cuyo paquete final aún no se
                entrega completo (sección adicional).
              </CardDescription>
            </div>
            <Badge className="bg-[#F5C245]/16 text-[#B5840A] border border-[#F5C245]/40">
              {data.paquetes.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.paquetes.length === 0 ? (
            <EmptyState text="No hay paquetes pendientes." />
          ) : (
            <div className="space-y-2">
              {data.paquetes.slice(0, 20).map((p) => (
                <Link
                  key={p.id}
                  to={`/materials/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-[#DBDBDB] bg-white px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.client_name ?? "—"}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0",
                      "bg-[#F5C245]/16 text-[#B5840A] border border-[#F5C245]/40",
                    )}
                  >
                    Pendiente
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="rounded-full bg-[#2E9E5B]/10 p-3 mb-2">
      <AlertTriangle className="h-5 w-5 text-[#2E9E5B]" />
    </div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

export default Riesgo;
