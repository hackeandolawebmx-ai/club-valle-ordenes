-- Prueba de permisos por rol. Cada bloque imprime OK o falla con error.
-- Corre con: npm run test:permisos  (PGlite) o con psql sobre stub + migraciones.
\set ON_ERROR_STOP on

-- Usuarios que inician sesión (el personal operativo ya no es usuario)
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'), -- gerente
 ('00000000-0000-0000-0000-000000000002'), -- supervisor mantenimiento
 ('00000000-0000-0000-0000-000000000003'), -- supervisor intendencia
 ('00000000-0000-0000-0000-000000000004'), -- supervisor compras
 ('00000000-0000-0000-0000-000000000005'), -- solicitante A&B
 ('00000000-0000-0000-0000-000000000006'), -- solicitante deportes
 ('00000000-0000-0000-0000-000000000007'); -- solicitante seguridad

insert into public.perfiles (id, nombre, rol, area, departamento) values
 ('00000000-0000-0000-0000-000000000001', 'Gerente',      'gerente',     null, null),
 ('00000000-0000-0000-0000-000000000002', 'Sup Mant',     'supervisor',  'mantenimiento', null),
 ('00000000-0000-0000-0000-000000000003', 'Sup Int',      'supervisor',  'intendencia', null),
 ('00000000-0000-0000-0000-000000000004', 'Sup Compras',  'supervisor',  'compras', null),
 ('00000000-0000-0000-0000-000000000005', 'Sol AyB',      'solicitante', null, 'alimentos_bebidas'),
 ('00000000-0000-0000-0000-000000000006', 'Sol Deportes', 'solicitante', null, 'deportes'),
 ('00000000-0000-0000-0000-000000000007', 'Sol Seguridad','solicitante', null, 'seguridad');

insert into public.personal (id, nombre, area, tipo, empresa) values
 ('10000000-0000-0000-0000-000000000001', 'Mant A',        'mantenimiento', 'interno', null),
 ('10000000-0000-0000-0000-000000000002', 'Mant B',        'mantenimiento', 'interno', null),
 ('10000000-0000-0000-0000-000000000003', 'Int A',         'intendencia',   'interno', null),
 ('10000000-0000-0000-0000-000000000004', 'Plomero ext',   'mantenimiento', 'externo', 'Plomería Regio'),
 ('10000000-0000-0000-0000-000000000005', 'Comprador',     'compras',       'interno', null);

insert into public.zonas (nombre) values ('Alberca'), ('Comedor');
insert into public.categorias (nombre, area) values ('Plomería', 'mantenimiento'), ('Limpieza', 'intendencia');

create or replace function pg_temp.como(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || u, false);
end $$;

create or replace function pg_temp.debe_fallar(sql text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  raise exception 'FALLA: % debía ser rechazado y pasó', etiqueta;
exception when others then
  if sqlerrm like 'FALLA:%' then raise; end if;
  return 'OK  rechazado: ' || etiqueta || '  (' || sqlerrm || ')';
end $$;

set role authenticated;

-- 1. Solicitantes levantan reportes (incluye Seguridad)
select pg_temp.como('5');
select folio, area, estatus, departamento_solicitante from public.crear_orden(1, 1, 'Fuga en regadera', 'alta', true, 'Vestidor H');
select folio, area, estatus from public.crear_orden(2, 2, 'Piso mojado', 'media', true);
select pg_temp.como('7');
select 'OK  seguridad reporta: ' || folio || ' ' || departamento_solicitante from public.crear_orden(1, 1, 'Pluma de acceso sin energía');

-- 2. Aislamiento entre solicitantes
select pg_temp.como('6');
select 'OK  solicitante deportes ve ' || count(*) || ' órdenes (esperado 0)' from public.ordenes;
select pg_temp.debe_fallar($$select public.comentar_orden(1, 'hola')$$, 'solicitante comenta orden ajena');

-- 3. Sin escritura directa
select pg_temp.como('5');
select pg_temp.debe_fallar($$update public.ordenes set estatus = 'cerrada' where id = 1$$, 'update directo');
select pg_temp.debe_fallar($$insert into public.ordenes (zona_id, categoria_id, descripcion, reportado_por) values (1,1,'x','00000000-0000-0000-0000-000000000005')$$, 'insert directo');
select pg_temp.debe_fallar($$insert into public.personal (nombre, area) values ('x', 'mantenimiento')$$, 'alta directa de personal');
select pg_temp.debe_fallar($$select public.agregar_personal('Intruso')$$, 'solicitante agrega personal');

-- 4. Supervisores ven su área
select pg_temp.como('2');
select 'OK  sup mantenimiento ve: ' || string_agg(folio, ',' order by id) || ' (esperado MAN-00001,MAN-00003)' from public.ordenes;
select pg_temp.como('3');
select 'OK  sup intendencia ve: ' || string_agg(folio, ',') || ' (esperado INT-00002)' from public.ordenes;
select pg_temp.como('4');
select 'OK  sup compras ve ' || count(*) || ' órdenes (esperado 0)' from public.ordenes;

-- 5. Asignación: solo el supervisor del área y solo a personal de su área
select pg_temp.como('3');
select pg_temp.debe_fallar($$select public.asignar_orden(1, '10000000-0000-0000-0000-000000000003')$$, 'sup intendencia asigna orden de mantenimiento');
select pg_temp.como('2');
select pg_temp.debe_fallar($$select public.asignar_orden(1, '10000000-0000-0000-0000-000000000003')$$, 'asignar a personal de otra área');
select 'OK  asignada a interno: ' || folio || ' ' || estatus from public.asignar_orden(1, '10000000-0000-0000-0000-000000000001', 'Revisar hoy');
select 'OK  reasignada a externo: ' || asignado_a_nombre || ' (' || asignado_a_tipo || ', ' || asignado_a_empresa || ')'
  from public.v_ordenes where id = 1 and public.asignar_orden(1, '10000000-0000-0000-0000-000000000004') is not null;

-- 6. Personal: alta y baja por el supervisor, solo de su área
select 'OK  agregó externo: ' || nombre || ' en ' || area from public.agregar_personal('Electricista ext', 'externo', 'Eléctrica del Norte');
select pg_temp.como('3');
select pg_temp.debe_fallar($$select public.activar_personal('10000000-0000-0000-0000-000000000002', false)$$, 'sup intendencia da de baja personal de mantenimiento');
select pg_temp.como('2');
select 'OK  baja de personal: activo=' || activo from public.activar_personal('10000000-0000-0000-0000-000000000002', false);
select pg_temp.debe_fallar($$select public.asignar_orden(1, '10000000-0000-0000-0000-000000000002')$$, 'asignar a personal dado de baja');
select public.activar_personal('10000000-0000-0000-0000-000000000002', true) is not null as reactivado;

-- 6b. Gerente administra personal de todas las áreas; supervisor solo la suya; no se da de baja con órdenes abiertas
select pg_temp.debe_fallar($$select public.guardar_personal(null, 'Intruso', 'intendencia', 'interno')$$, 'sup mantenimiento da de alta en intendencia');
select pg_temp.debe_fallar($$select public.guardar_personal('10000000-0000-0000-0000-000000000003', 'Int A', 'intendencia', 'interno')$$, 'sup mantenimiento edita personal de intendencia');
select pg_temp.debe_fallar($$select public.activar_personal('10000000-0000-0000-0000-000000000004', false)$$, 'baja de personal con orden abierta');
select pg_temp.como('5');
select pg_temp.debe_fallar($$select public.guardar_personal(null, 'Intruso', 'mantenimiento', 'interno')$$, 'solicitante da de alta personal');
select pg_temp.como('1');
select 'OK  gerente da de alta en intendencia: ' || nombre || ' / ' || area from public.guardar_personal(null, '  Auxiliar nuevo ', 'intendencia', 'interno', null, 'Auxiliar', 'Gimnasio');
select pg_temp.debe_fallar($$select public.guardar_personal(null, 'Sin area', null, 'interno')$$, 'gerente sin indicar área');
select pg_temp.debe_fallar($$select public.guardar_personal(null, '   ', 'compras', 'interno')$$, 'nombre vacío');
select 'OK  gerente edita: ' || nombre || ' / ' || coalesce(puesto, '') from public.guardar_personal('10000000-0000-0000-0000-000000000003', 'Int A editada', 'intendencia', 'interno', null, 'Jefa de turno', null);
select pg_temp.debe_fallar($$select public.guardar_personal('10000000-0000-0000-0000-000000000004', 'Plomero ext', 'compras', 'externo', 'Plomería Regio')$$, 'mover de área con orden abierta');
select 'OK  gerente mueve de área sin órdenes abiertas: ' || area from public.guardar_personal('10000000-0000-0000-0000-000000000005', 'Comprador', 'intendencia', 'interno');
select 'OK  gerente da de baja: activo=' || activo from public.activar_personal('10000000-0000-0000-0000-000000000005', false);
select public.activar_personal('10000000-0000-0000-0000-000000000005', true) is not null as reactivado_gerente;
select public.guardar_personal('10000000-0000-0000-0000-000000000005', 'Comprador', 'compras', 'interno') is not null as regresa_a_compras;
select pg_temp.como('2');

-- 7. El supervisor lleva el estatus y es el único que cambia estatus
select pg_temp.como('5');
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'en_proceso')$$, 'solicitante cambia estatus');
select pg_temp.como('2');
select 'OK  sup: ' || estatus from public.cambiar_estatus(1, 'en_proceso', 'El plomero ya está en sitio');
select 'OK  sup: ' || estatus from public.cambiar_estatus(1, 'en_espera', 'Falta refacción');
select 'OK  sup: ' || estatus from public.cambiar_estatus(1, 'resuelta', 'El plomero terminó');
select pg_temp.como('3');
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'cerrada')$$, 'sup de otra área cierra');
select pg_temp.como('1');
select 'OK  gerente ve ' || count(*) || ' órdenes (esperado 3)' from public.v_ordenes;
select pg_temp.debe_fallar($$select public.cambiar_estatus(1, 'cerrada')$$, 'gerente cierra');
select pg_temp.debe_fallar($$select public.asignar_orden(2, '10000000-0000-0000-0000-000000000003')$$, 'gerente asigna');
select pg_temp.debe_fallar($$select public.comentar_orden(1, 'hola')$$, 'gerente comenta');
select pg_temp.debe_fallar($$select public.reasignar_area(1, 'compras', 'x')$$, 'gerente reasigna');
select pg_temp.como('2');
select 'OK  sup cierra: ' || estatus || ', cerrada_at con fecha: ' || (cerrada_at is not null) from public.cambiar_estatus(1, 'cerrada', 'Verificado');
select pg_temp.debe_fallar($$select public.asignar_orden(1, '10000000-0000-0000-0000-000000000001')$$, 'reasignar orden cerrada');

-- 8. Reasignación entre áreas (Compras)
-- MAN-00003 (seguridad) está nueva en mantenimiento
select pg_temp.como('7');
select pg_temp.debe_fallar($$select public.reasignar_area(3, 'compras', 'x')$$, 'solicitante reasigna');
select pg_temp.como('3');
select pg_temp.debe_fallar($$select public.reasignar_area(3, 'compras', 'x')$$, 'sup de otra área reasigna');
select pg_temp.como('2');
select pg_temp.debe_fallar($$select public.reasignar_area(3, 'compras', '  ')$$, 'reasignar sin motivo');
select pg_temp.debe_fallar($$select public.reasignar_area(3, 'mantenimiento', 'mismo')$$, 'reasignar a la misma área');
select pg_temp.debe_fallar($$select public.reasignar_area(1, 'compras', 'cerrada')$$, 'reasignar orden cerrada');
select public.asignar_orden(3, '10000000-0000-0000-0000-000000000001') is not null as asignada_antes;
select 'OK  a compras: ' || area || ' ' || estatus || ' origen ' || area_origen || ' asignado ' || coalesce(asignado_a::text, 'nadie')
  from public.reasignar_area(3, 'compras', 'Hay que comprar el motor de la pluma');
select pg_temp.debe_fallar($$select public.asignar_orden(3, '10000000-0000-0000-0000-000000000001')$$, 'sup mantenimiento asigna tras reasignar');
select 'OK  sup mantenimiento aún la ve: ' || count(*) from public.ordenes where id = 3;
select pg_temp.como('4');
select 'OK  sup compras la ve: ' || folio || ' (folio conserva prefijo)' from public.ordenes where id = 3;
select pg_temp.debe_fallar($$select public.asignar_orden(3, '10000000-0000-0000-0000-000000000001')$$, 'compras asigna a personal de mantenimiento');
select 'OK  compras asigna: ' || estatus from public.asignar_orden(3, '10000000-0000-0000-0000-000000000005', 'Cotizar con dos proveedores');
select 'OK  compras avanza: ' || estatus from public.cambiar_estatus(3, 'en_proceso', 'Pedido hecho');
select 'OK  de regreso a mantenimiento: ' || area || ' ' || estatus from public.reasignar_area(3, 'mantenimiento', 'Llegó el motor; instalar');
select pg_temp.como('7');
select 'OK  historial MAN-00003: ' || string_agg(tipo || ':' || coalesce(area_anterior::text,'-') || '>' || coalesce(area_nueva::text,'-'), ' | ' order by id)
  from public.orden_eventos where orden_id = 3 and tipo = 'reasignacion';

-- 9. Reportes repetidos
select pg_temp.como('6');
select 'OK  reporte repetido: ' || folio from public.crear_orden(1, 1, 'Otra vez la fuga en regadera');  -- id 4
select 'OK  órdenes similares abiertas que ve el solicitante: ' || count(*) || ' (esperado 1: MAN-00003)'
  from public.ordenes_similares(1, 1, 4);
select pg_temp.debe_fallar($$select public.cerrar_por_duplicado(4, 3)$$, 'solicitante cierra por duplicado');
select pg_temp.como('3');
select pg_temp.debe_fallar($$select public.cerrar_por_duplicado(4, 3)$$, 'sup de otra área cierra por duplicado');
select pg_temp.como('2');
select pg_temp.debe_fallar($$select public.cerrar_por_duplicado(4, 4)$$, 'duplicado de sí misma');
select pg_temp.debe_fallar($$select public.cerrar_por_duplicado(4, 2)$$, 'original de otra área que no ve');
select 'OK  cerrada por duplicado: ' || folio || ' -> ' || duplicada_folio || ' (' || cierre_motivo || ', ' || estatus || ')'
  from public.cerrar_por_duplicado(4, 3, 'Mismo vestidor');
select pg_temp.debe_fallar($$select public.cambiar_estatus(4, 'en_proceso')$$, 'reabrir un duplicado por cambio de estatus');
select 'OK  la original lo registra: ' || count(*) || ' comentario(s)' from public.orden_eventos where orden_id = 3 and comentario like 'Se cerró MAN-00004%';
select 'OK  el solicitante ve el folio original: ' || duplicada_folio from public.v_ordenes where id = 4
  and public.mi_rol() is not null;
select pg_temp.como('6');
select 'OK  el solicitante ve el folio original: ' || duplicada_folio from public.v_ordenes where id = 4;
select pg_temp.como('2');
select pg_temp.debe_fallar($$select public.cerrar_por_duplicado(3, 4)$$, 'duplicado de una orden ya cerrada como duplicado');

-- 10. Fotos
select pg_temp.como('6');
select pg_temp.debe_fallar($$insert into public.orden_fotos (orden_id, storage_path) values (1, '1/foto.jpg')$$, 'foto en orden ajena');
select pg_temp.como('5');
insert into public.orden_fotos (orden_id, storage_path) values (1, '1/fuga.jpg');
select 'OK  foto registrada por el solicitante';
select pg_temp.debe_fallar($$insert into public.orden_fotos (orden_id, storage_path) values (1, '2/truco.jpg')$$, 'foto con ruta de otra orden');

-- 11. Anónimo no ve nada
reset role;
set role anon;
select pg_temp.debe_fallar($$select count(*) from public.ordenes$$, 'anónimo lee órdenes');
select pg_temp.debe_fallar($$select count(*) from public.personal$$, 'anónimo lee personal');
select pg_temp.debe_fallar($$select public.crear_orden(1, 1, 'x')$$, 'anónimo crea orden');
select pg_temp.debe_fallar($$select * from public.ordenes_similares(1, 1)$$, 'anónimo consulta similares');

reset role;
select 'TODAS LAS PRUEBAS PASARON';
