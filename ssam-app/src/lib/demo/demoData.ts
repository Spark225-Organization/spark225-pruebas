// Base ficticia del modo demo. Todo lo de aquí es inventado: laboratorios,
// productos, personas y materiales no corresponden a clientes reales.
// Las fechas se calculan respecto a hoy para que riesgos, pronósticos y
// tableros se vean vivos.

import { DEMO_ADMIN_ID, DEMO_CLIENTE_ID, DEMO_CLIENTE_EMPRESA } from "./demoState";

export type Fila = Record<string, any>;
export type Base = Record<string, Fila[]>;

const ESTADOS = [
  "ideacion",
  "desarrollo_medico",
  "revision_direccion",
  "aprobacion_cliente_medico",
  "desarrollo_grafico",
  "revision_direccion_grafico",
  "validacion_medica_final",
  "aprobacion_cliente_grafico",
  "sometimiento_final",
  "crc",
  "aprobado",
  "produccion",
  "implementado",
  "archivado",
];
export const IDX: Record<string, number> = Object.fromEntries(ESTADOS.map((s, i) => [s, i]));
export const estadosOrden = ESTADOS;

// Generador pseudoaleatorio con semilla: los mismos datos en cada carga.
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let contador = 0;
export function nuevoId(prefijo = "e") {
  contador += 1;
  const r = Math.floor(Math.random() * 1e12).toString(16).padStart(12, "0");
  const n = contador.toString(16).padStart(4, "0");
  const p = (prefijo + "0000000").slice(0, 8);
  return `${p}-${n}-4000-8000-${r}`;
}

const DIA = 86400000;
export const hoy0 = () => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
};
export const iso = (d: Date) => d.toISOString();
export const fecha = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA);

export function crearBase(): Base {
  const r = azar(225);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const hoy = hoy0();

  // ── Clientes ficticios ──
  const clientes: Fila[] = [
    { id: DEMO_CLIENTE_EMPRESA, nombre: "Laboratorios Aurora", email: "marketing@aurora-demo.mx", telefono: "55 0000 1001", estado: "activo", etiqueta_codigo_interno: "Código Aurora", etiqueta_codigo_regulatorio: "Aviso COFEPRIS", etiqueta_sistema_aprobacion: "ID en Veeva", especificaciones_impresion_default: "Couché 150 g, 4×4 tintas, barniz a registro" },
    { id: "c0000000-0000-4000-8000-000000000002", nombre: "BioNova Pharma", email: "brand@bionova-demo.mx", telefono: "55 0000 1002", estado: "activo", etiqueta_codigo_interno: "Código BioNova", etiqueta_codigo_regulatorio: "Aviso COFEPRIS", etiqueta_sistema_aprobacion: "ID PromoMats", especificaciones_impresion_default: "Bond 120 g, 4×0 tintas" },
    { id: "c0000000-0000-4000-8000-000000000003", nombre: "Farmacéutica Delta", email: "comunicacion@delta-demo.mx", telefono: "55 0000 1003", estado: "activo", etiqueta_codigo_interno: "Folio Delta", etiqueta_codigo_regulatorio: "Aviso COFEPRIS", etiqueta_sistema_aprobacion: "ID Zinc", especificaciones_impresion_default: null },
  ].map((c) => ({ ...c, created_at: iso(masDias(hoy, -240)) }));

  const unidades: Fila[] = [
    { cliente: 0, nombre: "Cardiometabólico" },
    { cliente: 0, nombre: "Sistema nervioso central" },
    { cliente: 1, nombre: "Respiratorio" },
    { cliente: 2, nombre: "Salud de la mujer" },
  ].map((u, i) => ({ id: `b0000000-0000-4000-8000-00000000000${i + 1}`, cliente_id: clientes[u.cliente].id, nombre: u.nombre, estado: "activo", created_at: iso(masDias(hoy, -230)) }));

  const indicaciones: Fila[] = ["Hipertensión arterial", "Diabetes tipo 2", "Migraña", "Asma", "Osteoporosis", "Dislipidemia"].map((n, i) => ({
    id: `a0000000-0000-4000-8000-00000000000${i + 1}`, nombre: n, estado: "activo", created_at: iso(masDias(hoy, -230)),
  }));

  const productos: Fila[] = [
    { n: "Cardiolex 10 mg", c: 0, u: 0, ind: [0, 5] },
    { n: "Glucanova XR", c: 0, u: 0, ind: [1] },
    { n: "Neurafen", c: 0, u: 1, ind: [2] },
    { n: "Respiral Inhalador", c: 1, u: 2, ind: [3] },
    { n: "Bionasal", c: 1, u: 2, ind: [3] },
    { n: "Ossea D", c: 2, u: 3, ind: [4] },
    { n: "Lipiden 20 mg", c: 2, u: 3, ind: [5] },
  ].map((p, i) => ({ id: `90000000-0000-4000-8000-00000000000${i + 1}`, nombre: p.n, cliente_id: clientes[p.c].id, unidad_id: unidades[p.u].id, estado: "activo", created_at: iso(masDias(hoy, -220)), _ind: p.ind }));

  // ── Personas ficticias ──
  const perfiles: Fila[] = [
    { id: DEMO_ADMIN_ID, nombre: "Admin demo", email: "admin@demo.spark225.mx", rol: "admin", cliente_id: null },
    { id: DEMO_CLIENTE_ID, nombre: "Cliente demo (Aurora)", email: "cliente@aurora-demo.mx", rol: "cliente", cliente_id: DEMO_CLIENTE_EMPRESA },
    { id: "e1000000-0000-4000-8000-000000000003", nombre: "Dra. Valeria Ríos", email: "medico@demo.spark225.mx", rol: "medical", cliente_id: null },
    { id: "e1000000-0000-4000-8000-000000000004", nombre: "Diego Montes", email: "diseno@demo.spark225.mx", rol: "creativo", cliente_id: null },
    { id: "e1000000-0000-4000-8000-000000000005", nombre: "Sofía Lara", email: "diseno2@demo.spark225.mx", rol: "creativo", cliente_id: null },
    { id: "e1000000-0000-4000-8000-000000000006", nombre: "Iván Peña", email: "veeva@demo.spark225.mx", rol: "veeva", cliente_id: null },
    { id: "e1000000-0000-4000-8000-000000000007", nombre: "Marta Gil (BioNova)", email: "marta@bionova-demo.mx", rol: "cliente", cliente_id: clientes[1].id },
  ].map((p) => ({ ...p, estado: "activo", created_at: iso(masDias(hoy, -200)) }));
  const internos = perfiles.filter((p) => p.rol !== "cliente" && p.rol !== "admin");

  // ── Materiales ──
  const formatos = ["Visual de ayuda", "Folleto para paciente", "Banner digital", "Email médico", "Video corto", "Infografía", "Presentación para congreso", "Post para redes"];
  const temas = ["lanzamiento", "beneficios clave", "posología", "estudio clínico", "adherencia", "mecanismo de acción", "preguntas frecuentes", "recordatorio de marca"];
  // Distribución de etapas: hay de todo para ver Kanban, riesgo y portal.
  const plan = [0, 1, 1, 2, 3, 3, 3, 4, 4, 5, 6, 7, 7, 7, 8, 9, 9, 10, 10, 10, 11, 11, 12, 12, 12, 13, 1, 4, 7, 10, 3, 12];

  const materiales: Fila[] = [];
  const historial: Fila[] = [];
  const comentarios: Fila[] = [];
  const aprobaciones: Fila[] = [];
  const archivos: Fila[] = [];
  const versiones: Fila[] = [];
  const cambiosFecha: Fila[] = [];
  const paquete: Fila[] = [];
  const candados: Fila[] = [];

  plan.forEach((etapa, i) => {
    const prod = productos[i % productos.length];
    const cli = clientes.find((c) => c.id === prod.cliente_id)!;
    const ind = indicaciones[pick(prod._ind as number[])];
    const resp = pick(internos);
    const formato = formatos[i % formatos.length];
    const id = `f0000000-0000-4000-8000-${(i + 1).toString().padStart(12, "0")}`;
    // Cuántos días lleva: más avanzado, más antiguo.
    const edad = Math.round(6 + etapa * 5 + r() * 12);
    const solicitado = masDias(hoy, -edad);
    const duraEtapa = 2 + Math.round(r() * 4);
    // Fechas de etapa: cada etapa dura unos días hasta la actual.
    let t = solicitado;
    for (let k = 0; k <= etapa; k++) {
      const fin = k < etapa ? masDias(t, 1 + Math.round(r() * 3)) : null;
      historial.push({ id: nuevoId("h"), material_id: id, status: ESTADOS[k], inicio: iso(t), fin: fin ? iso(fin) : null });
      if (fin) t = fin;
    }
    const restantes = Math.max(0, 10 - etapa);
    const comprometidaOriginal = masDias(solicitado, 30 + Math.round(r() * 10));
    // Algunos van tarde a propósito.
    const tarde = i % 6 === 2 && etapa < 10;
    const comprometida = tarde ? masDias(hoy, -(2 + (i % 5))) : masDias(hoy, restantes * 3 + 4 + Math.round(r() * 6));
    const requerida = masDias(comprometida, (i % 4) - 1);
    const aprobadoAt = etapa >= 10 ? masDias(solicitado, edad - 3) : null;
    const conCodigos = etapa >= 9;
    const codigosAt = conCodigos ? masDias(t, -1) : null;
    const entregado = etapa >= 11 && i % 5 !== 0 ? masDias(codigosAt!, 1) : null;
    const visible = etapa >= 2 || i % 3 === 0;

    materiales.push({
      id,
      folio: 1000 + i + 1,
      titulo: `${formato} · ${prod.nombre} · ${temas[i % temas.length]}`,
      cliente_id: cli.id,
      producto_id: prod.id,
      indicacion_id: ind.id,
      unidad_id: prod.unidad_id,
      status: ESTADOS[etapa],
      prioridad: pick(["alta", "media", "media", "baja"]),
      formato_material: formato,
      responsable_principal_id: resp.id,
      fecha_solicitud: fecha(solicitado),
      fecha_comprometida: fecha(comprometida),
      fecha_comprometida_original: fecha(comprometidaOriginal),
      fecha_requerida_cliente: fecha(requerida),
      motivo_fecha_requerida: null,
      visible_para_cliente: visible,
      version: `v${1 + (etapa > 4 ? 1 : 0) + (etapa > 7 ? 1 : 0)}`,
      codigo_aprobacion_interna: conCodigos ? `AUR-${2026}-${(300 + i).toString()}` : null,
      codigo_regulatorio: conCodigos ? `${(253300 + i * 7).toString()}P${(i % 9) + 1}` : null,
      id_sistema_aprobacion: conCodigos ? `VV-${(88000 + i * 13).toString()}` : null,
      codigos_registrados_at: codigosAt ? iso(codigosAt) : null,
      paquete_final_entregado_at: entregado ? iso(entregado) : null,
      aprobado_at: aprobadoAt ? iso(aprobadoAt) : null,
      created_at: iso(solicitado),
      updated_at: iso(masDias(hoy, -Math.round(r() * 3))),
      _duraEtapa: duraEtapa,
    });

    if (tarde && etapa > 0) {
      cambiosFecha.push({ id: nuevoId("d"), material_id: id, fecha_anterior: fecha(comprometidaOriginal), fecha_nueva: fecha(comprometida), motivo: "El cliente pidió ajustar el mensaje principal.", categoria: "cliente", changed_by: resp.id, changed_by_name: resp.nombre, changed_at: iso(masDias(hoy, -6)) });
    }

    // Archivos: a partir del desarrollo hay al menos una pieza.
    if (etapa >= 1) {
      const fileId = nuevoId("a");
      const nVers = etapa >= 7 ? 3 : etapa >= 4 ? 2 : 1;
      archivos.push({ id: fileId, material_id: id, nombre: `${formato.replace(/ /g, "_")}_${prod.nombre.split(" ")[0]}.pdf`, tipo: "application/pdf", created_by: resp.id, created_at: iso(masDias(solicitado, 2)) });
      for (let v = 1; v <= nVers; v++) {
        versiones.push({ id: nuevoId("b"), file_id: fileId, version_number: v, storage_path: `demo/${id}/${fileId}/v${v}.pdf`, tamano_bytes: 480000 + v * 91000, visibilidad: "visible_para_cliente", es_final: v === nVers, subido_por: resp.id, fecha_carga: iso(masDias(solicitado, 2 + v * 4)) });
      }
      if (etapa >= 4) {
        const imgId = nuevoId("a");
        archivos.push({ id: imgId, material_id: id, nombre: `Arte_${prod.nombre.split(" ")[0]}.png`, tipo: "image/png", created_by: resp.id, created_at: iso(masDias(solicitado, 8)) });
        versiones.push({ id: nuevoId("b"), file_id: imgId, version_number: 1, storage_path: `demo/${id}/${imgId}/v1.png`, tamano_bytes: 820000, visibilidad: "visible_para_cliente", es_final: true, subido_por: resp.id, fecha_carga: iso(masDias(solicitado, 9)) });
      }
    }

    // Conversación: notas internas y comentarios con el cliente.
    if (etapa >= 2) {
      comentarios.push({ id: nuevoId("c"), material_id: id, texto: "Referencias revisadas; falta validar la cita del estudio en la lámina 3.", autor_id: internos[0].id, visibilidad: "interno", parent_id: null, version_id: null, requiere_cambio: false, estado: "resuelto", created_at: iso(masDias(solicitado, 5)) });
    }
    if (etapa >= 3) {
      const cc = { id: nuevoId("c"), material_id: id, texto: "¿Podemos destacar más el beneficio principal en la portada?", autor_id: cli.id === DEMO_CLIENTE_EMPRESA ? DEMO_CLIENTE_ID : perfiles[6].id, visibilidad: "visible_para_cliente", parent_id: null, version_id: null, requiere_cambio: etapa === 3 || etapa === 7, estado: etapa === 3 || etapa === 7 ? "abierto" : "resuelto", created_at: iso(masDias(solicitado, 9)) };
      comentarios.push(cc);
      comentarios.push({ id: nuevoId("c"), material_id: id, texto: "Claro, lo ajustamos en la siguiente versión.", autor_id: resp.id, visibilidad: "visible_para_cliente", parent_id: cc.id, version_id: null, requiere_cambio: false, estado: "resuelto", created_at: iso(masDias(solicitado, 10)) });
    }
    if (etapa >= 4) {
      aprobaciones.push({ id: nuevoId("p"), material_id: id, stage: "aprobacion_cliente_medico", decision: i % 4 === 0 ? "cambios" : "aprobado", approver_id: cli.id === DEMO_CLIENTE_EMPRESA ? DEMO_CLIENTE_ID : perfiles[6].id, comentario: i % 4 === 0 ? "Ajustar el claim de eficacia." : "Contenido médico aprobado.", version_id: null, created_at: iso(masDias(solicitado, 12)) });
    }
    if (etapa >= 8) {
      aprobaciones.push({ id: nuevoId("p"), material_id: id, stage: "aprobacion_cliente_grafico", decision: "aprobado", approver_id: cli.id === DEMO_CLIENTE_EMPRESA ? DEMO_CLIENTE_ID : perfiles[6].id, comentario: "Diseño aprobado.", version_id: null, created_at: iso(masDias(solicitado, 22)) });
    }
    if (etapa >= 10) {
      ["PDF final para impresión", "Archivos abiertos (AI/INDD)", "Versión digital optimizada"].forEach((n, k) => {
        const ok = !!entregado || k === 0;
        paquete.push({ id: nuevoId("q"), material_id: id, item_name: n, detalle: null, entregado: ok, entregado_by: ok ? resp.id : null, entregado_by_name: ok ? resp.nombre : null, entregado_at: ok ? iso(entregado ?? masDias(hoy, -1)) : null });
      });
    }
    if (i % 9 === 4) {
      candados.push({ id: nuevoId("k"), material_id: id, status_desde: ESTADOS[etapa], status_hacia: ESTADOS[Math.min(etapa + 1, 13)], status_destino: ESTADOS[Math.min(etapa + 1, 13)], mensaje: "Candado: falta la aprobación del cliente antes de avanzar.", usuario: resp.id, created_at: iso(masDias(hoy, -3)) });
    }
  });

  return {
    clients: clientes,
    business_units: unidades,
    products: productos.map(({ _ind, ...p }) => p),
    indications: indicaciones,
    profiles: perfiles,
    materials: materiales.map(({ _duraEtapa, ...m }) => m),
    status_history: historial,
    comments: comentarios,
    approvals: aprobaciones,
    files: archivos,
    file_versions: versiones,
    commitment_date_changes: cambiosFecha,
    final_package_items: paquete,
    candado_events: candados,
    material_assignees: [],
    regulatory_reviews: [],
  };
}

// ── Vistas calculadas a partir de las tablas (siempre al día) ──────────────

const ACTIVOS_HASTA = IDX["crc"]; // de ideación a CRC = en curso
const diasEntre = (a?: string | null, b?: string | null) =>
  a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DIA)) : null;

function depende(status: string) {
  if (status === "aprobacion_cliente_medico" || status === "aprobacion_cliente_grafico") return "cliente";
  if (status === "sometimiento_final" || status === "crc") return "cliente_regulatorio";
  return "spark225";
}

function etapaCliente(status: string) {
  const i = IDX[status] ?? 0;
  if (i === 0) return "Planeado";
  if (status === "aprobacion_cliente_medico" || status === "aprobacion_cliente_grafico") return "En revisión cliente";
  if (i >= 8 && i <= 9) return "En aprobación regulatoria";
  if (i >= 10) return "Aprobado";
  return "En desarrollo";
}

export function calcularVista(nombre: string, db: Base): Fila[] | null {
  const hoy = hoy0();
  const porId = <T extends Fila>(t: T[]) => new Map(t.map((x) => [x.id, x]));
  const cli = porId(db.clients);
  const prod = porId(db.products);
  const ind = porId(db.indications);
  const uni = porId(db.business_units);
  const per = porId(db.profiles);
  const nombreDe = (m: Fila) => ({
    cliente: cli.get(m.cliente_id)?.nombre ?? null,
    producto: prod.get(m.producto_id)?.nombre ?? null,
    indicacion: ind.get(m.indicacion_id)?.nombre ?? null,
    unidad: uni.get(m.unidad_id)?.nombre ?? null,
    responsable: per.get(m.responsable_principal_id)?.nombre ?? null,
  });
  const hist = (id: string) => db.status_history.filter((h) => h.material_id === id).sort((a, b) => a.inicio.localeCompare(b.inicio));

  switch (nombre) {
    case "v_material_hierarchy":
      return db.materials.map((m) => ({ material_id: m.id, folio: m.folio, ...nombreDe(m) }));

    case "v_material_metrics":
      return db.materials.map((m) => {
        const n = nombreDe(m);
        const h = hist(m.id);
        const dias = (f: (s: string) => boolean) =>
          h.filter((x) => f(x.status)).reduce((s, x) => s + (diasEntre(x.inicio, x.fin ?? iso(hoy)) ?? 0), 0);
        const cambios = db.approvals.filter((a) => a.material_id === m.id && a.decision === "cambios").length;
        const rondas = db.approvals.filter((a) => a.material_id === m.id).length;
        const fin = m.aprobado_at ?? null;
        const aTiempo = fin ? fin.slice(0, 10) <= m.fecha_comprometida : m.fecha_comprometida >= fecha(hoy);
        const cambiosFecha = db.commitment_date_changes.filter((c) => c.material_id === m.id);
        return {
          material_id: m.id, folio: m.folio, name: m.titulo,
          client_id: m.cliente_id, client_name: n.cliente,
          product_id: m.producto_id, product_name: n.producto,
          indication_id: m.indicacion_id, indication_name: n.indicacion,
          responsible_id: m.responsable_principal_id, responsible_name: n.responsable,
          status: m.status,
          fecha_comprometida: m.fecha_comprometida,
          fecha_comprometida_original: m.fecha_comprometida_original,
          fecha_requerida_cliente: m.fecha_requerida_cliente,
          a_tiempo: aTiempo, a_tiempo_vs_actual: aTiempo,
          a_tiempo_vs_original: fin ? fin.slice(0, 10) <= m.fecha_comprometida_original : m.fecha_comprometida_original >= fecha(hoy),
          a_tiempo_vs_requerida: fin ? fin.slice(0, 10) <= m.fecha_requerida_cliente : m.fecha_requerida_cliente >= fecha(hoy),
          ciclo_dias: diasEntre(m.fecha_solicitud, fin ?? iso(hoy)),
          rondas_con_cliente: rondas,
          aprobado_primera_ronda: rondas > 0 && cambios === 0,
          rechazos: cambios,
          dias_spark225: dias((s) => depende(s) === "spark225"),
          dias_cliente: dias((s) => depende(s) === "cliente"),
          dias_regulatorio: dias((s) => depende(s) === "cliente_regulatorio"),
          dias_en_cola: Math.round((m.folio % 3) * 0.7),
          horas_paquete: m.paquete_final_entregado_at && m.codigos_registrados_at ? Math.round((new Date(m.paquete_final_entregado_at).getTime() - new Date(m.codigos_registrados_at).getTime()) / 3600000) : null,
          cambios_fecha: cambiosFecha.length,
          cambios_fecha_spark225: cambiosFecha.filter((c) => c.categoria === "spark225").length,
          errores_spark: m.folio % 7 === 0 ? 1 : 0,
          cambios_pedidos_cliente: cambios,
          aprobado_sin_error_spark: m.folio % 7 !== 0,
          dias_respuesta_cliente: 1 + (m.folio % 4),
          revisiones_crc: IDX[m.status] >= IDX["crc"] ? 1 + (m.folio % 2) : 0,
          crc_primera: m.folio % 2 === 1,
          bloqueos: db.candado_events.filter((c) => c.material_id === m.id).length,
          comentarios_abiertos: db.comments.filter((c) => c.material_id === m.id && c.estado === "abierto").length,
          dependencia: depende(m.status),
          created_at: m.created_at, updated_at: m.updated_at,
          aprobado_at: m.aprobado_at, fecha_solicitud: m.fecha_solicitud,
          paquete_final_entregado_at: m.paquete_final_entregado_at,
          codigo_aprobacion_interna: m.codigo_aprobacion_interna,
        };
      });

    case "v_stage_durations":
      return db.status_history.map((h) => {
        const m = db.materials.find((x) => x.id === h.material_id);
        const d = diasEntre(h.inicio, h.fin ?? iso(hoy)) ?? 0;
        return {
          material_id: h.material_id, material_name: m?.titulo ?? "", client_name: m ? cli.get(m.cliente_id)?.nombre ?? null : null,
          status: h.status, fecha_inicio: h.inicio, fecha_fin: h.fin, dias: d,
          dias_en_cola: Math.min(1, d), dias_trabajo: Math.max(0, d - 1), en_curso: !h.fin, depende_de: depende(h.status),
        };
      });

    case "v_material_timeline":
      return db.materials.flatMap((m) => {
        const h = hist(m.id);
        const filas: Fila[] = h.map((x, k) => ({ material_id: m.id, orden: k + 1, status: x.status, etapa_cliente: etapaCliente(x.status), depende_de: depende(x.status), inicio: x.inicio, fin: x.fin, tipo: x.fin ? "hecho" : "en_curso" }));
        let t = h.length ? new Date(h[h.length - 1].fin ?? iso(hoy)) : hoy;
        for (let k = IDX[m.status] + 1; k <= IDX["aprobado"]; k++) {
          const fin = masDias(t, 3);
          filas.push({ material_id: m.id, orden: filas.length + 1, status: ESTADOS[k], etapa_cliente: etapaCliente(ESTADOS[k]), depende_de: depende(ESTADOS[k]), inicio: iso(t), fin: iso(fin), tipo: "estimado" });
          t = fin;
        }
        return filas;
      });

    case "v_monthly_trend": {
      const filas: Fila[] = [];
      for (let k = 5; k >= 0; k--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
        const mes = d.toISOString().slice(0, 7);
        filas.push({
          mes: `${mes}-01`,
          solicitados: db.materials.filter((m) => (m.fecha_solicitud ?? "").startsWith(mes)).length + (k > 1 ? 3 + k : 0),
          aprobados: db.materials.filter((m) => (m.aprobado_at ?? "").startsWith(mes)).length + (k > 1 ? 2 + k : 0),
        });
      }
      return filas;
    }

    case "v_workload":
      return db.profiles
        .filter((p) => p.rol !== "cliente")
        .map((p) => {
          const suyos = db.materials.filter((m) => m.responsable_principal_id === p.id && IDX[m.status] <= ACTIVOS_HASTA);
          return { responsible_id: p.id, responsible_name: p.nombre, activos: suyos.length, en_desarrollo: suyos.filter((m) => m.status.startsWith("desarrollo")).length };
        })
        .filter((w) => w.activos > 0);

    case "materiales_en_riesgo":
      return db.materials.flatMap((m) => {
        const out: Fila[] = [];
        const i = IDX[m.status];
        if (i < IDX["aprobado"] && m.fecha_comprometida < fecha(hoy)) {
          out.push({ material_id: m.id, titulo: m.titulo, cliente_id: m.cliente_id, status: m.status, responsable_principal_id: m.responsable_principal_id, responsable: depende(m.status) === "spark225" ? "Spark225" : "Cliente", riesgo: "fecha_vencida", dias: diasEntre(m.fecha_comprometida, iso(hoy)) });
        }
        if (m.codigos_registrados_at && !m.paquete_final_entregado_at && (diasEntre(m.codigos_registrados_at, iso(hoy)) ?? 0) >= 1) {
          out.push({ material_id: m.id, titulo: m.titulo, cliente_id: m.cliente_id, status: m.status, responsable_principal_id: m.responsable_principal_id, responsable: "Spark225", riesgo: "paquete_atrasado", dias: diasEntre(m.codigos_registrados_at, iso(hoy)) });
        }
        return out;
      });

    case "v_material_forecast":
      return db.materials
        .filter((m) => IDX[m.status] < IDX["aprobado"])
        .map((m) => {
          const faltan = IDX["aprobado"] - IDX[m.status];
          const est = masDias(hoy, faltan * 3);
          const max = masDias(hoy, faltan * 4 + 2);
          const margen = diasEntre(fecha(est), m.fecha_comprometida);
          const margenReal = new Date(m.fecha_comprometida).getTime() >= est.getTime() ? margen : -(diasEntre(m.fecha_comprometida, fecha(est)) ?? 0);
          const h = hist(m.id);
          const ult = h[h.length - 1];
          return {
            material_id: m.id, titulo: m.titulo, client_id: m.cliente_id, status: m.status, depende_de: depende(m.status),
            dias_en_etapa: ult ? diasEntre(ult.inicio, iso(hoy)) : 0,
            entrega_estimada: fecha(est), entrega_estimada_max: fecha(max),
            fecha_comprometida: m.fecha_comprometida, fecha_requerida_cliente: m.fecha_requerida_cliente,
            margen_dias: margenReal,
            estado_pronostico: margenReal == null ? "sin_fecha" : margenReal < 0 ? "tarde" : margenReal <= 3 ? "justo" : "a_tiempo",
          };
        });

    case "client_materials":
      return db.materials.map((m) => {
        const n = nombreDe(m);
        const c = cli.get(m.cliente_id);
        return {
          id: m.id, titulo: m.titulo, name: m.titulo, cliente_id: m.cliente_id, cliente: n.cliente,
          producto_id: m.producto_id, producto: n.producto, product_name: n.producto,
          indicacion_id: m.indicacion_id, indicacion: n.indicacion, formato_material: m.formato_material,
          prioridad: m.prioridad, etapa: etapaCliente(m.status), status: m.status, depende_de: depende(m.status),
          fecha_solicitud: m.fecha_solicitud, fecha_comprometida: m.fecha_comprometida,
          fecha_entrega_final: m.paquete_final_entregado_at?.slice(0, 10) ?? null,
          etiqueta_codigo_interno: c?.etiqueta_codigo_interno ?? null, codigo_aprobacion_interna: m.codigo_aprobacion_interna,
          etiqueta_codigo_regulatorio: c?.etiqueta_codigo_regulatorio ?? null, codigo_regulatorio: m.codigo_regulatorio,
          etiqueta_sistema_aprobacion: c?.etiqueta_sistema_aprobacion ?? null, id_sistema_aprobacion: m.id_sistema_aprobacion,
          paquete_final_entregado_at: m.paquete_final_entregado_at, updated_at: m.updated_at,
          visible_para_cliente: m.visible_para_cliente,
        };
      });

    case "paquetes_pendientes":
      return db.materials
        .filter((m) => m.codigos_registrados_at && !m.paquete_final_entregado_at)
        .map((m) => ({ id: m.id, name: m.titulo, titulo: m.titulo, cliente_id: m.cliente_id, client_name: cli.get(m.cliente_id)?.nombre ?? null, codigos_registrados_at: m.codigos_registrados_at }));

    case "v_client_kpis": {
      const ms = db.materials;
      const aprob = ms.filter((m) => IDX[m.status] >= IDX["aprobado"]);
      const aTiempo = aprob.filter((m) => (m.aprobado_at ?? "").slice(0, 10) <= m.fecha_comprometida);
      const ciclos = aprob.map((m) => diasEntre(m.fecha_solicitud, m.aprobado_at) ?? 0).sort((a, b) => a - b);
      const conPaquete = ms.filter((m) => m.paquete_final_entregado_at && m.codigos_registrados_at);
      const en24 = conPaquete.filter((m) => new Date(m.paquete_final_entregado_at).getTime() - new Date(m.codigos_registrados_at).getTime() <= 24 * 3600000);
      return [{
        total: ms.length,
        en_curso: ms.filter((m) => IDX[m.status] <= ACTIVOS_HASTA).length,
        aprobados: aprob.length,
        a_tiempo: aTiempo.length,
        a_tiempo_pct: aprob.length ? Math.round((aTiempo.length / aprob.length) * 100) : null,
        ciclo_dias_mediana: ciclos.length ? ciclos[Math.floor(ciclos.length / 2)] : null,
        paquete_24h_pct: conPaquete.length ? Math.round((en24.length / conPaquete.length) * 100) : null,
        en_cancha_cliente: ms.filter((m) => depende(m.status) !== "spark225" && IDX[m.status] <= ACTIVOS_HASTA).length,
      }];
    }

    case "v_client_timeline":
      return db.status_history.map((h) => {
        const m = db.materials.find((x) => x.id === h.material_id);
        return {
          material_id: h.material_id, cliente_id: m?.cliente_id, name: m?.titulo ?? "", product_name: m ? prod.get(m.producto_id)?.nombre ?? null : null,
          etapa: etapaCliente(h.status), fecha_inicio: h.inicio?.slice(0, 10) ?? null, fecha_fin: h.fin?.slice(0, 10) ?? null,
          dias: diasEntre(h.inicio, h.fin ?? iso(hoy)), fecha_comprometida: m?.fecha_comprometida ?? null,
        };
      });
  }
  return null;
}
