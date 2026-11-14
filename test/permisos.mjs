// Corre supabase/tests/prueba_permisos.sql sobre PGlite con las migraciones reales.
//   npm run test:permisos
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const db = new PGlite({ extensions: { pgcrypto } });
const migs = fs.readdirSync(path.join(RAIZ, "supabase/migrations")).filter((f) => f.endsWith(".sql") && !f.startsWith("0002")).sort();
for (const f of ["supabase/tests/stub_supabase.sql", ...migs.map((m) => "supabase/migrations/" + m)]) await db.exec(leer(f));
// una sentencia a la vez para poder mostrar cada resultado
const texto = leer("supabase/tests/prueba_permisos.sql").replace(/^\\set.*$/m, "");
const sentencias = [];
let acum = "", dentro = false;
for (const linea of texto.split("\n")) {
  if (linea.trim().startsWith("--") && !acum.trim()) continue;
  acum += linea + "\n";
  const n = (linea.match(/\$\$|\$[a-z_]*\$/g) || []).length; if (n % 2) dentro = !dentro;
  if (!dentro && /;\s*(--.*)?$/.test(linea)) { sentencias.push(acum); acum = ""; }
}
let fallas = 0;
for (const s of sentencias) {
  try {
    const r = await db.query(s);
    for (const f of r.rows || []) { const v = Object.values(f).join(" | "); if (v) console.log(v); }
  } catch (e) { fallas++; console.log("ERROR:", e.message, "\n  en:", s.trim().slice(0, 160)); break; }
}
process.exit(fallas ? 1 : 0);
