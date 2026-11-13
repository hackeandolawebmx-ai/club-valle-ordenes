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
pres.title = "Club Valle · Aplicación a la medida";
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
    { text: { text: "Propuesta iActiva · Aplicación a la medida para Club Valle", options: { x: 0.6, y: 6.98, w: 8, h: 0.3, fontSize: 10, color: C.accent4, margin: 0, isTextBox: true } } },
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
  // =====================================================================
  // SLIDE 1 · Mapa de módulos (visión)
  // =====================================================================
  pres.addSection({ title: "Propuesta" });
  const s0 = pres.addSlide({ masterName: "CV_CONTENIDO", sectionTitle: "Propuesta" });
  s0.addText("01 · LA VISIÓN", { placeholder: "eyebrow" });
  s0.addText("Una aplicación hecha a la medida del club, que crece módulo por módulo", { placeholder: "title" });
  s0.addText("No son módulos que ya existan: los desarrollamos para Club Valle, empezando por lo más urgente.", { placeholder: "lead" });
  const ST = {
    v: { fill: "31674F", line: "31674F", text: "FFFFFF", tag: "Hoy", tagColor: "FFFFFF" },
    a: { fill: "F2C94C", line: "F2C94C", text: "22352C", tag: "Fase 2", tagColor: "22352C" },
    f: { fill: "C7E3CB", line: "5FA880", text: "22352C", tag: "Fase 3", tagColor: "31674F" },
    g: { fill: "E7E4D8", line: "D6D2C2", text: "5A6B62", tag: "", tagColor: "5A6B62" },
  };
  const bloques = [
    ["Operación", [["Mantenimiento e intendencia", "v"], ["Mantenimiento preventivo", "f"], ["Compras e inventario", "g"], ["Seguridad y accesos", "g"]]],
    ["Experiencia del socio", [["Asistente de WhatsApp", "a"], ["Asistente de voz por teléfono", "a"], ["Canchas de tenis y pádel", "f"], ["Eventos y salones", "f"], ["Pedidos con QR", "f"]]],
    ["Administración", [["Membresías y registro de socios", "g"], ["Personal y turnos", "g"], ["Comunicados a socios", "g"]]],
    ["Finanzas", [["Pago a la cuenta del socio", "f"], ["Cobranza", "g"], ["Facturación", "g"], ["Presupuesto y gastos", "g"]]],
  ];
  const mw = 2.9, mgap = 0.167, my = 2.95;
  bloques.forEach(([bn, items], bi) => {
    const x = 0.6 + bi * (mw + mgap);
    s0.addText(bn.toUpperCase(), { x, y: my, w: mw, h: 0.34, fontSize: 12, bold: true, charSpacing: 2, color: C.accent1, valign: "middle", margin: 0, isTextBox: true, objectName: `Bloque ${bn}` });
    s0.addShape(pres.shapes.LINE, { x, y: my + 0.36, w: mw, h: 0, line: { color: C.accent1, width: 1.25 }, objectName: `Bloque ${bn} línea` });
    items.forEach(([name, st], ii) => {
      const z = ST[st], y = my + 0.48 + ii * 0.62;
      s0.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: mw, h: 0.54, rectRadius: 0.06, fill: { color: z.fill }, line: { color: z.line, width: 1 }, objectName: `Módulo ${name}` });
      s0.addText(name, { x: x + 0.14, y, w: z.tag ? 1.95 : mw - 0.28, h: 0.54, fontSize: 12, bold: st !== "g", color: z.text, valign: "middle", margin: 0, isTextBox: true, objectName: `Módulo ${name} texto` });
      if (z.tag) s0.addText(z.tag, { x: x + mw - 0.85, y, w: 0.72, h: 0.54, fontSize: 11, bold: true, color: z.tagColor, align: "right", valign: "middle", margin: 0, isTextBox: true, objectName: `Módulo ${name} fase` });
    });
  });
  const leyenda = [["v", "Propuesta de hoy: piloto"], ["a", "Fase 2: asistentes de WhatsApp y voz"], ["f", "Fase 3: módulos a elegir"], ["g", "Fuera de esta propuesta"]];
  const lw = [2.6, 3.9, 3.0, 2.5]; let lx = 0.6;
  leyenda.forEach(([st, txt], i) => {
    const z = ST[st];
    s0.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx, y: 6.52, w: 0.3, h: 0.22, rectRadius: 0.04, fill: { color: z.fill }, line: { color: z.line, width: 1 }, objectName: `Leyenda ${i + 1} color` });
    s0.addText(txt, { x: lx + 0.4, y: 6.47, w: lw[i] - 0.45, h: 0.32, fontSize: 12, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `Leyenda ${i + 1} texto` });
    lx += lw[i];
  });
  s0.addNotes(
    "Mensaje: lo que se propone no es comprar un producto que ya existe, es desarrollar una aplicación a la medida del club, módulo por módulo. " +
    "El mapa muestra los bloques que un club suele necesitar: operación, experiencia del socio, administración y finanzas. " +
    "En verde está lo que se propone aprobar hoy: mantenimiento e intendencia. " +
    "En amarillo, la fase 2: asistentes de WhatsApp y de voz por teléfono para socios, externos y recepción. " +
    "En verde claro, los módulos posibles para una fase 3, que el club elige según su prioridad. " +
    "En gris, lo que un club suele tener y hoy no se propone tocar. " +
    "El orden y el alcance de cada fase se definen con el club; solo se pide aprobar la primera."
  );

  const s1 = pres.addSlide({ masterName: "CV_CONTENIDO", sectionTitle: "Propuesta" });
  s1.addText("02 · PRIMER MÓDULO", { placeholder: "eyebrow" });
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
  s1.addImage({ path: path.join(__dirname, "hero_plataforma.png"), x: 5.43, y: 2.85, w: 7.3, h: 7.3 * 1560 / 2918, altText: "Captura de la plataforma: tablero del gerente en computadora, y formulario de reporte y detalle de una orden en el celular", objectName: "Capturas de la plataforma" });
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
  s2.addText("03 · PLAN E INVERSIÓN", { placeholder: "eyebrow" });
  s2.addText("Un piloto de 90 días para empezar a medir con datos del propio club", { placeholder: "title" });
  s2.addText("Se solicita al consejo aprobar el piloto de mantenimiento e intendencia.", { placeholder: "lead" });

  const recibe = [
    "App web y móvil, con QR por zona del club",
    "Órdenes con folio, foto, prioridad e historial",
    "Roles: gerente, supervisor, operativo y solicitante",
    "Tablero para gerencia",
    "Puesta en marcha: zonas, categorías y usuarios",
    "Hosting y soporte incluidos",
  ];
  const gana = [
    "Ninguna falla se pierde: queda con foto, responsable e historial",
    "Gerencia ve qué está abierto, desde cuándo y quién lo atiende",
    "Se atiende primero lo que afecta a los socios",
    "Fallas reincidentes por zona: reparar o reemplazar con datos",
    "Posibles ahorros: atender a tiempo antes de que escale y menos coordinación por mensajes. Se cuantifican con los datos del piloto",
  ];
  [["LO QUE RECIBE EL CLUB", recibe, 0.6], ["BENEFICIOS Y AHORROS", gana, 3.95]].forEach(([head, items, x], ci) => {
    const w = 3.2, y = 2.95, h = 3.9;
    s2.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.background1 }, line: { color: C.background1, width: 0 }, shadow: cardShadow(), objectName: `Tarjeta ${head}` });
    s2.addText(head, { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: C.accent1, margin: 0, isTextBox: true, objectName: `Etiqueta ${head}` });
    s2.addText(
      items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6 } })),
      { x: x + 0.25, y: y + 0.65, w: w - 0.5, h: h - 0.85, fontSize: 12, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Lista ${head}` }
    );
  });

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
    "Lo que recibe el club: la aplicación web y móvil con QR por zona, órdenes con folio, foto, prioridad e historial, los cuatro roles, el tablero para gerencia, la puesta en marcha y hosting y soporte. " +
    "Beneficios: ninguna falla se pierde, la gerencia ve el estado real, se prioriza lo que afecta a los socios y se detectan fallas reincidentes. " +
    "Sobre los ahorros: no se prometen cifras; hoy el club no mide tiempos ni costos de atención, y el piloto da la primera línea base con datos reales para cuantificarlos. " +
    "Inversión: $35,000 de implementación única y $5,500 mensuales; el piloto de 3 meses suma $51,500 más IVA ($59,740 con IVA). Todo en pesos mexicanos. " +
    "Las fases 2 y 3 del mapa son una oportunidad, no un compromiso, y se cotizan aparte. " +
    "Condiciones de lanzamiento (para conversar, no en la slide): si se contrata el año al cerrar el piloto, se acredita el 50% de la implementación contra la primera anualidad, vigente 30 días después del piloto. " +
    "Los datos son del club y se pueden exportar en cualquier momento."
  );


  // =====================================================================
  // SLIDE 3 · Anexo: siguientes fases
  // =====================================================================
  const fa = require("react-icons/fa");
  pres.addSection({ title: "Anexo" });
  const s3 = pres.addSlide({ masterName: "CV_CONTENIDO", sectionTitle: "Anexo" });
  s3.addText("ANEXO · FASES 2 Y 3", { placeholder: "eyebrow" });
  s3.addText("Detalle de los módulos siguientes", { placeholder: "title" });
  s3.addText("Cada módulo se desarrolla a la medida y reutiliza usuarios, roles y QR por zona.", { placeholder: "lead" });
  const mods = [
    [fa.FaWhatsapp, "Asistente de WhatsApp", "Socios y recepción consultan, dejan recados y reportan fallas con foto.", "Fase 2 · cotización aparte"],
    [fa.FaPhoneAlt, "Asistente de voz por teléfono", "Atiende llamadas de socios y externos: informa, agenda y toma recados.", "Fase 2 · mismo agente"],
    [fa.FaQrcode, "Pedidos con QR", "Comedor, snack y alberca: el socio pide desde su mesa o camastro.", "Fase 3 · cotización aparte"],
    [fa.FaTableTennis, "Canchas de tenis y pádel", "Reserva por horario, con reglas por membresía y lista de espera.", "Fase 3 · se define junto a la app de socios"],
    [fa.FaCalendarCheck, "Reserva de eventos y salones", "Solicitud, disponibilidad, cotización y montaje como orden de servicio.", "Fase 3 · reutiliza las órdenes"],
    [fa.FaTools, "Mantenimiento preventivo", "Rutinas por zona y equipo: alberca, aire acondicionado, gimnasio.", "Fase 3 · calendario automático"],
  ];
  const gx = 0.6, gy = 2.95, cw = 3.9, ch = 1.8, gap = 0.215, gv = 0.15;
  for (let i = 0; i < mods.length; i++) {
    const [Ic, head, desc, tag] = mods[i];
    const x = gx + (i % 3) * (cw + gap), y = gy + Math.floor(i / 3) * (ch + gv);
    s3.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.background1 }, line: { color: C.background1, width: 0 }, shadow: cardShadow(), objectName: `Módulo ${i + 1} tarjeta` });
    s3.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: C.accent2 }, line: { color: C.accent2, width: 0 }, objectName: `Módulo ${i + 1} círculo` });
    s3.addImage({ data: await icon(Ic, "31674F"), x: x + 0.38, y: y + 0.38, w: 0.24, h: 0.24, altText: head, objectName: `Módulo ${i + 1} ícono` });
    s3.addText(head, { x: x + 0.9, y: y + 0.25, w: cw - 1.1, h: 0.5, fontSize: 16, bold: true, fontFace: "Cambria", color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `Módulo ${i + 1} título` });
    s3.addText(desc, { x: x + 0.25, y: y + 0.88, w: cw - 0.5, h: 0.5, fontSize: 13, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Módulo ${i + 1} detalle` });
    s3.addText(tag, { x: x + 0.25, y: y + 1.4, w: cw - 0.5, h: 0.28, fontSize: 12, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: `Módulo ${i + 1} etiqueta` });
  }
  s3.addNotes(
    "Slide de anexo: para responder preguntas del consejo; no es parte de la solicitud de aprobación. " +
    "Todo se desarrolla a la medida del club sobre lo mismo: usuarios, roles y QR por zona. " +
    "Pedidos con QR se cotiza aparte; el pago a la cuenta del socio, que aparece en el mapa, depende de integrarse con el sistema de cobranza. " +
    "Canchas y eventos: la app de socios ya cubre parte de las reservas, así que antes de construir se define si conviene complementar o integrarse, sin duplicar. " +
    "El asistente de WhatsApp atiende a socios y a recepción o administración. El asistente de voz usa el mismo agente por teléfono: contesta llamadas de socios y de externos, informa horarios, costos y membresías, agenda visitas, toma recados y transfiere a recepción. Tiene costo variable por minuto de llamada y avisa que la llamada se graba. El preventivo aprovecha los datos que deje el piloto."
  );

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("OK", OUT);
})();
