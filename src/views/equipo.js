import { useState } from "preact/hooks";
import { sb, AREA, AREAS, DEPTO, DEPTOS, errMsg } from "../lib.js";
import { html, I, Avatar } from "../ui.js";

const Persona = ({ x, edita, onToggle, ocupado }) => html`<li class=${"persona" + (x.activo ? "" : " baja")}>
  <${Avatar} nombre=${x.nombre} cls="xs" />
  <span class="persona-n"><b>${x.nombre}</b>${x.tipo === "externo" && html`<small>${x.empresa || "Externo"}</small>`}</span>
  <span class=${"tag " + (x.tipo === "externo" ? "ext" : "int")}>${x.tipo === "externo" ? "Externo" : "Interno"}</span>
  ${edita && html`<button class="enlace" disabled=${ocupado} onClick=${() => onToggle(x)}>${x.activo ? "Dar de baja" : "Reactivar"}</button>`}
</li>`;

export function Equipo({ ctx }) {
  const { perfil, perfiles, personal, recargarBase, toast } = ctx;
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("interno");
  const [empresa, setEmpresa] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const esSup = perfil.rol === "supervisor";

  async function correr(fn, ok) {
    setOcupado(true);
    try { const { error } = await fn(); if (error) throw error; await recargarBase(); if (ok) toast(ok); return true; }
    catch (e) { toast(errMsg(e), true); return false; }
    finally { setOcupado(false); }
  }
  async function agregar(e) {
    e.preventDefault();
    const bien = await correr(() => sb.rpc("agregar_personal", { p_nombre: nombre.trim(), p_tipo: tipo, p_empresa: tipo === "externo" ? empresa.trim() || null : null }), "Persona agregada");
    if (bien) { setNombre(""); setEmpresa(""); }
  }
  const alternar = (x) => correr(() => sb.rpc("activar_personal", { p_id: x.id, p_activo: !x.activo }), x.activo ? "Dado de baja" : "Reactivado");

  const gerencia = perfiles.filter((p) => p.rol === "gerente" && p.activo);
  return html`<div class="pagina">
    <div class="head"><div><h1>Equipo</h1>
      <div class="sub">Cómo se organiza la atención. El personal no usa el sistema: cada supervisor lo asigna y le da seguimiento.</div></div></div>

    <div class="org">
      <div class="org-nivel"><div class="org-nodo gerencia"><small>Gerencia</small><b>${gerencia.map((g) => g.nombre).join(", ") || "Gerente"}</b><span class="muted">Vista de solo lectura</span></div></div>
      <div class="org-linea" aria-hidden="true"></div>
      <div class="org-areas">${AREAS.map((a) => {
        const sup = perfiles.filter((p) => p.rol === "supervisor" && p.area === a && p.activo);
        const gente = personal.filter((x) => x.area === a);
        const mia = esSup && perfil.area === a;
        return html`<section class=${"card org-area" + (mia ? " mia" : "")}>
          <header><h3>${AREA[a]}</h3>${a === "compras" && html`<span class="small muted">Recibe órdenes reasignadas por otras áreas</span>`}</header>
          <div class="org-sup"><span class="sup-et">Supervisor</span>${sup.length ? sup.map((s) => html`<span class="quien-at"><${Avatar} nombre=${s.nombre} cls="xs" />${s.nombre}</span>`) : html`<span class="sin">Sin supervisor</span>`}</div>
          <h4>Personal <span class="cuenta">${gente.filter((x) => x.activo).length}</span></h4>
          <ul class="personas">${gente.length ? gente.map((x) => html`<${Persona} key=${x.id} x=${x} edita=${mia} onToggle=${alternar} ocupado=${ocupado} />`) : html`<li class="sin-datos">Sin personal registrado.</li>`}</ul>
          ${mia && html`<form class="stack nuevo-personal" onSubmit=${agregar}>
            <h4>Agregar persona</h4>
            <div class="field"><label for="e-nom">Nombre</label><input id="e-nom" value=${nombre} onInput=${(e) => setNombre(e.target.value)} required /></div>
            <div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed=${tipo === "interno"} class=${tipo === "interno" ? "on" : ""} onClick=${() => setTipo("interno")}>Interno</button><button type="button" aria-pressed=${tipo === "externo"} class=${tipo === "externo" ? "on" : ""} onClick=${() => setTipo("externo")}>Externo</button></div>
            ${tipo === "externo" && html`<div class="field"><label for="e-emp">Empresa o proveedor <span class="opc">opcional</span></label><input id="e-emp" value=${empresa} onInput=${(e) => setEmpresa(e.target.value)} /></div>`}
            <button class="btn" disabled=${ocupado || !nombre.trim()}>Agregar</button>
          </form>`}
        </section>`;
      })}</div>
    </div>

    <h2 class="sec-tit">Quién reporta</h2>
    <div class="deptos">${DEPTOS.map((d) => {
      const gente = perfiles.filter((p) => p.rol === "solicitante" && p.departamento === d && p.activo);
      return html`<section class="card depto"><h3>${DEPTO[d]}</h3>
        ${gente.length ? gente.map((s) => html`<span class="quien-at"><${Avatar} nombre=${s.nombre} cls="xs" />${s.nombre}</span>`) : html`<span class="sin">Sin usuarios</span>`}</section>`;
    })}</div>
    <div class="nota">${I.nota}<span>Los socios no usan cuenta: reportan por WhatsApp con un mensaje ya preparado.</span></div>
  </div>`;
}
