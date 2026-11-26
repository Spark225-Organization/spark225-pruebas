// Correcciones que pidió el cliente, arriba del detalle interno: la categoría
// del rechazo, lo que escribió (lista numerada de notas) y las páginas que
// marcó sobre la pieza. Es lo primero que ve Paco al abrir el material.
import { useEffect, useState } from "react";
import { XCircle, CheckCircle2, ExternalLink, ImageIcon } from "lucide-react";
import { approvalsApi } from "@/lib/approvalsApi";
import { StorageService, type StoredFile } from "@/lib/storage";
import { nombreMotivo } from "@/lib/portalModelo";
import { formatDate } from "@/lib/statusModel";
import type { Material } from "@/lib/api-types";

const EN_DESARROLLO = ["desarrollo_medico", "desarrollo_grafico"];
const esEvidencia = (f: StoredFile) => f.stage === "cambios_cliente" || /^Correcciones_|^Cambio_cliente_|^Marcas_/.test(f.name);
const esImagen = (f: StoredFile) => f.category === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);

export function CorreccionesClienteCard({ material }: { material: Material }) {
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
  }, [material.id, material.status]);

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
      className={rechazo ? "rounded-2xl border border-[#D64545]/30 bg-[#FFF5F5] p-5" : "rounded-2xl border border-[#2E9E5B]/30 bg-[#F2FBF6] p-5"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={rechazo ? "flex items-center gap-1.5 text-sm font-bold text-[#B23A3A]" : "flex items-center gap-1.5 text-sm font-bold text-[#1E7D47]"}>
            {rechazo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {rechazo ? "El cliente rechazó esta versión" : "El cliente aprobó con comentarios"}
          </p>
          <p className="mt-0.5 text-xs text-[#4E5964]">
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
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-sm leading-relaxed text-[#0E1E2A]">{ultima.comentario}</pre>
      )}

      {archivos.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-[#4E5964]">Marcas sobre la pieza</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {archivos.map((f) => {
              const url = StorageService.getUrl(f);
              return (
                <li key={f.id}>
                  <a href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-[#E3E6EA] bg-white">
                    {esImagen(f) ? (
                      <img src={url} alt={f.name} className="h-24 w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex h-24 items-center justify-center text-[#9AA4B2]"><ImageIcon className="h-6 w-6" /></span>
                    )}
                    <span className="flex items-center gap-1 truncate px-2 py-1 text-[10px] text-[#4E5964]">
                      <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{f.name}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {rechazo && (
        <p className="mt-3 text-[11px] text-[#7A8590]">
          Corrige, sube la nueva versión en «Archivos» y vuelve a enviarla al cliente con el botón de avanzar etapa.
        </p>
      )}
    </section>
  );
}
