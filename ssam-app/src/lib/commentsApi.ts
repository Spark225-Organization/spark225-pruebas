// Comentarios colaborativos. Esquema real: tabla `comments`
// (id, material_id, texto, autor_id, visibilidad[enum interno|visible_para_cliente],
//  parent_id, version_id, requiere_cambio, estado, created_at).
// La UI usa body/author_name/interno; mapeamos texto→body, autor_id→author_id,
// visibilidad→interno (interno=true ⟺ visibilidad='interno'). El cliente solo
// ve los visible_para_cliente (RLS + filtro en el portal).

import { supabase } from "@/lib/supabase";
import type { Comment } from "@/lib/api-types";

export const commentsApi = {
  async list(materialId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles!comments_autor_id_fkey(nombre)")
      .eq("material_id", materialId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    const rows: Comment[] = (data ?? []).map((r: any) => ({
      ...r,
      body: r.texto,
      author_id: r.autor_id,
      author_name: r.profiles?.nombre ?? "Usuario",
      interno: r.visibilidad === "interno",
      visibilidad: r.visibilidad ?? null,
      parent_id: r.parent_id ?? null,
      version_id: r.version_id ?? null,
      requiere_cambio: r.requiere_cambio ?? null,
      estado: r.estado ?? null,
    }));
    return { data: rows, error: null };
  },

  async create(payload: Partial<Comment>) {
    const dbPayload: any = { material_id: payload.material_id };
    if (payload.body != null) dbPayload.texto = payload.body;
    if (payload.author_id != null) dbPayload.autor_id = payload.author_id;
    dbPayload.visibilidad =
      payload.interno === true ? "interno" : "visible_para_cliente";
    if (payload.parent_id != null) dbPayload.parent_id = payload.parent_id;
    if (payload.version_id != null) dbPayload.version_id = payload.version_id;
    if (payload.requiere_cambio != null)
      dbPayload.requiere_cambio = payload.requiere_cambio;
    if (payload.adjunto_name != null)
      dbPayload.adjunto_name = payload.adjunto_name;
    if (payload.adjunto_url != null)
      dbPayload.adjunto_url = payload.adjunto_url;
    const { data, error } = await supabase
      .from("comments")
      .insert(dbPayload)
      .select("*, profiles!comments_autor_id_fkey(nombre)")
      .single();
    if (error) return { data: null, error: error.message };
    return {
      data: {
        ...(data as any),
        body: (data as any).texto,
        author_id: (data as any).autor_id,
        author_name: (data as any).profiles?.nombre ?? "Usuario",
        interno: (data as any).visibilidad === "interno",
        visibilidad: (data as any).visibilidad ?? null,
      } as Comment,
      error: null,
    };
  },

  /** Lectura ligera de TODOS los comentarios (RLS-scoped) para el badge
   *  "comentario nuevo del cliente" en Kanban/Materiales. */
  async allForBadge() {
    const { data, error } = await supabase
      .from("comments")
      .select("id, material_id, texto, autor_id, visibilidad, created_at")
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    const rows: Comment[] = (data ?? []).map((r: any) => ({
      ...r,
      body: r.texto,
      author_id: r.autor_id,
      author_name: r.autor_id ?? "Usuario",
      interno: r.visibilidad === "interno",
      visibilidad: r.visibilidad ?? null,
    }));
    return { data: rows, error: null };
  },
};
