// Realtime + BroadcastChannel: copia viva entre pestañas.
// Suscribe postgres_changes a las tablas base y, ante cualquier cambio,
// refresca ["operacion"] con debounce de 300 ms. BroadcastChannel sincroniza
// entre pestañas del mismo navegador.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateOperacion } from "./operacion";

export type RtStatus = "connecting" | "connected" | "disconnected";

const REALTIME_TABLES = [
  "materials",
  "status_history",
  "comments",
  "commitment_date_changes",
  "candado_events",
  "regulatory_reviews",
  "clients",
  "products",
  "indications",
  "business_units",
  "profiles",
  // Para que el cliente vea al momento la versión que sube Paco y Paco la decisión del cliente.
  "files",
  "file_versions",
  "approvals",
];

const listeners = new Set<(s: RtStatus) => void>();
let rtStatus: RtStatus = "connecting";
let rtChannel: ReturnType<typeof supabase.channel> | null = null;
let rtTimer: ReturnType<typeof setTimeout> | null = null;
let bc: BroadcastChannel | null = null;

function notify() {
  for (const l of listeners) l(rtStatus);
}

function scheduleRefresh() {
  if (rtTimer) clearTimeout(rtTimer);
  rtTimer = setTimeout(() => {
    // Cada pestaña recibe su propio aviso en vivo; no hace falta reenviarlo.
    invalidateOperacion();
  }, 300);
}

/** Inicia la suscripción Realtime única + el BroadcastChannel de pestañas. */
export function startRealtime() {
  if (rtChannel) return;
  try {
    bc = new BroadcastChannel("spark225-operacion");
    bc.onmessage = (ev) => {
      if (ev.data === "refresh") invalidateOperacion();
    };
  } catch {
    bc = null;
  }
  let ch = supabase.channel("spark225-operacion-rt");
  for (const table of REALTIME_TABLES) {
    ch = ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      scheduleRefresh,
    );
  }
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") rtStatus = "connected";
    else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    )
      rtStatus = "disconnected";
    else rtStatus = "connecting";
    notify();
  });
  rtChannel = ch;
}

export function stopRealtime() {
  if (rtTimer) {
    clearTimeout(rtTimer);
    rtTimer = null;
  }
  if (rtChannel) {
    supabase.removeChannel(rtChannel);
    rtChannel = null;
  }
  bc?.close();
  bc = null;
  rtStatus = "disconnected";
  notify();
}

/** Hook que expone el estado de la conexión Realtime (arranca el singleton). */
export function useRealtimeStatus(): RtStatus {
  const [s, setS] = useState<RtStatus>(rtStatus);
  useEffect(() => {
    listeners.add(setS);
    if (!rtChannel) startRealtime();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
