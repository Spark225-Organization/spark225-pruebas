// Chat interno del equipo, con facturas adjuntas que avanzan: Enviada → Recibida → Pagada.
// En la fase de pruebas los mensajes viven en este navegador; con Supabase serán en tiempo real.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { enviarMensaje, marcarLeidoCanal, avanzarFactura, ESTATUS_FACTURA, canalDirecto, esAdmin } from './store.js?v=202611252300';
import { I, Avatar, haceCuanto } from './ui.js?v=202611252300';

const NOMBRE_EST = { enviada: 'Enviada', recibida: 'Recibida', pagada: 'Pagada' };

export function Chat({ db, yo, cerrar, toast, canalInicial }) {
  const misCanales = db.chat.canales.filter((c) => c.miembros.includes(yo));
  const [canal, setCanal] = useState(canalInicial || misCanales[0]?.id);
  const [texto, setTexto] = useState('');
  const [factura, setFactura] = useState(null);
  const lista = useRef();
  const campo = useRef();
  useEffect(() => { setTimeout(() => campo.current?.focus(), 60); }, [canal]);
  const c = db.chat.canales.find((x) => x.id === canal);
  const msjs = db.chat.mensajes.filter((m) => m.canal === canal);
  const otro = (cn) => cn.nombre ? null : db.personas.find((p) => p.id === cn.miembros.find((m) => m !== yo));
  const nombreCanal = (cn) => cn.nombre || otro(cn)?.corto;
  const leidos = db.chat.leidos[yo] || {};
  const sinLeer = (cn) => db.chat.mensajes.filter((m) => m.canal === cn.id && m.de !== yo && (!leidos[cn.id] || m.cuando > leidos[cn.id])).length;

  useEffect(() => { if (canal) marcarLeidoCanal(canal, yo); }, [canal, msjs.length]);
  useEffect(() => { lista.current && (lista.current.scrollTop = lista.current.scrollHeight); }, [canal, msjs.length]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape' && !factura) cerrar(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });

  const mandar = () => { const t = texto.trim(); if (!t) return; enviarMensaje(canal, yo, { texto: t }); setTexto(''); };
  const otrosSinCanal = db.personas.filter((p) => p.id !== yo && !misCanales.some((cn) => !cn.nombre && cn.miembros.includes(p.id)));
  const destinatarios = c ? c.miembros.filter((m) => m !== yo) : [];

  return html`
    <div class="velo" onClick=${cerrar}></div>
    <aside class="cajon chat" role="dialog" aria-modal="true" aria-label="Chat">
      <div class="chat-canales">
        ${misCanales.map((cn) => { const o = otro(cn); const n = sinLeer(cn); return html`
          <button key=${cn.id} class="canal" aria-pressed=${cn.id === canal} onClick=${() => setCanal(cn.id)} title=${nombreCanal(cn)}>
            ${o ? html`<${Avatar} p=${o} grande />` : html`<span class="canal-ico">${I('chat')}</span>`}
            <span class="canal-n">${nombreCanal(cn)}</span>${n ? html`<em class="num">${n}</em>` : null}
          </button>`; })}
        ${otrosSinCanal.map((p) => html`<button key=${p.id} class="canal tenue" onClick=${() => setCanal(canalDirecto(yo, p.id))} title=${`Escribir a ${p.corto}`}><${Avatar} p=${p} grande /><span class="canal-n">${p.corto}</span></button>`)}
      </div>
      <div class="chat-main">
        <div class="chat-cab"><b>${c ? nombreCanal(c) : ''}</b><span class="chat-miembros">${c?.miembros.map((m) => html`<${Avatar} key=${m} p=${db.personas.find((p) => p.id === m)} />`)}</span>
          <button class="icon-btn" onClick=${cerrar} aria-label="Cerrar">${I('x')}</button></div>
        <div class="chat-lista" ref=${lista}>
          ${msjs.map((m, i) => {
            const p = db.personas.find((x) => x.id === m.de);
            const mio = m.de === yo;
            const seguido = i > 0 && msjs[i - 1].de === m.de;
            return html`<div key=${m.id} class=${'msj' + (mio ? ' mio' : '') + (seguido ? ' seguido' : '')}>
              ${!mio && !seguido ? html`<${Avatar} p=${p} />` : html`<span class="av-esp"></span>`}
              <div class="burbuja-col">
                ${m.tipo === 'factura' ? html`<${TarjetaFactura} m=${m} db=${db} yo=${yo} toast=${toast} />` : html`<div class="burbuja">${m.texto}</div>`}
                ${!seguido && html`<span class="msj-cuando">${haceCuanto(m.cuando)}</span>`}
              </div>
            </div>`;
          })}
        </div>
        <div class="chat-comp">
          <button class="icon-btn" title="Enviar factura" aria-label="Enviar factura" onClick=${() => setFactura({ para: destinatarios.includes('carlos') ? 'carlos' : destinatarios[0], archivo: null })}>${I('factura')}</button>
          <input ref=${campo} class="control" placeholder="Mensaje" value=${texto} onInput=${(e) => setTexto(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); mandar(); } }} aria-label="Mensaje" />
          <button class="btn prim cuadrado" onClick=${mandar} aria-label="Enviar">${I('enviar')}</button>
        </div>
      </div>
    </aside>
    ${factura && html`
      <div class="velo alto" onClick=${() => setFactura(null)}></div>
      <div class="hoja chica" role="dialog" aria-modal="true" aria-label="Enviar factura">
        <div class="hoja-asa"></div>
        <div class="hoja-t">${I('factura')} Factura</div>
        <label class=${'soltar-archivo' + (factura.archivo ? ' listo' : '')}>
          <input type="file" accept=".pdf,.xml,application/pdf,text/xml" onChange=${(e) => { const f = e.target.files?.[0]; if (f) setFactura({ ...factura, archivo: f.name, peso: f.size }); }} />
          ${factura.archivo ? html`${I('check')}<span>${factura.archivo}</span>` : html`${I('adjuntar')}<span>PDF o XML</span>`}
        </label>
        <div class="per-fila">${destinatarios.map((id) => { const p = db.personas.find((x) => x.id === id); return html`<button key=${id} class="per-op" aria-pressed=${factura.para === id} onClick=${() => setFactura({ ...factura, para: id })}><${Avatar} p=${p} />${p.corto}</button>`; })}</div>
        <button class="btn prim ancho" onClick=${() => {
          if (!factura.archivo) return toast('Elige el archivo');
          enviarMensaje(canal, yo, { tipo: 'factura', archivo: factura.archivo, para: factura.para, estatus: 'enviada' });
          setFactura(null); toast('Factura enviada');
        }}>Enviar</button>
      </div>`}`;
}

function TarjetaFactura({ m, db, yo, toast }) {
  const i = ESTATUS_FACTURA.indexOf(m.estatus);
  const puede = (m.para === yo || db.personas.find((p) => p.id === yo)?.permiso === 'dueno') && i < ESTATUS_FACTURA.length - 1;
  const para = db.personas.find((p) => p.id === m.para);
  return html`<div class="factura">
    <div class="fac-top">${I('factura')}<span class="fac-nom">${m.archivo}</span></div>
    <div class="fac-pasos">${ESTATUS_FACTURA.map((e, k) => html`<span key=${e} class=${k <= i ? 'on' : ''}>${NOMBRE_EST[e]}</span>`)}</div>
    <div class="fac-pie"><span>→ ${para?.corto}</span>
      ${puede && html`<button class="btn chico" onClick=${() => { const r = avanzarFactura(m.id, yo); if (!r.ok && r.motivo) toast(r.motivo); }}>${NOMBRE_EST[ESTATUS_FACTURA[i + 1]]}</button>`}</div>
  </div>`;
}
