// Bienvenida del Portal de colaboradores: conecta correo, agenda y Notion con
// los menos clics posibles y explica en una línea qué pasa en cada paso.
// Se abre sola la primera vez; después, desde Perfil › Conexiones.
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I } from './ui.js?v=202611270800';
import { googleConectado, entrarConGoogle, buscarNotion, confirmarNotion, terminarBienvenida } from './nube.js?v=202611270800';

const CLAVE_PASO = 'ssam-bienvenida-paso';

export function Bienvenida({ persona, desdeConexiones, cerrar, toast }) {
  const [paso, setPaso] = useState(() => {
    try { const v = Number(localStorage.getItem(CLAVE_PASO)); if (v > 0 && v < 4) return v; } catch (_) { /* nada */ }
    return desdeConexiones ? 1 : 0;
  });
  useEffect(() => { try { localStorage.setItem(CLAVE_PASO, String(paso)); } catch (_) { /* nada */ } }, [paso]);
  const [google] = useState(googleConectado());
  const [notion, setNotion] = useState({ estado: 'buscando' }); // buscando · ligado · elegir · nada · ligando · error
  const nombre = (persona?.nombre || '').split(' ')[0];

  useEffect(() => {
    if (paso !== 2 || notion.estado !== 'buscando') return;
    buscarNotion().then((r) => {
      if (!r.ok) return setNotion({ estado: 'error', error: r.error });
      if (r.ligado) return setNotion({ estado: 'ligado' });
      setNotion({ estado: r.candidatos.length ? 'elegir' : 'nada', candidatos: r.candidatos, compartido: !!r.compartido });
    }).catch((e) => setNotion({ estado: 'error', error: String(e) }));
  }, [paso]);

  const ligar = async (c) => {
    setNotion((n) => ({ ...n, estado: 'ligando', elegido: c }));
    const r = await confirmarNotion(c.id).catch((e) => ({ ok: false, error: String(e) }));
    if (!r.ok) return setNotion((n) => ({ ...n, estado: 'elegir', error: r.error }));
    setNotion({ estado: 'ligado', tareas: r.tareas });
  };

  const terminar = async () => {
    try { localStorage.removeItem(CLAVE_PASO); } catch (_) { /* nada */ }
    if (!desdeConexiones) await terminarBienvenida(persona.id).catch(() => {});
    cerrar(true);
  };

  const pasos = ['Bienvenida', 'Correo y agenda', 'Notion', 'Listo'];
  const notionOk = notion.estado === 'ligado';

  return html`
    <div class="velo alto"></div>
    <div class="bienv" role="dialog" aria-modal="true" aria-label="Bienvenida al Portal de colaboradores">
      <ol class="bienv-pasos" aria-label="Pasos">
        ${pasos.map((t, i) => html`<li key=${t} class=${i < paso ? 'hecho' : i === paso ? 'actual' : ''}><span>${i < paso ? I('check') : i + 1}</span>${t}</li>`)}
      </ol>

      ${paso === 0 && html`<div class="bienv-cuerpo" key="p0">
        <img class="bienv-iso" src="./icons/iso.png" alt="" />
        <h2>Hola${nombre ? `, ${nombre}` : ''}. Este es tu Portal de colaboradores.</h2>
        <p class="bienv-sub">Aquí ves tu día, tus tareas y las de tu equipo, en un solo lugar.</p>
        <ul class="bienv-lista">
          <li>${I('check')}<span><b>Tus tareas de Notion</b> aparecen aquí, y lo que cambies regresa a Notion.</span></li>
          <li>${I('check')}<span><b>Tus juntas</b> con notas de Gemini se vuelven minutas con acuerdos listos para asignar.</span></li>
          <li>${I('check')}<span><b>Tu agenda de hoy</b> y avisos cuando alguien te etiqueta o te asigna algo.</span></li>
        </ul>
        <div class="bienv-acc"><button class="btn prim" onClick=${() => setPaso(1)}>Conectar mis herramientas (1 minuto)</button></div>
      </div>`}

      ${paso === 1 && html`<div class="bienv-cuerpo" key="p1">
        <div class="bienv-ico google">${I('correo')}</div>
        <h2>Correo y agenda</h2>
        ${google ? html`<p class="bienv-ok">${I('check')}Listo: quedaron conectados al entrar con Google.</p>`
          : html`<p class="bienv-sub">Un clic: Google te pedirá permiso y regresas aquí.</p>`}
        <ul class="bienv-lista tenue">
          <li>${I('ojo')}<span>Solo lectura: el Portal <b>no envía, no borra y no mueve</b> nada de tu correo ni de tu agenda.</span></li>
          <li>${I('nota')}<span>Los correos con notas de juntas se vuelven minutas; el resto solo se muestra en tu bandeja.</span></li>
          <li>${I('semana')}<span>Ves tus reuniones de hoy junto a tus tareas.</span></li>
        </ul>
        <div class="bienv-acc">
          ${google ? html`<button class="btn prim" onClick=${() => setPaso(2)}>Siguiente</button>`
            : html`<button class="btn prim" onClick=${() => entrarConGoogle()}>Conectar Google</button><button class="btn fantasma" onClick=${() => setPaso(2)}>Ahora no</button>`}
        </div>
      </div>`}

      ${paso === 2 && html`<div class="bienv-cuerpo" key="p2">
        <div class="bienv-ico notion">N</div>
        <h2>Notion</h2>
        ${notion.estado === 'buscando' && html`<p class="bienv-sub"><span class="girando"></span> Buscando tu cuenta en el Notion de Spark225…</p>`}
        ${notion.estado === 'ligado' && html`<p class="bienv-ok">${I('check')}Listo: tu cuenta de Notion está ligada${notion.tareas != null ? ` y ya trajimos tus tareas` : ''}.</p>`}
        ${(notion.estado === 'elegir' || notion.estado === 'ligando') && html`
          <p class="bienv-sub">${notion.compartido ? 'Esta cuenta comparte el Notion de abajo. ¿Lo vinculas?' : notion.candidatos.length === 1 ? 'Encontramos tu cuenta. ¿Eres tú?' : 'Encontramos estas cuentas. ¿Cuál eres tú?'}</p>
          <div class="bienv-cuentas">
            ${notion.candidatos.map((c) => html`<button key=${c.id} class="bienv-cuenta" disabled=${notion.estado === 'ligando'} onClick=${() => ligar(c)}>
              ${c.foto ? html`<img src=${c.foto} alt="" />` : html`<span class="bienv-ini">${(c.nombre || '?').slice(0, 1)}</span>`}
              <span class="bienv-cuenta-t"><b>${c.nombre}</b>${c.email && html`<small>${c.email}</small>`}</span>
              <span class="btn prim chico">${notion.estado === 'ligando' && notion.elegido?.id === c.id ? html`<span class="girando"></span>` : notion.compartido ? 'Vincular' : 'Sí, soy yo'}</span>
            </button>`)}
          </div>
          ${notion.error && html`<p class="bienv-error">${I('alerta')}${notion.error}</p>`}`}
        ${notion.estado === 'nada' && html`<p class="bienv-sub">No encontramos tu cuenta en el Notion de Spark225. Pídele a un admin que te invite y vuelve a este paso desde Perfil › Conexiones.</p>`}
        ${notion.estado === 'error' && html`<p class="bienv-error">${I('alerta')}No pudimos consultar Notion (${notion.error}). Puedes intentarlo después desde Perfil › Conexiones.</p>`}
        <ul class="bienv-lista tenue">
          <li>${I('repetir')}<span>Tus tareas de la Master Task Database aparecen aquí y <b>lo que cambies regresa a Notion</b> en segundos.</span></li>
          <li>${I('candado')}<span>Tus pendientes privados del Portal no se suben a Notion.</span></li>
        </ul>
        <div class="bienv-acc">
          <button class="btn fantasma" onClick=${() => setPaso(1)}>Atrás</button>
          <button class="btn prim" onClick=${() => setPaso(3)}>${notionOk ? 'Siguiente' : 'Ahora no'}</button>
        </div>
      </div>`}

      ${paso === 3 && html`<div class="bienv-cuerpo" key="p3">
        <img class="bienv-iso" src="./icons/iso.png" alt="" />
        <h2>${google && notionOk ? '¡Todo listo!' : 'Ya puedes empezar'}</h2>
        <ul class="bienv-lista">
          <li class=${google ? '' : 'falta'}>${I(google ? 'check' : 'reloj')}<span>Correo y agenda ${google ? 'conectados' : 'pendientes'}</span></li>
          <li class=${notionOk ? '' : 'falta'}>${I(notionOk ? 'check' : 'reloj')}<span>Notion ${notionOk ? 'ligado' : 'pendiente'}</span></li>
        </ul>
        ${!(google && notionOk) && html`<p class="bienv-sub">Lo pendiente lo conectas cuando quieras desde Perfil › Conexiones.</p>`}
        <div class="bienv-acc"><button class="btn prim" onClick=${terminar}>${desdeConexiones ? 'Cerrar' : 'Entrar a mi día'}</button></div>
      </div>`}
    </div>`;
}
