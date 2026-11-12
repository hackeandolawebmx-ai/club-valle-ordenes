# Club Valle · Órdenes de servicio (demo de iActiva)

Prospecto de iActiva: club deportivo (~600 socios con familias). Herramienta web para reportar y atender fallas de **mantenimiento** e **intendencia**. Complementa la app de socios del club; no la sustituye. **No nombrar al proveedor de esa app en material para el cliente.**

Dueño: Daniel (iActiva). Escribir siempre en español, de tú, directo, sin emojis. No enviar correos ni mensajes en su nombre: solo borradores.

## Estado
- App publicada: https://club-valle-ordenes.vercel.app (Vercel, deploy automático desde `main`; framework Other, `npm run build`, salida `dist`).
- Supabase: proyecto `club-valle-demo`, ref `ltqqbmidaukuegclytvt`, us-east-1, plan gratuito. La llave publicable va en `public/config.js` (es segura en el navegador). Nunca poner service_role en el repo.
- Fechas clave: demo para el gerente general lunes 16 / martes 17 nov 2026; primera sesión del consejo miércoles 18 nov, 18:00 (se presenta con 2 slides y un video corto, no demo en vivo).

## Arquitectura
- Front: Preact + htm + supabase-js, bundle con esbuild a `dist/` (`npm run build`). Un solo archivo de lógica: `src/main.js`; estilos en `src/styles.css`. Rutas por hash. Móvil primero, barra inferior con botón central "Reportar", y menú lateral en escritorio.
- Datos y permisos viven en Postgres (RLS + funciones SECURITY DEFINER), no en la pantalla. Migraciones en `supabase/migrations` (0001 modelo, 0002 fotos, 0003 cierre de funciones auxiliares). Ya aplicadas en Supabase; cualquier cambio nuevo va como migración nueva.
- Nadie escribe directo en `ordenes` ni `orden_eventos`. Todo cambio pasa por 4 RPC: `crear_orden`, `asignar_orden`, `cambiar_estatus`, `comentar_orden`. Vista `v_ordenes` con `security_invoker = true`. Fotos en el bucket privado `orden-fotos` (ruta `<orden_id>/<archivo>`) y tabla `orden_fotos`.

## Roles y reglas
- **Gerente:** solo lectura (dashboard y todas las órdenes). No asigna, no cambia estatus, no comenta, no sube fotos.
- **Supervisor** (uno por área: mantenimiento, intendencia): ve y gestiona solo su área; asigna solo a operativos de su área; es el único que cierra o reabre.
- **Operativo** (por área): ve solo lo asignado o lo que reportó; cambia estatus entre asignada / en proceso / en espera / resuelta; no cierra.
- **Solicitante** (departamento: alimentos y bebidas, deportes, administración): levanta reportes y ve solo los suyos.
- Flujo: nueva → asignada → en proceso ↔ en espera → resuelta → cerrada. Folios MAN-00001 / INT-00002. No hay SLA ni medición de tiempos por ahora (se guardan las fechas para medir después).
- La interfaz espeja las reglas, pero el servidor decide. Si cambias una regla, cambia la RLS/RPC y agrega prueba en `supabase/tests/prueba_permisos.sql`.

## Datos de demo
- `supabase/seed/seed_demo.sql` (re-ejecutable): 10 usuarios ficticios, 14 zonas, 12 categorías, 52 órdenes con historial, fechas relativas a hoy. **Borra las órdenes existentes.** Correr de nuevo el lunes 16 antes de grabar o presentar.
- Cuentas `@clubvalle-demo.test`, contraseña común `Valle2026!`: gerente, sup.mant, sup.int, op.mant1, op.mant2, op.int1, op.int2, sol.ayb, sol.dep, sol.adm. Los nombres son ficticios.
- El login tiene botones de acceso rápido (`CFG.demo` en `public/config.js`). Para el consejo, ponerlo en `false` o proteger el sitio.
- Pendiente de verificar: subir una foto desde la pantalla en el Supabase real (las políticas de almacenamiento sí se probaron por SQL).

## Pruebas locales (sin red)
- Réplica: `bash test/up.sh` levanta Postgres local (`cv2`), PostgREST y `test/mock-server.mjs` (imita auth, REST y storage de Supabase). Requiere `./build-local.sh` para generar `dist-local/`. Los procesos no sobreviven entre sesiones: volver a correr `up.sh`.
- Permisos en Postgres: `supabase/tests/stub_supabase.sql` + migraciones + `supabase/tests/prueba_permisos.sql`.
- Punta a punta: `node test/e2e.cjs` (Playwright, 13 comprobaciones). Capturas: `test/shots.cjs`. Grabación del video: `test/video.cjs` y `video/`.
- Lo que no se puede probar contra la réplica: el login real de GoTrue y las políticas reales de storage; probar en la URL publicada.

## Marca
Verde OAK #31674F, Verde 1955 #C7E3CB, Beige Sparkling #F5F1E5, verde menta de la app ~#5FA880. Títulos en serif (Marcellus), texto en DM Sans (fuentes de Google). Logos en `brand/` (son imágenes; pedir vectoriales al club para producción).

## Presentación y video
`slides/build.js` genera `Club_Valle_Propuesta_Consejo.pptx` (2 slides, pptxgenjs; el `applyTheme` apunta a una ruta de skill de otro entorno, ajustarla). `video/` tiene el pipeline de voz y subtítulos (voz Daro de Google AI Studio).

## Fuera de alcance de la demo
WhatsApp, SLA automáticos, mantenimiento preventivo, inventario, pedidos con QR y pagos (dependen de integrarse con el sistema de cobranza del club).
