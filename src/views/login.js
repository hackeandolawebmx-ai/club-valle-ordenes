import { useState } from "preact/hooks";
import { sb, CFG, DEMO, DEMO_PASS, WA_MENSAJE, waLink, errMsg } from "../lib.js";
import { html, I, Logo, Avatar } from "../ui.js";

export function Login({ onError }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(null);
  const [modo, setModo] = useState("elegir"); // elegir | socio | interno
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(WA_MENSAJE); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch (_) { onError("No pudimos copiar el mensaje. Selecciónalo y cópialo a mano."); }
  }
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
      ${modo === "elegir" && html`<div class="stack">
        <div><h2>Bienvenido</h2><div class="muted">¿Cómo vienes hoy?</div></div>
        <div class="elige">
          <button type="button" class="opcion" onClick=${() => setModo("socio")}><span class="opcion-ico">${I.escudo}</span><span><b>Soy socio</b><small>Reporta una falla en las instalaciones por WhatsApp.</small></span>${I.flecha}</button>
          <button type="button" class="opcion" onClick=${() => setModo("interno")}><span class="opcion-ico">${I.usuario}</span><span><b>Soy del club</b><small>Supervisores, áreas y gerencia: entra con tu cuenta.</small></span>${I.flecha}</button>
        </div>
      </div>`}
      ${modo === "socio" && html`<div class="stack">
        <button type="button" class="volver" onClick=${() => setModo("elegir")}>${I.atras}Volver</button>
        <div><h2>Reporta por WhatsApp</h2><div class="muted">No necesitas cuenta. Te abrimos el chat con el mensaje listo; solo completa los datos y envíalo.</div></div>
        <pre class="wa-previa" aria-label="Mensaje que se enviará">${WA_MENSAJE}</pre>
        <a class="btn grande" href=${waLink()} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
        <button type="button" class="btn sec" onClick=${copiar}>${copiado ? "Mensaje copiado" : "Copiar mensaje"}</button>
        <div class="small muted">Si es una emergencia o hay riesgo para alguien, avisa de inmediato en recepción.</div>
      </div>`}
      ${modo === "interno" && html`<div class="stack">
      <button type="button" class="volver" onClick=${() => setModo("elegir")}>${I.atras}Volver</button>
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
      </div>`}
    </div></section>
  </div>`;
}
