-- Club Valle · Bucket privado para fotos de órdenes.
-- Ruta de cada archivo: <orden_id>/<nombre>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('orden-fotos', 'orden-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Ver fotos: quien puede ver la orden.
create policy "orden_fotos_ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'orden-fotos'
    and (storage.foldername(name))[1] ~ '^[0-9]+$'
    and public.puede_ver_orden_id(((storage.foldername(name))[1])::bigint)
  );

-- Subir fotos: quien puede ver la orden, excepto el gerente (solo lectura).
create policy "orden_fotos_subir" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'orden-fotos'
    and (storage.foldername(name))[1] ~ '^[0-9]+$'
    and public.mi_rol() is distinct from 'gerente'
    and public.puede_ver_orden_id(((storage.foldername(name))[1])::bigint)
  );
