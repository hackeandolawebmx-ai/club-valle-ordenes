import { useMemo } from "preact/hooks";
import { ESTATUS, AREA, DEPTO, PRI_ORDEN, TZ, fDia, fHoy, saludo, dias, esAbierta, pideAtencion, plural } from "../lib.js";
import { html, I, Tarjeta, Esqueleto, BtnActualizar } from "../ui.js";

const DIA = 864e5;
const cuentaPor = (arr, fn) => { const m = {}; arr.forEach((o) => { const k = fn(o); if (k != null) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
function lunes(d) { const x = new Date(new Date(d).toLocaleString("en-US", { timeZone: TZ })); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); }

/* Barras horizontales con el valor a la vista. `tono` pinta toda la serie; `tonos` pinta cada fila. */
function Barras({ datos, tono, tonos, vacio }) {
  if (!datos.length || datos.every((d) => !d[1])) return html`<div class="sin-datos">${vacio || "Sin datos por ahora."}</div>`;
  const max = Math.max(1, ...datos.map((d) => d[1]));
  return html`<div class="barras">${datos.map(([t, n], i) => html`<div class="barra">
    <span class="t" title=${t}>${t}</span>
    <span class="pista"><i style=${`width:${(n / max) * 100}%;${tonos ? "background:var(--" + tonos[i] + ")" : tono ? "background:var(--" + tono + ")" : ""}`}></i></span>
    <b>${n}</b>
  </div>`)}</div>`;
}

function Semanas({ semanas }) {
  const max = Math.max(1, ...semanas.map((s) => Math.max(s.c, s.k)));
  return html`<div class="semanas" role="img" aria-label=${"Órdenes creadas y cerradas por semana: " + semanas.map((s) => `${fDia(s.t)}, ${s.c} creadas y ${s.k} cerradas`).join("; ")}>
    ${semanas.map((s, i) => html`<div class=${"w" + (i === semanas.length - 1 ? " hoy" : "")}>
      <div class="par">
        <span class="col"><em>${s.c || ""}</em><i class="c" style=${`--h:${s.c / max}`}></i></span>
        <span class="col"><em>${s.k || ""}</em><i class="k" style=${`--h:${s.k / max}`}></i></span>
      </div>
      <small>${fDia(s.t)}</small>
    </div>`)}
  </div>
  <div class="leyenda"><span><i class="c"></i>Creadas</span><span><i class="k"></i>Cerradas</span><span class="muted">Semana que inicia en la fecha indicada</span></div>`;
}

const Kpi = ({ n, t, href, icono, alerta }) => html`<a class=${"kpi" + (alerta && n ? " alerta" : "")} href=${href}>
  <span class="kpi-ico">${icono}</span><b>${n}</b><span>${t}</span>
</a>`;

export function Dashboard({ ctx }) {
  const { perfil, ordenes, cargado } = ctx;
  const ab = useMemo(() => ordenes.filter(esAbierta), [ordenes]);
  const k = {
    abiertas: ab.length,
    sinAsignar: ordenes.filter((o) => o.estatus === "nueva").length,
    porCerrar: ordenes.filter((o) => o.estatus === "resuelta").length,
    riesgo: ab.filter((o) => o.riesgo_socios).length,
    cerr30: ordenes.filter((o) => o.cerrada_at && Date.now() - new Date(o.cerrada_at) < 30 * DIA).length,
  };
  const semanas = useMemo(() => {
    const ini = lunes(Date.now());
    const w = [];
    for (let i = 7; i >= 0; i--) w.push({ t: ini - i * 7 * DIA, c: 0, k: 0 });
    const idx = (d) => { const l = lunes(d); return w.findIndex((x) => Math.abs(x.t - l) < 36e5 * 30); };
    ordenes.forEach((o) => { let i = idx(o.created_at); if (i >= 0) w[i].c++; if (o.cerrada_at) { i = idx(o.cerrada_at); if (i >= 0) w[i].k++; } });
    return w;
  }, [ordenes]);
  const edad = [["0 a 2 días", (o) => dias(o) <= 2], ["3 a 7 días", (o) => dias(o) > 2 && dias(o) <= 7], ["8 a 14 días", (o) => dias(o) > 7 && dias(o) <= 14], ["Más de 14 días", (o) => dias(o) > 14]].map(([t, fn]) => [t, ab.filter(fn).length]);
  const reinc = useMemo(() => {
    const m = {};
    ordenes.filter((o) => Date.now() - new Date(o.created_at) < 60 * DIA).forEach((o) => { const key = o.zona + " · " + o.categoria; m[key] = (m[key] || 0) + 1; });
    return Object.entries(m).filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [ordenes]);
  const atencion = ab.filter(pideAtencion).sort((a, b) => PRI_ORDEN[a.prioridad] - PRI_ORDEN[b.prioridad] || dias(b) - dias(a));
  const carga = cuentaPor(ab.filter((o) => o.asignado_a_nombre), (o) => o.asignado_a_nombre);
  const flujo = ["nueva", "asignada", "en_proceso", "en_espera", "resuelta"];
  const titulo = perfil.rol === "gerente" ? "Dashboard" : "Dashboard de " + AREA[perfil.area].toLowerCase();

  return html`<div class="pagina">
    <div class="head">
      <div><div class="sobre">${saludo()}, ${perfil.nombre.split(" ")[0]} · ${fHoy()}</div><h1>${titulo}</h1>
        <div class="sub">${cargado ? plural(ordenes.length, "orden registrada", "órdenes registradas") + " · datos al momento" : "Cargando…"}</div></div>
      <${BtnActualizar} onClick=${ctx.refrescar} />
    </div>
    ${!cargado ? html`<${Esqueleto} n=${3} alto=${120} />` : html`
    <div class="kpis">
      <${Kpi} n=${k.abiertas} t="Abiertas" href="#/ordenes/abiertas" icono=${I.inbox} />
      <${Kpi} n=${k.sinAsignar} t="Nuevas sin asignar" href="#/ordenes/nueva" icono=${I.persona} alerta />
      <${Kpi} n=${k.porCerrar} t="Resueltas por cerrar" href="#/ordenes/resuelta" icono=${I.check} />
      <${Kpi} n=${k.riesgo} t="Con riesgo para socios" href="#/ordenes/riesgo" icono=${I.alerta} alerta />
      <${Kpi} n=${k.cerr30} t="Cerradas en 30 días" href="#/ordenes/cerrada" icono=${I.reloj} />
    </div>
    <div class="tablas">
      <section class="card ancho atencion"><h3>Requieren atención <span class="cuenta">${atencion.length}</span></h3>
        <div class="small muted">Urgentes, con riesgo para socios o nuevas con más de un día sin asignar.</div>
        <div class="lista">${atencion.length ? atencion.slice(0, 5).map((o) => html`<${Tarjeta} key=${o.id} o=${o} />`) : html`<div class="sin-datos">Nada urgente por ahora.</div>`}</div></section>
      <div class="pila">
      <section class="card"><h3>Abiertas por estatus</h3><${Barras} datos=${flujo.map((e) => [ESTATUS[e], ordenes.filter((o) => o.estatus === e).length])} tonos=${["nueva", "asignada", "proceso", "espera", "resuelta"]} /></section>
      <section class="card"><h3>Antigüedad de las abiertas</h3><${Barras} datos=${edad} tono="proceso" /></section>
      </div>
      <section class="card ancho"><h3>Creadas y cerradas por semana</h3><${Semanas} semanas=${semanas} /></section>
      <section class="card"><h3>Abiertas por zona</h3><${Barras} datos=${cuentaPor(ab, (o) => o.zona).slice(0, 7)} /></section>
      <section class="card"><h3>Abiertas por categoría</h3><${Barras} datos=${cuentaPor(ab, (o) => o.categoria).slice(0, 7)} /></section>
      ${perfil.rol === "gerente" && html`<section class="card"><h3>Abiertas por área</h3><${Barras} datos=${cuentaPor(ab, (o) => AREA[o.area])} /></section>`}
      <section class="card"><h3>Abiertas por departamento solicitante</h3><${Barras} datos=${cuentaPor(ab, (o) => DEPTO[o.departamento_solicitante])} /></section>
      <section class="card"><h3>Carga por operativo</h3><${Barras} datos=${carga} vacio="Nadie tiene órdenes abiertas asignadas." /></section>
      <section class="card"><h3>Fallas reincidentes <span class="muted chico">60 días</span></h3><${Barras} datos=${reinc} tono="espera" vacio="Sin reincidencias." /></section>
    </div>`}
  </div>`;
}
