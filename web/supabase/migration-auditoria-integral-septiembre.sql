-- =============================================================================
--  K-ONE · Auditoría integral 2 sept 2026 — varios refuerzos de base de datos
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run. Es seguro
--  ejecutarlo más de una vez (CREATE OR REPLACE / IF NOT EXISTS / DO block
--  con manejo de "ya existe").
--
--  Qué hace:
--  1. leads.email: límite de longitud + UNIQUE si no hay ya duplicados. El
--     código (index.html) ya está preparado para un error 23505 en el
--     insert, pero esa constraint no existía -- o vivía solo en la base real
--     sin documentar aquí, o el chequeo era código muerto y leads podía
--     acumular el mismo email sin límite.
--  2. profiles.userdata/plan: tope de tamaño (pg_column_size). El cliente
--     escribe estas columnas directo desde el navegador sin pasar por
--     ningún endpoint que valide forma o tamaño; admin-clientes.js y
--     notify.js cargan esta columna para TODOS los usuarios en una sola
--     consulta, así que una fila con un userdata de varios MB ralentiza el
--     panel de admin y el cron diario para todo el mundo, no solo para ese
--     usuario.
--  3. email_log: índices que faltaban -- el cron diario hace varios SELECT
--     sin filtro de fecha sobre TODA la tabla (dedupe de retención/reengan-
--     che, resumen semanal, digest admin, push diario) y la tabla no tiene
--     retención, crece para siempre. Índice compuesto (tipo, destinatario)
--     para los dedupe checks, e índice en created_at para las consultas por
--     fecha.
--  4. protect_profile_sensitive_cols(): añade codigo_referido y
--     referido_por a la lista de columnas protegidas -- profiles_update_own
--     permite auth.uid()=id sin restricción de columna, así que un usuario
--     podía cambiar su propio código de referido a voluntad (squatting de
--     códigos "bonitos", o invalidar en silencio el que ya había
--     compartido). El único escritor legítimo de estas dos columnas
--     (registrar_referido(), generar_codigo_referido()) es SECURITY DEFINER
--     y no pasa por este trigger como 'authenticated'/'anon', así que no se
--     rompe nada real al protegerlas.
--  5. reclamar_push_subscription(): antes, si el endpoint push ya existía
--     en la tabla (dispositivo compartido -- tablet familiar, portátil
--     prestado -- donde otro cliente ya había activado avisos antes), el
--     INSERT fallaba por 23505 y el error se descartaba en silencio
--     (activarNotificaciones() en index.html asumía "ya estaba suscrito con
--     este navegador"): el cliente B veía "Avisos activados" pero la fila
--     seguía apuntando al cliente A, que seguía recibiendo el push aunque
--     ya no fuera su dispositivo, y B nunca recibía nada. Esta función
--     SECURITY DEFINER borra la fila vieja (sea de quien sea) y crea la
--     nueva a nombre de quien la llama -- el RLS normal de cliente no puede
--     tocar una fila ajena, así que hacía falta una función con permisos
--     elevados para poder "liberar" el endpoint.
-- =============================================================================

-- 1. leads.email ----------------------------------------------------------
do $$
begin
  alter table public.leads
    add constraint leads_email_longitud check (char_length(email) <= 254);
exception when duplicate_object then null;
end $$;

-- OJO: "alter table add constraint UNIQUE" con nombre repetido lanza 42P07
-- (duplicate_table, por el índice que crea por debajo), NO 42710
-- (duplicate_object) -- distinto del resto de constraints de este archivo
-- (todo CHECK, que sí lanza duplicate_object). Comprobar contra pg_constraint
-- primero evita depender de adivinar el SQLSTATE exacto.
do $$
declare
  v_duplicados int;
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_email_unique' and conrelid = 'public.leads'::regclass
  ) then
    select count(*) into v_duplicados from (
      select email from public.leads group by email having count(*) > 1
    ) t;
    if v_duplicados = 0 then
      alter table public.leads add constraint leads_email_unique unique (email);
    else
      raise notice 'leads.email: % emails duplicados -- no se añadió UNIQUE.', v_duplicados;
    end if;
  end if;
end $$;

-- 2. profiles.userdata / profiles.plan -------------------------------------
do $$
begin
  alter table public.profiles
    add constraint profiles_userdata_tamano check (pg_column_size(userdata) < 2 * 1024 * 1024);
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.profiles
    add constraint profiles_plan_tamano check (pg_column_size(plan) < 2 * 1024 * 1024);
exception when duplicate_object then null;
end $$;

-- 3. email_log --------------------------------------------------------------
create index if not exists email_log_tipo_destinatario_idx
  on public.email_log (tipo, destinatario);
create index if not exists email_log_created_at_idx
  on public.email_log (created_at);

-- 4. protect_profile_sensitive_cols() ----------------------------------------
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
    new.codigo_referido := old.codigo_referido;
    new.referido_por := old.referido_por;
  end if;
  return new;
end;
$$;

-- 5. reclamar_push_subscription() --------------------------------------------
create or replace function public.reclamar_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key);
end;
$$;
revoke execute on function public.reclamar_push_subscription(text, text, text) from public;
grant execute on function public.reclamar_push_subscription(text, text, text) to authenticated;

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select conname from pg_constraint where conname in (
--   'leads_email_longitud', 'profiles_userdata_tamano', 'profiles_plan_tamano'
-- );
-- select indexname from pg_indexes where tablename = 'email_log';
-- select proname from pg_proc where proname = 'reclamar_push_subscription';
-- select has_function_privilege('authenticated', 'public.reclamar_push_subscription(text,text,text)', 'execute');
-- -- debe devolver true
