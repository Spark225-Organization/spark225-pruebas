import { useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  MaterialMetric,
  MaterialForecast,
  TimelineStage,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

// Etiquetas internas por status (dashboard interno, no portal del cliente).
const INTERNAL_STATUS_LABELS: Record<string, string> = {
  ideacion: "Ideación",
  desarrollo_medico: "Desarrollo médico",
  revision_direccion: "Revisión de Dirección",
  aprobacion_cliente_medico: "Aprobación cliente · médico",
  desarrollo_grafico: "Desarrollo gráfico",
  revision_direccion_grafico: "Revisión Dirección · gráfico",
  validacion_medica_final: "Validación médica final",
  aprobacion_cliente_grafico: "Aprobación cliente · gráfico",
  sometimiento_final: "Sometimiento final",
  crc: "Aprobación interna",
  aprobado: "Entrega",
};

export function internalLabel(status: string, round: number): string {
  const base = INTERNAL_STATUS_LABELS[status] ?? status;
  return round > 1 ? `${base} (ronda ${round})` : base;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function margenText(
  margen: number | null | undefined,
): { text: string; cls: string } | null {
  if (margen == null) return null;
  if (margen > 0) return { text: `+${margen} d`, cls: "text-[#2E9E5B]" };
  if (margen < 0)
    return { text: `−${Math.abs(margen)} d`, cls: "text-[#D64545]" };
  return { text: "0 d", cls: "text-[#B5840A]" };
}

export function EstadoPill({
  estado,
}: {
  estado: MaterialForecast["estado_pronostico"];
}) {
  const map: Record<string, { label: string; cls: string }> = {
    a_tiempo: { label: "A tiempo", cls: "bg-[#2E9E5B]/12 text-[#2E9E5B]" },
    justo: { label: "Justo", cls: "bg-[#F5C245]/15 text-[#B5840A]" },
    tarde: { label: "Tarde", cls: "bg-[#D64545]/12 text-[#D64545]" },
    sin_fecha: { label: "Sin fecha", cls: "bg-[#9AA4B2]/15 text-[#4E5964]" },
  };
  const e = map[estado ?? "sin_fecha"];
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        e.cls,
      )}
    >
      {e.label}
    </span>
  );
}

function Box({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#E4E7EC] p-2.5">
      <p className="text-[10px] text-[#9AA4B2]">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          valueClassName ?? "text-[#0F1B2D]",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#9AA4B2]">{sub}</p>}
    </div>
  );
}

type TimelineRowProps = {
  s: TimelineStage;
  isEntrega: boolean;
  forecast: MaterialForecast | null;
};

function TimelineRow({ s, isEntrega, forecast }: TimelineRowProps) {
  const label = isEntrega ? "Entrega" : internalLabel(s.status, 0);

  let dotCls: string;
  let dateLabel = "";
  if (s.tipo === "hecho") {
    dotCls = "bg-[#1E3A5F]";
    dateLabel = fmtDate(s.fin);
  } else if (s.tipo === "en_curso") {
    dotCls = "bg-[#E37439] ring-2 ring-[#E37439]/30";
    dateLabel = s.fin ? `hasta ~${fmtDate(s.fin)}` : "En curso";
  } else {
    dotCls = "border border-dashed border-[#9AA4B2]";
    dateLabel = fmtDate(
      isEntrega ? (forecast?.entrega_estimada ?? null) : s.fin,
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotCls)} />
      <span
        className={cn(
          "flex-1 text-xs",
          s.tipo === "en_curso"
            ? "font-semibold text-[#0F1B2D]"
            : s.tipo === "estimado"
              ? "text-[#9AA4B2]"
              : "text-[#4E5964]",
        )}
      >
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-[#9AA4B2]">
        {dateLabel}
      </span>
    </div>
  );
}

// Type alias for the props (workaround for a TS quirk in this file).
type TimelineRowPropsProps = TimelineRowProps;

export function MaterialDetailPanel({
  metric,
  forecast,
  timeline,
  clientName,
}: {
  metric: MaterialMetric | null;
  forecast: MaterialForecast | null;
  timeline: TimelineStage[];
  clientName: string | null;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const folio = forecast?.folio ?? metric?.folio ?? null;

  if (!metric && !forecast) {
    return (
      <Card className="border border-[#E4E7EC] bg-white shadow-none">
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center">
          <SearchIcon className="h-6 w-6 text-[#9AA4B2]" />
          <p className="text-sm text-[#4E5964]">
            Selecciona un material del calendario o la tabla para ver su
            detalle.
          </p>
        </CardContent>
      </Card>
    );
  }

  const loNecesita =
    forecast?.fecha_requerida_cliente ?? metric?.fecha_comprometida ?? null;
  const estimada = forecast?.entrega_estimada ?? null;
  const estimadaMax = forecast?.entrega_estimada_max ?? null;
  const margen = forecast?.margen_dias ?? null;
  const margenInfo = margenText(margen);

  const currentStage = timeline.find((s) => s.tipo === "en_curso");
  const lastStage = timeline[timeline.length - 1];
  const currentOrden = currentStage?.orden ?? 0;
  const nextStage = timeline
    .filter((s) => s.tipo === "estimado" && s.orden > currentOrden)
    .sort((a, b) => a.orden - b.orden)[0];

  // Contar rondas del cliente y devoluciones internas para el resumen.
  const clienteStatuses = new Set([
    "aprobacion_cliente_medico",
    "aprobacion_cliente_grafico",
  ]);
  const rondasCliente = timeline.filter((s) =>
    clienteStatuses.has(s.status),
  ).length;
  const devolucionesInternas = timeline.filter(
    (s) =>
      s.tipo === "hecho" &&
      (s.status === "revision_direccion" ||
        s.status === "revision_direccion_grafico" ||
        s.status === "validacion_medica_final"),
  ).length;
  const hechosTimeline = timeline.filter((s) => s.tipo === "hecho");

  // Renglones siempre visibles: último hecho, en_curso y todos los estimados.
  const lastHecho = hechosTimeline[hechosTimeline.length - 1];
  const visibles: TimelineStage[] = [];
  if (lastHecho && timeline.length > 3) {
    // Colapsar los hechos previos, pero mostrar el último hecho.
  } else {
    visibles.push(...hechosTimeline);
  }
  const enCursoArr = timeline.filter((s) => s.tipo === "en_curso");
  const estimados = timeline.filter((s) => s.tipo === "estimado");
  visibles.push(...enCursoArr, ...estimados);

  // Quitar duplicados por (status, orden) manteniendo el orden.
  const seen = new Set<string>();
  const uniqueVisibles = visibles.filter((s) => {
    const k = `${s.status}-${s.orden}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const hasCollapsedHistory =
    timeline.length > 3 && hechosTimeline.length > 1 && !showHistory;
  const pasosHechos = hechosTimeline.length;

  return (
    <Card className="border border-[#E4E7EC] bg-white shadow-none">
      <CardHeader className="pb-2">
        <Link
          to={`/materials/${metric?.material_id ?? forecast?.material_id ?? ""}`}
          className="text-[15px] font-semibold text-[#0F1B2D] hover:text-[#E37439]"
        >
          {folio == null ? "" : `#${folio} · `}
          {metric?.name ?? forecast?.titulo ?? "—"}
        </Link>
        <p className="text-[11px] text-[#9AA4B2]">
          {clientName ?? forecast?.cliente ?? "—"} ·{" "}
          {forecast?.producto ?? metric?.product_name ?? "—"} ·{" "}
          {forecast?.indicacion ?? metric?.indication_name ?? "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Box label="Lo necesita el cliente" value={fmtDate(loNecesita)} />
          <Box
            label="Entrega estimada"
            value={fmtDate(estimada)}
            sub={estimadaMax ? `hasta ${fmtDate(estimadaMax)}` : undefined}
          />
          <Box
            label="Margen"
            value={margenInfo ? margenInfo.text : "—"}
            valueClassName={margenInfo?.cls}
          />
        </div>

        <div className="rounded-[10px] border border-[#E4E7EC] bg-[#F8F9FA] p-3">
          <p className="text-[11px] font-semibold text-[#9AA4B2]">Ahora</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0F1B2D]">
            {currentStage
              ? internalLabel(currentStage.status, 1)
              : lastStage?.status === "aprobado"
                ? "Entrega"
                : "—"}
          </p>
          <p className="text-[11px] text-[#4E5964]">
            La tiene: {forecast?.responsable ?? metric?.responsible_name ?? "—"}
          </p>
          <p className="text-[11px] text-[#4E5964]">
            Siguiente paso:{" "}
            {nextStage ? internalLabel(nextStage.status, 1) : "—"}
          </p>
        </div>

        <div className="space-y-1.5">
          {hasCollapsedHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="flex w-full items-center justify-between rounded-lg bg-[#F0F1F4] px-2.5 py-1.5 text-[11px] font-semibold text-[#4E5964] transition-colors hover:bg-[#E4E7EC]"
            >
              <span>
                Historial: {pasosHechos} pasos · {rondasCliente} rondas del
                cliente · {devolucionesInternas} devoluciones internas
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {(showHistory ? timeline : uniqueVisibles).map((s) => {
            const isEntrega = s.orden === lastStage?.orden;
            return (
              <TimelineRow
                key={`${s.material_id}-${s.orden}`}
                s={s}
                isEntrega={isEntrega}
                forecast={forecast}
              />
            );
          })}

          {showHistory && timeline.length > 3 && (
            <button
              onClick={() => setShowHistory(false)}
              className="flex w-full items-center justify-center gap-1 pt-1 text-[11px] font-semibold text-[#E37439] hover:underline"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Ver menos
            </button>
          )}
        </div>

        {(forecast?.estado_pronostico === "tarde" ||
          forecast?.estado_pronostico === "justo") && (
          <div className="rounded-[10px] border border-[#D64545]/30 bg-[#D64545]/8 p-3">
            <p className="text-[11px] font-semibold text-[#D64545]">
              ¿Qué hacer?
            </p>
            <p className="mt-0.5 text-xs text-[#4E5964]">
              {forecast?.estado_pronostico === "tarde"
                ? "El material llegaría tarde. Negocia una nueva fecha con el cliente o reasigna recursos para acelerar."
                : "El material está justo en la fecha. Da seguimiento hoy para no retrasarte."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Material entregado (fuera del conjunto activo) ────────────────────────
// Tarjeta de detalle para un material que ya fue entregado/aprobado y que
// llegó al buscador por folio. Muestra el estado actual, fechas clave y
// códigos. No muestra línea de tiempo ni "¿Qué hacer?".
export function DeliveredCard({
  metric,
  clientName,
}: {
  metric: MaterialMetric;
  clientName: string | null;
}) {
  const folio = metric.folio ?? null;
  const estadoActual =
    metric.status === "implementado"
      ? "Implementado"
      : metric.status === "produccion"
        ? "En producción"
        : "Aprobado";

  return (
    <Card className="border border-[#E4E7EC] bg-white shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#2E9E5B]/12 px-2 py-0.5 text-[11px] font-semibold text-[#2E9E5B]">
            Entregado
          </span>
          {folio != null && (
            <span className="text-[13px] font-semibold tabular-nums text-[#0F1B2D]">
              #{folio}
            </span>
          )}
        </div>
        <Link
          to={`/materials/${metric.material_id}`}
          className="text-[15px] font-semibold text-[#0F1B2D] hover:text-[#E37439]"
        >
          {metric.name ?? "—"}
        </Link>
        <p className="text-[11px] text-[#9AA4B2]">
          {clientName ?? metric.client_name ?? "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Box label="Estado actual" value={estadoActual} />
          <Box
            label="A tiempo vs lo que necesita"
            value={
              metric.a_tiempo_vs_requerida == null
                ? "—"
                : metric.a_tiempo_vs_requerida
                  ? "Sí"
                  : "No"
            }
            valueClassName={
              metric.a_tiempo_vs_requerida == null
                ? undefined
                : metric.a_tiempo_vs_requerida
                  ? "text-[#2E9E5B]"
                  : "text-[#D64545]"
            }
          />
          <Box
            label="Fecha de aprobación"
            value={fmtDate(metric.aprobado_at ?? null)}
          />
          <Box
            label="Entrega del paquete"
            value={fmtDate(metric.paquete_final_entregado_at ?? null)}
          />
        </div>
        <div className="rounded-[10px] border border-[#E4E7EC] bg-[#F8F9FA] p-3">
          <p className="text-[11px] font-semibold text-[#9AA4B2]">Códigos</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#0F1B2D]">
            {metric.codigo_aprobacion_interna ?? "—"}
          </p>
          <p className="text-[11px] text-[#4E5964]">
            Código de aprobación interna
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Selector cuando un mismo número de folio existe en varios clientes y el
// filtro de cliente está en "Todos". Muestra una lista corta para elegir.
export function DeliveredPicker({
  items,
  onPick,
}: {
  items: { material_id: string; label: string }[];
  onPick: (materialId: string) => void;
}) {
  return (
    <Card className="border border-[#E4E7EC] bg-white shadow-none">
      <CardHeader className="pb-2">
        <p className="text-[13px] font-semibold text-[#0F1B2D]">
          Ese número de folio existe en varios clientes
        </p>
        <p className="text-[11px] text-[#9AA4B2]">Elige cuál quieres ver:</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((it) => (
          <button
            key={it.material_id}
            onClick={() => onPick(it.material_id)}
            className="flex w-full items-center justify-between rounded-lg bg-[#F8F9FA] px-3 py-2 text-left text-sm font-medium text-[#0F1B2D] transition-colors hover:bg-[#F0F1F4]"
          >
            <span>{it.label}</span>
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg] text-[#9AA4B2]" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
