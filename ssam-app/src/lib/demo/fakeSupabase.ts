// Cliente «Supabase» de mentira para el modo demo. Implementa lo que usa la
// app (from/select/eq/in/order/insert/update/delete/rpc/storage/auth/channel)
// sobre la base ficticia, guardada en este navegador.
// Imita las reglas de acceso: el cliente demo solo ve lo de su laboratorio,
// lo marcado como visible y los comentarios no internos.

import { crearBase, calcularVista, nuevoId, iso, fecha, hoy0, estadosOrden, IDX, type Base, type Fila } from "./demoData";
import { rolDemo, guardarRolDemo, DEMO_ADMIN_ID, DEMO_CLIENTE_ID, DEMO_CLIENTE_EMPRESA, DEMO_DISENADOR_ID } from "./demoState";

const CLAVE_BASE = "ssam-demo-base-v5"; // v5: Paco con sus clientes asignados

function cargar(): Base {
  try {
    const t = localStorage.getItem(CLAVE_BASE);
    if (t) return JSON.parse(t);
  } catch {
    /* base nueva */
  }
  return crearBase();
}
let db: Base = cargar();
let guardado: ReturnType<typeof setTimeout> | null = null;
function guardar() {
  if (guardado) clearTimeout(guardado);
  guardado = setTimeout(() => {
    try {
      localStorage.setItem(CLAVE_BASE, JSON.stringify(db));
    } catch {
      /* sin almacenamiento: los cambios duran la sesión */
    }
  }, 150);
}
/** Regresa la base ficticia a como venía de fábrica. */
export function reiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE_BASE);
    localStorage.removeItem(CLAVE_ARCHIVOS);
  } catch {
    /* nada */
  }
  db = crearBase();
}

// ── Quién soy y qué puedo ver ─────────────────────────────────────────────
const yo = () => (rolDemo() === "client" ? DEMO_CLIENTE_ID : rolDemo() === "admin" ? DEMO_ADMIN_ID : rolDemo() === "disenador" ? DEMO_DISENADOR_ID : null);
const soyCliente = () => rolDemo() === "client";

function baseVisible(): Base {
  if (!soyCliente()) return db;
  const mios = new Set(
    db.materials.filter((m) => m.cliente_id === DEMO_CLIENTE_EMPRESA && m.visible_para_cliente).map((m) => m.id),
  );
  const archivosMios = new Set(db.files.filter((f) => mios.has(f.material_id)).map((f) => f.id));
  const porMaterial = (t: Fila[]) => t.filter((x) => mios.has(x.material_id));
  return {
    ...db,
    clients: db.clients.filter((c) => c.id === DEMO_CLIENTE_EMPRESA),
    business_units: db.business_units.filter((u) => u.cliente_id === DEMO_CLIENTE_EMPRESA),
    products: db.products.filter((p) => p.cliente_id === DEMO_CLIENTE_EMPRESA),
    materials: db.materials.filter((m) => mios.has(m.id)),
    status_history: porMaterial(db.status_history),
    comments: porMaterial(db.comments).filter((c) => c.visibilidad !== "interno"),
    approvals: porMaterial(db.approvals),
    files: db.files.filter((f) => archivosMios.has(f.id)),
    file_versions: db.file_versions.filter((v) => archivosMios.has(v.file_id) && v.visibilidad !== "interno"),
    commitment_date_changes: porMaterial(db.commitment_date_changes),
    final_package_items: porMaterial(db.final_package_items),
    candado_events: [],
    material_assignees: porMaterial(db.material_assignees),
    pre_send_items: [],
    checklist_templates: [],
  };
}

function leer(tabla: string): Fila[] {
  const vis = baseVisible();
  const vista = calcularVista(tabla, vis);
  if (vista) return vista;
  return vis[tabla] ?? [];
}

// ── Relaciones embebidas: "clients(nombre)", "profiles!x_fkey(nombre)", "file_versions(...)" ──
type Embebido = { nombre: string; pista: string | null; campos: string };
function partirSelect(sel: string): Embebido[] {
  const out: Embebido[] = [];
  let nivel = 0;
  let actual = "";
  const piezas: string[] = [];
  for (const ch of sel) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) {
      piezas.push(actual.trim());
      actual = "";
    } else actual += ch;
  }
  if (actual.trim()) piezas.push(actual.trim());
  for (const p of piezas) {
    const m = p.match(/^([a-z_]+)(?:!([a-z_]+))?\((.*)\)$/s);
    if (m) out.push({ nombre: m[1], pista: m[2] ?? null, campos: m[3] });
  }
  return out;
}

const LLAVE_A: Record<string, string> = { clients: "cliente_id", products: "producto_id", indications: "indicacion_id", business_units: "unidad_id", profiles: "responsable_principal_id" };

function embeber(tabla: string, filas: Fila[], sel: string): Fila[] {
  const emb = partirSelect(sel);
  if (!emb.length) return filas;
  return filas.map((f) => {
    const r: Fila = { ...f };
    for (const e of emb) {
      if (e.nombre === "file_versions") {
        r.file_versions = leer("file_versions").filter((v) => v.file_id === f.id);
        continue;
      }
      let col = LLAVE_A[e.nombre] ?? `${e.nombre}_id`;
      if (e.pista && e.pista.endsWith("_fkey")) col = e.pista.replace(/_fkey$/, "").replace(new RegExp(`^${tabla}_`), "");
      const destino = db[e.nombre] ?? [];
      r[e.nombre] = destino.find((x) => x.id === f[col]) ?? null;
    }
    return r;
  });
}

// ── Constructor de consultas ──────────────────────────────────────────────
type Res = { data: any; error: { message: string } | null; count?: number | null };

class Consulta implements PromiseLike<Res> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private sel = "*";
  private conSelect = false;
  private carga: any = null;
  private filtros: ((r: Fila) => boolean)[] = [];
  private orden: { col: string; asc: boolean }[] = [];
  private tope: number | null = null;
  private rango: [number, number] | null = null;
  private modo: "uno" | "quizas" | null = null;
  private soloConteo = false;

  constructor(private tabla: string) {}

  select(s?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.sel = s ?? "*";
    else this.conSelect = true;
    if (s && this.op !== "select") this.sel = s;
    if (opts?.head) this.soloConteo = true;
    return this;
  }
  insert(p: any) { this.op = "insert"; this.carga = p; return this; }
  upsert(p: any) { this.op = "upsert"; this.carga = p; return this; }
  update(p: any) { this.op = "update"; this.carga = p; return this; }
  delete() { this.op = "delete"; return this; }

  eq(c: string, v: any) { this.filtros.push((r) => String(r[c]) === String(v)); return this; }
  neq(c: string, v: any) { this.filtros.push((r) => String(r[c]) !== String(v)); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs.map(String)); this.filtros.push((r) => s.has(String(r[c]))); return this; }
  is(c: string, v: any) { this.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  gt(c: string, v: any) { this.filtros.push((r) => r[c] > v); return this; }
  gte(c: string, v: any) { this.filtros.push((r) => r[c] >= v); return this; }
  lt(c: string, v: any) { this.filtros.push((r) => r[c] < v); return this; }
  lte(c: string, v: any) { this.filtros.push((r) => r[c] <= v); return this; }
  ilike(c: string, v: string) { const re = new RegExp("^" + v.replace(/%/g, ".*") + "$", "i"); this.filtros.push((r) => re.test(String(r[c] ?? ""))); return this; }
  like(c: string, v: string) { return this.ilike(c, v); }
  not(c: string, op: string, v: any) { this.filtros.push((r) => (op === "is" ? (v === null ? r[c] != null : r[c] !== v) : String(r[c]) !== String(v))); return this; }
  or() { return this; }
  filter() { return this; }
  match(o: Fila) { Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orden.push({ col: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.tope = n; return this; }
  range(a: number, b: number) { this.rango = [a, b]; return this; }
  single() { this.modo = "uno"; return this; }
  maybeSingle() { this.modo = "quizas"; return this; }

  private filtrar(filas: Fila[]) {
    return filas.filter((r) => this.filtros.every((f) => f(r)));
  }

  private ejecutar(): Res {
    let filas: Fila[] = [];
    const t = this.tabla;
    if (this.op === "select") {
      filas = this.filtrar(leer(t));
    } else if (this.op === "insert" || this.op === "upsert") {
      if (soyCliente() && !["comments", "approvals", "files", "file_versions"].includes(t)) return { data: null, error: { message: "Sin permiso en modo cliente." } };
      const lista = (Array.isArray(this.carga) ? this.carga : [this.carga]).map((p: Fila) => ({
        id: p.id ?? nuevoId("n"),
        created_at: iso(new Date()),
        ...p,
      }));
      db[t] = db[t] ?? [];
      for (const n of lista) {
        if (t === "comments" && !n.autor_id) n.autor_id = yo();
        if (t === "files" && !n.created_by) n.created_by = yo();
        const i = db[t].findIndex((x) => x.id === n.id);
        if (i >= 0) db[t][i] = { ...db[t][i], ...n };
        else db[t].push(n);
      }
      filas = lista;
      guardar();
    } else if (this.op === "update") {
      if (soyCliente() && t !== "comments") return { data: null, error: { message: "Sin permiso en modo cliente." } };
      const tocadas = this.filtrar(db[t] ?? []);
      tocadas.forEach((r) => Object.assign(r, this.carga));
      filas = tocadas;
      guardar();
    } else if (this.op === "delete") {
      if (soyCliente()) return { data: null, error: { message: "Sin permiso en modo cliente." } };
      const quitar = new Set(this.filtrar(db[t] ?? []).map((r) => r.id));
      db[t] = (db[t] ?? []).filter((r) => !quitar.has(r.id));
      guardar();
      return { data: null, error: null };
    }

    for (const o of [...this.orden].reverse()) {
      filas = [...filas].sort((a, b) => {
        const x = a[o.col], y = b[o.col];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
        return o.asc ? c : -c;
      });
    }
    const total = filas.length;
    if (this.rango) filas = filas.slice(this.rango[0], this.rango[1] + 1);
    if (this.tope != null) filas = filas.slice(0, this.tope);
    if (this.soloConteo) return { data: null, error: null, count: total };
    if (this.op === "select" || this.conSelect) filas = embeber(t, filas, this.sel);
    const copia = JSON.parse(JSON.stringify(filas));
    if (this.modo === "uno") return copia.length ? { data: copia[0], error: null } : { data: null, error: { message: "No se encontró el registro." } };
    if (this.modo === "quizas") return { data: copia[0] ?? null, error: null };
    return { data: copia, error: null, count: total };
  }

  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, mal?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return new Promise<Res>((res) => setTimeout(() => res(this.ejecutar()), 60)).then(ok, mal);
  }
}

// ── Acciones del servidor (RPC) ───────────────────────────────────────────
function material(id: string) {
  return db.materials.find((m) => m.id === id);
}
function moverA(m: Fila, nuevo: string) {
  const ahora = iso(new Date());
  const abierta = db.status_history.find((h) => h.material_id === m.id && !h.fin);
  if (abierta) abierta.fin = ahora;
  db.status_history.push({ id: nuevoId("h"), material_id: m.id, status: nuevo, inicio: ahora, fin: null });
  m.status = nuevo;
  m.updated_at = ahora;
  if (nuevo === "aprobado" && !m.aprobado_at) m.aprobado_at = ahora;
  if (nuevo === "crc" && !m.codigos_registrados_at) m.codigos_registrados_at = ahora;
}

function rpc(nombre: string, p: Fila): Res {
  const m = p.p_material_id ? material(p.p_material_id) : null;
  if (p.p_material_id && !m) return { data: null, error: { message: "Material no encontrado." } };
  switch (nombre) {
    case "change_material_status":
      if (soyCliente()) return { data: null, error: { message: "Sin permiso en modo cliente." } };
      moverA(m!, p.p_new_status);
      break;
    case "set_fecha_comprometida":
      db.commitment_date_changes.push({ id: nuevoId("d"), material_id: m!.id, fecha_anterior: m!.fecha_comprometida, fecha_nueva: p.p_fecha, motivo: p.p_motivo ?? "", categoria: p.p_categoria ?? "otro", changed_by: yo(), changed_by_name: "Admin demo", changed_at: iso(new Date()) });
      m!.fecha_comprometida = p.p_fecha;
      m!.updated_at = iso(new Date());
      break;
    case "set_fecha_requerida_cliente":
      m!.fecha_requerida_cliente = p.p_fecha;
      m!.motivo_fecha_requerida = p.p_motivo ?? null;
      m!.updated_at = iso(new Date());
      break;
    case "iniciar_trabajo":
      m!.updated_at = iso(new Date());
      break;
    case "registrar_bloqueo":
      db.candado_events.push({ id: nuevoId("k"), material_id: m!.id, status_desde: m!.status, status_hacia: p.p_status_destino, status_destino: p.p_status_destino, mensaje: p.p_mensaje, usuario: yo(), created_at: iso(new Date()) });
      break;
    case "client_decision": {
      db.approvals.push({ id: nuevoId("p"), material_id: m!.id, stage: m!.status, decision: p.p_decision, motivo: p.p_motivo ?? null, approver_id: yo(), comentario: p.p_comentario ?? null, version_id: p.p_version_id ?? null, created_at: iso(new Date()) });
      const i = IDX[m!.status];
      if (p.p_decision === "aprobado") moverA(m!, estadosOrden[Math.min(i + 1, estadosOrden.length - 1)]);
      else moverA(m!, m!.status === "aprobacion_cliente_medico" ? "desarrollo_medico" : "desarrollo_grafico");
      break;
    }
    default:
      return { data: null, error: { message: `Acción no disponible en la demo: ${nombre}` } };
  }
  guardar();
  return { data: true, error: null };
}

// ── Archivos: lo que se sube se guarda en este navegador; lo de fábrica es una muestra ──
const CLAVE_ARCHIVOS = "ssam-demo-archivos-v1";
// ruta → archivo (data URL) guardado en el navegador; en uso se sirve como blob URL.
const guardados = new Map<string, string>(
  (() => {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(CLAVE_ARCHIVOS) || "{}")) as [string, string][];
    } catch {
      return [];
    }
  })(),
);
function aBlobUrl(dato: string) {
  try {
    const [cab, b64] = dato.split(",");
    const tipo = cab.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: tipo }));
  } catch {
    return dato;
  }
}
const subidos = new Map<string, string>([...guardados.entries()].map(([k, v]) => [k, aBlobUrl(v)]));
function guardarArchivos() {
  const lista = [...guardados.entries()];
  // Si no cabe todo, se quitan los más viejos hasta que quepa.
  for (let desde = 0; desde <= lista.length; desde++) {
    try {
      localStorage.setItem(CLAVE_ARCHIVOS, JSON.stringify(Object.fromEntries(lista.slice(desde))));
      return;
    } catch {
      /* lleno: probar con menos */
    }
  }
}
function muestra(ruta: string) {
  const nombre = ruta.split("/").pop() ?? "archivo";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#F5C245"/><stop offset="1" stop-color="#E47739"/></linearGradient></defs><rect width="1200" height="800" fill="#F8F9FA"/><rect x="0" y="0" width="1200" height="14" fill="url(#g)"/><text x="600" y="380" font-family="Inter,Arial" font-size="44" font-weight="700" fill="#4E5964" text-anchor="middle">Material de muestra</text><text x="600" y="440" font-family="Inter,Arial" font-size="26" fill="#8894A0" text-anchor="middle">${nombre} · datos ficticios</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
// PDF de muestra de 3 páginas (texto ficticio) para probar la revisión página por página.
const pdfs = new Map<string, string>();
function pdfMuestra(ruta: string) {
  if (pdfs.has(ruta)) return pdfs.get(ruta)!;
  const limpio = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, "");
  const nombre = limpio((ruta.split("/").pop() ?? "material").replace(/\.pdf$/i, "").replace(/_/g, " "));
  const paginas = [
    ["Material de muestra", nombre, "Datos ficticios para probar la revision.", "Beneficio principal: mejora la adherencia al tratamiento.", "Referencia 1: Estudio clinico fase III, 2024.", "Referencia 2: Guia de practica clinica, 2023."],
    ["Mecanismo de accion", "Texto de ejemplo para subrayar o resaltar.", "Posologia: una tableta al dia con alimentos.", "Leyenda regulatoria: consulte la IPP.", "Registro sanitario: 000M0000 SSA IV."],
    ["Informacion para prescribir", "Contraindicaciones: hipersensibilidad.", "Reporte las sospechas de reacciones adversas.", "Aviso de publicidad: 000000000A0000.", "Spark225 - pieza de prueba"],
  ];
  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = paginas.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  paginas.forEach((lineas, i) => {
    const flujo = [
      "0.96 0.76 0.27 rg 0 579 842 16 re f",
      "0.89 0.47 0.22 rg 0 0 842 6 re f",
      "0.31 0.35 0.39 rg",
      `BT /F1 30 Tf 60 500 Td (${lineas[0]}) Tj ET`,
      ...lineas.slice(1).map((l, k) => `BT /F1 ${k === 0 && i === 0 ? 18 : 15} Tf 60 ${440 - k * 42} Td (${l}) Tj ET`),
      `BT /F1 10 Tf 740 24 Td (Pagina ${i + 1} de ${paginas.length}) Tj ET`,
    ].join("\n");
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  pdfs.set(ruta, url);
  return url;
}
const firmar = (ruta: string) => subidos.get(ruta) ?? (/\.pdf$/i.test(ruta) ? pdfMuestra(ruta) : muestra(ruta));

const storage = {
  from() {
    return {
      async upload(ruta: string, archivo: Blob) {
        subidos.set(ruta, URL.createObjectURL(archivo));
        // Se guarda en el navegador (si cabe) para que siga ahí al cambiar de rol.
        if (archivo.size < 1_500_000) {
          try {
            const dato: string = await new Promise((ok, mal) => {
              const lector = new FileReader();
              lector.onload = () => ok(String(lector.result));
              lector.onerror = mal;
              lector.readAsDataURL(archivo);
            });
            guardados.set(ruta, dato);
            guardarArchivos();
          } catch {
            /* se queda solo en memoria */
          }
        }
        return { data: { path: ruta }, error: null };
      },
      async createSignedUrl(ruta: string) {
        return { data: { signedUrl: firmar(ruta) }, error: null };
      },
      async createSignedUrls(rutas: string[]) {
        return { data: rutas.map((path) => ({ path, signedUrl: firmar(path), error: null })), error: null };
      },
      async remove() {
        return { data: [], error: null };
      },
      getPublicUrl(ruta: string) {
        return { data: { publicUrl: firmar(ruta) } };
      },
    };
  },
};

// ── Sesión ────────────────────────────────────────────────────────────────
function sesion() {
  const id = yo();
  if (!id) return null;
  const p = db.profiles.find((x) => x.id === id);
  return { access_token: "demo", user: { id, email: p?.email ?? "", app_metadata: {}, user_metadata: {}, aud: "demo", created_at: iso(new Date()) } };
}
const sinDemo = async () => ({ data: null, error: { message: "En la demo se entra eligiendo un rol." } });
const auth = {
  async getSession() { return { data: { session: sesion() }, error: null }; },
  async getUser() { return { data: { user: sesion()?.user ?? null }, error: null }; },
  onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  async signOut() { guardarRolDemo(null); return { error: null }; },
  signInWithPassword: sinDemo,
  signInWithOtp: sinDemo,
  resetPasswordForEmail: sinDemo,
  updateUser: sinDemo,
};

// ── Tiempo real: no hace falta; la demo vive en esta pestaña ──
function channel() {
  const canal: any = {
    on() { return canal; },
    subscribe(cb?: (s: string) => void) { setTimeout(() => cb?.("SUBSCRIBED"), 0); return canal; },
    unsubscribe() { return Promise.resolve("ok"); },
  };
  return canal;
}

export const fakeSupabase: any = {
  from: (t: string) => new Consulta(t),
  rpc: (n: string, p: Fila = {}) => new Promise<Res>((res) => setTimeout(() => res(rpc(n, p)), 80)),
  storage,
  auth,
  channel,
  removeChannel: async () => "ok",
  removeAllChannels: async () => [],
};

// Útil para depurar desde la consola del navegador.
export const _demo = { get db() { return db; }, fecha, hoy0 };
