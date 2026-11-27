// Subir versión (menú de Paco): elige la pieza del material (o una nueva) y
// sube el archivo corregido como su siguiente versión. El cliente verá la
// versión nueva como la vigente cuando el material vuelva a su revisión.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Loader2, Upload, Paperclip, FileText, CheckCircle2, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { StorageService, esEvidenciaCliente, type StoredFile } from "@/lib/storage";
import { DialogoEnviar, destinoCliente } from "@/components/material/EnviarAlCliente";
import { avisarCambio } from "@/lib/pulso";
import type { Material } from "@/lib/api-types";
import { cn } from "@/lib/utils";


/** preguntarEnvio=false cuando ya se abrió desde «Enviar al cliente»: al subir solo se cierra. */
export function SubirVersion({ material, onCerrar, onListo, preguntarEnvio = true }: { material: Material; onCerrar: () => void; onListo?: () => void; preguntarEnvio?: boolean }) {
  const { user } = useAuth();
  const [archivos, setArchivos] = useState<StoredFile[] | null>(null);
  const [pieza, setPieza] = useState<string>("nueva");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  // Después de subir: «¿Se la envías ya al cliente?»
  const [subida, setSubida] = useState<StoredFile | null>(null);
  const [enviar, setEnviar] = useState(false);
  const enRevisionCliente = /^aprobacion_cliente/.test(material.status);
  const puedeEnviar = !!destinoCliente(material.status);

  useEffect(() => {
    StorageService.list(material.id).then((fs) => setArchivos(fs.filter((f) => !esEvidenciaCliente(f) && f.category !== "link")));
  }, [material.id]);

  // Una entrada por pieza, con su versión más reciente.
  const piezas = useMemo(() => {
    const m = new Map<string, StoredFile>();
    for (const f of archivos ?? []) {
      const actual = m.get(f.name);
      if (!actual || f.version > actual.version) m.set(f.name, f);
    }
    return [...m.values()];
  }, [archivos]);

  useEffect(() => {
    if (piezas.length && pieza === "nueva") setPieza(piezas[0].id);
  }, [piezas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  const subir = async () => {
    if (!archivo || !user) return;
    setSubiendo(true);
    try {
      const base = piezas.find((p) => p.id === pieza);
      // La versión nueva conserva el nombre de la pieza para que se agrupen.
      const f = base ? new File([archivo], base.name, { type: archivo.type || base.mimeType }) : archivo;
      const nueva = await StorageService.upload({
        file: f,
        materialId: material.id,
        stage: material.status,
        uploadedBy: user.id,
        uploadedByName: user.name,
        notes: nota.trim() || undefined,
        newVersionOf: base?.id,
        // Si el cliente ya está revisando, la ve al momento.
        visibleCliente: enRevisionCliente,
      });
      onListo?.();
      avisarCambio();
      if (enRevisionCliente || !preguntarEnvio) {
        toast.success(enRevisionCliente ? `Versión ${nueva.version} subida. El cliente ya la ve.` : `Versión ${nueva.version} subida.`);
        onCerrar();
      } else {
        setSubida(nueva);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo subir el archivo.");
    }
    setSubiendo(false);
  };

  if (enviar) return <DialogoEnviar material={material} onCerrar={onCerrar} onDone={() => { onListo?.(); avisarCambio(); }} />;

  if (subida) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
        <div role="dialog" aria-label="Versión subida" onClick={(e) => e.stopPropagation()} className="ssam-ficha w-full max-w-md rounded-t-3xl border border-border bg-card p-6 text-foreground shadow-2xl sm:rounded-3xl">
          <p className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-5 w-5 text-[#2E9E5B]" /> Versión {subida.version} guardada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {puedeEnviar
              ? "El cliente todavía no la ve. Se le mostrará en cuanto se la envíes."
              : "Queda guardada en el material. El cliente la verá cuando el material llegue a su revisión."}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">{puedeEnviar ? "Enviar después" : "Listo"}</button>
            {puedeEnviar && (
              <button type="button" onClick={() => setEnviar(true)} autoFocus className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E9E5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#238048]">
                <Send className="h-4 w-4" /> Enviar al cliente ahora
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label="Subir versión" onClick={(e) => e.stopPropagation()} className="ssam-ficha flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-foreground shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Subir versión</h3>
            <p className="truncate text-xs text-muted-foreground">{material.folio != null ? `#${material.folio} · ` : ""}{material.name}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">¿Qué pieza actualizas?</legend>
            {archivos === null ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#E37439]" />
            ) : (
              <div className="space-y-1.5">
                {piezas.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPieza(p.id)} aria-pressed={pieza === p.id} className={cn("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left", pieza === p.id ? "border-[#E37439] bg-[#E37439]/10" : "border-border hover:border-[#E37439]/50")}>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">v{p.version} → v{p.version + 1}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setPieza("nueva")} aria-pressed={pieza === "nueva"} className={cn("w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold", pieza === "nueva" ? "border-[#E37439] bg-[#E37439]/10" : "border-dashed border-border text-muted-foreground hover:border-[#E37439]/50")}>
                  + Pieza nueva
                </button>
              </div>
            )}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 hover:border-[#E37439]">
            {archivo ? <FileText className="h-5 w-5 text-[#E37439]" /> : <Paperclip className="h-5 w-5 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate text-sm">{archivo ? archivo.name : "Elige el archivo corregido (PDF o imagen)"}</span>
            <input type="file" accept=".pdf,image/*" hidden onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Qué cambió (opcional)</span>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Ej.: se corrigió la referencia 1 y el color del logo" className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
          <button type="button" onClick={subir} disabled={!archivo || subiendo} className="inline-flex items-center gap-1.5 rounded-xl bg-[#E37439] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C45B24] disabled:opacity-40">
            {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
