// Sección "Salud por cliente" del dashboard de dirección.
// Una tarjeta por cada cliente con materiales activos, con semáforo general
// (En control / Atención / En riesgo), materiales activos, % a tiempo,
// conteos de Entrega vencida · Llegaría tarde · Bloqueados, entregas en 14 d
// y cuello de botella (etapa con más materiales que llegarían tarde y de
// quién depende). El detalle por material vive en /planeacion; aquí no se
// muestra. No toca la base de datos.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyReport } from "@/components/reportPrimitives";
import { SectionTitle } from "@/components/MgmtSubcomponents";
import { internalLabel } from "@/components/MgmtDetailPanel";
import { Clock, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type {
  MaterialMetric,
  MaterialForecast,
  CandadoEvent,
} from "@/lib/api-types";
import { InsightList, type MgmtInsight } from "@/components/report/MgmtCharts";
import { TERMINAL_STATUSES, cdmxDate, cdmxNow } from "@/lib/mgmtHelpers";
import { cn } from "@/lib/utils";

const DAY = 1000 * 60 * 60 * 24;
const HORIZON_DIAS = 14;

export interface PlanningProps {
  forecast: MaterialForecast[];
  metrics: MaterialMetric[];
  candado: CandadoEvent[];
  clientMap?: Record<string, string>;
}

type Salud = "en_riesgo" | "atencion" | "en_control" | "sin_datos";

const SALUD_META: Record<Salud, { label: string; cls: string }> = {
  en_riesgo: {
    label: "En riesgo",
    cls: "bg-[#D64545]/12 text-[#D64545]",
  },
  atencion: {
    label: "Atención",
    cls: "bg-[#F5C245]/15 text-[#B5840A]",
  },
  en_control: {
    label: "En control",
    cls: "bg-[#2E9E5B]/12 text-[#2E9E5B]",
  },
  sin_datos: {
    label: "Sin datos",
    cls: "bg-[#9AA4B2]/15 text-[#9AA4B2]",
  },
};

interface ClientSalud {
  id: string | null;
  name: string;
  salud: Salud;
  activos: number;
  aTiempoPct: number | null;
  vencida: number;
  llegariaTarde: number;
  bloqueados: number;
  entregas14d: number;
  cuello: { etapa: string; n: number; depende: "cliente" | "spark225" } | null;
  riesgo: number; // score de orden
}

// Etapas de aprobación del cliente (depende del cliente, no regulatorio).
const CLIENTE_ETAPAS = new Set<string>([
  "aprobacion_cliente_medico",
  "aprobacion_cliente_grafico",
]);

// Clasifica una fila de forecast para la tarjeta por cliente.
// Tres métricas consistentes en todo el dashboard:
//  - entregaVencida: la fecha estimada de entrega ya pasó (CDMX).
//  - llegariaTarde: la proyección supera la fecha que necesita el cliente
//    (estado_pronostico === "tarde") pero la entrega aún no vence.
//  - blocked: el material tiene un candado activo.
function classify(
  f: MaterialForecast,
  tMs: number,
  lim: number,
  blockedIds: Set<string>,
) {
  const entrega = f.entrega_estimada ? cdmxDate(f.entrega_estimada) : null;
  const entregaVencida = entrega != null && entrega.getTime() < tMs;
  const blocked = blockedIds.has(f.material_id);
  const llegariaTarde = !entregaVencida && f.estado_pronostico === "tarde";
  const aTiempo = !entregaVencida && !llegariaTarde;
  const en14d = entrega != null && !entregaVencida && entrega.getTime() <= lim;
  return { entregaVencida, blocked, llegariaTarde, aTiempo, en14d, entrega };
}

export function MgmtPlanning({
  forecast,
  metrics,
  candado,
  clientMap = {},
}: PlanningProps) {
  const blockedIds = useMemo(
    () => new Set(candado.map((c) => c.material_id)),
    [candado],
  );

  // Tarjeta por cliente con materiales activos. Se agrupa por el NOMBRE del
  // cliente (f.cliente, el mismo campo que muestra /planeacion) porque la
  // vista v_material_forecast puede traer client_id vacío para algunos
  // materiales; agrupar por id los colapsaría en un solo bucket.
  const cards = useMemo<ClientSalud[]>(() => {
    const tMs = cdmxNow().getTime();
    const lim = tMs + HORIZON_DIAS * DAY;
    const map: Record<
      string,
      {
        id: string | null;
        name: string;
        activos: number;
        // % a tiempo: MISMA fórmula que computeSaludAggregate (tabla
        // "Desempeño por cliente"). El denominador son los activos CON
        // fecha requerida; si ninguno la tiene → N/D (no 100%).
        conFechaRequerida: number;
        aTiempoConFecha: number;
        vencida: number;
        llegariaTarde: number;
        bloqueados: number;
        entregas14d: number;
        cuelloCount: Record<string, number>;
        cuelloDep: Record<string, "cliente" | "spark225">;
      }
    > = {};
    for (const f of forecast) {
      if (TERMINAL_STATUSES.has(f.status)) continue;
      const key =
        f.cliente ??
        (f.client_id ? clientMap[f.client_id] : null) ??
        "Sin cliente";
      if (!map[key])
        map[key] = {
          id: f.client_id ?? null,
          name: key,
          activos: 0,
          conFechaRequerida: 0,
          aTiempoConFecha: 0,
          vencida: 0,
          llegariaTarde: 0,
          bloqueados: 0,
          entregas14d: 0,
          cuelloCount: {},
          cuelloDep: {},
        };
      const c = map[key];
      c.activos++;
      const cls = classify(f, tMs, lim, blockedIds);
      if (cls.entregaVencida) c.vencida++;
      if (cls.llegariaTarde) c.llegariaTarde++;
      if (cls.blocked) c.bloqueados++;
      if (cls.en14d) c.entregas14d++;
      // Denominador del % a tiempo: solo activos CON fecha requerida.
      if (f.fecha_requerida_cliente) {
        c.conFechaRequerida++;
        if (cls.aTiempo) c.aTiempoConFecha++;
      }
      // Cuello de botella: etapa actual de los que llegarían tarde, la más
      // frecuente, y si esa etapa depende del cliente o de Spark225.
      if (cls.llegariaTarde) {
        const lbl = internalLabel(f.status, 0);
        c.cuelloCount[lbl] = (c.cuelloCount[lbl] ?? 0) + 1;
        c.cuelloDep[lbl] = CLIENTE_ETAPAS.has(f.status)
          ? "cliente"
          : "spark225";
      }
    }
    const out: ClientSalud[] = [];
    for (const c of Object.values(map)) {
      const tieneFecha = c.conFechaRequerida > 0;
      // Semáforo general:
      //  - En riesgo si ≥1 entrega vencida, ≥1 bloqueado o >20% llegaría tarde.
      //  - Atención si hay algunos que llegarían tarde (≤20%) pero no es risco.
      //  - "Sin datos" si no hay ningún material con fecha requerida.
      //  - Si no, En control.
      const tardeRatio = c.activos > 0 ? c.llegariaTarde / c.activos : 0;
      let salud: Salud = "en_control";
      if (c.vencida > 0 || c.bloqueados > 0 || tardeRatio > 0.2)
        salud = "en_riesgo";
      else if (c.llegariaTarde > 0) salud = "atencion";
      else if (!tieneFecha) salud = "sin_datos";
      // Cuello de botella: etapa con más "llegaría tarde".
      let cuello: ClientSalud["cuello"] = null;
      const entries = Object.entries(c.cuelloCount);
      if (entries.length) {
        const top = entries.sort((a, b) => b[1] - a[1])[0];
        cuello = {
          etapa: top[0],
          n: top[1],
          depende: c.cuelloDep[top[0]] ?? "spark225",
        };
      }
      // % a tiempo = aTiempo entre los CON fecha requerida / activos con fecha.
      // Si ningún material tiene fecha requerida → N/D (no 100%). Misma
      // fórmula que computeSaludAggregate (tabla por cliente).
      const aTiempoPct =
        c.conFechaRequerida === 0
          ? null
          : Math.round((c.aTiempoConFecha / c.conFechaRequerida) * 100);
      // Score de orden: vencida pesa más, luego bloqueados, luego tarde.
      const score = c.vencida * 100 + c.bloqueados * 20 + c.llegariaTarde;
      out.push({
        id: c.id,
        name: c.name,
        salud,
        activos: c.activos,
        aTiempoPct,
        vencida: c.vencida,
        llegariaTarde: c.llegariaTarde,
        bloqueados: c.bloqueados,
        entregas14d: c.entregas14d,
        cuello,
        riesgo: score,
      });
    }
    return out.sort((a, b) => b.riesgo - a.riesgo);
  }, [forecast, blockedIds, clientMap]);

  // ── Bloque "Riesgos principales": máximo 3 frases por severidad.
  // Se calcula con los MISMOS datos y reglas que las tarjetas, de modo que si
  // alguna tarjeta está En riesgo o Atención, siempre aparece una frase.
  const riesgos = useMemo(() => {
    const frases: { sev: number; text: string }[] = [];
    for (const c of cards) {
      if (c.vencida > 0)
        frases.push({
          sev: 3,
          text: `${c.name}: ${c.vencida} ${c.vencida === 1 ? "entrega vencida" : "entregas vencidas"}.`,
        });
      if (c.bloqueados > 0)
        frases.push({
          sev: 3,
          text: `${c.name}: ${c.bloqueados} ${c.bloqueados === 1 ? "material bloqueado" : "materiales bloqueados"} por candado.`,
        });
      if (c.llegariaTarde > 0)
        frases.push({
          sev: 2,
          text: `${c.name}: ${c.llegariaTarde} ${c.llegariaTarde === 1 ? "material llegaría tarde" : "materiales llegarían tarde"} según la proyección.`,
        });
    }
    if (!frases.length) return [];
    return frases.sort((a, b) => b.sev - a.sev).slice(0, 3);
  }, [cards]);

  return (
    <section className="space-y-4">
      {/* Riesgos principales */}
      <div>
        <SectionTitle title="Salud por cliente" />
        <p className="mb-2 text-[12px] font-medium text-[#4E5964]">
          Riesgos principales
        </p>
        {riesgos.length === 0 ? (
          <div className="flex items-center gap-2 rounded-[12px] border border-[#E4E7EC] bg-[#F8F9FA] px-4 py-3 text-sm text-[#4E5964]">
            <CheckCircle2 className="h-4 w-4 text-[#2E9E5B]" />
            Sin riesgos activos.
          </div>
        ) : (
          <div className="space-y-2">
            {riesgos.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-[12px] border border-[#E4E7EC] bg-white px-4 py-3 text-sm text-[#1F2124]"
              >
                <ShieldAlert
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    r.sev >= 3 ? "text-[#D64545]" : "text-[#B5840A]",
                  )}
                />
                <span className="leading-snug">{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tarjetas por cliente */}
      {cards.length === 0 ? (
        <EmptyReport
          title="Sin clientes activos"
          desc="No hay materiales activos para mostrar salud por cliente."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const planeacionHref = c.id
              ? `/planeacion?cliente=${encodeURIComponent(c.id)}`
              : "/planeacion";
            return (
              <Card
                key={c.name}
                className="flex flex-col border border-[#E4E7EC] bg-white shadow-none"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  {/* Encabezado: nombre + semáforo */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-tight text-[#0F1B2D]">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#9AA4B2]">
                        {c.activos}{" "}
                        {c.activos === 1
                          ? "material activo"
                          : "materiales activos"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        SALUD_META[c.salud].cls,
                      )}
                    >
                      {c.salud === "en_riesgo" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : c.salud === "atencion" ? (
                        <Clock className="h-3 w-3" />
                      ) : c.salud === "sin_datos" ? (
                        <Clock className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {SALUD_META[c.salud].label}
                    </span>
                  </div>

                  {/* % a tiempo */}
                  <div className="flex items-baseline justify-between border-y border-[#E4E7EC] py-2">
                    <span className="text-[12px] text-[#4E5964]">
                      % a tiempo (proyección)
                    </span>
                    <span
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        c.aTiempoPct == null
                          ? "text-[#9AA4B2]"
                          : (c.aTiempoPct ?? 0) >= 85
                            ? "text-[#2E9E5B]"
                            : (c.aTiempoPct ?? 0) >= 70
                              ? "text-[#B5840A]"
                              : "text-[#D64545]",
                      )}
                    >
                      {c.aTiempoPct == null ? "N/D" : `${c.aTiempoPct}%`}
                    </span>
                  </div>
                  {c.aTiempoPct == null && (
                    <p className="-mt-1 mb-1 text-[10px] text-[#9AA4B2]">
                      Sin fecha requerida
                    </p>
                  )}

                  {/* Conteos: Entrega vencida · Llegaría tarde · Bloqueados */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Count
                      label="Vencida"
                      value={c.vencida}
                      tone={c.vencida > 0 ? "red" : "slate"}
                    />
                    <Count
                      label="Tarde"
                      value={c.llegariaTarde}
                      tone={c.llegariaTarde > 0 ? "amber" : "slate"}
                    />
                    <Count
                      label="Bloqueados"
                      value={c.bloqueados}
                      tone={c.bloqueados > 0 ? "navy" : "slate"}
                    />
                  </div>

                  {/* Entregas 14 d */}
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-[#4E5964]">Entregas en 14 días</span>
                    <span className="font-semibold tabular-nums text-[#0F1B2D]">
                      {c.entregas14d}
                    </span>
                  </div>

                  {/* Cuello de botella */}
                  {c.cuello && (
                    <div className="rounded-[10px] bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#4E5964]">
                      <span className="font-medium text-[#0F1B2D]">
                        Cuello de botella:
                      </span>{" "}
                      {c.cuello.etapa} · {c.cuello.n}{" "}
                      {c.cuello.n === 1 ? "material" : "materiales"} · depende
                      de{" "}
                      {c.cuello.depende === "cliente" ? (
                        <span className="font-medium text-[#1E3A5F]">
                          Cliente
                        </span>
                      ) : (
                        <span className="font-medium text-[#E37439]">
                          Spark225
                        </span>
                      )}
                    </div>
                  )}

                  {/* Acción */}
                  <Link
                    to={planeacionHref}
                    className="mt-auto inline-flex items-center gap-1 self-start text-[12px] font-semibold text-[#E37439] hover:underline"
                  >
                    Ver en planeación →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "navy" | "slate";
}) {
  const TONE: Record<typeof tone, string> = {
    red: "text-[#D64545]",
    amber: "text-[#B5840A]",
    navy: "text-[#0F1B2D]",
    slate: "text-[#9AA4B2]",
  };
  return (
    <div className="rounded-[8px] bg-[#F8F9FA] py-1.5">
      <p
        className={cn(
          "text-lg font-semibold leading-none tabular-nums",
          TONE[tone],
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[#9AA4B2]">{label}</p>
    </div>
  );
}

// Re-export para mantener compatibilidad con otros módulos que importan
// MgmtAtencion desde aquí (sección "¿Qué hago hoy?").
export function MgmtAtencion({
  atencion,
  metrics,
  insights,
}: {
  atencion: MaterialForecast[];
  metrics: MaterialMetric[];
  insights: MgmtInsight[];
}) {
  // El detalle por material vive en /planeacion; aquí solo mostramos las 5
  // filas de mayor impacto (tarde > justo > esperando al cliente) y un
  // enlace a la planeación completa.
  const top5 = useMemo(
    () =>
      [...atencion]
        .sort((a, b) => {
          const rank = (f: MaterialForecast) =>
            f.estado_pronostico === "tarde"
              ? 0
              : f.estado_pronostico === "justo"
                ? 1
                : 2;
          const ra = rank(a);
          const rb = rank(b);
          if (ra !== rb) return ra - rb;
          // Dentro del mismo grupo, mayor atraso primero.
          const ma = Math.abs(a.margen_dias ?? 0);
          const mb = Math.abs(b.margen_dias ?? 0);
          return mb - ma;
        })
        .slice(0, 5),
    [atencion],
  );

  return (
    <>
      <SectionTitle title="¿Qué hago hoy?" className="mt-6" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border border-[#E4E7EC] bg-white shadow-none lg:col-span-2">
          <CardContent className="pt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-[#0F1B2D]">
                Necesita tu atención
              </p>
              <Link
                to="/planeacion"
                className="text-[12px] font-semibold text-[#E37439] hover:underline"
              >
                Ver todas en planeación →
              </Link>
            </div>
            {top5.length === 0 ? (
              <EmptyReport
                title="Todo bajo control"
                desc="No hay materials justo/tarde ni esperando al cliente."
              />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[#E4E7EC]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8F9FA] text-[11px] text-[#4E5964]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">
                        Material
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Motivo
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Responsable
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Impacto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {top5.map((f) => {
                      const m = metrics.find(
                        (x) => x.material_id === f.material_id,
                      );
                      const folio = f.folio ?? m?.folio ?? null;
                      const margen = f.margen_dias ?? 0;
                      return (
                        <tr key={f.material_id} className="hover:bg-[#F8F9FA]">
                          <td className="px-3 py-2">
                            <Link
                              to={`/materials/${f.material_id}`}
                              className="font-semibold text-[#0F1B2D] hover:text-[#E37439]"
                            >
                              {folio != null ? `#${folio} · ` : ""}
                              {f.titulo ?? f.material_id}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-[#4E5964]">
                            {f.depende_de === "cliente"
                              ? "Esperando aprobación del cliente"
                              : f.estado_pronostico === "tarde"
                                ? "Llegaría tarde"
                                : "Justo en la fecha"}
                          </td>
                          <td className="px-3 py-2 text-[#4E5964]">
                            {f.responsable ?? m?.responsible_name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                                f.estado_pronostico === "tarde"
                                  ? "bg-[#D64545]/12 text-[#D64545]"
                                  : "bg-[#F5C245]/15 text-[#B5840A]",
                              )}
                            >
                              {f.estado_pronostico === "tarde"
                                ? `-${Math.abs(margen)}d`
                                : `${margen}d`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-[#E4E7EC] bg-white shadow-none">
          <CardContent className="pt-6">
            <p className="mb-2 text-[15px] font-semibold text-[#0F1B2D]">
              Insights
            </p>
            <InsightList items={insights} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
