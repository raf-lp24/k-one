-- =============================================================================
--  K-ONE · Auditoría completa 27 sept 2026 — permisos de funciones RPC
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run.
--
--  QUÉ ARREGLA
--  Varias migraciones anteriores quitaban el permiso de ejecutar funciones
--  sensibles con "revoke ... from public". En Supabase eso NO basta: el
--  proyecto concede EXECUTE de forma EXPLÍCITA a los roles anon y
--  authenticated al crear cada función, y ese grant no depende de PUBLIC.
--  Comprobado en vivo con la clave pública de la web, sin sesión:
--
--    · reclamar_descuento_referidos(uuid)  -> se ejecutaba (devolvía 0).
--      Pone a 0 el descuento por referidos de CUALQUIER cliente.
--    · check_rate_limit(...)               -> se ejecutaba (devolvía true).
--      Permitía llenar la tabla rate_limits_contador sin límite y agotar el
--      contador de la IP de otra persona (bloquearle contacto / leads).
--    · buscar_referrer_por_codigo(text)    -> devolvía el ID interno del
--      cliente dueño de un código de invitación (código que se comparte en
--      público). Junto con la primera, un anónimo podía borrar el descuento
--      acumulado de cualquier cliente solo con su código.
--
--  El servidor (api/*.js) llama a estas funciones con la service role, así
--  que quitarles el permiso a anon/authenticated no rompe nada.
-- =============================================================================

-- 1. Solo el backend -----------------------------------------------------------
revoke execute on function public.reclamar_descuento_referidos(uuid) from anon, authenticated;
revoke execute on function public.check_rate_limit(text, int, timestamptz) from anon, authenticated;

-- 2. Comprobar un código de invitación sin revelar a quién pertenece ------------
-- La web solo necesita saber si el código existe (sí/no). index.html usa esta
-- función y, si aún no existe, cae a la antigua -- por eso se puede aplicar la
-- migración antes o después del despliegue sin romper el registro.
create or replace function public.codigo_invitacion_existe(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where codigo_referido = upper(trim(p_codigo))
  );
$$;
grant execute on function public.codigo_invitacion_existe(text) to anon, authenticated;

-- La antigua devuelve el UUID del cliente: fuera del alcance público.
revoke execute on function public.buscar_referrer_por_codigo(text) from anon, authenticated;

-- 3. Limpieza de la prueba de la auditoría (fila creada al comprobar el fallo) --
delete from public.rate_limits_contador where clave = 'audit_test';

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después; las 3 primeras deben dar false
-- =============================================================================
-- select has_function_privilege('anon', 'public.reclamar_descuento_referidos(uuid)', 'execute');
-- select has_function_privilege('anon', 'public.check_rate_limit(text, int, timestamptz)', 'execute');
-- select has_function_privilege('anon', 'public.buscar_referrer_por_codigo(text)', 'execute');
-- select has_function_privilege('anon', 'public.codigo_invitacion_existe(text)', 'execute');  -- true
