-- Sesión 2: valores nuevos de catálogo. Van en su propia migración porque un valor
-- de enum nuevo no se puede usar en la misma transacción en la que se crea.
alter type public.area_servicio add value if not exists 'compras';
alter type public.departamento  add value if not exists 'seguridad';
alter type public.tipo_evento   add value if not exists 'reasignacion';
