// Rechazos del cliente por categoría (junta con Carlos, 25 nov 2026).
// Lee las decisiones de rechazo de la tabla approvals (cada una guarda una
// sola categoría en «motivo») y las cuenta por categoría y por etapa, para
// ver de dónde vienen los rechazos: fuera de plan, referencias, diseño,
// ortografía u otro.
import { useEffect, useMemo, useState } from "react";
import { Download, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportCsv } from "@/components/reportPrimitives";
import { MOTIVOS_RECHAZO, nombreMotivo } from "@/lib/portalModelo";

type Fila = { id: string; material_id: string; motivo: string | null; decision: string; stage: string | null; created_at: string };

const ES_RECHAZO = new Set(["changes_requested", "cambios"]);
const COLORES = ["#E37439", "#7A6FB0", "#2F7FB8", "#D99A12", "#9AA4B2", "#4E5964"];

export function RechazosPorCategoria() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("approvals")
        .select("id, material_id, motivo, decision, stage, created_at")
        .order("created_at", { ascending: false });
      if (!vivo) return;
      if (error) {
        setError(error.message);
        setFilas([]);
        return;
      }
      setFilas(((data ?? []) as Fila[]).filter((f) => ES_RECHAZO.has(String(f.decision))));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const resumen = useMemo(() => {
    const total = filas?.length ?? 0;
    const conteo = new Map<string, { medico: number; grafico: number; total: number }>();
    // Primero las 5 categorías acordadas, aunque estén en cero.
    for (const m of MOTIVOS_RECHAZO) conteo.set(m.id, { medico: 0, grafico: 0, total: 0 });
    for (const f of filas ?? []) {
      const k = f.motivo ?? "sin_categoria";
      if (!conteo.has(k)) conteo.set(k, { medico: 0, grafico: 0, total: 0 });
      const c = conteo.get(k)!;
      c.total++;
      if (f.stage === "aprobacion_cliente_medico") c.medico++;
      else c.grafico++;
    }
    const lista = [...conteo.entries()]
      .map(([id, c]) => ({ id, nombre: id === "sin_categoria" ? "Sin categoría (anteriores)" : nombreMotivo(id), ...c }))
      .sort((a, b) => b.total - a.total);
    return { total, lista, max: Math.max(1, ...lista.map((x) => x.total)) };
  }, [filas]);

  const exportar = () =>
    exportCsv(
      "rechazos-por-categoria.csv",
      resumen.lista.map((x) => ({
        Categoría: x.nombre,
        Rechazos: x.total,
        "Contenido médico": x.medico,
        Diseño: x.grafico,
        Porcentaje: resumen.total ? `${Math.round((x.total / resumen.total) * 100)} %` : "0 %",
      })),
    );

  return (
    <Card className="border-none shadow-sm lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <XCircle className="h-4 w-4 text-[#D64545]" /> Rechazos del cliente por categoría
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {filas === null ? "Cargando…" : `${resumen.total} ${resumen.total === 1 ? "rechazo registrado" : "rechazos registrados"}. Cada rechazo lleva una sola categoría.`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportar} disabled={!resumen.total}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        {filas === null ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : error ? (
          <p className="text-sm text-[#B23A3A]">No se pudieron leer los rechazos: {error}</p>
        ) : (
          <ul className="space-y-3">
            {resumen.lista.map((x, i) => {
              const pct = resumen.total ? Math.round((x.total / resumen.total) * 100) : 0;
              return (
                <li key={x.id} className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_88px] items-center gap-3 text-sm">
                  <span className="truncate font-medium text-foreground" title={x.nombre}>{x.nombre}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(x.total / resumen.max) * 100}%`, background: COLORES[i % COLORES.length] }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    <b className="text-foreground">{x.total}</b> · {pct} %
                  </span>
                  {x.total > 0 && (
                    <span className="col-start-2 -mt-2 text-[11px] text-muted-foreground">
                      Contenido médico {x.medico} · Diseño {x.grafico}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
