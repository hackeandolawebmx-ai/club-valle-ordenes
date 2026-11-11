// Imitación local de Supabase (auth + rest + storage) para probar la app sin red. No se despliega.
import http from "http"; import fs from "fs"; import path from "path"; import crypto from "crypto"; import pg from "pg";
const SECRET = "cv-local-secret-cv-local-secret-1234";
const DIST = path.resolve(process.env.DIST || "dist"); const PORT = 3000;
const db = new pg.Client({ host: "/home/claude/pgtest", database: "cv2", user: "postgres" }); await db.connect();
const store = new Map();
const b64 = (b) => Buffer.from(b).toString("base64url");
const jwt = (p) => { const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" })), c = b64(JSON.stringify(p)); return `${h}.${c}.${crypto.createHmac("sha256", SECRET).update(h + "." + c).digest("base64url")}`; };
const sesion = (u) => { const now = Math.floor(Date.now() / 1000);
  const t = jwt({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, iat: now, exp: now + 3600 });
  return { access_token: t, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "rt." + u.id, user: { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }; };
const body = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/json" };
const send = (res, code, obj, h = {}) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", ...h }); res.end(JSON.stringify(obj)); };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
  if (url.pathname === "/auth/v1/token") {
    const b = JSON.parse((await body(req)).toString() || "{}");
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const id = (b.refresh_token || "").replace("rt.", ""); const r = await db.query("select id,email from auth.users where id=$1", [id]);
      return r.rows[0] ? send(res, 200, sesion(r.rows[0])) : send(res, 400, { error: "invalid_grant", error_description: "refresh inválido" });
    }
    const r = await db.query("select id,email from auth.users where email=$1 and encrypted_password = crypt($2, encrypted_password)", [b.email, b.password]);
    return r.rows[0] ? send(res, 200, sesion(r.rows[0])) : send(res, 400, { error: "invalid_grant", error_description: "Credenciales inválidas" });
  }
  if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  if (url.pathname === "/auth/v1/user") { const id = JSON.parse(Buffer.from((req.headers.authorization || "").split(".")[1] || "e30", "base64url")).sub; const r = await db.query("select id,email from auth.users where id=$1", [id]); return send(res, 200, r.rows[0] || {}); }
  if (url.pathname.startsWith("/rest/v1/")) {
    const data = await body(req);
    const h = { ...req.headers, host: "127.0.0.1:3001" }; delete h["content-length"];
    const p = http.request({ host: "127.0.0.1", port: 3001, path: url.pathname.replace("/rest/v1", "") + url.search, method: req.method, headers: { ...h, "content-length": data.length } }, (pr) => { res.writeHead(pr.statusCode, { ...pr.headers, "access-control-allow-origin": "*" }); pr.pipe(res); });
    p.on("error", () => send(res, 502, { message: "postgrest caído" })); return p.end(data);
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/orden-fotos") && req.method === "POST") {
    const b = JSON.parse((await body(req)).toString()); return send(res, 200, b.paths.map((p) => ({ error: store.has(p) ? null : "no existe", path: p, signedURL: `/object/sign/orden-fotos/${p}?token=t` })));
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/orden-fotos/")) { const p = decodeURIComponent(url.pathname.split("/orden-fotos/")[1]); const f = store.get(p); if (!f) return send(res, 404, {}); res.writeHead(200, { "content-type": "image/jpeg", "access-control-allow-origin": "*" }); return res.end(f); }
  if (url.pathname.startsWith("/storage/v1/object/orden-fotos/") && req.method === "POST") {
    const p = decodeURIComponent(url.pathname.split("/orden-fotos/")[1]); const raw = await body(req);
    // multipart: toma el contenido binario del primer archivo
    const fi = raw.indexOf("filename="), s = raw.indexOf("\r\n\r\n", fi) + 4, e = raw.lastIndexOf("\r\n--"); store.set(p, raw.subarray(s, e > s ? e : raw.length)); return send(res, 200, { Key: "orden-fotos/" + p });
  }
  let f = path.join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("mock en http://127.0.0.1:" + PORT));
