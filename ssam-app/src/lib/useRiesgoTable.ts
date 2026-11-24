import { useMemo } from "react";
import type { MaterialRiesgo } from "@/lib/api-types";

export interface RiesgoRow {
  material_id: string;
  titulo: string | null;
  dias: number;
  motivo: string | null;
  status: string;
  cliente_id: string | null;
  responsable_principal_id: string | null;
  responsable: string | null;
}

/**
 * Agrupa materiales_en_riesgo por material_id, tomando el máximo de días
 * de atraso por material, y ordena por dias desc. Devuelve hasta `limit` rows.
 */
export function useRiesgoTable(
  riesgo: MaterialRiesgo[],
  limit = 8,
): RiesgoRow[] {
  return useMemo(() => {
    const byId: Record<string, RiesgoRow> = {};
    for (const r of riesgo) {
      const d = r.dias ?? 0;
      const cur = byId[r.material_id];
      if (!cur || d > cur.dias) {
        byId[r.material_id] = {
          material_id: r.material_id,
          titulo: r.titulo,
          dias: d,
          motivo: r.riesgo,
          status: r.status,
          cliente_id: r.cliente_id,
          responsable_principal_id: r.responsable_principal_id,
          responsable: r.responsable,
        };
      }
    }
    return Object.values(byId)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riesgo, limit]);
}
