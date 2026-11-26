// Reportes: de dónde sale cada número. Cada «fuente» lee los datos del Portal para un área y un periodo
// y devuelve indicadores, una serie para graficar, una tabla y un resumen escrito. Nada de aquí modifica datos.
import { hoyISO, sumarDias } from './datos.js?v=202611270830';
import { store, vigentes, evaluarEntrega, saludProyecto, areasVigentes, datosFocusMap } from './store.js?v=202611270830';

// ---------- Periodos ----------
const lunes = (iso) => { const d = new Date(iso + 'T12:00:00'); return sumarDias(iso, -((d.getDay() + 6) % 7)); };
const finDeMes = (iso) => { const d = new Date(iso.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); };
const mesAnterior = (iso) => { const d = new Date(iso.slice(0, 7) + '-15T12:00:00'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };
export const PERIODOS = [
  { id: 'semana', nombre: 'Esta semana' },
  { id: 'semana_pasada', nombre: 'Semana pasada' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mes_pasado', nombre: 'Mes pasado' },
  { id: 'trimestre', nombre: 'Este trimestre' },
  { id: 'libre', nombre: 'Otras fechas' },
];
export function rangoDe(tipo, hoy = hoyISO()) {
  if (tipo === 'semana') return { desde: lunes(hoy), hasta: sumarDias(lunes(hoy), 6) };
  if (tipo === 'semana_pasada') { const l = sumarDias(lunes(hoy), -7); return { desde: l, hasta: sumarDias(l, 6) }; }
  if (tipo === 'mes') return { desde: hoy.slice(0, 7) + '-01', hasta: finDeMes(hoy) };
  if (tipo === 'mes_pasado') { const m = mesAnterior(hoy); return { desde: m.slice(0, 7) + '-01', hasta: finDeMes(m) }; }
  if (tipo === 'trimestre') { const mi = Math.floor((+hoy.slice(5, 7) - 1) / 3) * 3 + 1; const desde = `${hoy.slice(0, 4)}-${String(mi).padStart(2, '0')}-01`; return { desde, hasta: finDeMes(`${hoy.slice(0, 4)}-${String(mi + 2).padStart(2, '0')}-01`) }; }
  return { desde: sumarDias(hoy, -30), hasta: hoy };
}
const f = (iso, o) => new Intl.DateTimeFormat('es-MX', o).format(new Date(iso + 'T12:00:00'));
export function textoPeriodo({ desde, hasta }) {
  if (desde.slice(0, 7) === hasta.slice(0, 7) && desde.endsWith('-01') && hasta === finDeMes(desde)) return mayus(f(desde, { month: 'long', year: 'numeric' }));
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  return `Del ${f(desde, { day: 'numeric', month: 'long', ...(mismoAnio ? {} : { year: 'numeric' }) })} al ${f(hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
export const fechaCorta = (iso) => (iso ? f(iso.slice(0, 10), { day: 'numeric', month: 'short' }).replace('.', '') : '—');
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const enRango = (iso, r) => !!iso && iso >= r.desde && iso <= r.hasta;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const seEntrego = (n) => (n === 0 ? 'no se entregó ninguna tarea' : n === 1 ? 'se entregó 1 tarea' : `se entregaron ${n} tareas`);

// ---------- Áreas ----------
export const AREAS_REPORTE = [
  { id: 'direccion', nombre: 'Dirección general', icono: 'brujula', ayuda: 'Cómo va Spark225 completo' },
  { id: 'marketing', nombre: 'Growth y Marketing', icono: 'grafica', ayuda: 'Entregas, clientes y resultados de pauta' },
  { id: 'diseno', nombre: 'Diseño y Creativo', icono: 'diseno', ayuda: 'Piezas entregadas, tiempos y carga' },
  { id: 'cuentas', nombre: 'Cuentas y Proyectos', icono: 'clientes', ayuda: 'Salud de clientes, hitos y acuerdos' },
  { id: 'admin', nombre: 'Administración', icono: 'documento', ayuda: 'Entregas y carga del área' },
];
export const nombreArea = (id) => AREAS_REPORTE.find((a) => a.id === id)?.nombre || id;
function personasDe(area) {
  const db = store.get();
  if (area === 'direccion') return new Set(db.personas.map((p) => p.id));
  return new Set(areasVigentes().find((a) => a.id === area)?.personas || []);
}
const sinAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function nombresDe(ids) {
  const db = store.get();
  return new Set(db.personas.filter((p) => ids.has(p.id)).flatMap((p) => [sinAcento(p.corto), sinAcento(p.nombre).split(' ')[0]]).filter(Boolean));
}

// ---------- Tareas ----------
const entregaDe = (a) => (a.estatus === 'hecho' ? a.entregaReal || (a.cerrada || '').slice(0, 10) || null : null);
function tareasDe(area) {
  const ids = personasDe(area);
  return vigentes().filter((a) => a.cliente !== 'personal' && (area === 'direccion' || ids.has(a.responsable)));
}
// Mismo criterio que «Entrega a tiempo» del Tablero: ponderado por prioridad, con la fecha compromiso que manda.
function evaluarEn(tareas, r, hoy) {
  const ev = [];
  for (const a of tareas) {
    const e = evaluarEntrega(a, hoy);
    if (e && enRango(e.limite, r)) ev.push({ a, ...e });
  }
  const total = ev.reduce((s, x) => s + x.peso, 0), bien = ev.filter((x) => x.aTiempo).reduce((s, x) => s + x.peso, 0);
  return { ev, pct: pct(bien, total), aTiempo: ev.filter((x) => x.aTiempo).length, tarde: ev.filter((x) => !x.aTiempo) };
}
const tonoPct = (p) => (p === null ? 'neutro' : p >= 95 ? 'bien' : p >= 85 ? 'atencion' : 'riesgo');
const nombreCliente = (id) => store.get().clientes.find((c) => c.id === id)?.nombre || 'Sin cliente';
const nombrePersona = (id) => store.get().personas.find((p) => p.id === id)?.corto || '—';

// ---------- Focus Map (misma regla de semáforo que la app original) ----------
const SCORE_FM = { S: 4, G: 3, Y: 2, R: 1 };
export const ESTADO_FM = { S: 'Súper verde', G: 'Verde', Y: 'Amarillo', R: 'Rojo', N: 'Sin reporte' };
const tipoCrit = (c) => ({ asc: 'num', desc: 'num', pct_asc: 'pct', pct_desc: 'pct', date: 'date', bool: 'bool' })[c?.type] || 'bool';
const bajaEsMejor = (c) => ['desc', 'pct_desc', 'date'].includes(c?.type);
function aNum(c, x) {
  if (tipoCrit(c) === 'date') { if (!/^\d{4}-\d{2}-\d{2}$/.test(x || '')) return NaN; const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
  if (x === '' || x === null || x === undefined) return NaN;
  return Number(String(x).replace('%', '').replace(',', '.'));
}
function estadoFM(c, v) {
  if (v === null || v === undefined || v === '') return 'N';
  if (tipoCrit(c) === 'bool') return v === true || v === 'true' || v === 1 || v === '1' ? 'G' : 'R';
  const n = aNum(c, v), sg = aNum(c, c.sg), g = aNum(c, c.g), r = aNum(c, c.r);
  if ([n, sg, g, r].some(Number.isNaN)) return 'N';
  if (bajaEsMejor(c)) { if (n <= sg) return 'S'; if (n <= g) return 'G'; if (n >= r) return 'R'; return 'Y'; }
  if (n >= sg) return 'S'; if (n >= g) return 'G'; if (n <= r) return 'R'; return 'Y';
}
function valorFM(c, v) {
  if (v === null || v === undefined || v === '') return '—';
  const k = tipoCrit(c);
  if (k === 'bool') return v === true || v === 'true' || v === 1 || v === '1' ? 'Sí' : 'No';
  if (k === 'date') return fechaCorta(v);
  return k === 'pct' ? `${v} %` : String(v);
}
const limpiar = (t) => String(t || '').normalize('NFKC').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
function focusMapEn(area, r) {
  const fm = datosFocusMap();
  const q = fm.trimestres.find((x) => x.active) || [...fm.trimestres].sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
  if (!q) return null;
  const semanaDe = (iso) => Math.floor((new Date(iso + 'T12:00:00Z') - new Date(q.start + 'T12:00:00Z')) / 864e5 / 7) + 1;
  const porOrden = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));
  const empresa = fm.prioridades.filter((p) => p.quarterId === q.id && p.kind === 'company').sort(porOrden);
  const hijos = (id) => fm.prioridades.filter((p) => p.parentId === id && p.kind === 'individual').sort(porOrden);
  const rep = (pid, w) => fm.reportes.find((x) => x.id === `${pid}_w${w}`);
  // Semana a mostrar: la última con reportes, sin pasar del fin del periodo.
  const tope = Math.max(1, semanaDe(r.hasta < hoyISO() ? r.hasta : hoyISO()));
  const ids = empresa.flatMap((c) => hijos(c.id)).map((k) => k.id);
  let w = tope; while (w > 1 && !ids.some((id) => rep(id, w))) w--;
  const nombres = nombresDe(personasDe(area));
  const delArea = (owner) => area === 'direccion' || nombres.has(sinAcento(owner).split(' ')[0]);
  const filas = [];
  for (const c of empresa) {
    const ks = hijos(c.id).map((k) => { const x = rep(k.id, w); return { k, valor: x?.value, estado: x ? estadoFM(k.criteria, x.value) : 'N' }; });
    const st = ks.map((x) => x.estado).filter((s) => s !== 'N');
    let ce = 'N';
    if (st.length) { const avg = st.reduce((s, x) => s + SCORE_FM[x], 0) / st.length; ce = avg >= 3.5 ? 'S' : avg >= 2.5 ? 'G' : avg >= 1.5 ? 'Y' : 'R'; if (st.includes('R') && (ce === 'S' || ce === 'G')) ce = 'Y'; }
    const propios = ks.filter((x) => delArea(x.k.owner));
    if (!delArea(c.owner) && !propios.length) continue;
    filas.push({ tipo: 'empresa', nombre: limpiar(c.name), dueno: c.owner, estado: ce });
    (area === 'direccion' ? ks : propios).forEach((x) => filas.push({ tipo: 'kpi', nombre: limpiar(x.k.name), dueno: x.k.owner, estado: x.estado, valor: valorFM(x.k.criteria, x.valor) }));
  }
  return { trimestre: q.label, semana: w, filas };
}

// ---------- Fuentes ----------
// tipo de gráfica: 'kpis' (indicadores), 'barras', 'linea', 'dona', 'tabla'. La primera de «graficas» es la de arranque.
export const FUENTES = {
  entregas: {
    nombre: 'Entregas del periodo', graficas: ['kpis'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const entregadas = t.filter((a) => enRango(entregaDe(a), r));
      const e = evaluarEn(t, r, hoy);
      const vencidas = t.filter((a) => a.estatus !== 'hecho' && !a.sinFecha && a.fecha < hoy);
      const abiertas = t.filter((a) => a.estatus !== 'hecho');
      return {
        kpis: [
          { etq: 'Entregadas', valor: entregadas.length, sub: 'en el periodo' },
          { etq: 'A tiempo', valor: e.pct === null ? '—' : `${e.pct} %`, sub: `${e.aTiempo} de ${e.ev.length} que vencían`, tono: tonoPct(e.pct) },
          { etq: 'Tarde', valor: e.tarde.length, sub: 'se entregaron o siguen después de su fecha', tono: e.tarde.length ? 'riesgo' : 'bien' },
          { etq: 'Vencidas hoy', valor: vencidas.length, sub: `de ${plural(abiertas.length, 'abierta', 'abiertas')}`, tono: vencidas.length ? 'atencion' : 'bien' },
        ],
        tabla: { cols: ['Tarea', 'Cliente', 'Responsable', 'Fecha compromiso', 'Entrega'], filas: e.tarde.slice(0, 12).map((x) => [x.a.titulo, nombreCliente(x.a.cliente), nombrePersona(x.a.responsable), fechaCorta(x.limite), x.cerrada ? fechaCorta(x.cerrada) : 'Pendiente']) },
        resumen: e.ev.length
          ? `En el periodo ${seEntrego(entregadas.length)}. De ${plural(e.ev.length, 'tarea que vencía', 'tareas que vencían')}, ${e.aTiempo} ${e.aTiempo === 1 ? 'llegó' : 'llegaron'} a tiempo: ${e.pct} % ponderado por prioridad${e.pct >= 95 ? ', dentro de la meta de 95 %.' : e.pct >= 85 ? '; está en atención (meta: 95 %).' : '; está por debajo de 85 % y requiere un plan.'} Hoy hay ${plural(vencidas.length, 'tarea vencida', 'tareas vencidas')}.`
          : `En el periodo ${seEntrego(entregadas.length)}. No hubo tareas con fecha compromiso que medir.`,
      };
    },
  },
  a_tiempo_semana: {
    nombre: 'Entrega a tiempo por semana', graficas: ['linea', 'barras', 'tabla'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const inicio = lunes(r.desde < sumarDias(r.hasta, -35) ? r.desde : sumarDias(r.hasta, -35));
      const puntos = [];
      for (let l = inicio; l <= r.hasta && l <= hoy; l = sumarDias(l, 7)) {
        const e = evaluarEn(t, { desde: l, hasta: sumarDias(l, 6) }, hoy);
        puntos.push({ etq: fechaCorta(l), valor: e.pct, n: e.ev.length, ok: e.aTiempo });
      }
      const con = puntos.filter((p) => p.valor !== null);
      const ult = con[con.length - 1], prev = con[con.length - 2];
      return {
        serie: { unidad: '%', max: 100, meta: 95, puntos: puntos.map((p) => ({ etq: p.etq, valor: p.valor })) },
        tabla: { cols: ['Semana del', 'Tareas que vencían', 'A tiempo', '% ponderado'], filas: puntos.map((p) => [p.etq, p.n, p.ok, p.valor === null ? '—' : `${p.valor} %`]) },
        resumen: ult ? `La semana más reciente cerró en ${ult.valor} % a tiempo${prev ? (ult.valor === prev.valor ? ' (igual que la semana anterior)' : ` (${ult.valor > prev.valor ? 'sube' : 'baja'} desde ${prev.valor} %)`) : ''}. La meta es 95 %.` : 'Aún no hay semanas con tareas que medir.',
      };
    },
  },
  por_cliente: {
    nombre: 'Entregas por cliente', graficas: ['barras', 'dona', 'tabla'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const filas = store.get().clientes.map((c) => {
        const suyas = t.filter((a) => a.cliente === c.id);
        const e = evaluarEn(suyas, r, hoy);
        return { c, entregadas: suyas.filter((a) => enRango(entregaDe(a), r)).length, pct: e.pct, abiertas: suyas.filter((a) => a.estatus !== 'hecho').length };
      }).filter((x) => x.entregadas || x.abiertas).sort((a, b) => b.entregadas - a.entregadas || b.abiertas - a.abiertas);
      const top = filas[0];
      return {
        serie: { unidad: 'tareas', puntos: filas.filter((x) => x.entregadas).map((x) => ({ etq: x.c.nombre, valor: x.entregadas })) },
        tabla: { cols: ['Cliente', 'Entregadas', 'A tiempo', 'Abiertas'], filas: filas.map((x) => [x.c.nombre, x.entregadas, x.pct === null ? '—' : `${x.pct} %`, x.abiertas]) },
        resumen: top && top.entregadas ? `${top.c.nombre} concentró más entregas (${top.entregadas}). Se trabajó para ${plural(filas.filter((x) => x.entregadas).length, 'cliente', 'clientes')} en el periodo.` : 'No hubo entregas en el periodo.',
      };
    },
  },
  por_persona: {
    nombre: 'Entregas por persona', graficas: ['barras', 'tabla'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const ids = personasDe(area);
      const filas = store.get().personas.filter((p) => ids.has(p.id)).map((p) => {
        const suyas = t.filter((a) => a.responsable === p.id);
        const e = evaluarEn(suyas, r, hoy);
        return { p, entregadas: suyas.filter((a) => enRango(entregaDe(a), r)).length, pct: e.pct, abiertas: suyas.filter((a) => a.estatus !== 'hecho').length, vencidas: suyas.filter((a) => a.estatus !== 'hecho' && !a.sinFecha && a.fecha < hoy).length };
      }).filter((x) => x.entregadas || x.abiertas).sort((a, b) => b.entregadas - a.entregadas);
      return {
        serie: { unidad: 'tareas', puntos: filas.map((x) => ({ etq: x.p.corto, valor: x.entregadas })) },
        tabla: { cols: ['Persona', 'Entregadas', 'A tiempo', 'Abiertas', 'Vencidas hoy'], filas: filas.map((x) => [x.p.corto, x.entregadas, x.pct === null ? '—' : `${x.pct} %`, x.abiertas, x.vencidas]) },
        resumen: filas.length ? `${mayus(seEntrego(filas.reduce((s, x) => s + x.entregadas, 0)))} entre ${plural(filas.length, 'persona', 'personas')}; ${filas.reduce((s, x) => s + x.abiertas, 0) === 1 ? 'queda 1 abierta' : `quedan ${filas.reduce((s, x) => s + x.abiertas, 0)} abiertas`}.` : 'No hay tareas del área en el periodo.',
      };
    },
  },
  dias_entrega: {
    nombre: 'Días de atraso promedio', graficas: ['barras', 'tabla'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const ids = personasDe(area);
      const filas = store.get().personas.filter((p) => ids.has(p.id)).map((p) => {
        const e = evaluarEn(t.filter((a) => a.responsable === p.id), r, hoy).ev.filter((x) => x.cerrada);
        const dias = e.map((x) => x.diasTarde);
        return { p, n: e.length, prom: e.length ? Math.round((dias.reduce((s, d) => s + d, 0) / e.length) * 10) / 10 : null, max: e.length ? Math.max(...dias) : null };
      }).filter((x) => x.n).sort((a, b) => b.prom - a.prom);
      const total = filas.reduce((s, x) => s + x.n, 0), prom = total ? Math.round((filas.reduce((s, x) => s + x.prom * x.n, 0) / total) * 10) / 10 : null;
      return {
        serie: { unidad: 'días', puntos: filas.map((x) => ({ etq: x.p.corto, valor: x.prom })) },
        tabla: { cols: ['Persona', 'Entregas medidas', 'Atraso promedio (días)', 'Atraso máximo (días)'], filas: filas.map((x) => [x.p.corto, x.n, x.prom, x.max]) },
        resumen: prom === null ? 'No hubo entregas con fecha compromiso en el periodo.' : prom === 0 ? `Las ${total} entregas medidas llegaron en su fecha o antes.` : `En promedio, una entrega llegó ${prom} ${prom === 1 ? 'día' : 'días'} después de su fecha compromiso (${total} entregas medidas).`,
      };
    },
  },
  semaforo_clientes: {
    nombre: 'Semáforo de clientes', graficas: ['barras', 'tabla'],
    calcular({ area, r, hoy }) {
      const t = tareasDe(area);
      const filas = store.get().clientes.filter((c) => !c.privado && c.id !== 'interno' && (c.etapa || 'activo') === 'activo').map((c) => ({ c, e: evaluarEn(t.filter((a) => a.cliente === c.id), r, hoy) }))
        .filter((x) => x.e.ev.length).sort((a, b) => a.e.pct - b.e.pct);
      const riesgo = filas.filter((x) => x.e.pct < 85);
      return {
        serie: { unidad: '%', max: 100, meta: 95, estados: true, puntos: filas.map((x) => ({ etq: x.c.nombre, valor: x.e.pct, tono: tonoPct(x.e.pct) })) },
        tabla: { cols: ['Cliente', 'Tareas medidas', 'A tiempo', 'Semáforo'], filas: filas.map((x) => [x.c.nombre, x.e.ev.length, `${x.e.pct} %`, { bien: 'Va bien', atencion: 'Atención', riesgo: 'En riesgo' }[tonoPct(x.e.pct)]]) },
        resumen: filas.length ? (riesgo.length ? `${plural(riesgo.length, 'cliente está', 'clientes están')} por debajo de 85 % a tiempo: ${riesgo.map((x) => x.c.nombre).join(', ')}.` : `Los ${filas.length} clientes medidos están en 85 % o más a tiempo.`) + ' Va bien con 95 % o más; atención de 85 a 94 %.' : 'No hubo tareas de clientes que medir en el periodo.',
      };
    },
  },
  salud_proyectos: {
    nombre: 'Salud de Master Proyectos', graficas: ['dona', 'barras', 'tabla'],
    calcular({ hoy }) {
      const ps = store.get().proyectos.filter((p) => !p.id.startsWith('g-') && (p.fase || 'en_curso') !== 'terminado').map((p) => ({ p, s: saludProyecto(p, hoy) }));
      const cuenta = (k) => ps.filter((x) => x.s.salud === k).length;
      const alerta = ps.filter((x) => ['en_riesgo', 'atencion'].includes(x.s.salud)).sort((a, b) => (a.s.salud === 'en_riesgo' ? 0 : 1) - (b.s.salud === 'en_riesgo' ? 0 : 1));
      return {
        serie: { unidad: 'proyectos', estados: true, puntos: [{ etq: 'En riesgo', valor: cuenta('en_riesgo'), tono: 'riesgo' }, { etq: 'Atención', valor: cuenta('atencion'), tono: 'atencion' }, { etq: 'En control', valor: cuenta('en_control'), tono: 'bien' }, { etq: 'Sin evaluar', valor: cuenta('sin_evaluar') + cuenta('programa'), tono: 'neutro' }] },
        tabla: { cols: ['Proyecto', 'Cliente', 'Salud', 'Por qué'], filas: alerta.slice(0, 14).map((x) => [x.p.nombre, nombreCliente(x.p.cliente), x.s.salud === 'en_riesgo' ? 'En riesgo' : 'Atención', x.s.razones[0] || '']) },
        resumen: `De ${plural(ps.length, 'proyecto vigente', 'proyectos vigentes')}, ${cuenta('en_riesgo')} ${cuenta('en_riesgo') === 1 ? 'está' : 'están'} en riesgo y ${cuenta('atencion')} en atención (regla de Notion).`,
      };
    },
  },
  focus_map: {
    nombre: 'Focus Map', graficas: ['tabla', 'dona'],
    calcular({ area, r }) {
      const fm = focusMapEn(area, r);
      if (!fm || !fm.filas.length) return { tabla: { cols: ['Prioridad', 'Responsable', 'Valor', 'Color'], filas: [] }, resumen: 'No hay prioridades del Focus Map para esta área (o aún no se cargan: entra con tu cuenta).' };
      const kpis = fm.filas.filter((x) => x.tipo === 'kpi');
      const cuenta = (k) => kpis.filter((x) => x.estado === k).length;
      return {
        serie: { unidad: 'KPI', estados: true, puntos: [['S', 'bien_fuerte'], ['G', 'bien'], ['Y', 'atencion'], ['R', 'riesgo'], ['N', 'neutro']].map(([k, tono]) => ({ etq: ESTADO_FM[k], valor: cuenta(k), tono })).filter((p) => p.valor) },
        tabla: { cols: ['Prioridad', 'Responsable', 'Valor', 'Color'], filas: fm.filas.map((x) => [x.tipo === 'empresa' ? x.nombre : `   · ${x.nombre}`, x.dueno || '—', x.valor || '', ESTADO_FM[x.estado]]), negritas: fm.filas.map((x) => x.tipo === 'empresa') },
        resumen: `${fm.trimestre}, semana ${fm.semana}: de ${plural(kpis.length, 'KPI', 'KPI')}, ${cuenta('S') + cuenta('G')} en verde, ${cuenta('Y')} en amarillo, ${cuenta('R')} en rojo y ${cuenta('N')} sin reporte.`,
      };
    },
  },
  decisiones: {
    nombre: 'Decisiones de Carlos', graficas: ['tabla'],
    calcular({ hoy }) {
      const l = (store.get().riesgos || []).filter((x) => x.escalar && x.estado !== 'resuelto').sort((a, b) => (a.fechaLimite || '9999').localeCompare(b.fechaLimite || '9999'));
      return {
        tabla: { cols: ['Riesgo / Decisión', 'Cliente', 'Severidad', 'Fecha límite', 'Recomendación'], filas: l.map((x) => [x.titulo, nombreCliente(x.cliente), x.severidad || '—', fechaCorta(x.fechaLimite), x.recomendacion || '']) },
        resumen: l.length ? `${plural(l.length, 'tema espera', 'temas esperan')} decisión de Carlos${l.some((x) => x.fechaLimite && x.fechaLimite < hoy) ? '; hay fechas límite vencidas.' : '.'}` : 'No hay decisiones pendientes para Carlos.',
      };
    },
  },
  hitos: {
    nombre: 'Hitos y entregables', graficas: ['tabla'],
    calcular({ area, r, hoy }) {
      const ids = personasDe(area);
      const proys = store.get().proyectos;
      const delArea = (h) => area === 'direccion' || area === 'cuentas' || ids.has(h.responsable) || ids.has(proys.find((p) => p.id === h.proyecto)?.responsable);
      const hasta = sumarDias(r.hasta, 30);
      const l = (store.get().hitos || []).filter((h) => delArea(h) && ((h.estado !== 'cumplido' && (h.fechaInterna || h.fechaContractual || '9999') <= hasta) || (h.estado === 'cumplido' && enRango(h.fechaInterna, r))))
        .sort((a, b) => (a.fechaInterna || '9999').localeCompare(b.fechaInterna || '9999'));
      const tarde = l.filter((h) => h.estado !== 'cumplido' && h.fechaInterna && h.fechaInterna < hoy);
      return {
        tabla: { cols: ['Hito', 'Proyecto', 'Fecha interna', 'Contractual', 'Estado'], filas: l.slice(0, 16).map((h) => [h.nombre, proys.find((p) => p.id === h.proyecto)?.nombre || '—', fechaCorta(h.fechaInterna), fechaCorta(h.fechaContractual), h.estado === 'cumplido' ? 'Cumplido' : tarde.includes(h) ? 'Atrasado' : h.estado === 'en_curso' ? 'En curso' : 'Pendiente']) },
        resumen: l.length ? `${plural(l.filter((h) => h.estado !== 'cumplido').length, 'hito por cumplir', 'hitos por cumplir')} hasta 30 días después del periodo${tarde.length ? `; ${plural(tarde.length, 'ya pasó', 'ya pasaron')} su fecha interna.` : '.'}` : 'No hay hitos en este periodo.',
      };
    },
  },
  carga_areas: {
    nombre: 'Carga por área', graficas: ['barras', 'tabla'],
    calcular({ hoy }) {
      const abiertas = vigentes().filter((a) => a.cliente !== 'personal' && a.estatus !== 'hecho');
      const filas = areasVigentes().map((ar) => { const ids = new Set(ar.personas || []); const l = abiertas.filter((a) => ids.has(a.responsable)); return { ar, n: l.length, v: l.filter((a) => !a.sinFecha && a.fecha < hoy).length, gente: ids.size }; })
        .filter((x) => x.gente).sort((a, b) => b.n - a.n);
      return {
        serie: { unidad: 'tareas abiertas', puntos: filas.map((x) => ({ etq: x.ar.nombre, valor: x.n })) },
        tabla: { cols: ['Área', 'Personas', 'Tareas abiertas', 'Vencidas', 'Abiertas por persona'], filas: filas.map((x) => [x.ar.nombre, x.gente, x.n, x.v, Math.round((x.n / x.gente) * 10) / 10]) },
        resumen: filas.length ? `${filas[0].ar.nombre} tiene la mayor carga: ${filas[0].n} tareas abiertas (${Math.round((filas[0].n / filas[0].gente) * 10) / 10} por persona).` : 'Aún no hay organigrama con personas por área.',
      };
    },
  },
  satisfaccion: {
    nombre: 'Satisfacción de clientes', graficas: ['barras', 'tabla'],
    calcular() {
      const filas = store.get().clientes.filter((c) => !c.privado && c.id !== 'interno' && (c.satisfaccion || []).length)
        .map((c) => { const l = [...c.satisfaccion].sort((a, b) => a.fecha.localeCompare(b.fecha)); return { c, ult: l[l.length - 1], prev: l[l.length - 2] }; })
        .sort((a, b) => a.ult.valor - b.ult.valor);
      return {
        serie: { unidad: 'de 5', max: 5, puntos: filas.map((x) => ({ etq: x.c.nombre, valor: x.ult.valor })) },
        tabla: { cols: ['Cliente', 'Última calificación', 'Fecha', 'Anterior'], filas: filas.map((x) => [x.c.nombre, `${x.ult.valor} de 5`, fechaCorta(x.ult.fecha), x.prev ? `${x.prev.valor} de 5` : '—']) },
        resumen: filas.length ? `Promedio de satisfacción: ${Math.round((filas.reduce((s, x) => s + x.ult.valor, 0) / filas.length) * 10) / 10} de 5 en ${plural(filas.length, 'cliente', 'clientes')}.${filas[0].ult.valor <= 2 ? ` La más baja es ${filas[0].c.nombre}.` : ''}` : 'Aún no hay calificaciones de satisfacción (se registran en la ficha de cada cliente).',
      };
    },
  },
  minutas: {
    nombre: 'Juntas y acuerdos', graficas: ['tabla', 'barras'],
    calcular({ r }) {
      const l = store.get().minutas.filter((m) => enRango((m.fecha || '').slice(0, 10), r)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const porCli = {}; l.forEach((m) => { const n = nombreCliente(m.cliente); porCli[n] = (porCli[n] || 0) + 1; });
      return {
        serie: { unidad: 'juntas', puntos: Object.entries(porCli).sort((a, b) => b[1] - a[1]).map(([etq, valor]) => ({ etq, valor })) },
        tabla: { cols: ['Fecha', 'Junta', 'Cliente', 'Acuerdos'], filas: l.slice(0, 16).map((m) => [fechaCorta(m.fecha), m.titulo, nombreCliente(m.cliente), (m.acuerdos || []).length || '—']) },
        resumen: l.length ? `${plural(l.length, 'junta registrada', 'juntas registradas')} en el periodo con ${plural(Object.keys(porCli).length, 'cliente', 'clientes')}.` : 'No hay minutas en el periodo.',
      };
    },
  },
  captura_marketing: {
    nombre: 'Resultados de pauta', graficas: ['tabla', 'barras'], captura: true,
    calcular({ bloque }) {
      const filas = (bloque.captura?.filas || []);
      const n = (x) => (x === '' || x === null || x === undefined || Number.isNaN(Number(x)) ? null : Number(x));
      const calc = filas.map((x) => {
        const inv = n(x.inversion), leads = n(x.leads), ag = n(x.agendadas), as = n(x.asistidas);
        return { ...x, cpl: inv !== null && leads ? Math.round(inv / leads) : null, cpc: inv !== null && as ? Math.round(inv / as) : null, conv: leads && as !== null ? Math.round((as / leads) * 1000) / 10 : null, ag, as, leads, inv };
      });
      const tot = calc.reduce((s, x) => ({ inv: s.inv + (x.inv || 0), leads: s.leads + (x.leads || 0), as: s.as + (x.as || 0) }), { inv: 0, leads: 0, as: 0 });
      const mx = (v) => (v === null ? '—' : `$${v.toLocaleString('es-MX')}`);
      return {
        filasCaptura: calc,
        serie: { unidad: '% lead → cita asistida', max: 100, puntos: calc.filter((x) => x.conv !== null).map((x) => ({ etq: x.cliente || 'Sin nombre', valor: x.conv })) },
        tabla: { cols: ['Cliente', 'Inversión', 'Leads', 'Citas agendadas', 'Citas asistidas', 'Costo por lead', 'Costo por cita asistida', 'Lead → cita asistida'], filas: calc.map((x) => [x.cliente || '—', mx(x.inv), x.leads ?? '—', x.ag ?? '—', x.as ?? '—', mx(x.cpl), mx(x.cpc), x.conv === null ? '—' : `${x.conv} %`]) },
        resumen: tot.leads ? `Con ${mx(tot.inv)} de inversión se generaron ${tot.leads} leads y ${tot.as} citas asistidas: ${Math.round((tot.as / tot.leads) * 1000) / 10} % de lead a cita asistida${tot.as ? ` y ${mx(Math.round(tot.inv / tot.as))} por cita asistida` : ''}.` : 'Captura las cifras de Meta, SCORE o Metricool de cada cliente; el Portal calcula costos y conversión.',
      };
    },
  },
  texto: { nombre: 'Texto libre', graficas: ['texto'], calcular: () => ({ resumen: '' }) },
};

// ---------- Plantillas por área ----------
const PLANTILLAS = {
  direccion: ['entregas', 'a_tiempo_semana', 'semaforo_clientes', 'salud_proyectos', 'focus_map', 'decisiones', 'hitos', 'carga_areas', ['texto', 'Conclusiones y siguientes pasos']],
  marketing: ['entregas', 'a_tiempo_semana', 'captura_marketing', 'por_cliente', 'por_persona', 'focus_map', 'hitos', ['texto', 'Conclusiones y siguientes pasos']],
  diseno: ['entregas', 'a_tiempo_semana', 'dias_entrega', 'por_cliente', 'por_persona', 'focus_map', ['texto', 'Conclusiones y siguientes pasos']],
  cuentas: ['entregas', 'semaforo_clientes', 'satisfaccion', 'salud_proyectos', 'hitos', 'minutas', 'decisiones', ['texto', 'Conclusiones y siguientes pasos']],
  admin: ['entregas', 'a_tiempo_semana', 'por_persona', 'por_cliente', ['texto', 'Conclusiones y siguientes pasos']],
};
const idBloque = () => 'b' + Math.random().toString(36).slice(2, 8);
export function bloqueNuevo(fuente, titulo = null) {
  const b = { id: idBloque(), fuente, titulo, texto: null, grafica: null, oculto: false };
  if (fuente === 'captura_marketing') b.captura = { filas: [] };
  if (fuente === 'texto') b.texto = '';
  return b;
}
export function reporteNuevo(area, tipoPeriodo, rango, uId) {
  const bloques = PLANTILLAS[area].map((x) => (Array.isArray(x) ? bloqueNuevo(x[0], x[1]) : bloqueNuevo(x)));
  // Pauta: arranca con los clientes con los que trabajó el área en el periodo (se pueden agregar o quitar).
  const cap = bloques.find((b) => b.fuente === 'captura_marketing');
  if (cap) {
    const t = tareasDe(area).filter((a) => a.cliente !== 'interno' && (enRango(entregaDe(a), rango) || a.estatus !== 'hecho'));
    const ids = [...new Set(t.map((a) => a.cliente))].slice(0, 6);
    cap.captura.filas = ids.map((id) => ({ id: idBloque(), cliente: nombreCliente(id), inversion: '', leads: '', agendadas: '', asistidas: '' }));
  }
  return { titulo: `Reporte de ${nombreArea(area)} · ${textoPeriodo(rango)}`, area, periodo: { tipo: tipoPeriodo, ...rango }, bloques };
}
export function calcularBloque(reporte, bloque, hoy = hoyISO()) {
  const fu = FUENTES[bloque.fuente];
  if (!fu) return { resumen: '' };
  try { return fu.calcular({ area: reporte.area, r: { desde: reporte.periodo.desde, hasta: reporte.periodo.hasta }, hoy, bloque }); }
  catch (e) { console.warn('reporte', bloque.fuente, e); return { resumen: 'No se pudo calcular este bloque.' }; }
}
export const tituloBloque = (b) => b.titulo || FUENTES[b.fuente]?.nombre || 'Bloque';
export const graficaBloque = (b) => b.grafica || FUENTES[b.fuente]?.graficas[0] || 'tabla';
