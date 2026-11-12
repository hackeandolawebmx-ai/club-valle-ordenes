// Piezas de interfaz compartidas: iconos y componentes chicos.
import { h } from "preact";
import htm from "htm";
import { ESTATUS, PRIORIDAD, hace, iniciales } from "./lib.js";

export const html = htm.bind(h);

/* ---------- iconos (un solo trazo, 1.75) ---------- */
const ico = (d, extra) => html`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
export const I = {
  lista: ico(html`<path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6" />`),
  grafica: ico(html`<path d="M4 20V11M10 20V5M16 20v-6M21 20H3" />`),
  qr: ico(html`<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" /><path d="M14 14h2.5v2.5H14zM20.5 14v.01M14 20.5h2.5M20.5 17.5v3" />`),
  mas: ico(html`<circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" />`),
  escudo: ico(html`<path d="M12 3l7 2.6v5.2c0 4.4-2.9 8-7 9.9-4.1-1.9-7-5.5-7-9.900V5.6z" /><path d="M12 8.800v5.400M9.300 11.500h5.400" />`),
  buscar: ico(html`<circle cx="11" cy="11" r="6.500" /><path d="M20 20l-4.200-4.200" />`),
  pin: ico(html`<path d="M12 21s-6.500-5.600-6.500-10.500a6.500 6.500 0 0113 0C18.500 15.400 12 21 12 21z" /><circle cx="12" cy="10.500" r="2.300" />`),
  etiqueta: ico(html`<path d="M3.500 12.200V4.500h7.700l9.300 9.300-7.700 7.700z" /><path d="M7.800 8.800h.01" stroke-width="2.600" />`),
  reloj: ico(html`<circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" />`),
  usuario: ico(html`<circle cx="12" cy="8.500" r="3.500" /><path d="M5 20c.8-3.400 3.600-5 7-5s6.200 1.600 7 5" />`),
  atras: ico(html`<path d="M19 12H5M11 6l-6 6 6 6" />`),
  refrescar: ico(html`<path d="M20 11a8 8 0 00-14.300-4.300L4 8.500M4 4v4.500h4.500M4 13a8 8 0 0014.300 4.300L20 15.500M20 20v-4.500h-4.500" />`),
  camara: ico(html`<path d="M4 8.500h3l1.600-2.500h6.800L17 8.500h3v10.500H4z" /><circle cx="12" cy="13.300" r="3.300" />`),
  check: ico(html`<path d="M5 12.500l4.500 4.500L19 7.500" />`),
  alerta: ico(html`<path d="M12 4l9 15.500H3z" /><path d="M12 10v4.500M12 17.300h.01" />`),
  x: ico(html`<path d="M6 6l12 12M18 6L6 18" />`),
  tablero: ico(html`<rect x="3.500" y="4" width="5" height="16" rx="1.200" /><rect x="10" y="4" width="5" height="10.500" rx="1.200" /><rect x="16.500" y="4" width="4" height="13" rx="1.200" />`),
  filas: ico(html`<rect x="3.500" y="4.500" width="17" height="6" rx="1.500" /><rect x="3.500" y="13.500" width="17" height="6" rx="1.500" />`),
  salir: ico(html`<path d="M14 4.500h4.500v15H14M10 8l-4 4 4 4M6 12h9" />`),
  imprimir: ico(html`<path d="M7 9V4h10v5M7 17H4.500V9.500h15V17H17M7 14h10v6H7z" />`),
  nota: ico(html`<path d="M4.500 5h15v11h-8L7 19.500V16H4.500z" />`),
  ojo: ico(html`<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="2.800" />`),
  mas2: ico(html`<path d="M12 5v14M5 12h14" />`),
  flecha: ico(html`<path d="M9 6l6 6-6 6" />`),
  inbox: ico(html`<path d="M3.500 13.500l2.700-8h11.600l2.700 8v5.500h-17z" /><path d="M3.500 13.500h5l1 2.500h5l1-2.500h5" />`),
  persona: ico(html`<circle cx="9" cy="8.500" r="3" /><path d="M3.500 19.500c.6-3 2.800-4.500 5.500-4.500s4.900 1.500 5.500 4.500M17 8v6M14 11h6" />`),
};

/* ---------- marca ---------- */
/* El logo es una imagen; se usa como máscara para poder pintarlo del color que pida cada fondo. */
export const Logo = ({ solo, cls }) => html`<span class=${"logo" + (solo ? " solo" : "") + (cls ? " " + cls : "")} role="img" aria-label="Club Valle"></span>`;

/* ---------- componentes chicos ---------- */
export const Estatus = ({ e }) => html`<span class=${"badge b-" + e}>${ESTATUS[e]}</span>`;
export const Pri = ({ p }) => html`<span class=${"pri " + p}><i aria-hidden="true"></i>${PRIORIDAD[p]}</span>`;
export const Riesgo = () => html`<span class="riesgo">${I.alerta}Riesgo socios</span>`;
export const Avatar = ({ nombre, cls }) => html`<span class=${"av" + (cls ? " " + cls : "")} aria-hidden="true">${iniciales(nombre)}</span>`;

export function Tarjeta({ o, mini }) {
  return html`<a class=${"orden s-" + o.estatus + (mini ? " mini" : "")} href=${"#/orden/" + o.id}>
    <div class="orden-top">
      <span class="folio">${o.folio}</span>
      <${Pri} p=${o.prioridad} />
      ${o.riesgo_socios && html`<${Riesgo} />`}
      ${!mini && html`<span class="orden-est"><${Estatus} e=${o.estatus} /></span>`}
    </div>
    <div class="desc">${o.descripcion}</div>
    <div class="meta">
      <span>${I.pin}${o.zona}${!mini && o.ubicacion_detalle ? " · " + o.ubicacion_detalle : ""}</span>
      ${!mini && html`<span>${I.etiqueta}${o.categoria}</span>`}
      <span>${I.reloj}${hace(o.created_at)}</span>
      ${o.asignado_a_nombre ? html`<span class="quien-at"><${Avatar} nombre=${o.asignado_a_nombre} cls="xs" />${o.asignado_a_nombre}</span>` : !mini && o.estatus === "nueva" ? html`<span class="sin">Sin asignar</span>` : null}
    </div>
  </a>`;
}

export const Vacio = ({ icono, titulo, children }) => html`<div class="vacio">
  <span class="vacio-ico">${icono || I.inbox}</span>
  <b>${titulo}</b>
  ${children && html`<div>${children}</div>`}
</div>`;

export const Esqueleto = ({ n = 4, alto = 92 }) => html`<div class="lista" aria-busy="true" aria-label="Cargando">
  ${Array.from({ length: n }, () => html`<div class="sk" style=${`height:${alto}px`}></div>`)}
</div>`;

export const Cargando = ({ texto }) => html`<div class="cargando" role="status"><span class="spin"></span>${texto || "Cargando…"}</div>`;

export function BtnActualizar({ onClick }) {
  return html`<button class="btn sec chico" onClick=${async (e) => {
    const b = e.currentTarget; b.classList.add("girando");
    try { await onClick(); } finally { setTimeout(() => b.classList.remove("girando"), 500); }
  }}>${I.refrescar}Actualizar</button>`;
}
