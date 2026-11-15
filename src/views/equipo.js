import { useState } from "preact/hooks";
import { sb, AREA, AREAS, DEPTO, DEPTOS, errMsg } from "../lib.js";
import { html, I, Avatar } from "../ui.js";

const VACIO = { id: null, nombre: "", tipo: "interno", empresa: "", puesto: "", zona: "" };

const Persona = ({ x, edita, onToggle, onEditar, ocupado }) => html`<li class=${"persona" + (x.activo ? "" : " baja")}>
  <${Avatar} nombre=${x.nombre} cls="xs" />
  <span class="persona-n"><b>${x.nombre}</b><small>${[x.tipo === "externo" ? x.empresa || "Externo" : x.puesto, x.zona_asignada].filter(Boolean).join(" · ")}</small></span>
  <span class=${"tag " + (x.tipo === "externo" ? "ext" : "int")}>${x.tipo === "externo" ? "Externo" : "Interno"}</span>
  ${edita && html`<span class="acciones-p"><button class="enlace" disabled=${ocupado} onClick=${() => onEditar(x)}>Editar</button><button class="enlace" disabled=${ocupado} onClick=${() => onToggle(x)}>${x.activo ? "Dar de baja" : "Reactivar"}</button></span>`}
</li>`;

const FormPersona = ({ f, setF, areaSel, setAreaSel, esGer, ocupado, onGuardar, onCancelar }) => html`<form class="stack nuevo-personal" onSubmit=${onGuardar}>
  <h4>${f.id ? "Editar persona" : "Agregar persona"}</h4>
  <div class="field"><label for="e-nom">Nombre</label><input id="e-nom" value=${f.nombre} onInput=${(e) => setF({ ...f, nombre: e.target.value })} required /></div>
  ${esGer && html`<div class="field"><label for="e-area">Área</label><select id="e-area" value=${areaSel} onChange=${(e) => setAreaSel(e.target.value)}>${AREAS.map((a) => html`<option value=${a} selected=${a === areaSel}>${AREA[a]}</option>`)}</select></div>`}
  <div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed=${f.tipo === "interno"} class=${f.tipo === "interno" ? "on" : ""} onClick=${() => setF({ ...f, tipo: "interno" })}>Interno</button><button type="button" aria-pressed=${f.tipo === "externo"} class=${f.tipo === "externo" ? "on" : ""} onClick=${() => setF({ ...f, tipo: "externo" })}>Externo</button></div>
  <div class="field"><label for="e-pue">Puesto <span class="opc">opcional</span></label><input id="e-pue" value=${f.puesto} onInput=${(e) => setF({ ...f, puesto: e.target.value })} placeholder="Ej. Técnico plomero" /></div>
  <div class="field"><label for="e-zon">Zona o departamento <span class="opc">opcional</span></label><input id="e-zon" value=${f.zona} onInput=${(e) => setF({ ...f, zona: e.target.value })} placeholder="Ej. Vestidor de damas" /></div>
  ${f.tipo === "externo" && html`<div class="field"><label for="e-emp">Empresa o proveedor <span class="opc">opcional</span></label><input id="e-emp" value=${f.empresa} onInput=${(e) => setF({ ...f, empresa: e.target.value })} /></div>`}
  <div class="fila-btn"><button class="btn" disabled=${ocupado || !f.nombre.trim()}>${f.id ? "Guardar cambios" : "Agregar"}</button>${f.id && html`<button type="button" class="btn sec" onClick=${onCancelar}>Cancelar</button>`}</div>
</form>`;

export function Equipo({ ctx }) {
  const { perfil, perfiles, personal, recargarBase, toast } = ctx;
  const [f, setF] = useState(VACIO);
  const [areaSel, setAreaSel] = useState("mantenimiento");
  const [ocupado, setOcupado] = useState(false);
  const esSup = perfil.rol === "supervisor";
  const esGer = perfil.rol === "gerente";

  async function correr(fn, ok) {
    setOcupado(true);
    try { const { error } = await fn(); if (error) throw error; await recargarBase(); if (ok) toast(ok); return true; }
    catch (e) { toast(errMsg(e), true); return false; }
    finally { setOcupado(false); }
  }
  async function guardar(e) {
    e.preventDefault();
    const bien = await correr(() => sb.rpc("guardar_personal", { p_id: f.id, p_nombre: f.nombre.trim(), p_area: esGer ? areaSel : perfil.area, p_tipo: f.tipo, p_empresa: f.tipo === "externo" ? f.empresa.trim() || null : null, p_puesto: f.puesto.trim() || null, p_zona: f.zona.trim() || null }), f.id ? "Cambios guardados" : "Persona agregada");
    if (bien) setF(VACIO);
  }
  const editar = (x) => { setF({ id: x.id, nombre: x.nombre, tipo: x.tipo, empresa: x.empresa || "", puesto: x.puesto || "", zona: x.zona_asignada || "" }); setAreaSel(x.area); setTimeout(() => document.getElementById("e-nom")?.focus(), 0); };
  const alternar = (x) => correr(() => sb.rpc("activar_personal", { p_id: x.id, p_activo: !x.activo }), x.activo ? "Dado de baja" : "Reactivado");

  const gerencia = perfiles.filter((p) => p.rol === "gerente" && p.activo);
  return html`<div class="pagina">
    <div class="head"><div><h1>Equipo</h1>
      <div class="sub">Cómo se organiza la atención. El personal no usa el sistema: cada supervisor lo asigna y le da seguimiento; el gerente puede dar de alta, editar o dar de baja a cualquiera.</div></div></div>

    <div class="org">
      <div class="org-nivel"><div class="org-nodo gerencia"><small>Gerencia de Mantenimiento</small><b>${gerencia.map((g) => g.nombre).join(", ") || "Gerente"}</b><span class="muted">Ve todas las áreas y administra el personal</span></div></div>
      <div class="org-linea" aria-hidden="true"></div>
      <div class="org-areas">${AREAS.map((a) => {
        const sup = perfiles.filter((p) => p.rol === "supervisor" && p.area === a && p.activo);
        const gente = personal.filter((x) => x.area === a);
        const mia = esSup && perfil.area === a;
        const edita = mia || esGer;
        const formAqui = esGer ? areaSel === a : mia;
        return html`<section class=${"card org-area" + (mia ? " mia" : "")}>
          <header><h3>${AREA[a]}</h3><span class="small muted">${a === "mantenimiento" ? "Técnicos por oficio, alberca y jardines" : a === "intendencia" ? "Limpieza, parte del área de Mantenimiento" : "Recibe órdenes reasignadas por otras áreas"}</span></header>
          <div class="org-sup"><span class="sup-et">Supervisor</span>${sup.length ? sup.map((s) => html`<span class="quien-at"><${Avatar} nombre=${s.nombre} cls="xs" />${s.nombre}</span>`) : html`<span class="sin">Sin supervisor</span>`}</div>
          <h4>Personal <span class="cuenta">${gente.filter((x) => x.activo).length}</span></h4>
          <ul class="personas">${gente.length ? gente.map((x) => html`<${Persona} key=${x.id} x=${x} edita=${edita} onEditar=${editar} onToggle=${alternar} ocupado=${ocupado} />`) : html`<li class="sin-datos">Sin personal registrado.</li>`}</ul>
          ${edita && formAqui && html`<${FormPersona} f=${f} setF=${setF} areaSel=${areaSel} setAreaSel=${setAreaSel} esGer=${esGer} ocupado=${ocupado} onGuardar=${guardar} onCancelar=${() => setF(VACIO)} />`}
          ${esGer && !formAqui && html`<button class="btn sec" onClick=${() => { setF(VACIO); setAreaSel(a); }}>Agregar persona a ${AREA[a]}</button>`}
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
