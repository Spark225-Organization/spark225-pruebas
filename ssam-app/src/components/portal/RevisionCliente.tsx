// Revisión del cliente dentro de la ficha: Aprobar o Rechazar.
// Rechazar pide una categoría obligatoria (una sola, para las estadísticas de
// rechazos), el motivo por escrito (texto o voz con transcripción) y evidencia
// opcional (archivos y marcas sobre la pieza). Todo queda en el historial y
// le llega al equipo de Spark225.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Mic, Square, Paperclip, PenLine, X, Loader2, FileText } from "lucide-react";
import { mutateClientDecision, mutateCreateComment } from "@/data/operacion";
import { StorageService, type StoredFile } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import type { Material } from "@/lib/api-types";
import { MOTIVOS_RECHAZO } from "@/lib/portalModelo";
import { MarcadorImagen } from "@/components/portal/MarcadorImagen";
import { cn } from "@/lib/utils";

type Adjunto = { id: string; file: File; url: string };

export function RevisionCliente({
  material,
  vigente,
  onDone,
}: {
  material: Material;
  /** Versión que el cliente está viendo (la que aprueba o regresa). */
  vigente: StoredFile | null;
  onDone: () => void;
}) {
  const [modo, setModo] = useState<null | "aprobar" | "rechazar">(null);
  const etapa = material.status === "aprobacion_cliente_medico" ? "el contenido médico" : "el diseño";

  return (
    <div className="rounded-2xl border border-[#E37439]/35 bg-[#FFF7F2] p-4">
      <p className="text-sm font-bold text-[#0E1E2A]">Pendiente de tu revisión: {etapa}</p>
      <p className="mt-1 text-xs text-[#4E5964]">
        {vigente ? (
          <>Archivo en revisión: <b>{vigente.name}</b> · versión {vigente.version}. Tu decisión aplica a esta versión.</>
        ) : (
          "Aún no hay archivo cargado; tu decisión quedará registrada sin versión."
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setModo("aprobar")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2E9E5B] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#238048] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E5B]/40">
          <CheckCircle2 className="h-4 w-4" /> Aprobar
        </button>
        <button type="button" onClick={() => setModo("rechazar")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D64545]/35 bg-white px-3 py-2.5 text-sm font-semibold text-[#B23A3A] hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D64545]/30">
          <XCircle className="h-4 w-4" /> Rechazar
        </button>
      </div>
      {modo === "aprobar" && <Aprobar material={material} vigente={vigente} onCerrar={() => setModo(null)} onDone={onDone} />}
      {modo === "rechazar" && <Rechazar material={material} vigente={vigente} onCerrar={() => setModo(null)} onDone={onDone} />}
    </div>
  );
}

function Hoja({ titulo, children, onCerrar }: { titulo: string; children: React.ReactNode; onCerrar: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/40 p-0 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()} className="ssam-ficha flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[#EEF0F2] px-5 py-4">
          <h3 className="text-base font-bold text-[#0E1E2A]">{titulo}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-[#7A8590] hover:bg-[#F3F4F6]">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Aprobar({ material, vigente, onCerrar, onDone }: { material: Material; vigente: StoredFile | null; onCerrar: () => void; onDone: () => void }) {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    setEnviando(true);
    const r = await mutateClientDecision(material.id, "aprobado", vigente?.id ?? null, nota.trim());
    setEnviando(false);
    if (r.error) return toast.error(r.error);
    toast.success("Aprobado. Spark225 ya fue notificado.");
    onCerrar();
    onDone();
  };
  return (
    <Hoja titulo="Aprobar material" onCerrar={onCerrar}>
      <div className="space-y-3 p-5">
        <p className="text-sm text-[#4E5964]">
          Confirmas que {vigente ? <b>{vigente.name} (versión {vigente.version})</b> : "este material"} cumple con lo que pediste. El material avanza a la siguiente etapa.
        </p>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Comentario para Spark225 (opcional)" className="min-h-[80px] w-full rounded-xl border border-[#E3E6EA] p-3 text-sm outline-none focus:border-[#2E9E5B] focus:ring-2 focus:ring-[#2E9E5B]/20" />
      </div>
      <div className="flex justify-end gap-2 border-t border-[#EEF0F2] px-5 py-3">
        <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-[#4E5964] hover:bg-[#F3F4F6]">Cancelar</button>
        <button type="button" onClick={enviar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E9E5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#238048] disabled:opacity-60">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar aprobación
        </button>
      </div>
    </Hoja>
  );
}

// Reconocimiento de voz del navegador (Chrome/Edge/Safari). Sin costo ni servidor.
const Reconocedor: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

function Rechazar({ material, vigente, onCerrar, onDone }: { material: Material; vigente: StoredFile | null; onCerrar: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState<string>("");
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [marcando, setMarcando] = useState<{ src: string; nombre: string } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [enviando, setEnviando] = useState(false);
  const rec = useRef<any>(null);
  const grab = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const agregar = (files: FileList | File[]) =>
    setAdjuntos((a) => [...a, ...Array.from(files).map((f) => ({ id: Math.random().toString(36).slice(2), file: f, url: URL.createObjectURL(f) }))]);

  const empezarVoz = async () => {
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      trozos.current = [];
      const mr = new MediaRecorder(flujo);
      mr.ondataavailable = (e) => e.data.size && trozos.current.push(e.data);
      mr.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        const b = new Blob(trozos.current, { type: mr.mimeType || "audio/webm" });
        if (b.size) agregar([new File([b], `Nota_de_voz_${new Date().toLocaleTimeString("es-MX").replace(/:/g, "-")}.webm`, { type: b.type })]);
      };
      mr.start();
      grab.current = mr;
      if (Reconocedor) {
        const r = new Reconocedor();
        r.lang = "es-MX";
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (e: any) => {
          let fin = "", tmp = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) fin += t;
            else tmp += t;
          }
          if (fin) setTexto((x) => (x ? x.trimEnd() + " " : "") + fin.trim());
          setParcial(tmp);
        };
        r.start();
        rec.current = r;
      }
      setGrabando(true);
    } catch {
      toast.error("No pudimos usar el micrófono. Revisa el permiso del navegador.");
    }
  };
  const pararVoz = () => {
    rec.current?.stop();
    grab.current?.stop();
    rec.current = null;
    grab.current = null;
    setParcial("");
    setGrabando(false);
  };
  useEffect(() => () => { rec.current?.stop(); grab.current?.state === "recording" && grab.current.stop(); }, []);

  const esImagenVigente = !!vigente && (vigente.category === "image" || /\.(png|jpe?g|webp|gif)$/i.test(vigente.name));
  const urlVigente = vigente ? StorageService.getUrl(vigente) : "";

  const listo = !!motivo && texto.trim().length > 0;

  const enviar = async () => {
    if (!listo || !user) return;
    setEnviando(true);
    try {
      // 1. Evidencia: se sube al material como archivos de «Cambios del cliente».
      const subidos: string[] = [];
      for (const a of adjuntos) {
        // Prefijo para distinguir la evidencia del cliente de la pieza que se revisa.
        const f = new File([a.file], `Cambio_cliente_${a.file.name}`, { type: a.file.type });
        await StorageService.upload({ file: f, materialId: material.id, stage: "cambios_cliente", uploadedBy: user.id, uploadedByName: user.name });
        subidos.push(f.name);
      }
      const categoria = MOTIVOS_RECHAZO.find((x) => x.id === motivo)?.nombre ?? motivo;
      const cuerpo = [
        `Rechazado · ${categoria}${vigente ? ` · ${vigente.name} v${vigente.version}` : ""}:`,
        texto.trim(),
        subidos.length ? `Adjuntos: ${subidos.join(", ")}` : "",
      ].filter(Boolean).join("\n");
      // 2. Comentario visible para ambos lados, con todo el detalle.
      await mutateCreateComment({ material_id: material.id, author_id: user.id, author_name: user.name, body: cuerpo, interno: false, requiere_cambio: true });
      // 3. Decisión: regresa a desarrollo con la categoría de rechazo registrada.
      const r = await mutateClientDecision(material.id, "cambios", vigente?.id ?? null, cuerpo, motivo);
      if (r.error) throw new Error(r.error);
      toast.success("Rechazo registrado. Spark225 ya fue notificado.");
      onCerrar();
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo registrar el rechazo.");
    }
    setEnviando(false);
  };

  return (
    <Hoja titulo="Rechazar material" onCerrar={onCerrar}>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="text-sm font-semibold text-[#0E1E2A]">1. Categoría del rechazo</p>
          <p className="text-xs text-[#7A8590]">Elige una. Nos permite medir el origen de cada rechazo.</p>
          <div role="radiogroup" aria-label="Categoría del rechazo" className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {MOTIVOS_RECHAZO.map((m) => {
              const on = motivo === m.id;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMotivo(m.id)} className={cn("rounded-xl border px-3 py-2 text-left transition-colors", on ? "border-[#D64545] bg-[#FFF1F1]" : "border-[#E3E6EA] hover:border-[#D64545]/40")}>
                  <span className={cn("block text-xs font-semibold", on ? "text-[#B23A3A]" : "text-[#0E1E2A]")}>{m.nombre}</span>
                  <span className="block text-[11px] leading-snug text-[#7A8590]">{m.ayuda}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0E1E2A]">2. Motivo del rechazo</p>
            <button type="button" onClick={grabando ? pararVoz : empezarVoz} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", grabando ? "bg-[#D64545] text-white" : "bg-[#F3F4F6] text-[#0E1E2A] hover:bg-[#E9EBEE]")}>
              {grabando ? (
                <>
                  <Square className="h-3 w-3" /> Detener
                  <span className="ssam-onda ml-1 inline-flex h-3 items-center gap-0.5">
                    <span className="h-3" /><span className="h-3" /><span className="h-3" /><span className="h-3" />
                  </span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" /> Dictar nota de voz
                </>
              )}
            </button>
          </div>
          <textarea value={texto + (parcial ? (texto ? " " : "") + parcial : "")} onChange={(e) => setTexto(e.target.value)} placeholder="Describe el motivo y lo que debe corregirse. Ej.: en la lámina 2, la referencia 3 no corresponde a la fuente citada." className="mt-2 min-h-[110px] w-full rounded-xl border border-[#E3E6EA] p-3 text-sm outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
          <p className="mt-1 text-[11px] text-[#7A8590]">
            {Reconocedor ? "Al dictar, se transcribe aquí y el audio también se adjunta." : "Tu navegador no transcribe la voz; el audio se adjunta para que lo escuchemos."}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#0E1E2A]">3. Evidencia <span className="font-normal text-[#7A8590]">(opcional)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {esImagenVigente && (
              <button type="button" onClick={() => setMarcando({ src: urlVigente, nombre: vigente!.name })} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E37439]/40 bg-[#FFF7F2] px-3 py-2 text-xs font-semibold text-[#C45B24] hover:bg-[#FFEFE4]">
                <PenLine className="h-3.5 w-3.5" /> Marcar sobre la pieza
              </button>
            )}
            <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3E6EA] px-3 py-2 text-xs font-semibold text-[#0E1E2A] hover:bg-[#F6F7F8]">
              <Paperclip className="h-3.5 w-3.5" /> Adjuntar imágenes o archivos
            </button>
            <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && agregar(e.target.files)} />
          </div>
          {adjuntos.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {adjuntos.map((a) => {
                const img = a.file.type.startsWith("image/");
                const audio = a.file.type.startsWith("audio/");
                return (
                  <li key={a.id} className="group relative overflow-hidden rounded-xl border border-[#E3E6EA] bg-[#F8F9FA]">
                    {img ? <img src={a.url} alt={a.file.name} className="h-24 w-full object-cover" /> : audio ? <audio src={a.url} controls className="h-24 w-full px-1" /> : <div className="flex h-24 items-center justify-center"><FileText className="h-7 w-7 text-[#9AA4B2]" /></div>}
                    <p className="truncate px-2 py-1 text-[10px] text-[#4E5964]">{a.file.name}</p>
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {img && (
                        <button type="button" onClick={() => setMarcando({ src: a.url, nombre: a.file.name })} aria-label="Marcar sobre esta imagen" className="rounded-full bg-white/95 p-1 shadow"><PenLine className="h-3 w-3" /></button>
                      )}
                      <button type="button" onClick={() => setAdjuntos((x) => x.filter((y) => y.id !== a.id))} aria-label="Quitar adjunto" className="rounded-full bg-white/95 p-1 shadow"><X className="h-3 w-3" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[#EEF0F2] px-5 py-3">
        <p className="text-[11px] text-[#7A8590]">{!motivo ? "Elige la categoría" : !listo ? "Describe el motivo del rechazo" : "Listo para enviar"}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-[#4E5964] hover:bg-[#F3F4F6]">Cancelar</button>
          <button type="button" onClick={enviar} disabled={!listo || enviando || grabando} className="inline-flex items-center gap-1.5 rounded-xl bg-[#D64545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B23A3A] disabled:opacity-50">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Confirmar rechazo
          </button>
        </div>
      </div>
      {marcando && (
        <MarcadorImagen
          src={marcando.src}
          nombre={marcando.nombre}
          onCerrar={() => setMarcando(null)}
          onListo={(f) => {
            agregar([f]);
            setMarcando(null);
            toast.success("Marcas adjuntadas");
          }}
        />
      )}
    </Hoja>
  );
}
