// Mensajes de Spark225 en el portal del cliente: lo último que le escribió el
// equipo (por ejemplo, «Atendimos tus correcciones» al reenviarle una versión).
// Los nuevos se marcan hasta que el cliente los da por vistos.
import { usePulso } from "@/lib/pulso";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/statusModel";
import type { Material } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type Msg = { id: string; material_id: string; texto: string; created_at: string; autor: string };
const CLAVE = "ssam-mensajes-vistos-";

export function MensajesSpark({ materiales, abrir }: { materiales: Material[]; abrir: (id: string) => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [vistos, setVistos] = useState(() => {
    try {
      return localStorage.getItem(CLAVE + (user?.id ?? "")) ?? "";
    } catch {
      return "";
    }
  });
  const pulso = usePulso();
  const ids = useMemo(() => new Set(materiales.map((m) => m.id)), [materiales]);
  const nombre = (id: string) => materiales.find((m) => m.id === id)?.name ?? "Material";

  useEffect(() => {
    let vivo = true;
    (async () => {
      let { data, error } = await (supabase as any)
        .from("comments")
        .select("id, material_id, texto, autor_id, visibilidad, created_at, profiles!comments_autor_id_fkey(nombre)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        ({ data } = await (supabase as any)
          .from("comments")
          .select("id, material_id, texto, autor_id, visibilidad, created_at")
          .order("created_at", { ascending: false })
          .limit(100));
      }
      if (!vivo) return;
      setMsgs(
        ((data ?? []) as any[])
          .filter((c) => c.autor_id !== user?.id && c.visibilidad !== "interno" && ids.has(c.material_id))
          .map((c) => ({ id: c.id, material_id: c.material_id, texto: String(c.texto ?? ""), created_at: c.created_at, autor: c.profiles?.nombre ?? "Spark225" })),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [ids, user?.id, materiales, pulso]);

  if (!msgs.length) return null;
  const nuevos = msgs.filter((m) => !vistos || m.created_at > vistos);
  const lista = (nuevos.length ? nuevos : msgs).slice(0, 4);
  const marcar = () => {
    const ahora = new Date().toISOString();
    setVistos(ahora);
    try {
      localStorage.setItem(CLAVE + (user?.id ?? ""), ahora);
    } catch {
      /* nada */
    }
  };

  return (
    <section aria-label="Mensajes de Spark225" className={cn("rounded-2xl border p-4", nuevos.length ? "border-[#E37439]/40 bg-[#FFF7F2]" : "border-[#E3E6EA] bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-[#0E1E2A]">
          <MessageSquare className="h-4 w-4 text-[#E37439]" />
          {nuevos.length ? `${nuevos.length} ${nuevos.length === 1 ? "mensaje nuevo" : "mensajes nuevos"} de Spark225` : "Mensajes recientes de Spark225"}
        </p>
        {nuevos.length > 0 && (
          <button type="button" onClick={marcar} className="text-xs font-semibold text-[#7A8590] hover:text-[#E37439]">Marcar como vistos</button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-[#EEF0F2]">
        {lista.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => abrir(m.material_id)} className="flex w-full items-start gap-3 py-2 text-left hover:opacity-80">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[#0E1E2A]"><b>{m.autor}</b> · {nombre(m.material_id)}</span>
                <span className="block truncate text-xs text-[#4E5964]">{m.texto.split("\n")[0]}</span>
              </span>
              <span className="shrink-0 text-[11px] text-[#7A8590]">{formatDate(m.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
