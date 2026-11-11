# Club Valle · Órdenes de servicio

Web app (PWA) para reportar y atender fallas de mantenimiento e intendencia. Demo de iActiva.

- Front: Preact + supabase-js, bundle estático con esbuild (`npm run build` genera `dist/`).
- Back: Supabase (proyecto `club-valle-demo`). Permisos por rol y área con RLS y funciones RPC; ver `supabase/migrations`.
- Config pública en `public/config.js` (URL y llave publicable de Supabase; es segura en el navegador).

## Hosting (Vercel)
Framework: Other · Build command: `npm run build` · Output directory: `dist`. Sin variables de entorno.

## Cuentas de demostración
Contraseña común `Valle2026!`: gerente@, sup.mant@, sup.int@, op.mant1@, op.int1@, sol.ayb@, sol.dep@, sol.adm@ `clubvalle-demo.test`. Usuarios y datos ficticios.

## Reiniciar datos de demo
Ejecutar `supabase/seed/seed_demo.sql` en el SQL editor de Supabase (borra las órdenes y las regenera con fechas relativas a hoy).

## Pruebas
`supabase/tests/prueba_permisos.sql` (permisos por rol en Postgres) y `test/e2e.cjs` (Playwright contra una réplica local; ver `test/mock-server.mjs`).
