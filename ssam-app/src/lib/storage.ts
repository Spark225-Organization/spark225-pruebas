/**
 * SSAM Storage Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Driver: Supabase Storage (Cloud Persistence)
 */
import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileCategory = "pdf" | "image" | "link" | "audio" | "other";

export interface StoredFile {
  id: string;
  materialId: string;
  name: string;
  category: FileCategory;
  size: number; // bytes
  mimeType: string;
  stage: string; // which workflow stage this file belongs to
  uploadedBy: string; // user id
  uploadedByName: string;
  uploadedAt: string; // ISO date
  version: number;
  parentVersionId?: string; // links to previous version
  notes?: string;
  /** For "link" category — URL instead of binary */
  externalUrl?: string;
  /** Cloud URL — used by external storage drivers */
  cloudUrl?: string;
  /** ¿El cliente puede verla? (file_versions.visibilidad = visible_para_cliente) */
  visibleCliente?: boolean;
}

export interface UploadOptions {
  file?: File;
  externalUrl?: string;
  materialId: string;
  stage: string;
  uploadedBy: string;
  uploadedByName: string;
  notes?: string;
  /** If provided, creates a new version linked to this file */
  newVersionOf?: string;
  /** Que el cliente la vea desde ya. Si no, queda interna hasta «Enviar al cliente». */
  visibleCliente?: boolean;
}

// ─── Storage Driver Interface ────────────────────────────────────────────────

interface StorageDriver {
  upload(opts: UploadOptions): Promise<StoredFile>;
  list(materialId: string): Promise<StoredFile[]>;
  delete(fileId: string): Promise<void>;
  getUrl(file: StoredFile): string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function detectCategory(mimeType: string, name: string): FileCategory {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (name.startsWith("http://") || name.startsWith("https://")) return "link";
  return "other";
}

// ─── Supabase Driver ─────────────────────────────────────────────────────────
// Esquema real: `files` (cabecera por archivo) + `file_versions` (una fila por
// versión, con storage_path en el bucket privado `material-files`). Las reglas
// (RLS) deciden quién ve qué: el cliente solo ve versiones visibles/finales de
// sus materiales. Las URLs se firman por 1 hora (el bucket es privado).

const BUCKET = "material-files";
const FIRMA_SEG = 60 * 60;
const esLink = (p?: string) => !!p && /^https?:\/\//i.test(p);
const nombreSeguro = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]+/g, "_").slice(0, 120);

const supabaseDriver: StorageDriver = {
  async upload(opts) {
    let fileId: string;
    let version = 1;
    let parentVersionId: string | undefined;
    const name = opts.file?.name || opts.externalUrl || "archivo";
    const mimeType =
      opts.file?.type || (opts.externalUrl ? "text/uri-list" : "application/octet-stream");

    if (opts.newVersionOf) {
      // newVersionOf es el id de una versión: se agrega otra versión al mismo archivo.
      const { data: prev, error } = await supabase
        .from("file_versions")
        .select("id, file_id")
        .eq("id", opts.newVersionOf)
        .single();
      if (error || !prev) throw error || new Error("No se encontró la versión anterior");
      fileId = prev.file_id;
      const { data: vs } = await supabase
        .from("file_versions")
        .select("id, version_number")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false })
        .limit(1);
      version = (vs?.[0]?.version_number ?? 0) + 1;
      parentVersionId = vs?.[0]?.id;
    } else {
      const { data: f, error } = await supabase
        .from("files")
        .insert({ material_id: opts.materialId, nombre: name, tipo: mimeType, created_by: opts.uploadedBy })
        .select("id")
        .single();
      if (error || !f) throw error || new Error("No se pudo registrar el archivo");
      fileId = f.id;
    }

    let storagePath = opts.externalUrl || "";
    if (opts.file) {
      storagePath = `${opts.materialId}/${fileId}/v${version}_${nombreSeguro(name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, opts.file, { contentType: mimeType });
      if (error) throw error;
    }

    // La versión nueva queda como vigente.
    if (version > 1) {
      await supabase.from("file_versions").update({ es_final: false }).eq("file_id", fileId);
    }
    const { data: v, error: vError } = await supabase
      .from("file_versions")
      .insert({
        file_id: fileId,
        version_number: version,
        storage_path: storagePath,
        tamano_bytes: opts.file?.size ?? null,
        es_final: true,
        subido_por: opts.uploadedBy,
        // La evidencia que sube el cliente la ven él y el equipo; las piezas del
        // equipo quedan internas hasta que se envían al cliente (o se piden visibles).
        visibilidad: opts.stage === "cambios_cliente" || opts.visibleCliente ? "visible_para_cliente" : "interno",
      })
      .select("id, fecha_carga")
      .single();
    if (vError || !v) throw vError || new Error("No se pudo registrar la versión");

    let cloudUrl: string | undefined;
    if (opts.file) {
      const { data: firmada } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, FIRMA_SEG);
      cloudUrl = firmada?.signedUrl;
    }
    return {
      id: v.id,
      materialId: opts.materialId,
      name,
      category: detectCategory(mimeType, name),
      size: opts.file?.size || 0,
      mimeType,
      stage: opts.stage,
      uploadedBy: opts.uploadedBy,
      uploadedByName: opts.uploadedByName,
      uploadedAt: v.fecha_carga || new Date().toISOString(),
      version,
      parentVersionId,
      notes: opts.notes,
      externalUrl: opts.externalUrl,
      cloudUrl,
      visibleCliente: opts.stage === "cambios_cliente" || !!opts.visibleCliente,
    };
  },

  async list(materialId) {
    const { data, error } = await supabase
      .from("files")
      .select(
        "id, material_id, nombre, tipo, created_at, created_by, file_versions(id, version_number, storage_path, tamano_bytes, visibilidad, es_final, subido_por, fecha_carga)",
      )
      .eq("material_id", materialId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!data) return [];

    const filas: StoredFile[] = [];
    for (const f of data as any[]) {
      const vs: any[] = [...(f.file_versions || [])].sort((a, b) => a.version_number - b.version_number);
      vs.forEach((v, i) => {
        const link = esLink(v.storage_path);
        filas.push({
          id: v.id,
          materialId: f.material_id,
          name: f.nombre,
          category: link ? "link" : detectCategory(f.tipo || "", f.nombre || ""),
          size: v.tamano_bytes || 0,
          mimeType: f.tipo || "application/octet-stream",
          stage: "",
          uploadedBy: v.subido_por || f.created_by || "",
          uploadedByName: "",
          uploadedAt: v.fecha_carga || f.created_at,
          version: v.version_number,
          parentVersionId: i > 0 ? vs[i - 1].id : undefined,
          externalUrl: link ? v.storage_path : undefined,
          cloudUrl: link ? undefined : v.storage_path,
          visibleCliente: v.visibilidad === "visible_para_cliente",
        });
      });
    }
    // Firma en bloque las rutas del bucket (válidas 1 hora).
    const rutas = filas.filter((x) => x.cloudUrl).map((x) => x.cloudUrl as string);
    if (rutas.length) {
      const { data: firmas } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, FIRMA_SEG);
      const porRuta = new Map((firmas || []).map((x: any) => [x.path, x.signedUrl]));
      filas.forEach((x) => { if (x.cloudUrl) x.cloudUrl = porRuta.get(x.cloudUrl) || undefined; });
    }
    return filas.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  },

  async delete(fileId) {
    // fileId es el id de la versión.
    const { data: v } = await supabase
      .from("file_versions")
      .select("id, file_id, storage_path")
      .eq("id", fileId)
      .single();
    if (!v) return;
    if (v.storage_path && !esLink(v.storage_path)) {
      await supabase.storage.from(BUCKET).remove([v.storage_path]);
    }
    await supabase.from("file_versions").delete().eq("id", fileId);
    const { count } = await supabase
      .from("file_versions")
      .select("id", { count: "exact", head: true })
      .eq("file_id", v.file_id);
    if (!count) await supabase.from("files").delete().eq("id", v.file_id);
  },

  getUrl(file) {
    return file.cloudUrl || file.externalUrl || "#";
  },
};

/** Archivos que subió el cliente al revisar (no son «la pieza»). */
export const esEvidenciaCliente = (f: StoredFile) =>
  f.stage === "cambios_cliente" || /^Cambio_cliente_|^Marcas_|^Nota_de_voz_|^Correcciones_/.test(f.name);

// ─── Active Driver ────────────────────────────────────────────────────────────

const ACTIVE_DRIVER: StorageDriver = supabaseDriver;

// ─── Public StorageService API ────────────────────────────────────────────────

export const StorageService = {
  upload: (opts: UploadOptions) => ACTIVE_DRIVER.upload(opts),
  /** Lista los archivos; si falla devuelve [] (para vistas que solo muestran). */
  list: (materialId: string) => ACTIVE_DRIVER.list(materialId).catch(() => [] as StoredFile[]),
  /** Igual que list, pero avisa si falló: para decisiones que dependen de la versión. */
  listStrict: (materialId: string) => ACTIVE_DRIVER.list(materialId),
  delete: (fileId: string) => ACTIVE_DRIVER.delete(fileId),
  getUrl: (file: StoredFile) => ACTIVE_DRIVER.getUrl(file),

  /**
   * Publica al cliente la versión más reciente de cada pieza del material
   * (las evidencias del cliente no cuentan). Se llama al «Enviar al cliente»:
   * así lo que sube Paco siempre llega a la revisión. Devuelve las versiones
   * publicadas.
   */
  async publicar(materialId: string): Promise<{ publicadas: StoredFile[]; error: string | null }> {
    let fs: StoredFile[];
    try {
      fs = await ACTIVE_DRIVER.list(materialId);
    } catch (e: any) {
      return { publicadas: [], error: e?.message ?? "No se pudieron leer los archivos." };
    }
    const ultimas = new Map<string, StoredFile>();
    for (const f of fs) {
      if (esEvidenciaCliente(f) || f.category === "link") continue;
      const a = ultimas.get(f.name);
      if (!a || f.version > a.version) ultimas.set(f.name, f);
    }
    const ocultas = [...ultimas.values()].filter((f) => !f.visibleCliente);
    if (ocultas.length) {
      const { data, error } = await supabase
        .from("file_versions")
        .update({ visibilidad: "visible_para_cliente" })
        .in("id", ocultas.map((f) => f.id))
        .select("id");
      if (error) return { publicadas: [], error: `No se pudo mostrar la versión al cliente: ${error.message}` };
      // Si las reglas de la base no dejan cambiarla, no hay error pero tampoco filas.
      if ((data ?? []).length < ocultas.length)
        return { publicadas: [], error: "La base no permitió mostrar la versión al cliente (falta el permiso del SQL 07)." };
    }
    return { publicadas: [...ultimas.values()], error: null };
  },

  /** Returns all versions of a file (sorted oldest→newest) */
  async getVersionHistory(
    fileId: string,
    materialId: string,
  ): Promise<StoredFile[]> {
    const all = await ACTIVE_DRIVER.list(materialId).catch(() => [] as StoredFile[]);
    const target = all.find((f) => f.id === fileId);
    if (!target) return [];

    const chain: StoredFile[] = [target];
    let current = target;
    while (current.parentVersionId) {
      const parent = all.find((f) => f.id === current.parentVersionId);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  },

  /** Returns storage usage summary for a material */
  async getStorageSummary(materialId: string) {
    const files = await ACTIVE_DRIVER.list(materialId).catch(() => [] as StoredFile[]);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    return {
      fileCount: files.length,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      byCategory: files.reduce(
        (acc, f) => {
          acc[f.category] = (acc[f.category] || 0) + 1;
          return acc;
        },
        {} as Record<FileCategory, number>,
      ),
    };
  },

  /** Global stats for reports dashboard */
  async getGlobalStats() {
    const { data, error } = await supabase
      .from("files")
      .select("material_id, file_versions(tamano_bytes)");

    if (error || !data) return { totalFiles: 0, totalBytes: 0, byMaterial: {} };

    return {
      totalFiles: data.length,
      totalBytes: data.reduce(
        (acc: number, f: any) => acc + (f.file_versions || []).reduce((s: number, v: any) => s + (v.tamano_bytes || 0), 0),
        0,
      ),
      byMaterial: data.reduce(
        (acc: Record<string, number>, f: any) => {
          acc[f.material_id] = (acc[f.material_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  },

  formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },
};
