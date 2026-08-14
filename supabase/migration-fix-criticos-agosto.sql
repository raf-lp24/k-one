-- ============================================================
-- K-ONE — Migración URGENTE: 2 vulnerabilidades críticas nuevas
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
-- EJECUTAR ESTA ANTES QUE CUALQUIER OTRA COSA, incluso antes de las
-- 3 migraciones pendientes de la ronda anterior (testimonios/rate-limits/
-- mensajes_cliente). Esto es más grave que todo lo anterior junto.
--
-- ============================================================
-- 1) VISTA admin_clientes SIN PROTECCIÓN REAL
-- ============================================================
-- El comentario original en schema.sql decía "esta vista NO es accesible
-- para usuarios normales (RLS de las tablas base la protege)" -- eso es
-- FALSO en Postgres/Supabase: una vista normal (sin security_invoker)
-- se ejecuta con los privilegios de quien la CREÓ (el rol postgres, que
-- no está sujeto a RLS), no con los privilegios de quien la consulta.
-- Supabase además concede SELECT por defecto a anon/authenticated sobre
-- los objetos nuevos del schema public.
--
-- Sin este fix: cualquiera con la clave pública (anon key, que está en
-- el propio index.html porque está DISEÑADA para ser pública) podía
-- hacer un GET directo a
--   https://rfdrqbnzceudwclagjvp.supabase.co/rest/v1/admin_clientes?select=*
-- sin sesión, sin ser admin, y recibir email, lesión, alergia,
-- medicación, objetivo, plan y estado de pago de TODOS los clientes.
--
-- El fix: forzar que la vista respete los privilegios/RLS de quien
-- consulta (no del propietario), Y ADEMÁS quitar el acceso por defecto
-- a anon/authenticated como cinturón de seguridad extra. El panel de
-- admin real sigue funcionando exactamente igual porque ya usa
-- supabaseAdmin (service_role) en api/admin-clientes.js, que ignora
-- RLS y estos revokes por diseño de Supabase.
alter view public.admin_clientes set (security_invoker = on);
revoke all on public.admin_clientes from anon, authenticated;

-- ============================================================
-- 2) crear_codigo_promo() SIN "REVOKE EXECUTE"
-- ============================================================
-- Es SECURITY DEFINER (bypasea RLS de codigos_promo por diseño, para que
-- el backend pueda crear códigos). En Postgres, a diferencia de las
-- tablas, el EXECUTE de una función se concede a PUBLIC por defecto al
-- crearla -- su función hermana canjear_codigo_promo() SÍ tiene el
-- revoke (ver migration-codigos-promo.sql línea ~179), pero a esta se le
-- olvidó.
--
-- Sin este fix: cualquier usuario con sesión (con su propio JWT normal,
-- sin ser admin) podía llamar desde la consola del navegador:
--   supabase.rpc('crear_codigo_promo', { p_codigo:'HACK', p_tipo:'mes_gratis', p_valor:3650, ... })
-- crear un código con años de descuento, guardarlo en su propio perfil,
-- y canjearlo al pagar -- suscripción gratis indefinida.
--
-- IMPORTANTE: la firma exacta (nombres y tipos de los parámetros) tiene
-- que coincidir con la función real. Cópiala tal cual aparece en
-- migration-codigos-promo.sql si difiere de esta -- Postgres identifica
-- las funciones por nombre + firma completa de parámetros.
revoke execute on function public.crear_codigo_promo(text, text, int, text, int, timestamptz) from anon, authenticated;

-- ============================================================
-- 3) beta_expires: columna usada en el código desde hace tiempo pero nunca
-- documentada en schema.sql -- se añade aquí y se protege con el mismo
-- trigger que ya protege is_beta (igual de sensible: gatilla acceso
-- premium gratuito junto con is_beta).
-- ============================================================
alter table public.profiles add column if not exists beta_expires timestamptz;

create or replace function public.protect_profile_sensitive_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_beta := old.is_beta;
    new.beta_expires := old.beta_expires;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 5) BUCKET "backups" (Storage) — cerrarlo a cal y canto
-- ============================================================
-- api/notify.js sube ahí cada día un volcado completo de profiles+
-- subscriptions+email_log (PII + datos de salud + historial de pago) desde
-- el cron, usando el service_role (que ignora RLS). No hay ninguna política
-- de Storage para este bucket en el repo -- si en algún momento se marcó
-- el bucket como "público" en el dashboard de Supabase (Storage → backups →
-- configuración), cualquiera con la URL podría descargar el backup entero
-- sin autenticarse. Esto lo cierra explícitamente para anon/authenticated,
-- sin afectar al cron (que sigue escribiendo con service_role).
--
-- IMPORTANTE: además de ejecutar esto, entra en Supabase → Storage →
-- bucket "backups" → Settings y confirma que "Public bucket" esté
-- DESACTIVADO. Si el bucket está marcado público, esta política NO es
-- suficiente -- un bucket público sirve cualquier archivo a cualquiera
-- sin pasar por RLS en absoluto, sea cual sea la política.
--
-- Se usa "AS RESTRICTIVE" a propósito, no una política normal (permisiva):
-- en Postgres, varias políticas permisivas para la misma tabla se combinan
-- con OR, así que una política permisiva nueva podría SUMAR acceso a
-- buckets que no conozco (como fotos-progreso) en vez de solo restringir
-- backups. Una política restrictiva se combina con AND -- solo puede
-- QUITAR acceso, nunca dar de más, sea cual sea el resto de políticas que
-- ya existan en storage.objects que no puedo ver desde el repo.
drop policy if exists "backups_no_public_access" on storage.objects;
create policy "backups_no_public_access" on storage.objects
  as restrictive
  for all
  using (bucket_id != 'backups')
  with check (bucket_id != 'backups');

-- ============================================================
-- 6) VERIFICACIÓN — ejecuta esto DESPUÉS de lo anterior para confirmar
-- que ha funcionado (debería devolver 0 filas / error de permisos, no
-- datos reales)
-- ============================================================
-- select * from public.admin_clientes limit 1;  -- ejecútalo conectado como anon/authenticated normal, no como owner del proyecto
