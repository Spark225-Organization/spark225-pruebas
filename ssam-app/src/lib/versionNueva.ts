// GitHub Pages guarda la página hasta 10 minutos en el navegador: después de
// publicar, la gente seguía viendo la versión anterior. Aquí se compara el
// archivo principal publicado con el que está corriendo; si cambió, la página
// se recarga sola (una vez por versión) al abrirla o al volver a la pestaña.
const base = import.meta.env.BASE_URL || "/";

function principalActual(): string | null {
  const s = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].find((x) => /\/assets\/index-[^/]+\.js$/.test(x.src));
  return s ? new URL(s.src).pathname.split("/").pop() ?? null : null;
}

async function revisar() {
  const actual = principalActual();
  if (!actual) return; // modo desarrollo
  try {
    const r = await fetch(`${base}index.html?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const publicado = (await r.text()).match(/assets\/(index-[^"']+\.js)/)?.[1];
    if (!publicado || publicado === actual) return;
    const clave = "ssam-recargado-para";
    if (sessionStorage.getItem(clave) === publicado) return; // evita ciclos
    sessionStorage.setItem(clave, publicado);
    window.location.reload();
  } catch {
    /* sin red: se queda la versión actual */
  }
}

export function vigilarVersionNueva() {
  revisar();
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && revisar());
  window.setInterval(revisar, 5 * 60 * 1000);
}
