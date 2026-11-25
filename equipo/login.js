// Entrada real con Supabase: correo @spark225.com + contraseña, o Google.
// La demo con datos ficticios sigue disponible para enseñar el sistema sin cuenta.
import { html, useState, useEffect, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { I, Estrella } from './ui.js?v=202611251108';
import { entrar, registrar, recuperar, nuevaClave, entrarConGoogle, conexionSegura, salirNube } from './nube.js?v=202611251108';

const traducir = (m = '') => {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu correo: te enviamos un enlace.';
  if (/spark225/i.test(m)) return 'Solo se aceptan correos @spark225.com.';
  if (/already registered|already exists/i.test(m)) return 'Ese correo ya tiene cuenta. Entra o recupera tu contraseña.';
  if (/password should be at least|weak/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos.';
  if (/fetch|network/i.test(m)) return 'Sin conexión. Revisa tu internet.';
  return m || 'Algo falló. Intenta otra vez.';
};

function Marco({ children, onSubmit }) {
  return html`
    <div class="login">
      <div class="login-fondo" aria-hidden="true"><span class="lf-linea"></span><span class="lf-chispa"><${Estrella} /></span></div>
      <form class="login-caja" onSubmit=${(e) => { e.preventDefault(); onSubmit?.(); }}>
        <div class="login-marca"><img src="./icons/iso.png" alt="" /><div><b>SSAM</b><span>Equipo Spark225</span></div></div>
        ${children}
      </form>
    </div>`;
}

const GOOGLE = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 01-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 010-3.8V7.1H2.7a10 10 0 000 9.2z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 002.7 7.1l3.5 2.7C7 7.7 9.3 5.9 12 5.9z"/></svg>`;

export function Login({ entrarDemo }) {
  const [modo, setModo] = useState('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(() => {
    // Si Google o Supabase regresan con error, se explica aquí y se limpia la dirección.
    const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    const e = q.get('error_description');
    if (!e) return null;
    history.replaceState(null, '', location.pathname);
    return { error: true, t: /database error saving new user/i.test(e) ? 'No se pudo crear tu cuenta. Intenta de nuevo; si sigue, avísale a un admin.' : traducir(e) };
  });
  const campo = useRef();
  const primera = useRef(true);
  useEffect(() => { setTimeout(() => campo.current?.focus(), 80); if (!primera.current) setAviso(null); primera.current = false; }, [modo]);

  const enviar = async () => {
    if (!conexionSegura) return setAviso({ error: true, t: 'Esta página aún no es segura (falta HTTPS). El acceso real se activa en cuanto lo sea.' });
    if (!/^[^@\s]+@spark225\.com$/i.test(correo.trim())) return setAviso({ error: true, t: 'Usa tu correo @spark225.com.' });
    if (modo !== 'olvide' && clave.length < 8) return setAviso({ error: true, t: 'La contraseña debe tener al menos 8 caracteres.' });
    if (modo === 'registro' && !nombre.trim()) return setAviso({ error: true, t: 'Escribe tu nombre.' });
    setCargando(true); setAviso(null);
    try {
      if (modo === 'entrar') { const { error } = await entrar(correo, clave); if (error) throw error; }
      if (modo === 'registro') {
        const { data, error } = await registrar(nombre, correo, clave); if (error) throw error;
        if (!data.session) { setModo('entrar'); setTimeout(() => setAviso({ t: 'Listo. Revisa tu correo y confirma tu cuenta.' }), 100); }
      }
      if (modo === 'olvide') { const { error } = await recuperar(correo); if (error) throw error; setAviso({ t: 'Te enviamos un enlace para cambiar tu contraseña.' }); }
    } catch (err) { setAviso({ error: true, t: traducir(err.message) }); }
    setCargando(false);
  };
  const google = async () => {
    if (!conexionSegura) return setAviso({ error: true, t: 'Esta página aún no es segura (falta HTTPS).' });
    setCargando(true);
    const { error } = await entrarConGoogle();
    if (error) { setCargando(false); setAviso({ error: true, t: traducir(error.message) }); }
  };

  return html`<${Marco} onSubmit=${enviar}>
    ${modo !== 'olvide' && html`<div class="segmentado ancho login-tabs">
      <button type="button" aria-pressed=${modo === 'entrar'} onClick=${() => setModo('entrar')}>Entrar</button>
      <button type="button" aria-pressed=${modo === 'registro'} onClick=${() => setModo('registro')}>Crear cuenta</button>
    </div>`}
    ${modo === 'olvide' && html`<h2 class="login-t">Recupera tu acceso</h2>`}
    ${modo === 'registro' && html`<label class="login-campo">${I('persona')}<input ref=${campo} placeholder="Tu nombre" value=${nombre} onInput=${(e) => setNombre(e.target.value)} autocomplete="name" /></label>`}
    <label class="login-campo">${I('correo')}<input ref=${modo === 'registro' ? null : campo} type="email" inputmode="email" placeholder="tu@spark225.com" value=${correo} onInput=${(e) => setCorreo(e.target.value)} autocomplete="email" /></label>
    ${modo !== 'olvide' && html`<label class="login-campo">${I('candado')}<input type="password" placeholder="Contraseña" value=${clave} onInput=${(e) => setClave(e.target.value)} autocomplete=${modo === 'registro' ? 'new-password' : 'current-password'} /></label>`}
    ${modo === 'registro' && html`<p class="login-nota">${I('check')}Solo correos @spark225.com. Si un admin no te dio de alta, tu cuenta espera su aprobación.</p>`}
    ${aviso && html`<p class=${'login-nota ' + (aviso.error ? 'error' : 'ok')} role=${aviso.error ? 'alert' : 'status'}>${I(aviso.error ? 'alerta' : 'check')}${aviso.t}</p>`}
    <button class="btn prim ancho login-btn" type="submit" disabled=${cargando}>
      ${cargando ? html`<span class="girando"></span>` : modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}
    </button>
    ${modo !== 'olvide' && html`<button type="button" class="btn ancho login-google" onClick=${google} disabled=${cargando}>${GOOGLE}Continuar con Google</button>`}
    <div class="login-pie">
      ${modo === 'entrar' && html`<button type="button" class="enlace" onClick=${() => setModo('olvide')}>¿Olvidaste tu contraseña?</button>`}
      ${modo === 'olvide' && html`<button type="button" class="enlace" onClick=${() => setModo('entrar')}>Volver</button>`}
      <button type="button" class="enlace" onClick=${entrarDemo}>Ver demo</button>
    </div>
    ${!conexionSegura && html`<p class="login-demo">Conexión sin HTTPS: el acceso real se activa cuando el sitio sea seguro.</p>`}
  <//>`;
}

// Llegó desde el enlace «cambiar contraseña» del correo.
export function NuevaClave({ listo }) {
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState(null);
  const [cargando, setCargando] = useState(false);
  const guardar = async () => {
    if (clave.length < 8) return setAviso('La contraseña debe tener al menos 8 caracteres.');
    setCargando(true);
    const { error } = await nuevaClave(clave);
    setCargando(false);
    if (error) setAviso(traducir(error.message)); else listo();
  };
  return html`<${Marco} onSubmit=${guardar}>
    <h2 class="login-t">Nueva contraseña</h2>
    <label class="login-campo">${I('candado')}<input type="password" autofocus placeholder="Al menos 8 caracteres" value=${clave} onInput=${(e) => setClave(e.target.value)} autocomplete="new-password" /></label>
    ${aviso && html`<p class="login-nota error" role="alert">${I('alerta')}${aviso}</p>`}
    <button class="btn prim ancho login-btn" type="submit" disabled=${cargando}>${cargando ? html`<span class="girando"></span>` : 'Guardar y entrar'}</button>
  <//>`;
}

// Cuenta creada pero sin aprobar.
export function Pendiente({ correo }) {
  return html`<${Marco}>
    <h2 class="login-t">Tu cuenta espera aprobación</h2>
    <p class="login-nota ok">${I('reloj')}${correo} ya está registrado. En cuanto un admin te apruebe, entras directo.</p>
    <button type="button" class="btn ancho" onClick=${() => location.reload()}>Revisar otra vez</button>
    <div class="login-pie"><button type="button" class="enlace" onClick=${() => salirNube().then(() => location.reload())}>Salir</button></div>
  <//>`;
}

export function Cargando({ error, reintentar, salir }) {
  return html`<${Marco}>
    ${error ? html`<p class="login-nota error" role="alert">${I('alerta')}No pude cargar tus datos: ${error}</p>
      <button type="button" class="btn prim ancho login-btn" onClick=${reintentar}>Reintentar</button>
      <div class="login-pie"><button type="button" class="enlace" onClick=${salir}>Salir</button></div>`
    : html`<div class="login-cargando"><span class="girando"></span><span>Cargando tu día…</span></div>`}
  <//>`;
}
