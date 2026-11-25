import React, { useState } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  ChevronRight,
  Calendar,
  User,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useOperacion } from "@/data/operacion";
import { useFilters } from "@/lib/useFilters";
import {
  MATERIAL_STATUSES,
  STATUS_INDEX,
  statusLabel,
  isFechaVencida,
  formatDate,
  type MaterialStatus,
} from "@/lib/statusModel";

const Materials = () => {
  const data = useOperacion();
  const { state: filters } = useFilters();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = data.materials.filter(
    (m) =>
      (!filters.hideDemo || !data.demoIds.has(m.id)) &&
      (m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.client_name ?? "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (m.product_name ?? "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Materiales</h1>
          <p className="text-muted-foreground">
            Catálogo completo y trazabilidad de todos los materiales.{" "}
            <span className="font-medium text-foreground">
              {
                filtered.filter(
                  (m) =>
                    ![
                      "aprobado",
                      "produccion",
                      "implementado",
                      "archivado",
                    ].includes(m.status),
                ).length
              }{" "}
              activos
            </span>
            {" · "}
            <span className="text-muted-foreground">
              {
                filtered.filter((m) =>
                  [
                    "aprobado",
                    "produccion",
                    "implementado",
                    "archivado",
                  ].includes(m.status),
                ).length
              }{" "}
              terminales
            </span>
            <span className="ml-1 text-xs text-muted-foreground/70">
              (catálogo completo; /planeacion muestra solo los que tienen
              proyección de entrega)
            </span>
          </p>
        </div>
        {/* «Crear Material» se ocultó: aún no tiene función (fase 3 lo conecta). */}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar materiales..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[350px]">
                      Material / Cliente
                    </TableHead>
                    <TableHead>Etapa Actual</TableHead>
                    <TableHead>Fecha comprometida</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((material) => {
                    const vencida = isFechaVencida(
                      material.fecha_comprometida,
                      material.status,
                    );
                    return (
                      <TableRow
                        key={material.id}
                        className="hover:bg-muted/30 group"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold leading-none truncate">
                                {material.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono"
                                >
                                  {material.folio ? `#${material.folio}` : "—"}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">
                                  {material.client_name} •{" "}
                                  {material.product_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-medium">
                              <span className="text-muted-foreground">
                                {statusLabel(material.status as MaterialStatus)}
                              </span>
                              <span>
                                {Math.round(
                                  ((STATUS_INDEX[
                                    material.status as MaterialStatus
                                  ] +
                                    1) /
                                    MATERIAL_STATUSES.length) *
                                    100,
                                )}
                                %
                              </span>
                            </div>
                            <div className="flex h-1 gap-0.5">
                              {MATERIAL_STATUSES.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex-1 rounded-full",
                                    idx <
                                      STATUS_INDEX[
                                        material.status as MaterialStatus
                                      ]
                                      ? "bg-success"
                                      : idx ===
                                          STATUS_INDEX[
                                            material.status as MaterialStatus
                                          ]
                                        ? "bg-primary"
                                        : "bg-muted",
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {material.fecha_comprometida ? (
                            <span
                              className={cn(
                                "text-xs font-medium flex items-center gap-1",
                                vencida
                                  ? "text-[#D64545]"
                                  : "text-muted-foreground",
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {formatDate(material.fecha_comprometida)}
                              {vencida && " · vencida"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {material.responsible_name ?? "—"}
                            {data.comentariosCliente[material.id]?.count >
                              0 && (
                              <span
                                title={`Comentario nuevo del cliente${
                                  data.comentariosCliente[material.id]?.lastBy
                                    ? ` de ${data.comentariosCliente[material.id]?.lastBy}`
                                    : ""
                                }`}
                                className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-[#1E3A5F]/12 px-1.5 py-0.5 text-[9px] font-bold text-[#1E3A5F]"
                              >
                                <MessageSquare className="h-2.5 w-2.5" />
                                {data.comentariosCliente[material.id]?.count}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                          >
                            <Link to={`/materials/${material.id}`}>
                              Detalles
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Materials;
