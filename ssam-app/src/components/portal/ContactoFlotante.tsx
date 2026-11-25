// Botón de contacto en la esquina inferior derecha del portal del cliente.
// Abre un panel corto: el cliente elige el tipo de mensaje, escribe (opcional)
// y lo manda por WhatsApp o correo, ya con su nombre, su laboratorio y, si
// está viendo un material, el folio y el título.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MessageCircle, X, Mail, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useOperacion } from "@/data/operacion";
import { cn } from "@/lib/utils";

export const WHATSAPP_SPARK = "525548654670"; // +52 55 4865 4670
export const CORREO_SPARK = "contacto@spark225.com";

// Material que el cliente tiene abierto (lo fija la ficha) para dar contexto.
let contexto: string | null = null;
const oyentes = new Set<() => void>();
export function setContextoContacto(texto: string | null) {
  contexto = texto;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

const TIPOS = ["Duda", "Comentario", "Sugerencia", "Urgente"] as const;

const IconoWhatsApp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.79 14.11c-.24.68-1.42 1.3-1.95 1.34-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.65-.14.27.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37Z" />
  </svg>
);

export function ContactoFlotante() {
  const { user } = useAuth();
  const data = useOperacion();
  const material = useSyncExternalStore(suscribir, () => contexto);
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Duda");
  const [texto, setTexto] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const fuera = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setAbierto(false);
    window.addEventListener("keydown", k);
    window.addEventListener("mousedown", fuera);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("mousedown", fuera);
    };
  }, [abierto]);

  if (!user) return null;
  const empresa = user.clientId ? data.clientById[user.clientId]?.name ?? null : null;
  const firma = `${user.name}${empresa ? ` (${empresa})` : ""}`;
  const cuerpo = [
    `Hola, Spark225. Soy ${firma}.`,
    `${tipo}${material ? ` sobre ${material}` : ""}:`,
    texto.trim() || "",
  ]
    .filter(Boolean)
    .join("\n");
  const whatsapp = `https://wa.me/${WHATSAPP_SPARK}?text=${encodeURIComponent(cuerpo)}`;
  const correo = `mailto:${CORREO_SPARK}?subject=${encodeURIComponent(`Portal de materiales · ${tipo}${material ? ` · ${material}` : ""}`)}&body=${encodeURIComponent(cuerpo)}`;

  return (
    <div ref={panel} className="fixed bottom-5 right-5 z-[55] flex flex-col items-end gap-3">
      {abierto && (
        <div role="dialog" aria-label="Contactar a Spark225" className="ssam-ficha w-[min(340px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#E3E6EA] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-2 bg-[#0E1E2A] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">¿Dudas o comentarios?</p>
              <p className="text-xs text-white/70">Escríbenos y te respondemos lo antes posible.</p>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de mensaje">
              {TIPOS.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors", tipo === t ? (t === "Urgente" ? "border-[#D64545] bg-[#D64545] text-white" : "border-[#E37439] bg-[#E37439] text-white") : "border-[#E3E6EA] text-[#4E5964] hover:border-[#E37439]/50")}>
                  {t}
                </button>
              ))}
            </div>
            {material && (
              <p className="rounded-lg bg-[#F6F7F8] px-2.5 py-1.5 text-[11px] text-[#4E5964]">
                Sobre: <b className="text-[#0E1E2A]">{material}</b>
              </p>
            )}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu mensaje (opcional)" className="min-h-[76px] w-full rounded-xl border border-[#E3E6EA] p-2.5 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsapp} target="_blank" rel="noreferrer" onClick={() => setAbierto(false)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1EBE5B]">
                <IconoWhatsApp className="h-4 w-4" /> WhatsApp
              </a>
              <a href={correo} onClick={() => setAbierto(false)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E3E6EA] px-3 py-2.5 text-sm font-semibold text-[#0E1E2A] hover:bg-[#F6F7F8]">
                <Mail className="h-4 w-4" /> Correo
              </a>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-[#7A8590]">
              <Send className="h-3 w-3" /> Se abre con tu nombre y el material ya escritos.
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar contacto" : "Contactar a Spark225"}
        className="group inline-flex h-14 items-center gap-2 rounded-full bg-[#E37439] pl-4 pr-5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#C45B24] hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E37439]/30"
      >
        {abierto ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="hidden sm:inline">{abierto ? "Cerrar" : "¿Dudas? Escríbenos"}</span>
      </button>
    </div>
  );
}
