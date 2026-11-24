import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type PeriodoKey = "30d" | "90d" | "180d" | "year" | "custom";

export interface FilterState {
  clientId: string | null;
  unitId: string | null;
  productId: string | null;
  indicationId: string | null;
  responsibleId: string | null;
  format: string | null;
  periodo: PeriodoKey;
  fechaDesde: string | null;
  fechaHasta: string | null;
  /** Ocultar registros [DEMO]. Activo por defecto (los datos reales conviven
   *  con los demo en Supabase; este filtro los excluye de todas las vistas). */
  hideDemo: boolean;
}

const DEFAULTS: FilterState = {
  clientId: null,
  unitId: null,
  productId: null,
  indicationId: null,
  responsibleId: null,
  format: null,
  periodo: "90d",
  fechaDesde: null,
  fechaHasta: null,
  hideDemo: true,
};

export function periodoRange(
  periodo: PeriodoKey,
  desde?: string | null,
  hasta?: string | null,
): { desde: Date | null; hasta: Date } {
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 0);
  if (periodo === "custom") {
    return {
      desde: desde ? new Date(desde) : null,
      hasta: hasta ? new Date(hasta) : hoy,
    };
  }
  const dias = periodo === "30d" ? 30 : periodo === "90d" ? 90 : 180;
  if (periodo === "year") {
    const start = new Date(hoy.getFullYear(), 0, 1);
    return { desde: start, hasta: hoy };
  }
  const desde2 = new Date(hoy);
  desde2.setDate(desde2.getDate() - dias);
  return { desde: desde2, hasta: hoy };
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const periodo = (searchParams.get("periodo") as PeriodoKey) || "90d";
    return {
      clientId: searchParams.get("cliente") || null,
      unitId: searchParams.get("unidad") || null,
      productId: searchParams.get("producto") || null,
      indicationId: searchParams.get("indicacion") || null,
      responsibleId: searchParams.get("responsable") || null,
      format: searchParams.get("formato") || null,
      periodo,
      fechaDesde: searchParams.get("desde") || null,
      fechaHasta: searchParams.get("hasta") || null,
      // Por defecto oculta demo; ?demo=0 los muestra.
      hideDemo: searchParams.get("demo") !== "0",
    };
  }, [searchParams]);

  const patch = (changes: Partial<FilterState>) => {
    const next = new URLSearchParams(searchParams);
    const map: Record<string, string | null | undefined> = {
      cliente: changes.clientId ?? null,
      unidad: changes.unitId ?? null,
      producto: changes.productId ?? null,
      indicacion: changes.indicationId ?? null,
      responsable: changes.responsibleId ?? null,
      formato: changes.format ?? null,
      periodo: changes.periodo ?? null,
      desde: changes.fechaDesde ?? null,
      hasta: changes.fechaHasta ?? null,
      // demo: solo se escribe si hideDemo cambia. true → borrar (default);
      // false → "0".
      demo:
        changes.hideDemo === undefined
          ? undefined
          : changes.hideDemo
            ? null
            : "0",
    };
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined) continue;
      if (v === null) next.delete(k);
      else next.set(k, String(v));
    }
    setSearchParams(next, { replace: true });
  };

  const reset = () => {
    const next = new URLSearchParams();
    next.set("periodo", "90d");
    setSearchParams(next, { replace: true });
  };

  return { state, patch, reset, raw: DEFAULTS };
}

/** Filtra métricas de materiales por los filtros activos y el periodo. */
export function filterMetrics<
  T extends {
    client_id?: string | null;
    product_id?: string | null;
    indication_id?: string | null;
    responsible_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  },
>(rows: T[], f: FilterState): T[] {
  const { desde, hasta } = periodoRange(f.periodo, f.fechaDesde, f.fechaHasta);
  return rows.filter((r) => {
    if (f.clientId && r.client_id !== f.clientId) return false;
    if (f.productId && r.product_id !== f.productId) return false;
    if (f.indicationId && r.indication_id !== f.indicationId) return false;
    if (f.responsibleId && r.responsible_id !== f.responsibleId) return false;
    const refDate = r.updated_at || r.created_at;
    if (refDate) {
      const d = new Date(refDate);
      if (desde && d < desde) return false;
      if (d > hasta) return false;
    }
    return true;
  });
}
