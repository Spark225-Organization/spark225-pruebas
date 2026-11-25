// Cambio entre las dos formas de ver los materiales (tabla y kanban),
// que ahora viven bajo una sola sección del menú.
import { Link, useLocation } from "react-router-dom";
import { LayoutList, KanbanSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function VistaMateriales() {
  const { pathname } = useLocation();
  const { can } = useAuth();
  const opciones = [
    { href: "/materials", texto: "Tabla", Ico: LayoutList, ver: true },
    { href: "/kanban", texto: "Kanban", Ico: KanbanSquare, ver: can("advanceStage") },
  ].filter((o) => o.ver);
  if (opciones.length < 2) return null;
  return (
    <nav aria-label="Vista de materiales" className="inline-flex rounded-xl border border-[#E4E7EC] bg-white p-1">
      {opciones.map(({ href, texto, Ico }) => {
        const on = pathname.startsWith(href);
        return (
          <Link key={href} to={href} aria-current={on ? "page" : undefined} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", on ? "bg-[#0E1E2A] text-white" : "text-[#4E5964] hover:bg-[#F8F9FA]")}>
            <Ico className="h-3.5 w-3.5" /> {texto}
          </Link>
        );
      })}
    </nav>
  );
}
