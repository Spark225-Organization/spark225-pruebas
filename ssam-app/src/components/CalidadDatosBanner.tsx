import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useOperacion, selectCalidad } from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Aviso discreto de calidad de datos, visible solo para Administrador. */
export function CalidadDatosBanner() {
  const { can } = useAuth();
  const data = useOperacion();
  const { state: filters } = useFilters();
  const calidad = useMemo(() => selectCalidad(data, filters), [data, filters]);

  if (!can("roles")) return null; // solo administrador
  if (calidad.total === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Calidad de datos: <span className="font-semibold">{calidad.total}</span>{" "}
        registros incompletos.
      </span>
      <Link
        to="/calidad"
        className={cn(
          "ml-auto font-semibold underline-offset-2 hover:underline",
        )}
      >
        Ver lista →
      </Link>
    </div>
  );
}
