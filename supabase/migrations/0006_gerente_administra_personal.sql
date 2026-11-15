-- El gerente administra el personal de todas las áreas (alta, edición, baja y reactivación).
-- El supervisor sigue administrando el de su área. Todo por RPC; no hay escritura directa.

create function public.guardar_personal(
  p_id uuid, p_nombre text, p_area public.area_servicio, p_tipo text,
  p_empresa text default null, p_puesto text default null, p_zona text default null)
returns public.personal
language plpgsql security definer set search_path = public
as $$
declare
  v_rol text := public.mi_rol();
  v_area public.area_servicio;
  v_ant public.personal;
  v public.personal;
  v_abiertas int;
begin
  if v_rol not in ('gerente', 'supervisor') then raise exception 'Solo gerente o supervisor pueden administrar personal'; end if;
  if p_tipo not in ('interno', 'externo') then raise exception 'Tipo inválido'; end if;
  if nullif(trim(p_nombre), '') is null then raise exception 'El nombre es obligatorio'; end if;

  if v_rol = 'supervisor' then
    v_area := public.mi_area();
    if p_area is not null and p_area <> v_area then raise exception 'Un supervisor solo administra personal de su área'; end if;
  else
    v_area := p_area;
    if v_area is null then raise exception 'Indica el área'; end if;
  end if;

  if p_id is null then
    insert into public.personal (nombre, area, tipo, empresa, puesto, zona_asignada)
    values (trim(p_nombre), v_area, p_tipo,
            case when p_tipo = 'externo' then nullif(trim(p_empresa), '') end,
            nullif(trim(p_puesto), ''), nullif(trim(p_zona), ''))
    returning * into v;
    return v;
  end if;

  select * into v_ant from public.personal where id = p_id;
  if not found then raise exception 'Persona no encontrada'; end if;
  if v_rol = 'supervisor' and v_ant.area <> public.mi_area() then raise exception 'Persona no encontrada en tu área'; end if;

  if v_ant.area <> v_area then
    select count(*) into v_abiertas from public.ordenes
     where asignado_a = p_id and estatus in ('nueva', 'asignada', 'en_proceso', 'en_espera');
    if v_abiertas > 0 then
      raise exception 'Tiene % orden(es) abiertas asignadas; reasígnalas antes de cambiarle de área', v_abiertas;
    end if;
  end if;

  update public.personal set
    nombre = trim(p_nombre), area = v_area, tipo = p_tipo,
    empresa = case when p_tipo = 'externo' then nullif(trim(p_empresa), '') end,
    puesto = nullif(trim(p_puesto), ''), zona_asignada = nullif(trim(p_zona), '')
  where id = p_id returning * into v;
  return v;
end;
$$;

create or replace function public.activar_personal(p_id uuid, p_activo boolean)
returns public.personal
language plpgsql security definer set search_path = public
as $$
declare
  v_rol text := public.mi_rol();
  v public.personal;
  v_abiertas int;
begin
  if v_rol not in ('gerente', 'supervisor') then raise exception 'Solo gerente o supervisor pueden modificar personal'; end if;
  select * into v from public.personal
   where id = p_id and (v_rol = 'gerente' or area = public.mi_area());
  if not found then raise exception 'Persona no encontrada en tu área'; end if;
  if not p_activo then
    select count(*) into v_abiertas from public.ordenes
     where asignado_a = p_id and estatus in ('nueva', 'asignada', 'en_proceso', 'en_espera');
    if v_abiertas > 0 then
      raise exception 'Tiene % orden(es) abiertas asignadas; reasígnalas antes de darle de baja', v_abiertas;
    end if;
  end if;
  update public.personal set activo = p_activo where id = p_id returning * into v;
  return v;
end;
$$;

revoke execute on function public.guardar_personal(uuid, text, public.area_servicio, text, text, text, text) from public, anon;
grant execute on function public.guardar_personal(uuid, text, public.area_servicio, text, text, text, text) to authenticated;
