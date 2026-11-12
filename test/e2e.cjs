const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.env.SHOTS || require("path").join(__dirname, "shots"); fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || "http://127.0.0.1:3000/";
const log = []; const ok = (c, m) => { log.push((c ? "OK   " : "FALLA ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const br = await chromium.launch();
  const mk = async (w = 390, h = 844) => { const c = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const p = await c.newPage(); p.on("pageerror", (e) => log.push("PAGEERROR " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_(NAME|INTERNET|CONNECTION|FAILED)/.test(m.text())) log.push("CONSOLE " + m.text()); }); return p; };
  const entrar = async (p, email) => { await p.goto(URL); await p.click(`button:has(span:text-is("${email[1]}"))`); await p.waitForSelector(".nav", { timeout: 8000 }); };
  const DEM = { ger: ["gerente", "Roberto Salinas"], sm: ["sup", "Luis Treviño"], om: ["op", "Jorge Castillo"], sol: ["sol", "Daniela Cantú"] };

  // --- solicitante crea reporte con foto
  let p = await mk();
  await p.goto(URL);
  await p.screenshot({ path: OUT + "/01-login.png" });
  await p.click('button:has(span:text-is("Daniela Cantú"))'); await p.waitForSelector(".nav");
  ok((await p.locator(".nav a").count()) === 3, "solicitante ve 3 tabs");
  const n0 = await p.locator(".orden").count();
  ok(n0 > 0, "solicitante ve sus reportes (" + n0 + ")");
  await p.screenshot({ path: OUT + "/02-sol-lista.png" });
  await p.click('.nav a.centro'); await p.waitForSelector("form");
  await p.selectOption("select >> nth=0", { label: "Alberca" });
  await p.fill('input[type=text]', "Andén lado profundo");
  await p.selectOption("select >> nth=1", { label: "Plomería" });
  await p.fill("textarea", "Fuga de agua en la regadera exterior de la alberca.");
  await p.click('.seg button:text-is("Alta")');
  await p.check('.check input');
  const img = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
  await p.setInputFiles('input[type=file]', { name: "f.jpg", mimeType: "image/jpeg", buffer: img });
  await p.waitForSelector(".prev img");
  await p.screenshot({ path: OUT + "/03-reportar.png", fullPage: true });
  await p.click('button:text-is("Enviar reporte")');
  await p.waitForSelector(".toast", { timeout: 8000 });
  const t1 = await p.textContent(".toast"); ok(/MAN-\d+/.test(t1) && /Mantenimiento/.test(t1), "folio MAN y ruta a mantenimiento: " + t1);
  await p.waitForSelector(".timeline"); 
  ok((await p.locator(".fotos img").count()) === 1, "foto visible en detalle");
  ok((await p.locator('button:text-is("Reabrir")').count()) === 0, "solicitante sin acciones de supervisor");
  const folio = (t1.match(/MAN-\d+/) || [])[0];
  const url = p.url();
  await p.screenshot({ path: OUT + "/04-detalle-sol.png", fullPage: true });
  await p.context().close();

  // --- supervisor asigna
  p = await mk(); await p.goto(URL); await p.click('button:has(span:text-is("Luis Treviño"))'); await p.waitForSelector(".nav");
  await p.fill('input[type=search]', folio);
  await p.waitForSelector(".orden"); await p.screenshot({ path: OUT + "/05-sup-bandeja.png" });
  await p.click(".orden"); await p.waitForSelector(".card.verde");
  const ops = await p.locator("select option").allTextContents();
  ok(ops.includes("Jorge Castillo") && !ops.some((x) => /Rosa|Patricia/.test(x)), "supervisor solo ve operativos de su área");
  await p.selectOption(".card.verde select", { label: "Jorge Castillo" });
  await p.fill(".card.verde textarea", "Atender hoy, hay socios cerca.");
  await p.click('button:text-is("Asignar")'); await p.waitForSelector('.badge.b-asignada');
  ok(true, "orden asignada");
  await p.context().close();

  // --- operativo trabaja
  p = await mk(); await p.goto(URL); await p.click('button:has(span:text-is("Jorge Castillo"))'); await p.waitForSelector(".nav");
  await p.fill('input[type=search]', folio); await p.waitForSelector(".orden");
  await p.click(".orden"); await p.waitForSelector(".card.verde");
  ok((await p.locator('button:text-is("Cerrar orden")').count()) === 0, "operativo no puede cerrar");
  await p.click('button:text-is("Iniciar / reanudar")'); await p.waitForSelector('.badge.b-en_proceso');
  await p.fill(".card.verde textarea", "Cambié el empaque, queda probado.");
  await p.click('button:text-is("Marcar resuelta")'); await p.waitForSelector('.badge.b-resuelta');
  await p.screenshot({ path: OUT + "/06-op-detalle.png", fullPage: true });
  await p.context().close();

  // --- supervisor cierra
  p = await mk(); await p.goto(URL); await p.click('button:has(span:text-is("Luis Treviño"))'); await p.waitForSelector(".nav");
  await p.click('.chip:has-text("Por cerrar")'); await p.fill('input[type=search]', folio); await p.click(".orden"); await p.waitForSelector('button:text-is("Cerrar orden")');
  await p.click('button:text-is("Cerrar orden")'); await p.waitForSelector('.badge.b-cerrada');
  ok((await p.locator(".timeline li").count()) >= 5, "historial completo (" + (await p.locator(".timeline li").count()) + " eventos)");
  await p.context().close();

  // --- gerente
  p = await mk(); await p.goto(URL); await p.click('button:has(span:text-is("Roberto Salinas"))'); await p.waitForSelector(".kpis");
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + "/07-ger-dashboard-movil.png", fullPage: true });
  ok((await p.locator(".nav a").count()) === 4 && (await p.locator(".nav a.centro").count()) === 0, "gerente: 4 tabs, sin Reportar");
  await p.goto(URL + "#/ordenes"); await p.waitForSelector(".orden"); await p.click(".orden"); await p.waitForSelector(".kv");
  ok((await p.locator(".card.verde").count()) === 0, "gerente sin acciones en detalle");
  await p.goto(URL + "#/qr"); await p.waitForSelector(".qrc img"); await p.screenshot({ path: OUT + "/08-qr.png" });
  ok((await p.locator(".qrc").count()) === 14, "14 QR por zona");
  await p.context().close();
  p = await mk(1280, 800); await p.goto(URL); await p.click('button:has(span:text-is("Roberto Salinas"))'); await p.waitForSelector(".kpis"); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + "/09-ger-dashboard-desktop.png", fullPage: true });
  await p.goto(URL + "#/ordenes"); await p.waitForSelector(".orden"); await p.screenshot({ path: OUT + "/10-ger-lista-desktop.png" });
  await p.context().close();

  // --- QR: abre el formulario con zona prellenada
  p = await mk(); const tok = (await (await fetch(URL + "__prueba/qr?zona=Gimnasio")).json()).qr_token;
  await p.goto(URL + "?zona=" + tok); await p.click('button:has(span:text-is("Mauricio Leal"))'); await p.waitForSelector("textarea");
  ok((await p.inputValue("select >> nth=0")) !== "", "QR prellena la zona");
  await p.screenshot({ path: OUT + "/11-qr-prefill.png" });
  await br.close();
  console.log(log.join("\n"));
})().catch((e) => { console.log(log.join("\n")); console.error("ERROR", e.message); process.exit(1); });
