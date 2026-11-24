import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  Globe,
  Edit2,
  Trash2,
  ExternalLink,
  Settings2,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Client, ClientLabelPatch } from "@/lib/api-types";
import {
  useOperacion,
  resetOperacionCache,
  mutateUpdateClientLabels,
  isClienteActivo,
} from "@/data/operacion";
import { useAuth } from "@/lib/auth";

const Clients = () => {
  const { can } = useAuth();
  const data = useOperacion();
  const [searchTerm, setSearchTerm] = useState("");
  const [editTarget, setEditTarget] = useState<Client | null>(null);

  const clients = data.clients;
  const load = () => {
    resetOperacionCache();
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Administra las entidades corporativas y sus etiquetas de aprobación.
          </p>
        </div>
        <Button className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white shadow-soft">
          <Plus className="h-4 w-4" />
          Registrar Cliente
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
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
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[300px]">Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Etiquetas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-lg border bg-primary/5 text-primary">
                            <AvatarFallback className="rounded-lg font-bold">
                              {client.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold leading-none">
                              {client.name}
                            </p>
                            {client.website && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Globe className="h-3 w-3" /> {client.website}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.email && (
                            <p className="text-sm flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                              {client.email}
                            </p>
                          )}
                          {client.phone && (
                            <p className="text-xs flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" /> {client.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {client.etiqueta_codigo_interno && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono"
                            >
                              {client.etiqueta_codigo_interno}
                            </Badge>
                          )}
                          {client.etiqueta_codigo_regulatorio && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono text-[#4E5964]"
                            >
                              {client.etiqueta_codigo_regulatorio}
                            </Badge>
                          )}
                          {client.etiqueta_sistema_aprobacion && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono text-[#2E9E5B]"
                            >
                              {client.etiqueta_sistema_aprobacion}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isClienteActivo(client) ? (
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
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" /> Ver Detalles
                            </DropdownMenuItem>
                            {can("clients") && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => setEditTarget(client)}
                              >
                                <Settings2 className="h-4 w-4" /> Configurar
                                etiquetas
                              </DropdownMenuItem>
                            )}
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

      <ClientLabelDialog
        client={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />
    </div>
  );
};

const ClientLabelDialog = ({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<ClientLabelPatch>({
    etiqueta_codigo_interno: null,
    etiqueta_codigo_regulatorio: null,
    etiqueta_sistema_aprobacion: null,
    especificaciones_impresion_default: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        etiqueta_codigo_interno: client.etiqueta_codigo_interno,
        etiqueta_codigo_regulatorio: client.etiqueta_codigo_regulatorio,
        etiqueta_sistema_aprobacion: client.etiqueta_sistema_aprobacion,
        especificaciones_impresion_default:
          client.especificaciones_impresion_default,
      });
    }
  }, [client]);

  if (!client) return null;

  const save = async () => {
    setSaving(true);
    const res = await mutateUpdateClientLabels(client.id, form);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Etiquetas del cliente actualizadas.");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!client} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[#E37439]" />
            Configurar etiquetas — {client.name}
          </DialogTitle>
          <DialogDescription>
            Define cómo este laboratorio llama a sus códigos de aprobación
            interna, regulatorio y sistema. Estas etiquetas aparecen en los
            materiales y el portal del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <Field
            label="Etiqueta código interno"
            help="Cómo llama este laboratorio a su código de aprobación interna (ej. CRC, Aprobación interna)."
            value={form.etiqueta_codigo_interno ?? ""}
            onChange={(v) =>
              setForm((s) => ({ ...s, etiqueta_codigo_interno: v }))
            }
          />
          <Field
            label="Etiqueta código regulatorio"
            help="Nombre del código regulatorio (ej. COFEPRIS, FDA, INVIMA)."
            value={form.etiqueta_codigo_regulatorio ?? ""}
            onChange={(v) =>
              setForm((s) => ({ ...s, etiqueta_codigo_regulatorio: v }))
            }
          />
          <Field
            label="Etiqueta sistema de aprobación"
            help="Sistema externo de aprobación (ej. Veeva Vault, Veeva PromoMats)."
            value={form.etiqueta_sistema_aprobacion ?? ""}
            onChange={(v) =>
              setForm((s) => ({ ...s, etiqueta_sistema_aprobacion: v }))
            }
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Especificaciones de impresión por defecto
            </Label>
            <Textarea
              value={form.especificaciones_impresion_default ?? ""}
              placeholder="300 dpi · CMYK · sangría 3 mm"
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  especificaciones_impresion_default: e.target.value,
                }))
              }
              className="min-h-[60px] border-[#DBDBDB] focus-visible:ring-[#E37439]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#E37439] hover:bg-[#C45B24] text-white"
          >
            {saving ? "Guardando..." : "Guardar etiquetas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold">{label}</Label>
    <Input
      value={value}
      placeholder="—"
      onChange={(e) => onChange(e.target.value)}
      className="border-[#DBDBDB] focus-visible:ring-[#E37439]"
    />
    <p className="text-[11px] text-muted-foreground">{help}</p>
  </div>
);

export default Clients;
