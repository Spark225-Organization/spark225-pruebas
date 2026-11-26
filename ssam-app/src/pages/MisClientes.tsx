// Inicio de Paco (diseño y cuenta directa con el cliente).
// Sin tableros internos: sus clientes como carpetas y, dentro de cada una,
// lo que le toca hoy (correcciones que pidió el cliente, lo que está listo
// para enviar y lo vencido) y todos los materiales del cliente. Al abrir un
// material va al detalle, donde sube versiones, cambia el estatus (con su
// checklist) y conversa con el cliente.
// Un material es de Paco si es su responsable; el administrador ve todos.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FolderOpen,
  ChevronRight,
  XCircle,
  Send,
  AlarmClock,
  MessageSquare,
  Search,
  ArrowLeft,
  Repeat,
  EyeOff,
  Plus,
  Upload,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { NuevoMaterial } from "@/components/material/NuevoMaterial";
import { SubirVersion } from "@/components/material/SubirVersion";
import { EnviarAlCliente } from "@/components/material/EnviarAlCliente";
import { supabase } from "@/lib/supabase";
import { useOperacion } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import { DEMO } from "@/lib/demo/demoState";
import type { Material } from "@/lib/api-types";
import { statusLabel, formatDate, isFechaVencida, type MaterialStatus } from "@/lib/statusModel";
import { MOMENTOS, momento, nombreMotivo, type Momento } from "@/lib/portalModelo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Decision = { material_id: string; decision: string; motivo: string | null; comentario: string | null; created_at: string; profiles?: { nombre?: string; rol?: string } | null };
type Aviso = { id: string; material_id: string; tipo: "rechazo" | "aprobacion" | "comentario"; autor: string; texto: string; created_at: string };
const CLAVE_VISTOS = "ssam-avisos-vistos-";
type Pendiente = { m: Material; tipo: "corregir" | "enviar" | "vencido"; detalle: string };

const EN_DESARROLLO = ["desarrollo_medico", "desarrollo_grafico"];
// Etapas internas previas a mandar al cliente: listo para enviar.
const LISTO_PARA_ENVIAR: Record<string, string> = {
  revision_direccion: "Listo para enviar: contenido médico",
  validacion_medica_final: "Listo para enviar: diseño",
};
const ES_RECHAZO = new Set(["cambios", "changes_requested", "rejected"]);

const TIPO = {
  corregir: { nombre: "Correcciones del cliente", Ico: XCircle, color: "#D64545", fondo: "bg-[#D64545]/[0.07]", borde: "border-[#D64545]/25" },
  enviar: { nombre: "Listos para enviar", Ico: Send, color: "#E37439", fondo: "bg-[#E37439]/[0.07]", borde: "border-[#E37439]/25" },
  vencido: { nombre: "Fecha comprometida vencida", Ico: AlarmClock, color: "#C08A0E", fondo: "bg-[#F5C245]/[0.10]", borde: "border-[#D99A12]/30" },
} as const;

export default function MisClientes() {
  const data = useOperacion();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const clienteSel = params.get("cliente");
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [buscar, setBuscar] = useState("");
  const [momentoSel, setMomentoSel] = useState<Momento | "">("");
  const [nuevo, setNuevo] = useState(false);
  const [subirPara, setSubirPara] = useState<Material | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [vistos, setVistos] = useState<string>(() => {
    try {
      return localStorage.getItem(CLAVE_VISTOS + (user?.id ?? "")) ?? "";
    } catch {
      return "";
    }
  });

  // «Nuevo material» desde el menú lateral (?nuevo=1).
  useEffect(() => {
    if (params.get("nuevo") === "1") {
      setNuevo(true);
      const p = new URLSearchParams(params);
      p.delete("nuevo");
      setParams(p, { replace: true });
    }
  }, [params, setParams]);

  // Última decisión del cliente por material (para saber qué hay que corregir).
  useEffect(() => {
    let vivo = true;
    (async () => {
      let { data: filas, error } = await (supabase as any)
        .from("approvals")
        .select("material_id, decision, motivo, comentario, created_at, profiles!approvals_approver_id_fkey(nombre, rol)")
        .order("created_at", { ascending: false });
      if (error) {
        ({ data: filas } = await (supabase as any)
          .from("approvals")
          .select("material_id, decision, motivo, comentario, created_at")
          .order("created_at", { ascending: false }));
      }
      const { data: coms } = await (supabase as any)
        .from("comments")
        .select("id, material_id, texto, visibilidad, created_at, profiles!comments_autor_id_fkey(nombre, rol)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!vivo) return;
      const r: Record<string, Decision> = {};
      for (const f of (filas ?? []) as Decision[]) if (!r[f.material_id]) r[f.material_id] = f;
      setDecisiones(r);
      // Avisos: lo que hizo el cliente (decisiones y comentarios), lo más nuevo primero.
      const esCliente = (p?: { rol?: string } | null) => !!p && /^(cliente|client)$/i.test(p.rol ?? "");
      const av: Aviso[] = [];
      for (const f of (filas ?? []) as Decision[]) {
        if (!esCliente(f.profiles)) continue;
        const rech = ES_RECHAZO.has(String(f.decision));
        av.push({ id: `a-${f.material_id}-${f.created_at}`, material_id: f.material_id, tipo: rech ? "rechazo" : "aprobacion", autor: f.profiles?.nombre ?? "El cliente", texto: rech ? nombreMotivo(f.motivo) : f.comentario ? "con comentarios" : "", created_at: f.created_at });
      }
      for (const c of (coms ?? []) as any[]) {
        if (!esCliente(c.profiles) || c.visibilidad === "interno") continue;
        if (/^(Rechazado|Aprobado con comentarios|Cambios solicitados)/.test(c.texto ?? "")) continue; // ya va en la decisión
        av.push({ id: `c-${c.id}`, material_id: c.material_id, tipo: "comentario", autor: c.profiles?.nombre ?? "El cliente", texto: String(c.texto ?? "").slice(0, 140), created_at: c.created_at });
      }
      av.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setAvisos(av);
    })();
    return () => {
      vivo = false;
    };
  }, [data.materials]);

  const esAdmin = user?.role === "admin";
  const mios = useMemo(
    () =>
      data.materials.filter(
        (m) => !data.demoIds.has(m.id) && m.status !== "archivado" && (esAdmin || m.responsible_id === user?.id),
      ),
    [data.materials, data.demoIds, esAdmin, user?.id],
  );

  const pendientes = useMemo(() => {
    const out: Pendiente[] = [];
    for (const m of mios) {
      const d = decisiones[m.id];
      if (EN_DESARROLLO.includes(m.status) && d && ES_RECHAZO.has(String(d.decision))) {
        out.push({ m, tipo: "corregir", detalle: `${nombreMotivo(d.motivo)}${d.comentario ? ` · ${d.comentario.split("\n").filter(Boolean).slice(-1)[0]}` : ""}` });
      } else if (LISTO_PARA_ENVIAR[m.status]) {
        out.push({ m, tipo: "enviar", detalle: LISTO_PARA_ENVIAR[m.status] });
      }
      if (isFechaVencida(m.fecha_comprometida, m.status) && momento(m) !== "entregado") {
        out.push({ m, tipo: "vencido", detalle: `Comprometida para el ${formatDate(m.fecha_comprometida)}` });
      }
    }
    return out;
  }, [mios, decisiones]);

  const misIds = useMemo(() => new Set(mios.map((m) => m.id)), [mios]);
  const misAvisos = useMemo(() => avisos.filter((a) => misIds.has(a.material_id)).slice(0, 30), [avisos, misIds]);
  const nuevos = misAvisos.filter((a) => !vistos || a.created_at > vistos);
  const avisado = useMemo(() => ({ hecho: false }), []);
  useEffect(() => {
    if (!avisado.hecho && nuevos.length) {
      avisado.hecho = true;
      toast(`Tienes ${nuevos.length} ${nuevos.length === 1 ? "aviso nuevo" : "avisos nuevos"} de tus clientes.`, { icon: "🔔" });
    }
  }, [nuevos.length, avisado]);
  const marcarVistos = () => {
    const ahora = new Date().toISOString();
    setVistos(ahora);
    try {
      localStorage.setItem(CLAVE_VISTOS + (user?.id ?? ""), ahora);
    } catch {
      /* nada */
    }
  };

  const carpetas = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; materiales: Material[]; productos: Set<string> }>();
    for (const m of mios) {
      const id = m.client_id ?? "sin-cliente";
      if (!map.has(id)) map.set(id, { id, nombre: m.client_name ?? "Sin cliente", materiales: [], productos: new Set() });
      const c = map.get(id)!;
      c.materiales.push(m);
      if (m.product_name) c.productos.add(m.product_name);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [mios]);

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const nombre = (user?.name ?? "").split(/[\s(]/)[0];
  const carpeta = clienteSel ? carpetas.find((c) => c.id === clienteSel) ?? null : null;

  const nombreMaterial = (id: string) => mios.find((m) => m.id === id)?.name ?? "Material";
  const dialogos = (
    <>
      {nuevo && <NuevoMaterial clienteInicial={carpeta?.id ?? null} onCerrar={() => setNuevo(false)} />}
      {subirPara && <SubirVersion material={subirPara} onCerrar={() => setSubirPara(null)} onListo={data.reload} />}
    </>
  );

  // ── Dentro de la carpeta de un cliente ──
  if (carpeta) {
    const suyos = pendientes.filter((p) => p.m.client_id === carpeta.id);
    const q = buscar.trim().toLowerCase();
    const lista = carpeta.materiales
      .filter((m) => !momentoSel || momento(m) === momentoSel)
      .filter((m) => !q || `${m.name} ${m.product_name ?? ""} ${m.indication_name ?? ""} #${m.folio ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.fecha_comprometida ?? "9").localeCompare(b.fecha_comprometida ?? "9"));
    return (
      <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => { setParams({}); setMomentoSel(""); setBuscar(""); }} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-[#E37439]">
            <ArrowLeft className="h-3.5 w-3.5" /> Mis clientes
          </button>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
            <FolderOpen className="h-7 w-7 text-[#E37439]" /> {carpeta.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">
            {carpeta.materiales.length} materiales · {[...carpeta.productos].join(" · ") || "sin producto"}
          </p>
        </div>
        <button type="button" onClick={() => setNuevo(true)} className="inline-flex items-center gap-2 self-start rounded-2xl bg-[#E37439] px-6 py-3.5 text-base font-bold text-white shadow-[0_8px_22px_rgba(227,116,57,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#C45B24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]/40 sm:self-auto">
          <Plus className="h-5 w-5" /> Nuevo material
        </button>
        </div>

        {DEMO && <AvisoProbarCliente />}

        <Avisos avisos={misAvisos.filter((a) => carpeta.materiales.some((m) => m.id === a.material_id))} vistos={vistos} onVistos={marcarVistos} nombre={nombreMaterial} abrir={(id) => navigate(`/materials/${id}`)} />

        <Pendientes pendientes={suyos} abrir={(id) => navigate(`/materials/${id}`)} mostrarCliente={false} />

        <section aria-label="Etapas que ve el cliente" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {MOMENTOS.map((x, i) => {
            const n = carpeta.materiales.filter((m) => momento(m) === x.id).length;
            const on = momentoSel === x.id;
            return (
              <button key={x.id} type="button" aria-pressed={on} onClick={() => setMomentoSel(on ? "" : x.id)} className={cn("rounded-2xl border bg-card px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md", on ? "border-foreground" : "border-border")}>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="text-[10px] font-bold text-muted-foreground/70">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: x.color }} /> {x.nombre}
                </span>
                <span className="mt-1 block text-2xl font-bold tabular-nums text-foreground">{n}</span>
              </button>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">Materiales de {carpeta.nombre} <span className="font-normal text-muted-foreground">({lista.length})</span></h2>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar material o #folio" className="h-9 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none bg-background focus:border-[#E37439] focus:ring-2 focus:ring-[#E37439]/20" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="min-w-[280px] px-4 py-2.5">Material</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Etapa interna</th>
                  <th className="whitespace-nowrap px-4 py-2.5">El cliente lo ve como</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Fecha comprometida</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((m) => {
                  const mom = MOMENTOS.find((x) => x.id === momento(m))!;
                  const vencida = isFechaVencida(m.fecha_comprometida, m.status) && mom.id !== "entregado";
                  const msgs = data.comentariosCliente[m.id]?.count ?? 0;
                  const corregir = pendientes.some((p) => p.m.id === m.id && p.tipo === "corregir");
                  return (
                    <tr key={m.id} onClick={() => navigate(`/materials/${m.id}`)} className="group cursor-pointer hover:bg-muted/40">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground underline-offset-2 group-hover:text-[#E37439] group-hover:underline">
                          {m.folio != null && <span className="mr-1.5 font-mono text-[11px] font-normal text-muted-foreground/70">#{m.folio}</span>}
                          {m.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.product_name ?? "—"}{m.indication_name ? ` · ${m.indication_name}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {statusLabel(m.status as MaterialStatus)}
                        {corregir && <span className="ml-1.5 rounded-full bg-[#D64545] px-1.5 py-0.5 text-[10px] font-semibold text-white">corregir</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ background: mom.color }} /> {mom.nombre}
                        </span>
                      </td>
                      <td className={cn("whitespace-nowrap px-4 py-3 text-xs", vencida ? "font-semibold text-[#B23A3A] dark:text-[#F08A8A]" : "text-muted-foreground")}>
                        {formatDate(m.fecha_comprometida)}{vencida ? " · vencida" : ""}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="flex items-center gap-2">
                          {m.visible_para_cliente === false && <span title="No visible para el cliente" className="inline-flex items-center gap-1 text-muted-foreground/70"><EyeOff className="h-3.5 w-3.5" /> oculto</span>}
                          {msgs > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 font-semibold text-sky-800 dark:text-sky-300"><MessageSquare className="h-3 w-3" /> {msgs}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-2">
                          <EnviarAlCliente material={m} onDone={data.reload} compacto />
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSubirPara(m); }} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2 py-1 text-xs font-semibold text-foreground hover:border-[#E37439] hover:text-[#E37439]">
                            <Upload className="h-3.5 w-3.5" /> Subir versión
                          </button>
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-background group-hover:bg-[#E37439] group-hover:text-white">Ver detalle <ChevronRight className="h-3.5 w-3.5" /></span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Ningún material coincide.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {dialogos}
      </div>
    );
  }

  // ── Inicio: carpetas por cliente ──
  const totalActivos = mios.filter((m) => momento(m) !== "entregado").length;
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Hola{nombre ? `, ${nombre}` : ""}</h1>
        <p className="text-muted-foreground">
          {esAdmin ? "Todos los clientes" : `Tus ${carpetas.length} ${carpetas.length === 1 ? "cliente" : "clientes"}`} · {totalActivos} materiales activos
        </p>
      </div>
      <button type="button" onClick={() => setNuevo(true)} className="inline-flex items-center gap-2 self-start rounded-2xl bg-[#E37439] px-6 py-3.5 text-base font-bold text-white shadow-[0_8px_22px_rgba(227,116,57,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#C45B24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]/40 sm:self-auto">
        <Plus className="h-5 w-5" /> Nuevo material
      </button>
      </div>

      {DEMO && <AvisoProbarCliente />}

      <Avisos avisos={misAvisos} vistos={vistos} onVistos={marcarVistos} nombre={nombreMaterial} abrir={(id) => navigate(`/materials/${id}`)} />

      <Pendientes pendientes={pendientes} abrir={(id) => navigate(`/materials/${id}`)} mostrarCliente />

      <section aria-label="Carpetas de clientes">
        <h2 className="mb-3 text-sm font-bold text-foreground">Clientes</h2>
        {carpetas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Aún no tienes materiales asignados.
          </p>
        ) : (
          <div className="grid gap-x-4 gap-y-7 pt-2 sm:grid-cols-2 xl:grid-cols-3">
            {carpetas.map((c) => {
              const ps = pendientes.filter((p) => p.m.client_id === c.id);
              const n = (t: Pendiente["tipo"]) => ps.filter((p) => p.tipo === t).length;
              const msgs = c.materiales.reduce((s, m) => s + (data.comentariosCliente[m.id]?.count ?? 0), 0);
              return (
                <Link key={c.id} to={`/mis-clientes?cliente=${c.id}`} className="ssam-carpeta block border border-border bg-card p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E37439]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <FolderOpen className="h-5 w-5 text-[#E37439]" /> {c.nombre}
                    </p>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.materiales.length}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{[...c.productos].join(" · ") || "Sin producto"}</p>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
                    {MOMENTOS.map((x) => {
                      const k = c.materiales.filter((m) => momento(m) === x.id).length;
                      return k ? <span key={x.id} title={`${x.nombre}: ${k}`} style={{ width: `${(k / c.materiales.length) * 100}%`, background: x.color }} /> : null;
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    {n("corregir") > 0 && <span className="rounded-full bg-[#D64545] px-2 py-0.5 text-white">{n("corregir")} por corregir</span>}
                    {n("enviar") > 0 && <span className="rounded-full bg-[#E37439]/15 px-2 py-0.5 text-[#C45B24] dark:text-[#F0A070]">{n("enviar")} por enviar</span>}
                    {n("vencido") > 0 && <span className="rounded-full bg-[#F5C245]/20 px-2 py-0.5 text-[#9A6E00] dark:text-[#F5C245]">{n("vencido")} vencidos</span>}
                    {msgs > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-800 dark:text-sky-300"><MessageSquare className="h-3 w-3" /> {msgs}</span>}
                    {!ps.length && !msgs && <span className="text-[#2E9E5B] dark:text-[#5CCB8A]">Todo al día</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {dialogos}
    </div>
  );
}

function Avisos({ avisos, vistos, onVistos, nombre, abrir }: { avisos: Aviso[]; vistos: string; onVistos: () => void; nombre: (id: string) => string; abrir: (id: string) => void }) {
  if (!avisos.length) return null;
  const nuevos = avisos.filter((a) => !vistos || a.created_at > vistos);
  const lista = (nuevos.length ? nuevos : avisos).slice(0, 6);
  const ICONO = { rechazo: XCircle, aprobacion: CheckCircle2, comentario: MessageSquare } as const;
  const COLOR = { rechazo: "text-[#D64545]", aprobacion: "text-[#2E9E5B]", comentario: "text-sky-600 dark:text-sky-300" } as const;
  const VERBO = { rechazo: "rechazó", aprobacion: "aprobó", comentario: "comentó en" } as const;
  return (
    <section aria-label="Avisos de tus clientes" className={cn("rounded-2xl border p-4", nuevos.length ? "border-[#E37439]/40 bg-[#E37439]/[0.06]" : "border-border bg-card")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="relative">
            <Bell className="h-4 w-4 text-[#E37439]" />
            {nuevos.length > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#D64545]" />}
          </span>
          {nuevos.length ? `${nuevos.length} ${nuevos.length === 1 ? "aviso nuevo" : "avisos nuevos"} de tus clientes` : "Últimos avisos de tus clientes"}
        </p>
        {nuevos.length > 0 && (
          <button type="button" onClick={onVistos} className="text-xs font-semibold text-muted-foreground hover:text-[#E37439]">Marcar como vistos</button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-border">
        {lista.map((a) => {
          const Ico = ICONO[a.tipo];
          return (
            <li key={a.id}>
              <button type="button" onClick={() => abrir(a.material_id)} className="flex w-full items-start gap-2.5 py-2 text-left hover:opacity-80">
                <Ico className={cn("mt-0.5 h-4 w-4 shrink-0", COLOR[a.tipo])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    <b>{a.autor}</b> {VERBO[a.tipo]} <b>{nombre(a.material_id)}</b>
                  </span>
                  {a.texto && <span className="block truncate text-xs text-muted-foreground">{a.texto}</span>}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Pendientes({ pendientes, abrir, mostrarCliente }: { pendientes: Pendiente[]; abrir: (id: string) => void; mostrarCliente: boolean }) {
  return (
    <section aria-label="Lo que te toca hoy" className="grid gap-3 lg:grid-cols-3">
      {(Object.keys(TIPO) as Pendiente["tipo"][]).map((t) => {
        const cfg = TIPO[t];
        const items = pendientes.filter((p) => p.tipo === t);
        return (
          <div key={t} className={cn("rounded-2xl border p-4", cfg.fondo, cfg.borde)}>
            <p className="flex items-center justify-between text-sm font-bold" style={{ color: cfg.color }}>
              <span className="flex items-center gap-1.5"><cfg.Ico className="h-4 w-4" /> {cfg.nombre}</span>
              <span className="text-xl tabular-nums">{items.length}</span>
            </p>
            {items.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Nada pendiente.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {items.slice(0, 4).map((p) => (
                  <li key={p.m.id + t}>
                    <button type="button" onClick={() => abrir(p.m.id)} className="w-full rounded-lg bg-card/80 px-2.5 py-1.5 text-left hover:bg-card">
                      <span className="block truncate text-xs font-semibold text-foreground">{p.m.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{mostrarCliente && p.m.client_name ? `${p.m.client_name} · ` : ""}{p.detalle}</span>
                    </button>
                  </li>
                ))}
                {items.length > 4 && <li className="px-2.5 text-[11px] text-muted-foreground">y {items.length - 4} más</li>}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function AvisoProbarCliente() {
  return (
    <p className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <Repeat className="h-3.5 w-3.5 text-[#E37439]" />
      Para ver lo que ve el cliente, usa <b>Cambiar rol</b> abajo a la izquierda y entra como cliente eligiendo el laboratorio. Los cambios se ven en ambos lados.
    </p>
  );
}
