import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { sb, ESTATUS, FLUJO, AREA, DEPTO, ACCION, acciones, comprimir, subirFotos, fFecha, fDia, hace, errMsg } from "../lib.js";
import { html, I, Estatus, Pri, Riesgo, Avatar, Vacio } from "../ui.js";

/* Avance de la orden: nueva → asignada → en proceso → resuelta → cerrada. "En espera" es una pausa del paso en proceso. */
function Avance({ o }) {
  const enEspera = o.estatus === "en_espera";
  const actual = FLUJO.indexOf(enEspera ? "en_proceso" : o.estatus);
  const fecha = { nueva: o.created_at, asignada: o.asignada_at, resuelta: o.resuelta_at, cerrada: o.cerrada_at };
  return html`<ol class="avance" aria-label="Avance de la orden">${FLUJO.map((e, i) => {
    const estado = i < actual ? "hecho" : i === actual ? "actual" : "";
    const pausa = enEspera && e === "en_proceso";
    return html`<li class=${estado + (pausa ? " pausa" : "")} aria-current=${i === actual ? "step" : null}>
      <i aria-hidden="true">${i < actual || (i === actual && e === "cerrada") ? I.check : null}</i>
      <b>${pausa ? "En espera" : ESTATUS[e]}</b>
      <small>${fecha[e] && i <= actual ? fDia(fecha[e]) : ""}</small>
    </li>`;
  })}</ol>`;
}

function Evento({ e, nombre }) {
  const titulo = e.tipo === "creada" ? "Reporte creado"
    : e.tipo === "asignada" ? html`Asignada a <b>${nombre(e.asignado_a)}</b>`
    : e.tipo === "comentario" ? "Comentario"
    : html`${ESTATUS[e.estatus_anterior] || ""} → <b>${ESTATUS[e.estatus_nuevo]}</b>`;
  const tono = e.tipo === "cambio_estatus" ? "t-" + e.estatus_nuevo : e.tipo === "comentario" ? "t-comentario" : e.tipo === "asignada" ? "t-asignada" : "t-nueva";
  return html`<li class=${tono}>
    <div class="ev-titulo">${titulo}</div>
    ${e.comentario && html`<div class="ev-nota">${e.comentario}</div>`}
    <div class="small muted">${nombre(e.autor_id)} · ${fFecha(e.created_at)}</div>
  </li>`;
}

export function Detalle({ ctx, id }) {
  const { perfil, perfiles, refrescar, toast } = ctx;
  const [d, setD] = useState(null); // null = cargando, false = sin acceso, { o, ev, fotos }
  const [com, setCom] = useState("");
  const [op, setOp] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [visor, setVisor] = useState(null);
  const inp = useRef();

  const cargar = useCallback(async () => {
    const [{ data: o }, { data: ev }, { data: f }] = await Promise.all([
      sb.from("v_ordenes").select("*").eq("id", id).maybeSingle(),
      sb.from("orden_eventos").select("*").eq("orden_id", id).order("created_at"),
      sb.from("orden_fotos").select("*").eq("orden_id", id).order("created_at"),
    ]);
    if (!o) return setD(false);
    let fotos = [];
    if (f && f.length) {
      const { data: urls } = await sb.storage.from("orden-fotos").createSignedUrls(f.map((x) => x.storage_path), 3600);
      fotos = f.map((x, i) => ({ ...x, url: urls && urls[i] && urls[i].signedUrl })).filter((x) => x.url);
    }
    setD({ o, ev: ev || [], fotos });
  }, [id]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  useEffect(() => {
    if (!visor) return;
    const f = (e) => { if (e.key === "Escape") setVisor(null); };
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [visor]);

  const volver = html`<a href="#/ordenes" class="volver">${I.atras}Volver a la lista</a>`;
  if (d === null) return html`<div class="pagina">${volver}<div class="cols"><div class="sk a-res" style="height:300px"></div><div class="sk a-acc" style="height:220px"></div><div class="sk a-his" style="height:260px"></div></div></div>`;
  if (d === false) return html`<div class="pagina">${volver}<${Vacio} titulo="No encontramos esta orden">Puede que no exista o que no tengas acceso a ella.<//></div>`;

  const { o, ev, fotos } = d;
  const a = acciones(o, perfil);
  const nombre = (uid) => (perfiles.find((p) => p.id === uid) || {}).nombre || "—";
  const operativos = perfiles.filter((p) => p.rol === "operativo" && p.area === o.area && p.activo);
  async function correr(fn, ok) {
    setOcupado(true);
    try { const { error } = await fn(); if (error) throw error; setCom(""); setOp(""); await cargar(); await refrescar(); if (ok) toast(ok); }
    catch (e) { toast(errMsg(e), true); }
    setOcupado(false);
  }
  const estatus = (s, ok) => correr(() => sb.rpc("cambiar_estatus", { p_orden_id: o.id, p_estatus: s, p_comentario: com.trim() || null }), ok);
  const asignar = () => correr(() => sb.rpc("asignar_orden", { p_orden_id: o.id, p_operativo_id: op, p_comentario: com.trim() || null }), "Orden asignada");
  const comentar = () => correr(() => sb.rpc("comentar_orden", { p_orden_id: o.id, p_comentario: com.trim() }), "Comentario guardado");
  async function foto(e) {
    const archivos = [];
    for (const f of Array.from(e.target.files || []).slice(0, 3)) archivos.push(await comprimir(f));
    e.target.value = "";
    if (archivos.length) correr(async () => { try { await subirFotos(o.id, archivos, perfil.id); return {}; } catch (x) { return { error: x }; } }, "Foto agregada");
  }
  const hayAcciones = a.asignar || a.estatus.length > 0 || a.cerrar || a.comentar;
  const ayuda = a.cerrar ? "El operativo la marcó resuelta. Revisa y ciérrala, o reábrela si falta algo."
    : a.asignar && o.estatus === "nueva" ? "Elige quién la atiende para que empiece a moverse."
    : a.estatus.length ? "Actualiza el estatus conforme avances; todo queda en el historial."
    : "Puedes dejar un comentario o agregar una foto.";

  return html`<div class="pagina">
    ${volver}
    <div class="cols">
      <article class="card resumen a-res">
        <div class="resumen-top">
          <span class="folio grande">${o.folio}</span>
          <${Pri} p=${o.prioridad} />
          ${o.riesgo_socios && html`<${Riesgo} />`}
          <span class="orden-est"><${Estatus} e=${o.estatus} /></span>
        </div>
        <p class="resumen-desc">${o.descripcion}</p>
        <${Avance} o=${o} />
        <dl class="kv">
          <div><dt>${I.pin}Zona</dt><dd>${o.zona}${o.ubicacion_detalle ? " · " + o.ubicacion_detalle : ""}</dd></div>
          <div><dt>${I.etiqueta}Tipo</dt><dd>${o.categoria} · ${AREA[o.area]}</dd></div>
          <div><dt>${I.usuario}Reporta</dt><dd>${o.reportado_por_nombre}${DEPTO[o.departamento_solicitante] ? " · " + DEPTO[o.departamento_solicitante] : ""}</dd></div>
          <div><dt>${I.persona}Atiende</dt><dd>${o.asignado_a_nombre ? html`<span class="quien-at"><${Avatar} nombre=${o.asignado_a_nombre} cls="xs" />${o.asignado_a_nombre}</span>` : html`<span class="sin">Sin asignar</span>`}</dd></div>
          <div><dt>${I.reloj}Creada</dt><dd>${fFecha(o.created_at)} <span class="muted">(${hace(o.created_at)})</span></dd></div>
        </dl>
      </article>

      <aside class="stack a-acc">
        ${hayAcciones && html`<div class="card verde stack">
          <div><h3>Acciones</h3><div class="small muted">${ayuda}</div></div>
          ${a.asignar && html`<div class="field"><label for="d-op">${o.asignado_a ? "Reasignar a" : "Asignar a"}</label>
            <select id="d-op" value=${op} onChange=${(e) => setOp(e.target.value)}><option value="">Elige operativo…</option>${operativos.map((p) => html`<option value=${p.id}>${p.nombre}</option>`)}</select></div>`}
          <div class="field"><label for="d-com">Comentario <span class="opc">opcional</span></label><textarea id="d-com" class="corto" value=${com} onInput=${(e) => setCom(e.target.value)} placeholder="Queda en el historial"></textarea></div>
          <div class="acciones">
            ${a.asignar && html`<button class="btn" disabled=${ocupado || !op} onClick=${asignar}>${o.asignado_a ? "Reasignar" : "Asignar"}</button>`}
            ${a.estatus.map((s) => html`<button class=${s === "resuelta" ? "btn" : "btn sec"} disabled=${ocupado} onClick=${() => estatus(s, ESTATUS[s])}>${ACCION[s]}</button>`)}
            ${a.cerrar && html`<button class="btn" disabled=${ocupado} onClick=${() => estatus("cerrada", "Orden cerrada")}>Cerrar orden</button>`}
            ${a.reabrir && html`<button class="btn peligro" disabled=${ocupado} onClick=${() => estatus("en_proceso", "Orden reabierta")}>Reabrir</button>`}
            ${a.comentar && html`<button class="btn sec" disabled=${ocupado || !com.trim()} onClick=${comentar}>Solo comentar</button>`}
          </div>
          ${a.foto && html`<div><input ref=${inp} type="file" accept="image/*" multiple class="sr" tabindex="-1" onChange=${foto} /><button class="btn texto" disabled=${ocupado} onClick=${() => inp.current.click()}>${I.camara}Agregar foto de evidencia</button></div>`}
        </div>`}
        ${perfil.rol === "gerente" && html`<div class="nota">${I.ojo}<span>Como gerente tienes vista de solo lectura. Las acciones las hacen supervisores y operativos.</span></div>`}
      </aside>

      <div class="stack a-his">
        ${fotos.length > 0 && html`<section class="card"><h3>Fotos <span class="cuenta">${fotos.length}</span></h3>
          <div class="fotos">${fotos.map((f, i) => html`<button type="button" class="foto" aria-label=${"Ver foto " + (i + 1)} onClick=${() => setVisor(f.url)}><img src=${f.url} alt=${"Foto " + (i + 1) + " de la orden " + o.folio} loading="lazy" /></button>`)}</div></section>`}
        <section class="card"><h3>Historial <span class="cuenta">${ev.length}</span></h3>
          <ul class="timeline">${ev.map((e) => html`<${Evento} key=${e.id} e=${e} nombre=${nombre} />`)}</ul></section>
      </div>
    </div>
    ${visor && html`<div class="visor" role="dialog" aria-label="Foto ampliada" onClick=${() => setVisor(null)}><button class="visor-x" aria-label="Cerrar">${I.x}</button><img src=${visor} alt="Foto ampliada de la orden" /></div>`}
  </div>`;
}
