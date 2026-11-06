-- ============================================================
-- K-ONE — Migración: 3 hallazgos de la auditoría de seguridad del 18 ago 2026
-- (RLS de referidos, nota_admin sin proteger, límites del bucket de fotos)
-- ============================================================

-- ============================================================
-- 1) referidos_insert_self solo valida referido_id, no referrer_id
-- ============================================================
-- migration-referidos.sql:114-116 deja pasar cualquier UUID como
-- referrer_id -- un usuario podría hacer desde la consola:
--   supabase.from('referidos').insert({referrer_id:'<uuid-cualquiera>', referido_id: suPropioId, ...})
-- Hoy no es explotable económicamente porque el bloque que acredita el
-- descuento está desactivado (api/stripe-webhook.js, "if (false && userId)"),
-- pero conviene cerrarlo antes de reactivar esa lógica. Se sustituye el
-- insert directo desde el cliente por una función SECURITY DEFINER que
-- resuelve el referrer a partir del CÓDIGO (no de un UUID que el cliente
-- pueda inventar) y hace ella misma el insert.
create or replace function public.registrar_referido(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
  end if;

  select id into v_referrer_id from public.profiles
  where codigo_referido = upper(trim(coalesce(p_codigo, '')));

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_no_existe');
  end if;
  if v_referrer_id = v_user_id then
    return jsonb_build_object('ok', false, 'motivo', 'propio_codigo');
  end if;

  update public.profiles set referido_por = upper(trim(p_codigo)) where id = v_user_id;

  insert into public.referidos (referrer_id, referido_id, referido_email, estado)
  values (v_referrer_id, v_user_id, (select email from auth.users where id = v_user_id), 'pendiente')
  on conflict (referido_id) do nothing;

  return jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
end;
$$;

revoke execute on function public.registrar_referido(text) from public;
grant execute on function public.registrar_referido(text) to authenticated;

-- Ya no hace falta que el cliente inserte directamente -- todo pasa por la
-- función de arriba. Se retira el insert abierto (con referrer_id sin validar).
drop policy if exists "referidos_insert_self" on public.referidos;

-- ============================================================
-- 2) profiles.nota_admin sin proteger contra el propio usuario
-- ============================================================
-- migration-last-seen.sql añadió esta columna (notas internas del admin en
-- el CRM) pero protect_profile_sensitive_cols() no la incluyó -- cualquier
-- usuario puede sobrescribir su propia nota vía profiles_update_own. Sin
-- fuga de datos ni XSS (se escapa en el panel admin), pero rompe la
-- integridad de las notas si un cliente decide borrarlas o falsearlas.
create or replace function public.protect_profile_sensitive_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_beta := old.is_beta;
    new.beta_expires := old.beta_expires;
    new.descuento_referidos := old.descuento_referidos;
    new.nota_admin := old.nota_admin;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 3) Bucket de fotos de progreso sin límites de tipo/tamaño en el servidor
-- ============================================================
-- index.html ya valida tipo y tamaño (≤12MB) en el cliente y siempre
-- re-codifica a JPEG vía <canvas>, así que la subida normal es segura. Pero
-- nada impide que alguien llame a storage.upload() directamente (con sesión
-- válida, dentro de su propia carpeta por RLS) y suba un archivo distinto a
-- una imagen con el content-type manipulado. Se cierra a nivel de bucket.
-- OJO: ajusta 'fotos-progreso' si el bucket real se llama distinto (revísalo
-- en Supabase Storage antes de ejecutar esta parte).
update storage.buckets
set file_size_limit = 12582912, -- 12MB, igual que el límite del cliente
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'fotos-progreso';

-- ============================================================
-- VERIFICACIÓN — ejecuta esto después para confirmar
-- ============================================================
-- select has_function_privilege('authenticated', 'public.registrar_referido(text)', 'execute');
-- -- debe devolver true
-- select policyname from pg_policies where tablename = 'referidos' and policyname = 'referidos_insert_self';
-- -- debe devolver 0 filas (borrada)
-- select prosrc from pg_proc where proname = 'protect_profile_sensitive_cols';
-- -- debe incluir "new.nota_admin := old.nota_admin;"
-- select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'fotos-progreso';
-- -- debe mostrar el límite y los tipos de arriba (si el nombre del bucket no
-- -- coincide, esta fila sale vacía -- corrige el nombre y repite el UPDATE)
