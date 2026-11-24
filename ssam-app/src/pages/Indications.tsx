import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Indication } from "@/lib/api-types";
import { useOperacion, isEntityActive } from "@/data/operacion";

const Indications = () => {
  const data = useOperacion();
  const [searchTerm, setSearchTerm] = useState("");

  const indications = data.indications;

  // Conteo de materiales por indicación, calculado desde la capa única
  // (data.materials), no desde la tabla indications (que viene sin
  // materials_count). Así "Materiales Relacionados" deja de mostrar 0.
  const countByIndication = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of data.materials) {
      if (!m.indication_id) continue;
      map[m.indication_id] = (map[m.indication_id] ?? 0) + 1;
    }
    return map;
  }, [data.materials]);

  const filtered = indications.filter((ind) =>
    ind.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicaciones</h1>
          <p className="text-muted-foreground">
            Clasificación de materiales según indicaciones médicas.
          </p>
        </div>
        <Button className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white shadow-soft">
          <Plus className="h-4 w-4" />
          Nueva Indicación
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar indicaciones..."
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
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[400px]">Indicación</TableHead>
                    <TableHead>Materiales Relacionados</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ind) => (
                    <TableRow key={ind.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Target className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold leading-none">
                              {ind.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {ind.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">
                          {countByIndication[ind.id] ?? 0} Materiales
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isEntityActive(ind.status) ? (
                          <Badge className="badge-status-green">Activo</Badge>
                        ) : (
                          <Badge className="badge-status-gray">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem className="gap-2">
                              <Edit2 className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-destructive">
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Indications;
