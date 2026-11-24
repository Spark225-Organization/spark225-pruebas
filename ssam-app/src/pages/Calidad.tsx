import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useOperacion, selectCalidad } from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/** Página /calidad: lista de registros incompletos (solo admin). */
export default function Calidad() {
  const data = useOperacion();
  const { state: filters } = useFilters();
  const calidad = useMemo(() => selectCalidad(data, filters), [data, filters]);

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-[12px]" />
        <Skeleton className="h-60 rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Calidad de datos
        </h1>
        <p className="text-muted-foreground">
          Materiales con datos incompletos que requieren revisión para mantener
          la trazabilidad y los reportes exactos.
        </p>
      </div>

      {calidad.total === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-success/10 p-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm text-muted-foreground">
              Todos los registros están completos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {calidad.total} registros incompletos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-[10px] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">
                      Material
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold">
                      Cliente
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold">
                      Datos faltantes
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calidad.items.map((it) => (
                    <tr key={it.material_id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-semibold">{it.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {it.cliente ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {it.issues.map((i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] font-mono text-amber-700"
                            >
                              {i}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/materials/${it.material_id}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Editar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
