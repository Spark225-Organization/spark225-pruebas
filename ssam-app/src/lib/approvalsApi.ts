// Aprobaciones (registro inmutable). Esquema real: tabla `approvals`
// (id, material_id, stage, decision, approver_id, comentario, version_id,
//  created_at). version_id se añade con scripts/fase_real.sql.
// Solo INSERT + SELECT (inmutable). El avance/regreso de etapa lo hace el RPC
// client_decision (registrando la transición en status_history).

import { supabase } from "@/lib/supabase";
import type { Approval } from "@/lib/api-types";

export const approvalsApi = {
  /** Historial inmutable de decisiones (aprobar / solicitar cambios). */
  async list(materialId: string) {
    const { data, error } = await supabase
      .from("approvals")
      .select(
        "id, material_id, stage, decision, approver_id, comentario, version_id, created_at, profiles!approvals_approver_id_fkey(nombre)",
      )
      .eq("material_id", materialId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    const rows: Approval[] = (data ?? []).map((r: any) => ({
      id: r.id,
      material_id: r.material_id,
      stage: r.stage ?? null,
      // La base guarda approved / changes_requested / rejected; la app usa aprobado / cambios.
      decision: r.decision === "aprobado" || r.decision === "approved" ? "aprobado" : "cambios",
      approver_id: r.approver_id ?? null,
      usuario_name: r.profiles?.nombre ?? null,
      comentario: r.comentario ?? null,
      version_id: r.version_id ?? null,
      created_at: r.created_at,
    }));
    return { data: rows, error: null };
  },

  /**
   * Decisión del cliente: 'aprobado' avanza la etapa; 'cambios' regresa a
   * desarrollo. Solo válido en etapas de aprobación de cliente. El RPC deja
   * el registro inmutable en approvals + la transición en status_history.
   * version_id es opcional hasta que fase_real.sql añada la columna.
   */
  async clientDecision(
    materialId: string,
    decision: "aprobado" | "cambios",
    versionId: string | null,
    comentario: string,
  ) {
    const { error } = await supabase.rpc("client_decision", {
      p_material_id: materialId,
      p_decision: decision,
      p_version_id: versionId,
      p_comentario: comentario,
    });
    return { error: error?.message ?? null };
  },
};
