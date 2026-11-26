// Nuevo material (menú de Paco) como cuestionario: una pregunta por pantalla,
// con botones grandes y lo más común ya elegido. Al final muestra el resumen
// y crea el material con Paco como responsable (y su primera pieza, si la sube).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X, Loader2, Plus, Paperclip, FileText, ArrowLeft, ArrowRight, Check, Building2, Package, LayoutTemplate, PenLine, CalendarDays, Layers, Upload, ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOperacion } from "@/data/operacion";
import { StorageService } from "@/lib/storage";
import { formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

const FORMATOS = ["Visual de ayuda", "Folleto para paciente", "Infografía", "Banner digital", "Email médico", "Post para redes", "Video corto", "Presentación para congreso", "Tríptico", "Stand o roll up"];
const ETAPAS = [
  { id: "desarrollo_grafico", nombre: "Diseño", ayuda: "El contenido ya está aprobado; empiezo con el arte." },
  { id: "desarrollo_medico", nombre: "Contenido médico", ayuda: "Primero el cliente valida el contenido." },
];
const PLAZOS = [
  { dias: 5, nombre: "En 1 semana" },
  { dias: 10, nombre: "En 2 semanas" },
  { dias: 20, nombre: "En 1 mes" },
];

const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const enDias = (n: number) => {
  // Días hábiles: se saltan sábados y domingos.
  const d = new Date();
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) k++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Paso = "cliente" | "producto" | "formato" | "nombre" | "fecha" | "etapa" | "pieza" | "resumen";
const PASOS: { id: Paso; pregunta: string; Ico: typeof Building2 }[] = [
  { id: "cliente", pregunta: "¿Para qué cliente es?", Ico: Building2 },
  { id: "producto", pregunta: "¿De qué producto?", Ico: Package },
  { id: "formato", pregunta: "¿Qué tipo de material es?", Ico: LayoutTemplate },
  { id: "nombre", pregunta: "¿Cómo lo llamamos?", Ico: PenLine },
  { id: "fecha", pregunta: "¿Para cuándo lo entregas?", Ico: CalendarDays },
  { id: "etapa", pregunta: "¿En qué etapa empieza?", Ico: Layers },
  { id: "pieza", pregunta: "¿Ya tienes la pieza?", Ico: Upload },
  { id: "resumen", pregunta: "Revisa y crea", Ico: ClipboardCheck },
];

const opcion = (on: boolean) =>
  cn(
    "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]/40",
    on ? "border-[#E37439] bg-[#E37439]/10 text-foreground" : "border-border bg-card text-foreground hover:border-[#E37439]/50 hover:bg-muted/40",
  );

export function NuevoMaterial({ clienteInicial, onCerrar }: { clienteInicial?: string | null; onCerrar: () => void }) {
  const { user } = useAuth();
  const data = useOperacion();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [producto, setProducto] = useState("");
  const [indicacion, setIndicacion] = useState("");
  const [formato, setFormato] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tituloTocado, setTituloTocado] = useState(false);
  const [comprometida, setComprometida] = useState("");
  const [requerida, setRequerida] = useState("");
  const [etapa, setEtapa] = useState(ETAPAS[0].id);
  const [prioridad, setPrioridad] = useState("media");
  const [visible, setVisible] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [i, setI] = useState(clienteInicial ? 1 : 0);

  const clientes = useMemo(() => [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "es")), [data.clients]);
  const productos = useMemo(() => data.products.filter((p) => p.client_id === cliente), [data.products, cliente]);
  const indicaciones = useMemo(() => data.indications.filter((x) => producto && x.producto_id === producto), [data.indications, producto]);
  const nombreCliente = clientes.find((c) => c.id === cliente)?.name ?? "";
  const nombreProducto = productos.find((p) => p.id === producto)?.name ?? "";

  // Nombre sugerido: «Formato · Producto · »; Paco solo completa el tema.
  useEffect(() => {
    if (!tituloTocado && formato && nombreProducto) setTitulo(`${formato} · ${nombreProducto} · `);
  }, [formato, nombreProducto, tituloTocado]);

  const paso = PASOS[i].id;
  const valido: Record<Paso, boolean> = {
    cliente: !!cliente,
    producto: !!producto,
    formato: !!formato,
    nombre: titulo.replace(/[·\s]+$/, "").trim().length > 3,
    fecha: !!comprometida,
    etapa: !!etapa,
    pieza: true,
    resumen: true,
  };
  const siguiente = () => valido[paso] && setI((n) => Math.min(PASOS.length - 1, n + 1));
  const atras = () => setI((n) => Math.max(0, n - 1));
  // Elegir una opción avanza solo.
  const elegir = (f: () => void) => {
    f();
    setTimeout(() => setI((n) => Math.min(PASOS.length - 1, n + 1)), 160);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && paso !== "resumen") {
        e.preventDefault();
        siguiente();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const crear = async () => {
    if (!user) return;
    setGuardando(true);
    try {
      const prod: any = data.products.find((p) => p.id === producto);
      const fila = {
        titulo: titulo.replace(/[·\s]+$/, "").trim(),
        cliente_id: cliente,
        producto_id: producto,
        indicacion_id: indicacion || null,
        unidad_id: prod?.unidad_id ?? null,
        status: etapa,
        prioridad,
        formato_material: formato,
        responsable_principal_id: user.id,
        fecha_solicitud: hoy(),
        fecha_comprometida: comprometida,
        fecha_comprometida_original: comprometida,
        fecha_requerida_cliente: requerida || null,
        visible_para_cliente: visible,
      };
      const { data: nuevo, error } = await (supabase as any).from("materials").insert(fila).select().single();
      if (error || !nuevo) throw new Error(error?.message ?? "No se pudo crear el material.");
      if (archivo) await StorageService.upload({ file: archivo, materialId: nuevo.id, stage: etapa, uploadedBy: user.id, uploadedByName: user.name });
      toast.success("Material creado.");
      data.reload?.();
      onCerrar();
      navigate(`/materials/${nuevo.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el material.");
    }
    setGuardando(false);
  };

  const { pregunta, Ico } = PASOS[i];
  const pct = Math.round((i / (PASOS.length - 1)) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label="Nuevo material" onClick={(e) => e.stopPropagation()} className="ssam-ficha flex h-[min(640px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-foreground shadow-2xl sm:rounded-3xl">
        {/* Progreso */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Nuevo material · paso {i + 1} de {PASOS.length}</span>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#E37439] transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
          </div>
        </div>

        {/* Pregunta */}
        <div key={paso} className="ssam-subir flex min-h-0 flex-1 flex-col px-6 pb-2 pt-6">
          <p className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E37439]/12 text-[#E37439]"><Ico className="h-5 w-5" /></span>
            {pregunta}
          </p>

          <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
            {paso === "cliente" &&
              clientes.map((c) => (
                <button key={c.id} type="button" onClick={() => elegir(() => { if (c.id !== cliente) { setProducto(""); setIndicacion(""); } setCliente(c.id); })} className={opcion(cliente === c.id)}>
                  <Building2 className="h-5 w-5 text-muted-foreground" /> {c.name}
                  {cliente === c.id && <Check className="ml-auto h-5 w-5 text-[#E37439]" />}
                </button>
              ))}

            {paso === "producto" && (
              <>
                {productos.length === 0 && <p className="text-sm text-muted-foreground">Este cliente no tiene productos registrados.</p>}
                {productos.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setProducto(p.id); setIndicacion(""); if (!data.indications.some((x) => x.producto_id === p.id)) elegir(() => {}); }} className={opcion(producto === p.id)}>
                    <Package className="h-5 w-5 text-muted-foreground" /> {p.name}
                    {producto === p.id && <Check className="ml-auto h-5 w-5 text-[#E37439]" />}
                  </button>
                ))}
                {indicaciones.length > 0 && (
                  <div className="pt-3">
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">¿Para qué indicación? (opcional)</p>
                    <div className="flex flex-wrap gap-2">
                      {indicaciones.map((x) => (
                        <button key={x.id} type="button" onClick={() => setIndicacion(indicacion === x.id ? "" : x.id)} className={cn("rounded-full border-2 px-3 py-1.5 text-sm font-semibold", indicacion === x.id ? "border-[#E37439] bg-[#E37439]/10" : "border-border hover:border-[#E37439]/50")}>
                          {x.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {paso === "formato" && (
              <div className="grid grid-cols-2 gap-2">
                {FORMATOS.map((f) => (
                  <button key={f} type="button" onClick={() => elegir(() => setFormato(f))} className={cn(opcion(formato === f), "py-3 text-sm")}>
                    {f}
                  </button>
                ))}
              </div>
            )}

            {paso === "nombre" && (
              <div>
                <input
                  autoFocus
                  value={titulo}
                  onChange={(e) => { setTitulo(e.target.value); setTituloTocado(true); }}
                  onFocus={(e) => { const v = e.currentTarget; requestAnimationFrame(() => v.setSelectionRange(v.value.length, v.value.length)); }}
                  className="h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-lg outline-none focus:border-[#E37439]"
                />
                <p className="mt-2 text-sm text-muted-foreground">Ya va el formato y el producto; solo agrega el tema. Ej.: «lanzamiento», «posología».</p>
              </div>
            )}

            {paso === "fecha" && (
              <div className="space-y-2">
                {PLAZOS.map((p) => {
                  const f = enDias(p.dias);
                  return (
                    <button key={p.dias} type="button" onClick={() => elegir(() => setComprometida(f))} className={opcion(comprometida === f)}>
                      <CalendarDays className="h-5 w-5 text-muted-foreground" /> {p.nombre}
                      <span className="ml-auto text-sm font-normal text-muted-foreground">{formatDate(f)}</span>
                    </button>
                  );
                })}
                <label className={cn(opcion(!!comprometida && !PLAZOS.some((p) => enDias(p.dias) === comprometida)), "cursor-pointer")}>
                  <CalendarDays className="h-5 w-5 text-muted-foreground" /> Otra fecha
                  <input type="date" min={hoy()} value={comprometida} onChange={(e) => setComprometida(e.target.value)} className="ml-auto rounded-lg border border-border bg-background px-2 py-1 text-sm font-normal" />
                </label>
                <label className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                  ¿El cliente pidió una fecha? (opcional)
                  <input type="date" value={requerida} onChange={(e) => setRequerida(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" />
                </label>
              </div>
            )}

            {paso === "etapa" &&
              ETAPAS.map((e) => (
                <button key={e.id} type="button" onClick={() => elegir(() => setEtapa(e.id))} className={cn(opcion(etapa === e.id), "flex-col items-start gap-0.5")}>
                  <span>{e.nombre}</span>
                  <span className="text-sm font-normal text-muted-foreground">{e.ayuda}</span>
                </button>
              ))}

            {paso === "pieza" && (
              <div className="space-y-2">
                <label className={cn(opcion(!!archivo), "cursor-pointer")}>
                  {archivo ? <FileText className="h-5 w-5 text-[#E37439]" /> : <Paperclip className="h-5 w-5 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{archivo ? archivo.name : "Sí, subir el PDF o la imagen"}</span>
                  {archivo && <Check className="h-5 w-5 text-[#E37439]" />}
                  <input type="file" accept=".pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; setArchivo(f); if (f) setTimeout(() => setI(PASOS.length - 1), 200); }} />
                </label>
                <button type="button" onClick={() => elegir(() => setArchivo(null))} className={opcion(false)}>
                  Todavía no, la subo después
                </button>
              </div>
            )}

            {paso === "resumen" && (
              <div className="space-y-3">
                <dl className="divide-y divide-border rounded-2xl border border-border">
                  {[
                    ["Cliente", nombreCliente, 0],
                    ["Producto", `${nombreProducto}${indicacion ? ` · ${indicaciones.find((x) => x.id === indicacion)?.name ?? ""}` : ""}`, 1],
                    ["Tipo", formato, 2],
                    ["Nombre", titulo.replace(/[·\s]+$/, ""), 3],
                    ["Entrega", formatDate(comprometida) + (requerida ? ` · el cliente la pidió para el ${formatDate(requerida)}` : ""), 4],
                    ["Etapa", ETAPAS.find((e) => e.id === etapa)?.nombre ?? "", 5],
                    ["Pieza", archivo ? archivo.name : "La subo después", 6],
                  ].map(([k, v, n]) => (
                    <div key={k as string} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className="min-w-0 flex-1 truncate font-semibold">{v}</dd>
                      <button type="button" onClick={() => setI(n as number)} className="text-xs font-semibold text-[#E37439] hover:underline">Cambiar</button>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Prioridad:</span>
                  {["alta", "media", "baja"].map((p) => (
                    <button key={p} type="button" onClick={() => setPrioridad(p)} aria-pressed={prioridad === p} className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", prioridad === p ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted")}>
                      {p}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[#E37439]" />
                  El cliente lo ve en su portal
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Navegación */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <button type="button" onClick={i === 0 ? onCerrar : atras} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
            {i === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4" /> Atrás</>)}
          </button>
          {paso === "resumen" ? (
            <button type="button" onClick={crear} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-xl bg-[#E37439] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C45B24] disabled:opacity-40">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear material
            </button>
          ) : (
            <button type="button" onClick={siguiente} disabled={!valido[paso]} className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-30">
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
