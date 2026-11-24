import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Check,
  X,
  ChevronDown,
  Users,
  Eye,
  Edit3,
  Trash2,
  Plus,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  normalizeRol,
  type Role,
  type RolePermissions,
} from "@/lib/auth";
import { fetchProfiles } from "@/data/operacion";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<
  keyof RolePermissions,
  { label: string; description: string }
> = {
  dashboard: {
    label: "Dashboard General",
    description: "Ver el panel principal con métricas y flujo de materiales.",
  },
  materials: {
    label: "Ver Materiales",
    description: "Acceder al listado y detalle de materiales.",
  },
  clients: {
    label: "Ver Clientes",
    description: "Acceder al módulo de gestión de clientes.",
  },
  products: {
    label: "Ver Productos",
    description: "Acceder al módulo de gestión de productos.",
  },
  indications: {
    label: "Ver Indicaciones",
    description: "Acceder al módulo de indicaciones médicas.",
  },
  team: {
    label: "Ver Equipo",
    description: "Acceder a la gestión de miembros del equipo.",
  },
  reports: {
    label: "Ver Reportes",
    description: "Acceder al dashboard de métricas y reportes.",
  },
  roles: {
    label: "Gestión de Roles",
    description: "Administrar roles y permisos del sistema.",
  },
  risk: {
    label: "Vista En Riesgo",
    description:
      "Ver materiales con fecha comprometida vencida y paquetes finales pendientes.",
  },
  planeacion: {
    label: "Planeación de Entregas",
    description:
      "Ver fechas estimadas por etapa y cliente, agenda y calendario de entregas.",
  },
  clientPortal: {
    label: "Portal del Cliente",
    description:
      "Acceso externo del cliente a sus materiales habilitados (vista simplificada de 6 pasos).",
  },
  advanceStage: {
    label: "Avanzar Etapas",
    description: "Mover materiales de una etapa a la siguiente.",
  },
  uploadFiles: {
    label: "Cargar Archivos",
    description: "Subir PDFs, imágenes y otros archivos a los materiales.",
  },
  comment: {
    label: "Comentar",
    description: "Agregar comentarios colaborativos en materiales.",
  },
  captureFechaComprometida: {
    label: "Capturar fecha comprometida",
    description:
      "Capturar y editar la fecha comprometida del material (rol Creativo/Diseño).",
  },
  captureFechaRequerida: {
    label: "Capturar fecha requerida por el cliente",
    description:
      "Capturar y editar la fecha que necesita el cliente para el material (Cliente Externo y Administrador).",
  },
  toggleVisibleCliente: {
    label: "Habilitar material para el cliente",
    description:
      "Activar/desactivar materials.visible_para_cliente para que el material aparezca o no en el portal del cliente (Administrador y roles internos).",
  },
  ownMaterialsOnly: {
    label: "Solo Materiales Propios",
    description: "El usuario solo ve los materiales que le han sido asignados.",
  },
  manageMaterials: {
    label: "Crear / Eliminar Materiales",
    description: "Crear nuevos materiales y eliminar existentes.",
  },
};

const PERMISSION_GROUPS = [
  {
    label: "Navegación y Módulos",
    keys: [
      "dashboard",
      "materials",
      "planeacion",
      "clientPortal",
      "clients",
      "products",
      "indications",
      "team",
      "reports",
      "roles",
      "risk",
    ] as (keyof RolePermissions)[],
  },
  {
    label: "Acciones sobre Materiales",
    keys: [
      "advanceStage",
      "uploadFiles",
      "comment",
      "captureFechaComprometida",
      "captureFechaRequerida",
      "toggleVisibleCliente",
      "manageMaterials",
      "ownMaterialsOnly",
    ] as (keyof RolePermissions)[],
  },
];

// Local mutable state for permissions (in a real app this would come from API)
const useRolePermissions = () => {
  const [perms, setPerms] = useState<Record<Role, RolePermissions>>(
    JSON.parse(JSON.stringify(ROLE_PERMISSIONS)),
  );

  const toggle = (role: Role, perm: keyof RolePermissions) => {
    setPerms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  };

  return { perms, toggle };
};

const RoleCard = ({
  role,
  perms,
  onToggle,
}: {
  role: Role;
  perms: RolePermissions;
  onToggle: (perm: keyof RolePermissions) => void;
}) => {
  const enabledCount = Object.values(perms).filter(Boolean).length;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={cn(
                  "border text-xs font-semibold px-3 py-1",
                  ROLE_COLORS[role],
                )}
              >
                {ROLE_LABELS[role]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Configuración de permisos
              </span>
            </div>
            <CardDescription className="text-sm">
              {ROLE_DESCRIPTIONS[role]}
            </CardDescription>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold text-primary">{enabledCount}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              permisos activos
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground mb-3">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.keys.map((perm) => {
                const info = PERMISSION_LABELS[perm];
                return (
                  <div
                    key={perm}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
                      perms[perm] ? "bg-primary/5" : "bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {info.label}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {info.description}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      checked={!!perms[perm]}
                      onCheckedChange={() => onToggle(perm)}
                      className="flex-shrink-0"
                      disabled={role === "admin" && perm === "dashboard"}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const PermissionMatrix = ({
  perms,
}: {
  perms: Record<Role, RolePermissions>;
}) => {
  const roles = Object.keys(perms) as Role[];
  const allPerms = Object.keys(PERMISSION_LABELS) as (keyof RolePermissions)[];

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-56">
              Permiso
            </th>
            {roles.map((r) => (
              <th key={r} className="px-4 py-3 text-center">
                <Badge
                  className={cn("border text-xs font-semibold", ROLE_COLORS[r])}
                >
                  {ROLE_LABELS[r]}
                </Badge>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allPerms.map((perm, i) => (
            <tr
              key={perm}
              className={cn(
                "border-b last:border-0",
                i % 2 === 0 ? "bg-background" : "bg-muted/10",
              )}
            >
              <td className="px-4 py-2.5 font-medium">
                {PERMISSION_LABELS[perm].label}
              </td>
              {roles.map((r) => (
                <td key={r} className="px-4 py-2.5 text-center">
                  {perms[r][perm] ? (
                    <Check className="h-4 w-4 text-success mx-auto" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RoleManagement = () => {
  const { perms, toggle } = useRolePermissions();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión de Roles y Accesos
          </h1>
          <p className="text-muted-foreground">
            Define qué puede ver y hacer cada tipo de usuario en el sistema
            SSAM.
          </p>
        </div>
        <Button
          onClick={handleSave}
          className={cn(
            "gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white shadow-soft transition-all hover:opacity-90",
            saved && "bg-success shadow-success/20",
          )}
        >
          {saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          {saved ? "Guardado" : "Guardar Cambios"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => {
          const count = Object.values(perms[role]).filter(Boolean).length;
          return (
            <Card key={role} className="border-none shadow-sm">
              <CardContent className="p-4">
                <Badge
                  className={cn(
                    "border text-xs font-semibold mb-3",
                    ROLE_COLORS[role],
                  )}
                >
                  {ROLE_LABELS[role]}
                </Badge>
                <p className="text-xl font-bold">
                  {count}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    permisos
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="cards">
        <TabsList className="mb-6">
          <TabsTrigger value="cards">Configurar por Rol</TabsTrigger>
          <TabsTrigger value="matrix">Matriz Comparativa</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(perms) as Role[]).map((role) => (
              <RoleCard
                key={role}
                role={role}
                perms={perms[role]}
                onToggle={(perm) => toggle(role, perm)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Matriz de Permisos</CardTitle>
              <CardDescription>
                Comparativa visual de accesos por rol.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionMatrix perms={perms} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Users list */}
      <UsersList />
    </div>
  );
};

const UsersList = () => {
  const [users, setUsers] = useState<
    {
      id: string;
      nombre: string | null;
      email: string | null;
      rol: Role | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await fetchProfiles();
      if (!active) return;
      setUsers((r.data as any) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Usuarios del Sistema</CardTitle>
        <CardDescription>
          Asigna roles a los miembros de tu organización desde la tabla
          profiles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay usuarios registrados. Invita miembros desde Supabase Auth.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              // Normaliza el rol del esquema español (cliente/creativo/etc.)
              // a las claves canónicas para que el badge muestre una etiqueta
              // válida en vez de "Sin etiqueta".
              const role: Role = normalizeRol(u.rol);
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/20"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E37439] font-bold text-white text-sm">
                    {(u.nombre ?? u.email ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {u.nombre ?? "Sin nombre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email ?? "—"}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "border text-xs font-semibold shrink-0",
                      ROLE_COLORS[role],
                    )}
                  >
                    {ROLE_LABELS[role]}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RoleManagement;
