-- =============================================================================
--  K-ONE · Auditoría 2 sept 2026 (ronda integral) — crédito de referidos atómico
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run.
--
--  api/stripe-webhook.js aplicaba el crédito de referidos en Stripe con un
--  patrón "leer, decidir, escribir" sin ningún candado: leía
--  profiles.descuento_referidos, si era > 0 llamaba a Stripe
--  (createBalanceTransaction) y SOLO DESPUÉS ponía la columna a 0. Dos
--  eventos customer.subscription.updated para el mismo cliente cercanos en
--  el tiempo (Stripe puede mandar varios seguidos para un solo cambio real)
--  podían leer ambos el mismo descuento &gt; 0 antes de que ninguno lo
--  pusiera a 0 -- y aplicar el crédito DOS VECES en el saldo real de Stripe.
--
--  Esta función reclama el descuento de forma atómica: bloquea la fila con
--  SELECT ... FOR UPDATE, y solo entonces la pone a 0 -- una segunda llamada
--  concurrente para el mismo usuario espera a que la primera termine y
--  encuentra el descuento ya en 0, así que no hay crédito duplicado posible.
-- =============================================================================

create or replace function public.reclamar_descuento_referidos(p_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descuento numeric;
begin
  select descuento_referidos into v_descuento
  from public.profiles
  where id = p_user_id
  for update;

  if v_descuento is null or v_descuento <= 0 then
    return 0;
  end if;

  update public.profiles set descuento_referidos = 0 where id = p_user_id;
  return v_descuento;
end;
$$;

-- Solo el backend (service role) debe llamar a esto -- salta RLS a propósito
-- para poder leer/escribir descuento_referidos de cualquier usuario, así que
-- no tiene sentido que ningún cliente pueda invocarla directamente.
revoke execute on function public.reclamar_descuento_referidos(uuid) from public;

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select proname from pg_proc where proname = 'reclamar_descuento_referidos';
-- select has_function_privilege('anon', 'public.reclamar_descuento_referidos(uuid)', 'execute');
-- -- debe devolver false
