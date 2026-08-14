-- ============================================================
-- K-ONE — Migración: cerrar el bucket "fotos-progreso" a solo el dueño
-- ============================================================
-- Contexto: el código (index.html) ya se cambió para pedir URLs FIRMADAS
-- (createSignedUrl, caducan a los 7 días y se renuevan solas) en vez de
-- guardar la URL pública fija de cada foto. Eso por sí solo NO cierra nada
-- todavía: si el bucket sigue marcado como "Public bucket" en Supabase, o
-- si ya existe una política de storage.objects demasiado abierta, cualquiera
-- con la ruta (o con acceso de "authenticated" a todo el bucket) seguiría
-- pudiendo leer/subir/borrar fotos de OTRO usuario.
--
-- PASO 1 (hazlo tú primero, antes de tocar nada): entra en el SQL Editor de
-- Supabase y ejecuta esto para ver qué políticas existen HOY en
-- storage.objects (de todos los buckets, no solo este):
--
--   select policyname, cmd, permissive, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';
--
-- Pégame el resultado tal cual. Si aparece alguna política permisiva que
-- diga algo como "true" o que no filtre por bucket_id/carpeta, hay que
-- ajustarla antes de continuar (una política mía nueva solo SUMA acceso,
-- nunca quita, así que si ya hay una demasiado abierta esto no basta).
--
-- PASO 2 (una vez visto el resultado del paso 1): estas son las políticas
-- que necesita el bucket "fotos-progreso" — cada usuario autenticado puede
-- leer/subir/actualizar/borrar SOLO dentro de su propia carpeta (la ruta es
-- siempre "<user_id>/archivo.jpg", así que el primer segmento de la ruta
-- es el dueño real).
drop policy if exists "fotos_progreso_select_own" on storage.objects;
create policy "fotos_progreso_select_own" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'fotos-progreso' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos_progreso_insert_own" on storage.objects;
create policy "fotos_progreso_insert_own" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'fotos-progreso' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos_progreso_update_own" on storage.objects;
create policy "fotos_progreso_update_own" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'fotos-progreso' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos-progreso' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos_progreso_delete_own" on storage.objects;
create policy "fotos_progreso_delete_own" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'fotos-progreso' and (storage.foldername(name))[1] = auth.uid()::text);

-- PASO 3 — MUY IMPORTANTE, y en este orden exacto:
--   1. Despliega primero el cambio de código (ya hecho, pendiente de tu OK para subir).
--   2. Ejecuta este archivo.
--   3. Sube una foto de perfil o de progreso de verdad, cierra sesión, entra
--      de nuevo y comprueba que se sigue viendo. Si algo se rompe, AVISA antes
--      de seguir.
--   4. Solo cuando lo anterior funcione: entra en Supabase → Storage → bucket
--      "fotos-progreso" → Configuration y desactiva "Public bucket".
-- Si desactivas el bucket ANTES del paso 3, las fotos que la gente ya tenga
-- guardadas con la URL pública antigua (de antes de este cambio) dejarán de
-- verse hasta que las vuelvan a subir. Con el orden de arriba no pasa nada
-- de eso mientras se prueba primero.
