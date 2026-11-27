// Correcciones del cliente como pendientes (idea de PageProof / Veeva):
// cada corrección que pide el cliente al rechazar es un «punto» que Paco
// marca como hecho. No se puede reenviar al cliente con puntos abiertos, y el
// cliente ve en la versión nueva qué se atendió.
//
// Se guardan en `comments` (columnas que ya trae la base): requiere_cambio=true,
// parent_id = comentario del rechazo, version_id = versión rechazada,
// estado 'abierto' | 'resuelto', resuelto_por, resuelto_at,
// resuelto_en_version_id (la versión que se envió con el arreglo).
import { supabase } from "@/lib/supabase";
import { avisarCambio } from "@/lib/pulso";

export type Punto = {
  id: string;
  material_id: string;
  parent_id: string;
  texto: string;
  estado: "abierto" | "resuelto";
  version_id: string | null;
  resuelto_por: string | null;
  resuelto_at: string | null;
  resuelto_en_version_id: string | null;
  created_at: string;
};

/** ¿Este comentario es un punto de corrección? (no se muestra en la conversación) */
export const esPunto = (c: { parent_id?: string | null; requiere_cambio?: boolean | null }) => !!c.parent_id && c.requiere_cambio === true;

/**
 * Separa lo que escribió el cliente en puntos: cada «1.», «2.»… (notas sobre la
 * pieza) es uno; sin numeración, cada renglón es uno.
 */
export function separarPuntos(texto: string): string[] {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const numerada = (l: string) => /^\d+[.)]\s*/.test(l);
  if (!lineas.some(numerada)) return lineas;
  const out: string[] = [];
  for (const l of lineas) {
    if (numerada(l) || !out.length) out.push(l.replace(/^\d+[.)]\s*/, ""));
    else out[out.length - 1] += " " + l;
  }
  return out.filter(Boolean);
}

const COLS = "id, material_id, parent_id, texto, estado, version_id, resuelto_por, resuelto_at, resuelto_en_version_id, created_at, requiere_cambio";

function aPunto(r: any): Punto {
  return {
    id: r.id,
    material_id: r.material_id,
    parent_id: r.parent_id,
    texto: String(r.texto ?? ""),
    estado: r.estado === "resuelto" ? "resuelto" : "abierto",
    version_id: r.version_id ?? null,
    resuelto_por: r.resuelto_por ?? null,
    resuelto_at: r.resuelto_at ?? null,
    resuelto_en_version_id: r.resuelto_en_version_id ?? null,
    created_at: r.created_at,
  };
}

/** Crea los puntos de un rechazo (los escribe el cliente). */
export async function crearPuntos(materialId: string, rechazoId: string, versionId: string | null, autorId: string, textos: string[]) {
  if (!textos.length) return { error: null as string | null };
  const filas = textos.map((t) => ({
    material_id: materialId,
    parent_id: rechazoId,
    version_id: versionId,
    autor_id: autorId,
    texto: t,
    visibilidad: "visible_para_cliente",
    requiere_cambio: true,
    estado: "abierto",
  }));
  const { error } = await (supabase as any).from("comments").insert(filas);
  return { error: error?.message ?? null };
}

/** Puntos de uno o varios materiales, del más viejo al más nuevo. */
export async function listarPuntos(materialIds?: string[]): Promise<Punto[]> {
  let q = (supabase as any).from("comments").select(COLS).eq("requiere_cambio", true).not("parent_id", "is", null);
  if (materialIds) {
    if (!materialIds.length) return [];
    q = q.in("material_id", materialIds);
  }
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as any[]).filter(esPunto).map(aPunto);
}

/**
 * Los puntos que importan ahora: los del último rechazo y cualquiera anterior
 * que siga abierto.
 */
export function puntosVigentes(puntos: Punto[]): Punto[] {
  if (!puntos.length) return [];
  const ultimo = puntos.reduce((a, b) => (b.created_at > a.created_at ? b : a)).parent_id;
  return puntos.filter((p) => p.parent_id === ultimo || p.estado === "abierto");
}

/** Paco marca (o desmarca) un punto como hecho. */
export async function marcarPunto(id: string, hecho: boolean, userId: string) {
  const cambio = hecho
    ? { estado: "resuelto", resuelto_por: userId, resuelto_at: new Date().toISOString() }
    : { estado: "abierto", resuelto_por: null, resuelto_at: null, resuelto_en_version_id: null };
  const { data, error } = await (supabase as any).from("comments").update(cambio).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!(data ?? []).length) return { error: "La base no permitió actualizar la corrección (falta el permiso del SQL 07)." };
  avisarCambio();
  return { error: null as string | null };
}

/** Al enviar al cliente: los puntos hechos quedan ligados a la versión enviada. */
export async function cerrarEnVersion(ids: string[], versionId: string | null) {
  if (!ids.length || !versionId) return;
  await (supabase as any).from("comments").update({ resuelto_en_version_id: versionId }).in("id", ids);
}
