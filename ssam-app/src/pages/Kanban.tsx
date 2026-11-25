import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperacion, mutateChangeStatus } from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import type { Material, Client } from "@/lib/api-types";
import {
  KANBAN_STATUSES,
  HIDDEN_KANBAN_STATUSES,
  statusLabel,
  statusShortLabel,
  isFechaVencida,
  isFechaEnRiesgo,
  dependeDe,
  DEPENDE_DE_META,
  formatDate,
  type MaterialStatus,
} from "@/lib/statusModel";
import { cn } from "@/lib/utils";
import { ChecklistEnvio, pideChecklist } from "@/components/material/ChecklistEnvio";

type ClientMap = Record<string, Client>;

const Kanban = () => {
  const data = useOperacion();
  const { state: filters } = useFilters();
  // Overlay optimista efímero: id -> status, mientras llega el refresco.
  const [optimistic, setOptimistic] = useState<Record<string, MaterialStatus>>(
    {},
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<MaterialStatus | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Filtros por cliente, producto e indicación.
  const [fCliente, setFCliente] = useState("");
  const [fProducto, setFProducto] = useState("");
  const [fIndicacion, setFIndicacion] = useState("");
  // Movimiento hacia revisión del cliente: primero el checklist de envío.
  const [pendiente, setPendiente] = useState<{ mat: Material; status: MaterialStatus } | null>(null);

  const clients: ClientMap = useMemo(
    () => Object.fromEntries(data.clients.map((c) => [c.id, c])),
    [data.clients],
  );

  // Una sola fuente: data.materials del store, con overlay optimista.
  // El filtro DEMO es global (useFilters.hideDemo): revisa nombre, producto
  // y cliente del material (los [DEMO] LFB pasaban como reales).
  const materials: Material[] = useMemo(
    () =>
      data.materials
        .filter((m) => !filters.hideDemo || !data.demoIds.has(m.id))
        .filter((m) => !fCliente || m.client_id === fCliente)
        .filter((m) => !fProducto || m.product_name === fProducto)
        .filter((m) => !fIndicacion || m.indication_name === fIndicacion)
        .map((m) =>
          optimistic[m.id] ? { ...m, status: optimistic[m.id] } : m,
        ),
    [data.materials, data.demoIds, optimistic, filters.hideDemo, fCliente, fProducto, fIndicacion],
  );

  const columns = showArchived
    ? [...KANBAN_STATUSES, ...HIDDEN_KANBAN_STATUSES]
    : KANBAN_STATUSES;

  const byStatus = (status: MaterialStatus) =>
    materials.filter((m) => m.status === status);

  const handleDrop = async (status: MaterialStatus) => {
    const id = draggedId;
    setDraggedId(null);
    setDragOver(null);
    if (!id) return;
    const mat = materials.find((m) => m.id === id);
    if (!mat || mat.status === status) return;
    if (pideChecklist(status)) return setPendiente({ mat, status });
    await mover(mat, status);
  };

  const mover = async (mat: Material, status: MaterialStatus) => {
    const id = mat.id;
    const prev = mat.status;
    // Optimista: mueve la tarjeta al instante.
    setOptimistic((o) => ({ ...o, [id]: status }));

    const res = await mutateChangeStatus(id, status);
    if (res.error) {
      // Revertir y mostrar el error de la base en español.
      setOptimistic((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      toast.error(`No se pudo mover: ${res.error}`);
      return res;
    }
    // El refresco de ["operacion"] trae el dato real; limpiar el overlay.
    setOptimistic((o) => {
      const n = { ...o };
      delete n[id];
      return n;
    });
    toast.success(
      `${mat.name} → ${statusLabel(status, clients[mat.client_id] ?? null)}`,
    );
    return res;
  };

  // Opciones de filtro (con lo que hay en la base).
  const base = data.materials.filter((m) => !filters.hideDemo || !data.demoIds.has(m.id));
  const opClientes = [...new Map(base.filter((m) => m.client_id).map((m) => [m.client_id as string, m.client_name ?? clients[m.client_id as string]?.name ?? "—"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const opProductos = [...new Set(base.filter((m) => !fCliente || m.client_id === fCliente).map((m) => m.product_name).filter(Boolean) as string[])].sort();
  const opIndicaciones = [...new Set(base.filter((m) => (!fCliente || m.client_id === fCliente) && (!fProducto || m.product_name === fProducto)).map((m) => m.indication_name).filter(Boolean) as string[])].sort();
  const selCls = (v: string) => cn("h-9 rounded-lg border bg-background px-2.5 text-xs font-semibold", v ? "border-[#E37439] text-foreground" : "text-muted-foreground");

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {pendiente && (
        <ChecklistEnvio
          material={pendiente.mat}
          destino={pendiente.status}
          destinoNombre={statusLabel(pendiente.status, clients[pendiente.mat.client_id ?? ""] ?? null)}
          onCerrar={() => setPendiente(null)}
          onEnviar={async () => {
            const r = await mover(pendiente.mat, pendiente.status);
            return { error: r?.error ?? null };
          }}
        />
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Kanban de Materiales
          </h1>
          <p className="text-muted-foreground">
            Arrastra una tarjeta para cambiar la etapa. Las transiciones no
            permitidas se revierten y muestran el error de la base.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filtrar por cliente" value={fCliente} onChange={(e) => { setFCliente(e.target.value); setFProducto(""); setFIndicacion(""); }} className={selCls(fCliente)}>
            <option value="">Todos los clientes</option>
            {opClientes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <select aria-label="Filtrar por producto" value={fProducto} onChange={(e) => { setFProducto(e.target.value); setFIndicacion(""); }} className={selCls(fProducto)}>
            <option value="">Todos los productos</option>
            {opProductos.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select aria-label="Filtrar por indicación" value={fIndicacion} onChange={(e) => setFIndicacion(e.target.value)} className={selCls(fIndicacion)}>
            <option value="">Todas las indicaciones</option>
            {opIndicaciones.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button
            variant="outline"
            size="sm"
            className={cn(showArchived && "bg-muted")}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Ocultar Archivados" : "Mostrar Archivados"}
          </Button>
        </div>
      </div>

      {data.loading ? (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-[10px]" />
          ))}
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-4"
          style={{ scrollSnapType: "x proximity" }}
        >
          {columns.map((status) => {
            const cards = byStatus(status);
            return (
              <div
                key={status}
                className="flex w-[260px] shrink-0 flex-col rounded-[10px] border bg-muted/30"
                style={{ scrollSnapAlign: "start" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedId) setDragOver(status);
                }}
                onDragLeave={() =>
                  setDragOver((s) => (s === status ? null : s))
                }
                onDrop={() => handleDrop(status)}
              >
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 border-b transition-colors",
                    dragOver === status
                      ? "border-[#E37439] bg-[#E37439]/5"
                      : "border-border",
                  )}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/80 truncate">
                    {statusShortLabel(status)}
                  </span>
                  <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                    {cards.length}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2 p-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                  {cards.map((m) => {
                    const client = clients[m.client_id];
                    const vencida = isFechaVencida(
                      m.fecha_comprometida,
                      m.status,
                    );
                    const riesgo = isFechaEnRiesgo(
                      m.fecha_comprometida,
                      m.status,
                    );
                    const dep = dependeDe(m.status);
                    const nuevoCom = data.comentariosCliente[m.id]?.count > 0;
                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={() => setDraggedId(m.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOver(null);
                        }}
                        className={cn(
                          "rounded-lg border bg-white p-2.5 shadow-soft cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                          draggedId === m.id && "opacity-40",
                        )}
                      >
                        <Link
                          to={`/materials/${m.id}`}
                          className="block min-w-0"
                        >
                          {m.folio != null && (
                            <p className="text-[10px] font-mono font-bold text-[#9AA4B2]">
                              #{m.folio}
                            </p>
                          )}
                          <p className="text-xs font-bold leading-snug text-foreground hover:text-[#E37439] line-clamp-2">
                            {m.name}
                          </p>
                        </Link>
                        <p className="mt-1 text-[10px] text-muted-foreground truncate">
                          {m.client_name}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          {m.fecha_comprometida && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                vencida
                                  ? "text-[#D64545]"
                                  : riesgo
                                    ? "text-[#B5840A]"
                                    : "text-muted-foreground",
                              )}
                            >
                              {formatDate(m.fecha_comprometida)}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            {nuevoCom && (
                              <span
                                title={`Comentario nuevo del cliente${
                                  data.comentariosCliente[m.id]?.lastBy
                                    ? ` de ${
                                        data.comentariosCliente[m.id]?.lastBy
                                      }`
                                    : ""
                                }`}
                                className="inline-flex items-center gap-1 rounded-full bg-[#1E3A5F]/12 px-1.5 py-0.5 text-[9px] font-bold text-[#1E3A5F]"
                              >
                                <MessageSquare className="h-2.5 w-2.5" />
                                {data.comentariosCliente[m.id]?.count}
                              </span>
                            )}
                            <Badge
                              className={cn(
                                "h-4 text-[9px] px-1.5 border-0",
                                DEPENDE_DE_META[dep].classes,
                              )}
                            >
                              {DEPENDE_DE_META[dep].label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div className="text-[10px] text-muted-foreground/60 text-center py-4">
                      Sin materiales
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Kanban;
