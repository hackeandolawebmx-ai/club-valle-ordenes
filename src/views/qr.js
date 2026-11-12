import { useMemo } from "preact/hooks";
import { qrDataUrl } from "../lib.js";
import { html, I, Logo } from "../ui.js";

export function QRs({ ctx }) {
  const base = location.origin + location.pathname;
  const items = useMemo(() => ctx.zonas.map((z) => ({ z, img: qrDataUrl(`${base}?zona=${z.qr_token}`) })), [ctx.zonas]);
  return html`<div class="pagina">
    <div class="head"><div><h1>QR por zona</h1><div class="sub">Pega cada código en su zona. Al escanearlo se abre el reporte con la zona ya elegida.</div></div>
      <button class="btn noprint" onClick=${() => window.print()}>${I.imprimir}Imprimir</button></div>
    <div class="qrs">${items.map(({ z, img }) => html`<div class="qrc">
      <${Logo} cls="oak" />
      <img src=${img} alt=${"Código QR de " + z.nombre} />
      <h3>${z.nombre}</h3>
      <div class="small muted">Escanea para reportar una falla</div>
    </div>`)}</div>
  </div>`;
}
