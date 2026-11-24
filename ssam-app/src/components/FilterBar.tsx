import { useMemo, useState } from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const PERIODOS: { key: FilterState["periodo"]; label: string }[] = [
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "180d", label: "Últimos 180 días" },
  { key: "year", label: "Año en curso" },
  { key: "custom", label: "Personalizado" },
];

const ALL = "__all__";

export const FilterBar = ({
  scopes = {
    cliente: true,
    unidad: true,
    producto: true,
    indicacion: true,
    responsable: true,
    formato: true,
  },
}: {
  scopes?: {
    cliente?: boolean;
    unidad?: boolean;
    producto?: boolean;
    indicacion?: boolean;
    responsable?: boolean;
    formato?: boolean;
  };
}) => {
  const { state, patch, reset } = useFilters();
  const data = useOperacion();
  const clients: Client[] = data.clients;
  const units: BusinessUnit[] = data.businessUnits;
  const products: Product[] = data.products;
  const indications: Indication[] = data.indications;
  const team: TeamMember[] = data.team;

  // Cascade: products filtered by selected client; indications by product's client.
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

  const filteredIndications = useMemo(() => {
    let list = indications;
    if (state.productId) {
      // Indications aren't directly tied to product in schema; show all if no tie.
      list = indications;
    }
    return list;
  }, [indications, state.productId]);

  const hasActive =
    state.clientId ||
    state.unitId ||
    state.productId ||
    state.indicationId ||
    state.responsibleId ||
    state.format;

  return (
    <div className="rounded-[12px] border border-[#DBDBDB] bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0E1E2A]">
          <Filter className="h-4 w-4 text-[#E37439]" /> Filtros
        </div>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpiar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {scopes.cliente && (
          <Field label="Cliente" className="w-[170px]">
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
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {scopes.unidad && (
          <Field label="Unidad de negocio" className="w-[170px]">
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
                    (u) => !state.clientId || u.client_id === state.clientId,
                  )
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {scopes.producto && (
          <Field label="Producto" className="w-[170px]">
            <Select
              value={state.productId ?? ALL}
              onValueChange={(v) =>
                patch({
                  productId: v === ALL ? null : v,
                })
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
        )}

        {scopes.indicacion && (
          <Field label="Indicación" className="w-[170px]">
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
                {filteredIndications.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {scopes.responsable && (
          <Field label="Responsable" className="w-[160px]">
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
        )}

        {scopes.formato && (
          <Field label="Formato" className="w-[140px]">
            <Select
              value={state.format ?? ALL}
              onValueChange={(v) => patch({ format: v === ALL ? null : v })}
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
        )}

        <Field label="Periodo" className="w-[170px]">
          <Select
            value={state.periodo}
            onValueChange={(v) =>
              patch({ periodo: v as FilterState["periodo"] })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {state.periodo === "custom" && (
          <>
            <Field label="Desde" className="w-[150px]">
              <Input
                type="date"
                className="h-9"
                value={state.fechaDesde ?? ""}
                onChange={(e) => patch({ fechaDesde: e.target.value || null })}
              />
            </Field>
            <Field label="Hasta" className="w-[150px]">
              <Input
                type="date"
                className="h-9"
                value={state.fechaHasta ?? ""}
                onChange={(e) => patch({ fechaHasta: e.target.value || null })}
              />
            </Field>
          </>
        )}
      </div>
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
    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);
