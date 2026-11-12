const pptxgen = require("pptxgenjs");
const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { applyTheme } = require("/root/.claude/skills/synced/be39c804-b8a5-495d-8147-e50f7e093f7a_f3fafb9a-d3ba-4ade-90c0-4f1b72c76593/pptx/scripts/apply_theme.js");

const OUT = path.join(__dirname, "Club_Valle_Propuesta_Consejo.pptx");
const LOGO = path.join(__dirname, "..", "brand", "logo-horizontal-verde-oak-transparente.png");

// ---------- Tema (colores oficiales del Brand Brochure de Club Valle) ----------
const THEME = {
  name: "Club Valle",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "22352C",      // texto principal (verde casi negro)
    lt1: "FFFFFF",      // tarjetas
    dk2: "31674F",      // Verde OAK
    lt2: "F5F1E5",      // Beige Sparkling (fondo)
    accent1: "31674F",  // Verde OAK
    accent2: "C7E3CB",  // Verde 1955
    accent3: "5FA880",  // verde menta de la app (aprox.)
    accent4: "5A6B62",  // texto secundario
    accent5: "A8553F",
    accent6: "E7DFC9",
    hlink: "31674F",
    folHlink: "5A6B62",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Club Valle · Propuesta de herramienta de mantenimiento";
pres.author = "iActiva";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- Íconos ----------
async function icon(Comp, hex) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const cardShadow = () => ({ type: "outer", color: "000000", opacity: 0.10, blur: 8, offset: 2, angle: 90 });

// ---------- Layout ----------
pres.defineSlideMaster({
  title: "CV_CONTENIDO",
  background: { color: C.background2 },
  margin: [0.5, 0.6, 0.5, 0.6],
  objects: [
    { image: { x: 10.0, y: 0.38, w: 2.75, h: 2.75 / 4.7913, path: LOGO, altText: "Logo de Club Valle" } },
    { text: { text: "Propuesta iActiva · Mantenimiento e intendencia", options: { x: 0.6, y: 6.98, w: 8, h: 0.3, fontSize: 10, color: C.accent4, margin: 0, isTextBox: true } } },
    {
      placeholder: {
        options: { name: "eyebrow", type: "body", x: 0.6, y: 0.5, w: 8.5, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: C.accent1, margin: 0 },
        text: "",
      },
    },
    {
      placeholder: {
        options: { name: "title", type: "title", x: 0.6, y: 0.95, w: 12.1, h: 1.3, fontSize: 36, bold: true, color: C.text1, align: "left", valign: "top", margin: 0 },
        text: "",
      },
    },
    {
      placeholder: {
        options: { name: "lead", type: "body", x: 0.6, y: 2.3, w: 12.1, h: 0.45, fontSize: 16, color: C.accent4, valign: "top", margin: 0 },
        text: "",
      },
    },
  ],
  slideNumber: { x: 12.2, y: 6.98, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
});

(async () => {

  // =====================================================================
  // SLIDE 1 · Reto y propuesta
  // =====================================================================
  pres.addSection({ title: "Propuesta" });
  const s1 = pres.addSlide({ masterName: "CV_CONTENIDO", sectionTitle: "Propuesta" });
  s1.addText("01 · LA PROPUESTA", { placeholder: "eyebrow" });
  s1.addText("Mantenimiento e intendencia en una sola herramienta", { placeholder: "title" });
  s1.addText("Hoy no contamos con una plataforma para levantar y dar seguimiento a las fallas de cada zona del club.", { placeholder: "lead" });

  const steps = [
    ["1", "Reporta", "QR por zona, foto y prioridad"],
    ["2", "Asigna", "El supervisor elige al operativo"],
    ["3", "Atiende", "El operativo actualiza con evidencia"],
    ["4", "Cierra", "Solo el supervisor cierra la orden"],
    ["5", "Mide", "Dashboard para gerencia"],
  ];
  const rowH = 0.66, y0 = 2.95;
  steps.forEach(([n, head, desc], i) => {
    const y = y0 + i * rowH;
    if (i < steps.length - 1) {
      s1.addShape(pres.shapes.LINE, { x: 0.81, y: y + 0.42, w: 0, h: rowH - 0.42, line: { color: C.accent2, width: 2 }, objectName: `Conector ${n}` });
    }
    s1.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: `Paso ${n} círculo` });
    s1.addText(n, { x: 0.6, y, w: 0.42, h: 0.42, align: "center", valign: "middle", fontSize: 14, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: `Paso ${n} número` });
    s1.addText(head, { x: 1.2, y: y - 0.04, w: 3.7, h: 0.28, fontSize: 16, bold: true, fontFace: "Cambria", color: C.text1, margin: 0, isTextBox: true, objectName: `Paso ${n} título` });
    s1.addText(desc, { x: 1.2, y: y + 0.22, w: 3.7, h: 0.26, fontSize: 13, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Paso ${n} detalle` });
  });
  s1.addText("Complementa la app de socios: no la sustituye ni la modifica.", { x: 0.6, y: 6.32, w: 4.5, h: 0.5, fontSize: 12, italic: true, color: C.accent4, valign: "top", margin: 0, isTextBox: true, objectName: "Nota complementa" });
  s1.addImage({ path: path.join(__dirname, "hero_plataforma.png"), x: 5.43, y: 2.85, w: 7.3, h: 7.3 * 1560 / 2920, altText: "Captura de la plataforma: tablero del gerente en computadora, y formulario de reporte y detalle de una orden en el celular", objectName: "Capturas de la plataforma" });
  s1.addNotes(
    "Mensaje: hoy no hay una plataforma para reportar y dar seguimiento a las fallas del club. " +
    "Lo que se propone es una herramienta adicional, que no toca la app de socios. " +
    "Recorrer los cinco pasos: cualquiera del personal reporta escaneando el QR de la zona; el supervisor del área asigna; " +
    "el operativo atiende y deja evidencia; solo el supervisor cierra; y la gerencia ve todo en un tablero. " +
    "Las capturas son de la plataforma funcionando con datos de demostración. Subrayar que cada área ve lo suyo y que el gerente solo consulta."
  );

  // =====================================================================
  // SLIDE 2 · Piloto, fases e inversión
  // =====================================================================
  const s2 = pres.addSlide({ masterName: "CV_CONTENIDO", sectionTitle: "Propuesta" });
  s2.addText("02 · PLAN E INVERSIÓN", { placeholder: "eyebrow" });
  s2.addText("Un piloto de 90 días para empezar a medir con datos del propio club", { placeholder: "title" });
  s2.addText("Se solicita al consejo aprobar el piloto de mantenimiento e intendencia.", { placeholder: "lead" });

  const phases = [
    ["1", "Piloto de mantenimiento e intendencia", "90 días, con roles de gerente, supervisor y operativo."],
    ["2", "Pedidos con QR", "Comedor y snack, con la misma infraestructura de QR por zona."],
    ["3", "Pago a la cuenta del socio", "Sujeto a la integración con el sistema de cobranza actual."],
  ];
  phases.forEach(([n, head, desc], i) => {
    const y = 2.95 + i * 0.95;
    s2.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.5, h: 0.5, fill: { color: i === 0 ? C.accent1 : C.accent2 }, line: { color: i === 0 ? C.accent1 : C.accent2, width: 0 }, objectName: `Fase ${n} círculo` });
    s2.addText(n, { x: 0.6, y, w: 0.5, h: 0.5, align: "center", valign: "middle", fontSize: 16, bold: true, color: i === 0 ? C.background1 : C.accent1, margin: 0, isTextBox: true, objectName: `Fase ${n} número` });
    s2.addText(head, { x: 1.35, y: y - 0.02, w: 5.8, h: 0.35, fontSize: 18, bold: true, fontFace: "Cambria", color: C.text1, margin: 0, isTextBox: true, objectName: `Fase ${n} título` });
    s2.addText(desc, { x: 1.35, y: y + 0.36, w: 5.8, h: 0.5, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Fase ${n} detalle` });
  });
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.85, w: 6.55, h: 1.0, rectRadius: 0.08, fill: { color: C.accent2 }, line: { color: C.accent2, width: 0 }, objectName: "Qué mediremos fondo" });
  s2.addText(
    [
      { text: "Qué mediremos al cierre del piloto", options: { bold: true, breakLine: true } },
      { text: "Órdenes abiertas y cerradas, antigüedad, fallas reincidentes por zona y carga por operativo." },
    ],
    { x: 0.85, y: 5.88, w: 6.1, h: 0.94, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "Qué mediremos" }
  );

  // Tarjeta de inversión
  const ix = 7.65, iy = 2.95, iw = 5.05, ih = 3.9;
  s2.addShape(pres.shapes.RECTANGLE, { x: ix, y: iy, w: iw, h: ih, fill: { color: C.background1 }, line: { color: C.background1, width: 0 }, shadow: cardShadow(), objectName: "Tarjeta inversión" });
  s2.addText("INVERSIÓN DEL PILOTO · MXN + IVA", { x: ix + 0.35, y: iy + 0.3, w: iw - 0.7, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: C.accent1, margin: 0, isTextBox: true, objectName: "Inversión etiqueta" });
  const rows = [
    ["Implementación (pago único)", "$35,000"],
    ["Mensualidad × 3 meses ($5,500)", "$16,500"],
  ];
  rows.forEach(([k, v], i) => {
    const ry = iy + 0.78 + i * 0.45;
    s2.addText(k, { x: ix + 0.35, y: ry, w: 3.1, h: 0.4, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `Concepto ${i + 1}` });
    s2.addText(v, { x: ix + 3.4, y: ry, w: iw - 3.75, h: 0.4, fontSize: 14, bold: true, color: C.text1, align: "right", valign: "middle", margin: 0, isTextBox: true, objectName: `Importe ${i + 1}` });
  });
  s2.addText("Total del piloto", { x: ix + 0.35, y: iy + 1.8, w: iw - 0.7, h: 0.3, fontSize: 14, color: C.accent4, margin: 0, isTextBox: true, objectName: "Total etiqueta" });
  s2.addText("$51,500", { x: ix + 0.35, y: iy + 2.08, w: iw - 0.7, h: 0.7, fontSize: 40, bold: true, fontFace: "Cambria", color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: "Total importe" });
  s2.addText("$59,740 con IVA", { x: ix + 0.35, y: iy + 2.78, w: iw - 0.7, h: 0.3, fontSize: 14, color: C.text1, margin: 0, isTextBox: true, objectName: "Total con IVA" });
  s2.addText(
    "La mensualidad incluye hosting, soporte, hasta 15 usuarios del personal y quienes reportan sin límite. Se mantiene fija 12 meses.",
    { x: ix + 0.35, y: iy + 3.12, w: iw - 0.7, h: 0.6, fontSize: 11, color: C.accent4, valign: "top", margin: 0, isTextBox: true, objectName: "Inversión nota" }
  );
  s2.addNotes(
    "Mensaje: se pide aprobar un piloto acotado, no un proyecto grande. " +
    "Hoy el club no mide tiempos de atención; el piloto da la primera línea base con datos reales. " +
    "Las fases 2 y 3 son una oportunidad, no un compromiso: la fase 3 depende de poder integrarse con el sistema de cobranza actual. " +
    "Inversión: $35,000 de implementación única y $5,500 mensuales; el piloto de 3 meses suma $51,500 más IVA ($59,740 con IVA). " +
    "Condiciones de lanzamiento (para conversar, no en la slide): si se contrata el año al cerrar el piloto, se acredita el 50% de la implementación contra la primera anualidad, vigente 30 días después del piloto. " +
    "Los datos son del club y se pueden exportar en cualquier momento."
  );

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("OK", OUT);
})();
