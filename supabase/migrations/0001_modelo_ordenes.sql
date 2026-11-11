-- Club Valle · Órdenes de servicio de mantenimiento e intendencia
-- Etapa 2: modelo de datos y permisos por rol y área.
--
-- Principios:
--   * Los permisos viven en la base (RLS), no solo en la pantalla.
--   * Nadie edita la tabla de órdenes directamente: todo cambio pasa por
--     funciones (crear, asignar, cambiar estatus, comentar) que validan
--     el rol y dejan el evento en el historial en la misma transacción.

-- ============================================================
-- Catálogos fijos
-- ============================================================
create type public.rol_usuario  as enum ('gerente', 'supervisor', 'operativo', 'solicitante');
create type public.area_servicio as enum ('mantenimiento', 'intendencia');
create type public.departamento  as enum ('alimentos_bebidas', 'deportes', 'administracion');
create type public.estatus_orden as enum ('nueva', 'asignada', 'en_proceso', 'en_espera', 'resuelta', 'cerrada');
create type public.prioridad     as enum ('urgente', 'alta', 'media', 'baja');
create type public.tipo_evento   as enum ('creada', 'asignada', 'cambio_estatus', 'comentario');

-- ============================================================
-- Tablas
-- ============================================================
create table public.zonas (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text,
  qr_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null,
  area    public.area_servicio not null,
  activa  boolean not null default true,
  unique (nombre, area)
);

-- Un perfil por usuario de Supabase Auth.
--   supervisor y operativo  -> llevan área (la que atienden)
--   solicitante             -> lleva departamento (de donde reporta)
--   gerente                 -> sin área ni departamento
create table public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null,
  rol          public.rol_usuario not null,
  area         public.area_servicio,
  departamento public.departamento,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint perfil_area_ok check (
    (rol in ('supervisor', 'operativo') and area is not null)
    or (rol not in ('supervisor', 'operativo') and area is null)
  ),
  constraint perfil_depto_ok check (
    (rol = 'solicitante' and departamento is not null)
    or (rol <> 'solicitante' and departamento is null)
  )
);

create table public.ordenes (
  id                bigint generated always as identity primary key,
  folio             text unique,                       -- MAN-00001 / INT-00001, lo pone un trigger
  zona_id           bigint not null references public.zonas (id),
  ubicacion_detalle text,
  categoria_id      bigint not null references public.categorias (id),
  area              public.area_servicio not null,     -- se copia de la categoría
  descripcion       text not null check (length(trim(descripcion)) > 0),
  prioridad         public.prioridad not null default 'media',
  riesgo_socios     boolean not null default false,
  estatus           public.estatus_orden not null default 'nueva',
  reportado_por     uuid not null references public.perfiles (id),
  departamento_solicitante public.departamento,        -- se copia del perfil de quien reporta
  asignado_a        uuid references public.perfiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  asignada_at       timestamptz,
  resuelta_at       timestamptz,
  cerrada_at        timestamptz
);

create index ordenes_area_estatus_idx on public.ordenes (area, estatus);
create index ordenes_asignado_idx     on public.ordenes (asignado_a);
create index ordenes_reportado_idx    on public.ordenes (reportado_por);
create index ordenes_zona_idx         on public.ordenes (zona_id, categoria_id);

create table public.orden_eventos (
  id               bigint generated always as identity primary key,
  orden_id         bigint not null references public.ordenes (id) on delete cascade,
  autor_id         uuid not null references public.perfiles (id),
  tipo             public.tipo_evento not null,
  estatus_anterior public.estatus_orden,
  estatus_nuevo    public.estatus_orden,
  asignado_a       uuid references public.perfiles (id),
  comentario       text,
  created_at       timestamptz not null default now()
);
create index orden_eventos_orden_idx on public.orden_eventos (orden_id, created_at);

create table public.orden_fotos (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes (id) on delete cascade,
  evento_id    bigint references public.orden_eventos (id) on delete set null,
  storage_path text not null unique,   -- <orden_id>/<archivo> dentro del bucket orden-fotos
  subida_por   uuid not null default auth.uid() references public.perfiles (id),
  created_at   timestamptz not null default now()
);
create index orden_fotos_orden_idx on public.orden_fotos (orden_id);

-- ============================================================
-- Funciones auxiliares (leen el perfil sin pasar por RLS)
-- ============================================================
create or replace function public.mi_perfil()
returns public.perfiles
language sql stable security definer set search_path = public
as $$
  select p.* from public.perfiles p where p.id = auth.uid() and p.activo;
$$;

create or replace function public.mi_rol()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$ select rol from public.perfiles where id = auth.uid() and activo; $$;

create or replace function public.mi_area()
returns public.area_servicio
language sql stable security definer set search_path = public
as $$ select area from public.perfiles where id = auth.uid() and activo; $$;

-- ¿El usuario actual puede ver esta orden?
create or replace function public.puede_ver_orden(o public.ordenes)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case public.mi_rol()
    when 'gerente'    then true
    when 'supervisor' then o.area = public.mi_area() or o.reportado_por = auth.uid()
    when 'operativo'  then o.asignado_a = auth.uid() or o.reportado_por = auth.uid()
    when 'solicitante' then o.reportado_por = auth.uid()
    else false
  end;
$$;

create or replace function public.puede_ver_orden_id(p_orden_id bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select public.puede_ver_orden(o) from public.ordenes o where o.id = p_orden_id), false);
$$;

-- ============================================================
-- Triggers: folio, área y departamento
-- ============================================================
create or replace function public.tg_ordenes_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select c.area into new.area from public.categorias c where c.id = new.categoria_id;
  if new.area is null then
    raise exception 'Categoría inválida';
  end if;
  select p.departamento into new.departamento_solicitante from public.perfiles p where p.id = new.reportado_por;
  new.folio := case new.area when 'mantenimiento' then 'MAN-' else 'INT-' end || lpad(new.id::text, 5, '0');
  return new;
end;
$$;

create trigger ordenes_before_insert
  before insert on public.ordenes
  for each row execute function public.tg_ordenes_before_insert();

-- ============================================================
-- Operaciones (únicas puertas de escritura sobre órdenes)
-- ============================================================

-- Levantar un reporte. Cualquier perfil activo puede hacerlo.
create or replace function public.crear_orden(
  p_zona_id bigint,
  p_categoria_id bigint,
  p_descripcion text,
  p_prioridad public.prioridad default 'media',
  p_riesgo_socios boolean default false,
  p_ubicacion_detalle text default null
)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
begin
  if public.mi_rol() is null then
    raise exception 'Usuario sin perfil activo';
  end if;

  insert into public.ordenes (zona_id, categoria_id, descripcion, prioridad, riesgo_socios,
                              ubicacion_detalle, reportado_por)
  values (p_zona_id, p_categoria_id, p_descripcion, p_prioridad, p_riesgo_socios,
          p_ubicacion_detalle, auth.uid())
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_nuevo)
  values (v_orden.id, auth.uid(), 'creada', 'nueva');

  return v_orden;
end;
$$;

-- Asignar o reasignar. Solo el supervisor del área, y solo a operativos de esa área.
create or replace function public.asignar_orden(p_orden_id bigint, p_operativo_id uuid, p_comentario text default null)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_op    public.perfiles;
  v_prev  public.estatus_orden;
  v_nuevo public.estatus_orden;
begin
  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  if public.mi_rol() is distinct from 'supervisor' or v_orden.area is distinct from public.mi_area() then
    raise exception 'Solo el supervisor de % puede asignar esta orden', v_orden.area;
  end if;
  if v_orden.estatus = 'cerrada' then
    raise exception 'La orden ya está cerrada';
  end if;

  select * into v_op from public.perfiles where id = p_operativo_id and activo;
  if not found or v_op.rol <> 'operativo' or v_op.area <> v_orden.area then
    raise exception 'Solo se puede asignar a un operativo activo de %', v_orden.area;
  end if;

  v_prev  := v_orden.estatus;
  v_nuevo := case when v_prev = 'nueva' then 'asignada'::public.estatus_orden else v_prev end;

  update public.ordenes
     set asignado_a = p_operativo_id,
         estatus = v_nuevo,
         asignada_at = coalesce(asignada_at, now()),
         updated_at = now()
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, asignado_a, comentario)
  values (p_orden_id, auth.uid(), 'asignada', v_prev, v_nuevo, p_operativo_id, p_comentario);

  return v_orden;
end;
$$;

-- Cambiar estatus.
--   Operativo asignado: asignada/en_proceso/en_espera -> en_proceso, en_espera, resuelta. No cierra.
--   Supervisor del área: lo mismo, más resuelta -> cerrada y resuelta -> en_proceso (reabrir).
create or replace function public.cambiar_estatus(p_orden_id bigint, p_estatus public.estatus_orden, p_comentario text default null)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_rol   public.rol_usuario := public.mi_rol();
  v_ok    boolean;
  v_prev  public.estatus_orden;
begin
  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  v_prev := v_orden.estatus;

  if v_rol = 'supervisor' and v_orden.area = public.mi_area() then
    v_ok := (v_orden.estatus in ('asignada', 'en_proceso', 'en_espera') and p_estatus in ('en_proceso', 'en_espera', 'resuelta'))
         or (v_orden.estatus = 'resuelta' and p_estatus in ('cerrada', 'en_proceso'));
  elsif v_rol = 'operativo' and v_orden.asignado_a = auth.uid() then
    v_ok := v_orden.estatus in ('asignada', 'en_proceso', 'en_espera') and p_estatus in ('en_proceso', 'en_espera', 'resuelta');
  else
    raise exception 'No tienes permiso para cambiar el estatus de esta orden';
  end if;

  if v_orden.estatus = p_estatus or not v_ok then
    raise exception 'Cambio no permitido: % -> %', v_orden.estatus, p_estatus;
  end if;

  update public.ordenes
     set estatus = p_estatus,
         resuelta_at = case when p_estatus = 'resuelta' then now()
                            when p_estatus = 'en_proceso' and v_orden.estatus = 'resuelta' then null
                            else resuelta_at end,
         cerrada_at = case when p_estatus = 'cerrada' then now() else cerrada_at end,
         updated_at = now()
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario)
  values (p_orden_id, auth.uid(), 'cambio_estatus', v_prev, p_estatus, p_comentario);

  return v_orden;
end;
$$;

-- Comentar. Quien pueda ver la orden puede comentarla, excepto el gerente (solo lectura).
create or replace function public.comentar_orden(p_orden_id bigint, p_comentario text)
returns public.orden_eventos
language plpgsql security definer set search_path = public
as $$
declare
  v_evento public.orden_eventos;
begin
  if public.mi_rol() = 'gerente' or not public.puede_ver_orden_id(p_orden_id) then
    raise exception 'No tienes permiso para comentar esta orden';
  end if;
  if coalesce(length(trim(p_comentario)), 0) = 0 then
    raise exception 'El comentario está vacío';
  end if;

  insert into public.orden_eventos (orden_id, autor_id, tipo, comentario)
  values (p_orden_id, auth.uid(), 'comentario', p_comentario)
  returning * into v_evento;

  update public.ordenes set updated_at = now() where id = p_orden_id;
  return v_evento;
end;
$$;

-- ============================================================
-- Seguridad por filas (RLS)
-- ============================================================
alter table public.zonas         enable row level security;
alter table public.categorias    enable row level security;
alter table public.perfiles      enable row level security;
alter table public.ordenes       enable row level security;
alter table public.orden_eventos enable row level security;
alter table public.orden_fotos   enable row level security;

-- Catálogos: lectura para todo el personal con sesión.
create policy zonas_lectura      on public.zonas      for select to authenticated using (true);
create policy categorias_lectura on public.categorias for select to authenticated using (true);

-- Directorio interno: todo el personal ve nombres, rol y área.
create policy perfiles_lectura on public.perfiles for select to authenticated using (true);

-- Órdenes: solo lectura directa. Las escrituras van por las funciones de arriba.
create policy ordenes_lectura on public.ordenes for select to authenticated
  using (public.puede_ver_orden(ordenes));

create policy eventos_lectura on public.orden_eventos for select to authenticated
  using (public.puede_ver_orden_id(orden_id));

create policy fotos_lectura on public.orden_fotos for select to authenticated
  using (public.puede_ver_orden_id(orden_id));

-- Fotos: sube quien puede ver la orden, salvo el gerente.
create policy fotos_alta on public.orden_fotos for insert to authenticated
  with check (
    subida_por = auth.uid()
    and public.mi_rol() is distinct from 'gerente'
    and public.puede_ver_orden_id(orden_id)
    and split_part(storage_path, '/', 1) = orden_id::text
  );

-- Permisos de tabla: sin escritura directa sobre órdenes ni eventos.
revoke all on public.ordenes, public.orden_eventos, public.orden_fotos,
              public.zonas, public.categorias, public.perfiles from anon, authenticated;
grant select on public.zonas, public.categorias, public.perfiles,
                public.ordenes, public.orden_eventos, public.orden_fotos to authenticated;
grant insert on public.orden_fotos to authenticated;

revoke execute on function public.crear_orden(bigint, bigint, text, public.prioridad, boolean, text),
                           public.asignar_orden(bigint, uuid, text),
                           public.cambiar_estatus(bigint, public.estatus_orden, text),
                           public.comentar_orden(bigint, text) from public, anon;
grant execute on function public.crear_orden(bigint, bigint, text, public.prioridad, boolean, text),
                          public.asignar_orden(bigint, uuid, text),
                          public.cambiar_estatus(bigint, public.estatus_orden, text),
                          public.comentar_orden(bigint, text) to authenticated;

-- ============================================================
-- Vista para bandejas y dashboard (respeta la RLS de quien consulta)
-- ============================================================
create view public.v_ordenes
with (security_invoker = true)
as
select
  o.id, o.folio, o.estatus, o.prioridad, o.riesgo_socios, o.area,
  o.descripcion, o.ubicacion_detalle,
  z.id as zona_id, z.nombre as zona,
  c.id as categoria_id, c.nombre as categoria,
  o.departamento_solicitante,
  o.reportado_por, rp.nombre as reportado_por_nombre,
  o.asignado_a,   ap.nombre as asignado_a_nombre,
  o.created_at, o.updated_at, o.asignada_at, o.resuelta_at, o.cerrada_at,
  extract(day from (coalesce(o.cerrada_at, now()) - o.created_at))::int as dias_abierta
from public.ordenes o
join public.zonas z       on z.id = o.zona_id
join public.categorias c  on c.id = o.categoria_id
join public.perfiles rp   on rp.id = o.reportado_por
left join public.perfiles ap on ap.id = o.asignado_a;

grant select on public.v_ordenes to authenticated;
