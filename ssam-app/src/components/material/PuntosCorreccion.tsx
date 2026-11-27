// Lista de correcciones del cliente que Paco va marcando como hechas.
// Se usa en la tarjeta de correcciones del detalle y en «Enviar al cliente».
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePulso } from "@/lib/pulso";
import { listarPuntos, marcarPunto, puntosVigentes, type Punto } from "@/lib/correcciones";
import { formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

/** Puntos vigentes de un material; se releen solos. */
export function usePuntos(materialId: string) {
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const pulso = usePulso();
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    listarPuntos([materialId]).then((p) => vivo && setPuntos(puntosVigentes(p)));
    return () => {
      vivo = false;
    };
  }, [materialId, pulso, n]);
  const recargar = useCallback(() => setN((x) => x + 1), []);
  return { puntos, recargar, setPuntos };
}

export function PuntosCorreccion({ puntos, setPuntos, compacto = false }: { puntos: Punto[]; setPuntos: (p: Punto[]) => void; compacto?: boolean }) {
  const { user } = useAuth();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const hechos = puntos.filter((p) => p.estado === "resuelto").length;
  const total = puntos.length;

  const alternar = async (p: Punto) => {
    if (!user || ocupado) return;
    const hecho = p.estado !== "resuelto";
    setOcupado(p.id);
    // Se ve marcado al instante; si la base falla, se regresa.
    const antes = puntos;
    setPuntos(puntos.map((x) => (x.id === p.id ? { ...x, estado: hecho ? "resuelto" : "abierto", resuelto_at: hecho ? new Date().toISOString() : null } : x)));
    const r = await marcarPunto(p.id, hecho, user.id);
    setOcupado(null);
    if (r.error) {
      setPuntos(antes);
      toast.error(r.error);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Correcciones del cliente · <span className={hechos === total ? "text-[#1E7D47] dark:text-[#5CCB8A]" : "text-foreground"}>{hechos} de {total} atendidas</span>
        </p>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#2E9E5B] transition-all" style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-1.5">
        {puntos.map((p, i) => {
          const hecho = p.estado === "resuelto";
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => alternar(p)}
                aria-pressed={hecho}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E5B]/40",
                  compacto ? "py-2" : "py-2.5",
                  hecho ? "border-[#2E9E5B]/40 bg-[#2E9E5B]/[0.08]" : "border-border bg-card hover:border-[#2E9E5B]/50",
                )}
              >
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", hecho ? "border-[#2E9E5B] bg-[#2E9E5B] text-white" : "border-muted-foreground/40")}>
                  {ocupado === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : hecho ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", hecho ? "text-muted-foreground line-through decoration-[#2E9E5B]/60" : "text-foreground")}>
                    <b className="mr-1 font-semibold">{i + 1}.</b>
                    {p.texto}
                  </span>
                  {hecho && p.resuelto_at && <span className="block text-[11px] text-[#1E7D47] dark:text-[#5CCB8A]">Hecho · {formatDate(p.resuelto_at)}</span>}
                </span>
                {!hecho && <span className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Marcar hecho</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
