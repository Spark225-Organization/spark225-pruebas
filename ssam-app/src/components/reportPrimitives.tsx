import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { SPARK_COLORS } from "@/lib/chartTheme";

export const EmptyReport = ({
  title = "Aún no hay datos suficientes",
  desc,
}: {
  title?: string;
  desc?: string;
}) => (
  <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#DBDBDB] bg-[#F8F9FA]/60 p-8 text-center">
    <div className="rounded-full bg-muted p-3">
      <Inbox className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="text-sm font-bold text-[#0E1E2A]">{title}</p>
    {desc && <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>}
  </div>
);

export const KpiCard = ({
  label,
  value,
  suffix,
  delta,
  deltaLabel,
  icon: Icon,
  spark,
  tone = "navy",
  sub,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ElementType;
  spark?: number[];
  tone?: "navy" | "primary" | "amber" | "green" | "red" | "slate";
  sub?: string;
}) => {
  const toneMap: Record<string, string> = {
    navy: "bg-[#0E1E2A]/10 text-[#0E1E2A]",
    primary: "bg-[#E37439]/10 text-[#E37439]",
    amber: "bg-[#F5C245]/15 text-[#B5840A]",
    green: "bg-[#2E9E5B]/12 text-[#2E9E5B]",
    red: "bg-[#D64545]/12 text-[#D64545]",
    slate: "bg-[#4E5964]/10 text-[#4E5964]",
  };
  const up = (delta ?? 0) >= 0;
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  return (
    <Card className="border border-[#DBDBDB] shadow-soft transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className="text-2xl font-extrabold text-[#0E1E2A]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                {value}
              </span>
              {suffix && (
                <span className="text-sm font-semibold text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
            {sub && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("rounded-lg p-2", toneMap[tone])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                up
                  ? "bg-[#2E9E5B]/12 text-[#2E9E5B]"
                  : "bg-[#D64545]/12 text-[#D64545]",
              )}
            >
              {up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {up ? "+" : ""}
              {delta}%
              {deltaLabel && (
                <span className="font-medium text-muted-foreground">
                  {deltaLabel}
                </span>
              )}
            </span>
          )}
          {sparkData.length > 1 && (
            <div className="h-8 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line
                    dataKey="v"
                    stroke={SPARK_COLORS.primary}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export function exportCsv(
  filename: string,
  rows: Record<string, ReactNode | null | undefined>[],
) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
