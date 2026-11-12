import { useState } from "preact/hooks";
import { sb, CFG, DEMO, DEMO_PASS, errMsg } from "../lib.js";
import { html, I, Logo, Avatar } from "../ui.js";

export function Login({ onError }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(null);
  async function entrar(e, p) {
    setCargando(e);
    const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
    setCargando(null);
    if (error) onError("No pudimos iniciar sesión: " + errMsg(error));
  }
  return html`<div class="login">
    <section class="login-marca">
      <${Logo} />
      <div class="login-lema">
        <h1>Órdenes de servicio</h1>
        <p>Mantenimiento e intendencia del club, del reporte al cierre.</p>
        <ul>
          <li>${I.escudo}<span><b>Reporta en un minuto</b>Desde el celular o escaneando el QR de la zona.</span></li>
          <li>${I.persona}<span><b>Llega a quien lo atiende</b>Cada falla se envía sola al área correcta.</span></li>
          <li>${I.reloj}<span><b>Todo queda registrado</b>Quién hizo qué y a qué hora, con fotos.</span></li>
        </ul>
      </div>
    </section>
    <section class="login-form"><div class="box stack">
      <div><h2>Inicia sesión</h2><div class="muted">Entra con tu cuenta del club.</div></div>
      <form class="stack" onSubmit=${(ev) => { ev.preventDefault(); entrar(email.trim(), pass); }}>
        <div class="field"><label for="l-correo">Correo</label><input id="l-correo" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="username" required /></div>
        <div class="field"><label for="l-pass">Contraseña</label>
          <div class="con-boton"><input id="l-pass" type=${ver ? "text" : "password"} value=${pass} onInput=${(e) => setPass(e.target.value)} autocomplete="current-password" required />
            <button type="button" class="ver" aria-label=${ver ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed=${ver} onClick=${() => setVer(!ver)}>${I.ojo}</button></div></div>
        <button class="btn grande" disabled=${!!cargando}>${cargando ? "Entrando…" : "Entrar"}</button>
      </form>
      ${CFG.demo && html`<div class="demo-caja stack">
        <div class="separador"><span>Acceso rápido de demostración</span></div>
        <div class="demo">${DEMO.map(([e, rol, nombre]) => html`<button type="button" disabled=${!!cargando} class=${cargando === e ? "on" : ""} onClick=${() => entrar(e, DEMO_PASS)}><${Avatar} nombre=${nombre} /><b>${rol}</b><span>${nombre}</span></button>`)}</div>
        <div class="small muted">Usuarios y datos ficticios para la demostración.</div>
      </div>`}
    </div></section>
  </div>`;
}
