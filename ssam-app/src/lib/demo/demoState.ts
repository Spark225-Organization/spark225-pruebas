// Modo demo del portal (solo sitio de pruebas).
// Con VITE_SSAM_DEMO === "1" la app no usa Supabase: trabaja con una base
// ficticia en el navegador y se entra eligiendo un rol, sin contraseña.
// En materiales.spark225.com esta variable no existe y todo funciona con el
// login y la base reales.

export const DEMO = import.meta.env.VITE_SSAM_DEMO === "1";

export type DemoRol = "admin" | "client" | "disenador";

const CLAVE_ROL = "ssam-demo-rol";

// El rol y el laboratorio van por pestaña (sessionStorage): así se puede tener
// a Paco en una pestaña y al cliente en otra sin que se mezclen. localStorage
// guarda el último elegido para abrir pestañas nuevas con ese rol.
function leerSesion(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave) ?? localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardarSesion(clave: string, valor: string | null) {
  try {
    if (valor) {
      sessionStorage.setItem(clave, valor);
      localStorage.setItem(clave, valor);
    } else {
      sessionStorage.removeItem(clave);
      localStorage.removeItem(clave);
    }
  } catch {
    /* nada */
  }
}

export function rolDemo(): DemoRol | null {
  try {
    const v = leerSesion(CLAVE_ROL);
    return v === "admin" || v === "client" || v === "disenador" ? v : null;
  } catch {
    return null;
  }
}

export function guardarRolDemo(rol: DemoRol | null) {
  guardarSesion(CLAVE_ROL, rol);
}

// Ids fijos de las dos cuentas demo (existen en la base ficticia).
export const DEMO_ADMIN_ID = "d0000000-0000-4000-8000-000000000001";
export const DEMO_CLIENTE_ID = "d0000000-0000-4000-8000-000000000002";
export const DEMO_CLIENTE_EMPRESA = "c0000000-0000-4000-8000-000000000001";
/** Paco: diseño y cuenta directa con el cliente (rol creativo). */
export const DEMO_DISENADOR_ID = "d0000000-0000-4000-8000-000000000003";
/** Clientes que lleva Paco en la demo (Aurora es la cuenta de cliente de prueba). */
/** Laboratorios ficticios: los tres los lleva Paco. Cada uno tiene su cuenta de cliente demo. */
export const DEMO_LABORATORIOS = [
  { empresa: DEMO_CLIENTE_EMPRESA, perfil: DEMO_CLIENTE_ID, nombre: "Laboratorios Aurora" },
  { empresa: "c0000000-0000-4000-8000-000000000002", perfil: "e1000000-0000-4000-8000-000000000007", nombre: "BioNova Pharma" },
  { empresa: "c0000000-0000-4000-8000-000000000003", perfil: "e1000000-0000-4000-8000-000000000008", nombre: "Farmacéutica Delta" },
];
export const DEMO_CLIENTES_PACO = DEMO_LABORATORIOS.map((l) => l.empresa);

const CLAVE_LAB = "ssam-demo-laboratorio";
/** Laboratorio con el que entra la cuenta de cliente demo. */
export function laboratorioDemo() {
  let id: string | null = null;
  id = leerSesion(CLAVE_LAB);
  return DEMO_LABORATORIOS.find((l) => l.empresa === id) ?? DEMO_LABORATORIOS[0];
}

/** Entra con un rol y recarga la app en la pantalla que le toca. */
export function entrarDemo(rol: DemoRol, empresa?: string) {
  guardarRolDemo(rol);
  if (empresa) guardarSesion(CLAVE_LAB, empresa);
  const base = import.meta.env.BASE_URL || "/";
  window.location.assign(base + (rol === "client" ? "portal" : rol === "disenador" ? "mis-clientes" : ""));
}

/** Sale del rol y vuelve a la pantalla de elección. */
export function salirDemo() {
  guardarRolDemo(null);
  const base = import.meta.env.BASE_URL || "/";
  window.location.assign(base + "login");
}
