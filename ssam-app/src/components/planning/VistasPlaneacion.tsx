// Vistas de Planeación menos saturadas:
//  · AgendaLimpia: una fila compacta por entrega (sin tablas de 9 columnas);
//    las semanas vacías se colapsan en una línea.
//  · CalendarioMes: calendario mensual real que siempre cabe en la pantalla.
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import type { MaterialForecast } from "@/lib/api-types";
import { folioLabel, fmtDate } from "@/lib/mgmtHelpers";
import { internalLabel } from "@/components/MgmtDetailPanel";
import { estadoColor } from "@/components/report/MgmtCharts";
import { weekLabel, isThisWeek, haceStr, margenPill } from "@/lib/planningHelpers";
import { cn } from "@/lib/utils";

type Semana = { start: Date; items: MaterialForecast[] };

const dia = (s: string | null) => (s ? new Date(s + (s.length === 10 ? "T12:00:00" : "")) : null);

function FilaEntrega({ f, onSelect }: { f: MaterialForecast; onSelect: (id: string) => void }) {
  const d = dia(f.entrega_estimada);
  const mp = margenPill(f.margen_dias);
  return (
    <button
      type="button"
      onClick={() => onSelect(f.material_id)}
      className="grid w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F8F9FA] focus-visible:bg-[#FFF7F2] focus-visible:outline-none md:grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.2fr)_96px_96px]"
      style={{ boxShadow: `inset 3px 0 0 ${estadoColor(f.estado_pronostico)}` }}
    >
      <span className="flex flex-col items-center rounded-lg bg-[#F3F4F6] py-1 leading-none">
        <span className="text-[10px] uppercase text-[#7A8590]">{d ? d.toLocaleDateString("es-MX", { weekday: "short" }) : "—"}</span>
        <span className="mt-0.5 text-base font-bold text-[#0F1B2D]">{d ? d.getDate() : "?"}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#0F1B2D]">
          <span className="mr-1.5 font-mono text-[11px] font-normal text-[#9AA4B2]">{folioLabel(f.folio)}</span>
          {f.titulo ?? f.material_id}
        </span>
        <span className="block truncate text-[11px] text-[#7A8590]">
          {[f.cliente, f.producto, f.indicacion].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>
      <span className="hidden min-w-0 md:block">
        <span className="block truncate text-xs font-medium text-[#0F1B2D]">{internalLabel(f.status, 0)}</span>
        <span className="block truncate text-[11px] text-[#9AA4B2]">
          {f.responsable ?? "—"}
          {f.dias_en_etapa != null ? ` · ${haceStr(f.dias_en_etapa)}` : ""}
        </span>
      </span>
      <span className="hidden md:block">
        {mp ? <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", mp.bg, mp.cls)}>{mp.text}</span> : <span className="text-[11px] text-[#9AA4B2]">Sin margen</span>}
      </span>
      <span className="hidden text-[11px] text-[#4E5964] md:block">
        {f.fecha_requerida_cliente ? <>Lo necesita<br /><b className="text-[#0F1B2D]">{fmtDate(f.fecha_requerida_cliente)}</b></> : <span className="text-[#9AA4B2]">Sin fecha del cliente</span>}
      </span>
    </button>
  );
}

export function AgendaLimpia({ vencidos, semanas, onSelect }: { vencidos: MaterialForecast[]; semanas: Semana[]; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {vencidos.length > 0 && (
        <section className="ssam-subir">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#D64545]">
            <AlertTriangle className="h-3.5 w-3.5" /> Vencidos
            <span className="font-normal text-[#9AA4B2]">· {vencidos.length}</span>
          </h2>
          <div className="divide-y divide-[#F0F1F4] overflow-hidden rounded-xl border border-[#D64545]/25 bg-white">
            {vencidos.map((f) => <FilaEntrega key={f.material_id} f={f} onSelect={onSelect} />)}
          </div>
        </section>
      )}
      {semanas.map((w, i) => {
        const tarde = w.items.filter((f) => f.estado_pronostico === "tarde").length;
        const actual = isThisWeek(w.start);
        if (!w.items.length)
          return (
            <p key={i} className="flex items-center gap-2 px-1 text-[12px] text-[#9AA4B2]">
              <span className={cn("font-semibold", actual ? "text-[#E37439]" : "text-[#4E5964]")}>{weekLabel(w.start)}</span>· sin entregas
            </p>
          );
        return (
          <section key={i} className="ssam-subir" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <span className={actual ? "text-[#E37439]" : "text-[#0F1B2D]"}>{weekLabel(w.start)}</span>
              {actual && <span className="rounded-full bg-[#E37439]/12 px-2 py-0.5 text-[10px] font-bold text-[#E37439]">Esta semana</span>}
              <span className="font-normal text-[#9AA4B2]">
                · {w.items.length} entrega{w.items.length === 1 ? "" : "s"}
                {tarde ? ` · ${tarde} tarde` : ""}
              </span>
            </h2>
            <div className="divide-y divide-[#F0F1F4] overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
              {w.items.map((f) => <FilaEntrega key={f.material_id} f={f} onSelect={onSelect} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const llave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarioMes({ items, onSelect }: { items: MaterialForecast[]; onSelect: (id: string) => void }) {
  const hoy = new Date();
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const m: Record<string, MaterialForecast[]> = {};
    for (const f of items) {
      const d = dia(f.entrega_estimada);
      if (d) (m[llave(d)] ??= []).push(f);
    }
    return m;
  }, [items]);

  const celdas = useMemo(() => {
    const inicio = new Date(mes);
    const desfase = (inicio.getDay() + 6) % 7; // lunes = 0
    inicio.setDate(1 - desfase);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mes]);

  const enMes = items.filter((f) => {
    const d = dia(f.entrega_estimada);
    return d && d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear();
  }).length;
  const listaDia = diaAbierto ? porDia[diaAbierto] ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => { setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setDiaAbierto(null); }} className="rounded-lg border border-[#E4E7EC] bg-white p-1.5 hover:bg-[#F8F9FA]"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Mes siguiente" onClick={() => { setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setDiaAbierto(null); }} className="rounded-lg border border-[#E4E7EC] bg-white p-1.5 hover:bg-[#F8F9FA]"><ChevronRight className="h-4 w-4" /></button>
        <h2 className="text-base font-bold text-[#0F1B2D] first-letter:uppercase">{mes.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</h2>
        <span className="text-xs text-[#9AA4B2]">· {enMes} entrega{enMes === 1 ? "" : "s"}</span>
        <button type="button" onClick={() => { setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); setDiaAbierto(null); }} className="ml-auto rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#4E5964] hover:bg-[#F8F9FA]">Hoy</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="grid grid-cols-7 border-b border-[#E4E7EC] bg-[#F8F9FA] text-center text-[11px] font-semibold text-[#7A8590]">
          {DIAS.map((d) => <span key={d} className="py-2">{d}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((d, i) => {
            const k = llave(d);
            const del = porDia[k] ?? [];
            const fuera = d.getMonth() !== mes.getMonth();
            const esHoy = k === llave(hoy);
            const abierto = diaAbierto === k;
            return (
              <button
                key={i}
                type="button"
                onClick={() => del.length && setDiaAbierto(abierto ? null : k)}
                className={cn(
                  "flex min-h-[92px] min-w-0 flex-col gap-1 border-b border-r border-[#F0F1F4] p-1.5 text-left transition-colors",
                  (i + 1) % 7 === 0 && "border-r-0",
                  fuera ? "bg-[#FAFBFC]" : "bg-white",
                  del.length ? "hover:bg-[#FFF7F2]" : "cursor-default",
                  abierto && "bg-[#FFF7F2] ring-2 ring-inset ring-[#E37439]",
                )}
              >
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", esHoy ? "bg-[#E37439] font-bold text-white" : fuera ? "text-[#C4CAD1]" : "font-semibold text-[#4E5964]")}>{d.getDate()}</span>
                {del.slice(0, 3).map((f) => (
                  <span key={f.material_id} className="block w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#0F1B2D]" style={{ background: `${estadoColor(f.estado_pronostico)}22`, boxShadow: `inset 2px 0 0 ${estadoColor(f.estado_pronostico)}` }}>
                    {f.titulo ?? f.material_id}
                  </span>
                ))}
                {del.length > 3 && <span className="px-1 text-[10px] font-semibold text-[#E37439]">+{del.length - 3} más</span>}
              </button>
            );
          })}
        </div>
      </div>

      {diaAbierto && listaDia.length > 0 && (
        <section className="ssam-carpeta-abre overflow-hidden rounded-xl border border-[#E37439]/40 bg-white">
          <p className="border-b border-[#F0F1F4] px-3 py-2 text-xs font-semibold text-[#0F1B2D]">
            {dia(diaAbierto)!.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} · {listaDia.length} entrega{listaDia.length === 1 ? "" : "s"}
          </p>
          <div className="divide-y divide-[#F0F1F4]">{listaDia.map((f) => <FilaEntrega key={f.material_id} f={f} onSelect={onSelect} />)}</div>
        </section>
      )}
    </div>
  );
}
