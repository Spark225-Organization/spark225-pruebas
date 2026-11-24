import { useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Timer,
  Lightbulb,
  FileText,
  AlertTriangle,
  PlayCircle,
  MessageSquare,
  CalendarClock,
  Inbox,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperacion, mutateIniciarTrabajo } from "@/data/operacion";
import { statusLabel, type MaterialStatus } from "@/lib/statusModel";
import { useFilters } from "@/lib/useFilters";
import { r1, median, pct } from "@/lib/reportMath";
import { KpiCard, EmptyReport } from "@/components/reportPrimitives";
import { FilterBar } from "@/components/FilterBar";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DAY = 1000 * 60 * 60 * 24;

export const OperationalDashboard = () => {
  const { user } = useAuth();
  const { state: filters } = useFilters();
  const data = useOperacion();

  // Mis materiales: responsable = usuario actual (desde la capa única).
  const mine = useMemo(
    () => data.metrics.filter((m) => m.responsible_id === user?.id),
    [data.metrics, user],
  );

  const misPendientes = mine.filter(
    (m) => m.status !== "aprobado" && m.status !== "archivado",
  );
  const porIniciar = mine.filter(
    (m) => m.dias_en_cola != null && (m.dias_en_cola ?? 0) > 0,
  );
  const misAlertas = data.riesgo.filter(
    (r) => r.responsable_principal_id === user?.id,
  );
  const comentariosAbiertos = mine.filter((m) => (m.rechazos ?? 0) > 0);

  const prox7 = mine.filter((m) => {
    if (!m.fecha_comprometida) return false;
    const d = new Date(m.fecha_comprometida).getTime();
    const now = Date.now();
    return d >= now && d <= now + 7 * DAY;
  });

  const kpis = useMemo(() => {
    return {
      activos: misPendientes.length,
      ciclo: r1(median(mine.map((m) => m.ciclo_dias ?? 0))),
      primera: pct(
        mine.filter((m) => m.aprobado_primera_ronda).length,
        mine.length,
      ),
      alertas: misAlertas.length,
    };
  }, [mine, misPendientes, misAlertas]);

  const iniciar = async (id: string) => {
    const res = await mutateIniciarTrabajo(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Trabajo iniciado.");
    data.reload();
  };

  if (data.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-[12px]" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FilterBar
        scopes={{
          cliente: true,
          unidad: true,
          producto: true,
          indicacion: true,
          responsable: false,
          formato: true,
        }}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Mis pendientes"
          value={kpis.activos}
          icon={FileText}
          tone="navy"
        />
        <KpiCard
          label="Tiempo de ciclo (mediana)"
          value={kpis.ciclo}
          suffix="d"
          icon={Timer}
          tone="slate"
        />
        <KpiCard
          label="% Aprobado a la primera"
          value={kpis.primera}
          suffix="%"
          icon={Lightbulb}
          tone="primary"
        />
        <KpiCard
          label="Mis alertas"
          value={kpis.alertas}
          icon={AlertTriangle}
          tone="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard
          title="Mis pendientes"
          icon={FileText}
          tone="navy"
          items={misPendientes.map((m) => ({
            id: m.material_id,
            name: m.name,
            sub: m.client_name ?? "—",
            badge: statusLabel(m.status as MaterialStatus),
          }))}
          emptyText="No tienes materiales pendientes."
        />

        <ListCard
          title="Por iniciar"
          icon={PlayCircle}
          tone="amber"
          items={porIniciar.map((m) => ({
            id: m.material_id,
            name: m.name,
            sub: `${m.client_name ?? "—"} · ${m.dias_en_cola ?? 0}d en cola`,
            badge: "En cola",
          }))}
          emptyText="No hay materiales por iniciar."
          action={
            <Button
              size="sm"
              className="gap-2 bg-[#E37439] hover:bg-[#C45B24] text-white"
              onClick={() => {
                const first = porIniciar[0];
                if (first) iniciar(first.material_id);
              }}
              disabled={porIniciar.length === 0}
            >
              <PlayCircle className="h-4 w-4" /> Empezar
            </Button>
          }
        />

        <ListCard
          title="Comentarios abiertos"
          icon={MessageSquare}
          tone="slate"
          items={comentariosAbiertos.map((m) => ({
            id: m.material_id,
            name: m.name,
            sub: `${m.client_name ?? "—"} · ${m.rechazos ?? 0} rechazo(s)`,
            badge: `${m.rechazos ?? 0} devolución(es)`,
          }))}
          emptyText="No hay comentarios abiertos."
        />

        <ListCard
          title="Próximos 7 días"
          icon={CalendarClock}
          tone="green"
          items={prox7.map((m) => ({
            id: m.material_id,
            name: m.name,
            sub: m.fecha_comprometida ?? "—",
            badge: statusLabel(m.status as MaterialStatus),
          }))}
          emptyText="No hay entregas en los próximos 7 días."
        />

        <ListCard
          title="Mis alertas"
          icon={AlertTriangle}
          tone="red"
          items={misAlertas.map((r) => ({
            id: r.material_id,
            name: r.titulo ?? r.material_id,
            sub: `${r.responsable ?? "—"} · ${r.dias ?? 0}d retraso`,
            badge: "En riesgo",
          }))}
          emptyText="No tienes alertas activas."
          span
        />
      </div>
    </div>
  );
};

const ListCard = ({
  title,
  icon: Icon,
  tone,
  items,
  emptyText,
  action,
  span,
}: {
  title: string;
  icon: React.ElementType;
  tone: "navy" | "amber" | "red" | "green" | "slate";
  items: { id: string; name: string; sub: string; badge: string }[];
  emptyText: string;
  action?: React.ReactNode;
  span?: boolean;
}) => {
  const toneMap: Record<string, string> = {
    navy: "text-[#0E1E2A]",
    amber: "text-[#B5840A]",
    red: "text-[#D64545]",
    green: "text-[#2E9E5B]",
    slate: "text-[#4E5964]",
  };
  return (
    <Card
      className={cn(
        "border border-[#DBDBDB] shadow-soft",
        span && "lg:col-span-2",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn("text-base flex items-center gap-2", toneMap[tone])}
          >
            <Icon className="h-4 w-4" /> {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-muted p-3 mb-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <Link
                key={it.id}
                to={`/materials/${it.id}`}
                className="flex items-center justify-between rounded-[10px] border border-[#DBDBDB] bg-white px-3.5 py-2.5 transition-colors hover:border-[#E37439]/40 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0E1E2A]">
                    {it.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.sub}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {it.badge}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
