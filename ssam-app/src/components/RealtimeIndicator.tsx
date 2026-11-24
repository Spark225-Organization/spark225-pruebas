import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { operacionQueryKey, useRealtimeStatus } from "@/data/operacion";
import { cn } from "@/lib/utils";

function agoText(secs: number): string {
  if (secs < 5) return "ahora";
  if (secs < 60) return `hace ${secs} s`;
  const m = Math.floor(secs / 60);
  return `hace ${m} min`;
}

/** Indicador "Actualizado hace X s" + estado de la conexión Realtime. */
export function RealtimeIndicator() {
  const qc = useQueryClient();
  const status = useRealtimeStatus();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const state = qc.getQueryState(operacionQueryKey);
  const updatedMs = state?.dataUpdatedAt ?? 0;
  const ago = updatedMs
    ? Math.max(0, Math.floor((Date.now() - updatedMs) / 1000))
    : null;

  if (status === "disconnected") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-[#D64545]/30 bg-[#D64545]/10 px-2.5 py-1 text-[11px] font-semibold text-[#D64545]"
        title="Se perdió la conexión en vivo. Los datos se refrescan al volver la señal."
        aria-live="polite"
      >
        <WifiOff className="h-3.5 w-3.5" />
        Sin conexión en vivo
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7EC] bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-medium text-[#9AA4B2]"
        aria-live="polite"
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Sincronizando…
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7EC] bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-medium text-[#4E5964]"
      aria-live="polite"
      title={`Última sincronización: ${ago != null ? agoText(ago) : "—"}`}
    >
      <Wifi className={cn("h-3.5 w-3.5 text-[#2E9E5B]")} />
      Actualizado {ago != null ? agoText(ago) : "—"}
    </span>
  );
}
