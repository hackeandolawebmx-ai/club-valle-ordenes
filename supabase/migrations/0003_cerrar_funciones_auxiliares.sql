-- Cierra las funciones auxiliares al rol anónimo (hallazgo del asesor de seguridad de Supabase).
revoke execute on function public.mi_perfil(), public.mi_rol(), public.mi_area(),
  public.puede_ver_orden(public.ordenes), public.puede_ver_orden_id(bigint),
  public.tg_ordenes_before_insert() from public, anon;
revoke execute on function public.tg_ordenes_before_insert() from authenticated;
grant execute on function public.mi_perfil(), public.mi_rol(), public.mi_area(),
  public.puede_ver_orden(public.ordenes), public.puede_ver_orden_id(bigint) to authenticated;
revoke execute on function public.crear_orden(bigint, bigint, text, public.prioridad, boolean, text),
  public.asignar_orden(bigint, uuid, text),
  public.cambiar_estatus(bigint, public.estatus_orden, text),
  public.comentar_orden(bigint, text) from anon;
