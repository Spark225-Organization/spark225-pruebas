import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function SectionTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center gap-3", className)}>
      <h2 className="text-[13px] font-semibold text-[#4E5964]">{title}</h2>
      <div className="h-px flex-1 bg-[#E4E7EC]" />
    </div>
  );
}

export function CompactChip({
  label,
  value,
  suffix,
  tone,
  to,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone: "red" | "amber" | "green" | "slate";
  to?: string;
}) {
  const toneDot: Record<string, string> = {
    red: "bg-[#D64545]",
    amber: "bg-[#F5C245]",
    green: "bg-[#2E9E5B]",
    slate: "bg-[#9AA4B2]",
  };
  const inner = (
    <div className="flex items-center gap-2.5 rounded-[12px] border border-[#E4E7EC] bg-white px-3.5 py-2.5 transition-colors hover:border-[#E37439]/40">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-[#4E5964]">{label}</p>
        <p className="text-base font-semibold tabular-nums leading-tight text-[#0F1B2D]">
          {value}
          {suffix && (
            <span className="ml-0.5 text-xs font-semibold text-[#4E5964]">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
