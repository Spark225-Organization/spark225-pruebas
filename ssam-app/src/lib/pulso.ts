// «Pulso»: avisa a las pantallas que deben volver a leer lo que no está en la
// copia general (archivos, decisiones del cliente, mensajes). Late cuando:
//  - alguien guarda algo en esta pestaña (avisarCambio),
//  - otra pestaña o la base en vivo cambió algo («ssam-datos-cambiaron»),
//  - el usuario regresa a la pestaña, y cada 45 s mientras está a la vista.
import { useEffect, useState } from "react";

const subs = new Set<() => void>();
export const EVENTO_CAMBIO = "ssam-datos-cambiaron";

export function avisarCambio() {
  for (const f of subs) f();
}

/** Número que sube con cada pulso: úsalo como dependencia de un useEffect. */
export function usePulso(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    // Varios avisos seguidos se juntan en uno.
    const latir = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setN((x) => x + 1), 250);
    };
    const alVolver = () => document.visibilityState === "visible" && latir();
    subs.add(latir);
    window.addEventListener(EVENTO_CAMBIO, latir);
    window.addEventListener("focus", latir);
    document.addEventListener("visibilitychange", alVolver);
    const reloj = setInterval(alVolver, 45_000);
    return () => {
      subs.delete(latir);
      window.removeEventListener(EVENTO_CAMBIO, latir);
      window.removeEventListener("focus", latir);
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(reloj);
      if (t) clearTimeout(t);
    };
  }, []);
  return n;
}
