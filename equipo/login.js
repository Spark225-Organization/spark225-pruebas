// Login de DEMOSTRACIÓN: enseña cómo se verá el acceso. Acepta cualquier dato y no guarda contraseñas.
// El login real (correo @spark225.com + aprobación de un admin) llega con Supabase.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I, Estrella } from './ui.js?v=202611251031';

export function Login({ personas, entrar }) {
  const [modo, setModo] = useState('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState('');
  const campo = useRef();
  useEffect(() => { setTimeout(() => campo.current?.focus(), 80); }, [modo]);

  // Con cualquier dato entra. Si el correo empieza con el nombre de alguien del equipo, entra como esa persona.
  const quien = () => {
    const c = (correo || nombre).toLowerCase();
    return personas.find((p) => c.startsWith(p.id) || c.includes(p.corto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))?.id || 'adan';
  };
  const enviar = (e) => {
    e?.preventDefault();
    if (modo === 'olvide') { setAviso('Te enviamos un enlace para cambiar tu contraseña.'); return; }
    setCargando(true);
    setTimeout(() => entrar(quien()), 650);
  };

  return html`
    <div class="login">
      <div class="login-fondo" aria-hidden="true"><span class="lf-linea"></span><span class="lf-chispa"><${Estrella} /></span></div>
      <form class="login-caja" onSubmit=${enviar}>
        <div class="login-marca"><img src="./icons/iso.png" alt="" /><div><b>SSAM</b><span>Equipo Spark225</span></div></div>

        ${modo !== 'olvide' && html`<div class="segmentado ancho login-tabs">
          <button type="button" aria-pressed=${modo === 'entrar'} onClick=${() => setModo('entrar')}>Entrar</button>
          <button type="button" aria-pressed=${modo === 'registro'} onClick=${() => setModo('registro')}>Crear cuenta</button>
        </div>`}
        ${modo === 'olvide' && html`<h2 class="login-t">Recupera tu acceso</h2>`}

        ${modo === 'registro' && html`<label class="login-campo">${I('persona')}<input ref=${campo} placeholder="Tu nombre" value=${nombre} onInput=${(e) => setNombre(e.target.value)} autocomplete="off" /></label>`}
        <label class="login-campo">${I('correo')}<input ref=${modo === 'registro' ? null : campo} type="text" inputmode="email" placeholder="tu@spark225.com" value=${correo} onInput=${(e) => setCorreo(e.target.value)} autocomplete="off" /></label>
        ${modo !== 'olvide' && html`<label class="login-campo">${I('candado')}<input type="password" placeholder="Contraseña" value=${clave} onInput=${(e) => setClave(e.target.value)} autocomplete="off" /></label>`}

        ${modo === 'registro' && html`<p class="login-nota">${I('check')}Solo correos @spark225.com. Un admin activa tu cuenta.</p>`}
        ${aviso && html`<p class="login-nota ok">${I('check')}${aviso}</p>`}

        <button class="btn prim ancho login-btn" type="submit" disabled=${cargando}>
          ${cargando ? html`<span class="girando"></span>` : modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        ${modo === 'entrar' && html`<button type="button" class="btn ancho login-google" onClick=${() => { setCargando(true); setTimeout(() => entrar('adan'), 650); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 01-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 010-3.8V7.1H2.7a10 10 0 000 9.2z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 002.7 7.1l3.5 2.7C7 7.7 9.3 5.9 12 5.9z"/></svg>
          Continuar con Google</button>`}
        <div class="login-pie">
          ${modo === 'entrar' && html`<button type="button" class="enlace" onClick=${() => { setModo('olvide'); setAviso(''); }}>¿Olvidaste tu contraseña?</button>`}
          ${modo === 'olvide' && html`<button type="button" class="enlace" onClick=${() => { setModo('entrar'); setAviso(''); }}>Volver</button>`}
        </div>
        <p class="login-demo">Demo: cualquier dato entra. No escribas tu contraseña real.</p>
      </form>
    </div>`;
}
