// npm run build        -> dist/        (lo que publica Vercel)
// npm run build:local  -> dist-local/  (config apuntando a la réplica de test/replica.mjs)
import * as esbuild from "esbuild";
import fs from "fs";

const local = process.argv.includes("--local");
const out = local ? "dist-local" : "dist";
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync("public", out, { recursive: true });
await esbuild.build({
  entryPoints: { app: "src/main.js", styles: "src/styles.css" },
  bundle: true, minify: true, outdir: out, format: "iife", target: "es2020",
  loader: { ".css": "css" }, external: ["img/*"],
});
if (local) fs.writeFileSync(out + "/config.js", 'window.CV_CONFIG = { url: location.origin, key: "local", demo: true };\n');
console.log(out + " listo", fs.readdirSync(out));
