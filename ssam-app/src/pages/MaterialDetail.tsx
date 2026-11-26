import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquare,
  History,
  Send,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import FileManager from "@/components/FileManager";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AdvanceStageButton } from "@/components/material/AdvanceStageButton";
import { FechaComprometidaCard } from "@/components/material/FechaComprometidaCard";
import { FechaRequeridaClienteCard } from "@/components/material/FechaRequeridaClienteCard";
import { CodigosClienteCard } from "@/components/material/CodigosClienteCard";
import { PaqueteFinalCard } from "@/components/material/PaqueteFinalCard";
import { StageStrip, DependenciaBadge } from "@/components/material/StageStrip";
import { CommitmentHistory } from "@/components/material/CommitmentHistory";
import { RevisionClienteCard } from "@/components/material/RevisionClienteCard";
import { CorreccionesClienteCard } from "@/components/material/CorreccionesClienteCard";
import { EnviarAlCliente } from "@/components/material/EnviarAlCliente";
import {
  useOperacion,
  mutateCreateComment,
  mutateSetVisibleCliente,
  getComments,
} from "@/data/operacion";
import type { Material, Client, Comment } from "@/lib/api-types";
import {
  statusLabel,
  formatDate,
  type MaterialStatus,
} from "@/lib/statusModel";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const MaterialDetail = () => {
  const { id } = useParams();
  const { can, user } = useAuth();
  const data = useOperacion();
  const [comment, setComment] = useState("");
  // Los comentarios del equipo son internos salvo que se marque este switch.
  const [paraCliente, setParaCliente] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Material + cliente resueltos desde la capa única de datos.
  const material: Material | null = useMemo(
    () => (id ? (data.materials.find((m) => m.id === id) ?? null) : null),
    [id, data.materials],
  );
  const client: Client | null = useMemo(
    () =>
      material?.client_id
        ? (data.clients.find((c) => c.id === material.client_id) ?? null)
        : null,
    [material, data.clients],
  );
  const loading = data.loading;

  const loadComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    const cRes = await getComments(id);
    setComments(cRes.data ?? []);
    setCommentsLoading(false);
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // "Visible para el cliente" — materials.visible_para_cliente. Sin este
  // switch activo, el cliente no ve el material en su portal. Lo maneja el
  // lado interno (admin + roles internos con permiso toggleVisibleCliente).
  const [visSaving, setVisSaving] = useState(false);
  const toggleVisible = async (visible: boolean) => {
    if (!material) return;
    setVisSaving(true);
    const res = await mutateSetVisibleCliente(material.id, visible);
    setVisSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      visible
        ? "Material habilitado para el portal del cliente."
        : "Material oculto del portal del cliente.",
    );
    data.reload();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 rounded-[10px]" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-[10px]" />
          <Skeleton className="h-96 rounded-[10px]" />
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <Lock className="h-10 w-10 text-muted-foreground/30" />
        <p className="font-semibold">Material no encontrado</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/materials">Volver a materiales</Link>
        </Button>
      </div>
    );
  }

  const sendComment = async () => {
    if (!comment.trim() || !user) return;
    const body = comment.trim();
    setComment("");
    const res = await mutateCreateComment({
      material_id: material!.id,
      author_id: user.id,
      author_name: user.name,
      body,
      interno: !paraCliente,
    });
    if (res.error) {
      toast.error(res.error);
      setComment(body);
      return;
    }
    toast.success("Comentario enviado. Se notificó a los responsables.");
    loadComments();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="rounded-full shrink-0"
          >
            <Link to="/materials">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {material.name}
              </h1>
              {material.folio != null && (
                <Badge variant="outline" className="font-mono">
                  #{material.folio}
                </Badge>
              )}
              <DependenciaBadge status={material.status as MaterialStatus} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
              <span>{material.client_name}</span>
              <span>•</span>
              <span>{material.product_name}</span>
              {material.indication_name && (
                <>
                  <span>•</span>
                  <span>{material.indication_name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {can("advanceStage") && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/kanban">
                <History className="h-4 w-4" /> Ir a Kanban
              </Link>
            </Button>
            <EnviarAlCliente material={material} onDone={data.reload} />
            <AdvanceStageButton
              material={material}
              client={client}
              onDone={data.reload}
            />
          </div>
        )}
      </div>

      <StageStrip material={material} client={client} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CorreccionesClienteCard material={material} onCambio={data.reload} />
          <FechaComprometidaCard material={material} onDone={data.reload} />
          {can("captureFechaRequerida") && (
            <FechaRequeridaClienteCard
              material={material}
              onDone={data.reload}
            />
          )}
          <CodigosClienteCard
            material={material}
            client={client}
            onDone={data.reload}
          />
          <PaqueteFinalCard material={material} onDone={data.reload} />

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                Archivos y Documentación
              </CardTitle>
              <CardDescription>
                Carga, versiona y consulta todos los archivos del material.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileManager
                materialId={material.id}
                stage={statusLabel(material.status as MaterialStatus, client)}
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#E37439]" />
                Comentarios Colaborativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] px-6">
                <div className="space-y-5 pb-6">
                  {commentsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aún no hay comentarios en este material.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E37439] font-bold text-white text-xs">
                          {c.author_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-bold text-sm">
                              {c.author_name}
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  c.interno
                                    ? "bg-[#4E5964]/10 text-[#4E5964]"
                                    : "bg-[#E37439]/12 text-[#E37439]",
                                )}
                              >
                                {c.interno ? "Interno" : "Lo ve el cliente"}
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(c.created_at)}
                            </span>
                          </div>
                          <div className="rounded-2xl rounded-tl-none bg-muted/40 p-3 text-sm leading-relaxed">
                            {c.body}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {can("comment") && (
                <div className="border-t p-6">
                  <div className="flex flex-col gap-3">
                    <Textarea
                      placeholder="Escribe un comentario o sugerencia..."
                      className="min-h-[80px] resize-none border-[#DBDBDB] bg-[#F8F9FA] focus-visible:ring-[#E37439]"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-[#4E5964]">
                        <Switch
                          checked={paraCliente}
                          onCheckedChange={setParaCliente}
                          aria-label="Visible para el cliente"
                        />
                        {paraCliente
                          ? "Lo verá el cliente en su portal"
                          : "Solo lo ve el equipo Spark225"}
                      </label>
                      <Button
                        onClick={sendComment}
                        className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white shadow-soft"
                      >
                        <Send className="h-4 w-4" /> Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {can("toggleVisibleCliente") && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#E37439]" />
                  Visible para el cliente
                </CardTitle>
                <CardDescription>
                  Sin este switch activo, el cliente no ve este material en su
                  portal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    {material.visible_para_cliente ? (
                      <Eye className="h-4 w-4 text-[#2E9E5B] shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-semibold">
                      {material.visible_para_cliente
                        ? "Habilitado para el cliente"
                        : "Oculto del portal"}
                    </span>
                  </div>
                  <Switch
                    checked={!!material.visible_para_cliente}
                    onCheckedChange={(v) => toggleVisible(v)}
                    disabled={visSaving}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalles de Auditoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Cliente" value={material.client_name ?? "—"} />
              <Row label="Producto" value={material.product_name ?? "—"} />
              {material.indication_name && (
                <Row label="Indicación" value={material.indication_name} />
              )}
              <Row
                label="Responsable"
                value={material.responsible_name ?? "—"}
              />
              <Separator />
              <Row label="Creado el" value={formatDate(material.created_at)} />
              <Row
                label="Actualizado"
                value={formatDate(material.updated_at)}
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-[#E37439]" />
                Cambios de Fecha Comprometida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommitmentHistory materialId={material.id} />
            </CardContent>
          </Card>

          {/* Revisión del cliente (historial de aprobaciones + comentarios) */}
          <RevisionClienteCard materialId={material.id} />
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

export default MaterialDetail;
