// Marcar sobre una imagen: el cliente encierra en círculo o dibuja encima de la
// pieza (como hoy lo hace a mano en un correo) y se guarda como imagen adjunta.
import { useEffect, useRef, useState } from "react";
import { Circle, PenLine, Undo2, Check, X, MoveUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Trazo =
  | { tipo: "pluma"; color: string; puntos: [number, number][] }
  | { tipo: "circulo" | "flecha"; color: string; a: [number, number]; b: [number, number] };

const COLORES = ["#E5342B", "#E37439", "#1F6FEB"];

export function MarcadorImagen({
  src,
  nombre,
  onListo,
  onCerrar,
}: {
  src: string;
  nombre: string;
  onListo: (archivo: File) => void;
  onCerrar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const actual = useRef<Trazo | null>(null);
  const [herr, setHerr] = useState<"circulo" | "pluma" | "flecha">("circulo");
  const [color, setColor] = useState(COLORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      img.current = i;
      const c = lienzo.current!;
      c.width = i.naturalWidth;
      c.height = i.naturalHeight;
      setListo(true);
    };
    i.onerror = () => setError("No se pudo abrir la imagen para marcarla. Descárgala, márcala y adjúntala.");
    i.src = src;
  }, [src]);

  // Redibuja imagen + trazos
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img.current) return;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img.current, 0, 0);
    const grosor = Math.max(3, c.width / 220);
    for (const t of [...trazos, ...(actual.current ? [actual.current] : [])]) {
      g.strokeStyle = t.color;
      g.lineWidth = grosor;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      if (t.tipo === "pluma") {
        t.puntos.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      } else if (t.tipo === "circulo") {
        const [x1, y1] = t.a, [x2, y2] = t.b;
        g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2);
      } else {
        const [x1, y1] = t.a, [x2, y2] = t.b;
        const ang = Math.atan2(y2 - y1, x2 - x1), p = grosor * 5;
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.moveTo(x2, y2);
        g.lineTo(x2 - p * Math.cos(ang - 0.45), y2 - p * Math.sin(ang - 0.45));
        g.moveTo(x2, y2);
        g.lineTo(x2 - p * Math.cos(ang + 0.45), y2 - p * Math.sin(ang + 0.45));
      }
      g.stroke();
    }
  });

  const punto = (e: React.PointerEvent): [number, number] => {
    const c = lienzo.current!, r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  };
  const [, forzar] = useState(0);
  const bajar = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = punto(e);
    actual.current = herr === "pluma" ? { tipo: "pluma", color, puntos: [p] } : { tipo: herr, color, a: p, b: p };
    forzar((n) => n + 1);
  };
  const mover = (e: React.PointerEvent) => {
    const t = actual.current;
    if (!t) return;
    const p = punto(e);
    if (t.tipo === "pluma") t.puntos.push(p);
    else t.b = p;
    forzar((n) => n + 1);
  };
  const subir = () => {
    if (actual.current) setTrazos((x) => [...x, actual.current!]);
    actual.current = null;
  };

  const guardar = () => {
    try {
      lienzo.current!.toBlob((b) => {
        if (!b) return setError("No se pudo guardar la marca.");
        onListo(new File([b], `Marcas_${nombre.replace(/\.[^.]+$/, "")}.png`, { type: "image/png" }));
      }, "image/png");
    } catch {
      setError("Esta imagen no se puede exportar desde el navegador. Descárgala, márcala y adjúntala.");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0E1E2A]/95 text-white ssam-ficha" role="dialog" aria-label="Marcar cambios sobre la imagen">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <p className="mr-auto text-sm font-semibold">Marca sobre la pieza lo que hay que cambiar</p>
        <div className="flex rounded-lg bg-white/10 p-1">
          {(
            [
              ["circulo", "Encerrar", Circle],
              ["flecha", "Flecha", MoveUpRight],
              ["pluma", "Dibujar", PenLine],
            ] as const
          ).map(([h, t, Ico]) => (
            <button key={h} type="button" onClick={() => setHerr(h)} aria-pressed={herr === h} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold", herr === h ? "bg-white text-[#0E1E2A]" : "text-white/80 hover:bg-white/10")}>
              <Ico className="h-3.5 w-3.5" /> {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-white" : "border-transparent")} style={{ background: c }} />
          ))}
        </div>
        <button type="button" onClick={() => setTrazos((x) => x.slice(0, -1))} disabled={!trazos.length} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40">
          <Undo2 className="h-3.5 w-3.5" /> Deshacer
        </button>
        <button type="button" onClick={onCerrar} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={!listo || !trazos.length} className="inline-flex items-center gap-1 rounded-lg bg-[#E37439] px-3 py-1.5 text-xs font-semibold hover:bg-[#C45B24] disabled:opacity-40">
          <Check className="h-3.5 w-3.5" /> Adjuntar marcas
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {error ? (
          <p className="max-w-sm text-center text-sm text-white/80">{error}</p>
        ) : (
          <canvas
            ref={lienzo}
            onPointerDown={bajar}
            onPointerMove={mover}
            onPointerUp={subir}
            onPointerCancel={subir}
            className="max-h-full max-w-full touch-none cursor-crosshair rounded-lg bg-white shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
