-- =============================================================================
--  K-ONE · Auditoría 2 sept 2026 — índices y grants
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run. Es seguro
--  ejecutarlo más de una vez (todo es CREATE INDEX IF NOT EXISTS / DO block
--  con manejo de "ya existe" o de duplicados).
--
--  Qué hace:
--  1. profiles: índice en created_at (lo usa api/admin-clientes.js para
--     ordenar/paginar la lista de clientes de Jarvis -- sin él, seq scan +
--     sort completo de la tabla en cada página).
--  2. subscriptions: índice en stripe_customer_id (api/stripe-webhook.js
--     busca por esta columna en varios puntos, en cada evento de Stripe) y
--     UNIQUE si no hay ya duplicados (dos filas con el mismo Customer
--     romperían en silencio cualquier .maybeSingle() que busque por aquí).
--  3. buscar_referrer_por_codigo(): grant explícito a anon/authenticated.
--     No cambia el comportamiento actual (ya funciona vía el PUBLIC
--     implícito de Postgres) -- deja por escrito que el acceso desde el
--     frontend es intencional, para que sobreviva a un futuro
--     "revoke ... from public" a nivel de proyecto.
-- =============================================================================

-- 1. profiles.created_at ------------------------------------------------
create index if not exists profiles_created_at_idx on public.profiles (created_at);

-- 2. subscriptions.stripe_customer_id ------------------------------------
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- CORRECCIÓN (auditoría 2 sept 2026): "add constraint ... unique" con nombre
-- repetido lanza 42P07 (duplicate_table), no 42710 (duplicate_object) -- el
-- exception handler original nunca lo atrapaba de verdad. Comprobar contra
-- pg_constraint primero evita depender de adivinar el SQLSTATE exacto.
do $$
declare
  v_duplicados int;
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_stripe_customer_id_unique' and conrelid = 'public.subscriptions'::regclass
  ) then
    select count(*) into v_duplicados from (
      select stripe_customer_id from public.subscriptions
      where stripe_customer_id is not null group by stripe_customer_id having count(*) > 1
    ) t;
    if v_duplicados = 0 then
      alter table public.subscriptions add constraint subscriptions_stripe_customer_id_unique unique (stripe_customer_id);
    else
      raise notice 'subscriptions.stripe_customer_id: % duplicados -- no se añadió UNIQUE.', v_duplicados;
    end if;
  end if;
end $$;

-- 3. buscar_referrer_por_codigo() ----------------------------------------
grant execute on function public.buscar_referrer_por_codigo(text) to anon, authenticated;

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select indexname from pg_indexes where tablename in ('profiles','subscriptions')
--   and indexname in ('profiles_created_at_idx','subscriptions_stripe_customer_id_idx');
-- -- debe devolver las 2 filas
-- select conname from pg_constraint where conname = 'subscriptions_stripe_customer_id_unique';
-- -- devuelve 1 fila si no había duplicados, 0 filas si el RAISE NOTICE avisó de duplicados
