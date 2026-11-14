-- Sesión 2 · Cambios de estructura
--   1. El personal operativo deja de ser usuario del sistema: vive en `personal`
--      (internos y externos) y lo gestiona el supervisor de su área.
--   2. Compras es un área más; una orden se puede reasignar entre áreas.
--   3. Un reporte repetido se cierra como duplicado señalando la orden original.
--   4. Búsqueda de órdenes similares para avisar antes de levantar un reporte repetido.

-- ============================================================
-- 1. Personal (sin acceso al sistema)
-- ============================================================
create table public.personal (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (length(trim(nombre)) > 0),
  area       public.area_servicio not null,
  tipo       text not null default 'interno' check (tipo in ('interno', 'externo')),
  empresa    text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index personal_area_idx on public.personal (area, activo);

alter table public.personal enable row level security;
create policy personal_lectura on public.personal for select to authenticated using (true);
revoke all on public.personal from anon, authenticated;
grant select on public.personal to authenticated;

-- Los operativos que ya existían pasan a personal conservando su id.
insert into public.personal (id, nombre, area, tipo)
select id, nombre, area, 'interno' from public.perfiles where rol = 'operativo'
on conflict (id) do nothing;

alter table public.ordenes       drop constraint ordenes_asignado_a_fkey;
alter table public.orden_eventos drop constraint orden_eventos_asignado_a_fkey;
alter table public.ordenes       add constraint ordenes_asignado_a_fkey
  foreign key (asignado_a) references public.personal (id);
alter table public.orden_eventos add constraint orden_eventos_asignado_a_fkey
  foreign key (asignado_a) references public.personal (id);

-- El rol operativo ya no inicia sesión (el valor del enum se conserva por historia).
update public.perfiles set activo = false where rol = 'operativo';
alter table public.perfiles
  add constraint perfil_sin_operativo check (rol <> 'operativo') not valid;

-- ============================================================
-- 2 y 3. Columnas nuevas en órdenes y eventos
-- ============================================================
alter table public.ordenes
  add column area_origen      public.area_servicio,
  add column duplicada_de     bigint references public.ordenes (id),
  add column duplicada_folio  text,
  add column cierre_motivo    text check (cierre_motivo in ('duplicado'));
update public.ordenes set area_origen = area;
alter table public.ordenes alter column area_origen set not null;

alter table public.orden_eventos
  add column area_anterior public.area_servicio,
  add column area_nueva    public.area_servicio;

create or replace function public.tg_ordenes_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select c.area into new.area from public.categorias c where c.id = new.categoria_id;
  if new.area is null then
    raise exception 'Categoría inválida';
  end if;
  new.area_origen := new.area;
  select p.departamento into new.departamento_solicitante from public.perfiles p where p.id = new.reportado_por;
  new.folio := case new.area when 'mantenimiento' then 'MAN-' when 'intendencia' then 'INT-' else 'COM-' end
               || lpad(new.id::text, 5, '0');
  return new;
end;
$$;

-- Visibilidad: el supervisor sigue viendo las órdenes que nacieron en su área
-- aunque se hayan reasignado a otra (por ejemplo, a Compras).
create or replace function public.puede_ver_orden(o public.ordenes)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case public.mi_rol()
    when 'gerente'     then true
    when 'supervisor'  then o.area = public.mi_area() or o.area_origen = public.mi_area() or o.reportado_por = auth.uid()
    when 'solicitante' then o.reportado_por = auth.uid()
    else false
  end;
$$;

-- ============================================================
-- Operaciones
-- ============================================================

-- Asignar o reasignar a una persona del personal del área (interna o externa).
drop function public.asignar_orden(bigint, uuid, text);
create function public.asignar_orden(p_orden_id bigint, p_personal_id uuid, p_comentario text default null)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_per   public.personal;
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

  select * into v_per from public.personal where id = p_personal_id and activo;
  if not found or v_per.area <> v_orden.area then
    raise exception 'Solo se puede asignar a personal activo de %', v_orden.area;
  end if;

  v_prev  := v_orden.estatus;
  v_nuevo := case when v_prev = 'nueva' then 'asignada'::public.estatus_orden else v_prev end;

  update public.ordenes
     set asignado_a = p_personal_id, estatus = v_nuevo,
         asignada_at = coalesce(asignada_at, now()), updated_at = now()
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, asignado_a, comentario)
  values (p_orden_id, auth.uid(), 'asignada', v_prev, v_nuevo, p_personal_id, p_comentario);

  return v_orden;
end;
$$;

-- Cambiar estatus: solo el supervisor del área. Él mueve la orden según lo que le
-- reporte su personal y es quien cierra.
create or replace function public.cambiar_estatus(p_orden_id bigint, p_estatus public.estatus_orden, p_comentario text default null)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_ok    boolean;
  v_prev  public.estatus_orden;
begin
  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  v_prev := v_orden.estatus;

  if public.mi_rol() is distinct from 'supervisor' or v_orden.area is distinct from public.mi_area() then
    raise exception 'Solo el supervisor de % puede cambiar el estatus de esta orden', v_orden.area;
  end if;

  v_ok := (v_orden.estatus in ('asignada', 'en_proceso', 'en_espera') and p_estatus in ('en_proceso', 'en_espera', 'resuelta'))
       or (v_orden.estatus = 'resuelta' and p_estatus in ('cerrada', 'en_proceso'));
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

-- Reasignar la orden a otra área (p. ej. a Compras por una refacción, o de regreso).
-- Queda como "nueva" en el área destino, sin asignado, con el motivo en el historial.
create function public.reasignar_area(p_orden_id bigint, p_area public.area_servicio, p_comentario text)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_prev  public.estatus_orden;
  v_area_ant public.area_servicio;
begin
  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  if public.mi_rol() is distinct from 'supervisor' or v_orden.area is distinct from public.mi_area() then
    raise exception 'Solo el supervisor de % puede reasignar esta orden', v_orden.area;
  end if;
  if v_orden.estatus = 'cerrada' then raise exception 'La orden ya está cerrada'; end if;
  if p_area = v_orden.area then raise exception 'La orden ya está en esa área'; end if;
  if coalesce(length(trim(p_comentario)), 0) = 0 then raise exception 'Indica el motivo de la reasignación'; end if;

  v_prev := v_orden.estatus; v_area_ant := v_orden.area;

  update public.ordenes
     set area = p_area, estatus = 'nueva', asignado_a = null, asignada_at = null, resuelta_at = null, updated_at = now()
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, area_anterior, area_nueva, comentario)
  values (p_orden_id, auth.uid(), 'reasignacion', v_prev, 'nueva', v_area_ant, p_area, p_comentario);

  return v_orden;
end;
$$;

-- Cerrar un reporte repetido señalando la orden original.
create function public.cerrar_por_duplicado(p_orden_id bigint, p_original_id bigint, p_comentario text default null)
returns public.ordenes
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes;
  v_orig  public.ordenes;
  v_prev  public.estatus_orden;
begin
  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if public.mi_rol() is distinct from 'supervisor' or v_orden.area is distinct from public.mi_area() then
    raise exception 'Solo el supervisor de % puede cerrar esta orden', v_orden.area;
  end if;
  if v_orden.estatus = 'cerrada' then raise exception 'La orden ya está cerrada'; end if;
  if p_original_id = p_orden_id then raise exception 'Una orden no puede ser duplicado de sí misma'; end if;

  select * into v_orig from public.ordenes where id = p_original_id;
  if not found or not public.puede_ver_orden(v_orig) then raise exception 'Orden original no encontrada'; end if;
  if v_orig.cierre_motivo = 'duplicado' then raise exception 'La orden original ya está cerrada como duplicado'; end if;

  v_prev := v_orden.estatus;
  update public.ordenes
     set estatus = 'cerrada', cerrada_at = now(), updated_at = now(),
         duplicada_de = v_orig.id, duplicada_folio = v_orig.folio, cierre_motivo = 'duplicado'
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_eventos (orden_id, autor_id, tipo, estatus_anterior, estatus_nuevo, comentario)
  values (p_orden_id, auth.uid(), 'cambio_estatus', v_prev, 'cerrada',
          'Cerrada por reporte repetido de ' || v_orig.folio || coalesce('. ' || nullif(trim(p_comentario), ''), ''));

  insert into public.orden_eventos (orden_id, autor_id, tipo, comentario)
  values (v_orig.id, auth.uid(), 'comentario', 'Se cerró ' || v_orden.folio || ' como reporte repetido de esta falla.');
  update public.ordenes set updated_at = now() where id = v_orig.id;

  return v_orden;
end;
$$;

-- Órdenes abiertas de la misma zona y categoría (últimos 30 días). Sirve para avisar
-- antes de levantar un reporte repetido y para que el supervisor detecte duplicados.
-- Devuelve solo datos de la falla, sin quién la reportó.
create function public.ordenes_similares(p_zona_id bigint, p_categoria_id bigint, p_excluir bigint default null)
returns table (id bigint, folio text, estatus public.estatus_orden, descripcion text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select o.id, o.folio, o.estatus, o.descripcion, o.created_at
    from public.ordenes o
   where public.mi_rol() is not null
     and o.zona_id = p_zona_id and o.categoria_id = p_categoria_id
     and o.estatus <> 'cerrada'
     and o.created_at > now() - interval '30 days'
     and (p_excluir is null or o.id <> p_excluir)
   order by o.created_at desc
   limit 5;
$$;

-- Alta y baja de personal por el supervisor, solo en su área.
create function public.agregar_personal(p_nombre text, p_tipo text default 'interno', p_empresa text default null)
returns public.personal
language plpgsql security definer set search_path = public
as $$
declare v public.personal;
begin
  if public.mi_rol() is distinct from 'supervisor' then raise exception 'Solo un supervisor puede agregar personal'; end if;
  if p_tipo not in ('interno', 'externo') then raise exception 'Tipo inválido'; end if;
  insert into public.personal (nombre, area, tipo, empresa)
  values (trim(p_nombre), public.mi_area(), p_tipo, nullif(trim(p_empresa), ''))
  returning * into v;
  return v;
end;
$$;

create function public.activar_personal(p_id uuid, p_activo boolean)
returns public.personal
language plpgsql security definer set search_path = public
as $$
declare v public.personal;
begin
  if public.mi_rol() is distinct from 'supervisor' then raise exception 'Solo un supervisor puede modificar personal'; end if;
  update public.personal set activo = p_activo where id = p_id and area = public.mi_area() returning * into v;
  if not found then raise exception 'Persona no encontrada en tu área'; end if;
  return v;
end;
$$;

revoke execute on function public.asignar_orden(bigint, uuid, text),
  public.reasignar_area(bigint, public.area_servicio, text),
  public.cerrar_por_duplicado(bigint, bigint, text),
  public.ordenes_similares(bigint, bigint, bigint),
  public.agregar_personal(text, text, text),
  public.activar_personal(uuid, boolean) from public, anon;
grant execute on function public.asignar_orden(bigint, uuid, text),
  public.reasignar_area(bigint, public.area_servicio, text),
  public.cerrar_por_duplicado(bigint, bigint, text),
  public.ordenes_similares(bigint, bigint, bigint),
  public.agregar_personal(text, text, text),
  public.activar_personal(uuid, boolean) to authenticated;

-- ============================================================
-- Vista
-- ============================================================
drop view public.v_ordenes;
create view public.v_ordenes
with (security_invoker = true)
as
select
  o.id, o.folio, o.estatus, o.prioridad, o.riesgo_socios, o.area, o.area_origen,
  o.descripcion, o.ubicacion_detalle,
  z.id as zona_id, z.nombre as zona,
  c.id as categoria_id, c.nombre as categoria,
  o.departamento_solicitante,
  o.reportado_por, rp.nombre as reportado_por_nombre,
  o.asignado_a, ap.nombre as asignado_a_nombre, ap.tipo as asignado_a_tipo, ap.empresa as asignado_a_empresa,
  o.duplicada_de, o.duplicada_folio, o.cierre_motivo,
  o.created_at, o.updated_at, o.asignada_at, o.resuelta_at, o.cerrada_at,
  extract(day from (coalesce(o.cerrada_at, now()) - o.created_at))::int as dias_abierta
from public.ordenes o
join public.zonas z       on z.id = o.zona_id
join public.categorias c  on c.id = o.categoria_id
join public.perfiles rp   on rp.id = o.reportado_por
left join public.personal ap on ap.id = o.asignado_a;
grant select on public.v_ordenes to authenticated;
