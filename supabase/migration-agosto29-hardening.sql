-- =============================================================================
--  K-ONE · Auditoría 29 ago 2026 — refuerzos varios
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run. Es seguro
--  ejecutarlo más de una vez (todo es CREATE OR REPLACE / IF NOT EXISTS /
--  DO block con manejo de "ya existe").
--
--  Qué hace:
--  1. profiles: la columna `email` pasa a estar protegida por el mismo
--     trigger que ya protegía is_beta/beta_expires/descuento_referidos/
--     nota_admin. Un usuario podía cambiar su propio email en `profiles`
--     (sin tocar su email real de login) e igualarlo al de una invitación
--     premium ajena; admin-mensaje.js resuelve esa invitación por email al
--     borrar un cliente.
--  2. testimonios: `estrellas` pasa a estar acotado 1-5 a nivel de base de
--     datos (el insert público es intencional, pero sin tope cualquiera
--     podía mandar estrellas:-999 o 99999 directo por REST).
--  3. rate_limits_contador + check_rate_limit(): sustituye el rate-limit de
--     api/notify.js (contar filas y luego insertar, dos pasos no atómicos)
--     por un contador atómico de ventana fija -- mismo patrón que el candado
--     de doble-checkout. Sin esto, peticiones concurrentes podían saltarse
--     el límite de 3-5/hora en ráfaga.
--  4-6. Reafirma admin_clientes, índice de referidos.referrer_id y tope
--     inferior en descuento_referidos (ver comentarios en cada bloque).
--  7. sub_action_lock_until: candado para cancel/reactivate/update-
--     subscription (dos pestañas pisándose el estado en Stripe).
--  8. profiles.email UNIQUE (solo si no hay duplicados ya -- revisa los
--     RAISE NOTICE al ejecutar).
--  9. Normaliza el tipo de descuento_referidos a numeric por si seguía
--     siendo int en producción.
-- =============================================================================

-- 1. Proteger profiles.email igual que is_beta/beta_expires/descuento_referidos/nota_admin
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
    new.email := old.email;
  end if;
  return new;
end;
$$;

-- 2. Rango válido de estrellas en testimonios
do $$
begin
  alter table public.testimonios
    add constraint testimonios_estrellas_range check (estrellas between 1 and 5);
exception when duplicate_object then null;
end $$;

-- 3. Rate-limit atómico
create table if not exists public.rate_limits_contador (
  clave    text        not null,
  ventana  timestamptz not null,
  contador int         not null default 1,
  primary key (clave, ventana)
);
alter table public.rate_limits_contador enable row level security;

create or replace function public.check_rate_limit(p_clave text, p_limite int, p_ventana timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contador int;
begin
  insert into public.rate_limits_contador (clave, ventana, contador)
  values (p_clave, p_ventana, 1)
  on conflict (clave, ventana) do update
    set contador = public.rate_limits_contador.contador + 1
    where public.rate_limits_contador.contador < p_limite
  returning contador into v_contador;

  return v_contador is not null;
end;
$$;

revoke all on function public.check_rate_limit(text, int, timestamptz) from public;
grant execute on function public.check_rate_limit(text, int, timestamptz) to service_role;

-- 4. Reafirma el cierre de admin_clientes (ya aplicado en agosto, se repite
--    aquí por si acaso -- operación segura de re-ejecutar).
alter view public.admin_clientes set (security_invoker = on);
revoke all on public.admin_clientes from anon, authenticated;

-- 5. Índice que faltaba en referidos.referrer_id (solo referido_id tenía
--    índice implícito por su unique) -- toda consulta "mis referidos" y el
--    propio filtro RLS de referidos_select_own hacía seq scan. No va en
--    schema.sql porque esa tabla no vive ahí (la crea migration-
--    referidos.sql) y schema.sql debe poder ejecutarse solo sin fallar.
create index if not exists referidos_referrer_id_idx on public.referidos (referrer_id);

-- 6. Tope inferior en descuento_referidos a nivel de BD, defensa en
--    profundidad barata: hoy no es explotable desde el cliente (el trigger
--    del punto 1 ya protege la columna), pero evita que un futuro bug de
--    servidor deje un saldo negativo real aplicándose en Stripe.
do $$
begin
  alter table public.profiles
    add constraint profiles_descuento_referidos_no_negativo check (descuento_referidos >= 0);
exception when duplicate_object then null;
end $$;

-- 7. Candados de subscriptions: checkout_lock_until faltaba aquí igual que
--    admin_clientes (solo vivía en migration-checkout-lock.sql, no en
--    schema.sql) -- añadido ahí también. sub_action_lock_until es nuevo:
--    cancel/reactivate/update-subscription no tenían ningún candado entre sí
--    (a diferencia del checkout), así que dos pestañas cancelando y
--    reactivando casi a la vez podían pisarse el estado real en Stripe.
alter table public.subscriptions add column if not exists checkout_lock_until timestamptz;
alter table public.subscriptions add column if not exists sub_action_lock_until timestamptz;

-- 8. profiles.email UNIQUE -- solo si no hay ya duplicados (si los hay, no
--    rompe la migración: avisa con RAISE NOTICE y se queda sin aplicar hasta
--    que se resuelvan a mano). Cierra del todo el hueco del punto 1: antes
--    dos usuarios podían compartir el mismo email en `profiles` sin que la
--    BD lo impidiera.
do $$
declare
  v_duplicados int;
begin
  select count(*) into v_duplicados from (
    select email from public.profiles
    where email is not null
    group by email having count(*) > 1
  ) t;
  if v_duplicados = 0 then
    begin
      alter table public.profiles add constraint profiles_email_unique unique (email);
    exception when duplicate_object then null;
    end;
  else
    raise notice 'profiles.email: % emails duplicados -- no se añadió UNIQUE. Resuélvelos y vuelve a correr este bloque.', v_duplicados;
  end if;
end $$;

-- 9. profiles.descuento_referidos: normaliza el tipo a numeric por si en
--    producción seguía siendo `int` (la migración original la creó `int`;
--    schema.sql la declara `numeric`, pero `add column if not exists` no
--    cambia el tipo de una columna ya existente, así que nunca se aplicó
--    solo con schema.sql). Operación segura tanto si ya es numeric (no-op)
--    como si es int (ensanchar int->numeric no pierde datos).
alter table public.profiles alter column descuento_referidos type numeric using descuento_referidos::numeric;

-- Verificación rápida después de ejecutar:
--   select proname from pg_proc where proname in ('protect_profile_sensitive_cols','check_rate_limit');
--   select conname from pg_constraint where conname = 'testimonios_estrellas_range';
--   select * from information_schema.tables where table_name = 'rate_limits_contador';
--   select column_name, data_type from information_schema.columns where table_name='profiles' and column_name='descuento_referidos';
--   select conname from pg_constraint where conname = 'profiles_email_unique';
