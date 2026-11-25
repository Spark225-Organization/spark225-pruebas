import { useEffect, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  Music,
  Download,
  Eye,
} from "lucide-react";
import { StorageService, type StoredFile } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  pdf: FileText,
  image: ImageIcon,
  link: Link2,
  audio: Music,
  other: FileText,
};

/**
 * Visor de la versión vigente del archivo de un material (preview de PDF e
 * imagen dentro de la app, con descarga). El cliente ve solo los archivos que
 * RLS le permite leer (los de sus materiales). Cada carga nueva crea una versión
 * (v1, v2, v3…); la vigente es la de mayor versión.
 */
export const FileViewer = ({ materialId }: { materialId: string }) => {
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [selected, setSelected] = useState<StoredFile | null>(null);

  useEffect(() => {
    let active = true;
    StorageService.list(materialId).then((fs) => {
      if (!active) return;
      // La primera es la última que se subió: la misma que se aprueba.
      const sorted = [...fs].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "") || b.version - a.version);
      setFiles(sorted);
      setSelected(sorted[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, [materialId]);

  if (!files) return <Skeleton className="h-48 rounded-[12px]" />;
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#DBDBDB] bg-[#F8F9FA]/60 py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          Sin archivos en este material
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-xs">
          Spark225 cargará aquí las versiones para tu revisión y aprobación.
        </p>
      </div>
    );
  }

  const Icon = CATEGORY_ICON[selected?.category ?? "other"] ?? FileText;
  const url = selected ? StorageService.getUrl(selected) : "#";

  return (
    <div className="space-y-3">
      {/* Preview de la versión vigente */}
      <div className="rounded-[12px] border border-[#DBDBDB] bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#DBDBDB] bg-[#F8F9FA]/60 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-[#E37439] shrink-0" />
            <span className="truncate text-sm font-semibold text-[#0E1E2A]">
              {selected?.name ?? "—"}
            </span>
            {selected && (
              <Badge className="text-[10px] font-mono border-0 bg-[#E37439]/12 text-[#E37439]">
                v{selected.version}
              </Badge>
            )}
          </div>
          {selected && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
            >
              <a
                href={url}
                download={selected.name}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-3.5 w-3.5" /> Descargar
              </a>
            </Button>
          )}
        </div>
        <div className="bg-[#F8F9FA]/30 p-2">
          {selected?.category === "image" ? (
            <img
              src={url}
              alt={selected.name}
              className="mx-auto max-h-[320px] w-auto rounded-lg object-contain"
            />
          ) : selected?.category === "pdf" ? (
            <iframe
              src={url}
              title={selected.name}
              className="h-[320px] w-full rounded-lg border border-[#DBDBDB] bg-white"
            />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
              <Icon className="h-10 w-10 text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#0E1E2A]">
                  {selected?.name ?? "Archivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vista previa no disponible para este tipo de archivo.
                </p>
              </div>
              {selected && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a
                    href={url}
                    download={selected.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Abrir archivo
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Historial de versiones */}
      <div className="rounded-[12px] border border-[#DBDBDB] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Historial de versiones
        </p>
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-1.5 pr-2">
            {files.map((f) => {
              const FIcon = CATEGORY_ICON[f.category] ?? FileText;
              const isVigente = f.version === files[0]?.version;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    selected?.id === f.id
                      ? "border-[#E37439] bg-[#E37439]/5"
                      : "border-[#DBDBDB] hover:bg-[#F8F9FA]/60",
                  )}
                >
                  <FIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#0E1E2A]">
                      {f.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Subido por {f.uploadedByName} ·{" "}
                      {new Date(f.uploadedAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-mono border-0 shrink-0",
                      isVigente
                        ? "bg-[#2E9E5B]/12 text-[#2E9E5B]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    v{f.version}
                  </Badge>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
