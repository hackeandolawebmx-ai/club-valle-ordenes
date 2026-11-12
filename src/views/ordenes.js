import { useState, useMemo } from "preact/hooks";
import { AREA, ESTATUS, PRI_ORDEN, plural } from "../lib.js";
import { html, I, Tarjeta, Vacio, Esqueleto, BtnActualizar } from "../ui.js";

const FILTROS = [
  ["abiertas", "Abiertas", (o) => o.estatus !== "cerrada"],
  ["nueva", "Nuevas", (o) => o.estatus === "nueva"],
  ["curso", "En curso", (o) => ["asignada", "en_proceso", "en_espera"].includes(o.estatus)],
  ["resuelta", "Por cerrar", (o) => o.estatus === "resuelta"],
  ["riesgo", "Con riesgo", (o) => o.riesgo_socios && o.estatus !== "cerrada"],
  ["cerrada", "Cerradas", (o) => o.estatus === "cerrada"],
  ["todas", "Todas", () => true],
];
const COLUMNAS = ["nueva", "asignada", "en_proceso", "en_espera", "resuelta"];
const porPrioridad = (a, b) => (PRI_ORDEN[a.prioridad] - PRI_ORDEN[b.prioridad]) || (new Date(a.created_at) - new Date(b.created_at));
const leeVista = () => { try { return localStorage.getItem("cv_vista") === "tablero" ? "tablero" : "lista"; } catch (_) { return "lista"; } };

export function Ordenes({ ctx, filtro }) {
  const { perfil, ordenes, cargado } = ctx;
  const [f, setF] = useState(FILTROS.some((x) => x[0] === filtro) ? filtro : "abiertas");
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [vista, setVistaS] = useState(leeVista);
  const gestiona = perfil.rol === "gerente" || perfil.rol === "supervisor";
  const setVista = (v) => { setVistaS(v); try { localStorage.setItem("cv_vista", v); } catch (_) { /* sin almacenamiento */ } };
  const titulo = perfil.rol === "operativo" ? "Mis órdenes" : perfil.rol === "solicitante" ? "Mis reportes" : perfil.rol === "supervisor" ? "Bandeja de " + AREA[perfil.area].toLowerCase() : "Todas las órdenes";

  const base = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ordenes
      .filter((o) => !area || o.area === area)
      .filter((o) => !t || [o.folio, o.descripcion, o.zona, o.ubicacion_detalle, o.categoria, o.asignado_a_nombre, o.reportado_por_nombre].join(" ").toLowerCase().includes(t));
  }, [ordenes, q, area]);
  const recientes = f === "cerrada" || f === "todas";
  const lista = useMemo(() => {
    const fn = FILTROS.find((x) => x[0] === f)[2];
    return base.filter(fn).sort((a, b) => (PRI_ORDEN[a.prioridad] - PRI_ORDEN[b.prioridad]) || (new Date(a.created_at) - new Date(b.created_at)) * (recientes ? -1 : 1));
  }, [base, f]);
  const tablero = gestiona && vista === "tablero";
  const hayFiltro = q.trim() || area;

  return html`<div class="pagina">
    <div class="head">
      <div><h1>${titulo}</h1><div class="sub">${cargado ? (tablero ? plural(base.filter((o) => o.estatus !== "cerrada").length, "orden abierta", "órdenes abiertas") : plural(lista.length, "orden", "órdenes")) : "Cargando…"}</div></div>
      <div class="row">
        ${gestiona && html`<div class="vistas" role="group" aria-label="Vista">
          <button aria-pressed=${!tablero} class=${!tablero ? "on" : ""} onClick=${() => setVista("lista")}>${I.filas}<span>Lista</span></button>
          <button aria-pressed=${tablero} class=${tablero ? "on" : ""} onClick=${() => setVista("tablero")}>${I.tablero}<span>Tablero</span></button>
        </div>`}
        <${BtnActualizar} onClick=${ctx.refrescar} />
      </div>
    </div>
    <div class="barra-filtros">
      <label class="buscador">${I.buscar}<input type="search" aria-label="Buscar órdenes" placeholder="Buscar por folio, zona, texto o persona" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
      ${perfil.rol === "gerente" && html`<select class="auto" aria-label="Área" value=${area} onChange=${(e) => setArea(e.target.value)}><option value="">Ambas áreas</option><option value="mantenimiento">Mantenimiento</option><option value="intendencia">Intendencia</option></select>`}
    </div>
    ${!tablero && html`<div class="chips" role="group" aria-label="Filtrar por estado">${FILTROS.map(([k, t, fn]) => html`<button aria-pressed=${f === k} class=${"chip" + (f === k ? " on" : "")} onClick=${() => setF(k)}>${t}<span class="n">${base.filter(fn).length}</span></button>`)}</div>`}
    ${!cargado ? html`<${Esqueleto} n=${5} />`
      : tablero ? html`<div class="tablero">${COLUMNAS.map((e) => {
          const col = base.filter((o) => o.estatus === e).sort(porPrioridad);
          return html`<section class=${"columna c-" + e}>
            <header><i aria-hidden="true"></i><b>${ESTATUS[e]}</b><span class="n">${col.length}</span></header>
            <div class="columna-lista">${col.length ? col.map((o) => html`<${Tarjeta} key=${o.id} o=${o} mini />`) : html`<div class="columna-vacia">Nada aquí</div>`}</div>
          </section>`;
        })}</div>`
      : html`<div class="lista">${lista.length ? lista.map((o) => html`<${Tarjeta} key=${o.id} o=${o} />`)
          : html`<${Vacio} titulo=${hayFiltro ? "Sin resultados" : "No hay órdenes en este filtro"}>
              ${hayFiltro ? html`Prueba con otro texto o <button class="enlace" onClick=${() => { setQ(""); setArea(""); }}>quita la búsqueda</button>.`
                : perfil.rol !== "gerente" && f === "abiertas" ? html`Cuando veas algo que falla, <a href="#/reportar">repórtalo aquí</a>.` : "Cambia el filtro para ver otras órdenes."}
            <//>`}</div>`}
  </div>`;
}
