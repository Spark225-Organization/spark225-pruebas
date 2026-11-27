// Ficha del material a pantalla completa para el cliente.
// Izquierda: la pieza en grande, lista para verse sin descargar, con sus
// versiones. Derecha: en qué va, lo que le toca (aprobar / rechazar),
// fechas y la conversación con Spark225.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download, FileText, ImageIcon, Check, MessageSquare, CalendarClock, ExternalLink, Sparkles, Columns2, X } from "lucide-react";
import { StorageService, esEvidenciaCliente, type StoredFile } from "@/lib/storage";
import { approvalsApi } from "@/lib/approvalsApi";
import { usePulso } from "@/lib/pulso";
import type { Material } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";
import { momento, momentoIndice, pasoHecho, semaforo, TONO_CLASE, MOMENTOS } from "@/lib/portalModelo";
import { RevisionCliente } from "@/components/portal/RevisionCliente";
import { CommentThread } from "@/components/portal/CommentThread";
import { FechaRequeridaClienteCard } from "@/components/material/FechaRequeridaClienteCard";
import { useAuth } from "@/lib/auth";
import { setContextoContacto } from "@/components/portal/ContactoFlotante";
import { cn } from "@/lib/utils";

const esImagen = (f: StoredFile) => f.category === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);
const esPdf = (f: StoredFile) => f.category === "pdf" || /\.pdf$/i.test(f.name);

export function MaterialFicha({ material, onClose, onCambio }: { material: Material | null; onClose: () => void; onCambio: () => void }) {
  const { can } = useAuth();
  const [archivos, setArchivos] = useState<StoredFile[] | null>(null);
  const [verId, setVerId] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [comparar, setComparar] = useState(false);
  const [ultimaDecision, setUltimaDecision] = useState<string | null>(null);
  const [llegoNueva, setLlegoNueva] = useState<StoredFile | null>(null);
  const pulso = usePulso();

  // El botón de contacto sabe qué material está viendo el cliente.
  useEffect(() => {
    if (!material) return;
    setContextoContacto(`${material.folio != null ? `#${material.folio} ` : ""}${material.name}`);
    return () => setContextoContacto(null);
  }, [material?.id]);

  // Al cambiar de material se empieza de cero.
  useEffect(() => {
    setArchivos(null);
    setVerId(null);
    setLlegoNueva(null);
    setComparar(false);
  }, [material?.id]);

  // Archivos y última decisión. Se releen solos (pulso): si Paco envía una
  // versión nueva mientras el cliente tiene la ficha abierta, aparece al momento.
  useEffect(() => {
    if (!material) return;
    let vivo = true;
    Promise.all([StorageService.list(material.id), approvalsApi.list(material.id)]).then(([fs, a]) => {
      if (!vivo) return;
      // Las evidencias que sube el cliente no son «la pieza»: se ven en la conversación.
      const orden = fs
        .filter((f) => !esEvidenciaCliente(f))
        .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "") || b.version - a.version);
      setUltimaDecision((a.data ?? [])[0]?.created_at ?? null);
      setArchivos((antes) => {
        const nueva = orden[0];
        if (antes && nueva && !antes.some((f) => f.id === nueva.id)) {
          // Llegó una versión mientras la ficha estaba abierta: se muestra y se avisa.
          setLlegoNueva(nueva);
          setVerId(nueva.id);
        } else {
          setVerId((v) => (v && orden.some((f) => f.id === v) ? v : (nueva?.id ?? null)));
        }
        return orden;
      });
    });
    return () => {
      vivo = false;
    };
  }, [material?.id, recarga, pulso]);

  useEffect(() => {
    if (!material) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[role="dialog"][aria-label="Rechazar material"],[role="dialog"][aria-label="Aprobar material"],[aria-label="Marcar cambios sobre la imagen"]') && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [material, onClose]);

  // Archivos agrupados por pieza (nombre) con sus versiones.
  const piezas = useMemo(() => {
    const m = new Map<string, StoredFile[]>();
    for (const f of archivos ?? []) {
      if (!m.has(f.name)) m.set(f.name, []);
      m.get(f.name)!.push(f);
    }
    return [...m.entries()].map(([nombre, vs]) => ({ nombre, versiones: vs.sort((a, b) => b.version - a.version) }));
  }, [archivos]);

  if (!material) return null;
  const ver = archivos?.find((f) => f.id === verId) ?? null;
  const vigente = archivos?.[0] ?? null;
  const url = ver ? StorageService.getUrl(ver) : "";
  const paso = momentoIndice(material);
  const mom = MOMENTOS.find((x) => x.id === momento(material))!;
  const sem = semaforo(material);
  const piezaActual = piezas.find((p) => p.versiones.some((v) => v.id === verId));
  // La decisión siempre es sobre la versión vigente de la pieza que se ve.
  const vigentePieza = piezaActual?.versiones[0] ?? vigente;
  const viendoAnterior = !!ver && !!vigentePieza && ver.id !== vigentePieza.id;
  const anterior = piezaActual && piezaActual.versiones.length > 1 ? piezaActual.versiones[1] : null;
  // «Nueva»: subida después de la última decisión del cliente.
  const esNueva = !!vigentePieza && !!ultimaDecision && (vigentePieza.uploadedAt || "") > ultimaDecision && vigentePieza.version > 1;

  // Se monta en <body> para que ningún margen o transformación del listado la desplace.
  return createPortal(
    <div className="ssam-ficha fixed inset-0 z-50 flex flex-col bg-[#F3F4F6]" role="dialog" aria-label={`Material ${material.name}`}>
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[#E3E6EA] bg-white px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-[#4E5964] hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[#0E1E2A] sm:text-lg">
            {material.folio != null && <span className="mr-2 font-mono text-sm text-[#9AA4B2]">#{material.folio}</span>}
            {material.name}
          </p>
          <p className="truncate text-xs text-[#7A8590]">
            {material.product_name ?? "—"}
            {material.indication_name ? ` · ${material.indication_name}` : ""}
            {(material as any).formato_material ? ` · ${(material as any).formato_material}` : ""}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#0E1E2A]">
          <span className="h-2 w-2 rounded-full" style={{ background: mom.color }} /> {mom.corto}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONO_CLASE[sem.tono])}>{sem.label}</span>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Visor */}
        <section className="flex min-h-[50vh] flex-col p-3 sm:p-5" aria-label="Vista del material">
          {piezas.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {piezas.map((p) => {
                const activa = p === piezaActual;
                return (
                  <button key={p.nombre} type="button" onClick={() => setVerId(p.versiones[0].id)} className={cn("inline-flex max-w-[240px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold", activa ? "border-[#0E1E2A] bg-white text-[#0E1E2A]" : "border-transparent bg-white/60 text-[#4E5964] hover:bg-white")}>
                    {esImagen(p.versiones[0]) ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{p.nombre}</span>
                  </button>
                );
              })}
              {piezaActual && piezaActual.versiones.length > 1 && (
                <div className="ml-auto flex items-center gap-1 rounded-xl bg-white p-1">
                  {piezaActual.versiones.map((v, k) => (
                    <button key={v.id} type="button" onClick={() => setVerId(v.id)} aria-pressed={v.id === verId} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", v.id === verId ? "bg-[#E37439] text-white" : "text-[#4E5964] hover:bg-[#F3F4F6]")}>
                      v{v.version}
                      {k === 0 && <span className="ml-1 font-normal opacity-80">{esNueva ? "nueva" : "vigente"}</span>}
                    </button>
                  ))}
                  {anterior && (
                    <button type="button" onClick={() => setComparar((c) => !c)} aria-pressed={comparar} className={cn("ml-1 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold", comparar ? "bg-[#0E1E2A] text-white" : "text-[#0E1E2A] hover:bg-[#F3F4F6]")}>
                      <Columns2 className="h-3.5 w-3.5" /> {comparar ? "Dejar de comparar" : `Comparar con v${anterior.version}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {(llegoNueva || esNueva) && vigentePieza && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#2E9E5B]/30 bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#0E1E2A]">
              <Sparkles className="h-4 w-4 shrink-0 text-[#2E9E5B]" />
              <span className="min-w-0 flex-1">
                <b>Versión nueva: v{vigentePieza.version}</b> · Spark225 la subió el {formatDate(vigentePieza.uploadedAt)}
                {anterior ? ". Puedes compararla con la anterior." : "."}
              </span>
              {anterior && !comparar && (
                <button type="button" onClick={() => { setVerId(vigentePieza.id); setComparar(true); }} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#0E1E2A] shadow-sm hover:bg-[#F3F4F6]">Comparar</button>
              )}
              {llegoNueva && (
                <button type="button" onClick={() => setLlegoNueva(null)} aria-label="Cerrar aviso" className="rounded p-1 text-[#4E5964] hover:bg-white/60"><X className="h-3.5 w-3.5" /></button>
              )}
            </div>
          )}
          {viendoAnterior && vigentePieza && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#D99A12]/40 bg-[#F5C245]/15 px-3 py-2 text-sm text-[#0E1E2A]">
              <span className="min-w-0 flex-1">Estás viendo la <b>versión {ver!.version}</b>, que ya no es la vigente. Tu decisión aplica a la <b>v{vigentePieza.version}</b>.</span>
              <button type="button" onClick={() => setVerId(vigentePieza.id)} className="rounded-lg bg-[#0E1E2A] px-2.5 py-1 text-xs font-semibold text-white">Ver v{vigentePieza.version}</button>
            </div>
          )}

          {comparar && anterior && vigentePieza ? (
            <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
              {[anterior, vigentePieza].map((f, i) => (
                <div key={f.id} className="relative flex min-h-[40vh] flex-col overflow-hidden rounded-2xl border border-[#E3E6EA] bg-white">
                  <p className={cn("px-3 py-1.5 text-xs font-bold", i ? "bg-[#2E9E5B]/10 text-[#1E7D47]" : "bg-[#F3F4F6] text-[#4E5964]")}>
                    {i ? `v${f.version} · vigente` : `v${f.version} · anterior`}
                  </p>
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    {esImagen(f) ? (
                      <img src={StorageService.getUrl(f)} alt={f.name} className="max-h-full max-w-full object-contain p-2" />
                    ) : esPdf(f) ? (
                      <iframe src={StorageService.getUrl(f)} title={`${f.name} v${f.version}`} className="h-full w-full" />
                    ) : (
                      <p className="text-sm text-[#7A8590]">Descarga el archivo para verlo.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#E3E6EA] bg-white">
            {archivos === null ? (
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#E37439] border-t-transparent" aria-label="Cargando" />
            ) : !ver ? (
              <div className="px-6 text-center">
                <FileText className="mx-auto h-10 w-10 text-[#C9CED4]" />
                <p className="mt-3 text-sm font-semibold text-[#0E1E2A]">Aún no hay archivo para revisar</p>
                <p className="mt-1 text-xs text-[#7A8590]">Spark225 cargará aquí la pieza en cuanto esté lista.</p>
              </div>
            ) : esImagen(ver) ? (
              <img src={url} alt={ver.name} className="max-h-full max-w-full object-contain p-2" />
            ) : esPdf(ver) ? (
              <iframe src={url} title={ver.name} className="h-full w-full" />
            ) : (
              <div className="px-6 text-center">
                <FileText className="mx-auto h-10 w-10 text-[#C9CED4]" />
                <p className="mt-3 text-sm font-semibold text-[#0E1E2A]">{ver.name}</p>
                <p className="mt-1 text-xs text-[#7A8590]">Este tipo de archivo no se puede mostrar aquí; descárgalo para verlo.</p>
              </div>
            )}
            {ver && (
              <div className="absolute bottom-3 right-3 flex gap-2">
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0E1E2A] shadow hover:bg-white">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
                <a href={url} download={ver.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E1E2A] px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-[#1B2D3C]">
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
              </div>
            )}
          </div>
          )}
        </section>

        {/* Panel lateral */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-[#E3E6EA] bg-white p-4 pb-24 sm:p-5 sm:pb-24 lg:border-l lg:border-t-0" aria-label="Detalle y acciones">
          {momento(material) === "revisar" && <RevisionCliente material={material} vigente={vigentePieza} onDone={() => { setRecarga((n) => n + 1); onCambio(); }} />}

          <div>
            <p className="mb-2 text-xs font-semibold text-[#7A8590]">Etapa del material</p>
            <ol className="space-y-0">
              {MOMENTOS.map(({ nombre: s }, k) => (
                <li key={s} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", pasoHecho(k, paso) ? "bg-[#2E9E5B] text-white" : k === paso ? "bg-[#E37439] text-white ring-4 ring-[#E37439]/15" : "bg-[#EEF0F2] text-[#9AA4B2]")}>
                      {pasoHecho(k, paso) ? <Check className="h-3 w-3" /> : k + 1}
                    </span>
                    {k < MOMENTOS.length - 1 && <span className={cn("w-px flex-1 min-h-[14px]", pasoHecho(k, paso) ? "bg-[#2E9E5B]" : "bg-[#E3E6EA]")} />}
                  </span>
                  <span className={cn("pb-3 text-sm", k === paso ? "font-bold text-[#0E1E2A]" : pasoHecho(k, paso) ? "text-[#4E5964]" : "text-[#9AA4B2]")}>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-3">
            {can("captureFechaRequerida") && <FechaRequeridaClienteCard material={material} onDone={onCambio} />}
            <div className="flex items-center gap-3 rounded-2xl border border-[#E3E6EA] px-4 py-3">
              <CalendarClock className="h-4 w-4 text-[#4E5964]" />
              <div>
                <p className="text-xs text-[#7A8590]">Fecha de entrega comprometida por Spark225</p>
                <p className="text-sm font-semibold text-[#0E1E2A]">{material.fecha_comprometida ? formatDate(material.fecha_comprometida) : "Por definir"}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#7A8590]">
              <MessageSquare className="h-3.5 w-3.5" /> Conversación con Spark225
            </p>
            <CommentThread key={recarga} materialId={material.id} />
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
