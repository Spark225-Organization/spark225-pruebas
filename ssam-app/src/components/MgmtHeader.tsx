import { useMemo } from "react";
import { Filter, X, ChevronDown, Search, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useOperacion } from "@/data/operacion";
import { useFilters, type FilterState } from "@/lib/useFilters";
import type {
  Client,
  Product,
  Indication,
  TeamMember,
  BusinessUnit,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

// Periodo segmentado: 30d · 90d · 6m · 12m
const PERIODO_SEG: { key: FilterState["periodo"]; label: string }[] = [
  { key: "30d", label: "30 d" },
  { key: "90d", label: "90 d" },
  { key: "180d", label: "6 m" },
  { key: "year", label: "12 m" },
];

export function periodoLabel(periodo: FilterState["periodo"]): string {
  const map: Record<string, string> = {
    "30d": "últimos 30 días",
    "90d": "últimos 90 días",
    "180d": "últimos 6 meses",
    year: "últimos 12 meses",
    custom: "personalizado",
  };
  return map[periodo] ?? "";
}

export function periodoRangeText(f: FilterState): string {
  const hoy = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  if (f.periodo === "custom" && (f.fechaDesde || f.fechaHasta)) {
    const desde = f.fechaDesde ? new Date(f.fechaDesde) : null;
    const hasta = f.fechaHasta ? new Date(f.fechaHasta) : hoy;
    return desde ? `${fmt(desde)} – ${fmt(hasta)}` : `Hasta ${fmt(hasta)}`;
  }
  const dias =
    f.periodo === "30d"
      ? 30
      : f.periodo === "90d"
        ? 90
        : f.periodo === "180d"
          ? 180
          : 365;
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - dias);
  return `${fmt(desde)} – ${fmt(hoy)}`;
}

export interface MgmtHeaderProps {
  search: string;
  onSearch: (v: string) => void;
}

export const MgmtHeader = ({ search, onSearch }: MgmtHeaderProps) => {
  const { state, patch, reset } = useFilters();
  const data = useOperacion();
  const clients: Client[] = data.clients;
  const units: BusinessUnit[] = data.businessUnits;
  const products: Product[] = data.products;
  const indications: Indication[] = data.indications;
  const team: TeamMember[] = data.team;

  const filteredProducts = useMemo(() => {
    let list = products;
    if (state.clientId)
      list = list.filter((p) => p.client_id === state.clientId);
    if (state.unitId) {
      const unit = units.find((u) => u.id === state.unitId);
      if (unit?.client_id)
        list = list.filter((p) => p.client_id === unit.client_id);
    }
    return list;
  }, [products, state.clientId, state.unitId, units]);

  // chips de filtros activos (excluyendo periodo, que ya está en el header)
  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = [];
    if (state.unitId) {
      const u = units.find((x) => x.id === state.unitId);
      out.push({
        key: "unidad",
        label: u?.name ?? state.unitId,
        clear: () => patch({ unitId: null }),
      });
    }
    if (state.productId) {
      const p = products.find((x) => x.id === state.productId);
      out.push({
        key: "producto",
        label: p?.name ?? state.productId,
        clear: () => patch({ productId: null }),
      });
    }
    if (state.indicationId) {
      const i = indications.find((x) => x.id === state.indicationId);
      out.push({
        key: "indicacion",
        label: i?.name ?? state.indicationId,
        clear: () => patch({ indicationId: null }),
      });
    }
    if (state.responsibleId) {
      const t = team.find((x) => x.id === state.responsibleId);
      out.push({
        key: "responsable",
        label: t?.name ?? state.responsibleId,
        clear: () => patch({ responsibleId: null }),
      });
    }
    if (state.format) {
      out.push({
        key: "formato",
        label: `Formato: ${state.format}`,
        clear: () => patch({ format: null }),
      });
    }
    return out;
  }, [state, units, products, indications, team, patch]);

  const extraActive =
    state.unitId ||
    state.productId ||
    state.indicationId ||
    state.responsibleId ||
    state.format;

  return (
    <div className="mb-4">
      {/* Buscador global grande */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA4B2]" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="¿Cuándo llega…? Busca #id, producto, indicación o título"
          className="h-12 rounded-[14px] border-[#E4E7EC] bg-white pl-10 pr-4 text-[15px] text-[#0F1B2D] placeholder:text-[#9AA4B2]"
          aria-label="Buscador global de materiales"
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight text-[#0F1B2D]">
            Panorama de operación
          </h1>
          <p className="mt-0.5 text-[13px] text-[#4E5964]">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Periodo segmentado */}
          <div
            className="inline-flex items-center rounded-lg border border-[#E4E7EC] bg-white p-0.5"
            role="group"
            aria-label="Periodo"
          >
            {PERIODO_SEG.map((p) => (
              <button
                key={p.key}
                onClick={() => patch({ periodo: p.key })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  state.periodo === p.key
                    ? "bg-[#E37439] text-white"
                    : "text-[#4E5964] hover:bg-[#F8F9FA]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Ocultar datos DEMO (activo por defecto) */}
          <button
            onClick={() => patch({ hideDemo: !state.hideDemo })}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
              state.hideDemo
                ? "border-[#E4E7EC] bg-white text-[#4E5964] hover:bg-[#F8F9FA]"
                : "border-[#E37439] bg-[#E37439]/8 text-[#E37439]",
            )}
            title={
              state.hideDemo
                ? "Los datos [DEMO] están ocultos. Clic para mostrarlos."
                : "Mostrando datos [DEMO]. Clic para ocultarlos."
            }
            aria-pressed={!state.hideDemo}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {state.hideDemo ? "DEMO ocultos" : "DEMO visibles"}
          </button>
          <div className="w-[180px]">
            <Select
              value={state.clientId ?? ALL}
              onValueChange={(v) =>
                patch({
                  clientId: v === ALL ? null : v,
                  unitId: null,
                  productId: null,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Más filtros (popover) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 border-[#E4E7EC] bg-white text-[#0F1B2D] hover:bg-[#F8F9FA]",
                  extraActive && "border-[#E37439] text-[#E37439]",
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Más filtros
                {extraActive && (
                  <span className="ml-0.5 rounded-full bg-[#E37439] px-1.5 text-[10px] font-bold text-white">
                    {chips.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[440px] border-[#E4E7EC] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F1B2D]">
                  Filtros avanzados
                </p>
                {extraActive && (
                  <button
                    onClick={() =>
                      patch({
                        unitId: null,
                        productId: null,
                        indicationId: null,
                        responsibleId: null,
                        format: null,
                      })
                    }
                    className="text-xs font-semibold text-[#E37439] hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unidad de negocio">
                  <Select
                    value={state.unitId ?? ALL}
                    onValueChange={(v) =>
                      patch({
                        unitId: v === ALL ? null : v,
                        productId: null,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      {units
                        .filter(
                          (u) =>
                            !state.clientId || u.client_id === state.clientId,
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Producto">
                  <Select
                    value={state.productId ?? ALL}
                    onValueChange={(v) =>
                      patch({ productId: v === ALL ? null : v })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      {filteredProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Indicación">
                  <Select
                    value={state.indicationId ?? ALL}
                    onValueChange={(v) =>
                      patch({ indicationId: v === ALL ? null : v })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      {indications.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Responsable">
                  <Select
                    value={state.responsibleId ?? ALL}
                    onValueChange={(v) =>
                      patch({ responsibleId: v === ALL ? null : v })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      {team.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Formato" className="col-span-2">
                  <Select
                    value={state.format ?? ALL}
                    onValueChange={(v) =>
                      patch({ format: v === ALL ? null : v })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="imagen">Imagen</SelectItem>
                      <SelectItem value="enlace">Enlace</SelectItem>
                      <SelectItem value="nota_voz">Nota de voz</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {state.periodo === "custom" && (
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E4E7EC] pt-3">
                  <Field label="Desde">
                    <Input
                      type="date"
                      className="h-9"
                      value={state.fechaDesde ?? ""}
                      onChange={(e) =>
                        patch({ fechaDesde: e.target.value || null })
                      }
                    />
                  </Field>
                  <Field label="Hasta">
                    <Input
                      type="date"
                      className="h-9"
                      value={state.fechaHasta ?? ""}
                      onChange={(e) =>
                        patch({ fechaHasta: e.target.value || null })
                      }
                    />
                  </Field>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Chips de filtros activos */}
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full border border-[#E4E7EC] bg-[#F8F9FA] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#4E5964]"
            >
              {c.label}
              <button
                onClick={c.clear}
                className="rounded-full p-0.5 text-[#9AA3AD] hover:bg-[#E4E7EC] hover:text-[#0F1B2D]"
                aria-label={`Quitar filtro ${c.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={reset}
            className="ml-1 text-xs font-semibold text-[#E37439] hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
};

const Field = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("space-y-1", className)}>
    <Label className="text-[11px] font-medium text-[#4E5964]">{label}</Label>
    {children}
  </div>
);
