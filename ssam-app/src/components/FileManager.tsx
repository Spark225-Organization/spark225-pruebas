import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  Image,
  Link2,
  Mic,
  File,
  Trash2,
  Download,
  Eye,
  History,
  Plus,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  StorageService,
  type StoredFile,
  type FileCategory,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<FileCategory, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5" />,
  image: <Image className="h-5 w-5" />,
  link: <Link2 className="h-5 w-5" />,
  audio: <Mic className="h-5 w-5" />,
  other: <File className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<FileCategory, string> = {
  pdf: "text-destructive bg-destructive/10",
  image: "text-info bg-info/10",
  link: "text-primary bg-primary/10",
  audio: "text-warning bg-warning/10",
  other: "text-muted-foreground bg-muted",
};

const CATEGORY_LABELS: Record<FileCategory, string> = {
  pdf: "PDF",
  image: "Imagen",
  link: "Enlace",
  audio: "Audio",
  other: "Archivo",
};

// ─── Upload Dialog ─────────────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  materialId: string;
  stage: string;
  newVersionOf?: StoredFile;
  onUploaded: (file: StoredFile) => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  materialId,
  stage,
  newVersionOf,
  onUploaded,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "link">("file");
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setSelectedFile(null);
    setLinkUrl("");
    setNotes("");
    setUploading(false);
    setProgress(0);
    setTab("file");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleUpload = async () => {
    if (!user) return;
    if (tab === "file" && !selectedFile) {
      toast({ title: "Selecciona un archivo", variant: "destructive" });
      return;
    }
    if (tab === "link" && !linkUrl.trim()) {
      toast({ title: "Ingresa una URL válida", variant: "destructive" });
      return;
    }

    setUploading(true);

    // Simulate progress for UX
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 20, 90));
    }, 150);

    try {
      const stored = await StorageService.upload({
        file: tab === "file" ? selectedFile! : undefined,
        externalUrl: tab === "link" ? linkUrl.trim() : undefined,
        materialId,
        stage,
        uploadedBy: user.id,
        uploadedByName: user.name,
        notes: notes.trim() || undefined,
        newVersionOf: newVersionOf?.id,
        // Si el cliente ya lo está revisando, la ve al momento; si no, al enviarlo.
        visibleCliente: /^aprobacion_cliente/.test(stage),
      });

      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        onUploaded(stored);
        toast({
          title: newVersionOf ? "Nueva versión guardada" : "Archivo guardado",
          description: stored.name || stored.externalUrl,
        });
        handleClose();
      }, 400);
    } catch (err) {
      clearInterval(interval);
      setUploading(false);
      setProgress(0);
      toast({ title: "Error al guardar el archivo", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {newVersionOf
              ? `Nueva versión — ${newVersionOf.name}`
              : "Cargar archivo"}
          </DialogTitle>
          <DialogDescription>
            {newVersionOf
              ? `Se creará la versión ${newVersionOf.version + 1} del archivo.`
              : `Etapa: ${stage}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "link")}>
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1 gap-2">
              <Upload className="h-4 w-4" /> Archivo
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1 gap-2">
              <Link2 className="h-4 w-4" /> Enlace externo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4 space-y-4">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,image/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSelectedFile(f);
                }}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      "rounded-full p-3",
                      CATEGORY_COLORS[
                        selectedFile.type === "application/pdf"
                          ? "pdf"
                          : selectedFile.type.startsWith("image/")
                            ? "image"
                            : selectedFile.type.startsWith("audio/")
                              ? "audio"
                              : "other"
                      ],
                    )}
                  >
                    {selectedFile.type === "application/pdf"
                      ? CATEGORY_ICONS.pdf
                      : selectedFile.type.startsWith("image/")
                        ? CATEGORY_ICONS.image
                        : selectedFile.type.startsWith("audio/")
                          ? CATEGORY_ICONS.audio
                          : CATEGORY_ICONS.other}
                  </div>
                  <p className="text-sm font-semibold">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {StorageService.formatSize(selectedFile.size)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Quitar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-full bg-muted p-4 mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold">
                    Arrastra o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, imágenes, audio, Office — máx. 4 MB
                  </p>
                </>
              )}
            </div>

            {selectedFile && selectedFile.size > 4 * 1024 * 1024 && (
              <div className="flex items-center gap-2 text-sm text-warning rounded-lg bg-warning/10 p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                El archivo supera 4 MB. Se guardará una referencia sin
                previsualización.
              </div>
            )}
          </TabsContent>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>URL del recurso</Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Google Drive, Dropbox, SharePoint u otro enlace externo.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>Notas (opcional)</Label>
          <Textarea
            placeholder="Descripción del archivo, cambios en esta versión..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {uploading && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress < 100 ? "Guardando..." : "¡Guardado!"}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" />
            {newVersionOf ? "Guardar versión" : "Cargar archivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Version History Dialog ───────────────────────────────────────────────────

interface VersionHistoryProps {
  open: boolean;
  onClose: () => void;
  file: StoredFile | null;
  materialId: string;
}

const VersionHistoryDialog: React.FC<VersionHistoryProps> = ({
  open,
  onClose,
  file,
  materialId,
}) => {
  const [history, setHistory] = useState<StoredFile[]>([]);

  useEffect(() => {
    if (file && open) {
      StorageService.getVersionHistory(file.id, materialId).then(setHistory);
    }
  }, [file, open, materialId]);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial de versiones
          </DialogTitle>
          <DialogDescription>{file.name}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80">
          <div className="space-y-3 pr-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay versiones anteriores.
              </p>
            ) : (
              history.map((v, i) => (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-1",
                    i === history.length - 1 &&
                      "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-bold">
                        v{v.version}
                      </Badge>
                      {i === history.length - 1 && (
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                          Actual
                        </Badge>
                      )}
                    </div>
                    <a
                      href={StorageService.getUrl(v)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {v.uploadedByName} ·{" "}
                    {formatDistanceToNow(new Date(v.uploadedAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                  {v.notes && (
                    <p className="text-xs bg-muted rounded px-2 py-1">
                      {v.notes}
                    </p>
                  )}
                  {v.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {StorageService.formatSize(v.size)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── File Row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: StoredFile;
  canDelete: boolean;
  canUpload: boolean;
  materialId: string;
  onDelete: (id: string) => void;
  onNewVersion: (file: StoredFile) => void;
  onViewHistory: (file: StoredFile) => void;
}

const FileRow: React.FC<FileRowProps> = ({
  file,
  canDelete,
  canUpload,
  materialId,
  onDelete,
  onNewVersion,
  onViewHistory,
}) => {
  const url = StorageService.getUrl(file);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors group">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          CATEGORY_COLORS[file.category],
        )}
      >
        {CATEGORY_ICONS[file.category]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate max-w-[200px]">
            {file.name}
          </p>
          <Badge variant="outline" className="text-[10px] font-bold shrink-0">
            v{file.version}
          </Badge>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {CATEGORY_LABELS[file.category]}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(file.uploadedAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {file.uploadedByName}
          </span>
          {file.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {StorageService.formatSize(file.size)}
              </span>
            </>
          )}
        </div>
        {file.notes && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {file.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {url !== "#" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver archivo</TooltipContent>
          </Tooltip>
        )}

        {file.version > 1 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onViewHistory(file)}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver historial de versiones</TooltipContent>
          </Tooltip>
        )}

        {canUpload && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onNewVersion(file)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nueva versión</TooltipContent>
          </Tooltip>
        )}

        {canDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(file.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar archivo</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// ─── Main FileManager Component ───────────────────────────────────────────────

interface FileManagerProps {
  materialId: string;
  stage: string;
  /** If true, only shows files for the given stage */
  filterByStage?: boolean;
}

const FileManager: React.FC<FileManagerProps> = ({
  materialId,
  stage,
  filterByStage = false,
}) => {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<StoredFile | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StoredFile | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const canUpload = can("uploadFiles");
  const canDelete = can("manageMaterials") || can("uploadFiles");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const all = await StorageService.list(materialId);
    const filtered = filterByStage ? all.filter((f) => f.stage === stage) : all;
    // Show only latest version of each file chain
    const latestMap = new Map<string, StoredFile>();
    for (const f of filtered) {
      // Group by name (and parent chain)
      const key = f.parentVersionId
        ? (() => {
            let cur: StoredFile | undefined = f;
            while (cur?.parentVersionId) {
              cur = filtered.find((x) => x.id === cur!.parentVersionId);
            }
            return cur?.id ?? f.id;
          })()
        : f.id;
      const existing = latestMap.get(key);
      if (!existing || f.version > existing.version) {
        latestMap.set(key, f);
      }
    }
    setFiles(
      Array.from(latestMap.values()).sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    );
    setLoading(false);
  }, [materialId, stage, filterByStage]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDelete = async (fileId: string) => {
    await StorageService.delete(fileId);
    toast({ title: "Archivo eliminado" });
    loadFiles();
  };

  const handleUploaded = () => {
    loadFiles();
  };

  const stageFileCount = filterByStage
    ? files.length
    : files.filter((f) => f.stage === stage).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {filterByStage ? `Archivos — ${stage}` : "Todos los archivos"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {files.length} archivo{files.length !== 1 ? "s" : ""} guardado
            {files.length !== 1 ? "s" : ""} · almacenamiento compartido en la
            nube
          </p>
        </div>
        {canUpload && (
          <Button
            size="sm"
            onClick={() => {
              setVersionTarget(null);
              setUploadOpen(true);
            }}
            className="gap-2 shrink-0"
          >
            <Upload className="h-4 w-4" />
            Cargar archivo
          </Button>
        )}
      </div>

      {/* Storage note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/40 border p-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#2E9E5B]" />
        <span>
          Los archivos se guardan en Supabase Storage (almacenamiento compartido
          en la nube). Todos los usuarios con permiso sobre el material ven la
          misma versión. Cada carga nueva crea una versión del archivo (v1, v2,
          v3…).
        </span>
      </div>

      {/* File list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">No hay archivos cargados</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Sube PDFs, imágenes, audios o agrega enlaces externos al material.
          </p>
          {canUpload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVersionTarget(null);
                setUploadOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Primer archivo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              canDelete={canDelete}
              canUpload={canUpload}
              materialId={materialId}
              onDelete={handleDelete}
              onNewVersion={(f) => {
                setVersionTarget(f);
                setUploadOpen(true);
              }}
              onViewHistory={(f) => {
                setHistoryTarget(f);
                setHistoryOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setVersionTarget(null);
        }}
        materialId={materialId}
        stage={stage}
        newVersionOf={versionTarget ?? undefined}
        onUploaded={handleUploaded}
      />

      <VersionHistoryDialog
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryTarget(null);
        }}
        file={historyTarget}
        materialId={materialId}
      />
    </div>
  );
};

export default FileManager;
