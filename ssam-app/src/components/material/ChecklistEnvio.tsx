// Checklist obligatorio antes de enviar un material: al cliente (médico o
// gráfico) y, desde la junta del 25 nov 2026, también cuando el diseñador
// entrega el arte a revisión de dirección gráfica (referencias, colores y
// pautas para el impresor).
// Usa el checklist de Spark225 (tabla checklist_templates: el que se presentó
// a Eisai Oncología), filtrado por etapa (médico o gráfico) y por formato del
// material. Cada punto se marca «Cumple» o «No aplica» (con motivo). Solo
// cuando todo está resuelto se manda al cliente, y queda registro en
// pre_send_items de quién lo revisó y cuándo.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, Minus, X, Loader2, Send, ListChecks } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Material } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type Punto = { id: string; item: string; detalle: string | null; orden: number; formatos: string[] | null };
type Estado = { estado: "cumple" | "no_aplica"; motivo?: string };

export const ETAPAS_CLIENTE = ["aprobacion_cliente_medico", "aprobacion_cliente_grafico"] as const;
/** Etapa destino → checklist que se exige antes de entrar a ella. */
const TIPO_POR_DESTINO: Record<string, string> = {
  revision_direccion_grafico: "entrega_diseno",
  aprobacion_cliente_medico: "pre_envio_medico",
  aprobacion_cliente_grafico: "pre_envio_grafico",
};
export const pideChecklist = (destino: string) => destino in TIPO_POR_DESTINO;
const esCliente = (destino: string) => (ETAPAS_CLIENTE as readonly string[]).includes(destino);

const tipoPara = (destino: string) => TIPO_POR_DESTINO[destino];

/** ¿El punto aplica a este formato? (formatos vacío = todos) */
function aplica(p: Punto, formato: string) {
  if (!p.formatos || !p.formatos.length) return true;
  const f = formato.toLowerCase();
  return p.formatos.some((t) => f.includes(t.toLowerCase()));
}

export function ChecklistEnvio({
  material,
  destino,
  destinoNombre,
  onEnviar,
  onCerrar,
  incluir = [],
}: {
  /** Checklists adicionales (p. ej. el del diseñador al enviar directo desde diseño). */
  incluir?: string[];
  material: Material;
  destino: string;
  destinoNombre: string;
  /** Hace el cambio de etapa; se llama al terminar el checklist. */
  onEnviar: () => Promise<{ error: string | null }>;
  onCerrar: () => void;
}) {
  const { user } = useAuth();
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Estado>>({});
  const [enviando, setEnviando] = useState(false);
  const tipo = tipoPara(destino);
  const formato = String((material as any).formato_material ?? "");
  const clienteId = (material as any).cliente_id ?? material.client_id ?? null;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_templates")
        .select("id, item, detalle, orden, formatos, cliente_id, activo, tipo")
        .in("tipo", [...incluir, tipo])
        .order("orden");
      if (!vivo) return;
      if (error) {
        toast.error("No se pudo cargar el checklist: " + error.message);
        setPuntos([]);
        return;
      }
      const orden = [...incluir, tipo];
      const lista = (data ?? [])
        .filter((p: any) => p.activo !== false && (!p.cliente_id || p.cliente_id === clienteId) && aplica(p, formato))
        .sort((a: any, b: any) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo) || a.orden - b.orden);
      setPuntos(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [tipo, formato, clienteId, incluir.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  const resueltos = useMemo(() => (puntos ?? []).filter((p) => marcas[p.id] && (marcas[p.id].estado === "cumple" || marcas[p.id].motivo?.trim())).length, [puntos, marcas]);
  const total = puntos?.length ?? 0;
  const completo = total > 0 && resueltos === total;
  const pct = total ? Math.round((resueltos / total) * 100) : 0;

  const marcar = (id: string, estado: Estado["estado"]) =>
    setMarcas((m) => (m[id]?.estado === estado ? (({ [id]: _, ...r }) => r)(m) : { ...m, [id]: { estado, motivo: m[id]?.motivo } }));

  const enviar = async () => {
    if (!completo || !user || !puntos) return;
    setEnviando(true);
    const ahora = new Date().toISOString();
    const filas = puntos.map((p) => ({
      material_id: material.id,
      tipo: (p as any).tipo ?? tipo,
      item: p.item,
      detalle: p.detalle,
      orden: p.orden,
      estado: marcas[p.id].estado,
      motivo: marcas[p.id].estado === "no_aplica" ? marcas[p.id].motivo?.trim() ?? null : null,
      completado_por: user.id,
      completado_at: ahora,
    }));
    const { error } = await (supabase as any).from("pre_send_items").insert(filas);
    if (error) {
      setEnviando(false);
      return toast.error("No se guardó el checklist: " + error.message);
    }
    const r = await onEnviar();
    setEnviando(false);
    if (r.error) return toast.error(r.error);
    toast.success(`Checklist completo. Enviado a ${destinoNombre}.`);
    onCerrar();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label="Checklist antes de enviar al cliente" onClick={(e) => e.stopPropagation()} className="ssam-ficha flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-4 border-b border-[#EEF0F2] px-6 py-5">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EEF0F2" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={completo ? "#2E9E5B" : "#E37439"} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} style={{ transition: "stroke-dasharray .35s cubic-bezier(.23,1,.32,1)" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-[#0E1E2A]">{resueltos}/{total}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#E37439]">
              <ListChecks className="h-3.5 w-3.5" /> {esCliente(destino) ? `Antes de enviar a ${destinoNombre.toLowerCase()}` : "Checklist del diseñador · obligatorio"}
            </p>
            <h3 className="mt-0.5 truncate text-lg font-bold text-[#0E1E2A]">{material.name}</h3>
            <p className="text-xs text-[#7A8590]">{formato ? `Formato: ${formato}. ` : ""}Revisa cada punto; lo que no aplique, explica por qué. Sin el checklist completo no se puede enviar.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-[#7A8590] hover:bg-[#F3F4F6]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {puntos === null && (
            <li className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#E37439]" /></li>
          )}
          {puntos?.length === 0 && (
            <li className="rounded-2xl border border-dashed border-[#DBDBDB] p-6 text-center text-sm text-[#7A8590]">
              No hay checklist configurado para esta etapa. No se puede enviar hasta que un administrador lo configure.
            </li>
          )}
          {puntos?.map((p, i) => {
            const m = marcas[p.id];
            return (
              <li key={p.id} className={cn("ssam-subir rounded-2xl border p-3.5 transition-colors", m?.estado === "cumple" ? "border-[#2E9E5B]/40 bg-[#F2FBF6]" : m?.estado === "no_aplica" ? "border-[#D99A12]/40 bg-[#FFFAEE]" : "border-[#E3E6EA]")} style={{ animationDelay: `${i * 35}ms` }}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-xs font-bold tabular-nums text-[#9AA4B2]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0E1E2A]">{p.item}</p>
                    {p.detalle && <p className="mt-0.5 text-xs text-[#4E5964]">{p.detalle}</p>}
                    {m?.estado === "no_aplica" && (
                      <input autoFocus value={m.motivo ?? ""} onChange={(e) => setMarcas((x) => ({ ...x, [p.id]: { estado: "no_aplica", motivo: e.target.value } }))} placeholder="¿Por qué no aplica?" className="mt-2 h-8 w-full rounded-lg border border-[#E3E6EA] bg-white px-2.5 text-xs outline-none focus:border-[#D99A12]" />
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => marcar(p.id, "cumple")} aria-pressed={m?.estado === "cumple"} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold", m?.estado === "cumple" ? "bg-[#2E9E5B] text-white" : "bg-[#F3F4F6] text-[#4E5964] hover:bg-[#E9EBEE]")}>
                      <Check className="h-3.5 w-3.5" /> Cumple
                    </button>
                    <button type="button" onClick={() => marcar(p.id, "no_aplica")} aria-pressed={m?.estado === "no_aplica"} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold", m?.estado === "no_aplica" ? "bg-[#D99A12] text-white" : "bg-[#F3F4F6] text-[#4E5964] hover:bg-[#E9EBEE]")}>
                      <Minus className="h-3.5 w-3.5" /> No aplica
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-3 border-t border-[#EEF0F2] px-6 py-4">
          <p className="text-xs text-[#7A8590]">{completo ? "Todo revisado." : `Faltan ${total - resueltos} por revisar.`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-[#4E5964] hover:bg-[#F3F4F6]">Cancelar</button>
            <button type="button" onClick={enviar} disabled={!completo || enviando} className="inline-flex items-center gap-1.5 rounded-xl bg-[#E37439] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C45B24] disabled:opacity-40">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {esCliente(destino) ? "Enviar al cliente" : "Enviar a revisión"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
