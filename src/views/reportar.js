import { useState, useRef } from "preact/hooks";
import { sb, AREA, PRIORIDAD, PRI_AYUDA, comprimir, subirFotos, errMsg, go } from "../lib.js";
import { html, I } from "../ui.js";

const MAX_FOTOS = 3;

export function Reportar({ ctx }) {
  const { perfil, zonas, categorias, refrescar, toast } = ctx;
  const qrToken = sessionStorage.getItem("cv_zona");
  const zonaQr = qrToken ? zonas.find((z) => z.qr_token === qrToken) : null;
  const [zona, setZona] = useState(zonaQr ? String(zonaQr.id) : "");
  const [ubic, setUbic] = useState("");
  const [cat, setCat] = useState("");
  const [desc, setDesc] = useState("");
  const [pri, setPri] = useState("media");
  const [riesgo, setRiesgo] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const inp = useRef();
  const catSel = categorias.find((c) => String(c.id) === cat);

  async function agregar(ev) {
    const nuevos = [];
    for (const f of Array.from(ev.target.files || [])) {
      if (fotos.length + nuevos.length >= MAX_FOTOS) break;
      const blob = await comprimir(f);
      nuevos.push({ blob, url: URL.createObjectURL(blob) });
    }
    setFotos([...fotos, ...nuevos]);
    ev.target.value = "";
  }
  async function enviar(ev) {
    ev.preventDefault();
    setEnviando(true);
    try {
      const { data, error } = await sb.rpc("crear_orden", {
        p_zona_id: Number(zona), p_categoria_id: Number(cat), p_descripcion: desc.trim(),
        p_prioridad: pri, p_riesgo_socios: riesgo, p_ubicacion_detalle: ubic.trim() || null,
      });
      if (error) throw error;
      let avisoFoto = "";
      if (fotos.length) {
        try { await subirFotos(data.id, fotos.map((f) => f.blob), perfil.id); }
        catch (_) { avisoFoto = " (no se pudieron subir las fotos; agrégalas desde la orden)"; }
      }
      sessionStorage.removeItem("cv_zona");
      toast(`Reporte ${data.folio} enviado a ${AREA[data.area]}${avisoFoto}`);
      await refrescar();
      go("/orden/" + data.id);
    } catch (e) { toast(errMsg(e), true); }
    setEnviando(false);
  }
  const mant = categorias.filter((c) => c.area === "mantenimiento");
  const inte = categorias.filter((c) => c.area === "intendencia");
  const listo = zona && cat && desc.trim().length >= 5;

  return html`<div class="pagina angosta">
    <div class="head"><div><h1>Reportar una falla</h1>
      <div class="sub">${zonaQr ? html`Llegaste desde el QR de <b>${zonaQr.nombre}</b>.` : "Cuéntanos qué pasó y dónde. Toma menos de un minuto."}</div></div></div>
    <form class="card formulario" onSubmit=${enviar}>
      <fieldset>
        <legend><span class="paso">1</span>¿Dónde está la falla?</legend>
        <div class="field"><label for="r-zona">Zona</label>
          <select id="r-zona" value=${zona} onChange=${(e) => setZona(e.target.value)} required>
            <option value="">Elige la zona…</option>${zonas.map((z) => html`<option value=${z.id}>${z.nombre}</option>`)}
          </select></div>
        <div class="field"><label for="r-ubic">Ubicación específica <span class="opc">opcional</span></label>
          <input id="r-ubic" type="text" value=${ubic} onInput=${(e) => setUbic(e.target.value)} placeholder="Ej. regadera 4, cancha 3, mesa del fondo" /></div>
      </fieldset>
      <fieldset>
        <legend><span class="paso">2</span>¿Qué pasa?</legend>
        <div class="field"><label for="r-cat">Tipo de falla</label>
          <select id="r-cat" value=${cat} onChange=${(e) => setCat(e.target.value)} required>
            <option value="">Elige el tipo…</option>
            <optgroup label="Mantenimiento">${mant.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}</optgroup>
            <optgroup label="Intendencia">${inte.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}</optgroup>
          </select>
          ${catSel && html`<div class="destino">${I.flecha}Se enviará a <b>${AREA[catSel.area]}</b></div>`}</div>
        <div class="field"><label for="r-desc">Descripción</label>
          <textarea id="r-desc" value=${desc} onInput=${(e) => setDesc(e.target.value)} placeholder="¿Qué se ve mal o qué falla?" minlength="5" required></textarea></div>
      </fieldset>
      <fieldset>
        <legend><span class="paso">3</span>¿Qué tan urgente es?</legend>
        <div class="field"><span class="lbl" id="r-pri">Prioridad</span>
          <div class="seg" role="group" aria-labelledby="r-pri">${Object.entries(PRIORIDAD).map(([k, v]) => html`<button type="button" aria-pressed=${pri === k} class=${(pri === k ? "on " : "") + "p-" + k} onClick=${() => setPri(k)}>${v}</button>`)}</div>
          <div class="small muted">${PRI_AYUDA[pri]}.</div></div>
        <label class=${"check" + (riesgo ? " on" : "")}><input type="checkbox" checked=${riesgo} onChange=${(e) => setRiesgo(e.target.checked)} />
          <span><b>Riesgo para socios</b><span class="small muted">Marca si puede lastimar o afectar a socios, familias o invitados.</span></span></label>
      </fieldset>
      <fieldset>
        <legend><span class="paso">4</span>Fotos <span class="opc">hasta ${MAX_FOTOS}, opcional</span></legend>
        <div class="prev">
          ${fotos.map((f, i) => html`<div><img src=${f.url} alt=${"Foto " + (i + 1) + " del reporte"} /><button type="button" aria-label="Quitar foto" onClick=${() => setFotos(fotos.filter((_, j) => j !== i))}>${I.x}</button></div>`)}
          ${fotos.length < MAX_FOTOS && html`<button type="button" class="foto-mas" onClick=${() => inp.current.click()}>${I.camara}<span>Tomar o elegir foto</span></button>`}
        </div>
        <input ref=${inp} type="file" accept="image/*" multiple onChange=${agregar} class="sr" tabindex="-1" />
      </fieldset>
      <div class="form-pie">
        <button class="btn grande" disabled=${enviando || !listo}>${enviando ? "Enviando…" : "Enviar reporte"}</button>
        ${!listo && html`<div class="small muted">Elige zona y tipo de falla, y describe qué pasa.</div>`}
      </div>
    </form></div>`;
}
