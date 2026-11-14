const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.env.SHOTS || require("path").join(__dirname, "shots"); fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || "http://127.0.0.1:3000/";
const log = []; const ok = (c, m) => { log.push((c ? "OK   " : "FALLA ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const br = await chromium.launch();
  const mk = async (w = 390, h = 844) => { const c = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const p = await c.newPage(); p.on("pageerror", (e) => log.push("PAGEERROR " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_(NAME|INTERNET|CONNECTION|FAILED)/.test(m.text())) log.push("CONSOLE " + m.text()); }); return p; };
  // El personal operativo ya no inicia sesión; el acceso de club pasa por "Soy del club".
  const interno = async (p) => { await p.goto(URL); await p.click('button.opcion:has-text("Soy del club")'); await p.waitForSelector(".demo"); };
  const entrar = async (p, nombre) => { await interno(p); await p.click(`button:has(span:text-is("${nombre}"))`); await p.waitForSelector(".nav", { timeout: 8000 }); };
  const abrir = async (p, folio) => { await p.fill('input[type=search]', folio); await p.waitForSelector(".orden"); await p.click(".orden"); await p.waitForSelector(".kv"); };
  const img = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");

  // --- pantalla de entrada: socio o interno
  let p = await mk();
  await p.goto(URL);
  ok((await p.locator("button.opcion").count()) === 2, "entrada con dos opciones: socio e interno");
  await p.screenshot({ path: OUT + "/01-entrada.png" });
  await p.click('button.opcion:has-text("Soy socio")'); await p.waitForSelector(".wa-previa");
  const href = await p.getAttribute('a:has-text("Abrir WhatsApp")', "href");
  ok(/^https:\/\/wa\.me\/\?text=/.test(href) && decodeURIComponent(href).includes("soy socio del Club Valle"), "socio: mensaje prescrito por WhatsApp (" + href.slice(0, 40) + "…)");
  await p.screenshot({ path: OUT + "/01b-socio-whatsapp.png" });
  await p.click('button:has-text("Volver")'); await p.click('button.opcion:has-text("Soy del club")'); await p.waitForSelector(".demo");
  ok((await p.locator(".demo button").count()) === 8 && (await p.locator('.demo button:has-text("Jorge Castillo")').count()) === 0, "demo: 8 cuentas y ningún operativo");
  await p.screenshot({ path: OUT + "/01c-login-interno.png" });
  await p.context().close();

  // --- solicitante (Alimentos y bebidas) crea reporte con foto
  p = await mk();
  await entrar(p, "Daniela Cantú");
  ok((await p.locator(".nav a").count()) === 3, "solicitante ve 3 tabs");
  const n0 = await p.locator(".orden").count();
  ok(n0 > 0, "solicitante ve sus reportes (" + n0 + ")");
  await p.screenshot({ path: OUT + "/02-sol-lista.png" });
  await p.click('.nav a.centro'); await p.waitForSelector("form");
  await p.selectOption("select >> nth=0", { label: "Gimnasio" });
  await p.fill('input[type=text]', "Sala de pesas, regadera del fondo");
  await p.selectOption("select >> nth=1", { label: "Plomería" });
  await p.fill("textarea", "Fuga de agua en la regadera del gimnasio.");
  await p.click('.seg button:text-is("Alta")');
  await p.check('fieldset >> nth=2 >> input[type=checkbox]');
  await p.setInputFiles('input[type=file]', { name: "f.jpg", mimeType: "image/jpeg", buffer: img });
  await p.waitForSelector(".prev img");
  await p.screenshot({ path: OUT + "/03-reportar.png", fullPage: true });
  await p.click('button:text-is("Enviar reporte")');
  await p.waitForSelector(".toast", { timeout: 8000 });
  const t1 = await p.textContent(".toast"); ok(/MAN-\d+/.test(t1) && /Mantenimiento/.test(t1), "folio MAN y ruta a mantenimiento: " + t1);
  await p.waitForSelector(".timeline");
  ok((await p.locator(".fotos img").count()) === 1, "foto visible en detalle");
  ok((await p.locator('button:text-is("Reabrir")').count()) === 0 && (await p.locator(".card.verde select").count()) === 0, "solicitante sin acciones de supervisor");
  const folio = (t1.match(/MAN-\d+/) || [])[0];
  await p.screenshot({ path: OUT + "/04-detalle-sol.png", fullPage: true });
  await p.context().close();

  // --- supervisor de mantenimiento: asigna a interno, reasigna a externo
  p = await mk(); await entrar(p, "Luis Treviño");
  ok((await p.locator(".nav a").count()) === 5, "supervisor ve 5 tabs");
  await p.screenshot({ path: OUT + "/05-sup-bandeja.png" });
  await abrir(p, folio);
  const ops = await p.locator("#d-op option").allTextContents();
  ok(ops.some((x) => x.startsWith("Jorge Castillo · Técnico electricista")) && ops.some((x) => /Plomería Regio \(externo/.test(x)) && !ops.some((x) => /Rosa|Patricia|Sandra/.test(x)), "asigna a personal interno y externo de su área, no de otras");
  await p.selectOption("#d-op", { label: "Jorge Castillo · Técnico electricista" });
  await p.fill(".card.verde textarea", "Atender hoy, hay socios cerca.");
  await p.click('button:text-is("Asignar")'); await p.waitForSelector('.badge.b-asignada');
  await p.selectOption("#d-op", { label: "Plomería Regio (externo · Plomería Regio S.A.)" }); await p.click('button:text-is("Reasignar")'); await p.waitForSelector(".kv .tag.ext");
  ok(true, "orden reasignada a un externo (etiqueta externo visible)");
  await p.screenshot({ path: OUT + "/06-asignada-externo.png", fullPage: true });

  // --- reasignación a Compras y regreso
  ok((await p.locator('button:text-is("Reasignar área")').isDisabled()), "reasignar área exige motivo");
  await p.selectOption("#d-area", "compras"); await p.fill(".card.verde textarea", "Falta la bomba; hay que comprarla.");
  await p.click('button:text-is("Reasignar área")'); await p.waitForSelector('.kv:has-text("origen: Mantenimiento")');
  ok((await p.locator(".card.verde select#d-op").count()) === 0, "mantenimiento ya no puede asignarla (está en Compras)");
  ok((await p.locator(".timeline li.t-reasignacion").count()) === 1, "reasignación en el historial");
  await p.context().close();

  p = await mk(); await entrar(p, "Héctor Ibarra"); await abrir(p, folio);
  const opsC = await p.locator("#d-op option").allTextContents();
  ok(opsC.some((x) => x.startsWith("Sandra Ochoa")) && !opsC.some((x) => /Jorge|Plomería/.test(x)), "compras asigna solo a su personal");
  await p.selectOption("#d-op", { label: "Sandra Ochoa · Comprador" }); await p.click('button:text-is("Asignar")'); await p.waitForSelector('.badge.b-asignada');
  await p.selectOption("#d-area", "mantenimiento"); await p.fill(".card.verde textarea", "Llegó la bomba; instalar.");
  await p.click('button:text-is("Reasignar área")'); await p.waitForSelector('.toast:has-text("reasignada a Mantenimiento")');
  await p.waitForSelector("h1:has-text('Bandeja de compras')");
  ok(true, "al devolver la orden, compras vuelve a su bandeja");
  await p.screenshot({ path: OUT + "/07-compras-regresa.png", fullPage: true });
  await p.context().close();

  // --- el supervisor lleva el trabajo y cierra
  p = await mk(); await entrar(p, "Luis Treviño"); await abrir(p, folio);
  await p.selectOption("#d-op", { label: "Jorge Castillo · Técnico electricista" }); await p.click('button:text-is("Asignar")'); await p.waitForSelector('.badge.b-asignada');
  await p.click('button:text-is("Iniciar / reanudar")'); await p.waitForSelector('.badge.b-en_proceso');
  await p.fill(".card.verde textarea", "Jorge terminó, queda probado.");
  await p.click('button:text-is("Marcar resuelta")'); await p.waitForSelector('.badge.b-resuelta');
  await p.click('button:text-is("Cerrar orden")'); await p.waitForSelector('.badge.b-cerrada');
  ok((await p.locator(".timeline li").count()) >= 10, "historial completo (" + (await p.locator(".timeline li").count()) + " eventos)");
  await p.screenshot({ path: OUT + "/08-sup-cierra.png", fullPage: true });
  await p.context().close();

  // --- reporte repetido: aviso al solicitante y cierre por duplicado
  p = await mk(); await entrar(p, "Mauricio Leal");
  await p.click('.nav a.centro'); await p.waitForSelector("form");
  await p.selectOption("select >> nth=0", { label: "Canchas de pádel" }); await p.selectOption("select >> nth=1", { label: "Albañilería y pintura" });
  await p.fill("textarea", "La grieta del muro de la cancha 2 sigue creciendo.");
  await p.waitForSelector(".aviso-rep");
  ok(/MAN-00028/.test(await p.textContent(".aviso-rep")), "aviso de reporte repetido muestra la orden abierta MAN-00028");
  ok(await p.locator('button:text-is("Enviar reporte")').isDisabled(), "no se envía sin confirmar que es otra falla");
  await p.screenshot({ path: OUT + "/09-aviso-repetido.png", fullPage: true });
  await p.check(".aviso-rep input"); await p.click('button:text-is("Enviar reporte")');
  await p.waitForSelector(".toast"); const t2 = await p.textContent(".toast"); const folio2 = (t2.match(/MAN-\d+/) || [])[0];
  await p.context().close();
  p = await mk(); await entrar(p, "Luis Treviño"); await abrir(p, folio2);
  await p.waitForSelector(".card.dup");
  await p.screenshot({ path: OUT + "/10-posibles-duplicados.png", fullPage: true });
  await p.click('button:text-is("Es repetido de MAN-00028")'); await p.waitForSelector(".aviso-dup");
  ok(/MAN-00028/.test(await p.textContent(".aviso-dup")) && (await p.locator(".badge.b-cerrada").count()) === 1, "cerrada por reporte repetido, señalando MAN-00028");
  await p.screenshot({ path: OUT + "/11-cerrada-duplicado.png", fullPage: true });
  await p.goto(URL + "#/orden/28"); await p.waitForSelector(".timeline");
  ok((await p.locator('.timeline:has-text("Se cerró ' + folio2 + '")').count()) === 1, "la orden original registra el duplicado");
  // equipo: el supervisor agrega un externo
  await p.click('.nav a:has-text("Equipo")'); await p.waitForSelector(".org-area.mia");
  await p.fill("#e-nom", "Electricista de prueba"); await p.click('.nuevo-personal button:text-is("Externo")'); await p.fill("#e-emp", "Eléctrica del Norte");
  await p.click('.nuevo-personal button:text-is("Agregar")'); await p.waitForSelector('.persona:has-text("Electricista de prueba")');
  ok(true, "supervisor agrega personal externo en su área");
  await p.screenshot({ path: OUT + "/12-equipo-sup.png", fullPage: true });
  await p.context().close();

  // --- gerente
  p = await mk(); await entrar(p, "Roberto Salinas"); await p.waitForSelector(".kpis");
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + "/13-ger-dashboard-movil.png", fullPage: true });
  ok((await p.locator(".nav a").count()) === 5 && (await p.locator(".nav a.centro").count()) === 0, "gerente: 5 tabs, sin Reportar");
  await p.goto(URL + "#/ordenes"); await p.waitForSelector(".orden"); await p.click(".orden"); await p.waitForSelector(".kv");
  ok((await p.locator(".card.verde").count()) === 0, "gerente sin acciones en detalle");
  await p.goto(URL + "#/equipo"); await p.waitForSelector(".org-area");
  ok((await p.locator(".org-area").count()) === 3 && (await p.locator(".depto").count()) === 4 && (await p.locator('.depto:has-text("Seguridad")').count()) === 1, "organigrama: 3 áreas y 4 departamentos (incluye Seguridad)");
  ok((await p.locator('.nuevo-personal').count()) === 0, "gerente no edita personal");
  await p.screenshot({ path: OUT + "/14-equipo-ger.png", fullPage: true });
  await p.goto(URL + "#/qr"); await p.waitForSelector(".qrc img"); await p.screenshot({ path: OUT + "/15-qr.png" });
  ok((await p.locator(".qrc").count()) === 14, "14 QR por zona");
  await p.context().close();
  p = await mk(1280, 800); await entrar(p, "Roberto Salinas"); await p.waitForSelector(".kpis"); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + "/16-ger-dashboard-desktop.png", fullPage: true });
  await p.goto(URL + "#/equipo"); await p.waitForSelector(".org-area"); await p.screenshot({ path: OUT + "/17-equipo-desktop.png", fullPage: true });
  await p.context().close();

  // --- Seguridad reporta
  p = await mk(); await entrar(p, "Sergio Lozano"); await p.waitForSelector(".orden");
  ok((await p.locator(".orden").count()) >= 1, "Seguridad es un departamento que reporta (ve sus reportes)");
  await p.context().close();

  // --- QR: abre el formulario con zona prellenada
  p = await mk(); const tok = (await (await fetch(URL + "__prueba/qr?zona=Gimnasio")).json()).qr_token;
  await p.goto(URL + "?zona=" + tok); await p.click('button.opcion:has-text("Soy del club")'); await p.click('button:has(span:text-is("Mauricio Leal"))'); await p.waitForSelector("textarea");
  ok((await p.inputValue("select >> nth=0")) !== "", "QR prellena la zona");
  await p.screenshot({ path: OUT + "/18-qr-prefill.png" });
  await br.close();
  console.log(log.join("\n"));
})().catch((e) => { console.log(log.join("\n")); console.error("ERROR", e.message); process.exit(1); });
