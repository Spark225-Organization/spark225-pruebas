// Google: correo (solo lectura) y agenda de hoy, con el permiso que da Google al entrar.
// Las transcripciones de juntas (notas de Gemini, Plaud, etc.) se vuelven minuta para todo el equipo.
import { obtenerTokenGoogle } from './nube.js?v=202611262330';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const ES_TRANSCRIPCION = /(notas?\b.*(reuni|junta|meeting)|transcrip|minuta|meeting notes|notes by gemini|resumen de la reuni)/i;
const REMITENTES_NOTAS = /(gemini-notes@google\.com|plaud|otter|fireflies|fathom|tldv|read\.ai)/i;

async function pedir(url) {
  const t = await obtenerTokenGoogle();
  if (!t) throw Object.assign(new Error('Conecta Google'), { sinPermiso: true });
  let r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
  if (r.status === 401) {
    // Venció antes de tiempo: se pide uno nuevo al servidor y se reintenta una vez.
    try { localStorage.removeItem('ssam-google'); } catch (_) { /* nada */ }
    const t2 = await obtenerTokenGoogle();
    if (t2) r = await fetch(url, { headers: { Authorization: 'Bearer ' + t2 } });
  }
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('El permiso de Google venció'), { sinPermiso: true });
  if (!r.ok) throw new Error('Google respondió ' + r.status);
  return r.json();
}
const encabezado = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
const nombreDe = (from) => (from.match(/^"?([^"<]+?)"?\s*</)?.[1] || from.replace(/<.*>/, '')).trim();

// Últimos correos de la bandeja. Marca cuáles son transcripciones de juntas.
export async function correosRecientes(clientes, max = 8) {
  // Bandeja reciente + búsqueda aparte de notas de juntas (para que no queden enterradas entre muchos correos).
  const [lista, notas] = await Promise.all([
    pedir(`${API}/messages?maxResults=${max}&q=${encodeURIComponent('in:inbox newer_than:14d')}`),
    pedir(`${API}/messages?maxResults=5&q=${encodeURIComponent('newer_than:1d (from:gemini-notes@google.com OR subject:(notas reunión) OR subject:(notes meeting))')}`).catch(() => ({})),
  ]);
  const ids = [...new Map([...(lista.messages || []), ...(notas.messages || [])].map((m) => [m.id, m])).values()];
  const msgs = await Promise.all(ids.map((m) => pedir(`${API}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
  return msgs.map((m) => {
    const de = encabezado(m, 'From'), asunto = encabezado(m, 'Subject') || '(sin asunto)';
    const texto = (de + ' ' + asunto).toLowerCase();
    const cliente = clientes.find((c) => !c.privado && c.id !== 'interno' && texto.includes(c.nombre.toLowerCase().split(' ')[0]))?.id || 'interno';
    return {
      id: 'g-' + m.id, gmail: m.id, de: nombreDe(de), asunto, cliente,
      cuando: new Date(Number(m.internalDate)).toISOString(),
      leido: !(m.labelIds || []).includes('UNREAD'),
      tipo: REMITENTES_NOTAS.test(de) || ES_TRANSCRIPCION.test(asunto) ? 'transcripcion' : 'correo',
      url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
    };
  }).sort((a, b) => b.cuando.localeCompare(a.cuando));
}

function decodificar(b64) {
  try { return decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))); } catch (_) { return ''; }
}
function textoPlano(parte) {
  if (!parte) return '';
  if (parte.mimeType === 'text/plain' && parte.body?.data) return decodificar(parte.body.data);
  for (const p of parte.parts || []) { const t = textoPlano(p); if (t) return t; }
  if (parte.mimeType === 'text/html' && parte.body?.data) return decodificar(parte.body.data).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  return '';
}

// Lee la transcripción y saca resumen y próximos pasos (formato de las notas de Gemini y similares).
// Es una lectura sencilla del texto, no IA: cada acuerdo se confirma con un toque antes de volverse tarea.
export async function leerTranscripcion(correo, personas, yo) {
  const m = await pedir(`${API}/messages/${correo.gmail}?format=full`);
  const txt = textoPlano(m.payload).replace(/\r/g, '');
  const lineas = txt.split('\n').map((l) => l.trim());
  const iPasos = lineas.findIndex((l) => /^(pr[oó]ximos pasos|siguientes pasos|next steps|acuerdos|action items)/i.test(l));
  const iRes = lineas.findIndex((l) => /^(resumen|summary)/i.test(l));
  const resumen = (iRes >= 0 ? lineas.slice(iRes + 1, iRes + 6) : lineas.slice(0, 5)).filter(Boolean).join(' ').slice(0, 420);
  const acuerdos = [];
  if (iPasos >= 0) {
    // Cada acuerdo es un párrafo (separado por líneas en blanco); Gemini corta las líneas largas.
    const parrafos = [];
    let actual = [];
    for (const l of lineas.slice(iPasos + 1, iPasos + 120)) {
      if (/^(detalles|details|transcripci|revisa las notas|review gemini|obt[eé]n|you should review|registros de la reuni|meeting records|¿te result)/i.test(l)) break;
      if (!l) { if (actual.length) { parrafos.push(actual.join(' ')); actual = []; } continue; }
      actual.push(l);
    }
    if (actual.length) parrafos.push(actual.join(' '));
    const conQuien = parrafos.filter((p) => /^[-•*·\s]*\[[^\]]+\]/.test(p));
    for (const p of conQuien.length ? conQuien : parrafos.slice(0, 10)) {
      const m = p.replace(/^[-•*·\d.)\s]+/, '').match(/^\[([^\]]+)\]\s*(.*)$/);
      const quienTxt = m ? m[1] : '';
      const resto = (m ? m[2] : p).trim();
      if (resto.length < 6) continue;
      const [titulo, ...desc] = resto.split(/:\s+/);
      const nombre = (quienTxt || resto).toLowerCase();
      const quien = personas.find((x) => nombre.includes(x.nombre.toLowerCase()) || nombre.includes(x.corto.toLowerCase()) || nombre.includes(x.nombre.split(' ')[0].toLowerCase()))?.id || yo;
      acuerdos.push({ texto: (desc.length ? titulo : resto).slice(0, 110), detalle: desc.join(': ').slice(0, 400), responsable: quien, quienTxt });
      if (acuerdos.length >= 15) break;
    }
  }
  return { resumen: resumen || correo.asunto, acuerdos };
}

// Juntas por aceptar: invitaciones de alguien de Spark225 (próximos 14 días) que aún no respondes.
// Se pregunta al calendario, no al asunto del correo: al aceptarla, desaparece sola.
export async function juntasPorAceptar(personas = []) {
  const ini = new Date();
  const fin = new Date(ini); fin.setDate(fin.getDate() + 14);
  const r = await pedir(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${ini.toISOString()}&timeMax=${fin.toISOString()}&maxResults=60`);
  return (r.items || []).filter((e) => {
    if (e.status === 'cancelled' || e.organizer?.self) return false;
    const yo = (e.attendees || []).find((a) => a.self);
    const quien = (e.organizer?.email || e.creator?.email || '').toLowerCase();
    return yo?.responseStatus === 'needsAction' && quien.endsWith('@spark225.com');
  }).map((e) => {
    const correo = (e.organizer?.email || e.creator?.email || '').toLowerCase();
    const p = personas.find((x) => (x.email || '').toLowerCase() === correo);
    return {
      id: 'inv-' + e.id, titulo: e.summary || '(sin título)', de: p?.corto || e.organizer?.displayName || correo.split('@')[0],
      inicio: e.start?.dateTime || e.start?.date, todoElDia: !e.start?.dateTime, url: e.htmlLink,
    };
  });
}

// Agenda de hoy del calendario principal.
export async function agendaDeHoy() {
  const ini = new Date(); ini.setHours(0, 0, 0, 0);
  const fin = new Date(ini); fin.setDate(fin.getDate() + 1);
  const r = await pedir(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${ini.toISOString()}&timeMax=${fin.toISOString()}&maxResults=15`);
  return (r.items || []).filter((e) => e.status !== 'cancelled').map((e) => ({
    id: e.id, titulo: e.summary || '(sin título)', inicio: e.start?.dateTime || null, fin: e.end?.dateTime || null, todoElDia: !e.start?.dateTime, url: e.htmlLink, meet: e.hangoutLink || null,
  }));
}
