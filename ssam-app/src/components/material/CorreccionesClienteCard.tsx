// Correcciones que pidió el cliente, arriba del detalle interno: la categoría
// del rechazo, lo que escribió (lista numerada de notas) y las páginas que
// marcó sobre la pieza. Es lo primero que ve Paco al abrir el material.
import { useEffect, useState } from "react";
import { XCircle, CheckCircle2, ExternalLink, ImageIcon, Upload, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { mutateCreateComment } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import { SubirVersion } from "@/components/material/SubirVersion";
import { EnviarAlCliente } from "@/components/material/EnviarAlCliente";
import { approvalsApi } from "@/lib/approvalsApi";
import { StorageService, type StoredFile } from "@/lib/storage";
import { nombreMotivo } from "@/lib/portalModelo";
import { formatDate } from "@/lib/statusModel";
import type { Material } from "@/lib/api-types";

const EN_DESARROLLO = ["desarrollo_medico", "desarrollo_grafico"];
const esEvidencia = (f: StoredFile) => f.stage === "cambios_cliente" || /^Correcciones_|^Cambio_cliente_|^Marcas_/.test(f.name);
const esImagen = (f: StoredFile) => f.category === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);

const RESPUESTAS = ["Recibido, ya trabajamos en las correcciones.", "Gracias, te enviamos la nueva versión hoy.", "¿Nos confirmas a qué referencia te refieres?"];

export function CorreccionesClienteCard({ material, onCambio }: { material: Material; onCambio?: () => void }) {
  const { user } = useAuth();
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subir, setSubir] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [ultima, setUltima] = useState<any | null>(null);
  const [archivos, setArchivos] = useState<StoredFile[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [a, fs] = await Promise.all([approvalsApi.list(material.id), StorageService.list(material.id)]);
      if (!vivo) return;
      const u = (a.data ?? [])[0] ?? null;
      setUltima(u);
      if (u) {
        // Evidencia subida alrededor de esa decisión (desde 30 min antes).
        const desde = new Date(u.created_at).getTime() - 30 * 60000;
        setArchivos(fs.filter((f) => esEvidencia(f) && new Date(f.uploadedAt).getTime() >= desde));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [material.id, material.status, recarga]);

  if (!ultima) return null;
  const rechazo = ultima.decision === "cambios";
  const conComentarios = !rechazo && (ultima.comentario || archivos.length);
  // Solo se destaca si hay algo que hacer: un rechazo con el material en
  // desarrollo, o una aprobación que trae comentarios.
  if (rechazo && !EN_DESARROLLO.includes(material.status)) return null;
  if (!rechazo && !conComentarios) return null;

  return (
    <section
      aria-label="Correcciones del cliente"
      className={rechazo ? "rounded-2xl border border-[#D64545]/35 bg-[#D64545]/[0.07] p-5" : "rounded-2xl border border-[#2E9E5B]/35 bg-[#2E9E5B]/[0.07] p-5"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={rechazo ? "flex items-center gap-1.5 text-sm font-bold text-[#B23A3A] dark:text-[#F08A8A]" : "flex items-center gap-1.5 text-sm font-bold text-[#1E7D47] dark:text-[#5CCB8A]"}>
            {rechazo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {rechazo ? "El cliente rechazó esta versión" : "El cliente aprobó con comentarios"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ultima.usuario_name ? `${ultima.usuario_name} · ` : ""}
            {formatDate(ultima.created_at)}
            {rechazo ? ` · ${ultima.stage === "aprobacion_cliente_medico" ? "contenido médico" : "diseño"}` : ""}
          </p>
        </div>
        {rechazo && (
          <span className="rounded-full bg-[#D64545] px-2.5 py-1 text-xs font-semibold text-white">{nombreMotivo(ultima.motivo)}</span>
        )}
      </div>

      {ultima.comentario && (
        <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-card p-3 font-sans text-sm leading-relaxed text-foreground">{ultima.comentario}</pre>
      )}

      {archivos.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Marcas sobre la pieza</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {archivos.map((f) => {
              const url = StorageService.getUrl(f);
              return (
                <li key={f.id}>
                  <a href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-border bg-card">
                    {esImagen(f) ? (
                      <img src={url} alt={f.name} className="h-24 w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex h-24 items-center justify-center text-muted-foreground/70"><ImageIcon className="h-6 w-6" /></span>
                    )}
                    <span className="flex items-center gap-1 truncate px-2 py-1 text-[10px] text-muted-foreground">
                      <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{f.name}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {/* Responder al cliente sin salir de aquí */}
      <div className="mt-4 rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Responder al cliente</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {RESPUESTAS.map((r) => (
            <button key={r} type="button" onClick={() => setRespuesta(r)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[#E37439] hover:text-[#E37439]">{r}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Escribe un mensaje que verá el cliente" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
          <button
            type="button"
            disabled={!respuesta.trim() || enviando || !user}
            onClick={async () => {
              if (!user) return;
              setEnviando(true);
              const r = await mutateCreateComment({ material_id: material.id, author_id: user.id, author_name: user.name, body: respuesta.trim(), interno: false });
              setEnviando(false);
              if (r.error) return toast.error(r.error);
              setRespuesta("");
              toast.success("Mensaje enviado al cliente.");
              onCambio?.();
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-40"
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar
          </button>
        </div>
      </div>

      {rechazo && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSubir(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:border-[#E37439] hover:text-[#E37439]">
            <Upload className="h-4 w-4" /> Subir versión corregida
          </button>
          <EnviarAlCliente material={material} onDone={() => onCambio?.()} />
          <span className="text-[11px] text-muted-foreground">Corrige, sube la versión y envíala de nuevo al cliente.</span>
        </div>
      )}
      {subir && <SubirVersion material={material} onCerrar={() => setSubir(false)} onListo={() => { setRecarga((n) => n + 1); onCambio?.(); }} />}
    </section>
  );
}
