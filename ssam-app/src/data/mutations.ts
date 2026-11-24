// Mutaciones de la capa única: escriben en Supabase por la API y luego
// invalidan ["operacion"], que recarga las vistas y refresca todas las
// pantallas a la vez. Si la base rechaza con un candado (trigger), se
// registra el bloqueo. Ninguna pantalla llama a `api` directamente.

import { api } from "@/lib/api";
import { invalidateOperacion } from "./operacion";
import type {
  Client,
  ClientLabelPatch,
  Product,
  Indication,
  Material,
  Comment,
} from "@/lib/api-types";

export async function mutateChangeStatus(
  materialId: string,
  newStatus: string,
) {
  const res = await api.materials.changeStatus(materialId, newStatus);
  if (res.error && res.error.startsWith("Candado:"))
    await api.registrarBloqueo(materialId, newStatus, res.error);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateSetFecha(
  materialId: string,
  fecha: string,
  motivo: string,
  categoria?: string,
) {
  const res = await api.materials.setFechaComprometida(
    materialId,
    fecha,
    motivo,
    categoria,
  );
  if (!res.error) await invalidateOperacion();
  return res;
}

// Fecha requerida por el cliente (fecha_requerida_cliente): la captura el
// Cliente Externo o el Admin. Distinta de fecha_comprometida (Creativo).
// El motivo es obligatorio cuando ya existe un valor (cambio de fecha).
export async function mutateSetFechaRequeridaCliente(
  materialId: string,
  fecha: string,
  motivo?: string,
) {
  const res = await api.materials.setFechaRequeridaCliente(
    materialId,
    fecha,
    motivo,
  );
  if (!res.error) await invalidateOperacion();
  return res;
}

// Switch de visibilidad del material hacia el portal del cliente
// (materials.visible_para_cliente). Sin este switch activo, el cliente no ve
// el material. Lo maneja el lado interno (admin / roles internos).
export async function mutateSetVisibleCliente(
  materialId: string,
  visible: boolean,
) {
  const res = await api.materials.setVisibleCliente(materialId, visible);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateIniciarTrabajo(materialId: string) {
  const res = await api.iniciarTrabajo(materialId);
  if (res.error && res.error.startsWith("Candado:"))
    await api.registrarBloqueo(materialId, "desarrollo_medico", res.error);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateUpdateMaterial(
  materialId: string,
  payload: Partial<Material>,
) {
  const res = await api.materials.update(materialId, payload);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateUpdateClientLabels(
  clientId: string,
  payload: ClientLabelPatch,
) {
  const res = await api.clients.updateLabels(clientId, payload);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateMarkFinalPackageItem(
  itemId: string,
  delivered: boolean,
  byId: string,
  byName: string,
) {
  const res = await api.finalPackage.mark(itemId, delivered, byId, byName);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateCreateComment(payload: Partial<Comment>) {
  const res = await api.comments.create(payload);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateCreateClient(payload: Partial<Client>) {
  const res = await api.clients.create(payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateUpdateClient(id: string, payload: Partial<Client>) {
  const res = await api.clients.update(id, payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateRemoveClient(id: string) {
  const res = await api.clients.remove(id);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateCreateProduct(payload: Partial<Product>) {
  const res = await api.products.create(payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateUpdateProduct(
  id: string,
  payload: Partial<Product>,
) {
  const res = await api.products.update(id, payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateRemoveProduct(id: string) {
  const res = await api.products.remove(id);
  if (!res.error) await invalidateOperacion();
  return res;
}

export async function mutateCreateIndication(payload: Partial<Indication>) {
  const res = await api.indications.create(payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateUpdateIndication(
  id: string,
  payload: Partial<Indication>,
) {
  const res = await api.indications.update(id, payload);
  if (!res.error) await invalidateOperacion();
  return res;
}
export async function mutateRemoveIndication(id: string) {
  const res = await api.indications.remove(id);
  if (!res.error) await invalidateOperacion();
  return res;
}

// ─── Lecturas por material (detalle) ──────────────────────────────────────
export function getCommitmentHistory(materialId: string) {
  return api.commitmentChanges.list(materialId);
}
export function getFinalPackageItems(materialId: string) {
  return api.finalPackage.list(materialId);
}
export function getComments(materialId: string) {
  return api.comments.list(materialId);
}
export function getApprovals(materialId: string) {
  return api.approvals.list(materialId);
}
export function fetchProfiles() {
  return api.team.listProfiles();
}

// ─── FASE 2A: decisión del cliente (aprobar / solicitar cambios) ───────────
// Registra la decisión inmutable en client_approvals y avanza/regresa la
// etapa vía el RPC client_decision. Luego invalida ["operacion"].
export async function mutateClientDecision(
  materialId: string,
  decision: "aprobado" | "cambios",
  versionId: string | null,
  comentario: string,
) {
  const res = await api.approvals.clientDecision(
    materialId,
    decision,
    versionId,
    comentario,
  );
  if (res.error && res.error.startsWith("Candado:"))
    await api.registrarBloqueo(materialId, decision, res.error);
  if (!res.error) await invalidateOperacion();
  return res;
}
