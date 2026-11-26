// Conexión con Supabase: sesión, carga inicial, guardado con reintentos y cambios en vivo.
// La app trabaja en memoria (rápida) y esta capa sube cada cambio en segundo plano.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON } from './nube-config.js?v=202611270010';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'ssam-equipo-auth' },
});

// Solo se piden contraseñas en una conexión cifrada (o en tu propia Mac).
export const conexionSegura = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
export const URL_APP = location.origin + location.pathname;
export const ALCANCES_GOOGLE = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly';

// ---------- Sesión ----------
export async function sesionActual() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}
export function alCambiarSesion(f) {
  const { data } = sb.auth.onAuthStateChange((evento, sesion) => {
    // Google entrega un permiso temporal (1 h) para leer correo y calendario: se guarda en este navegador.
    if (sesion?.provider_token) guardarTokenGoogle(sesion.provider_token);
    // Y una renovación: se guarda en la bóveda del servidor para que el permiso no venza.
    if (sesion?.provider_refresh_token) {
      colaborador('google_guardar', { refresh_token: sesion.provider_refresh_token })
        .then((r) => r.ok && marcarGoogle(true)).catch(() => {});
    }
    f(evento, sesion);
  });
  return () => data.subscription.unsubscribe();
}
export const entrar = (email, password) => sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
export const registrar = (nombre, email, password) => sb.auth.signUp({
  email: email.trim().toLowerCase(), password, options: { data: { nombre: nombre.trim() }, emailRedirectTo: URL_APP },
});
export const recuperar = (email) => sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: URL_APP });
export const nuevaClave = (password) => sb.auth.updateUser({ password });
export const entrarConGoogle = () => sb.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: URL_APP, scopes: ALCANCES_GOOGLE, queryParams: { access_type: 'offline', prompt: 'consent', hd: 'spark225.com' } },
});
export async function salirNube() {
  try { localStorage.removeItem('ssam-google'); localStorage.removeItem('ssam-google-conectado'); } catch (_) { /* nada */ }
  await sb.auth.signOut();
}

// ---------- Permiso de Google (correo y calendario) ----------
function guardarTokenGoogle(token) {
  try { localStorage.setItem('ssam-google', JSON.stringify({ token, vence: Date.now() + 55 * 60000 })); } catch (_) { /* nada */ }
}
export function tokenGoogle() {
  try { const g = JSON.parse(localStorage.getItem('ssam-google') || 'null'); return g && g.vence > Date.now() ? g.token : null; } catch (_) { return null; }
}
// ¿Google está conectado? (permiso vigente en este navegador o renovación guardada en el servidor)
export function marcarGoogle(si) {
  try { si ? localStorage.setItem('ssam-google-conectado', '1') : localStorage.removeItem('ssam-google-conectado'); } catch (_) { /* nada */ }
}
export function googleConectado() {
  try { return !!tokenGoogle() || localStorage.getItem('ssam-google-conectado') === '1'; } catch (_) { return !!tokenGoogle(); }
}
// Permiso fresco: el del navegador si sigue vigente; si no, el servidor lo renueva sin pedir nada.
let renovando = null;
export async function obtenerTokenGoogle() {
  const t = tokenGoogle();
  if (t) return t;
  if (!googleConectado()) return null;
  if (!renovando) {
    renovando = colaborador('google_token')
      .then((r) => {
        if (r.ok && r.access_token) {
          try { localStorage.setItem('ssam-google', JSON.stringify({ token: r.access_token, vence: Date.now() + Math.max(60, (r.expira_en || 3600) - 300) * 1000 })); } catch (_) { /* nada */ }
          return r.access_token;
        }
        if (r.reconectar) marcarGoogle(false);
        return null;
      })
      .catch(() => null)
      .finally(() => { renovando = null; });
  }
  return renovando;
}

// ---------- Conexiones del colaborador (función «colaborador» del servidor) ----------
export async function colaborador(accion, datos = {}) {
  const { data } = await sb.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: 'Sin sesión' };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/colaborador`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, ...datos }),
  });
  return r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
}
export const buscarNotion = () => colaborador('notion_buscar');
export const confirmarNotion = (notion_user) => colaborador('notion_confirmar', { notion_user });
// Perfil propio: foto, color, nombre corto y puesto (el permiso solo lo cambia un admin).
export async function actualizarMiPerfil(id, cambios) {
  const { error } = await sb.from('perfiles').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function fotoDeGoogle() {
  const { data } = await sb.auth.getUser();
  const m = data?.user?.user_metadata || {};
  return m.avatar_url || m.picture || null;
}
// Fotos de Notion: la propia, o (admin) la de todo el equipo que tenga Notion ligado.
export const fotosNotion = (todos = false) => colaborador('notion_fotos', { todos });
export async function terminarBienvenida(id) {
  const { error } = await sb.from('perfiles').update({ bienvenida: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ---------- Datos ----------
export async function miPerfil(uid) {
  const { data, error } = await sb.from('perfiles').select('*').eq('auth_uid', uid).maybeSingle();
  if (error) throw error;
  return data;
}
export async function cargarTodo() {
  const docs = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from('docs').select('coleccion,id,datos').eq('borrado', false).range(desde, desde + 999);
    if (error) throw error;
    docs.push(...data);
    if (data.length < 1000) break;
  }
  const [p, a] = await Promise.all([sb.from('perfiles').select('*').order('creado'), sb.from('ajustes').select('*')]);
  if (p.error) throw p.error;
  if (a.error) throw a.error;
  return { perfiles: p.data, docs, ajustes: a.data[0]?.datos || {} };
}
export async function subirDocs(filas) {
  for (let i = 0; i < filas.length; i += 100) {
    const { error } = await sb.from('docs').upsert(filas.slice(i, i + 100), { onConflict: 'coleccion,id' });
    if (error) throw error;
  }
  // Si cambió alguna actividad compartida, se manda a Notion en unos segundos.
  if (filas.some((f) => f.coleccion === 'actividades' && !f.visible_para)) empujarNotion();
}
let empuje = null;
function empujarNotion() {
  clearTimeout(empuje);
  empuje = setTimeout(() => { sincronizarNotion().catch(() => {}); }, 4000);
}
export async function subirAjustes(persona, datos) {
  const { error } = await sb.from('ajustes').upsert({ persona, datos, actualizado: new Date().toISOString() }, { onConflict: 'persona' });
  if (error) throw error;
}
export async function aprobarPersona(id, permiso = 'colaborador') {
  const { error } = await sb.from('perfiles').update({ permiso }).eq('id', id);
  if (error) throw error;
}
export async function invitarPersona(p) {
  const { error } = await sb.from('perfiles').insert(p);
  if (error) throw error;
}
// Cambios que hacen los demás, en vivo.
export function escucharCambios(f) {
  const canal = sb.channel('docs-equipo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (m) => f(m.new && m.new.id ? m.new : null))
    .subscribe();
  return () => sb.removeChannel(canal);
}

// ---------- Notion ----------
// Pide a la función del servidor que traiga lo nuevo de Notion (también corre sola cada 5 minutos).
export async function sincronizarNotion() {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/notion-sync`, { method: 'POST', headers: { Authorization: 'Bearer ' + SUPABASE_ANON, apikey: SUPABASE_ANON, 'Content-Type': 'application/json' }, body: '{}' });
    return await r.json();
  } catch (e) { return { ok: false, error: String(e) }; }
}
export async function estadoNotion() {
  const { data } = await sb.from('sync_estado').select('ultimo,error').eq('clave', 'notion').maybeSingle();
  return data;
}

// ---------- Avisos al teléfono (push) ----------
// Guarda la «dirección» de este dispositivo para que el servidor le mande avisos con la app cerrada.
export async function guardarSuscripcion(persona, sub, dispositivo) {
  const j = sub.toJSON();
  const { error } = await sb.from('push_suscripciones').upsert({ endpoint: j.endpoint, persona, p256dh: j.keys.p256dh, auth: j.keys.auth, dispositivo }, { onConflict: 'endpoint' });
  if (error) throw error;
}
// Manda un aviso de prueba a mis dispositivos (desde el servidor, como llegarán los de verdad).
export async function avisoDePrueba() {
  const { data } = await sb.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/avisos-push`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, apikey: SUPABASE_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ prueba: true }),
  });
  return r.json().catch(() => ({ ok: false }));
}
