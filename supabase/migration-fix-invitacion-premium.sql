-- ============================================================
-- K-ONE — Migración: arregla la concesión de premium por invitación
-- ============================================================
-- Encontrado en la auditoría de seguridad del 18 ago 2026.
--
-- migration-fix-criticos-agosto-2.sql añadió un trigger que protege
-- profiles.is_beta/beta_expires/descuento_referidos revirtiéndolos si
-- quien actualiza es 'authenticated' o 'anon'. Correcto para bloquear el
-- ataque de la consola del navegador -- pero index.html:18980 concede el
-- premium por invitación con exactamente ese mismo tipo de update desde el
-- cliente:
--   supa.from('profiles').update({ is_beta:true, beta_expires:... })
-- El propio trigger de seguridad lo neutraliza en silencio: is_beta se
-- queda en su valor anterior, sin ningún error visible. Desde que se aplicó
-- el fix de seguridad, nadie que se registre con una invitación premium
-- recibe el premium de verdad.
--
-- Solución: la misma que ya se usa para canjear_codigo_promo -- una
-- función SECURITY DEFINER que hace el update saltándose el trigger (porque
-- corre con los privilegios de quien la definió, no de 'authenticated').
--
-- Además cierra un matiz que el update directo tenía sin querer: el email
-- que se comprobaba contra invitaciones_premium venía del formulario de
-- registro (variable `email` del cliente), no de la sesión ya autenticada.
-- Aquí se usa auth.jwt()->>'email' (igual que las políticas RLS de esta
-- misma tabla en migration-referidos.sql) para que solo se pueda reclamar
-- la invitación del propio email verificado por Supabase Auth, nunca el de
-- otra persona.
create or replace function public.aplicar_invitacion_premium()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_expira timestamptz;
begin
  if v_user_id is null or v_email = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
  end if;

  if not exists (select 1 from public.invitaciones_premium where lower(email) = v_email) then
    return jsonb_build_object('ok', false, 'motivo', 'no_invitado');
  end if;

  v_expira := now() + interval '1 year';
  update public.profiles set is_beta = true, beta_expires = v_expira where id = v_user_id;
  delete from public.invitaciones_premium where lower(email) = v_email;

  return jsonb_build_object('ok', true, 'beta_expires', v_expira);
end;
$$;

revoke execute on function public.aplicar_invitacion_premium() from public;
grant execute on function public.aplicar_invitacion_premium() to authenticated;

-- ============================================================
-- VERIFICACIÓN — ejecuta esto después para confirmar
-- ============================================================
-- select has_function_privilege('authenticated', 'public.aplicar_invitacion_premium()', 'execute');
-- -- debe devolver true
-- select has_function_privilege('anon', 'public.aplicar_invitacion_premium()', 'execute');
-- -- debe devolver false
