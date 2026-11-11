import * as esbuild from "esbuild";
import fs from "fs";
fs.rmSync("dist", { recursive: true, force: true });
fs.cpSync("public", "dist", { recursive: true });
await esbuild.build({
  entryPoints: { app: "src/main.js", styles: "src/styles.css" },
  bundle: true, minify: true, outdir: "dist", format: "iife", target: "es2020",
  loader: { ".css": "css" }, jsx: "transform",
});
console.log("dist listo", fs.readdirSync("dist"));
