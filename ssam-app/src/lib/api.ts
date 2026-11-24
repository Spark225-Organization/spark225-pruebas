import { supabase } from "@/lib/supabase";
import { normalizeRol } from "@/lib/auth";
import type {
  Client,
  ClientLabelPatch,
  Product,
  Indication,
  Material,
  TeamMember,
  Comment,
  ClientApproval,
  FileAsset,
  CommitmentDateChange,
  FinalPackageItem,
  ClientMaterial,
  PaquetePendiente,
  MaterialRiesgo,
  MaterialMetric,
  StageDuration,
  MonthlyTrend,
  WorkloadRow,
  BusinessUnit,
  ClientKpi,
  ClientTimelineRow,
  CandadoEvent,
  MaterialForecast,
  MaterialHierarchy,
  TimelineStage,
} from "@/lib/api-types";

export type FechaCategoria =
  "spark225" | "cliente" | "regulatorio" | "cambio_alcance" | "otro";

import { approvalsApi } from "@/lib/approvalsApi";

// Generic helper for safe single-row fetch
async function one<T>(
  query: ReturnType<typeof supabase.from>["select"] extends infer Q ? any : any,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await query.maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

async function many<T>(
  query: any,
): Promise<{ data: T[] | null; error: string | null }> {
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: (data as T[]) ?? [], error: null };
}

// ─── Clients ──────────────────────────────────────────────────────────────────
// Esquema real: clients(nombre, email, etiqueta_codigo_interno, ...). La DB
// devuelve "nombre"; mapeamos a "name" para que la UI (c.name) funcione.
export const clientsApi = {
  async list() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    // Esquema real: clients(nombre, telefono, estado[enum activo/inactivo],
    // email, etiqueta_*, especificaciones_impresion_default, created_at).
    // No existen phone/website/status; mapeamos a los campos de la UI.
    const rows: Client[] = (data ?? []).map((r: any) => ({
      ...r,
      name: r.nombre,
      phone: r.telefono ?? null,
      website: null,
      status: r.estado ?? null,
    }));
    return { data: rows, error: null };
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return {
      data: { ...data, name: (data as any).nombre } as Client,
      error: null,
    };
  },
  async create(payload: Partial<Client>) {
    const { data, error } = await supabase
      .from("clients")
      .insert(payload)
      .select()
      .single();
    return { data: data as Client, error: error?.message ?? null };
  },
  async update(id: string, payload: Partial<Client>) {
    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data: data as Client, error: error?.message ?? null };
  },
  async updateLabels(id: string, payload: ClientLabelPatch) {
    return this.update(id, payload);
  },
  async remove(id: string) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    return { error: error?.message ?? null };
  },
};

// ─── Products ─────────────────────────────────────────────────────────────────
// Esquema real: products(nombre, cliente_id) — FK a clients via cliente_id.
// Mapeamos nombre→name y resolvemos client_name desde clients.
export const productsApi = {
  async list() {
    const { data, error } = await supabase
      .from("products")
      .select("*, clients(nombre)")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    // Esquema real: products(nombre, cliente_id, estado, created_at).
    // No existen name/client_id/category/active_materials.
    const rows: Product[] = (data ?? []).map((r: any) => ({
      ...r,
      name: r.nombre,
      client_id: r.cliente_id ?? null,
      client_name: r.clients?.nombre ?? null,
      category: null,
      active_materials: null,
      status: r.estado ?? null,
    }));
    return { data: rows, error: null };
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return {
      data: { ...data, name: (data as any).nombre } as Product,
      error: null,
    };
  },
  async create(payload: Partial<Product>) {
    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();
    return { data: data as Product, error: error?.message ?? null };
  },
  async update(id: string, payload: Partial<Product>) {
    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data: data as Product, error: error?.message ?? null };
  },
  async remove(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    return { error: error?.message ?? null };
  },
};

// ─── Indications ──────────────────────────────────────────────────────────────
// Esquema real: indications(nombre). Mapeamos nombre→name.
export const indicationsApi = {
  async list() {
    const { data, error } = await supabase
      .from("indications")
      .select("*")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    // Esquema real: indications(nombre, estado, created_at).
    // No existen name/materials_count.
    const rows: Indication[] = (data ?? []).map((r: any) => ({
      ...r,
      name: r.nombre,
      materials_count: null,
      status: r.estado ?? null,
    }));
    return { data: rows, error: null };
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("indications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return {
      data: { ...data, name: (data as any).nombre } as Indication,
      error: null,
    };
  },
  async create(payload: Partial<Indication>) {
    const { data, error } = await supabase
      .from("indications")
      .insert(payload)
      .select()
      .single();
    return { data: data as Indication, error: error?.message ?? null };
  },
  async update(id: string, payload: Partial<Indication>) {
    const { data, error } = await supabase
      .from("indications")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data: data as Indication, error: error?.message ?? null };
  },
  async remove(id: string) {
    const { error } = await supabase.from("indications").delete().eq("id", id);
    return { error: error?.message ?? null };
  },
};

// ─── Materials ─────────────────────────────────────────────────────────────────
// Esquema real: materials NO tiene FKs a clients/products/indications (los
// joins viven en las vistas v_material_hierarchy / v_material_metrics). Solo
// existe la FK a profiles via responsable_principal_id
// (materials_responsable_principal_id_fkey). Por eso list() hace select("*")
// y los nombres se resuelven en operacion.ts desde la jerarquía.
export const materialsApi = {
  async list() {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    // Mapear titulo→name y responsable_principal_id→responsible_id para la UI.
    // Los joins (cliente, producto, indicación) se resuelven en operacion.ts
    // desde v_material_hierarchy.
    const rows: Material[] = (data ?? []).map((r: any) => ({
      ...r,
      name: r.titulo,
      responsible_id: r.responsable_principal_id ?? null,
    }));
    return { data: rows, error: null };
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("materials")
      .select("*, profiles!materials_responsable_principal_id_fkey(nombre)")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    const prof = (data as any).profiles;
    return {
      data: {
        ...(data as any),
        name: (data as any).titulo,
        responsible_id: (data as any).responsable_principal_id ?? null,
        responsible_name: prof?.nombre ?? null,
      } as Material,
      error: null,
    };
  },
  async create(payload: Partial<Material>) {
    const { data, error } = await supabase
      .from("materials")
      .insert(payload)
      .select()
      .single();
    return { data: data as Material, error: error?.message ?? null };
  },
  async update(id: string, payload: Partial<Material>) {
    const { data, error } = await supabase
      .from("materials")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data: data as Material, error: error?.message ?? null };
  },
  async changeStatus(id: string, newStatus: string) {
    const { data, error } = await supabase.rpc("change_material_status", {
      p_material_id: id,
      p_new_status: newStatus,
    });
    return { data, error: error?.message ?? null };
  },
  async setFechaComprometida(
    materialId: string,
    fecha: string,
    motivo: string,
    categoria?: string,
  ) {
    const { data, error } = await supabase.rpc("set_fecha_comprometida", {
      p_material_id: materialId,
      p_fecha: fecha,
      p_motivo: motivo,
      p_categoria: categoria ?? null,
    });
    return { data, error: error?.message ?? null };
  },
  async setFechaRequeridaCliente(
    materialId: string,
    fecha: string,
    motivo?: string,
  ) {
    // RPC SECURITY DEFINER set_fecha_requerida_cliente: valida que el usuario
    // sea interno (is_internal()) o que sea un cliente actuando sobre un
    // material de su propio cliente_id (current_role()='cliente' y
    // current_cliente_id() = materials.cliente_id). El RPC actualiza
    // materials.fecha_requerida_cliente y deja el registro de historial en
    // fecha_requerida_changes vía trigger.
    const { data, error } = await supabase.rpc("set_fecha_requerida_cliente", {
      p_material_id: materialId,
      p_fecha: fecha,
      p_motivo: motivo ?? null,
    });
    return { data, error: error?.message ?? null };
  },
  async setVisibleCliente(materialId: string, visible: boolean) {
    // Switch de visibilidad del material hacia el portal del cliente
    // (materials.visible_para_cliente). Sin este switch activo, el cliente no
    // ve el material. Lo maneja el lado interno (RLS permite escritura a
    // internos + admin).
    const { data, error } = await supabase
      .from("materials")
      .update({
        visible_para_cliente: visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", materialId)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },
  async iniciarTrabajo(materialId: string) {
    const { data, error } = await supabase.rpc("iniciar_trabajo", {
      p_material_id: materialId,
    });
    return { data, error: error?.message ?? null };
  },
  async registrarBloqueo(
    materialId: string,
    statusDestino: string,
    mensaje: string,
  ) {
    const { data, error } = await supabase.rpc("registrar_bloqueo", {
      p_material_id: materialId,
      p_status_destino: statusDestino,
      p_mensaje: mensaje,
    });
    return { data, error: error?.message ?? null };
  },
  async commitmentHistory(materialId: string) {
    return many<CommitmentDateChange>(
      supabase
        .from("commitment_date_changes")
        .select("*")
        .eq("material_id", materialId)
        .order("changed_at", { ascending: false }),
    );
  },
  async finalPackageItems(materialId: string) {
    return many<FinalPackageItem>(
      supabase
        .from("final_package_items")
        .select("*")
        .eq("material_id", materialId),
    );
  },
  async markFinalPackageItem(
    itemId: string,
    delivered: boolean,
    deliveredBy: string,
    deliveredByName: string,
  ) {
    const payload = {
      entregado: delivered,
      entregado_by: deliveredBy,
      entregado_by_name: deliveredByName,
      entregado_at: delivered ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from("final_package_items")
      .update(payload)
      .eq("id", itemId)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as FinalPackageItem, error: null };
  },
  async clientMaterialsForClient() {
    return many<ClientMaterial>(supabase.from("client_materials").select("*"));
  },
  async paquetesPendientes() {
    return many<PaquetePendiente>(
      supabase.from("paquetes_pendientes").select("*"),
    );
  },
};

// ─── Team (profiles) ─────────────────────────────────────────────────────────
// Esquema real: profiles(nombre, email, rol, cliente_id). No existe tabla
// team_members. Adaptamos a TeamMember para la UI.
export const teamApi = {
  async list() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, rol, cliente_id, email, estado")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    // Esquema real: profiles(nombre, rol, email, estado, cliente_id).
    // Normalizamos el rol del esquema español (cliente/creativo/etc.) a las
    // claves canónicas de la app (client/creative/...) para que Equipo y Roles
    // muestren una etiqueta válida y coherente.
    const rows: TeamMember[] = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.nombre ?? "Sin nombre",
      email: r.email ?? null,
      role: normalizeRol(r.rol ?? "client"),
      department: null,
      status: r.estado ?? "activo",
      avatar: null,
    }));
    return { data: rows, error: null };
  },
  async listProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, email, rol")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as any[], error: null };
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, rol, cliente_id, email")
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return {
      data: {
        id: (data as any).id,
        name: (data as any).nombre ?? "Sin nombre",
        email: (data as any).email ?? null,
        role: (data as any).rol ?? "client",
        department: null,
        status: "active",
        avatar: null,
      } as TeamMember,
      error: null,
    };
  },
  async create(payload: Partial<TeamMember>) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ nombre: payload.name, rol: payload.role })
      .select()
      .single();
    return { data: data as TeamMember, error: error?.message ?? null };
  },
  async update(id: string, payload: Partial<TeamMember>) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ nombre: payload.name, rol: payload.role })
      .eq("id", id)
      .select()
      .single();
    return { data: data as TeamMember, error: error?.message ?? null };
  },
  async remove(id: string) {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    return { error: error?.message ?? null };
  },
};

// ─── Comments ──────────────────────────────────────────────────────────────────
// Implementación en src/lib/commentsApi.ts (esquema real: comments.texto,
// autor_id, visibilidad, parent_id, version_id, requiere_cambio, estado).
import { commentsApi as _commentsApi } from "@/lib/commentsApi";
export const commentsApi = _commentsApi;

// ─── Files ─────────────────────────────────────────────────────────────────────
// La tabla material_files no existe en este esquema; los archivos multimedia
// se gestionan vía la tabla material_assignees (relación material_id). Si la
// tabla de archivos se añade después, se ajusta aquí.
export const filesApi = {
  async list(materialId: string) {
    return many<FileAsset>(
      supabase
        .from("material_assignees")
        .select("*")
        .eq("material_id", materialId),
    );
  },
  async create(payload: Partial<FileAsset>) {
    const { data, error } = await supabase
      .from("material_assignees")
      .insert(payload)
      .select()
      .single();
    return { data: data as FileAsset, error: error?.message ?? null };
  },
};

// ─── Reports & analytics views ──────────────────────────────────────────────────
export const reportsApi = {
  async metrics() {
    return many<MaterialMetric>(
      supabase.from("v_material_metrics").select("*"),
    );
  },
  async stageDurations() {
    return many<StageDuration>(
      supabase.from("v_stage_durations").select("*").order("material_id"),
    );
  },
  async monthlyTrend() {
    return many<MonthlyTrend>(
      supabase.from("v_monthly_trend").select("*").order("mes"),
    );
  },
  async workload() {
    return many<WorkloadRow>(
      supabase.from("v_workload").select("*").order("activos", {
        ascending: false,
      }),
    );
  },
  async materialsRiesgo() {
    return many<MaterialRiesgo>(
      supabase.from("materiales_en_riesgo").select("*"),
    );
  },
  async businessUnits() {
    const { data, error } = await supabase
      .from("business_units")
      .select("*")
      .order("nombre");
    if (error) return { data: null, error: error.message };
    // Esquema real: business_units(nombre, cliente_id, estado).
    // No existen name/client_id; mapeamos.
    const rows: BusinessUnit[] = (data ?? []).map((r: any) => ({
      ...r,
      name: r.nombre,
      client_id: r.cliente_id ?? null,
      client_name: null,
      status: r.estado ?? null,
    }));
    return { data: rows, error: null };
  },
  async clientKpis() {
    return one<ClientKpi>(supabase.from("v_client_kpis").select("*").limit(1));
  },
  async clientTimeline() {
    return many<ClientTimelineRow>(
      supabase.from("v_client_timeline").select("*"),
    );
  },
  async candadoEvents() {
    return many<CandadoEvent>(
      supabase
        .from("candado_events")
        .select("*")
        .order("created_at", { ascending: false }),
    );
  },
  async forecast() {
    return many<MaterialForecast>(
      supabase.from("v_material_forecast").select("*"),
    );
  },
  async hierarchy() {
    return many<MaterialHierarchy>(
      supabase.from("v_material_hierarchy").select("*"),
    );
  },
  async timeline() {
    return many<TimelineStage>(
      supabase.from("v_material_timeline").select("*").order("orden"),
    );
  },
};

// ─── Unified api surface ───────────────────────────────────────────────────────
export const api = {
  clients: clientsApi,
  products: productsApi,
  indications: indicationsApi,
  materials: materialsApi,
  team: teamApi,
  comments: commentsApi,
  files: filesApi,
  approvals: approvalsApi,
  reports: reportsApi,
  clientMaterials: {
    list: materialsApi.clientMaterialsForClient,
  },
  paquetesPendientes: {
    list: materialsApi.paquetesPendientes,
  },
  finalPackage: {
    list: (materialId: string) => materialsApi.finalPackageItems(materialId),
    mark: materialsApi.markFinalPackageItem,
  },
  commitmentChanges: {
    list: (materialId: string) => materialsApi.commitmentHistory(materialId),
  },
  riesgo: {
    list: reportsApi.materialsRiesgo,
  },
  metrics: {
    list: reportsApi.metrics,
  },
  stageDurations: {
    list: reportsApi.stageDurations,
  },
  monthlyTrend: {
    list: reportsApi.monthlyTrend,
  },
  workload: {
    list: reportsApi.workload,
  },
  businessUnits: {
    list: reportsApi.businessUnits,
  },
  clientKpis: {
    get: reportsApi.clientKpis,
  },
  clientTimeline: {
    list: reportsApi.clientTimeline,
  },
  candadoEvents: {
    list: reportsApi.candadoEvents,
  },
  forecast: {
    list: reportsApi.forecast,
  },
  hierarchy: {
    list: reportsApi.hierarchy,
  },
  timeline: {
    list: reportsApi.timeline,
  },
  iniciarTrabajo: materialsApi.iniciarTrabajo,
  registrarBloqueo: materialsApi.registrarBloqueo,
};

// Helper: if a DB error starts with "Candado:", also register the bloqueo.
// Generic so it preserves the full result shape (incl. `data`).
export async function withBloqueo<T extends { error: string | null }>(
  res: T,
  materialId: string,
  statusDestino: string,
): Promise<T> {
  if (res.error && res.error.startsWith("Candado:")) {
    await api.registrarBloqueo(materialId, statusDestino, res.error);
  }
  return res;
}
