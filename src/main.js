import { h, render } from "preact";
import { useState, useEffect, useMemo, useRef, useCallback } from "preact/hooks";
import htm from "htm";
import { createClient } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";

const html = htm.bind(h);
const CFG = window.CV_CONFIG;
const sb = createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
const TZ = "America/Monterrey";

/* ---------- catálogos ---------- */
const ESTATUS = { nueva: "Nueva", asignada: "Asignada", en_proceso: "En proceso", en_espera: "En espera", resuelta: "Resuelta", cerrada: "Cerrada" };
const ABIERTAS = ["nueva", "asignada", "en_proceso", "en_espera", "resuelta"];
const PRIORIDAD = { urgente: "Urgente", alta: "Alta", media: "Media", baja: "Baja" };
const PRI_ORDEN = { urgente: 0, alta: 1, media: 2, baja: 3 };
const AREA = { mantenimiento: "Mantenimiento", intendencia: "Intendencia" };
const DEPTO = { alimentos_bebidas: "Alimentos y bebidas", deportes: "Deportes", administracion: "Administración" };
const ROL = { gerente: "Gerente", supervisor: "Supervisor", operativo: "Operativo", solicitante: "Solicitante" };
const ACCION = { en_proceso: "Iniciar / reanudar", en_espera: "Poner en espera", resuelta: "Marcar resuelta" };

const DEMO = [
  ["gerente@clubvalle-demo.test", "Gerente", "Roberto Salinas"],
  ["sup.mant@clubvalle-demo.test", "Supervisor mantenimiento", "Luis Treviño"],
  ["sup.int@clubvalle-demo.test", "Supervisor intendencia", "Marisol Garza"],
  ["op.mant1@clubvalle-demo.test", "Operativo mantenimiento", "Jorge Castillo"],
  ["op.int1@clubvalle-demo.test", "Operativo intendencia", "Rosa Elena Ríos"],
  ["sol.ayb@clubvalle-demo.test", "Alimentos y bebidas", "Daniela Cantú"],
  ["sol.dep@clubvalle-demo.test", "Deportes", "Mauricio Leal"],
  ["sol.adm@clubvalle-demo.test", "Administración", "Karla Benavides"],
];
const DEMO_PASS = "Valle2026!";

/* ---------- utilidades ---------- */
const fFecha = (d) => new Date(d).toLocaleString("es-MX", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fDia = (d) => new Date(d).toLocaleDateString("es-MX", { timeZone: TZ, day: "numeric", month: "short" });
function hace(d) {
  const m = Math.max(0, (Date.now() - new Date(d)) / 60000);
  if (m < 60) return `hace ${Math.round(m)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  const dd = Math.round(m / 1440);
  return `hace ${dd} ${dd === 1 ? "día" : "días"}`;
}
const errMsg = (e) => (e && (e.message || e.error_description)) || "Algo salió mal";
const go = (r) => { location.hash = r; };

async function comprimir(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (blob) return blob;
  } catch (_) { /* usa el original */ }
  return file;
}
async function subirFotos(ordenId, archivos, perfilId) {
  for (const f of archivos) {
    const path = `${ordenId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from("orden-fotos").upload(path, f, { contentType: f.type || "image/jpeg" });
    if (error) throw error;
    const { error: e2 } = await sb.from("orden_fotos").insert({ orden_id: ordenId, storage_path: path, subida_por: perfilId });
    if (e2) throw e2;
  }
}
function qrDataUrl(texto) {
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  return q.createDataURL(6, 2);
}

/* permisos de pantalla (el servidor es quien decide de verdad) */
function acciones(o, p) {
  const a = { asignar: false, estatus: [], cerrar: false, reabrir: false, comentar: p.rol !== "gerente", foto: p.rol !== "gerente" };
  const vivo = ["asignada", "en_proceso", "en_espera"].includes(o.estatus);
  if (p.rol === "supervisor" && p.area === o.area) {
    a.asignar = ["nueva", "asignada", "en_proceso", "en_espera"].includes(o.estatus);
    if (vivo) a.estatus = ["en_proceso", "en_espera", "resuelta"];
    if (o.estatus === "resuelta") { a.cerrar = true; a.reabrir = true; }
  }
  if (p.rol === "operativo" && o.asignado_a === p.id && vivo) a.estatus = ["en_proceso", "en_espera", "resuelta"];
  a.estatus = a.estatus.filter((e) => e !== o.estatus);
  return a;
}

/* ---------- iconos ---------- */
const I = {
  lista: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>`,
  grafica: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  qr: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></svg>`,
  mas: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>`,
  escudo: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M12 9v6M9 12h6"/></svg>`,
};

function tabsPara(p) {
  const mas = { id: "mas", t: "Más", i: I.mas };
  const rep = { id: "reportar", t: "Reportar", i: I.escudo, centro: true };
  if (p.rol === "gerente") return [{ id: "dashboard", t: "Dashboard", i: I.grafica }, { id: "ordenes", t: "Órdenes", i: I.lista }, { id: "qr", t: "QR", i: I.qr }, mas];
  if (p.rol === "supervisor") return [{ id: "ordenes", t: "Bandeja", i: I.lista }, { id: "dashboard", t: "Dashboard", i: I.grafica }, rep, { id: "qr", t: "QR", i: I.qr }, mas];
  if (p.rol === "operativo") return [{ id: "ordenes", t: "Mis órdenes", i: I.lista }, rep, mas];
  return [{ id: "ordenes", t: "Mis reportes", i: I.lista }, rep, mas];
}

/* ---------- componentes chicos ---------- */
const Estatus = ({ e }) => html`<span class=${"badge b-" + e}>${ESTATUS[e]}</span>`;
const Pri = ({ p }) => html`<span class=${"pri " + p}>${PRIORIDAD[p]}</span>`;

function Tarjeta({ o }) {
  return html`<a class=${"orden s-" + o.estatus} href=${"#/orden/" + o.id}>
    <div class="row between">
      <span class="row"><span class="folio">${o.folio}</span><${Pri} p=${o.prioridad} />${o.riesgo_socios && html`<span class="riesgo">Riesgo socios</span>`}</span>
      <${Estatus} e=${o.estatus} />
    </div>
    <div class="desc">${o.descripcion}</div>
    <div class="small muted">${o.zona}${o.ubicacion_detalle ? " · " + o.ubicacion_detalle : ""} · ${o.categoria} · ${hace(o.created_at)}${o.asignado_a_nombre ? " · " + o.asignado_a_nombre : ""}</div>
  </a>`;
}

/* ---------- login ---------- */
function Login({ onError }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [cargando, setCargando] = useState(false);
  async function entrar(e, p) {
    setCargando(true);
    const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
    setCargando(false);
    if (error) onError("No pudimos iniciar sesión: " + errMsg(error));
  }
  return html`<div class="login"><div class="box stack">
    <img class="logo" src="img/logo-verde.png" alt="Club Valle" />
    <div style="text-align:center"><h1>Órdenes de servicio</h1><div class="muted">Mantenimiento e intendencia</div></div>
    <form class="card stack" onSubmit=${(ev) => { ev.preventDefault(); entrar(email.trim(), pass); }}>
      <div class="field"><label>Correo</label><input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="username" required /></div>
      <div class="field"><label>Contraseña</label><input type="password" value=${pass} onInput=${(e) => setPass(e.target.value)} autocomplete="current-password" required /></div>
      <button class="btn" disabled=${cargando}>${cargando ? "Entrando…" : "Entrar"}</button>
    </form>
    ${CFG.demo && html`<div class="card verde stack">
      <div class="lbl">Acceso rápido de demostración</div>
      <div class="demo">${DEMO.map(([e, rol, nombre]) => html`<button type="button" disabled=${cargando} onClick=${() => entrar(e, DEMO_PASS)}><b>${rol}</b><span>${nombre}</span></button>`)}</div>
      <div class="small muted">Usuarios y datos ficticios para la demostración.</div>
    </div>`}
  </div></div>`;
}

/* ---------- reportar ---------- */
function Reportar({ ctx }) {
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
      if (fotos.length + nuevos.length >= 3) break;
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
      if (fotos.length) await subirFotos(data.id, fotos.map((f) => f.blob), perfil.id);
      sessionStorage.removeItem("cv_zona");
      toast(`Reporte ${data.folio} enviado a ${AREA[data.area]}`);
      await refrescar();
      go("/orden/" + data.id);
    } catch (e) { toast(errMsg(e), true); }
    setEnviando(false);
  }
  const mant = categorias.filter((c) => c.area === "mantenimiento");
  const inte = categorias.filter((c) => c.area === "intendencia");
  return html`<div class="stack" style="max-width:640px">
    <div><h1>Reportar una falla</h1><div class="muted">${zonaQr ? "Llegaste desde el QR de " + zonaQr.nombre : "Cuéntanos qué pasó y dónde."}</div></div>
    <form class="stack" onSubmit=${enviar}>
      <div class="field"><label>Zona</label>
        <select value=${zona} onChange=${(e) => setZona(e.target.value)} required>
          <option value="">Elige la zona…</option>${zonas.map((z) => html`<option value=${z.id}>${z.nombre}</option>`)}
        </select></div>
      <div class="field"><label>Ubicación específica (opcional)</label>
        <input type="text" value=${ubic} onInput=${(e) => setUbic(e.target.value)} placeholder="Ej. regadera 4, cancha 3, mesa del fondo" /></div>
      <div class="field"><label>Tipo de falla</label>
        <select value=${cat} onChange=${(e) => setCat(e.target.value)} required>
          <option value="">Elige el tipo…</option>
          <optgroup label="Mantenimiento">${mant.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}</optgroup>
          <optgroup label="Intendencia">${inte.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}</optgroup>
        </select>
        ${catSel && html`<div class="small muted">Se enviará a ${AREA[catSel.area]}.</div>`}</div>
      <div class="field"><label>Descripción</label>
        <textarea value=${desc} onInput=${(e) => setDesc(e.target.value)} placeholder="¿Qué se ve mal o qué falla?" minlength="5" required></textarea></div>
      <div class="field"><label>Prioridad</label>
        <div class="seg">${Object.entries(PRIORIDAD).map(([k, v]) => html`<button type="button" class=${(pri === k ? "on " : "") + "p-" + k} onClick=${() => setPri(k)}>${v}</button>`)}</div></div>
      <label class="check"><input type="checkbox" checked=${riesgo} onChange=${(e) => setRiesgo(e.target.checked)} />
        <span><b>Riesgo para socios</b><br /><span class="small muted">Marca si puede lastimar o afectar a socios, familias o invitados.</span></span></label>
      <div class="field"><label>Fotos (hasta 3)</label>
        <div class="prev">${fotos.map((f, i) => html`<div><img src=${f.url} alt="" /><button type="button" aria-label="Quitar" onClick=${() => setFotos(fotos.filter((_, j) => j !== i))}>×</button></div>`)}</div>
        ${fotos.length < 3 && html`<div><input ref=${inp} type="file" accept="image/*" multiple onChange=${agregar} class="sr" /><button type="button" class="btn sec chico" onClick=${() => inp.current.click()}>Tomar o elegir foto</button></div>`}</div>
      <button class="btn" disabled=${enviando || !zona || !cat}>${enviando ? "Enviando…" : "Enviar reporte"}</button>
    </form></div>`;
}

/* ---------- lista ---------- */
const FILTROS = [
  ["abiertas", "Abiertas", (o) => o.estatus !== "cerrada"],
  ["nueva", "Nuevas", (o) => o.estatus === "nueva"],
  ["curso", "En curso", (o) => ["asignada", "en_proceso", "en_espera"].includes(o.estatus)],
  ["resuelta", "Por cerrar", (o) => o.estatus === "resuelta"],
  ["cerrada", "Cerradas", (o) => o.estatus === "cerrada"],
  ["todas", "Todas", () => true],
];
function Ordenes({ ctx }) {
  const { perfil, ordenes } = ctx;
  const [f, setF] = useState("abiertas");
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const titulo = perfil.rol === "operativo" ? "Mis órdenes" : perfil.rol === "solicitante" ? "Mis reportes" : perfil.rol === "supervisor" ? "Bandeja de " + AREA[perfil.area].toLowerCase() : "Todas las órdenes";
  const lista = useMemo(() => {
    const fn = FILTROS.find((x) => x[0] === f)[2];
    const t = q.trim().toLowerCase();
    return ordenes.filter(fn)
      .filter((o) => !area || o.area === area)
      .filter((o) => !t || [o.folio, o.descripcion, o.zona, o.categoria, o.asignado_a_nombre, o.reportado_por_nombre].join(" ").toLowerCase().includes(t))
      .sort((a, b) => (PRI_ORDEN[a.prioridad] - PRI_ORDEN[b.prioridad]) || (new Date(a.created_at) - new Date(b.created_at)) * (o_cerr(f) ? -1 : 1));
  }, [ordenes, f, q, area]);
  function o_cerr(x) { return x === "cerrada" || x === "todas"; }
  const cuenta = (fn) => ordenes.filter(fn).length;
  return html`<div class="stack">
    <div class="head"><div><h1>${titulo}</h1><div class="muted small">${lista.length} ${lista.length === 1 ? "orden" : "órdenes"}</div></div>
      <div class="row">${perfil.rol === "gerente" && html`<select style="width:auto" value=${area} onChange=${(e) => setArea(e.target.value)}><option value="">Ambas áreas</option><option value="mantenimiento">Mantenimiento</option><option value="intendencia">Intendencia</option></select>`}
      <button class="btn sec chico" onClick=${ctx.refrescar}>Actualizar</button></div></div>
    <div class="chips">${FILTROS.map(([k, t, fn]) => html`<button class=${"chip" + (f === k ? " on" : "")} onClick=${() => setF(k)}>${t} (${cuenta(fn)})</button>`)}</div>
    <input type="search" placeholder="Buscar por folio, zona, texto o persona" value=${q} onInput=${(e) => setQ(e.target.value)} />
    <div class="lista">${lista.length ? lista.map((o) => html`<${Tarjeta} o=${o} />`) : html`<div class="vacio">No hay órdenes en este filtro.</div>`}</div>
  </div>`;
}

/* ---------- detalle ---------- */
function Detalle({ ctx, id }) {
  const { perfil, perfiles, refrescar, toast } = ctx;
  const [o, setO] = useState(null);
  const [ev, setEv] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [com, setCom] = useState("");
  const [op, setOp] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [visor, setVisor] = useState(null);
  const inp = useRef();

  const cargar = useCallback(async () => {
    const { data: ord } = await sb.from("v_ordenes").select("*").eq("id", id).maybeSingle();
    setO(ord || false);
    if (!ord) return;
    const { data: e } = await sb.from("orden_eventos").select("*").eq("orden_id", id).order("created_at");
    setEv(e || []);
    const { data: f } = await sb.from("orden_fotos").select("*").eq("orden_id", id).order("created_at");
    if (f && f.length) {
      const { data: urls } = await sb.storage.from("orden-fotos").createSignedUrls(f.map((x) => x.storage_path), 3600);
      setFotos(f.map((x, i) => ({ ...x, url: urls && urls[i] && urls[i].signedUrl })).filter((x) => x.url));
    } else setFotos([]);
  }, [id]);
  useEffect(() => { setO(null); cargar(); }, [cargar]);

  if (o === null) return html`<div class="vacio">Cargando…</div>`;
  if (o === false) return html`<div class="vacio">No encontramos esta orden o no tienes acceso.<br /><a href="#/ordenes">Volver</a></div>`;

  const a = acciones(o, perfil);
  const nombre = (uid) => (perfiles.find((p) => p.id === uid) || {}).nombre || "—";
  const operativos = perfiles.filter((p) => p.rol === "operativo" && p.area === o.area && p.activo);
  async function correr(fn, ok) {
    setOcupado(true);
    try { const { error } = await fn(); if (error) throw error; setCom(""); await cargar(); await refrescar(); if (ok) toast(ok); }
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
  const atras = perfil.rol === "gerente" || perfil.rol === "supervisor" ? "#/ordenes" : "#/ordenes";
  return html`<div class="stack">
    <a href=${atras} class="small">← Volver a la lista</a>
    <div class="cols">
      <div class="stack">
        <div class="card">
          <div class="row between"><span class="row"><span class="folio" style="font-size:20px">${o.folio}</span><${Pri} p=${o.prioridad} />${o.riesgo_socios && html`<span class="riesgo">Riesgo socios</span>`}</span><${Estatus} e=${o.estatus} /></div>
          <p style="margin:10px 0 0">${o.descripcion}</p>
          <dl class="kv">
            <dt>Zona</dt><dd>${o.zona}${o.ubicacion_detalle ? " · " + o.ubicacion_detalle : ""}</dd>
            <dt>Tipo</dt><dd>${o.categoria} · ${AREA[o.area]}</dd>
            <dt>Reporta</dt><dd>${o.reportado_por_nombre} · ${DEPTO[o.departamento_solicitante] || "—"}</dd>
            <dt>Atiende</dt><dd>${o.asignado_a_nombre || "Sin asignar"}</dd>
            <dt>Creada</dt><dd>${fFecha(o.created_at)} (${hace(o.created_at)})</dd>
          </dl>
        </div>
        ${fotos.length > 0 && html`<div class="card"><h3 style="margin-bottom:8px">Fotos</h3><div class="fotos">${fotos.map((f) => html`<img src=${f.url} alt="Foto de la orden" onClick=${() => setVisor(f.url)} />`)}</div></div>`}
        <div class="card"><h3 style="margin-bottom:12px">Historial</h3>
          <ul class="timeline">${ev.map((e) => html`<li>
            <div><b>${e.tipo === "creada" ? "Reporte creado" : e.tipo === "asignada" ? "Asignada a " + nombre(e.asignado_a) : e.tipo === "comentario" ? "Comentario" : (ESTATUS[e.estatus_anterior] || "") + " → " + ESTATUS[e.estatus_nuevo]}</b></div>
            ${e.comentario && html`<div>${e.comentario}</div>`}
            <div class="small muted">${nombre(e.autor_id)} · ${fFecha(e.created_at)}</div></li>`)}</ul></div>
      </div>
      <div class="stack">
        ${(a.asignar || a.estatus.length > 0 || a.cerrar || a.comentar) && html`<div class="card verde stack">
          <h3>Acciones</h3>
          ${a.asignar && html`<div class="field"><label>${o.asignado_a ? "Reasignar a" : "Asignar a"}</label>
            <select value=${op} onChange=${(e) => setOp(e.target.value)}><option value="">Elige operativo…</option>${operativos.map((p) => html`<option value=${p.id}>${p.nombre}</option>`)}</select></div>`}
          <div class="field"><label>Comentario</label><textarea style="min-height:64px" value=${com} onInput=${(e) => setCom(e.target.value)} placeholder="Opcional; queda en el historial"></textarea></div>
          <div class="row">
            ${a.asignar && html`<button class="btn" disabled=${ocupado || !op} onClick=${asignar}>${o.asignado_a ? "Reasignar" : "Asignar"}</button>`}
            ${a.estatus.map((s) => html`<button class=${s === "resuelta" ? "btn" : "btn sec"} disabled=${ocupado} onClick=${() => estatus(s, ESTATUS[s])}>${ACCION[s]}</button>`)}
            ${a.cerrar && html`<button class="btn" disabled=${ocupado} onClick=${() => estatus("cerrada", "Orden cerrada")}>Cerrar orden</button>`}
            ${a.reabrir && html`<button class="btn peligro" disabled=${ocupado} onClick=${() => estatus("en_proceso", "Orden reabierta")}>Reabrir</button>`}
            ${a.comentar && html`<button class="btn sec" disabled=${ocupado || !com.trim()} onClick=${comentar}>Solo comentar</button>`}
          </div>
          ${a.foto && html`<div><input ref=${inp} type="file" accept="image/*" multiple class="sr" onChange=${foto} /><button class="btn sec chico" onClick=${() => inp.current.click()}>Agregar foto de evidencia</button></div>`}
        </div>`}
        ${perfil.rol === "gerente" && html`<div class="card muted small">Como gerente tienes vista de solo lectura. Las acciones las hacen supervisores y operativos.</div>`}
      </div>
    </div>
    ${visor && html`<div class="visor" onClick=${() => setVisor(null)}><img src=${visor} alt="" /></div>`}
  </div>`;
}

/* ---------- dashboard ---------- */
function Barras({ datos, color }) {
  const max = Math.max(1, ...datos.map((d) => d[1]));
  if (!datos.length) return html`<div class="muted small">Sin datos.</div>`;
  return datos.map(([t, n]) => html`<div class="barra"><span class="t" title=${t}>${t}</span><span class="pista"><i class="rel" style=${`display:block;width:${(n / max) * 100}%;${color ? "background:" + color : ""}`}></i></span><b>${n}</b></div>`);
}
const cuentaPor = (arr, fn) => { const m = {}; arr.forEach((o) => { const k = fn(o); if (k != null) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
function lunes(d) { const x = new Date(new Date(d).toLocaleString("en-US", { timeZone: TZ })); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); }

function Dashboard({ ctx }) {
  const { perfil, ordenes } = ctx;
  const ab = ordenes.filter((o) => o.estatus !== "cerrada");
  const dias = (o) => Number(o.dias_abierta || 0);
  const k = {
    abiertas: ab.length,
    sinAsignar: ordenes.filter((o) => o.estatus === "nueva").length,
    porCerrar: ordenes.filter((o) => o.estatus === "resuelta").length,
    riesgo: ab.filter((o) => o.riesgo_socios).length,
    cerr30: ordenes.filter((o) => o.cerrada_at && Date.now() - new Date(o.cerrada_at) < 30 * 864e5).length,
  };
  const semanas = useMemo(() => {
    const ini = lunes(Date.now());
    const w = [];
    for (let i = 7; i >= 0; i--) w.push({ t: ini - i * 7 * 864e5, c: 0, k: 0 });
    const idx = (d) => { const l = lunes(d); return w.findIndex((x) => Math.abs(x.t - l) < 36e5 * 30); };
    ordenes.forEach((o) => { let i = idx(o.created_at); if (i >= 0) w[i].c++; if (o.cerrada_at) { i = idx(o.cerrada_at); if (i >= 0) w[i].k++; } });
    return w;
  }, [ordenes]);
  const maxS = Math.max(1, ...semanas.map((s) => Math.max(s.c, s.k)));
  const edad = [["0 a 2 días", (o) => dias(o) <= 2], ["3 a 7 días", (o) => dias(o) > 2 && dias(o) <= 7], ["8 a 14 días", (o) => dias(o) > 7 && dias(o) <= 14], ["Más de 14 días", (o) => dias(o) > 14]].map(([t, fn]) => [t, ab.filter(fn).length]);
  const reinc = useMemo(() => {
    const m = {};
    ordenes.filter((o) => Date.now() - new Date(o.created_at) < 60 * 864e5).forEach((o) => { const key = o.zona + " · " + o.categoria; m[key] = (m[key] || 0) + 1; });
    return Object.entries(m).filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [ordenes]);
  const atencion = ab.filter((o) => (o.riesgo_socios && ["urgente", "alta"].includes(o.prioridad)) || o.prioridad === "urgente" || (o.estatus === "nueva" && dias(o) >= 1)).sort((a, b) => PRI_ORDEN[a.prioridad] - PRI_ORDEN[b.prioridad] || dias(b) - dias(a)).slice(0, 6);
  const carga = cuentaPor(ab.filter((o) => o.asignado_a_nombre), (o) => o.asignado_a_nombre);
  const titulo = perfil.rol === "gerente" ? "Dashboard" : "Dashboard de " + AREA[perfil.area].toLowerCase();
  return html`<div class="stack">
    <div class="head"><div><h1>${titulo}</h1><div class="muted small">${ordenes.length} órdenes registradas · datos al momento</div></div><button class="btn sec chico" onClick=${ctx.refrescar}>Actualizar</button></div>
    <div class="kpis">
      <div class="kpi"><b>${k.abiertas}</b><span>Abiertas</span></div>
      <div class=${"kpi" + (k.sinAsignar ? " alerta" : "")}><b>${k.sinAsignar}</b><span>Nuevas sin asignar</span></div>
      <div class="kpi"><b>${k.porCerrar}</b><span>Resueltas por cerrar</span></div>
      <div class=${"kpi" + (k.riesgo ? " alerta" : "")}><b>${k.riesgo}</b><span>Con riesgo para socios</span></div>
      <div class="kpi"><b>${k.cerr30}</b><span>Cerradas en 30 días</span></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Abiertas por estatus</h3><${Barras} datos=${["nueva", "asignada", "en_proceso", "en_espera", "resuelta"].map((e) => [ESTATUS[e], ordenes.filter((o) => o.estatus === e).length])} /></div>
      <div class="card"><h3>Creadas y cerradas por semana</h3>
        <div class="semanas">${semanas.map((s) => html`<div class="w"><div class="par"><i class="c" title="Creadas" style=${`height:${(s.c / maxS) * 100}%`}></i><i class="k" title="Cerradas" style=${`height:${(s.k / maxS) * 100}%`}></i></div><small>${fDia(s.t)}</small></div>`)}</div>
        <div class="leyenda" style="margin-top:6px"><span><i style="background:var(--nueva)"></i>Creadas</span><span><i style="background:var(--menta)"></i>Cerradas</span></div></div>
      <div class="card"><h3>Abiertas por zona</h3><${Barras} datos=${cuentaPor(ab, (o) => o.zona).slice(0, 7)} /></div>
      <div class="card"><h3>Abiertas por categoría</h3><${Barras} datos=${cuentaPor(ab, (o) => o.categoria).slice(0, 7)} /></div>
      ${perfil.rol === "gerente" && html`<div class="card"><h3>Abiertas por área</h3><${Barras} datos=${cuentaPor(ab, (o) => AREA[o.area])} /></div>`}
      <div class="card"><h3>Abiertas por departamento solicitante</h3><${Barras} datos=${cuentaPor(ab, (o) => DEPTO[o.departamento_solicitante])} /></div>
      <div class="card"><h3>Antigüedad de las abiertas</h3><${Barras} datos=${edad} color="var(--proceso)" /></div>
      <div class="card"><h3>Carga por operativo (abiertas)</h3><${Barras} datos=${carga} /></div>
      <div class="card"><h3>Fallas reincidentes (60 días)</h3>${reinc.length ? html`<${Barras} datos=${reinc} color="var(--espera)" />` : html`<div class="muted small">Sin reincidencias.</div>`}</div>
      <div class="card"><h3>Requieren atención</h3><div class="stack" style="margin-top:8px">${atencion.length ? atencion.map((o) => html`<${Tarjeta} o=${o} />`) : html`<div class="muted small">Nada urgente por ahora.</div>`}</div></div>
    </div>
  </div>`;
}

/* ---------- QR ---------- */
function QRs({ ctx }) {
  const base = location.origin + location.pathname;
  const items = useMemo(() => ctx.zonas.map((z) => ({ z, img: qrDataUrl(`${base}?zona=${z.qr_token}`) })), [ctx.zonas]);
  return html`<div class="stack">
    <div class="head"><div><h1>QR por zona</h1><div class="muted small">Pega cada código en su zona. Al escanearlo se abre el reporte con la zona ya elegida.</div></div>
      <button class="btn noprint" onClick=${() => window.print()}>Imprimir</button></div>
    <div class="qrs">${items.map(({ z, img }) => html`<div class="qrc"><img src=${img} alt=${"QR " + z.nombre} /><h3 style="margin-top:6px">${z.nombre}</h3><div class="small muted">Escanea para reportar una falla</div></div>`)}</div>
  </div>`;
}

/* ---------- más ---------- */
function Mas({ ctx }) {
  const p = ctx.perfil;
  return html`<div class="stack" style="max-width:520px">
    <h1>Más</h1>
    <div class="card"><div class="lbl">Sesión</div><h2 style="margin:4px 0">${p.nombre}</h2>
      <div>${ROL[p.rol]}${p.area ? " · " + AREA[p.area] : ""}${p.departamento ? " · " + DEPTO[p.departamento] : ""}</div></div>
    <div class="card small muted">Herramienta de órdenes de servicio para mantenimiento e intendencia. Cada cambio queda en el historial con autor y hora.</div>
    <button class="btn peligro" onClick=${() => sb.auth.signOut()}>Cerrar sesión</button>
  </div>`;
}

/* ---------- app ---------- */
function useHash() {
  const [hs, setHs] = useState(location.hash.slice(1) || "/");
  useEffect(() => { const f = () => setHs(location.hash.slice(1) || "/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return hs;
}

function App() {
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [base, setBase] = useState({ zonas: [], categorias: [], perfiles: [] });
  const [ordenes, setOrdenes] = useState([]);
  const [aviso, setAviso] = useState(null);
  const hs = useHash();

  const toast = useCallback((m, err) => { setAviso({ m, err }); setTimeout(() => setAviso(null), 3800); }, []);

  useEffect(() => {
    const zq = new URLSearchParams(location.search).get("zona");
    if (zq) { sessionStorage.setItem("cv_zona", zq); history.replaceState(null, "", location.pathname); location.hash = "/reportar"; }
    sb.auth.getSession().then(({ data }) => setSesion(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSesion(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refrescar = useCallback(async () => {
    const { data } = await sb.from("v_ordenes").select("*").order("created_at", { ascending: false });
    setOrdenes(data || []);
  }, []);

  useEffect(() => {
    if (!sesion) { setPerfil(null); setOrdenes([]); return; }
    (async () => {
      const [{ data: p }, { data: z }, { data: c }, { data: ps }] = await Promise.all([
        sb.from("perfiles").select("*").eq("id", sesion.user.id).maybeSingle(),
        sb.from("zonas").select("*").eq("activa", true).order("nombre"),
        sb.from("categorias").select("*").order("nombre"),
        sb.from("perfiles").select("*"),
      ]);
      setBase({ zonas: z || [], categorias: c || [], perfiles: ps || [] });
      setPerfil(p);
      await refrescar();
      if (location.hash === "" || location.hash === "#/" || location.hash === "#") {
        go(sessionStorage.getItem("cv_zona") ? "/reportar" : p && p.rol === "gerente" ? "/dashboard" : "/ordenes");
      }
    })();
  }, [sesion && sesion.user.id]);

  useEffect(() => {
    if (!perfil) return;
    const t = setInterval(() => { if (!document.hidden) refrescar(); }, 30000);
    return () => clearInterval(t);
  }, [perfil]);

  if (sesion === undefined) return html`<div class="vacio">Cargando…</div>`;
  if (!sesion) return html`<${Login} onError=${(m) => toast(m, true)} />${aviso && html`<div class=${"toast" + (aviso.err ? " err" : "")}>${aviso.m}</div>`}`;
  if (!perfil) return html`<div class="vacio">Cargando tu perfil…</div>`;

  const ctx = { sb, perfil, ...base, ordenes, refrescar, toast };
  const tabs = tabsPara(perfil);
  const [, ruta, arg] = hs.split("/");
  let vista;
  if (ruta === "orden") vista = html`<${Detalle} key=${arg} ctx=${ctx} id=${Number(arg)} />`;
  else if (ruta === "reportar" && perfil.rol !== "gerente") vista = html`<${Reportar} ctx=${ctx} />`;
  else if (ruta === "dashboard" && ["gerente", "supervisor"].includes(perfil.rol)) vista = html`<${Dashboard} ctx=${ctx} />`;
  else if (ruta === "qr" && ["gerente", "supervisor"].includes(perfil.rol)) vista = html`<${QRs} ctx=${ctx} />`;
  else if (ruta === "mas") vista = html`<${Mas} ctx=${ctx} />`;
  else vista = html`<${Ordenes} ctx=${ctx} />`;
  const activo = ruta === "orden" ? "ordenes" : ruta;

  return html`<div class="shell">
    <header class="top"><img src="img/imagotipo-horizontal.jpg" alt="Club Valle" /><div class="quien"><b>${perfil.nombre}</b><br />${ROL[perfil.rol]}${perfil.area ? " · " + AREA[perfil.area] : ""}</div></header>
    <main class="main">${vista}</main>
    <nav class="nav">${tabs.map((t) => html`<a href=${"#/" + t.id} class=${(t.centro ? "centro " : "") + (activo === t.id || (!tabs.some((x) => x.id === activo) && t.id === "ordenes") ? "on" : "")}>${t.centro ? html`<span class="esc">${t.i}</span>` : t.i}<span>${t.t}</span></a>`)}</nav>
    ${aviso && html`<div class=${"toast" + (aviso.err ? " err" : "")}>${aviso.m}</div>`}
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
