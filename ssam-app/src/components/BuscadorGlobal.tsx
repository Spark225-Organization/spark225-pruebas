// Buscador de la barra superior: materiales por título, #folio, cliente o
// producto, y clientes. Flechas para moverse, Enter para abrir, Esc para cerrar.
// Atajo: «/» enfoca el buscador desde cualquier pantalla.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Briefcase } from "lucide-react";
import { useOperacion } from "@/data/operacion";
import { statusShortLabel, type MaterialStatus } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

type Resultado = { id: string; tipo: "material" | "cliente"; titulo: string; sub: string; href: string };

const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function BuscadorGlobal() {
  const data = useOperacion();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(0);
  const caja = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        caja.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const resultados = useMemo<Resultado[]>(() => {
    const t = normal(q.trim().replace(/^#/, ""));
    if (t.length < 2) return [];
    const mats = data.materials
      .filter((m) => !data.demoIds.has(m.id))
      .filter((m) => normal(`${m.name} ${m.folio ?? ""} ${m.client_name ?? ""} ${m.product_name ?? ""} ${m.indication_name ?? ""}`).includes(t))
      .slice(0, 7)
      .map((m) => ({
        id: m.id,
        tipo: "material" as const,
        titulo: `${m.folio != null ? `#${m.folio} · ` : ""}${m.name}`,
        sub: [m.client_name, m.product_name, statusShortLabel(m.status as MaterialStatus)].filter(Boolean).join(" · "),
        href: `/materials/${m.id}`,
      }));
    const clis = data.clients
      .filter((c) => normal(c.name ?? "").includes(t))
      .slice(0, 3)
      .map((c) => ({ id: c.id, tipo: "cliente" as const, titulo: c.name, sub: "Cliente", href: "/clients" }));
    return [...mats, ...clis];
  }, [q, data.materials, data.clients, data.demoIds]);

  const ir = (r?: Resultado) => {
    if (!r) return;
    navigate(r.href);
    setQ("");
    setAbierto(false);
    caja.current?.blur();
  };

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4E5964]" />
      <input
        ref={caja}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === "Enter") ir(resultados[sel]);
          if (e.key === "Escape") { setAbierto(false); caja.current?.blur(); }
        }}
        role="combobox"
        aria-expanded={abierto && resultados.length > 0}
        aria-controls="buscador-resultados"
        aria-label="Buscar materiales, clientes o productos"
        placeholder="Buscar materiales, clientes o productos  ( / )"
        className="h-9 w-full rounded-[8px] border border-[#DBDBDB] bg-[#F8F9FA] pl-9 pr-3 text-xs text-[#1F2124] outline-none focus:border-[#E37439] focus:bg-white focus:ring-2 focus:ring-[#E37439]/20"
      />
      {abierto && q.trim().length >= 2 && (
        <ul id="buscador-resultados" role="listbox" className="ssam-ficha absolute left-0 right-0 top-11 z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white p-1 shadow-xl">
          {resultados.length === 0 ? (
            <li className="px-3 py-3 text-xs text-[#7A8590]">Sin resultados para «{q}»</li>
          ) : (
            resultados.map((r, i) => (
              <li key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === sel}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => ir(r)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", i === sel ? "bg-[#FFF7F2]" : "hover:bg-[#F8F9FA]")}
                >
                  {r.tipo === "material" ? <FileText className="h-4 w-4 shrink-0 text-[#E37439]" /> : <Briefcase className="h-4 w-4 shrink-0 text-[#4E5964]" />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[#0E1E2A]">{r.titulo}</span>
                    <span className="block truncate text-[11px] text-[#7A8590]">{r.sub}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
