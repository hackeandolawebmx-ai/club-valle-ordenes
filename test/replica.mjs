// Réplica local de Supabase para probar la app sin red y sin instalar Postgres.
// Usa PGlite (Postgres en WebAssembly) con las migraciones y el seed reales, así
// que la RLS y las funciones RPC son las mismas que en producción.
// Imita auth, REST (lo que usa la app) y storage. No se despliega.
//   npm run replica      -> http://127.0.0.1:3000
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(RAIZ, process.env.DIST || "dist-local");
const PORT = Number(process.env.PORT || 3000);
const sql = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const db = new PGlite({ extensions: { pgcrypto } });
for (const f of [
  "supabase/tests/stub_supabase.sql",
  "supabase/migrations/0001_modelo_ordenes.sql",
  "supabase/migrations/0003_cerrar_funciones_auxiliares.sql",
  "supabase/seed/seed_demo.sql",
]) await db.exec(sql(f));

const fotos = new Map();
const ID = /^[a-z_][a-z0-9_]*$/;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (u, exp) => `${b64({ alg: "none" })}.${b64({ sub: u.id, role: "authenticated", email: u.email, exp })}.local`;
function sesion(u) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: token(u, now + 3600), token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "rt." + u.id,
    user: { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}
function claims(req) {
  try { return JSON.parse(Buffer.from((req.headers.authorization || "").split(".")[1], "base64url").toString()); } catch (_) { return null; }
}
const cuerpo = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", ...CORS }); res.end(typeof obj === "string" ? obj : JSON.stringify(obj)); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

// Ejecuta una consulta con el rol y los claims del usuario, como lo hace PostgREST.
async function comoUsuario(req, texto, params) {
  const c = claims(req);
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(c || {})]);
    await tx.exec(`set local role ${c && c.sub ? "authenticated" : "anon"}`);
    const r = await tx.query(texto, params);
    return r.rows[0] ? r.rows[0].j : null;
  });
}

async function rest(req, res, url) {
  const partes = url.pathname.replace("/rest/v1/", "").split("/");
  const data = (await cuerpo(req)).toString();
  try {
    if (partes[0] === "rpc") {
      const fn = partes[1]; const args = data ? JSON.parse(data) : {};
      const ks = Object.keys(args);
      if (!ID.test(fn) || ks.some((k) => !ID.test(k))) return json(res, 400, { message: "petición inválida" });
      const j = await comoUsuario(req, `select row_to_json(t)::text as j from public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")}) t`, ks.map((k) => args[k]));
      return json(res, 200, j || "null");
    }
    const tabla = partes[0];
    if (!ID.test(tabla)) return json(res, 400, { message: "tabla inválida" });
    if (req.method === "POST") {
      const fila = JSON.parse(data); const ks = Object.keys(fila);
      if (ks.some((k) => !ID.test(k))) return json(res, 400, { message: "columna inválida" });
      await comoUsuario(req, `insert into public.${tabla} (${ks.join(", ")}) values (${ks.map((_, i) => "$" + (i + 1)).join(", ")}) returning null as j`, ks.map((k) => fila[k]));
      res.writeHead(201, CORS); return res.end();
    }
    const donde = []; const params = []; let orden = "";
    for (const [k, v] of url.searchParams) {
      if (k === "select") continue;
      if (k === "order") {
        orden = " order by " + v.split(",").map((o) => { const [col, dir] = o.split("."); if (!ID.test(col)) throw new Error("orden inválido"); return col + (dir === "desc" ? " desc" : ""); }).join(", ");
        continue;
      }
      if (!ID.test(k) || !v.startsWith("eq.")) return json(res, 400, { message: "filtro no soportado por la réplica: " + k + "=" + v });
      params.push(v.slice(3)); donde.push(`${k}::text = $${params.length}`);
    }
    const j = await comoUsuario(req, `select coalesce(json_agg(t), '[]')::text as j from (select * from public.${tabla}${donde.length ? " where " + donde.join(" and ") : ""}${orden}) t`, params);
    if ((req.headers.accept || "").includes("vnd.pgrst.object")) {
      const filas = JSON.parse(j);
      return filas.length === 1 ? json(res, 200, filas[0]) : json(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${filas.length} rows` });
    }
    return json(res, 200, j);
  } catch (e) {
    return json(res, 400, { message: e.message, code: e.code || "", details: e.detail || null, hint: e.hint || null });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    if (p === "/auth/v1/token") {
      const b = JSON.parse((await cuerpo(req)).toString() || "{}");
      const r = url.searchParams.get("grant_type") === "refresh_token"
        ? await db.query("select id, email from auth.users where id::text = $1", [(b.refresh_token || "").replace("rt.", "")])
        : await db.query("select id, email from auth.users where email = $1 and encrypted_password = crypt($2, encrypted_password)", [b.email, b.password]);
      return r.rows[0] ? json(res, 200, sesion(r.rows[0])) : json(res, 400, { error: "invalid_grant", error_description: "Credenciales inválidas" });
    }
    if (p === "/auth/v1/logout") { res.writeHead(204, CORS); return res.end(); }
    if (p === "/auth/v1/user") {
      const c = claims(req);
      const r = await db.query("select id, email from auth.users where id::text = $1", [(c && c.sub) || ""]);
      return json(res, 200, r.rows[0] || {});
    }
    if (p.startsWith("/rest/v1/")) return rest(req, res, url);
    if (p.startsWith("/storage/v1/object/sign/orden-fotos") && req.method === "POST") {
      const b = JSON.parse((await cuerpo(req)).toString());
      return json(res, 200, b.paths.map((x) => ({ error: fotos.has(x) ? null : "no existe", path: x, signedURL: `/object/sign/orden-fotos/${x}?token=t` })));
    }
    if (p.startsWith("/storage/v1/object/sign/orden-fotos/")) {
      const f = fotos.get(decodeURIComponent(p.split("/orden-fotos/")[1]));
      if (!f) return json(res, 404, {});
      res.writeHead(200, { "content-type": "image/jpeg", ...CORS }); return res.end(f);
    }
    if (p.startsWith("/storage/v1/object/orden-fotos/") && req.method === "POST") {
      const raw = await cuerpo(req);
      // si llega multipart, toma el contenido binario del primer archivo
      const fi = raw.indexOf("filename=");
      let bin = raw;
      if (fi >= 0) { const s = raw.indexOf("\r\n\r\n", fi) + 4, e = raw.lastIndexOf("\r\n--"); bin = raw.subarray(s, e > s ? e : raw.length); }
      const k = decodeURIComponent(p.split("/orden-fotos/")[1]);
      fotos.set(k, bin);
      return json(res, 200, { Key: "orden-fotos/" + k });
    }
    // solo para pruebas: token del QR de una zona
    if (p === "/__prueba/qr") {
      const r = await db.query("select qr_token from public.zonas where nombre = $1", [url.searchParams.get("zona")]);
      return json(res, 200, r.rows[0] || {});
    }
    let f = path.join(DIST, p === "/" ? "index.html" : decodeURIComponent(p));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(f).pipe(res);
  } catch (e) {
    json(res, 500, { message: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`réplica lista en http://127.0.0.1:${PORT} (sirviendo ${path.relative(RAIZ, DIST)})`));
