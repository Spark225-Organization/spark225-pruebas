// Corregir sobre la pieza: el cliente revisa el material página por página y
// marca encima lo que hay que corregir, como lo haría con una pluma sobre el
// impreso: resaltar, subrayar, encerrar, flecha, dibujo libre y notas
// numeradas con texto. Al terminar elige Rechazar o Aprobar con comentarios;
// las páginas marcadas se adjuntan como imagen y la lista de notas como texto.
// Los PDF se muestran con pdf.js, que se carga al abrir (sin instalar nada).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Highlighter,
  Underline,
  Circle,
  MoveUpRight,
  PenLine,
  MessageSquarePlus,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type P = [number, number];
type Trazo =
  | { tipo: "pluma" | "resaltar"; color: string; puntos: P[] }
  | { tipo: "subrayar" | "circulo" | "flecha"; color: string; a: P; b: P }
  | { tipo: "nota"; color: string; a: P; n: number };

type Herramienta = "resaltar" | "subrayar" | "circulo" | "flecha" | "pluma" | "nota";
type Pagina = { src: string; img: HTMLImageElement | null; w: number; h: number };
export type Nota = { n: number; pagina: number; texto: string };

export type ResultadoCorreccion = {
  accion: "rechazar" | "aprobar";
  archivos: File[];
  texto: string;
  notas: Nota[];
};

const COLORES = ["#E5342B", "#1F6FEB", "#2E9E5B", "#0E1E2A"];
const AMARILLO = "#F5C245";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
const MAX_PAGINAS = 40;

const HERRAMIENTAS: { id: Herramienta; nombre: string; Ico: typeof PenLine; ayuda: string }[] = [
  { id: "resaltar", nombre: "Resaltar", Ico: Highlighter, ayuda: "Pasa encima del texto para resaltarlo" },
  { id: "subrayar", nombre: "Subrayar", Ico: Underline, ayuda: "Arrastra debajo del texto" },
  { id: "circulo", nombre: "Encerrar", Ico: Circle, ayuda: "Arrastra para encerrar una zona" },
  { id: "flecha", nombre: "Flecha", Ico: MoveUpRight, ayuda: "Arrastra para señalar" },
  { id: "pluma", nombre: "Dibujar", Ico: PenLine, ayuda: "Dibuja a mano alzada" },
  { id: "nota", nombre: "Nota", Ico: MessageSquarePlus, ayuda: "Toca donde va la corrección y escríbela" },
];

async function cargarPdf(url: string): Promise<string[]> {
  const pdfjs: any = await import(/* @vite-ignore */ PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ url }).promise;
  const out: string[] = [];
  const total = Math.min(doc.numPages, MAX_PAGINAS);
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const escala = Math.min(2.5, 1600 / base.width);
    const vp = page.getViewport({ scale: escala });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    out.push(c.toDataURL("image/png"));
  }
  return out;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error("imagen"));
    i.src = src;
  });
}

function dibujar(g: CanvasRenderingContext2D, pag: Pagina, trazos: Trazo[]) {
  g.clearRect(0, 0, pag.w, pag.h);
  if (pag.img) g.drawImage(pag.img, 0, 0, pag.w, pag.h);
  const grosor = Math.max(3, pag.w / 260);
  for (const t of trazos) {
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = t.color;
    g.lineWidth = grosor;
    if (t.tipo === "resaltar") {
      g.globalAlpha = 0.38;
      g.globalCompositeOperation = "multiply";
      g.strokeStyle = AMARILLO;
      g.lineWidth = grosor * 6;
      g.lineCap = "butt";
    }
    if (t.tipo === "pluma" || t.tipo === "resaltar") {
      g.beginPath();
      t.puntos.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    } else if (t.tipo === "subrayar") {
      g.beginPath();
      g.moveTo(t.a[0], t.a[1]);
      g.lineTo(t.b[0], t.a[1]);
      g.stroke();
    } else if (t.tipo === "circulo") {
      const [x1, y1] = t.a, [x2, y2] = t.b;
      g.beginPath();
      g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2);
      g.stroke();
    } else if (t.tipo === "flecha") {
      const [x1, y1] = t.a, [x2, y2] = t.b;
      const ang = Math.atan2(y2 - y1, x2 - x1), p = grosor * 5;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.moveTo(x2, y2);
      g.lineTo(x2 - p * Math.cos(ang - 0.45), y2 - p * Math.sin(ang - 0.45));
      g.moveTo(x2, y2);
      g.lineTo(x2 - p * Math.cos(ang + 0.45), y2 - p * Math.sin(ang + 0.45));
      g.stroke();
    } else if (t.tipo === "nota") {
      const r = grosor * 4.2;
      g.fillStyle = t.color;
      g.beginPath();
      g.arc(t.a[0], t.a[1], r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = grosor * 0.6;
      g.strokeStyle = "#ffffff";
      g.stroke();
      g.fillStyle = "#ffffff";
      g.font = `700 ${Math.round(r * 1.15)}px Inter, Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(t.n), t.a[0], t.a[1] + 1);
    }
    g.restore();
  }
}

export function CorrectorPieza({
  src,
  nombre,
  version,
  esPdf,
  onCerrar,
  onTerminar,
}: {
  src: string;
  nombre: string;
  version?: number | null;
  esPdf: boolean;
  onCerrar: () => void;
  onTerminar: (r: ResultadoCorreccion) => void;
}) {
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actualPag, setActualPag] = useState(0);
  const [trazos, setTrazos] = useState<Record<number, Trazo[]>>({});
  const [notas, setNotas] = useState<Nota[]>([]);
  const [herr, setHerr] = useState<Herramienta>("nota");
  const [color, setColor] = useState(COLORES[0]);
  const [zoom, setZoom] = useState(1);
  const [exportando, setExportando] = useState<null | "rechazar" | "aprobar">(null);
  const [enfocar, setEnfocar] = useState<number | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const enCurso = useRef<Trazo | null>(null);
  const [, repintar] = useState(0);

  // Cargar la pieza: PDF página por página o imagen única.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let fuentes: string[];
        if (esPdf && !src.startsWith("data:image")) {
          try {
            fuentes = await cargarPdf(src);
          } catch {
            fuentes = [src]; // si no es un PDF legible, se intenta como imagen
          }
        } else fuentes = [src];
        const pags: Pagina[] = [];
        for (const f of fuentes) {
          const img = await cargarImagen(f);
          pags.push({ src: f, img, w: img.naturalWidth || 1200, h: img.naturalHeight || 800 });
        }
        if (vivo) setPaginas(pags);
      } catch {
        if (vivo) setError("No se pudo abrir la pieza para corregirla aquí. Descárgala, márcala y adjúntala en «Rechazar».");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [src, esPdf]);

  const pag = paginas?.[actualPag] ?? null;
  const trazosPag = trazos[actualPag] ?? [];

  // Ajuste inicial: que la página quepa a lo ancho del área.
  const area = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState(1);
  useEffect(() => {
    if (!pag || !area.current) return;
    const calc = () => {
      const a = area.current!;
      setAjuste(Math.min((a.clientWidth - 48) / pag.w, (a.clientHeight - 48) / pag.h, 1.5));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [pag]);

  useEffect(() => {
    const c = lienzo.current;
    if (!c || !pag) return;
    c.width = pag.w;
    c.height = pag.h;
    dibujar(c.getContext("2d")!, pag, [...trazosPag, ...(enCurso.current ? [enCurso.current] : [])]);
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(document.activeElement instanceof HTMLTextAreaElement)) onCerrar();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  const punto = (e: React.PointerEvent): P => {
    const c = lienzo.current!, r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  };

  const siguienteN = () => (notas.length ? Math.max(...notas.map((x) => x.n)) + 1 : 1);

  const bajar = (e: React.PointerEvent) => {
    if (!pag) return;
    const p = punto(e);
    if (herr === "nota") {
      const n = siguienteN();
      setTrazos((t) => ({ ...t, [actualPag]: [...(t[actualPag] ?? []), { tipo: "nota", color, a: p, n }] }));
      setNotas((x) => [...x, { n, pagina: actualPag + 1, texto: "" }]);
      setEnfocar(n);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    enCurso.current = herr === "pluma" || herr === "resaltar" ? { tipo: herr, color, puntos: [p] } : { tipo: herr, color, a: p, b: p };
    repintar((n) => n + 1);
  };
  const mover = (e: React.PointerEvent) => {
    const t = enCurso.current;
    if (!t) return;
    const p = punto(e);
    if (t.tipo === "pluma" || t.tipo === "resaltar") t.puntos.push(p);
    else if (t.tipo !== "nota") t.b = p;
    repintar((n) => n + 1);
  };
  const soltar = () => {
    const t = enCurso.current;
    enCurso.current = null;
    if (t) setTrazos((x) => ({ ...x, [actualPag]: [...(x[actualPag] ?? []), t] }));
  };

  const deshacer = () => {
    const ult = trazosPag[trazosPag.length - 1];
    if (!ult) return;
    if (ult.tipo === "nota") setNotas((x) => x.filter((y) => y.n !== ult.n));
    setTrazos((x) => ({ ...x, [actualPag]: trazosPag.slice(0, -1) }));
  };
  const limpiarPagina = () => {
    const ns = new Set(trazosPag.filter((t) => t.tipo === "nota").map((t) => (t as any).n));
    setNotas((x) => x.filter((y) => !ns.has(y.n)));
    setTrazos((x) => ({ ...x, [actualPag]: [] }));
  };
  const quitarNota = (n: number) => {
    setNotas((x) => x.filter((y) => y.n !== n));
    setTrazos((x) => {
      const r: Record<number, Trazo[]> = {};
      for (const [k, v] of Object.entries(x)) r[+k] = v.filter((t) => !(t.tipo === "nota" && t.n === n));
      return r;
    });
  };

  const totalMarcas = useMemo(() => Object.values(trazos).reduce((s, v) => s + v.length, 0), [trazos]);
  const notasSinTexto = notas.filter((x) => !x.texto.trim()).length;

  const terminar = async (accion: "rechazar" | "aprobar") => {
    if (!paginas) return;
    setExportando(accion);
    try {
      const base = nombre.replace(/\.[^.]+$/, "");
      const archivos: File[] = [];
      for (let i = 0; i < paginas.length; i++) {
        const ts = trazos[i] ?? [];
        if (!ts.length) continue;
        const c = document.createElement("canvas");
        c.width = paginas[i].w;
        c.height = paginas[i].h;
        dibujar(c.getContext("2d")!, paginas[i], ts);
        const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, "image/png"));
        if (!blob) throw new Error("png");
        const suf = paginas.length > 1 ? `_pag${i + 1}` : "";
        archivos.push(new File([blob], `Correcciones_${base}${suf}.png`, { type: "image/png" }));
      }
      const lista = [...notas].sort((a, b) => a.n - b.n).filter((x) => x.texto.trim());
      const texto = lista.length
        ? lista.map((x) => `${x.n}.${paginas.length > 1 ? ` (pág. ${x.pagina})` : ""} ${x.texto.trim()}`).join("\n")
        : "";
      onTerminar({ accion, archivos, texto, notas: lista });
    } catch {
      setError("Este archivo no se puede exportar desde el navegador. Descárgalo, márcalo y adjúntalo en «Rechazar».");
    }
    setExportando(null);
  };

  const escala = ajuste * zoom;
  const ayuda = HERRAMIENTAS.find((h) => h.id === herr)!.ayuda;

  return createPortal(
    <div className="ssam-ficha fixed inset-0 z-[70] flex flex-col bg-[#EEF0F2]" role="dialog" aria-label="Corregir sobre la pieza">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E3E6EA] bg-white px-3 py-2.5 sm:px-4">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-bold text-[#0E1E2A]">Corregir sobre la pieza</p>
          <p className="truncate text-[11px] text-[#7A8590]">
            {nombre}
            {version ? ` · versión ${version}` : ""} · {ayuda}
          </p>
        </div>
        <div className="flex flex-wrap rounded-xl bg-[#F3F4F6] p-1" role="toolbar" aria-label="Herramientas">
          {HERRAMIENTAS.map(({ id, nombre: t, Ico }) => (
            <button key={id} type="button" onClick={() => setHerr(id)} aria-pressed={herr === id} title={t} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors", herr === id ? "bg-[#0E1E2A] text-white" : "text-[#4E5964] hover:bg-white")}>
              <Ico className="h-3.5 w-3.5" /> <span className="hidden md:inline">{t}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" aria-label="Color">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} disabled={herr === "resaltar"} className={cn("h-6 w-6 rounded-full border-2 transition-transform disabled:opacity-30", color === c ? "scale-110 border-[#0E1E2A]" : "border-white")} style={{ background: c }} />
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={deshacer} disabled={!trazosPag.length} title="Deshacer" className="rounded-lg p-2 text-[#4E5964] hover:bg-[#F3F4F6] disabled:opacity-30"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={limpiarPagina} disabled={!trazosPag.length} title="Borrar marcas de esta página" className="rounded-lg p-2 text-[#4E5964] hover:bg-[#F3F4F6] disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Alejar" className="rounded-lg p-2 text-[#4E5964] hover:bg-[#F3F4F6]"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-10 text-center text-[11px] tabular-nums text-[#7A8590]">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} title="Acercar" className="rounded-lg p-2 text-[#4E5964] hover:bg-[#F3F4F6]"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" onClick={onCerrar} title="Cerrar sin guardar" className="ml-1 rounded-lg p-2 text-[#4E5964] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Pieza */}
        <div className="flex min-h-0 flex-col">
          <div ref={area} className="relative min-h-0 flex-1 overflow-auto p-6">
            {error ? (
              <p className="mx-auto mt-20 max-w-sm text-center text-sm text-[#4E5964]">{error}</p>
            ) : !pag ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[#7A8590]">
                <Loader2 className="h-7 w-7 animate-spin text-[#E37439]" /> Preparando la pieza…
              </div>
            ) : (
              <div className="mx-auto w-fit">
                <canvas
                  ref={lienzo}
                  onPointerDown={bajar}
                  onPointerMove={mover}
                  onPointerUp={soltar}
                  onPointerCancel={soltar}
                  style={{ width: pag.w * escala, height: pag.h * escala }}
                  className={cn("block touch-none rounded-md bg-white shadow-xl", herr === "nota" ? "cursor-copy" : "cursor-crosshair")}
                />
              </div>
            )}
          </div>
          {paginas && paginas.length > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-[#E3E6EA] bg-white px-3 py-2">
              <button type="button" onClick={() => setActualPag((p) => Math.max(0, p - 1))} disabled={actualPag === 0} className="rounded-lg p-1.5 text-[#4E5964] hover:bg-[#F3F4F6] disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
              <div className="flex max-w-[70vw] gap-1 overflow-x-auto">
                {paginas.map((_, i) => (
                  <button key={i} type="button" onClick={() => setActualPag(i)} aria-current={i === actualPag ? "page" : undefined} className={cn("relative h-7 min-w-7 rounded-md px-2 text-xs font-semibold tabular-nums", i === actualPag ? "bg-[#0E1E2A] text-white" : "bg-[#F3F4F6] text-[#4E5964] hover:bg-[#E9EBEE]")}>
                    {i + 1}
                    {(trazos[i]?.length ?? 0) > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#E5342B]" aria-label="con marcas" />}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setActualPag((p) => Math.min(paginas.length - 1, p + 1))} disabled={actualPag === paginas.length - 1} className="rounded-lg p-1.5 text-[#4E5964] hover:bg-[#F3F4F6] disabled:opacity-30" aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {/* Lista de correcciones */}
        <aside className="flex min-h-0 flex-col border-t border-[#E3E6EA] bg-white lg:border-l lg:border-t-0" aria-label="Correcciones">
          <div className="border-b border-[#EEF0F2] px-4 py-3">
            <p className="text-sm font-bold text-[#0E1E2A]">Correcciones {notas.length ? `(${notas.length})` : ""}</p>
            <p className="text-[11px] text-[#7A8590]">Con «Nota» toca el punto exacto y escribe qué cambiar. Cada nota lleva su número sobre la pieza.</p>
          </div>
          <ol className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {notas.length === 0 && (
              <li className="rounded-xl border border-dashed border-[#DBDBDB] p-4 text-center text-xs text-[#7A8590]">
                Aún no hay notas. También puedes resaltar, subrayar o encerrar sin escribir.
              </li>
            )}
            {[...notas].sort((a, b) => a.n - b.n).map((x) => (
              <li key={x.n} className="flex gap-2">
                <button type="button" onClick={() => setActualPag(x.pagina - 1)} className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E5342B] text-[11px] font-bold text-white" title={`Ir a la página ${x.pagina}`}>
                  {x.n}
                </button>
                <div className="min-w-0 flex-1">
                  <textarea
                    autoFocus={enfocar === x.n}
                    value={x.texto}
                    onChange={(e) => setNotas((ns) => ns.map((y) => (y.n === x.n ? { ...y, texto: e.target.value } : y)))}
                    placeholder="Qué hay que corregir aquí"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-[#E3E6EA] px-2.5 py-1.5 text-xs outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#9AA4B2]">
                    <span>{paginas && paginas.length > 1 ? `Página ${x.pagina}` : ""}</span>
                    <button type="button" onClick={() => quitarNota(x.n)} className="hover:text-[#B23A3A]">Quitar</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="space-y-2 border-t border-[#EEF0F2] px-4 py-3">
            <p className="text-[11px] text-[#7A8590]">
              {totalMarcas === 0 ? "Marca la pieza para continuar." : notasSinTexto ? `${notasSinTexto} ${notasSinTexto === 1 ? "nota sin texto" : "notas sin texto"}; no se incluirán en la lista.` : "Las páginas marcadas se adjuntan como imagen."}
            </p>
            <button type="button" onClick={() => terminar("rechazar")} disabled={!totalMarcas || !!exportando} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#D64545] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#B23A3A] disabled:opacity-40">
              {exportando === "rechazar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rechazar con estas correcciones
            </button>
            <button type="button" onClick={() => terminar("aprobar")} disabled={!totalMarcas || !!exportando} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2E9E5B]/40 bg-white px-3 py-2 text-sm font-semibold text-[#1E7D47] hover:bg-[#F2FBF6] disabled:opacity-40">
              {exportando === "aprobar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprobar con comentarios
            </button>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
