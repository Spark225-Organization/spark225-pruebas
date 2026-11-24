import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { StageDuration } from "@/lib/api-types";
import {
  statusShortLabel,
  formatDate,
  type MaterialStatus,
} from "@/lib/statusModel";
import { SPARK_COLORS, colorFor } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";

type Grouped = {
  materialId: string;
  materialName: string;
  stages: StageDuration[];
};

const DAY = 1000 * 60 * 60 * 24;

export const Gantt = ({
  rows,
  fechaComprometidaMap = {},
  showToday = true,
  height = 360,
}: {
  rows: StageDuration[];
  fechaComprometidaMap?: Record<string, string | null>;
  showToday?: boolean;
  height?: number;
}) => {
  const [zoom, setZoom] = useState<"weeks" | "months">("weeks");

  const { groups, minTs, maxTs, todayTs } = useMemo(() => {
    const map: Record<string, Grouped> = {};
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      if (!map[r.material_id])
        map[r.material_id] = {
          materialId: r.material_id,
          materialName: r.material_name,
          stages: [],
        };
      map[r.material_id].stages.push(r);
      if (r.fecha_inicio)
        min = Math.min(min, new Date(r.fecha_inicio).getTime());
      if (r.fecha_fin) max = Math.max(max, new Date(r.fecha_fin).getTime());
    }
    const today = new Date(new Date().toDateString()).getTime();
    if (!isFinite(min)) min = today - 30 * DAY;
    if (!isFinite(max)) max = today + 30 * DAY;
    max = Math.max(max, today);
    min = Math.min(min, today - 14 * DAY);
    return {
      groups: Object.values(map).sort((a, b) =>
        a.materialName.localeCompare(b.materialName),
      ),
      minTs: min,
      maxTs: max,
      todayTs: today,
    };
  }, [rows]);

  const span = maxTs - minTs || DAY;
  const pct = (ts: number) => ((ts - minTs) / span) * 100;
  const monthTicks = useMemo(() => {
    const out: { ts: number; label: string }[] = [];
    const d = new Date(minTs);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() <= maxTs) {
      out.push({
        ts: d.getTime(),
        label: d.toLocaleDateString("es-ES", {
          month: "short",
          year: "2-digit",
        }),
      });
      d.setMonth(d.getMonth() + (zoom === "weeks" ? 1 : 2));
    }
    return out;
  }, [minTs, maxTs, zoom]);

  if (groups.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-[12px] border border-dashed border-[#DBDBDB] bg-[#F8F9FA]/60 text-sm text-muted-foreground"
        style={{ height }}
      >
        Aún no hay datos suficientes
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#0E1E2A]">Zoom:</span>
        {(["weeks", "months"] as const).map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              zoom === z
                ? "bg-[#E37439] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {z === "weeks" ? "Semanas" : "Meses"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#DBDBDB] bg-white">
        <div className="min-w-[760px]" style={{ minHeight: height }}>
          {/* Timeline header */}
          <div className="relative h-7 border-b border-[#DBDBDB] bg-[#F8F9FA]/60">
            {monthTicks.map((t) => (
              <div
                key={t.ts}
                className="absolute top-0 h-full border-l border-[#DBDBDB] px-1.5 text-[10px] font-semibold text-muted-foreground flex items-center"
                style={{ left: `${pct(t.ts)}%` }}
              >
                {t.label}
              </div>
            ))}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-px bg-[#D64545]"
                style={{ left: `${pct(todayTs)}%` }}
              />
            )}
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#DBDBDB]">
            {groups.map((g, gi) => {
              const fechaC = fechaComprometidaMap[g.materialId] ?? null;
              return (
                <div
                  key={g.materialId}
                  className="flex items-stretch hover:bg-muted/30"
                  style={{
                    height: Math.max(34, (height - 28) / groups.length),
                  }}
                >
                  <div className="w-[180px] shrink-0 truncate border-r border-[#DBDBDB] px-3 py-1.5 text-xs font-semibold text-[#0E1E2A]">
                    <Link
                      to={`/materials/${g.materialId}`}
                      className="hover:text-[#E37439]"
                      title={g.materialName}
                    >
                      {g.materialName}
                    </Link>
                  </div>
                  <div className="relative flex-1 bg-[#F8F9FA]/30">
                    {g.stages.map((s, si) => {
                      const start = s.fecha_inicio
                        ? new Date(s.fecha_inicio).getTime()
                        : null;
                      const end = s.fecha_fin
                        ? new Date(s.fecha_fin).getTime()
                        : null;
                      if (!start || !end) return null;
                      const left = pct(start);
                      const width = Math.max(1.5, pct(end) - left);
                      const color = colorFor(si);
                      return (
                        <div
                          key={`${gi}-${si}`}
                          title={`${s.material_name} · ${statusShortLabel(
                            s.status as MaterialStatus,
                          )} · ${formatDate(s.fecha_inicio)} → ${formatDate(
                            s.fecha_fin,
                          )} (${s.dias ?? 0}d)`}
                          className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[3px] transition-all hover:h-4"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: color,
                          }}
                        />
                      );
                    })}
                    {fechaC && (
                      <div
                        className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-sm"
                        style={{
                          left: `${pct(new Date(fechaC).getTime())}%`,
                          backgroundColor: SPARK_COLORS.red,
                        }}
                        title={`Fecha comprometida: ${formatDate(fechaC)}`}
                      />
                    )}
                    {showToday && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-[#D64545]/40"
                        style={{ left: `${pct(todayTs)}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
