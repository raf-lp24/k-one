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

-- Verificación rápida después de ejecutar:
--   select proname from pg_proc where proname in ('protect_profile_sensitive_cols','check_rate_limit');
--   select conname from pg_constraint where conname = 'testimonios_estrellas_range';
--   select * from information_schema.tables where table_name = 'rate_limits_contador';
