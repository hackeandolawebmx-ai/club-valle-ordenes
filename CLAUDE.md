# Club Valle · Órdenes de servicio (demo de iActiva)

Prospecto de iActiva: club deportivo (~600 socios con familias). Herramienta web para reportar y atender fallas de **mantenimiento** e **intendencia** (intendencia/limpieza es parte del área de Mantenimiento del club; también hay **Compras** como área de apoyo). Complementa la app de socios del club; no la sustituye. **No nombrar al proveedor de esa app en material para el cliente.**

Dueño: Daniel (iActiva). Escribir siempre en español, de tú, directo, sin emojis. No enviar correos ni mensajes en su nombre: solo borradores.

## Estado
- App publicada: https://club-valle-ordenes.vercel.app (Vercel, deploy automático desde `main`; framework Other, `npm run build`, salida `dist`).
- Supabase: proyecto `club-valle-demo`, ref `ltqqbmidaukuegclytvt`, us-east-1, plan gratuito. La llave publicable va en `public/config.js` (es segura en el navegador). Nunca poner service_role en el repo.
- Fechas clave: demo para el gerente general lunes 16 / martes 17 nov 2026; primera sesión del consejo miércoles 18 nov, 18:00 (se presenta con 2 slides y un video corto, no demo en vivo).

## Arquitectura
- Front: Preact + htm + supabase-js, bundle con esbuild a `dist/` (`npm run build`). Rutas por hash. Móvil primero, barra inferior con botón central "Reportar", y menú lateral verde en escritorio.
- Código: `src/main.js` (sesión, datos compartidos, rutas y navegación), `src/lib.js` (cliente de Supabase, catálogos, utilidades y permisos de pantalla), `src/ui.js` (iconos y piezas compartidas), `src/views/` (una pantalla por archivo: login, ordenes, detalle, reportar, dashboard, qr, cuenta) y `src/styles.css` (tokens de diseño al inicio).
- Los scripts de prueba y de video dependen de clases y textos de la interfaz (`.nav a`, `.orden`, `.card.verde`, `.badge.b-<estatus>`, `.kpis`, `.qrc`, `.demo`, `.seg button`, `.chip`, textos de botones). Si los cambias, corre `npm run test:e2e` y revisa `test/video.cjs`.
- Datos y permisos viven en Postgres (RLS + funciones SECURITY DEFINER), no en la pantalla. Migraciones en `supabase/migrations` (0001 modelo, 0002 fotos, 0003 cierre de funciones auxiliares, 0004 enums compras/seguridad/reasignación, 0005 personal, reasignación de área y duplicados, 0006 el gerente administra personal). Ya aplicadas en Supabase; cualquier cambio nuevo va como migración nueva.
- Nadie escribe directo en `ordenes` ni `orden_eventos`. Todo cambio pasa por RPC: `crear_orden`, `asignar_orden`, `cambiar_estatus`, `comentar_orden`, `reasignar_area`, `cerrar_por_duplicado`, `agregar_personal`, `guardar_personal` (alta/edición, gerente o supervisor), `activar_personal`; y `ordenes_similares` (consulta de avisos). Vista `v_ordenes` con `security_invoker = true`. Fotos en el bucket privado `orden-fotos` (ruta `<orden_id>/<archivo>`) y tabla `orden_fotos`.

## Roles y reglas
- **Quienes inician sesión:** gerente, supervisor y solicitante. El personal operativo **ya no es usuario**: vive en la tabla `personal` (internos y externos, con puesto y zona asignada) y lo gestiona su supervisor.
- **Gerente** (de Mantenimiento en el club): lee dashboard y todas las órdenes, y **administra el personal de todas las áreas** en Equipo (alta, edición, baja con historial; no se da de baja ni se cambia de área a quien tenga órdenes abiertas). No asigna, no cambia estatus, no comenta, no sube fotos.
- **Supervisor** (mantenimiento: 2, intendencia: 1, compras: 1): ve y gestiona solo su área (y sigue viendo lo que nació en ella aunque se reasigne); asigna a personal de su área, interno o externo; cambia el estatus según le reporte su personal; es quien cierra o reabre; reasigna la orden a otra área con motivo (p. ej. a Compras); cierra reportes repetidos señalando la orden original; administra su personal.
- **Solicitante** (departamento: alimentos y bebidas, deportes, administración, **seguridad**): levanta reportes y ve solo los suyos. Si ya hay una orden abierta igual (misma zona y tipo, 30 días) la pantalla de reporte avisa y pide confirmar que es otra falla.
- **Socios:** no tienen cuenta. La entrada ofrece "Soy socio" (mensaje prescrito por WhatsApp; número en `CFG.wa` de `public/config.js`: 528112489368) o "Soy del club" (login).
- Flujo: nueva → asignada → en proceso ↔ en espera → resuelta → cerrada. Cierre por reporte repetido: cerrada con `cierre_motivo = duplicado` y folio original. Folios MAN-00001 / INT-00002 (la reasignación conserva el folio). No hay SLA ni medición de tiempos por ahora.
- La interfaz espeja las reglas, pero el servidor decide. Si cambias una regla, cambia la RLS/RPC y agrega prueba en `supabase/tests/prueba_permisos.sql` (`npm run test:permisos`).

## Datos de demo
- `supabase/seed/seed_demo.sql` (re-ejecutable): 9 usuarios ficticios, 14 zonas, 12 categorías, 54 órdenes con historial (una reasignada a Compras y dos reportes repetidos), fechas relativas a hoy. **Borra las órdenes existentes.** Correr de nuevo el lunes 16 antes de grabar o presentar.
- Cuentas `@clubvalle-demo.test`, contraseña común `Valle2026!`: gerente, sup.mant, sup.mant2, sup.int, sup.compras, sol.ayb, sol.dep, sol.adm, sol.seg. Los usuarios (gerente, supervisores, solicitantes) son ficticios.
- **Personal real:** desde el 14 nov la tabla `personal` de producción tiene las 27 personas reales del listado del club (mantenimiento 11, intendencia 16; Compras sin personal). Nombres reales NO van en el repo: el SQL de carga es local (`supabase/seed/personal_real.sql`, en .gitignore). El seed solo siembra personal ficticio si la tabla no tiene personal real, y reparte las órdenes entre el personal que haya por área y oficio. Réplica con personal real: `PERSONAL_SQL=<ruta> npm run replica`.
- El login tiene botones de acceso rápido (`CFG.demo` en `public/config.js`). Para el consejo, ponerlo en `false` o proteger el sitio.
- Verificado el 12 nov 2026 contra el Supabase real con el build nuevo: login, crear reporte y subir foto con URL firmada. Esa prueba dejó una orden de prueba (MAN-00053); el seed la borra.

## Pruebas locales (sin red)
- Réplica: `npm run build:local` genera `dist-local/` y `npm run replica` levanta `test/replica.mjs` en http://127.0.0.1:3000. Usa PGlite (Postgres en WebAssembly, sin instalar nada; corre en Windows) con las migraciones 0001, 0003, 0004, 0005 y 0006 y el seed reales, así que RLS y RPC son las de producción. Imita auth, REST y storage. Los datos viven en memoria: se reinician al reiniciar la réplica.
- Punta a punta: `npm run test:e2e` con la réplica arriba (Playwright, ~40 comprobaciones; capturas en `test/shots/`). Grabación del video: `test/video.cjs` y `test/shots.cjs` (actualizados a "Soy del club" y al flujo sin operativo); las fotos `foto_fuga.jpg` y `foto_listo.jpg` no están en el repo: ponlas en `video/fotos` (o en `VID_DIR`). Salida en `video/salida`. El resto del pipeline de video (`video/*.py`) no se revisó.
- Permisos en Postgres: `supabase/tests/stub_supabase.sql` + migraciones + `supabase/tests/prueba_permisos.sql`.
- Lo que no se puede probar contra la réplica: el login real de GoTrue y las políticas reales de storage (la 0002 no se carga); probar en la URL publicada.

## Marca
Verde OAK #31674F, Verde 1955 #C7E3CB, Beige Sparkling #F5F1E5, verde menta de la app ~#5FA880. Títulos en serif (Marcellus), texto en DM Sans (fuentes de Google). Botones primarios en Verde OAK (el menta no da contraste suficiente con texto blanco); el menta queda como acento. El logo en pantalla es `public/img/logo-verde.png` usado como máscara CSS (`.logo`) para pintarlo del color que pida cada fondo. Logos en `brand/` (son imágenes; pedir vectoriales al club para producción).

## Presentación y video
`slides/build.js` genera `Club_Valle_Propuesta_Consejo.pptx` (2 slides, pptxgenjs; el `applyTheme` apunta a una ruta de skill de otro entorno, ajustarla). `video/` tiene el pipeline de voz y subtítulos (voz Daro de Google AI Studio).

## Fuera de alcance de la demo
Bot de WhatsApp, SLA automáticos, mantenimiento preventivo, inventario, pedidos con QR y pagos (dependen de integrarse con el sistema de cobranza del club).

## Pendientes
Regenerar la voz (la narración cambia: ya no hay operativo con sesión; el supervisor asigna y lleva el estatus) y recomponer el video con `video/*.py`; `test/video.cjs` y `test/shots.cjs` ya están actualizados. Apagar `CFG.demo` antes del consejo. Reseed el lunes 16.
