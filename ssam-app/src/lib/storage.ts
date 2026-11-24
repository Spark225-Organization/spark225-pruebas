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

const supabaseDriver: StorageDriver = {
  async upload(opts) {
    let version = 1;
    let parentVersionId: string | undefined;

    // Get current files to determine version
    const { data: existingFiles } = await supabase
      .from("ssam_files")
      .select("version, id")
      .eq("materialId", opts.materialId)
      .order("version", { ascending: false });

    if (opts.newVersionOf && existingFiles) {
      const parent = existingFiles.find((f) => f.id === opts.newVersionOf);
      if (parent) {
        version = parent.version + 1;
        parentVersionId = parent.id;
      }
    }

    const id = crypto.randomUUID();
    let cloudUrl: string | undefined;
    let name = opts.file?.name || opts.externalUrl || "unnamed";
    let size = opts.file?.size || 0;
    let mimeType =
      opts.file?.type ||
      (opts.externalUrl ? "text/uri-list" : "application/octet-stream");
    let category = detectCategory(mimeType, name);

    if (opts.file) {
      const filePath = `${opts.materialId}/${id}_${name}`;
      const { data, error } = await supabase.storage
        .from("ssam_materials")
        .upload(filePath, opts.file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("ssam_materials").getPublicUrl(filePath);

      cloudUrl = publicUrl;
    }

    const storedFile: any = {
      id,
      materialId: opts.materialId,
      name,
      category,
      size,
      mimeType,
      stage: opts.stage,
      uploadedBy: opts.uploadedBy,
      uploadedByName: opts.uploadedByName,
      uploadedAt: new Date().toISOString(),
      version,
      parentVersionId,
      notes: opts.notes,
      externalUrl: opts.externalUrl,
      cloudUrl,
    };

    const { error: dbError } = await supabase
      .from("ssam_files")
      .insert(storedFile);

    if (dbError) throw dbError;

    return storedFile as StoredFile;
  },

  async list(materialId) {
    const { data, error } = await supabase
      .from("ssam_files")
      .select("*")
      .eq("materialId", materialId)
      .order("uploadedAt", { ascending: false });

    if (error) return [];
    return data as StoredFile[];
  },

  async delete(fileId) {
    const { data: file } = await supabase
      .from("ssam_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (file?.cloudUrl) {
      const path = file.cloudUrl.split("ssam_materials/")[1];
      if (path) {
        await supabase.storage.from("ssam_materials").remove([path]);
      }
    }

    await supabase.from("ssam_files").delete().eq("id", fileId);
  },

  getUrl(file) {
    return file.cloudUrl || file.externalUrl || "#";
  },
};

// ─── Active Driver ────────────────────────────────────────────────────────────

const ACTIVE_DRIVER: StorageDriver = supabaseDriver;

// ─── Public StorageService API ────────────────────────────────────────────────

export const StorageService = {
  upload: (opts: UploadOptions) => ACTIVE_DRIVER.upload(opts),
  list: (materialId: string) => ACTIVE_DRIVER.list(materialId),
  delete: (fileId: string) => ACTIVE_DRIVER.delete(fileId),
  getUrl: (file: StoredFile) => ACTIVE_DRIVER.getUrl(file),

  /** Returns all versions of a file (sorted oldest→newest) */
  async getVersionHistory(
    fileId: string,
    materialId: string,
  ): Promise<StoredFile[]> {
    const all = await ACTIVE_DRIVER.list(materialId);
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
    const files = await ACTIVE_DRIVER.list(materialId);
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
    const { data, error } = await supabase.from("ssam_files").select("*");

    if (error || !data) return { totalFiles: 0, totalBytes: 0, byMaterial: {} };

    return {
      totalFiles: data.length,
      totalBytes: data.reduce((acc, f) => acc + (f.size || 0), 0),
      byMaterial: data.reduce(
        (acc, f) => {
          acc[f.materialId] = (acc[f.materialId] || 0) + 1;
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
