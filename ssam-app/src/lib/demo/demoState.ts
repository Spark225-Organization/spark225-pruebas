// Modo demo del portal (solo sitio de pruebas).
// Con VITE_SSAM_DEMO === "1" la app no usa Supabase: trabaja con una base
// ficticia en el navegador y se entra eligiendo un rol, sin contraseña.
// En materiales.spark225.com esta variable no existe y todo funciona con el
// login y la base reales.

export const DEMO = import.meta.env.VITE_SSAM_DEMO === "1";

export type DemoRol = "admin" | "client";

const CLAVE_ROL = "ssam-demo-rol";

export function rolDemo(): DemoRol | null {
  try {
    const v = localStorage.getItem(CLAVE_ROL);
    return v === "admin" || v === "client" ? v : null;
  } catch {
    return null;
  }
}

export function guardarRolDemo(rol: DemoRol | null) {
  try {
    if (rol) localStorage.setItem(CLAVE_ROL, rol);
    else localStorage.removeItem(CLAVE_ROL);
  } catch {
    /* sin almacenamiento: el rol dura lo que la pestaña */
  }
}

// Ids fijos de las dos cuentas demo (existen en la base ficticia).
export const DEMO_ADMIN_ID = "d0000000-0000-4000-8000-000000000001";
export const DEMO_CLIENTE_ID = "d0000000-0000-4000-8000-000000000002";
export const DEMO_CLIENTE_EMPRESA = "c0000000-0000-4000-8000-000000000001";

/** Entra con un rol y recarga la app en la pantalla que le toca. */
export function entrarDemo(rol: DemoRol) {
  guardarRolDemo(rol);
  const base = import.meta.env.BASE_URL || "/";
  window.location.assign(base + (rol === "client" ? "portal" : ""));
}

/** Sale del rol y vuelve a la pantalla de elección. */
export function salirDemo() {
  guardarRolDemo(null);
  const base = import.meta.env.BASE_URL || "/";
  window.location.assign(base + "login");
}
