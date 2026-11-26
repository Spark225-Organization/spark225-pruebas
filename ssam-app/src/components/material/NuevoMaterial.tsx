// Nuevo material (menú de Paco): da de alta el material con su cliente,
// producto, formato y fechas, y sube la primera pieza si ya la tiene.
// Paco queda como responsable. Después, en el detalle, lo avanza de etapa
// (con su checklist) hasta enviarlo al cliente.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X, Loader2, Plus, Paperclip, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOperacion } from "@/data/operacion";
import { StorageService } from "@/lib/storage";
import { cn } from "@/lib/utils";

const FORMATOS = ["Visual de ayuda", "Folleto para paciente", "Infografía", "Banner digital", "Email médico", "Post para redes", "Video corto", "Presentación para congreso", "Tríptico", "Stand o roll up"];
const ETAPAS = [
  { id: "desarrollo_grafico", nombre: "En diseño", ayuda: "El contenido ya está aprobado; empiezas con el arte." },
  { id: "desarrollo_medico", nombre: "En contenido médico", ayuda: "Primero se valida el contenido con el cliente." },
];

const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const campo = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20";
const etiqueta = "mb-1 block text-xs font-semibold text-muted-foreground";

export function NuevoMaterial({ clienteInicial, onCerrar }: { clienteInicial?: string | null; onCerrar: () => void }) {
  const { user } = useAuth();
  const data = useOperacion();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [producto, setProducto] = useState("");
  const [indicacion, setIndicacion] = useState("");
  const [titulo, setTitulo] = useState("");
  const [formato, setFormato] = useState(FORMATOS[0]);
  const [etapa, setEtapa] = useState(ETAPAS[0].id);
  const [prioridad, setPrioridad] = useState("media");
  const [comprometida, setComprometida] = useState(enDias(10));
  const [requerida, setRequerida] = useState("");
  const [visible, setVisible] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  const clientes = useMemo(() => [...data.clients].sort((a, b) => a.name.localeCompare(b.name, "es")), [data.clients]);
  const productos = useMemo(() => data.products.filter((p) => !cliente || p.client_id === cliente), [data.products, cliente]);
  const indicaciones = useMemo(() => {
    const deProducto = data.indications.filter((i) => producto && i.producto_id === producto);
    return deProducto.length ? deProducto : data.indications;
  }, [data.indications, producto]);

  useEffect(() => {
    if (productos.length && !productos.some((p) => p.id === producto)) setProducto(productos.length === 1 ? productos[0].id : "");
  }, [productos, producto]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  const listo = !!cliente && !!producto && titulo.trim().length > 2 && !!comprometida;

  const crear = async () => {
    if (!listo || !user) return;
    setGuardando(true);
    try {
      const prod: any = data.products.find((p) => p.id === producto);
      const fila = {
        titulo: titulo.trim(),
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
      if (archivo) {
        await StorageService.upload({ file: archivo, materialId: nuevo.id, stage: etapa, uploadedBy: user.id, uploadedByName: user.name });
      }
      toast.success("Material creado.");
      data.reload?.();
      onCerrar();
      navigate(`/materials/${nuevo.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el material.");
    }
    setGuardando(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0E1E2A]/45 sm:items-center sm:p-6" onClick={onCerrar}>
      <div role="dialog" aria-label="Nuevo material" onClick={(e) => e.stopPropagation()} className="ssam-ficha flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-foreground shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">Nuevo material</h3>
            <p className="text-xs text-muted-foreground">Quedas como responsable. Después lo avanzas hasta enviarlo al cliente.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={etiqueta}>Nombre del material *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Visual de ayuda · lanzamiento" className={campo} autoFocus />
          </label>
          <label>
            <span className={etiqueta}>Cliente *</span>
            <select value={cliente} onChange={(e) => { setCliente(e.target.value); setProducto(""); setIndicacion(""); }} className={campo}>
              <option value="">Elige el cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Producto *</span>
            <select value={producto} onChange={(e) => { setProducto(e.target.value); setIndicacion(""); }} disabled={!cliente} className={cn(campo, "disabled:opacity-50")}>
              <option value="">{cliente ? "Elige el producto" : "Primero el cliente"}</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Indicación</span>
            <select value={indicacion} onChange={(e) => setIndicacion(e.target.value)} className={campo}>
              <option value="">Sin indicación</option>
              {indicaciones.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Formato</span>
            <select value={formato} onChange={(e) => setFormato(e.target.value)} className={campo}>
              {FORMATOS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Fecha de entrega comprometida *</span>
            <input type="date" value={comprometida} min={hoy()} onChange={(e) => setComprometida(e.target.value)} className={campo} />
          </label>
          <label>
            <span className={etiqueta}>Fecha requerida por el cliente</span>
            <input type="date" value={requerida} onChange={(e) => setRequerida(e.target.value)} className={campo} />
          </label>

          <fieldset className="sm:col-span-2">
            <legend className={etiqueta}>Etapa inicial</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ETAPAS.map((e) => (
                <button key={e.id} type="button" onClick={() => setEtapa(e.id)} aria-pressed={etapa === e.id} className={cn("rounded-xl border px-3 py-2 text-left transition-colors", etapa === e.id ? "border-[#E37439] bg-[#E37439]/10" : "border-border hover:border-[#E37439]/50")}>
                  <span className="block text-sm font-semibold">{e.nombre}</span>
                  <span className="block text-[11px] text-muted-foreground">{e.ayuda}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={etiqueta}>Prioridad</legend>
            <div className="flex gap-1.5">
              {["alta", "media", "baja"].map((p) => (
                <button key={p} type="button" onClick={() => setPrioridad(p)} aria-pressed={prioridad === p} className={cn("flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize", prioridad === p ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted")}>
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 self-end rounded-xl border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[#E37439]" />
            Visible para el cliente en su portal
          </label>

          <div className="sm:col-span-2">
            <span className={etiqueta}>Primera pieza (opcional)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 hover:border-[#E37439]">
              {archivo ? <FileText className="h-5 w-5 text-[#E37439]" /> : <Paperclip className="h-5 w-5 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate text-sm">{archivo ? archivo.name : "Sube el PDF o la imagen de la pieza"}</span>
              {archivo && <button type="button" onClick={(e) => { e.preventDefault(); setArchivo(null); }} className="text-xs font-semibold text-muted-foreground hover:text-[#D64545]">Quitar</button>}
              <input type="file" accept=".pdf,image/*" hidden onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">{listo ? "Listo para crear." : "Faltan los campos con *."}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={crear} disabled={!listo || guardando} className="inline-flex items-center gap-1.5 rounded-xl bg-[#E37439] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C45B24] disabled:opacity-40">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear material
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
