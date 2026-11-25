import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ─── Role Definitions ────────────────────────────────────────────────────────

export type Role = "admin" | "medical" | "creative" | "veeva" | "client";

/**
 * Normaliza el valor de `profiles.rol` al rol interno de la app.
 * El esquema usa claves en español (cliente, creativo, medico, veeva) o
 * nombres completos (administrador). Aquí se unifican a las claves canónicas
 * (admin, medical, creative, veeva, client) que usan ROLE_LABELS/PERMISSIONS.
 * Cualquier valor desconocido cae a "client" (acceso mínimo por defecto).
 */
export function normalizeRol(raw: string | null | undefined): Role {
  if (!raw) return "client";
  const v = String(raw).toLowerCase().trim();
  if (
    v === "admin" ||
    v === "administrador" ||
    v === "administradora" ||
    v === "administración"
  )
    return "admin";
  if (v === "medical" || v === "medico" || v === "médico" || v === "scientific")
    return "medical";
  if (
    v === "creative" ||
    v === "creativo" ||
    v === "creativa" ||
    v === "diseno" ||
    v === "diseño"
  )
    return "creative";
  if (v === "veeva" || v === "ingeniero veeva") return "veeva";
  if (v === "client" || v === "cliente") return "client";
  return "client";
}

export interface RolePermissions {
  dashboard: boolean;
  materials: boolean;
  /** clients tab in sidebar */
  clients: boolean;
  products: boolean;
  indications: boolean;
  team: boolean;
  reports: boolean;
  roles: boolean; // role management page
  /** internal risk view (materiales vencidos + paquetes pendientes) */
  risk: boolean;
  /** internal planning view (forecast, agenda/calendar) */
  planeacion: boolean;
  /** client-facing portal (6-step stepper from client_materials view) */
  clientPortal: boolean;
  /** can change material stage */
  advanceStage: boolean;
  /** can upload files */
  uploadFiles: boolean;
  /** can comment */
  comment: boolean;
  /** can capture/edit fecha_comprometida (creative role) */
  captureFechaComprometida: boolean;
  /** can capture/edit fecha_requerida_cliente (client + admin) */
  captureFechaRequerida: boolean;
  /** can toggle materials.visible_para_cliente (admin + internal roles) */
  toggleVisibleCliente: boolean;
  /** sees only assigned materials (client filter) */
  ownMaterialsOnly: boolean;
  /** can create/delete materials */
  manageMaterials: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  admin: {
    dashboard: true,
    materials: true,
    clients: true,
    products: true,
    indications: true,
    team: true,
    reports: true,
    roles: true,
    risk: true,
    planeacion: true,
    clientPortal: false,
    advanceStage: true,
    uploadFiles: true,
    comment: true,
    captureFechaComprometida: true,
    captureFechaRequerida: true,
    toggleVisibleCliente: true,
    ownMaterialsOnly: false,
    manageMaterials: true,
  },
  medical: {
    dashboard: true,
    materials: true,
    clients: false,
    products: true,
    indications: true,
    team: false,
    reports: true,
    roles: false,
    risk: true,
    planeacion: true,
    clientPortal: false,
    advanceStage: true,
    uploadFiles: true,
    comment: true,
    captureFechaComprometida: false,
    captureFechaRequerida: false,
    toggleVisibleCliente: true,
    ownMaterialsOnly: false,
    manageMaterials: false,
  },
  creative: {
    dashboard: true,
    materials: true,
    clients: false,
    products: true,
    indications: false,
    team: false,
    reports: false,
    roles: false,
    risk: true,
    planeacion: true,
    clientPortal: false,
    advanceStage: true,
    uploadFiles: true,
    comment: true,
    captureFechaComprometida: true,
    captureFechaRequerida: false,
    toggleVisibleCliente: true,
    ownMaterialsOnly: false,
    manageMaterials: false,
  },
  veeva: {
    dashboard: true,
    materials: true,
    clients: false,
    products: true,
    indications: true,
    team: false,
    reports: true,
    roles: false,
    risk: true,
    planeacion: true,
    clientPortal: false,
    advanceStage: false,
    uploadFiles: false,
    comment: false,
    captureFechaComprometida: false,
    captureFechaRequerida: false,
    toggleVisibleCliente: true,
    ownMaterialsOnly: false,
    manageMaterials: false,
  },
  client: {
    dashboard: false,
    materials: false,
    clients: false,
    products: false,
    indications: false,
    team: false,
    reports: false,
    roles: false,
    risk: false,
    planeacion: false,
    clientPortal: true,
    advanceStage: false,
    uploadFiles: false,
    comment: true,
    captureFechaComprometida: false,
    captureFechaRequerida: true,
    toggleVisibleCliente: false,
    ownMaterialsOnly: true,
    manageMaterials: false,
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  medical: "Médico / Scientific",
  creative: "Creativo / Diseño",
  veeva: "Ingeniero Veeva",
  client: "Cliente Externo",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-[#E37439]/12 text-[#E37439] border border-[#E37439]/25",
  medical: "bg-[#0E1E2A]/10 text-[#0E1E2A] border border-[#0E1E2A]/20",
  creative: "bg-[#F5C245]/20 text-[#B5840A] border border-[#F5C245]/40",
  veeva: "bg-[#2E9E5B]/12 text-[#2E9E5B] border border-[#2E9E5B]/25",
  client: "bg-[#4E5964]/12 text-[#4E5964] border border-[#4E5964]/25",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin:
    "Acceso total al sistema. Puede gestionar usuarios, roles, materiales y reportes.",
  medical:
    "Acceso a materiales, indicaciones, productos y reportes. Puede avanzar etapas médicas.",
  creative:
    "Acceso a materiales y productos. Puede avanzar etapas creativas y cargar archivos.",
  veeva:
    "Acceso de consulta a materiales, productos, indicaciones y reportes. Solo lectura en flujo.",
  client:
    "Solo ve los materiales que le han sido habilitados. Acceso de lectura y comentarios.",
};

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  clientId: string | null;
}

interface ProfileRow {
  id: string;
  rol: string | null;
  nombre: string | null;
  cliente_id: string | null;
}

function initials(name: string, email: string): string {
  const base = name || email;
  const parts = base.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function mapUser(su: SupabaseUser, profile: ProfileRow | null): User {
  const email = su.email ?? "";
  const name = profile?.nombre ?? email.split("@")[0] ?? "Usuario";
  // Normalizamos el rol del esquema español a las claves canónicas de la app.
  const role = profile?.rol ? normalizeRol(profile.rol) : "client";
  return {
    id: su.id,
    name,
    email,
    role,
    avatar: initials(name, email),
    clientId: profile?.cliente_id ?? null,
  };
}

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Cuenta autenticada pero sin rol interno ni cliente_id asignado */
  pendingActivation: boolean;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  can: (permission: keyof RolePermissions) => boolean;
  permissions: RolePermissions | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Bypass de login (solo sitio de pruebas) ─────────────────────────────────
// Cuando VITE_SSAM_BYPASS_LOGIN === "1" (lo pone el workflow de GitHub solo en
// pruebas), la app entra directo como admin, sin pasar por Supabase Auth.
// El código real de login de abajo queda intacto: al quitar esa variable
// vuelve a usarse tal cual, cuando conectemos Supabase. NO usar en producción.
const BYPASS_LOGIN = import.meta.env.VITE_SSAM_BYPASS_LOGIN === "1";

// Si se llega desde un correo de invitación o de recuperación, Supabase abre la
// sesión con el token del enlace; aquí se recuerda el tipo para mandar a la
// persona a definir su contraseña. Se lee antes de que Supabase limpie la URL.
const TIPO_LLEGADA = (() => {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return h.get("type");
  } catch {
    return null;
  }
})();
const URL_APP = `${window.location.origin}${import.meta.env.BASE_URL}`;

const BYPASS_ADMIN_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Admin (pruebas)",
  email: "admin@pruebas.local",
  role: "admin",
  avatar: "AD",
  clientId: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(
    BYPASS_LOGIN ? BYPASS_ADMIN_USER : null,
  );
  const [loading, setLoading] = useState(!BYPASS_LOGIN);
  const [pendingActivation, setPendingActivation] = useState(false);

  const loadProfile = useCallback(
    async (session: Session | null): Promise<User | null> => {
      if (!session?.user) {
        setUser(null);
        setPendingActivation(false);
        return null;
      }
      const su = session.user;
      const { data: profile } = (await supabase
        .from("profiles")
        .select("id, rol, nombre, cliente_id")
        .eq("id", su.id)
        .maybeSingle()) as { data: ProfileRow | null };

      // Sin rol interno ni cliente_id -> pendiente de activación.
      // Normalizamos el rol del esquema (cliente/creativo/etc.) a las claves
      // canónicas antes de comparar, así "cliente" no se confunde con un rol
      // interno válido.
      const normalizedRole = profile ? normalizeRol(profile.rol) : null;
      const hasInternalRole =
        normalizedRole !== null &&
        normalizedRole !== "client" &&
        ["admin", "medical", "creative", "veeva"].includes(normalizedRole);
      const hasClient = !!profile?.cliente_id;
      if (profile && !hasInternalRole && !hasClient) {
        setPendingActivation(true);
        setUser(null);
        return null;
      }
      setPendingActivation(false);
      const u = mapUser(su, profile);
      setUser(u);
      return u;
    },
    [],
  );

  useEffect(() => {
    if (BYPASS_LOGIN) return;
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      await loadProfile(session);
      setLoading(false);
      if (session && (TIPO_LLEGADA === "invite" || TIPO_LLEGADA === "recovery") && !window.location.pathname.endsWith("/reset-password")) {
        window.location.replace(`${URL_APP}reset-password`);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  };

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: URL_APP },
    });
    return { error: error?.message ?? null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${URL_APP}reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (BYPASS_LOGIN) {
      setUser(BYPASS_ADMIN_USER);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setPendingActivation(false);
  };

  const permissions = user ? ROLE_PERMISSIONS[user.role] : null;
  const can = (permission: keyof RolePermissions): boolean => {
    if (!permissions) return false;
    return !!permissions[permission];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingActivation,
        signInWithPassword,
        signInWithOtp,
        resetPassword,
        updatePassword,
        signOut,
        can,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
