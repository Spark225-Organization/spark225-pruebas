// Para el cliente, en la versión nueva: lo que pidió en su rechazo y si
// Spark225 lo atendió. Si algo «no quedó», lo marca y se le prepara el
// rechazo con esos puntos.
import { useEffect, useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { listarPuntos, puntosVigentes, type Punto } from "@/lib/correcciones";
import { usePulso } from "@/lib/pulso";
import { cn } from "@/lib/utils";

export function PuntosCliente({ materialId, noQuedo, setNoQuedo }: { materialId: string; noQuedo: Set<string>; setNoQuedo: (s: Set<string>) => void }) {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const pulso = usePulso();
  useEffect(() => {
    let vivo = true;
    listarPuntos([materialId]).then((p) => vivo && setPuntos(puntosVigentes(p)));
    return () => {
      vivo = false;
    };
  }, [materialId, pulso]);

  // Solo tiene sentido cuando ya le regresaron una versión con algo atendido.
  if (!puntos.some((p) => p.estado === "resuelto")) return null;
  const hechos = puntos.filter((p) => p.estado === "resuelto").length;

  const alternar = (id: string) => {
    const s = new Set(noQuedo);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setNoQuedo(s);
  };

  return (
    <div className="mt-3 rounded-xl border border-[#E3E6EA] bg-white p-3">
      <p className="text-xs font-semibold text-[#0E1E2A]">
        Lo que pediste · <span className="text-[#1E7D47]">{hechos} de {puntos.length} atendidos</span>
      </p>
      <p className="mb-2 text-[11px] text-[#7A8590]">Revisa cada punto en la versión nueva. Si alguno no quedó, márcalo.</p>
      <ul className="space-y-1.5">
        {puntos.map((p, i) => {
          const atendido = p.estado === "resuelto";
          const mal = noQuedo.has(p.id);
          return (
            <li key={p.id} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", mal ? "border-[#D64545]/40 bg-[#FFF1F1]" : atendido ? "border-[#2E9E5B]/30 bg-[#F2FBF6]" : "border-[#E3E6EA]")}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", mal ? "bg-[#D64545] text-white" : atendido ? "bg-[#2E9E5B] text-white" : "bg-[#EEF0F2]")}>
                {atendido && !mal && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1 text-xs text-[#0E1E2A]">
                <b className="mr-1">{i + 1}.</b>
                {p.texto}
                <span className={cn("mt-0.5 block text-[11px] font-semibold", mal ? "text-[#B23A3A]" : atendido ? "text-[#1E7D47]" : "text-[#7A8590]")}>
                  {mal ? "Marcaste que no quedó" : atendido ? "Spark225 lo marcó como atendido" : "Pendiente"}
                </span>
              </span>
              {atendido && (
                <button type="button" onClick={() => alternar(p.id)} className={cn("inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold", mal ? "bg-white text-[#4E5964] hover:bg-[#F3F4F6]" : "text-[#B23A3A] hover:bg-[#FFF1F1]")}>
                  {mal ? <><Undo2 className="h-3 w-3" /> Sí quedó</> : "No quedó"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Texto del rechazo a partir de los puntos que no quedaron. */
export async function textoNoQuedo(materialId: string, ids: Set<string>) {
  const p = puntosVigentes(await listarPuntos([materialId])).filter((x) => ids.has(x.id));
  return p.map((x) => `Sigue pendiente: ${x.texto}`).join("\n");
}
