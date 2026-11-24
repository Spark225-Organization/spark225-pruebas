// Fila de la tabla Agenda (vista de Planeación). Columnas ordenadas para
// caber en 1024px: Entrega · Margen · Lo necesita · # · Material · Etapa/Resp. ·
// Cliente · Producto · Indicación. Cliente/Producto/Indicación con truncate
// y tooltip.
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MaterialForecast } from "@/lib/api-types";
import { folioLabel, fmtDate } from "@/lib/mgmtHelpers";
import {
  MaterialDetailPanel,
  internalLabel,
} from "@/components/MgmtDetailPanel";
import { dayLabel, haceStr, margenPill } from "@/lib/planningHelpers";
import { cn } from "@/lib/utils";

export function TruncCell({
  text,
  max = 150,
}: {
  text: string | null | undefined;
  max?: number;
}) {
  const value = text ?? "—";
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-[150px] truncate text-[11px] text-[#4E5964]">
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AgendaRow({
  f,
  onSelect,
}: {
  f: MaterialForecast;
  onSelect: (id: string) => void;
}) {
  const mp = margenPill(f.margen_dias);
  const late = f.estado_pronostico === "tarde";
  return (
    <tr
      onClick={() => onSelect(f.material_id)}
      className={cn(
        "cursor-pointer hover:bg-[#F8F9FA]",
        late && "bg-[#D64545]/5",
      )}
    >
      {/* Entrega */}
      <td className="px-3 py-2 align-top">
        <p className="text-xs font-semibold text-[#0F1B2D]">
          {dayLabel(f.entrega_estimada)}
        </p>
        {f.entrega_estimada_max && (
          <p className="text-[10px] text-[#9AA4B2]">
            hasta {fmtDate(f.entrega_estimada_max)}
          </p>
        )}
      </td>
      {/* Margen */}
      <td className="px-3 py-2 align-top text-center">
        {mp ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
              mp.bg,
              mp.cls,
            )}
          >
            {mp.text}
          </span>
        ) : (
          <span className="text-[#9AA4B2]">—</span>
        )}
      </td>
      {/* Lo necesita */}
      <td className="px-3 py-2 align-top text-xs tabular-nums text-[#4E5964]">
        {f.fecha_requerida_cliente ? (
          fmtDate(f.fecha_requerida_cliente)
        ) : (
          <span className="text-[#9AA4B2]">Sin fecha</span>
        )}
      </td>
      {/* # folio */}
      <td className="px-3 py-2 align-top font-semibold tabular-nums text-[#0F1B2D]">
        {folioLabel(f.folio)}
      </td>
      {/* Material (título completo, 2 líneas) */}
      <td className="px-3 py-2 align-top">
        <span className="block max-w-[230px] whitespace-normal font-semibold leading-snug text-[#0F1B2D]">
          {f.titulo ?? f.material_id}
        </span>
      </td>
      {/* Etapa / Resp. */}
      <td className="px-3 py-2 align-top">
        <p className="text-xs font-medium text-[#0F1B2D]">
          {internalLabel(f.status, 0)}
        </p>
        <p className="text-[11px] text-[#9AA4B2]">
          {f.responsable ?? "—"}
          {f.dias_en_etapa != null ? ` · ${haceStr(f.dias_en_etapa)}` : ""}
        </p>
      </td>
      {/* Cliente */}
      <td className="px-3 py-2 align-top">
        <TruncCell text={f.cliente} />
      </td>
      {/* Producto */}
      <td className="px-3 py-2 align-top">
        <TruncCell text={f.producto} />
      </td>
      {/* Indicación */}
      <td className="px-3 py-2 align-top">
        <TruncCell text={f.indicacion} />
      </td>
    </tr>
  );
}

export const AGENDA_HEADERS = [
  "Entrega",
  "Margen",
  "Lo necesita",
  "#",
  "Material",
  "Etapa / Resp.",
  "Cliente",
  "Producto",
  "Indicación",
] as const;

// Re-export para que Planeacion pueda usar el panel sin importarlo de más arriba.
export { MaterialDetailPanel };
