import { html, render, useState, useEffect, useRef, useCallback, useErrorBoundary } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { ESTATUS, CAPACIDAD_SEMANA, hoyISO, sumarDias } from './datos.js?v=202611270120';
import {
  store, vigentes, participa, siguienteEstatus, cambiarEstatus, alternarFoco, archivar, restaurar,
  borrarDefinitivo, marcarAvisosLeidos, horasEstimadas, esAdmin, mover, visiblePara, actualizar, prefsDe, sinLeerChat, historialGlobal, errorGuardado,
  conectarNube, nube, escucharNube, reintentarSubida, refrescarPersonas, enFiltroInicio, reasignarTareas } from './store.js?v=202611270120';
import { I, Anillo, Avatar, fechaRelativa, haceCuanto } from './ui.js?v=202611270120';
import { CajonActividad, HojaMotivo } from './actividad.js?v=202611270120';
import { AltaRapida } from './mecha.js?v=202611270120';
import { Inicio } from './vistas.js?v=202611270120';
import { Pipeline, HojaMinuta } from './pipeline.js?v=202611270120';
import { Archivero, DetalleCliente } from './archivero.js?v=202611270120';
import { Tablero } from './tablero.js?v=202611270120';
import { Portafolio, DetalleProyecto } from './proyectos.js?v=202611270120';
import { MaestroTareas, MaestroHitos, MaestroRiesgos, MaestroMinutas } from './bases.js?v=202611270120';
import { RecursosHumanos, areaDe } from './rh.js?v=202611270120';
import { EditarPerfil, aplicarInterfaz } from './perfil.js?v=202611270120';
import { AsistenteTarea, AsistenteCliente, AsistenteProyecto, MenuCrear } from './asistente.js?v=202611270120';
import { Chat } from './chat.js?v=202611270120';
import { Login, NuevaClave, Pendiente, Cargando } from './login.js?v=202611270120';
import { sesionActual, alCambiarSesion, miPerfil, salirNube, aprobarPersona, invitarPersona, cargarTodo, sincronizarNotion, marcarGoogle } from './nube.js?v=202611270120';
import { Bienvenida as Conexiones } from './bienvenida.js?v=202611270120';
import { Instalar } from './instalar.js?v=202611270120';
import { notificar, activarPush } from './avisos.js?v=202611270120';
import { Bienvenida, Recorrido } from './tour.js?v=202611270120';
import { useArrastre } from './arrastre.js?v=202611270120';
import { Galeria } from './widgets.js?v=202611270120';

function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.suscribir(() => set((x) => x + 1)), []);
  return store.get();
}
function useRuta() {
  const leer = () => location.hash.replace(/^#/, '') || '/';
  const [r, set] = useState(leer);
  useEffect(() => { const f = () => set(leer()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
const leerLocal = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
const escribirLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } };
const escribiendo = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

function App() {
  const db = useStore();
  const ruta = useRuta();
  const arr = useArrastre();
  const [yo, setYo] = useState(() => { const v = leerLocal('ssam-equipo-yo', 'adan'); return db.personas.some((p) => p.id === v) ? v : 'adan'; });
  const [tema, setTema] = useState(() => leerLocal('ssam-equipo-tema', 'dark'));
  const [fecha, setFecha] = useState(hoyISO());
  const [cajon, setCajon] = useState(null);
  const [menu, setMenu] = useState(null);
  const [paleta, setPaleta] = useState(false);
  const [avisos, setAvisos] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [rapida, setRapida] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [ultimoCliente, setUltimoCliente] = useState('interno');
  const [galeria, setGaleria] = useState(null);
  const [chat, setChat] = useState(null);
  // fase: cargando · login · demo · nube · pendiente · clave · error
  const [fase, setFase] = useState('cargando');
  const [fallo, setFallo] = useState('');
  const [correoPend, setCorreoPend] = useState('');
  const [estNube, setEstNube] = useState({ ...nube });
  const iniciando = useRef(false);
  const faseRef = useRef('cargando');
  faseRef.current = fase;
  const [tour, setTour] = useState(null);
  const [asis, setAsis] = useState(null);
  const [menuCrear, setMenuCrear] = useState(false);
  const [minuta, setMinuta] = useState(null);
  // Bienvenida: 'inicio' la primera vez; 'conexiones' desde el perfil.
  const [bienvenida, setBienvenida] = useState(null);
  const [instalar, setInstalar] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = tema; escribirLocal('ssam-equipo-tema', tema); }, [tema]);
  const [editarPerfil, setEditarPerfil] = useState(false);
  useEffect(() => { escribirLocal('ssam-equipo-yo', yo); }, [yo]);
  useEffect(() => { setChat(null); setCajon(null); setMenuCrear(false); setMinuta(null); }, [ruta]);

  useEffect(() => escucharNube(setEstNube), []);
  // Notion: al entrar y cada 5 minutos se pide traer lo nuevo (lo que cambie llega en vivo).
  useEffect(() => {
    if (fase !== 'nube') return;
    sincronizarNotion();
    const t = setInterval(sincronizarNotion, 5 * 60000);
    return () => clearInterval(t);
  }, [fase]);
  // Aviso nuevo para mí (de otra persona o de Notion): toast y notificación del sistema si está permitida.
  const vistos = useRef(null);
  useEffect(() => {
    if (fase !== 'nube' && fase !== 'demo') { vistos.current = null; return; }
    const mios = db.avisos.filter((n) => n.para === yo);
    if (!vistos.current) { vistos.current = new Set(mios.map((n) => n.id)); return; }
    mios.filter((n) => !vistos.current.has(n.id)).forEach((n) => {
      vistos.current.add(n.id);
      if (n.leido) return;
      const accion = n.accion === 'conexiones' ? { texto: 'Vincular', f: () => setBienvenida('conexiones') }
        : n.actividad ? { texto: 'Ver', f: () => setCajon({ id: n.actividad }) }
        : minutaDeAviso(n, db) ? { texto: 'Ver minuta', f: () => setMinuta(minutaDeAviso(n, db)) }
        : n.url ? { texto: 'Abrir', f: () => window.open(n.url, '_blank', 'noopener') } : null;
      toast(n.texto, accion);
      if (!n.push && (document.hidden || n.tipo === 'importante')) notificar(n.texto, { tag: n.clave || n.id, url: n.url }); // si vino del servidor, el teléfono ya lo recibió
    });
  }, [db.avisos, fase, yo]);
  // Arranque: con sesión de Supabase carga tus datos reales; sin sesión, pantalla de entrada (o la demo si la elegiste).
  const iniciar = async (s) => {
    if (iniciando.current) return;
    if (!s) { setFase(leerLocal('ssam-equipo-sesion', '') === 'demo' ? 'demo' : 'login'); return; }
    iniciando.current = true;
    try {
      setFase('cargando');
      const p = await miPerfil(s.user.id);
      if (!p || p.permiso === 'pendiente') { setCorreoPend(s.user.email); setFase('pendiente'); return; }
      if (p.google_conectado) marcarGoogle(true);
      activarPush(p.id); // si ya dio permiso de avisos, mantiene dado de alta este dispositivo
      await conectarNube(p);
      setYo(p.id);
      setFase('nube');
      // Primera vez (o regreso de conectar Google a mitad de la bienvenida): bienvenida antes del recorrido.
      let pasoPendiente = null;
      try { pasoPendiente = localStorage.getItem('ssam-bienvenida-paso'); } catch (_) { /* nada */ }
      if (!p.bienvenida || pasoPendiente) setTimeout(() => setBienvenida(p.bienvenida ? 'conexiones' : 'inicio'), 300);
      else if (!leerLocal('ssam-equipo-tour-' + p.id, '')) { escribirLocal('ssam-equipo-tour-' + p.id, '1'); setTimeout(() => setTour('pasos'), 500); }
    } catch (err) { setFallo(String(err?.message || err)); setFase('error'); }
    finally { iniciando.current = false; }
  };
  useEffect(() => {
    sesionActual().then(iniciar).catch(() => setFase('login'));
    return alCambiarSesion((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setFase('clave');
      else if (ev === 'SIGNED_IN' && faseRef.current !== 'nube' && faseRef.current !== 'clave') iniciar(s);
      else if (ev === 'SIGNED_OUT') { store.modoDemo(); setFase('login'); }
    });
  }, []);

  const toast = useCallback((texto, accion) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, texto, accion }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const persona = ruta.startsWith('/persona/') && db.personas.some((p) => p.id === ruta.split('/')[2]) ? ruta.split('/')[2] : yo;
  const clienteRuta = ruta.startsWith('/cliente/') ? decodeURIComponent(ruta.split('/')[2] || '') : null;
  const proyectoRuta = ruta.startsWith('/proyecto/') ? decodeURIComponent(ruta.split('/')[2] || '') : null;
  const rhRuta = ruta === '/equipo' ? 'personas' : ruta.startsWith('/rh') ? (['documentos', 'personas'].includes(ruta.split('/')[2]) ? ruta.split('/')[2] : 'spark') : null;
  const vista = clienteRuta ? 'cliente' : proyectoRuta ? 'proyecto' : rhRuta ? 'rh' : ruta.startsWith('/tablero') ? 'tablero' : { '/papelera': 'papelera', '/historial': 'historial', '/pipeline': 'pipeline', '/clientes': 'clientes', '/proyectos': 'proyectos', '/tareas': 'tareas', '/hitos': 'hitos', '/riesgos': 'riesgos', '/minutas': 'minutas' }[ruta] || 'dia';
  const vistaCal = prefsDe(yo).vista;

  const ctx = {
    db, yo, persona, fecha, setFecha, toast, ultimoCliente, setUltimoCliente,
    abrirChat: (canal) => setChat({ canal }),
    ponerEstatus: (a, e) => { const r = cambiarEstatus(a.id, e, yo); if (!r.ok) toast(r.motivo); },
    cambiarCliente: (a, c) => { if (a.cliente !== c) { actualizar(a.id, { cliente: c, proyecto: 'g-' + c }, yo); toast('Cliente cambiado'); } },
    abrirGaleria: (agregar) => setGaleria({ agregar }),
    abrir: (id) => setCajon({ id }),
    abrirBorrador: (b) => setCajon({ nuevo: b }),
    // Crear siempre con el asistente pregunta por pregunta.
    nueva: (extra = {}) => setAsis({ tipo: 'tarea', inicial: extra }),
    crear: (tipo, inicial = {}) => { setMenuCrear(false); setAsis({ tipo, inicial }); },
    abrirMinuta: (id) => setMinuta(id),
    enNube: fase === 'nube',
    avanzar: (a) => {
      const de = a.estatus;
      const r = cambiarEstatus(a.id, siguienteEstatus(a.estatus), yo);
      if (!r.ok) return toast(r.motivo);
      if (siguienteEstatus(de) === 'hecho') toast(r.repite ? 'Terminada · ya quedó la siguiente' : 'Terminada', { texto: 'Deshacer', f: () => cambiarEstatus(a.id, de, yo) });
    },
    foco: (a) => { const r = alternarFoco(a.id, yo); if (!r.ok) toast('Máximo 3 en foco'); },
    abrirMenu: (ev, a) => {
      ev.preventDefault(); ev.stopPropagation();
      const rc = ev.currentTarget.getBoundingClientRect();
      setMenu({ x: Math.min(ev.clientX || rc.left, innerWidth - 240), y: Math.min(ev.clientY || rc.bottom, innerHeight - 300), a });
    },
    archivarConDeshacer: (a) => { archivar(a.id, yo); toast('Eliminada', { texto: 'Deshacer', f: () => restaurar(a.id, yo) }); },
    // Regla: si cambia el día, se pide el motivo (un toque). Si solo cambia la hora, se mueve directo.
    moverConRegla: (a, cambios) => {
      if (cambios.fecha && cambios.fecha !== a.fecha) {
        setMotivo({ ok: (m) => { mover(a.id, cambios, yo, m); toast(`Movida a ${fechaRelativa(cambios.fecha)}`, { texto: 'Deshacer', f: () => mover(a.id, { fecha: a.fecha, bloque: a.bloque }, yo, 'Deshacer') }); } });
      } else mover(a.id, cambios, yo);
    },
  };

  useEffect(() => {
    const f = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v); return; }
      if (e.key === 'Escape') { setMenu(null); setPerfil(false); setPaleta(false); setAvisos(false); setRapida(null); setMenuCrear(false); setMinuta(null); if (!document.querySelector('.hoja')) setChat(null); return; }
      if (escribiendo(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey || cajon || paleta || menu || chat || tour || asis || minuta) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); ctx.nueva(); }
      if (e.key === 'ArrowRight' && vista === 'dia' && vistaCal === 'dia') setFecha((f) => sumarDias(f, 1));
      if (e.key === 'ArrowLeft' && vista === 'dia' && vistaCal === 'dia') setFecha((f) => sumarDias(f, -1));
      if (e.key === 't' || e.key === 'T') setFecha(hoyISO());
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  if (fase === 'cargando' || fase === 'error') return html`<${Cargando} error=${fase === 'error' ? fallo : ''} reintentar=${() => sesionActual().then(iniciar)} salir=${() => salirNube()} />`;
  if (fase === 'pendiente') return html`<${Pendiente} correo=${correoPend} />`;
  if (fase === 'clave') return html`<${NuevaClave} listo=${() => sesionActual().then(iniciar)} />`;
  if (fase === 'login') return html`<${Login} entrarDemo=${() => {
    escribirLocal('ssam-equipo-sesion', 'demo'); setYo('adan'); setFase('demo'); location.hash = '#/'; setTimeout(() => setTour('pasos'), 450);
  }} />`;
  const enNube = fase === 'nube';
  const salir = () => { try { localStorage.removeItem('ssam-equipo-sesion'); } catch (_) { /* sin almacenamiento */ } setPerfil(false); setTour(null); if (enNube) salirNube(); else setFase('login'); };

  const yoP = db.personas.find((p) => p.id === yo);
  const prefsYo = prefsDe(yo);
  aplicarInterfaz(prefsYo); // barato e idempotente; aquí no puede ir un hook (hay returns antes). Incluye el menú abajo o a un lado.
  const misAvisos = db.avisos.filter((n) => n.para === yo);
  const sinLeer = misAvisos.filter((n) => !n.leido).length;
  const arrastrandoAlgo = !!arr && !arr.datos?.nodo;
  const chatSinLeer = sinLeerChat(yo);
  const cerrarTour = () => { setTour(null); escribirLocal('ssam-equipo-tour', '1'); };

  return html`
    <div class="app">
      <header class="top">
        <button class="yo-btn" onClick=${() => setPerfil(true)} aria-label="Tu perfil"><${Avatar} p=${yoP} grande /></button>
        ${vista === 'dia' && vistaCal === 'dia' ? html`<${Dias} fecha=${fecha} setFecha=${setFecha} db=${db} persona=${persona} yo=${yo} />` : html`<div class="dias titulo-top">${{ equipo: 'Equipo', papelera: 'Papelera', historial: 'Historial' }[vista] || ''}</div>`}
        <div class="top-der">
          ${enNube && estNube.estado !== 'listo' && html`<button class=${'sync ' + estNube.estado} onClick=${reintentarSubida} title=${estNube.ultimoError || ''}>${estNube.estado === 'error' ? html`${I('alerta')}<span>Sin guardar · reintentar</span>` : html`<i></i><span>Guardando</span>`}</button>`}
          <button class="icon-btn" onClick=${() => setChat({})} aria-label=${`Chat${chatSinLeer ? `, ${chatSinLeer} sin leer` : ''}`} data-tour="chat">${I('chat')}${chatSinLeer ? html`<em class="top-badge num">${chatSinLeer}</em>` : null}</button>
          <button class="icon-btn" onClick=${() => setPaleta(true)} aria-label="Buscar" data-tour="buscar">${I('buscar')}</button>
          <a class="icon-btn" href="#/historial" aria-label="Historial" title="Historial">${I('historial')}</a>
          <button class="icon-btn" onClick=${() => setAvisos((v) => !v)} aria-label=${`Avisos${sinLeer ? `, ${sinLeer} nuevos` : ''}`}>${I('campana')}${sinLeer ? html`<span class="punto"></span>` : null}</button>
        </div>
      </header>

      <main class="principal">
        ${errorGuardado && html`<div class="aviso-guardado" role="alert">${I('alerta')}No se pudo guardar en este navegador. Descarga un respaldo desde tu perfil.</div>`}
        <${Protegido} key=${vista + (clienteRuta || '') + (proyectoRuta || '')}>
          ${vista === 'dia' && html`<${Inicio} ...${ctx} />`}
          ${vista === 'pipeline' && html`<${Pipeline} ctx=${ctx} />`}
          ${vista === 'clientes' && html`<${Archivero} ctx=${ctx} />`}
          ${vista === 'cliente' && html`<${DetalleCliente} id=${clienteRuta} ctx=${ctx} />`}
          ${vista === 'proyectos' && html`<${Portafolio} ctx=${ctx} />`}
          ${vista === 'tareas' && html`<${MaestroTareas} ctx=${ctx} />`}
          ${vista === 'hitos' && html`<${MaestroHitos} ctx=${ctx} />`}
          ${vista === 'riesgos' && html`<${MaestroRiesgos} ctx=${ctx} />`}
          ${vista === 'minutas' && html`<${MaestroMinutas} ctx=${ctx} />`}
          ${vista === 'proyecto' && html`<${DetalleProyecto} id=${proyectoRuta} ctx=${ctx} />`}
          ${vista === 'historial' && html`<${Historial} db=${db} />`}
          ${vista === 'tablero' && html`<${Tablero} ctx=${ctx} pestana=${['entregas', 'orden'].includes(ruta.split('/')[2]) ? ruta.split('/')[2] : 'enfoque'} />`}
          ${vista === 'rh' && html`<${RecursosHumanos} ctx=${ctx} pestana=${rhRuta} Personas=${html`<${Equipo} db=${db} yo=${yo} enNube=${enNube} toast=${toast} />`} />`}
          ${vista === 'papelera' && html`<${Papelera} db=${db} yo=${yo} toast=${toast} />`}
        <//>
      </main>

      <nav class=${'dock' + (arrastrandoAlgo ? ' modo-soltar' : '')} aria-label="Principal">
        ${arrastrandoAlgo
          ? html`<div class=${'zona-papelera' + (arr?.destino?.tipo === 'papelera' ? ' sobre' : '')} data-drop="papelera">${I('papelera')}<span>Eliminar</span></div>`
          : html`
            <a href="#/" class="dock-it" aria-current=${vista === 'dia' && persona === yo ? 'page' : null} onClick=${() => setFecha(hoyISO())}>${I('inicio')}<span>Inicio</span></a>
            <a href="#/pipeline" class="dock-it" aria-current=${vista === 'pipeline' ? 'page' : null} data-tour="pipeline">${I('columnas')}<span>Pipeline</span></a>
            <a href="#/tablero" class="dock-it" aria-current=${vista === 'tablero' ? 'page' : null}>${I('grafica')}<span>Tablero</span></a>
            <span class="rel"><button class="dock-mas" onClick=${() => setMenuCrear((v) => !v)} aria-label="Crear" aria-expanded=${menuCrear} data-tour="mas">${I('mas')}</button>
              ${menuCrear && html`<${MenuCrear} elegir=${(t) => ctx.crear(t, t === 'tarea' ? {} : clienteRuta && db.clientes.some((c) => c.id === clienteRuta) ? { cliente: clienteRuta } : {})} cerrar=${() => setMenuCrear(false)} />`}</span>
            <a href="#/clientes" class="dock-it" aria-current=${['clientes', 'cliente', 'proyectos', 'proyecto'].includes(vista) ? 'page' : null} data-tour="clientes">${I('clientes')}<span>Clientes</span></a>
            <a href="#/rh" class="dock-it" aria-current=${vista === 'rh' || persona !== yo ? 'page' : null}>${I('rh')}<span>RH</span></a>`}
      </nav>

      ${arr && html`<div class="fantasma-arr" style=${`left:${arr.x}px;top:${arr.y}px;--c:${arr.color || 'var(--chispa)'}`}><i></i>${arr.etiqueta}</div>`}
      ${cajon && html`<${CajonActividad} key=${cajon.id || 'nueva'} cajon=${cajon} yo=${yo} db=${db} toast=${toast} cerrar=${() => setCajon(null)}
        pedirMotivo=${(f) => setMotivo({ ok: f })} />`}
      ${motivo && html`<${HojaMotivo} cancelar=${() => setMotivo(null)} elegir=${(m) => { const f = motivo.ok; setMotivo(null); f(m); }} />`}
      ${menu && html`<${MenuEstatus} menu=${menu} cerrar=${() => setMenu(null)} ctx=${ctx} />`}
      ${bienvenida && html`<${Conexiones} persona=${yoP} desdeConexiones=${bienvenida === 'conexiones'} toast=${toast} cerrar=${() => {
        setBienvenida(null);
        if (!leerLocal('ssam-equipo-tour-' + yo, '')) { escribirLocal('ssam-equipo-tour-' + yo, '1'); setTimeout(() => setTour('pasos'), 400); }
      }} />`}
      ${instalar && html`<${Instalar} persona=${yo} toast=${toast} cerrar=${() => setInstalar(false)} />`}
      ${editarPerfil && html`<${EditarPerfil} db=${db} yo=${yo} tema=${tema} setTema=${setTema} enNube=${enNube} toast=${toast} cerrar=${() => setEditarPerfil(false)} />`}
      ${perfil && html`<${Perfil} personalizar=${() => { setPerfil(false); setEditarPerfil(true); }} instalar=${() => { setPerfil(false); setInstalar(true); }} conexiones=${() => { setPerfil(false); setBienvenida('conexiones'); }} enNube=${enNube} db=${db} yo=${yo} setYo=${(v) => { setYo(v); location.hash = '#/'; }} tema=${tema} setTema=${setTema} cerrar=${() => setPerfil(false)} toast=${toast} recorrido=${() => { setPerfil(false); location.hash = '#/'; setTour('pasos'); }} salir=${salir} />`}
      ${paleta && html`<${Paleta} db=${db} yo=${yo} cerrar=${() => setPaleta(false)} ctx=${ctx} setTema=${() => setTema(tema === 'dark' ? 'light' : 'dark')} />`}
      ${avisos && html`<${Avisos} avisos=${misAvisos} yo=${yo} db=${db} abrir=${ctx.abrir} abrirMinuta=${ctx.abrirMinuta} conexiones=${() => setBienvenida('conexiones')} cerrar=${() => setAvisos(false)} toast=${toast} />`}
      ${chat && html`<${Chat} db=${db} yo=${yo} toast=${toast} cerrar=${() => setChat(null)} canalInicial=${chat.canal} />`}
      ${tour === 'bienvenida' && html`<${Bienvenida} nombre=${yoP?.corto} area=${areaDe(yo)?.nombre} verSpark=${() => { cerrarTour(); location.hash = '#/rh/spark'; }} empezar=${() => { location.hash = '#/'; setTour('pasos'); }} saltar=${cerrarTour} />`}
      ${tour === 'pasos' && html`<${Recorrido} terminar=${cerrarTour} />`}
      ${galeria && html`<${Galeria} db=${db} agregar=${galeria.agregar} cerrar=${() => setGaleria(null)} />`}
      ${asis?.tipo === 'tarea' && html`<${AsistenteTarea} ctx=${ctx} inicial=${asis.inicial} cerrar=${() => setAsis(null)} />`}
      ${asis?.tipo === 'cliente' && html`<${AsistenteCliente} ctx=${ctx} cerrar=${() => setAsis(null)} />`}
      ${asis?.tipo === 'proyecto' && html`<${AsistenteProyecto} ctx=${ctx} inicial=${asis.inicial} cerrar=${() => setAsis(null)} />`}
      ${minuta && html`<${HojaMinuta} id=${minuta} ctx=${ctx} cerrar=${() => setMinuta(null)} />`}
      ${rapida && html`<${AltaRapida} pos=${rapida} ctx=${ctx} cerrar=${() => setRapida(null)} />`}
      <div class="toasts" role="status" aria-live="polite">
        ${toasts.map((t) => html`<div class="toast" key=${t.id}><span>${t.texto}</span>${t.accion && html`<button onClick=${() => { t.accion.f(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>${t.accion.texto}</button>`}</div>`)}
      </div>
    </div>`;
}

// ---------- Barra de días: navegar y soltar actividades ----------
function Dias({ fecha, setFecha, db, persona, yo }) {
  const arr = useArrastre();
  const hoy = hoyISO();
  const dias = [-1, 0, 1, 2, 3, 4, 5].map((n) => sumarDias(hoy, n));
  const fmtD = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
  const suyas = vigentes().filter((a) => participa(a, persona) && a.estatus !== 'hecho' && visiblePara(a, yo) && enFiltroInicio(a, yo));
  return html`
    <div class="dias" role="tablist" aria-label="Días" data-tour="dias">
      ${dias.map((f) => {
        const n = suyas.filter((a) => a.fecha === f).length;
        const sobre = arr?.destino?.tipo === 'dia' && arr.destino.fecha === f;
        const d = new Date(f + 'T12:00:00');
        return html`<button key=${f} role="tab" aria-selected=${f === fecha} class=${'dia-chip' + (f === hoy ? ' hoy' : '') + (sobre ? ' sobre' : '')}
          data-drop="dia" data-fecha=${f} onClick=${() => setFecha(f)} aria-label=${fechaRelativa(f)}>
          <span class="dc-sem">${f === hoy ? 'Hoy' : fmtD.format(d).replace('.', '')}</span>
          <span class="dc-num num">${d.getDate()}</span>
          <span class="dc-puntos">${Array.from({ length: Math.min(n, 4) }).map((_, i) => html`<i key=${i}></i>`)}</span>
        </button>`;
      })}
    </div>`;
}

// ---------- Equipo ----------
function Equipo({ db, yo, enNube, toast }) {
  const admin = esAdmin(yo);
  const hoy = hoyISO();
  const d = new Date(hoy + 'T12:00:00');
  const dom = sumarDias(sumarDias(hoy, -((d.getDay() + 6) % 7)), 6);
  return html`
    <div class="equipo">
      ${db.personas.map((p) => {
        const abiertas = vigentes().filter((a) => participa(a, p.id) && a.estatus !== 'hecho' && visiblePara(a, yo));
        const venc = abiertas.filter((a) => a.fecha < hoy).length;
        const h = vigentes().filter((a) => a.responsable === p.id && a.estatus !== 'hecho' && a.fecha <= dom).reduce((s, a) => s + horasEstimadas(a), 0);
        return html`
          <a class="persona-card" key=${p.id} href=${p.id === yo ? '#/' : '#/persona/' + p.id}>
            <span class="pc-av" style=${`--av:${p.color}`}>${p.foto ? html`<img src=${p.foto} alt="" referrerpolicy="no-referrer" />` : p.nombre.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>
            <span class="pc-n">${p.corto}</span>
            <span class="pc-p">${p.puesto}</span>
            <span class="pc-num num">${abiertas.length}${venc ? html`<em>${venc}</em>` : null}</span>
            <span class="barra-c" title=${`${h} de ${CAPACIDAD_SEMANA} h esta semana`}><i class=${h / CAPACIDAD_SEMANA > 0.85 ? 'alta' : ''} style=${`width:${Math.min(100, (h / CAPACIDAD_SEMANA) * 100)}%`}></i></span>
          </a>`;
      })}
    </div>
    ${admin && html`<${Reasignar} db=${db} yo=${yo} toast=${toast} />`}
    ${enNube && admin && html`<${Accesos} db=${db} toast=${toast} />`}`;
}

// Si alguien deja el equipo o cambia de cuenta, sus tareas abiertas pasan a otra persona y siguen en su proyecto.
function Reasignar({ db, yo, toast }) {
  const [de, setDe] = useState('');
  const [a, setA] = useState('');
  const n = de ? vigentes().filter((x) => x.responsable === de && x.estatus !== 'hecho').length : 0;
  const hacer = () => {
    if (!de || !a || de === a) return toast('Elige de quién y a quién');
    if (!confirm(`¿Pasar ${n} tareas abiertas de ${db.personas.find((p) => p.id === de)?.corto} a ${db.personas.find((p) => p.id === a)?.corto}? A quien las recibe le llega un aviso por cada una.`)) return;
    toast(`Listo: ${reasignarTareas(de, a, yo)} tareas reasignadas`); setDe(''); setA('');
  };
  return html`<section class="tb-panel reasignar">
    <h2>${I('repetir')}Reasignar tareas</h2>
    <p class="tb-sub">Pasa todas las tareas abiertas de una persona a otra. Se quedan en su mismo proyecto y cliente.</p>
    <div class="og-acc">
      <select class="control chico" value=${de} onChange=${(e) => setDe(e.target.value)} aria-label="De quién"><option value="">De…</option>${db.personas.map((p) => html`<option key=${p.id} value=${p.id}>${p.corto}</option>`)}</select>
      <select class="control chico" value=${a} onChange=${(e) => setA(e.target.value)} aria-label="A quién"><option value="">A…</option>${db.personas.filter((p) => p.id !== de).map((p) => html`<option key=${p.id} value=${p.id}>${p.corto}</option>`)}</select>
      <button class="btn prim chico" disabled=${!de || !a || !n} onClick=${hacer}>${de ? `Reasignar ${n}` : 'Reasignar'}</button>
    </div>
  </section>`;
}

// ---------- Accesos (solo admin): aprobar a quien se registró y dar de alta correos ----------
function Accesos({ db, toast }) {
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const recargar = async () => { const { perfiles } = await cargarTodo(); refrescarPersonas(perfiles); };
  const aprobar = async (p) => { try { await aprobarPersona(p.id); await recargar(); toast(`${p.nombre} ya puede entrar`); } catch (e) { toast('No se pudo aprobar: ' + e.message); } };
  const invitar = async () => {
    const e = correo.trim().toLowerCase();
    if (!/^[^@\s]+@spark225\.com$/.test(e) || !nombre.trim()) return toast('Nombre y correo @spark225.com');
    const id = e.split('@')[0].replace(/[^a-z0-9]+/g, '-');
    try {
      await invitarPersona({ id, email: e, nombre: nombre.trim(), corto: nombre.trim().split(' ')[0], permiso: 'colaborador', color: '#5C7CFA' });
      await recargar(); setCorreo(''); setNombre(''); toast('Listo: al registrarse con ese correo entra directo');
    } catch (err) { toast('No se pudo dar de alta: ' + err.message); }
  };
  const pend = db.pendientes || [];
  return html`<section class="accesos">
    <h3>${I('candado')}Accesos</h3>
    ${pend.length > 0 && html`<ul class="acc-pend">${pend.map((p) => html`<li key=${p.id}><span class="acc-n"><b>${p.nombre}</b><small>${p.email}</small></span>
      <button class="btn prim chico" onClick=${() => aprobar(p)}>Aprobar</button></li>`)}</ul>`}
    <form class="acc-alta" onSubmit=${(e) => { e.preventDefault(); invitar(); }}>
      <input placeholder="Nombre" value=${nombre} onInput=${(e) => setNombre(e.target.value)} aria-label="Nombre" />
      <input placeholder="correo@spark225.com" value=${correo} onInput=${(e) => setCorreo(e.target.value)} aria-label="Correo" type="email" />
      <button class="btn" type="submit">${I('mas')}Dar de alta</button>
    </form>
  </section>`;
}

// ---------- Papelera ----------
function Papelera({ db, yo, toast }) {
  const lista = db.actividades.filter((a) => a.archivada && (esAdmin(yo) || participa(a, yo))).sort((a, b) => b.archivada.localeCompare(a.archivada));
  if (!lista.length) return html`<div class="vacio">${I('papelera')}<p>Vacía</p></div>`;
  return html`<div class="tabla-simple">${lista.map((a) => {
    const quedan = Math.max(0, db.papeleraDias - Math.floor((Date.now() - new Date(a.archivada).getTime()) / 86400000));
    const c = db.clientes.find((x) => x.id === a.cliente);
    return html`<div class="fila-papelera" key=${a.id} style=${`--c:${c?.color}`}>
      <span class="bolita"></span>
      <div class="cuerpo"><div class="t">${a.titulo}</div><div class="m num">${quedan} d</div></div>
      <button class="icon-btn" title="Restaurar" onClick=${() => { restaurar(a.id, yo); toast('Restaurada'); }}>${I('reset')}</button>
      ${esAdmin(yo) && html`<button class="icon-btn peligro" title="Borrar para siempre" onClick=${() => { if (confirm('¿Borrar para siempre? No se puede recuperar.')) { borrarDefinitivo(a.id, yo); toast('Borrada'); } }}>${I('x')}</button>`}
    </div>`;
  })}</div>`;
}

// ---------- Historial: solo lectura ----------
function Historial({ db }) {
  const [quien, setQuien] = useState(null);
  const todo = historialGlobal().filter((h) => !quien || h.quien === quien).slice(0, 200);
  const dias = {};
  todo.forEach((h) => { const d = h.cuando.slice(0, 10); (dias[d] = dias[d] || []).push(h); });
  return html`<div class="historial-vista">
    <div class="hist-filtros">
      <button class="chip-op" aria-pressed=${!quien} onClick=${() => setQuien(null)}>Todos</button>
      ${db.personas.map((p) => html`<button key=${p.id} class="per-op" aria-pressed=${quien === p.id} onClick=${() => setQuien(p.id)}><${Avatar} p=${p} />${p.corto}</button>`)}
      <span class="solo-lectura" title="Nadie puede editar el historial">${I('ojo')}</span>
    </div>
    ${Object.entries(dias).map(([d, l]) => html`<section key=${d} class="hist-dia">
      <h3>${fechaRelativa(d)}</h3>
      <ul>${l.map((h, i) => { const p = db.personas.find((x) => x.id === h.quien); const c = db.clientes.find((x) => x.id === h.cliente); return html`<li key=${i}>
        <${Avatar} p=${p} /><div><span><b>${p?.corto || '—'}</b> ${h.que}</span>${h.titulo && html`<span class="hist-act" style=${`--c:${c?.color}`}><i class="bolita"></i>${h.titulo}</span>`}${h.motivo && html`<span class="hist-motivo">${h.motivo}</span>`}</div>
        <time class="num">${new Date(h.cuando).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</time></li>`; })}</ul>
    </section>`)}
  </div>`;
}

// ---------- Capas ----------
function cerrarAlTocarFuera(ref, cerrar) {
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    setTimeout(() => addEventListener('pointerdown', f), 0);
    return () => removeEventListener('pointerdown', f);
  }, []);
}

function MenuEstatus({ menu, cerrar, ctx }) {
  const ref = useRef();
  const a = menu.a;
  const cli = ctx.db.clientes.find((c) => c.id === a.cliente);
  cerrarAlTocarFuera(ref, cerrar);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const k = (e) => { const s = ESTATUS.find((x) => x.tecla === e.key); if (s) { e.preventDefault(); poner(s.id); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const poner = (e) => { const r = cambiarEstatus(a.id, e, ctx.yo); if (!r.ok) ctx.toast(r.motivo); cerrar(); };
  const hoy = hoyISO();
  return html`
    <div class="menu" ref=${ref} role="menu" style=${`left:${menu.x}px;top:${menu.y}px;--c:${cli?.color}`}>
      ${ESTATUS.map((s) => html`<button key=${s.id} role="menuitemradio" aria-checked=${a.estatus === s.id} onClick=${() => poner(s.id)}><${Anillo} estatus=${s.id} />${s.nombre}</button>`)}
      <div class="sep"></div>
      <button role="menuitem" onClick=${() => { ctx.foco(a); cerrar(); }}>${I('foco')}${a.foco === hoy ? 'Quitar foco' : 'Foco'}</button>
      <button role="menuitem" onClick=${() => { ctx.moverConRegla(a, { fecha: sumarDias(a.fecha < hoy ? hoy : a.fecha, 1) }); cerrar(); }}>${I('semana')}Mañana</button>
      <button role="menuitem" onClick=${() => { ctx.archivarConDeshacer(a); cerrar(); }}>${I('papelera')}Eliminar</button>
    </div>`;
}

// ---------- Respaldo: todo en un archivo .json ----------
function descargarRespaldo() {
  const blob = new Blob([store.exportar()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ssam-respaldo-${hoyISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function restaurarRespaldo(e, toast, cerrar) {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { const res = store.importar(String(r.result)); toast(res.ok ? `Respaldo restaurado: ${res.n} tareas` : res.motivo); if (res.ok) cerrar(); };
  r.onerror = () => toast('No se pudo leer el archivo.');
  r.readAsText(f);
  e.target.value = '';
}

// ---------- Si una pantalla falla, se muestra un aviso en lugar de dejar todo en blanco ----------
function Protegido({ children }) {
  const [error, reintentar] = useErrorBoundary((err) => { try { console.error('[SSAM]', err); } catch (_) { /* nada */ } });
  if (error) return html`<div class="vacio falla" role="alert">${I('alerta')}<p>Esta pantalla tuvo un problema. Tus datos están a salvo.</p>
    <div class="falla-acc"><button class="btn prim" onClick=${reintentar}>Reintentar</button><a class="btn" href="#/" onClick=${reintentar}>Ir al inicio</a><button class="btn fantasma" onClick=${descargarRespaldo}>Descargar respaldo</button></div></div>`;
  return children;
}

function Perfil({ enNube, db, yo, setYo, tema, setTema, cerrar, toast, recorrido, salir, conexiones, instalar, personalizar }) {
  const p = db.personas.find((x) => x.id === yo);
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-label="Perfil">
      <div class="hoja-asa"></div>
      <button class="perfil-cab perfil-cab-btn" onClick=${personalizar}><${Avatar} p=${p} grande /><div><b>${p.nombre}</b><span>${p.puesto}</span></div><span class="perfil-editar">${I('ajustes')}Personalizar</span></button>
      <div class="perfil-op">
        <button class="op" onClick=${() => setTema(tema === 'dark' ? 'light' : 'dark')}>${I(tema === 'dark' ? 'sol' : 'luna')}<span>${tema === 'dark' ? 'Claro' : 'Oscuro'}</span></button>
        <button class="op" onClick=${recorrido}>${I('brujula')}<span>Recorrido</span></button>
        ${enNube && html`<button class="op" onClick=${conexiones}>${I('enlace')}<span>Conexiones</span></button>`}
        <button class="op" onClick=${instalar}>${I('celular')}<span>Instalar en tu teléfono</span></button>
        <a class="op" href="#/papelera" onClick=${cerrar}>${I('papelera')}<span>Papelera</span></a>
        <a class="op" href="#/historial" onClick=${cerrar}>${I('historial')}<span>Historial</span></a>
        <button class="op" onClick=${descargarRespaldo}>${I('archivar')}<span>Descargar respaldo</span></button>
        ${!enNube && html`<label class="op">${I('reset')}<span>Restaurar respaldo</span><input type="file" accept="application/json,.json" hidden onChange=${(e) => restaurarRespaldo(e, toast, cerrar)} /></label>`}
        ${!enNube && html`<button class="op" onClick=${() => { if (confirm('¿Volver a los datos de ejemplo? Se pierde lo que hayas cambiado.')) { store.restablecer(); toast('Datos de prueba restablecidos'); cerrar(); } }}>${I('reset')}<span>Reiniciar demo</span></button>`}
        <button class="op" onClick=${salir}>${I('salir')}<span>Cerrar sesión</span></button>
      </div>
      ${!enNube && html`<div class="hoja-t chico">Ver como</div>
      <div class="ver-como">${db.personas.map((x) => html`<button key=${x.id} aria-pressed=${x.id === yo} onClick=${() => { setYo(x.id); cerrar(); }}><${Avatar} p=${x} grande /><span>${x.corto}</span></button>`)}</div>`}
    </div>`;
}

// La minuta de un aviso de notas de Gemini (si el aviso lo creó el servidor, se busca por el correo).
const minutaDeAviso = (n, db) => n.minuta || (n.clave?.startsWith('tr-') ? db.minutas.find((m) => m.correo === 'g-' + n.clave.slice(3))?.id : null) || null;

function Avisos({ avisos, yo, db, abrir, cerrar, toast, abrirMinuta, conexiones }) {
  const ref = useRef();
  cerrarAlTocarFuera(ref, cerrar);
  useEffect(() => () => marcarAvisosLeidos(yo), []);
  return html`
    <div class="avisos-panel" ref=${ref} role="dialog" aria-label="Avisos">
      ${'Notification' in window && Notification.permission === 'default' && html`<button class="aviso-permiso" onClick=${() => Notification.requestPermission().then((r) => { if (r === 'granted') activarPush(yo); toast(r === 'granted' ? 'Listo: te avisaré aunque tengas el Portal cerrado' : 'Notificaciones desactivadas'); })}>${I('campana')}Avisarme aunque tenga el Portal cerrado</button>`}
      ${avisos.length === 0 ? html`<div class="paleta-vacia">${I('check')}</div>` : avisos.slice(0, 12).map((n) => {
        const a = db.actividades.find((x) => x.id === n.actividad);
        return html`<button class=${'aviso-it' + (n.leido ? '' : ' nuevo') + (n.tipo === 'importante' ? ' importante' : '')} key=${n.id} onClick=${() => {
          if (n.accion === 'conexiones') { conexiones(); cerrar(); }
          else if (a && !a.archivada) { abrir(a.id); cerrar(); }
          else if (minutaDeAviso(n, db)) { abrirMinuta(minutaDeAviso(n, db)); cerrar(); }
          else if (n.url) { window.open(n.url, '_blank', 'noopener'); cerrar(); }
        }}>
          <span class="cuerpo">${n.texto}<span class="cuando">${haceCuanto(n.cuando)}</span></span></button>`;
      })}
    </div>`;
}

function Paleta({ db, yo, cerrar, ctx, setTema }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q.trim());
  const acciones = [
    { t: 'Nueva tarea', ico: 'mas', f: () => ctx.crear('tarea') },
    { t: 'Nuevo cliente', ico: 'clientes', f: () => ctx.crear('cliente') },
    { t: 'Nuevo proyecto', ico: 'proyectos', f: () => ctx.crear('proyecto') },
    { t: 'Pipeline', ico: 'columnas', f: () => { location.hash = '#/pipeline'; } },
    { t: 'Clientes', ico: 'clientes', f: () => { location.hash = '#/clientes'; } },
    { t: 'Proyectos (portafolio)', ico: 'foco', f: () => { location.hash = '#/proyectos'; } },
    { t: 'Tareas de todo el equipo', ico: 'lista', f: () => { location.hash = '#/tareas'; } },
    { t: 'Hitos y entregables', ico: 'mapa', f: () => { location.hash = '#/hitos'; } },
    { t: 'Riesgos y decisiones', ico: 'alerta', f: () => { location.hash = '#/riesgos'; } },
    { t: 'Minutas', ico: 'nota', f: () => { location.hash = '#/minutas'; } },
    { t: 'Mapa de enfoque (prioridades del trimestre)', ico: 'foco', f: () => { location.hash = '#/tablero/enfoque'; } },
    { t: 'Entregas a tiempo (tablero)', ico: 'grafica', f: () => { location.hash = '#/tablero/entregas'; } },
    { t: 'Organigrama de Spark', ico: 'organigrama', f: () => { location.hash = '#/rh/spark'; } },
    { t: 'Documentos de la compañía', ico: 'documento', f: () => { location.hash = '#/rh/documentos'; } },
    { t: 'Chat', ico: 'chat', f: () => ctx.abrirChat() },
    { t: 'Historial', ico: 'historial', f: () => { location.hash = '#/historial'; } },
    { t: 'Equipo', ico: 'equipo', f: () => { location.hash = '#/rh/personas'; } },
    { t: 'Papelera', ico: 'papelera', f: () => { location.hash = '#/papelera'; } },
    { t: 'Claro / oscuro', ico: 'tema', f: setTema },
  ].filter((x) => !t || norm(x.t).includes(t));
  const acts = vigentes().filter((a) => visiblePara(a, yo) && (!t || norm(a.titulo + ' ' + (db.clientes.find((c) => c.id === a.cliente)?.nombre || '')).includes(t)))
    .sort((a, b) => (participa(b, yo) - participa(a, yo)) || a.fecha.localeCompare(b.fecha)).slice(0, t ? 8 : 5)
    .map((a) => ({ t: a.titulo, m: fechaRelativa(a.fecha), c: db.clientes.find((x) => x.id === a.cliente)?.color, f: () => ctx.abrir(a.id) }));
  const clis = db.clientes.filter((c) => !c.privado && t && norm(c.nombre).includes(t))
    .map((c) => ({ t: c.nombre, c: c.color, m: 'Cliente', f: () => { location.hash = '#/cliente/' + c.id; } }));
  const pers = db.personas.filter((p) => t && norm(p.nombre + ' ' + p.puesto).includes(t))
    .map((p) => ({ t: p.nombre, p, f: () => { location.hash = p.id === yo ? '#/' : '#/persona/' + p.id; } }));
  const res = [...clis, ...acts, ...pers, ...acciones];
  useEffect(() => setSel(0), [q]);
  const ejecutar = (r) => { cerrar(); r.f(); };
  return html`
    <div class="velo alto" onClick=${cerrar}></div>
    <div class="modal-caja" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="paleta-in">${I('buscar')}<input autofocus placeholder="Buscar" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar"
        onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === 'Enter' && res[sel]) { e.preventDefault(); ejecutar(res[sel]); } }} /></div>
      <div class="paleta-res" role="listbox">
        ${res.length === 0 ? html`<div class="paleta-vacia">Sin resultados</div>` : res.map((r, i) => html`
          <button key=${i} class="paleta-op" role="option" aria-selected=${i === sel} onMouseEnter=${() => setSel(i)} onClick=${() => ejecutar(r)}>
            ${r.p ? html`<${Avatar} p=${r.p} />` : r.c ? html`<span class="bolita" style=${`--c:${r.c}`}></span>` : I(r.ico)}<span>${r.t}</span>${r.m && html`<span class="m">${r.m}</span>`}</button>`)}
      </div>
    </div>`;
}

const raiz = document.getElementById('app');
raiz.textContent = '';
render(html`<${App} />`, raiz);

// Solo en HTTPS: en local se desactiva para no quedarse con versiones viejas en caché.
// Al publicar una versión nueva, el Portal la toma solo: busca actualización al abrir y recarga una vez.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const habia = !!navigator.serviceWorker.controller;
  let recargado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia && !recargado) { recargado = true; location.reload(); } });
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {}));
}
