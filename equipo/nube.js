// Conexión con Supabase: sesión, carga inicial, guardado con reintentos y cambios en vivo.
// La app trabaja en memoria (rápida) y esta capa sube cada cambio en segundo plano.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './nube-config.js?v=202611251108';

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
    // Google entrega un permiso temporal para leer correo y calendario: se guarda solo en este navegador.
    if (sesion?.provider_token) guardarTokenGoogle(sesion.provider_token);
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
  try { localStorage.removeItem('ssam-google'); } catch (_) { /* nada */ }
  await sb.auth.signOut();
}

// ---------- Permiso de Google (correo y calendario) ----------
function guardarTokenGoogle(token) {
  try { localStorage.setItem('ssam-google', JSON.stringify({ token, vence: Date.now() + 55 * 60000 })); } catch (_) { /* nada */ }
}
export function tokenGoogle() {
  try { const g = JSON.parse(localStorage.getItem('ssam-google') || 'null'); return g && g.vence > Date.now() ? g.token : null; } catch (_) { return null; }
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
