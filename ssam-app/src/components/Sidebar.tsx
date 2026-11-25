import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Files,
  Briefcase,
  Tag,
  Microscope,
  Users,
  BarChart3,
  Shield,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Columns3,
  KanbanSquare,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAuth,
  ROLE_LABELS,
  ROLE_COLORS,
  type RolePermissions,
} from "@/lib/auth";
import { Marca } from "@/components/Marca";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  permission: keyof RolePermissions;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    permission: "dashboard",
  },
  {
    label: "Planeación",
    icon: CalendarRange,
    href: "/planeacion",
    permission: "planeacion",
  },
  {
    label: "Materiales",
    icon: Files,
    href: "/materials",
    permission: "materials",
  },
  {
    label: "Kanban",
    icon: KanbanSquare,
    href: "/kanban",
    permission: "advanceStage",
  },
  {
    label: "En Riesgo",
    icon: AlertTriangle,
    href: "/riesgo",
    permission: "risk",
  },
  {
    label: "Mis Materiales",
    icon: Columns3,
    href: "/portal",
    permission: "clientPortal",
  },
  {
    label: "Clientes",
    icon: Briefcase,
    href: "/clients",
    permission: "clients",
  },
  { label: "Productos", icon: Tag, href: "/products", permission: "products" },
  {
    label: "Indicaciones",
    icon: Microscope,
    href: "/indications",
    permission: "indications",
  },
  { label: "Equipo", icon: Users, href: "/team", permission: "team" },
  {
    label: "Reportes",
    icon: BarChart3,
    href: "/reports",
    permission: "reports",
  },
  {
    label: "Roles y Accesos",
    icon: Shield,
    href: "/roles",
    permission: "roles",
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, can } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      aria-label="Navegación principal"
      className="flex h-screen w-64 flex-col bg-[#0E1E2A] text-white shrink-0 border-r border-[#1B2D3C] select-none"
    >
      {/* Logo header: Navy background, official Spark225 white-text logo @ ~150px wide, 20px padding */}
      <div className="flex h-20 items-center px-5 border-b border-[#1B2D3C]">
        <Link
          to="/"
          className="flex items-center transition-opacity hover:opacity-90"
        >
          <Marca tono="claro" ancho={112} />
        </Link>
      </div>

      {/* Navigation items: Navy background, white text, active state has left orange accent bar */}
      <ScrollArea className="flex-1 py-5 px-3">
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "relative group flex items-center gap-3 rounded-[8px] px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#162A3B] text-white font-semibold"
                    : "text-[#B4BAC2] hover:bg-[#142433] hover:text-white",
                )}
              >
                {/* Active indicator: solid orange left bar */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#E37439]"
                  />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-[#E37439]"
                      : "text-[#8894A0] group-hover:text-white",
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 text-[#E37439]/80 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User profile section */}
      {user && (
        <div className="border-t border-[#1B2D3C] p-3.5 bg-[#0A1721]">
          <div className="flex items-center gap-3 rounded-[8px] bg-[#122332] p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E37439] font-bold text-white text-xs">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-white leading-tight">
                {user.name}
              </p>
              <Badge
                className={cn(
                  "mt-1 text-[10px] font-semibold px-1.5 py-0 border-0 h-4 inline-flex items-center",
                  ROLE_COLORS[user.role],
                )}
              >
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="h-8 w-8 shrink-0 text-[#8894A0] hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
};
