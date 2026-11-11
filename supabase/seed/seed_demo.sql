-- Club Valle · Datos de demostración (ficticios).
-- Se puede volver a correr: reinicia las órdenes con fechas relativas a "hoy".
-- Contraseña de todas las cuentas de demo: Valle2026!

-- ============================================================
-- 1. Usuarios de demo (personal ficticio)
-- ============================================================
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'gerente@clubvalle-demo.test',  'Roberto Salinas',   'gerente'::public.rol_usuario,     null::public.area_servicio,     null::public.departamento),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'sup.mant@clubvalle-demo.test', 'Luis Treviño',      'supervisor'::public.rol_usuario,  'mantenimiento'::public.area_servicio, null::public.departamento),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'sup.int@clubvalle-demo.test',  'Marisol Garza',     'supervisor'::public.rol_usuario,  'intendencia'::public.area_servicio,   null::public.departamento),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'op.mant1@clubvalle-demo.test', 'Jorge Castillo',    'operativo'::public.rol_usuario,   'mantenimiento'::public.area_servicio, null::public.departamento),
      ('a0000000-0000-4000-8000-000000000005'::uuid, 'op.mant2@clubvalle-demo.test', 'Arturo Medina',     'operativo'::public.rol_usuario,   'mantenimiento'::public.area_servicio, null::public.departamento),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'op.int1@clubvalle-demo.test',  'Rosa Elena Ríos',   'operativo'::public.rol_usuario,   'intendencia'::public.area_servicio,   null::public.departamento),
      ('a0000000-0000-4000-8000-000000000007'::uuid, 'op.int2@clubvalle-demo.test',  'Patricia Núñez',    'operativo'::public.rol_usuario,   'intendencia'::public.area_servicio,   null::public.departamento),
      ('a0000000-0000-4000-8000-000000000008'::uuid, 'sol.ayb@clubvalle-demo.test',  'Daniela Cantú',     'solicitante'::public.rol_usuario, null::public.area_servicio,     'alimentos_bebidas'::public.departamento),
      ('a0000000-0000-4000-8000-000000000009'::uuid, 'sol.dep@clubvalle-demo.test',  'Mauricio Leal',     'solicitante'::public.rol_usuario, null::public.area_servicio,     'deportes'::public.departamento),
      ('a0000000-0000-4000-8000-000000000010'::uuid, 'sol.adm@clubvalle-demo.test',  'Karla Benavides',   'solicitante'::public.rol_usuario, null::public.area_servicio,     'administracion'::public.departamento)
    ) as t(id, email, nombre, rol, area, departamento)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            crypt('Valle2026!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nombre', u.nombre), now(), now(),
            '', '', '', '', '', '', '', '')
    on conflict (id) do update set encrypted_password = excluded.encrypted_password, email = excluded.email;

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', u.id::text, now(), now(), now())
    on conflict (provider_id, provider) do nothing;

    insert into public.perfiles (id, nombre, rol, area, departamento, activo)
    values (u.id, u.nombre, u.rol, u.area, u.departamento, true)
    on conflict (id) do update
      set nombre = excluded.nombre, rol = excluded.rol, area = excluded.area,
          departamento = excluded.departamento, activo = true;
  end loop;
end $$;

-- ============================================================
-- 2. Catálogos genéricos (se cambian por las zonas reales del club)
-- ============================================================
insert into public.zonas (nombre) values
  ('Alberca'), ('Canchas de tenis'), ('Canchas de pádel'), ('Gimnasio'),
  ('Vestidores de hombres'), ('Vestidores de mujeres'), ('Comedor'), ('Snack'),
  ('Salón de eventos'), ('Lobby'), ('Estacionamiento'), ('Jardines'),
  ('Área infantil'), ('Cancha de fútbol')
on conflict (nombre) do nothing;

insert into public.categorias (nombre, area) values
  ('Eléctrica', 'mantenimiento'), ('Plomería', 'mantenimiento'), ('Aire acondicionado', 'mantenimiento'),
  ('Albañilería y pintura', 'mantenimiento'), ('Carpintería y herrería', 'mantenimiento'),
  ('Equipo y maquinaria', 'mantenimiento'), ('Alberca y equipo', 'mantenimiento'),
  ('Limpieza general', 'intendencia'), ('Baños y vestidores', 'intendencia'),
  ('Mobiliario y montaje', 'intendencia'), ('Jardines y áreas verdes', 'intendencia'),
  ('Recolección de basura', 'intendencia')
on conflict (nombre, area) do nothing;

-- ============================================================
-- 3. Órdenes con historial (52, fechas relativas a hoy)
-- ============================================================
truncate public.orden_fotos, public.orden_eventos, public.ordenes restart identity cascade;

do $$
declare
  tpl jsonb := '[
    ["Vestidores de hombres","Plomería","Fuga en regadera 4; el agua escurre al pasillo.","alta",true],
    ["Alberca","Alberca y equipo","La bomba del filtro hace ruido y vibra al arrancar.","alta",false],
    ["Canchas de tenis","Eléctrica","Dos lámparas de la cancha 3 no encienden.","media",false],
    ["Gimnasio","Aire acondicionado","El aire de la sala de pesas no enfría.","alta",false],
    ["Comedor","Aire acondicionado","Goteo del minisplit sobre las mesas del fondo.","media",true],
    ["Salón de eventos","Eléctrica","Falla un apagador del escenario.","baja",false],
    ["Estacionamiento","Eléctrica","Luminaria del acceso norte apagada.","media",true],
    ["Vestidores de mujeres","Plomería","Lavabo 2 con la llave goteando.","baja",false],
    ["Gimnasio","Equipo y maquinaria","La caminadora 5 se detiene sola.","media",true],
    ["Canchas de pádel","Albañilería y pintura","Grieta en el muro del fondo de la cancha 2.","media",false],
    ["Lobby","Carpintería y herrería","La puerta de cristal del acceso no cierra bien.","media",false],
    ["Alberca","Plomería","Regadera exterior sin agua caliente.","media",false],
    ["Snack","Equipo y maquinaria","El refrigerador de bebidas no mantiene la temperatura.","alta",false],
    ["Área infantil","Carpintería y herrería","Columpio con la tornillería floja.","urgente",true],
    ["Cancha de fútbol","Eléctrica","Reflector del lado oeste parpadea.","baja",false],
    ["Comedor","Plomería","Tarja de la cocina con drenaje lento.","media",false],
    ["Vestidores de mujeres","Baños y vestidores","Faltan jabón y papel en los sanitarios.","media",false],
    ["Alberca","Limpieza general","Andén resbaloso por lama junto a la alberca.","alta",true],
    ["Salón de eventos","Mobiliario y montaje","Montaje de 120 sillas y 12 mesas para el evento del sábado.","media",false],
    ["Comedor","Limpieza general","Limpieza profunda de la terraza después del evento.","baja",false],
    ["Jardines","Jardines y áreas verdes","Poda de setos en el acceso principal.","baja",false],
    ["Lobby","Limpieza general","Vidrios de la entrada con manchas.","baja",false],
    ["Gimnasio","Limpieza general","Desinfección de colchonetas y zona de pesas.","media",false],
    ["Estacionamiento","Recolección de basura","Contenedores llenos junto a las canchas.","media",false],
    ["Vestidores de hombres","Baños y vestidores","Piso mojado frente a las regaderas.","alta",true],
    ["Área infantil","Limpieza general","Arenero con basura y hojas.","media",true],
    ["Canchas de tenis","Limpieza general","Barrido de canchas 1 y 2 después de la lluvia.","media",false],
    ["Snack","Limpieza general","Limpieza profunda de campana y piso de la cocina.","media",false]
  ]'::jsonb;
  c_asig text[] := array['Atender hoy, por favor.', null, 'Llevar material desde bodega.', null];
  c_proc text[] := array['En camino al sitio.', 'Ya estoy en el sitio.', 'Empiezo la revisión.'];
  c_esp  text[] := array['Falta refacción; ya se pidió al proveedor.', 'Esperando al proveedor externo.'];
  c_res  text[] := array['Trabajo terminado, listo para revisión.', 'Quedó resuelto y probado.', 'Reparación concluida.'];
  c_cerr text[] := array['Revisado y conforme.', 'Verificado en sitio.', 'Cerrada tras revisión.'];
  c_com  text[] := array['Prioridad confirmada con la gerencia.', 'Es la tercera vez que se reporta en la zona.', 'Avisar a recepción cuando esté listo.'];

  g uuid := 'a0000000-0000-4000-8000-000000000001';
  sup_m uuid := 'a0000000-0000-4000-8000-000000000002';
  sup_i uuid := 'a0000000-0000-4000-8000-000000000003';
  ops_m uuid[] := array['a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000005']::uuid[];
  ops_i uuid[] := array['a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000007']::uuid[];
  sols  uuid[] := array['a0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000010']::uuid[];

  i int; idx int; t jsonb;
  v_zona bigint; v_cat bigint; v_area public.area_servicio;
  v_rep uuid; v_sup uuid; v_op uuid; v_estado public.estatus_orden;
  days_ago numeric; base_day date; t0 timestamptz;
  t_asig timestamptz; t_proc timestamptz; t_esp timestamptz; t_resume timestamptz; t_res timestamptz; t_cerr timestamptz;
  usa_espera boolean; v_id bigint; v_last timestamptz;
begin
  for i in 1..52 loop
    idx := case i
      when 6 then 0 when 22 then 0 when 50 then 0
      when 17 then 3 when 28 then 9 when 35 then 10
      when 43 then 12 when 44 then 1 when 45 then 17 when 46 then 25 when 47 then 4
      when 48 then 24 when 49 then 13 when 51 then 21 when 52 then 16
      else (i * 11) % 28 end;
    t := tpl -> idx;

    v_estado := case
      when i in (17, 47) then 'en_espera'
      when i in (28, 43, 46) then 'en_proceso'
      when i in (35, 48) then 'asignada'
      when i in (44, 45, 49) then 'resuelta'
      when i in (50, 51, 52) then 'nueva'
      else 'cerrada' end::public.estatus_orden;

    select z.id into v_zona from public.zonas z where z.nombre = t->>0;
    select c.id, c.area into v_cat, v_area from public.categorias c where c.nombre = t->>1;

    v_sup := case v_area when 'mantenimiento' then sup_m else sup_i end;
    v_op  := case v_area when 'mantenimiento' then ops_m[1 + i % 2] else ops_i[1 + i % 2] end;
    v_rep := case when i % 9 = 0 then (case v_area when 'mantenimiento' then sup_i else sup_m end)
                  else sols[1 + i % 3] end;

    days_ago := case when i <= 36 then 58 - (i - 1) * (44.0 / 35) else 13 - (i - 37) * (12.5 / 15) end;
    base_day := (now() at time zone 'America/Monterrey')::date - floor(days_ago)::int;
    t0 := ((base_day + time '07:00') + ((i * 53) % 600) * interval '1 minute') at time zone 'America/Monterrey';
    t0 := least(t0, now() - (53 - i) * interval '25 minutes');

    usa_espera := (i % 5 = 0 and v_estado in ('cerrada', 'resuelta')) or v_estado = 'en_espera';
    t_asig := t0 + (20 + (i * 13) % 160) * interval '1 minute';
    t_proc := t_asig + (30 + (i * 7) % 240) * interval '1 minute';
    t_esp  := t_proc + interval '2 hours';
    t_resume := t_esp + (1 + i % 3) * interval '1 day';
    t_res  := case when usa_espera then t_resume + (2 + i % 6) * interval '1 hour'
                   else t_proc + (2 + i % 9) * interval '1 hour' + (case when i % 4 = 0 then interval '1 day' else interval '0' end) end;
    t_cerr := t_res + (2 + i % 20) * interval '1 hour';

    v_last := case v_estado
      when 'nueva' then t0 when 'asignada' then t_asig when 'en_proceso' then t_proc
      when 'en_espera' then t_esp when 'resuelta' then t_res else t_cerr end;

    insert into public.ordenes (zona_id, categoria_id, descripcion, prioridad, riesgo_socios, reportado_por,
                                estatus, asignado_a, created_at, updated_at, asignada_at, resuelta_at, cerrada_at)
    values (v_zona, v_cat, t->>2, (t->>3)::public.prioridad, (t->>4)::boolean, v_rep,
            v_estado,
            case when v_estado = 'nueva' then null else v_op end,
            t0, v_last,
            case when v_estado = 'nueva' then null else t_asig end,
            case when v_estado in ('resuelta', 'cerrada') then t_res end,
            case when v_estado = 'cerrada' then t_cerr end)
    returning id into v_id;

    insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_nuevo, created_at)
    values (v_id, v_rep, 'creada', 'nueva', t0);

    if v_estado <> 'nueva' then
      insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, asignado_a, comentario, created_at)
      values (v_id, v_sup, 'asignada', 'nueva', 'asignada', v_op, c_asig[1 + i % 4], t_asig);
      if i % 3 = 0 then
        insert into public.orden_eventos (orden_id, autor_id, tipo, comentario, created_at)
        values (v_id, v_sup, 'comentario', c_com[1 + i % 3], t_asig + interval '5 minutes');
      end if;
    end if;
    if v_estado in ('en_proceso', 'en_espera', 'resuelta', 'cerrada') then
      insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario, created_at)
      values (v_id, v_op, 'cambio_estatus', 'asignada', 'en_proceso', c_proc[1 + i % 3], t_proc);
    end if;
    if usa_espera then
      insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario, created_at)
      values (v_id, v_op, 'cambio_estatus', 'en_proceso', 'en_espera', c_esp[1 + i % 2], t_esp);
      if v_estado in ('resuelta', 'cerrada') then
        insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario, created_at)
        values (v_id, v_op, 'cambio_estatus', 'en_espera', 'en_proceso', 'Llegó la refacción; se reanuda el trabajo.', t_resume);
      end if;
    end if;
    if v_estado in ('resuelta', 'cerrada') then
      insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario, created_at)
      values (v_id, v_op, 'cambio_estatus', 'en_proceso', 'resuelta', c_res[1 + i % 3], t_res);
    end if;
    if v_estado = 'cerrada' then
      insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario, created_at)
      values (v_id, v_sup, 'cambio_estatus', 'resuelta', 'cerrada', c_cerr[1 + i % 3], t_cerr);
    end if;
  end loop;
end $$;
