// Archivero: materiales agrupados por cliente o producto, cada grupo es una
// carpeta (como el archivero del SSAM interno). Al abrirla, el panorama:
// etapa, fecha comprometida y qué se necesita del cliente.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FolderOpen, Folder } from "lucide-react";
import type { Material } from "@/lib/api-types";
import { statusShortLabel, formatDate, type MaterialStatus } from "@/lib/statusModel";
import { MOMENTOS, momento, semaforo, TONO_CLASE } from "@/lib/portalModelo";
import { cn } from "@/lib/utils";

/** Qué se necesita del cliente, en voz del equipo. */
function necesitaDelCliente(m: Material): string {
  const s = m.status;
  if (s === "aprobacion_cliente_medico") return "Aprobación del contenido médico";
  if (s === "aprobacion_cliente_grafico") return "Aprobación del diseño";
  if (s === "sometimiento_final" || s === "crc") return "Códigos de aprobación del laboratorio";
  if (!m.fecha_requerida_cliente && momento(m) !== "entregado") return "Fecha en que lo necesita";
  return "";
}

export function Archivero({ materiales, agrupar }: { materiales: Material[]; agrupar: "cliente" | "producto" }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const m = new Map<string, Material[]>();
    for (const x of materiales) {
      const k = (agrupar === "cliente" ? x.client_name : x.product_name) ?? (agrupar === "cliente" ? "Sin cliente" : "Sin producto");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(x);
    }
    return [...m.entries()]
      .map(([nombre, ms]) => ({
        nombre,
        ms: ms.sort((a, b) => (a.fecha_comprometida ?? "9").localeCompare(b.fecha_comprometida ?? "9")),
        esperan: ms.filter((x) => necesitaDelCliente(x)).length,
        sub: agrupar === "cliente" ? [...new Set(ms.map((x) => x.product_name).filter(Boolean))].join(" · ") : [...new Set(ms.map((x) => x.indication_name).filter(Boolean))].join(" · "),
      }))
      .sort((a, b) => b.esperan - a.esperan || b.ms.length - a.ms.length);
  }, [materiales, agrupar]);

  const grupo = grupos.find((g) => g.nombre === abierta);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-4 gap-y-6 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        {grupos.map((g, i) => {
          const on = g.nombre === abierta;
          const Ico = on ? FolderOpen : Folder;
          return (
            <button
              key={g.nombre}
              type="button"
              onClick={() => setAbierta(on ? null : g.nombre)}
              aria-expanded={on}
              style={{ animationDelay: `${i * 40}ms` }}
              className={cn("ssam-subir ssam-carpeta border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]", on ? "border-[#E37439] bg-[#FFF7F2]" : "border-[#E4E7EC] bg-white")}
            >
              <div className="flex items-center gap-2">
                <Ico className={cn("h-4 w-4", on ? "text-[#E37439]" : "text-[#9AA4B2]")} />
                <p className="truncate font-bold text-[#0E1E2A]">{g.nombre}</p>
                <span className="ml-auto text-xs tabular-nums text-[#7A8590]">{g.ms.length}</span>
              </div>
              <p className="mt-1 truncate text-xs text-[#7A8590]">{g.sub || "—"}</p>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#EEF0F2]">
                {MOMENTOS.map((x) => {
                  const n = g.ms.filter((m) => momento(m) === x.id).length;
                  return n ? <span key={x.id} style={{ width: `${(n / g.ms.length) * 100}%`, background: x.color }} /> : null;
                })}
              </div>
              {g.esperan > 0 && <p className="mt-2 text-xs font-semibold text-[#E37439]">{g.esperan} esperan algo del cliente</p>}
            </button>
          );
        })}
      </div>

      {grupo && (
        <div key={grupo.nombre} className="ssam-carpeta-abre overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
          <div className="flex items-center justify-between border-b border-[#E4E7EC] bg-[#F8F9FA] px-4 py-3">
            <p className="text-sm font-bold text-[#0E1E2A]">Panorama de {grupo.nombre}</p>
            <p className="text-xs text-[#7A8590]">{grupo.ms.length} materiales · ordenados por fecha comprometida</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-[#7A8590]">
                <tr className="border-b border-[#EEF0F2]">
                  <th className="px-4 py-2 text-left font-semibold">Material</th>
                  <th className="px-3 py-2 text-left font-semibold">{agrupar === "cliente" ? "Producto · indicación" : "Cliente · indicación"}</th>
                  <th className="px-3 py-2 text-left font-semibold">Etapa</th>
                  <th className="px-3 py-2 text-left font-semibold">Fecha comprometida</th>
                  <th className="px-3 py-2 text-left font-semibold">Qué se necesita del cliente</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0F2]">
                {grupo.ms.map((m) => {
                  const sem = semaforo(m);
                  const nec = necesitaDelCliente(m);
                  return (
                    <tr key={m.id} className="group hover:bg-[#FAFBFC]">
                      <td className="px-4 py-2.5">
                        <Link to={`/materials/${m.id}`} className="font-semibold text-[#0E1E2A] hover:text-[#E37439]">
                          {m.folio != null && <span className="mr-1.5 font-mono text-[11px] text-[#9AA4B2]">#{m.folio}</span>}
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#4E5964]">
                        {agrupar === "cliente" ? m.product_name ?? "—" : m.client_name ?? "—"}
                        {m.indication_name ? <span className="text-[#9AA4B2]"> · {m.indication_name}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: MOMENTOS.find((x) => x.id === momento(m))!.color }} />
                          {statusShortLabel(m.status as MaterialStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-[#4E5964]">{m.fecha_comprometida ? formatDate(m.fecha_comprometida) : "—"}</span>
                        <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", TONO_CLASE[sem.tono])}>{sem.label}</span>
                      </td>
                      <td className={cn("px-3 py-2.5 text-xs", nec ? "font-semibold text-[#E37439]" : "text-[#9AA4B2]")}>{nec || "Nada pendiente"}</td>
                      <td className="pr-3">
                        <Link to={`/materials/${m.id}`} aria-label={`Abrir ${m.name}`} className="text-[#9AA4B2] group-hover:text-[#E37439]">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
