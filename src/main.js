// Armazón de la app: sesión, datos compartidos, rutas por hash y navegación.
import { render } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { sb, ROL, AREA, DEPTO, go, errMsg } from "./lib.js";
import { html, I, Logo, Avatar, Cargando, Vacio } from "./ui.js";
import { Login } from "./views/login.js";
import { Reportar } from "./views/reportar.js";
import { Ordenes } from "./views/ordenes.js";
import { Detalle } from "./views/detalle.js";
import { Dashboard } from "./views/dashboard.js";
import { QRs } from "./views/qr.js";
import { Cuenta } from "./views/cuenta.js";

function tabsPara(p) {
  const mas = { id: "mas", t: "Más", i: I.mas };
  const rep = { id: "reportar", t: "Reportar", i: I.escudo, centro: true };
  if (p.rol === "gerente") return [{ id: "dashboard", t: "Dashboard", i: I.grafica }, { id: "ordenes", t: "Órdenes", i: I.lista }, { id: "qr", t: "QR", i: I.qr }, mas];
  if (p.rol === "supervisor") return [{ id: "ordenes", t: "Bandeja", i: I.lista }, { id: "dashboard", t: "Dashboard", i: I.grafica }, rep, { id: "qr", t: "QR", i: I.qr }, mas];
  if (p.rol === "operativo") return [{ id: "ordenes", t: "Mis órdenes", i: I.lista }, rep, mas];
  return [{ id: "ordenes", t: "Mis reportes", i: I.lista }, rep, mas];
}
const TITULOS = { dashboard: "Dashboard", ordenes: "Órdenes", orden: "Orden", reportar: "Reportar", qr: "QR por zona", mas: "Mi cuenta" };

function useHash() {
  const [hs, setHs] = useState(location.hash.slice(1) || "/");
  useEffect(() => { const f = () => setHs(location.hash.slice(1) || "/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return hs;
}

const Aviso = ({ aviso }) => html`<div class="toast-zona" role="status" aria-live="polite">${aviso && html`<div class=${"toast" + (aviso.err ? " err" : "")}>${aviso.err ? I.alerta : I.check}<span>${aviso.m}</span></div>`}</div>`;

function App() {
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [base, setBase] = useState({ zonas: [], categorias: [], perfiles: [] });
  const [ordenes, setOrdenes] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(null);
  const [aviso, setAviso] = useState(null);
  const reloj = useRef();
  const hs = useHash();
  const uid = sesion && sesion.user.id;

  const toast = useCallback((m, err) => {
    clearTimeout(reloj.current);
    setAviso({ m, err });
    reloj.current = setTimeout(() => setAviso(null), err ? 6000 : 3800);
  }, []);

  useEffect(() => {
    const zq = new URLSearchParams(location.search).get("zona");
    if (zq) { sessionStorage.setItem("cv_zona", zq); history.replaceState(null, "", location.pathname); location.hash = "/reportar"; }
    sb.auth.getSession().then(({ data }) => setSesion(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSesion(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refrescar = useCallback(async () => {
    const { data, error } = await sb.from("v_ordenes").select("*").order("created_at", { ascending: false });
    if (error) { toast("No pudimos actualizar las órdenes. Revisa tu conexión.", true); return; }
    setOrdenes(data || []);
    setCargado(true);
  }, []);

  const cargarBase = useCallback(async () => {
    setFallo(null);
    const [p, z, c, ps] = await Promise.all([
      sb.from("perfiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("zonas").select("*").eq("activa", true).order("nombre"),
      sb.from("categorias").select("*").order("nombre"),
      sb.from("perfiles").select("*"),
    ]);
    const error = p.error || z.error || c.error || ps.error;
    if (error) return setFallo("No pudimos cargar tus datos: " + errMsg(error));
    if (!p.data) return setFallo("Tu cuenta no tiene un perfil activo en el club. Pide a un administrador que la dé de alta.");
    setBase({ zonas: z.data || [], categorias: c.data || [], perfiles: ps.data || [] });
    setPerfil(p.data);
    if (location.hash === "" || location.hash === "#/" || location.hash === "#") {
      go(sessionStorage.getItem("cv_zona") ? "/reportar" : p.data.rol === "gerente" ? "/dashboard" : "/ordenes");
    }
    await refrescar();
  }, [uid]);

  useEffect(() => {
    if (!uid) { setPerfil(null); setOrdenes([]); setCargado(false); setFallo(null); return; }
    cargarBase();
  }, [uid]);

  useEffect(() => {
    if (!perfil) return;
    const t = setInterval(() => { if (!document.hidden) refrescar(); }, 30000);
    const alVolver = () => { if (!document.hidden) refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [perfil]);

  const [, ruta, arg] = hs.split("/");
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = (sesion && TITULOS[ruta] ? TITULOS[ruta] + " · " : "") + "Club Valle · Órdenes de servicio";
  }, [hs, !!sesion]);

  if (sesion === undefined) return html`<${Cargando} />`;
  if (!sesion) return html`<${Login} onError=${(m) => toast(m, true)} /><${Aviso} aviso=${aviso} />`;
  if (fallo) return html`<div class="pantalla-centro"><${Vacio} icono=${I.alerta} titulo="Algo no salió bien">${fallo}
    <div class="row centro"><button class="btn" onClick=${cargarBase}>Reintentar</button><button class="btn sec" onClick=${() => sb.auth.signOut()}>Cerrar sesión</button></div><//></div>`;
  if (!perfil) return html`<${Cargando} texto="Cargando tu perfil…" />`;

  const ctx = { perfil, ...base, ordenes, cargado, refrescar, toast };
  const tabs = tabsPara(perfil);
  const gestiona = ["gerente", "supervisor"].includes(perfil.rol);
  let vista;
  if (ruta === "orden") vista = html`<${Detalle} key=${arg} ctx=${ctx} id=${Number(arg)} />`;
  else if (ruta === "reportar" && perfil.rol !== "gerente") vista = html`<${Reportar} ctx=${ctx} />`;
  else if (ruta === "dashboard" && gestiona) vista = html`<${Dashboard} ctx=${ctx} />`;
  else if (ruta === "qr" && gestiona) vista = html`<${QRs} ctx=${ctx} />`;
  else if (ruta === "mas") vista = html`<${Cuenta} ctx=${ctx} />`;
  else vista = html`<${Ordenes} key=${arg || ""} ctx=${ctx} filtro=${arg} />`;
  const activo = ruta === "orden" ? "ordenes" : tabs.some((t) => t.id === ruta) ? ruta : "ordenes";
  const puesto = ROL[perfil.rol] + (perfil.area ? " · " + AREA[perfil.area] : "") + (perfil.departamento ? " · " + DEPTO[perfil.departamento] : "");
  const nuevas = perfil.rol === "supervisor" ? ordenes.filter((o) => o.estatus === "nueva" && o.area === perfil.area).length : 0;

  return html`<div class="shell">
    <button class="saltar" onClick=${() => document.getElementById("contenido").focus()}>Saltar al contenido</button>
    <header class="top">
      <a href=${"#/" + tabs[0].id} aria-label="Inicio"><${Logo} /></a>
      <a class="top-quien" href="#/mas" aria-label="Mi cuenta"><span><b>${perfil.nombre}</b><small>${puesto}</small></span><${Avatar} nombre=${perfil.nombre} /></a>
    </header>
    <aside class="side">
      <a class="side-marca" href=${"#/" + tabs[0].id} aria-label="Inicio"><${Logo} /><small>Órdenes de servicio</small></a>
      <nav class="nav" aria-label="Principal">${tabs.map((t) => html`<a href=${"#/" + t.id} aria-current=${activo === t.id ? "page" : null} class=${(t.centro ? "centro " : "") + (activo === t.id ? "on" : "")}>
        ${t.centro ? html`<span class="esc">${t.i}</span>` : t.i}<span>${t.t}</span>
        ${t.id === "ordenes" && nuevas > 0 && html`<em class="globo" aria-label=${nuevas + " nuevas sin asignar"}>${nuevas}</em>`}
      </a>`)}</nav>
      <a class="side-quien" href="#/mas"><${Avatar} nombre=${perfil.nombre} /><span><b>${perfil.nombre}</b><small>${puesto}</small></span></a>
    </aside>
    <main class="main" id="contenido" tabindex="-1">${vista}</main>
    <${Aviso} aviso=${aviso} />
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
