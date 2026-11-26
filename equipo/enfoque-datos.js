// Mapa de enfoque (antes «Focus Map» en claude.ai): reglas del semáforo y de las semanas.
// Son las mismas del original para que los colores no cambien al pasar al Portal.

// Los datos (trimestre, prioridades, KPI y capturas) viven solo en la base, con sesión.
// Aquí solo van las reglas y unos ajustes por omisión sin datos de la empresa.
export const AJUSTES_BASE = { id: 'config', limiteDia: 7, limiteHora: 9, maxEmpresa: 5, pedirNotas: false, metas: [] };

// ---------- Reglas del semáforo (idénticas al original) ----------
// S súper verde · V verde · A amarillo · R rojo · N sin reporte.
export const COLOR = {
  S: { nombre: 'Súper verde', ayuda: 'Superó la meta', letra: 'S' },
  V: { nombre: 'Verde', ayuda: 'En camino', letra: 'V' },
  A: { nombre: 'Amarillo', ayuda: 'En riesgo', letra: 'A' },
  R: { nombre: 'Rojo', ayuda: 'Fuera de camino', letra: 'R' },
  N: { nombre: 'Sin reporte', ayuda: 'Aún no se captura', letra: '–' },
};
export const TIPOS = [
  { id: 'mas', nombre: 'Número · más es mejor' },
  { id: 'menos', nombre: 'Número · menos es mejor' },
  { id: 'pct_mas', nombre: 'Porcentaje · más es mejor' },
  { id: 'pct_menos', nombre: 'Porcentaje · menos es mejor' },
  { id: 'fecha', nombre: 'Fecha · antes es mejor' },
  { id: 'si_no', nombre: 'Sí / No' },
];
const dias = (iso) => Math.round(new Date(iso + 'T12:00:00').getTime() / 864e5);
const menosEsMejor = (t) => t === 'menos' || t === 'pct_menos' || t === 'fecha';

export function colorKPI(criterio, valor) {
  if (valor === null || valor === undefined || valor === '') return 'N';
  if (criterio.tipo === 'si_no') return valor ? 'V' : 'R';
  const n = criterio.tipo === 'fecha' ? dias(valor) : +valor;
  const sv = criterio.tipo === 'fecha' ? dias(criterio.sv) : +criterio.sv;
  const v = criterio.tipo === 'fecha' ? dias(criterio.v) : +criterio.v;
  const r = criterio.tipo === 'fecha' ? dias(criterio.r) : +criterio.r;
  if (menosEsMejor(criterio.tipo)) return n <= sv ? 'S' : n <= v ? 'V' : n >= r ? 'R' : 'A';
  return n >= sv ? 'S' : n >= v ? 'V' : n <= r ? 'R' : 'A';
}
const PUNTOS = { S: 4, V: 3, A: 2, R: 1 };
// Promedio de los KPI reportados; si alguno está en rojo, la prioridad queda como máximo en amarillo.
export function colorPrioridad(colores) {
  const rep = colores.filter((c) => c !== 'N');
  if (!rep.length) return 'N';
  const prom = rep.reduce((s, c) => s + PUNTOS[c], 0) / rep.length;
  let c = prom >= 3.5 ? 'S' : prom >= 2.5 ? 'V' : prom >= 1.5 ? 'A' : 'R';
  if (rep.includes('R') && (c === 'S' || c === 'V')) c = 'A';
  return c;
}

// Umbrales válidos: los tres son obligatorios; % de 0 a 100; más es mejor: SV ≥ V > R; menos es mejor: SV ≤ V < R.
export function validarCriterio(c) {
  if (c.tipo === 'si_no') return null;
  if ([c.sv, c.v, c.r].some((x) => x === '' || x === null || x === undefined)) return 'Faltan umbrales: súper verde, verde y rojo.';
  const n = c.tipo === 'fecha' ? [c.sv, c.v, c.r].map(dias) : [c.sv, c.v, c.r].map(Number);
  if (n.some((x) => Number.isNaN(x))) return 'Los umbrales deben ser números.';
  if (c.tipo.startsWith('pct') && n.some((x) => x < 0 || x > 100)) return 'Los porcentajes van de 0 a 100.';
  const [sv, v, r] = n;
  if (menosEsMejor(c.tipo) ? !(sv <= v && v < r) : !(sv >= v && v > r)) return menosEsMejor(c.tipo) ? 'Si menos es mejor: súper verde ≤ verde < rojo.' : 'Si más es mejor: súper verde ≥ verde > rojo.';
  return null;
}

// Lee lo que escribe la persona: quita «%», acepta coma decimal.
export function leerValor(tipo, texto) {
  if (tipo === 'si_no') return texto;
  if (tipo === 'fecha') return /^\d{4}-\d{2}-\d{2}$/.test(texto || '') ? texto : null;
  const t = String(texto ?? '').replace('%', '').trim().replace(',', '.');
  if (t === '') return '';
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

// ---------- Semanas del trimestre (13, de lunes a domingo) ----------
// La semana w cierra el día inicio + (w−1)·7 + limiteDia, a la hora límite (7 = lunes siguiente, 9:00).
export function cierreSemana(trim, aj, w) {
  const d = new Date(trim.inicio + 'T00:00:00');
  d.setDate(d.getDate() + (w - 1) * 7 + (aj.limiteDia ?? 7));
  d.setHours(aj.limiteHora ?? 9, 0, 0, 0);
  return d;
}
export function inicioSemana(trim, w) {
  const d = new Date(trim.inicio + 'T12:00:00');
  d.setDate(d.getDate() + (w - 1) * 7);
  return d;
}
// La que toca capturar: la primera cuyo cierre no ha pasado.
export function semanaDeCarga(trim, aj, ahora = new Date()) {
  for (let w = 1; w <= 13; w++) if (cierreSemana(trim, aj, w) > ahora) return w;
  return 13;
}
