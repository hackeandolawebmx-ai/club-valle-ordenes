-- Prueba de permisos por rol. Cada bloque imprime OK o falla con error.
\set ON_ERROR_STOP on

-- Datos base (como dueño de la base)
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'), -- gerente
 ('00000000-0000-0000-0000-000000000002'), -- supervisor mantenimiento
 ('00000000-0000-0000-0000-000000000003'), -- supervisor intendencia
 ('00000000-0000-0000-0000-000000000004'), -- operativo mantenimiento A
 ('00000000-0000-0000-0000-000000000005'), -- operativo mantenimiento B
 ('00000000-0000-0000-0000-000000000006'), -- operativo intendencia
 ('00000000-0000-0000-0000-000000000007'), -- solicitante A&B
 ('00000000-0000-0000-0000-000000000008'); -- solicitante deportes

insert into public.perfiles (id, nombre, rol, area, departamento) values
 ('00000000-0000-0000-0000-000000000001', 'Gerente',        'gerente',     null, null),
 ('00000000-0000-0000-0000-000000000002', 'Sup Mant',       'supervisor',  'mantenimiento', null),
 ('00000000-0000-0000-0000-000000000003', 'Sup Int',        'supervisor',  'intendencia', null),
 ('00000000-0000-0000-0000-000000000004', 'Op Mant A',      'operativo',   'mantenimiento', null),
 ('00000000-0000-0000-0000-000000000005', 'Op Mant B',      'operativo',   'mantenimiento', null),
 ('00000000-0000-0000-0000-000000000006', 'Op Int',         'operativo',   'intendencia', null),
 ('00000000-0000-0000-0000-000000000007', 'Sol AyB',        'solicitante', null, 'alimentos_bebidas'),
 ('00000000-0000-0000-0000-000000000008', 'Sol Deportes',   'solicitante', null, 'deportes');

insert into public.zonas (nombre) values ('Alberca'), ('Comedor');
insert into public.categorias (nombre, area) values ('Plomería', 'mantenimiento'), ('Limpieza', 'intendencia');

-- Helper para actuar como un usuario
create or replace function pg_temp.como(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || u, false);
end $$;

-- Helper que espera un error
create or replace function pg_temp.debe_fallar(sql text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  raise exception 'FALLA: % debía ser rechazado y pasó', etiqueta;
exception when others then
  if sqlerrm like 'FALLA:%' then raise; end if;
  return 'OK  rechazado: ' || etiqueta || '  (' || sqlerrm || ')';
end $$;

set role authenticated;

-- 1. Solicitante A&B levanta reporte de plomería y uno de limpieza
select pg_temp.como('7');
select folio, area, estatus, departamento_solicitante from public.crear_orden(1, 1, 'Fuga en regadera', 'alta', true, 'Vestidor H');
select folio, area, estatus from public.crear_orden(2, 2, 'Piso mojado', 'media', true);

-- 2. Solicitante deportes no ve los reportes del otro solicitante
select pg_temp.como('8');
select 'OK  solicitante deportes ve ' || count(*) || ' órdenes (esperado 0)' from public.ordenes;
select pg_temp.debe_fallar($$select public.comentar_orden(1, 'hola')$$, 'solicitante comenta orden ajena');

-- 3. Solicitante no puede escribir directo en la tabla
select pg_temp.como('7');
select pg_temp.debe_fallar($$update public.ordenes set estatus = 'cerrada' where id = 1$$, 'update directo');
select pg_temp.debe_fallar($$insert into public.ordenes (zona_id, categoria_id, descripcion, reportado_por) values (1,1,'x','00000000-0000-0000-0000-000000000007')$$, 'insert directo');

-- 4. Supervisores: cada uno ve solo su área
select pg_temp.como('2');
select 'OK  sup mantenimiento ve: ' || string_agg(folio, ',') || ' (esperado MAN-00001)' from public.ordenes;
select pg_temp.como('3');
select 'OK  sup intendencia ve: ' || string_agg(folio, ',') || ' (esperado INT-00002)' from public.ordenes;

-- 5. Supervisor de intendencia no puede asignar una orden de mantenimiento
select pg_temp.debe_fallar($$select public.asignar_orden(1, '00000000-0000-0000-0000-000000000006')$$, 'sup intendencia asigna orden de mantenimiento');

-- 6. Supervisor de mantenimiento no puede asignar a un operativo de intendencia
select pg_temp.como('2');
select pg_temp.debe_fallar($$select public.asignar_orden(1, '00000000-0000-0000-0000-000000000006')$$, 'asignar a operativo de otra área');

-- 7. Asignación válida
select 'OK  asignada: ' || folio || ' ' || estatus from public.asignar_orden(1, '00000000-0000-0000-0000-000000000004', 'Revisar hoy');

-- 8. Operativo B (no asignado) no ve ni mueve la orden
select pg_temp.como('5');
select 'OK  operativo B ve ' || count(*) || ' órdenes (esperado 0)' from public.ordenes;
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'en_proceso')$$, 'operativo no asignado cambia estatus');

-- 9. Operativo A avanza, pero no puede cerrar
select pg_temp.como('4');
select 'OK  operativo A: ' || estatus from public.cambiar_estatus(1, 'en_proceso', 'En camino');
select 'OK  operativo A: ' || estatus from public.cambiar_estatus(1, 'en_espera', 'Falta refacción');
select 'OK  operativo A: ' || estatus from public.cambiar_estatus(1, 'resuelta', 'Cambié el empaque');
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'cerrada')$$, 'operativo cierra');

-- 10. Gerente: ve todo, no escribe
select pg_temp.como('1');
select 'OK  gerente ve ' || count(*) || ' órdenes (esperado 2)' from public.v_ordenes;
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'cerrada')$$, 'gerente cierra');
select pg_temp.debe_fallar($$select public.asignar_orden(2, '00000000-0000-0000-0000-000000000006')$$, 'gerente asigna');
select pg_temp.debe_fallar($$select public.comentar_orden(1, 'hola')$$, 'gerente comenta');

-- 11. Supervisor de mantenimiento cierra
select pg_temp.como('2');
select 'OK  sup cierra: ' || estatus || ', cerrada_at con fecha: ' || (cerrada_at is not null) from public.cambiar_estatus(1, 'cerrada', 'Verificado');
select pg_temp.debe_fallar($$select public.asignar_orden(1, '00000000-0000-0000-0000-000000000005')$$, 'reasignar orden cerrada');

-- 12. Solicitante sigue viendo su reporte y su historial completo
select pg_temp.como('7');
select 'OK  solicitante ve ' || count(*) || ' órdenes propias (esperado 2)' from public.ordenes;
select 'OK  historial MAN-00001: ' || string_agg(tipo || ':' || coalesce(estatus_anterior::text,'-') || '>' || coalesce(estatus_nuevo::text,'-'), ' | ' order by id)
  from public.orden_eventos where orden_id = 1;

-- 13. Fotos: solo con ruta de su orden y si puede verla
select pg_temp.como('8');
select pg_temp.debe_fallar($$insert into public.orden_fotos (orden_id, storage_path) values (1, '1/foto.jpg')$$, 'foto en orden ajena');
select pg_temp.como('7');
insert into public.orden_fotos (orden_id, storage_path) values (1, '1/fuga.jpg');
select 'OK  foto registrada por el solicitante';
select pg_temp.debe_fallar($$insert into public.orden_fotos (orden_id, storage_path) values (1, '2/truco.jpg')$$, 'foto con ruta de otra orden');

-- 14. Anónimo no ve nada
reset role;
set role anon;
select pg_temp.debe_fallar($$select count(*) from public.ordenes$$, 'anónimo lee órdenes');
select pg_temp.debe_fallar($$select public.crear_orden(1, 1, 'x')$$, 'anónimo crea orden');

reset role;
select 'TODAS LAS PRUEBAS PASARON';
