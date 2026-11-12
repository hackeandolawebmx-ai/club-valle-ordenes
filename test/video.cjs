// Graba los segmentos de la demo contra la réplica local. Salida: /tmp/vid/segN.webm y /tmp/vid/caps.json
const { chromium } = require("playwright"); const fs = require("fs");
const URL = "http://127.0.0.1:3000/"; const OUT = "/tmp/vid";
const RIPPLE = `document.addEventListener('pointerdown',e=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:99999;pointer-events:none;width:46px;height:46px;border-radius:50%;background:rgba(95,168,128,.55);border:3px solid #31674F;left:'+(e.clientX-23)+'px;top:'+(e.clientY-23)+'px;transition:all .55s ease-out';document.body.appendChild(d);requestAnimationFrame(()=>{d.style.transform='scale(1.9)';d.style.opacity='0'});setTimeout(()=>d.remove(),700)},true);`;
const caps = {}; let folio = "";
(async () => {
  const br = await chromium.launch();
  const seg = async (n, { phone = true, user = null }, fn) => {
    let state; if (user) { const c0 = await br.newContext({ viewport: { width: 390, height: 844 } }); const p0 = await c0.newPage(); await p0.goto(URL); await p0.waitForSelector('.demo'); await p0.click(`button:has(span:text-is("${user}"))`); await p0.waitForSelector('.nav'); await p0.waitForTimeout(500); state = await c0.storageState(); await c0.close(); }
    const vp = phone ? { width: 585, height: 1266 } : { width: 1280, height: 720 };
    const sz = phone ? { width: 585, height: 1266 } : { width: 1280, height: 720 };
    const c = await br.newContext({ viewport: vp, recordVideo: { dir: OUT + "/raw" + n, size: sz }, acceptDownloads: false, ...(state ? { storageState: state } : {}) });
    await c.addInitScript(RIPPLE); if (phone) await c.addInitScript("document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.zoom='1.5'})");
    const p = await c.newPage(); const t0 = Date.now(); caps[n] = [];
    const cap = (t) => caps[n].push({ t: (Date.now() - t0) / 1000, text: t });
    const w = (ms) => p.waitForTimeout(ms);
    await fn(p, cap, w); caps[n].push({ t: (Date.now() - t0) / 1000, text: null }); 
    const v = p.video(); await c.close(); fs.renameSync(await v.path(), `${OUT}/seg${n}.webm`);
  };
  const entrar = async (p, nombre) => { await p.goto(URL); await p.waitForSelector(".demo"); };
  // 1 solicitante
  await seg(1, {}, async (p, cap, w) => {
    await p.goto(URL); await p.waitForSelector(".demo"); cap("1. Quien detecta una falla\nla reporta desde su celular"); await w(2600);
    await p.click('button:has(span:text-is("Daniela Cantú"))'); await p.waitForSelector(".nav"); await w(1800);
    await p.click(".nav a.centro"); await p.waitForSelector("textarea"); await w(900);
    cap("Elige la zona y el tipo de falla:\nse envía sola al área correcta");
    await p.selectOption("select >> nth=0", { label: "Alberca" }); await w(900);
    await p.type('input[type=text]', "Andén lado profundo", { delay: 45 }); await w(500);
    await p.selectOption("select >> nth=1", { label: "Plomería" }); await w(1800);
    await p.type("textarea", "Fuga de agua en la regadera exterior.", { delay: 40 }); await w(700);
    cap("Prioridad, riesgo para socios\ny hasta 3 fotos");
    await p.click('.seg button:text-is("Alta")'); await w(700);
    await p.check(".check input"); await w(700);
    await p.setInputFiles('input[type=file]', "/tmp/vid/foto_fuga.jpg"); await p.waitForSelector(".prev img"); await w(1800);
    await p.evaluate(() => window.scrollTo({ top: 9999, behavior: "smooth" })); await w(1200);
    await p.click('button:text-is("Enviar reporte")'); await p.waitForSelector(".timeline");
    folio = ((await p.textContent(".folio")) || "").trim();
    cap("Folio automático, foto\ny primer registro en el historial"); await w(3200);
  });
  // 2 supervisor asigna
  await seg(2, { user: "Luis Treviño" }, async (p, cap, w) => {
    await p.goto(URL); await p.waitForSelector(".orden");
    cap("2. El supervisor del área ve su bandeja\ncon lo urgente primero"); await w(2600);
    await p.click('.chip:has-text("Nuevas")'); await w(1500);
    await p.click(`.orden:has-text("${folio}")`); await p.waitForSelector(".card.verde"); await w(1500);
    cap("Asigna la orden a un operativo\nde su misma área");
    await p.selectOption(".card.verde select", { label: "Jorge Castillo" }); await w(1000);
    await p.type(".card.verde textarea", "Atender hoy, hay socios cerca.", { delay: 40 }); await w(600);
    await p.click('button:text-is("Asignar")'); await p.waitForSelector(".badge.b-asignada"); await w(1000);
    await p.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" })); await w(2600);
  });
  // 3 operativo
  await seg(3, { user: "Jorge Castillo" }, async (p, cap, w) => {
    await p.goto(URL); await p.waitForSelector(".orden");
    cap("3. El operativo ve solo lo que le asignaron"); await w(2600);
    await p.click(`.orden:has-text("${folio}")`); await p.waitForSelector(".card.verde"); await w(1200);
    cap("Cambia el estatus y deja evidencia.\nNo puede cerrar la orden");
    await p.click('button:text-is("Iniciar / reanudar")'); await p.waitForSelector(".badge.b-en_proceso"); await w(1500);
    await p.type(".card.verde textarea", "Cambié el empaque y probé.", { delay: 40 }); await w(500);
    await p.setInputFiles('.card.verde input[type=file]', "/tmp/vid/foto_listo.jpg"); await w(2200);
    await p.click('button:text-is("Marcar resuelta")'); await p.waitForSelector(".badge.b-resuelta"); await w(2800);
  });
  // 4 supervisor cierra
  await seg(4, { user: "Luis Treviño" }, async (p, cap, w) => {
    await p.goto(URL); await p.waitForSelector(".orden");
    cap("4. El supervisor revisa lo resuelto\ny es el único que cierra"); await w(1800);
    await p.click('.chip:has-text("Por cerrar")'); await w(1300);
    await p.click(`.orden:has-text("${folio}")`); await p.waitForSelector('button:text-is("Cerrar orden")'); await w(1500);
    await p.click('button:text-is("Cerrar orden")'); await p.waitForSelector(".badge.b-cerrada"); await w(1200);
    cap("Cada cambio queda en el historial:\nquién, qué y cuándo");
    await p.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" })); await w(3800);
  });
  // 5 gerente desktop
  await seg(5, { phone: false, user: "Roberto Salinas" }, async (p, cap, w) => {
    await p.goto(URL); await p.waitForSelector(".kpis"); await w(600);
    cap("5. El gerente ve todo en un tablero:\nqué está abierto, dónde y desde cuándo"); await w(3200);
    await p.evaluate(() => window.scrollTo({ top: 430, behavior: "smooth" })); await w(2800);
    cap("Por zona, categoría, departamento,\nantigüedad, carga y fallas que se repiten");
    await p.evaluate(() => window.scrollTo({ top: 900, behavior: "smooth" })); await w(3200);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await w(900);
    await p.click('.nav a:has-text("QR")'); await p.waitForSelector(".qrc img"); 
    cap("Un QR por zona: al escanearlo\nse abre el reporte con la zona elegida"); await w(3800);
  });
  await br.close(); fs.writeFileSync(OUT + "/caps.json", JSON.stringify({ caps, folio }, null, 1)); console.log("ok", folio);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
