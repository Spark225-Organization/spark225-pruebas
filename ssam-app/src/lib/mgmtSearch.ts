import type { MaterialMetric } from "@/lib/api-types";

// Resultado de la búsqueda por folio entre TODOS los materiales (no solo
// activos). Si el folio existe en un solo cliente (o el filtro de cliente ya
// está fijado), `picked` trae el material a mostrar. Si existe en varios
// clientes y el filtro está en "Todos", `options` trae la lista para elegir.
export interface FolioSearchResult {
  picked: MaterialMetric | null;
  options: { material_id: string; label: string }[];
}

// Busca un folio numérico en todos los materiales (v_material_metrics).
// `allMetrics` = todos los materiales; `clientIdFilter` = filtro de cliente
// activo (null = Todos). `q` ya viene normalizado (sin '#').
export function searchFolioEverywhere(
  allMetrics: MaterialMetric[],
  clientIdFilter: string | null,
  q: string,
): FolioSearchResult {
  if (!q || !/^\d+$/.test(q)) return { picked: null, options: [] };
  const matches = allMetrics.filter(
    (m) => m.folio != null && String(m.folio) === q,
  );
  if (matches.length === 0) return { picked: null, options: [] };

  // Si hay filtro de cliente, restringe a ese cliente.
  const scoped = clientIdFilter
    ? matches.filter((m) => m.client_id === clientIdFilter)
    : matches;
  const pool = scoped.length ? scoped : matches;

  if (pool.length === 1) {
    return { picked: pool[0], options: [] };
  }
  // Varios: lista corta para elegir (cliente · #folio).
  return {
    picked: null,
    options: pool.map((m) => ({
      material_id: m.material_id,
      label: `${m.client_name ?? "Sin cliente"} #${m.folio}`,
    })),
  };
}

// ¿El material está entregado (no activo)? Se usa para mostrar la tarjeta
// "Entregado" en lugar del detalle activo.
export function isDelivered(status: string): boolean {
  return (
    status === "aprobado" ||
    status === "produccion" ||
    status === "implementado" ||
    status === "archivado"
  );
}
