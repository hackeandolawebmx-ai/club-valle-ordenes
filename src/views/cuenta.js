import { sb, ROL, AREA, DEPTO, PUEDES } from "../lib.js";
import { html, I, Avatar } from "../ui.js";

export function Cuenta({ ctx }) {
  const p = ctx.perfil;
  return html`<div class="pagina angosta">
    <div class="head"><div><h1>Mi cuenta</h1></div></div>
    <div class="card perfil">
      <${Avatar} nombre=${p.nombre} cls="xl" />
      <div><h2>${p.nombre}</h2>
        <div class="muted">${ROL[p.rol]}${p.area ? " · " + AREA[p.area] : ""}${p.departamento ? " · " + DEPTO[p.departamento] : ""}</div></div>
    </div>
    <div class="card"><h3>Qué puedes hacer</h3>
      <ul class="puedes">${PUEDES[p.rol].map((t) => html`<li>${I.check}<span>${t}</span></li>`)}</ul>
      ${p.rol === "gerente" && html`<div class="small muted">Tu vista es de solo lectura: asignar, atender y cerrar lo hacen supervisores y operativos.</div>`}
    </div>
    <div class="nota">${I.nota}<span>Cada cambio queda en el historial de la orden con autor y hora.</span></div>
    <div><button class="btn peligro" onClick=${() => sb.auth.signOut()}>${I.salir}Cerrar sesión</button></div>
  </div>`;
}
