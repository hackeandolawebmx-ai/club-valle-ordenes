// Datos, catálogos y utilidades. Aquí no hay pantallas.
import { createClient } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";

export const CFG = window.CV_CONFIG;
export const sb = createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
export const TZ = "America/Monterrey";

/* ---------- catálogos ---------- */
export const ESTATUS = { nueva: "Nueva", asignada: "Asignada", en_proceso: "En proceso", en_espera: "En espera", resuelta: "Resuelta", cerrada: "Cerrada" };
export const FLUJO = ["nueva", "asignada", "en_proceso", "resuelta", "cerrada"];
export const PRIORIDAD = { urgente: "Urgente", alta: "Alta", media: "Media", baja: "Baja" };
export const PRI_ORDEN = { urgente: 0, alta: 1, media: 2, baja: 3 };
export const PRI_AYUDA = { urgente: "Atender de inmediato", alta: "Atender hoy", media: "Esta semana", baja: "Cuando haya espacio" };
export const AREA = { mantenimiento: "Mantenimiento", intendencia: "Intendencia" };
export const DEPTO = { alimentos_bebidas: "Alimentos y bebidas", deportes: "Deportes", administracion: "Administración" };
export const ROL = { gerente: "Gerente", supervisor: "Supervisor", operativo: "Operativo", solicitante: "Solicitante" };
export const ACCION = { en_proceso: "Iniciar / reanudar", en_espera: "Poner en espera", resuelta: "Marcar resuelta" };

export const DEMO = [
  ["gerente@clubvalle-demo.test", "Gerente", "Roberto Salinas"],
  ["sup.mant@clubvalle-demo.test", "Supervisor mantenimiento", "Luis Treviño"],
  ["sup.int@clubvalle-demo.test", "Supervisor intendencia", "Marisol Garza"],
  ["op.mant1@clubvalle-demo.test", "Operativo mantenimiento", "Jorge Castillo"],
  ["op.int1@clubvalle-demo.test", "Operativo intendencia", "Rosa Elena Ríos"],
  ["sol.ayb@clubvalle-demo.test", "Alimentos y bebidas", "Daniela Cantú"],
  ["sol.dep@clubvalle-demo.test", "Deportes", "Mauricio Leal"],
  ["sol.adm@clubvalle-demo.test", "Administración", "Karla Benavides"],
];
export const DEMO_PASS = "Valle2026!";

/* Lo que cada rol puede hacer, en palabras. Se muestra en "Más". */
export const PUEDES = {
  gerente: ["Ver el dashboard y todas las órdenes de ambas áreas", "Consultar el historial completo de cada orden", "Imprimir los códigos QR por zona"],
  supervisor: ["Ver y gestionar las órdenes de tu área", "Asignar cada orden a un operativo de tu área", "Cerrar o reabrir las órdenes resueltas", "Levantar reportes e imprimir los QR por zona"],
  operativo: ["Ver las órdenes que te asignaron y las que reportaste", "Iniciar, poner en espera o marcar resuelta una orden", "Agregar comentarios y fotos de evidencia"],
  solicitante: ["Reportar una falla en menos de un minuto", "Dar seguimiento a tus reportes", "Agregar comentarios y fotos"],
};

/* ---------- formato ---------- */
export const fFecha = (d) => new Date(d).toLocaleString("es-MX", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fDia = (d) => new Date(d).toLocaleDateString("es-MX", { timeZone: TZ, day: "numeric", month: "short" });
export const fHoy = () => new Date().toLocaleDateString("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
export function hace(d) {
  const m = Math.max(0, (Date.now() - new Date(d)) / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${Math.round(m)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  const dd = Math.round(m / 1440);
  return `hace ${dd} ${dd === 1 ? "día" : "días"}`;
}
export function saludo() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false })) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
export const iniciales = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
export const errMsg = (e) => (e && (e.message || e.error_description)) || "Algo salió mal. Intenta de nuevo.";
export const go = (r) => { location.hash = r; };
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------- fotos ---------- */
export async function comprimir(file, max = 1600) {
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
export async function subirFotos(ordenId, archivos, perfilId) {
  for (const f of archivos) {
    const path = `${ordenId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from("orden-fotos").upload(path, f, { contentType: f.type || "image/jpeg" });
    if (error) throw error;
    const { error: e2 } = await sb.from("orden_fotos").insert({ orden_id: ordenId, storage_path: path, subida_por: perfilId });
    if (e2) throw e2;
  }
}
export function qrDataUrl(texto) {
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  return q.createDataURL(6, 2);
}

/* ---------- permisos de pantalla (el servidor es quien decide de verdad) ---------- */
export function acciones(o, p) {
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

/* ---------- consultas compartidas ---------- */
export const esAbierta = (o) => o.estatus !== "cerrada";
export const dias = (o) => Number(o.dias_abierta || 0);
/* Órdenes que alguien debería ver hoy: riesgo con prioridad alta, urgentes, o nuevas con más de un día sin asignar. */
export const pideAtencion = (o) => esAbierta(o) && ((o.riesgo_socios && ["urgente", "alta"].includes(o.prioridad)) || o.prioridad === "urgente" || (o.estatus === "nueva" && dias(o) >= 1));
