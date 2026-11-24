import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Paperclip, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { mutateCreateComment, getComments } from "@/data/operacion";
import { useAuth } from "@/lib/auth";
import type { Comment } from "@/lib/api-types";
import { formatDate } from "@/lib/statusModel";
import { cn } from "@/lib/utils";

/**
 * Hilo de comentarios compartido Spark225↔cliente por material.
 * - Los roles internos ven un switch "Interno" (default interno = true para
 *   internos); el cliente solo ve los no internos (filtro aquí + RLS en la base).
 * - El cliente puede adjuntar un archivo a su comentario (adjunto_url).
 * - Cada nuevo comentario notifica a los implicados (toast de confirmación);
 *   el refresco de ["operacion"] lo hace visible al instante en el lado Spark225.
 */
export const CommentThread = ({ materialId }: { materialId: string }) => {
  const { user, can } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [interno, setInterno] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [adjunto, setAdjunto] = useState<{ name: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await getComments(materialId);
    setComments(r.data ?? []);
    setLoading(false);
  }, [materialId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const send = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    const r = await mutateCreateComment({
      material_id: materialId,
      author_id: user.id,
      author_name: user.name,
      body: body.trim(),
      // internos marcan interno; el cliente nunca puede marcarlo (RLS lo
      // forzaría a false de todos modos).
      interno: can("comment") && user.role !== "client" ? interno : false,
      adjunto_name: adjunto?.name ?? null,
    } as Partial<Comment>);
    setBusy(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success("Comentario enviado. Se notificó a los responsables.");
    setBody("");
    setInterno(user.role !== "client");
    setAdjunto(null);
    reload();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setAdjunto({ name: f.name });
  };

  // El cliente solo ve los no internos (doble filtro: RLS + frontend).
  const visible =
    can("comment") && user?.role !== "client"
      ? comments
      : comments.filter((c) => !c.interno);

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">
            Sin comentarios. Spark225 responderá aquí tus dudas.
          </p>
        ) : (
          visible.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E37439] text-[10px] font-bold text-white">
                {c.author_name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#0E1E2A]">
                      {c.author_name}
                    </span>
                    {c.interno && (
                      <Badge className="text-[9px] border-0 bg-[#4E5964]/12 text-[#4E5964] h-4 px-1.5">
                        <Lock className="h-2.5 w-2.5 mr-0.5" /> Interno
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(c.created_at)}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-lg rounded-tl-none p-2.5 text-xs leading-relaxed",
                    c.interno
                      ? "bg-[#4E5964]/10 text-[#0E1E2A]"
                      : "bg-[#E37439]/8 text-[#0E1E2A]",
                  )}
                >
                  {c.body}
                </div>
                {c.adjunto_name && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                    <Paperclip className="h-3 w-3" /> {c.adjunto_name}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {can("comment") && (
        <div className="border-t border-[#DBDBDB] pt-3 space-y-2">
          <Textarea
            placeholder="Escribe tu comentario o duda…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[70px] resize-none border-[#DBDBDB] bg-[#F8F9FA] focus-visible:ring-[#E37439] text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {user?.role !== "client" && (
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={interno}
                    onChange={(e) => setInterno(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#DBDBDB] accent-[#E37439]"
                  />
                  Interno (solo Spark225)
                </label>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-[11px] text-muted-foreground"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" /> Adjuntar
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={onFile}
              />
              {adjunto && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {adjunto.name}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={send}
              disabled={busy || !body.trim()}
              className="gap-1.5 bg-[#E37439] hover:bg-[#C45B24] text-white"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
