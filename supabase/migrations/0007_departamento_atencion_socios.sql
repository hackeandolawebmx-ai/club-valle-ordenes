-- Atención a socios es un departamento solicitante más (como Deportes o Alimentos y bebidas).
-- Va en su propia migración porque un valor de enum nuevo no se puede usar en la misma transacción.
alter type public.departamento add value if not exists 'atencion_socios';
