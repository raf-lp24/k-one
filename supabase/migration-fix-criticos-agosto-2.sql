-- ============================================================
-- K-ONE — Migración URGENTE #2: descuento_referidos autoconcedible +
-- políticas huérfanas que anulan protecciones ya existentes
-- ============================================================
-- Encontrado al auditar TODAS las políticas de TODAS las tablas (no solo
-- las que ya conocíamos). Ejecutar cuanto antes, especialmente el punto 1.

-- ============================================================
-- 1) CRÍTICO: descuento_referidos sin proteger
-- ============================================================
-- profiles_update_own permite actualizar tu propia fila sin restricción de
-- columna. El trigger protect_profile_sensitive_cols() solo protegía
-- is_beta/beta_expires -- descuento_referidos se quedó fuera.
--
-- api/stripe-webhook.js (case customer.subscription.updated) lee ese campo
-- directamente del perfil y lo aplica como saldo NEGATIVO REAL en Stripe en
-- cada renovación, sin comprobar contra la tabla referidos si el descuento
-- se ganó de verdad, y sin ningún tope máximo en ese punto del código (el
-- límite de 15€ solo existe en el bloque que acredita nuevos referidos, que
-- está desactivado -- este bloque de APLICAR el descuento no tiene límite).
--
-- Sin este fix: cualquier usuario con sesión puede hacer
--   supabase.from('profiles').update({ descuento_referidos: 1000 }).eq('id', suPropioId)
-- desde la consola del navegador y quedarse la suscripción gratis
-- indefinidamente en su siguiente renovación.
create or replace function public.protect_profile_sensitive_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_beta := old.is_beta;
    new.beta_expires := old.beta_expires;
    new.descuento_referidos := old.descuento_referidos;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 2) testimonios_public_read anula la moderación
-- ============================================================
-- Política vieja (using (true), rol public) que nunca se borró al aplicar
-- migration-testimonios-moderacion.sql. Las políticas permisivas se
-- combinan con OR, así que "aprobado = true" quedaba anulada por esta:
-- cualquier testimonio sin aprobar seguía siendo público.
drop policy if exists "testimonios_public_read" on public.testimonios;

-- ============================================================
-- 3) invitaciones_premium totalmente abierta
-- ============================================================
-- invitaciones_select (rol anon+authenticated, using true): cualquiera podía
-- leer TODOS los emails invitados a premium, no solo el suyo.
-- invitaciones_delete (rol authenticated, using true): cualquier usuario
-- logueado podía borrar la invitación de OTRO usuario.
-- Las políticas correctas (limitadas a "tu propio email") ya existen al
-- lado (invitaciones_select_own, invitaciones_delete_own, "Usuario lee/borra
-- su invitación") -- estas dos solo sobraban y las anulaban.
drop policy if exists "invitaciones_select" on public.invitaciones_premium;
drop policy if exists "invitaciones_delete" on public.invitaciones_premium;

-- ============================================================
-- 4) referidos con escritura abierta a cualquiera
-- ============================================================
-- "Service role inserta" y "Service role actualiza" tienen roles = public
-- (cualquiera, no solo service_role) y using/with_check = true sin ninguna
-- comprobación de propiedad. El service_role real NO necesita ninguna
-- política porque salta RLS por diseño -- estas dos solo abrían la tabla a
-- cualquier usuario (insertar filas de referido falsas, modificar
-- referrer_id/referido_id/estado de cualquier fila).
drop policy if exists "Service role inserta" on public.referidos;
drop policy if exists "Service role actualiza" on public.referidos;

-- ============================================================
-- 5) VERIFICACIÓN — ejecuta esto después para confirmar
-- ============================================================
-- select prosrc from pg_proc where proname = 'protect_profile_sensitive_cols';
-- -- debe incluir la línea "new.descuento_referidos := old.descuento_referidos;"
--
-- select tablename, policyname from pg_policies
-- where schemaname = 'public'
--   and (
--     (tablename = 'testimonios' and policyname = 'testimonios_public_read')
--     or (tablename = 'invitaciones_premium' and policyname in ('invitaciones_select','invitaciones_delete'))
--     or (tablename = 'referidos' and policyname in ('Service role inserta','Service role actualiza'))
--   );
-- -- debe devolver 0 filas (todas borradas)
