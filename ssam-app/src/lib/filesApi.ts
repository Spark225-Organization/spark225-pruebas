// Archivos multimedia. Esquema real:
//  - `files` (id, material_id, nombre, tipo, created_at): cabecera por archivo.
//  - `file_versions` (id, file_id, version_number, storage_path, visibilidad,
//    es_final): cada carga nueva crea una versión; la vigente es es_final=true
//    (o la de mayor version_number).
// La UI usa StoredFile (storage.ts) con name/version/uploadedAt; el driver de
// storage lee `files` + `file_versions` y los mapea.

import { supabase } from "@/lib/supabase";
import type { FileAsset } from "@/lib/api-types";

export const filesApi = {
  async list(materialId: string) {
    const { data, error } = await supabase
      .from("files")
      .select(
        "id, material_id, nombre, tipo, created_at, file_versions(id, file_id, version_number, storage_path, visibilidad, es_final)",
      )
      .eq("material_id", materialId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    // Aplana files + su última versión vigente a FileAsset.
    const rows: FileAsset[] = (data ?? []).flatMap((f: any) => {
      const vs: any[] = Array.isArray(f.file_versions) ? f.file_versions : [];
      const vigente =
        vs.find((v) => v.es_final) ??
        [...vs].sort((a, b) => b.version_number - a.version_number)[0];
      return vigente
        ? [
            {
              id: vigente.id,
              material_id: f.material_id,
              file_name:
                f.nombre ?? vigente.storage_path?.split("/").pop() ?? "archivo",
              file_type: f.tipo ?? "other",
              file_url: vigente.storage_path ?? "#",
              version: vigente.version_number ?? 1,
              uploaded_by: "",
              uploaded_at: f.created_at ?? new Date().toISOString(),
            } as FileAsset,
          ]
        : [];
    });
    return { data: rows, error: null };
  },
  async create(payload: Partial<FileAsset>) {
    // La creación real de files + file_versions la hace StorageService.upload.
    const { data, error } = await supabase
      .from("files")
      .insert({
        material_id: payload.material_id,
        nombre: payload.file_name,
        tipo: payload.file_type,
      })
      .select()
      .single();
    return { data: data as FileAsset, error: error?.message ?? null };
  },
};
