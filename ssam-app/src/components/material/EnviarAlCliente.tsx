// Enviar al cliente (Paco): manda el material a revisión del cliente en un
// solo paso, sin recorrer las etapas internas una por una. Antes:
//  1) revisa que haya una versión nueva si el cliente lo había rechazado,
//  2) pide un mensaje para el cliente (qué cambió; si hubo rechazo, trae la
//     lista de correcciones para marcarlas como atendidas),
//  3) pasa por el checklist obligatorio de envío.
// El mensaje queda en la conversación que ve el cliente.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Send, X, AlertTriangle, Upload, Loader2 } from "lucide-react";
import { mutateChangeStatus, mutateCreateComment } from "@/data/operacion";
import { approvalsApi } from "@/lib/approvalsApi";
import { StorageService, type StoredFile } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { ChecklistEnvio } from "@/components/material/ChecklistEnvio";
import { SubirVersion } from "@/components/material/SubirVersion";
import { formatDate } from "@/lib/statusModel";
import type { Material } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const A_MEDICO = ["ideacion", "desarrollo_medico", "revision_direccion"];
const A_GRAFICO = ["desarrollo_grafico", "revision_direccion_grafico", "validacion_medica_final"];

/** A qué revisión del cliente va el material desde su etapa actual (o null). */
export function destinoCliente(status: string): string | null {
  if (A_MEDICO.includes(status)) return "aprobacion_cliente_medico";
  if (A_GRAFICO.includes(status)) return "aprobacion_cliente_grafico";
  return null;
}

const esEvidencia = (f: StoredFile) => f.stage === "cambios_cliente" || /^Cambio_cliente_|^Marcas_|^Nota_de_voz_|^Correcciones_/.test(f.name);

export function EnviarAlCliente({ material, onDone, compacto = false }: { material: Material; onDone: () => void; compacto?: boolean }) {
  const destino = destinoCliente(material.status);
  const [abierto, setAbierto] = useState(false);
  if (!destino) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAbierto(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E5B]/40",
          compacto ? "rounded-lg bg-[#2E9E5B] px-2 py-1 text-xs hover:bg-[#238048]" : "bg-[#2E9E5B] px-4 py-2 text-sm shadow-sm hover:bg-[#238048]",
        )}
      >
        <Send className={compacto ? "h-3.5 w-3.5" : "h-4 w-4"} /> Enviar al cliente
      </button>
      {abierto && <Dialogo material={material} destino={destino} onCerrar={() => setAbierto(false)} onDone={onDone} />}
    </>
  );
}

function Dialogo({ material, destino, onCerrar, onDone }: { material: Material; destino: string; onCerrar: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [archivos, setArchivos] = useState<StoredFile[] | null>(null);
  const [rechazo, setRechazo] = useState<{ created_at: string; comentario: string | null } | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [paso, setPaso] = useState<"mensaje" | "checklist">("mensaje");
  const [subir, setSubir] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const nombreRevision = destino === "aprobacion_cliente_medico" ? "revisión de contenido médico" : "revisión de diseño";

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [fs, a] = await Promise.all([StorageService.list(material.id), approvalsApi.list(material.id)]);
      if (!vivo) return;
      setArchivos(fs.filter((f) => !esEvidencia(f) && f.category !== "link"));
      const ult = (a.data ?? [])[0];
      const r = ult && ult.decision === "cambios" ? { created_at: ult.created_at, comentario: ult.comentario } : null;
      setRechazo(r);
      setMensaje((m) => {
        if (m) return m;
        // Si hubo rechazo, se proponen sus correcciones numeradas como atendidas.
        const notas = (r?.comentario ?? "").split("\n").filter((l) => /^\d+\./.test(l.trim()));
        return notas.length
          ? `Atendimos tus correcciones:\n${notas.map((l) => `${l.trim()} ✔`).join("\n")}`
          : r
            ? "Atendimos tus correcciones. Quedamos atentos a tu revisión."
            : "Te compartimos el material para tu revisión.";
      });
    })();
    return () => {
      vivo = false;
    };
  }, [material.id, recarga]);

  // ¿Hay alguna versión subida después del rechazo?
  const vigente = useMemo(() => [...(archivos ?? [])].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""))[0] ?? null, [archivos]);
  const sinVersionNueva = !!rechazo && (!vigente || (vigente.uploadedAt || "") < rechazo.created_at);
  const sinArchivo = archivos !== null && !vigente;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && paso === "mensaje" && !subir && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar, paso, subir]);

  if (paso === "checklist") {
    return (
      <ChecklistEnvio
        material={material}
        destino={destino}
        destinoNombre="cliente"
        onCerrar={onCerrar}
        onEnviar={async () => {
          const r = await mutateChangeStatus(material.id, destino);
          if (r.error) return { error: r.error };
          if (user && mensaje.trim()) {
            const v = vigente ? `\n\nArchivo: ${vigente.name} · versión ${vigente.version}` : "";
            await mutateCreateComment({ material_id: material.id, author_id: user.id, author_name: user.name, body: mensaje.trim() + v, interno: false });
          }
          onDone();
          return { error: null };
        }}
      />
    );
  }

  return createPortal(
    <>
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label="Enviar al cliente" onClick={(e) => e.stopPropagation()} className="ssam-ficha flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-foreground shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Enviar al cliente</h3>
            <p className="truncate text-xs text-muted-foreground">Pasa a {nombreRevision} · {material.client_name ?? "cliente"}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {archivos === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#E37439]" />
          ) : (
            <div className={cn("rounded-xl border px-3 py-2.5 text-sm", sinVersionNueva || sinArchivo ? "border-[#D99A12]/40 bg-[#F5C245]/10" : "border-border bg-muted/40")}>
              {sinArchivo ? (
                <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C08A0E]" /> El material no tiene ninguna pieza cargada. Súbela antes de enviarlo.</p>
              ) : sinVersionNueva ? (
                <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C08A0E]" /> El cliente lo rechazó el {formatDate(rechazo!.created_at)} y no has subido una versión nueva desde entonces.</p>
              ) : (
                <p>El cliente verá <b>{vigente!.name}</b> · versión {vigente!.version}.</p>
              )}
              {(sinArchivo || sinVersionNueva) && (
                <button type="button" onClick={() => setSubir(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#E37439] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C45B24]">
                  <Upload className="h-3.5 w-3.5" /> Subir versión
                </button>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Mensaje para el cliente</span>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={6} className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
            <span className="mt-1 block text-[11px] text-muted-foreground">Lo verá en la conversación del material junto con la versión que le envías.</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <p className="text-[11px] text-muted-foreground">Sigue el checklist obligatorio.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={() => setPaso("checklist")} disabled={archivos === null || sinArchivo} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E9E5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#238048] disabled:opacity-40">
              <Send className="h-4 w-4" /> Continuar al checklist
            </button>
          </div>
        </div>
      </div>
    </div>
    {subir && <SubirVersion material={material} onCerrar={() => setSubir(false)} onListo={() => setRecarga((n) => n + 1)} />}
    </>,
    document.body,
  );
}
