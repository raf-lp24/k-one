-- ============================================================
-- K-ONE — Esquema de base de datos (Supabase / Postgres)
-- ============================================================
-- Cómo usar este archivo:
-- 1. Entra en tu proyecto en https://supabase.com/dashboard
-- 2. Ve a "SQL Editor" → "New query"
-- 3. Pega TODO este archivo y pulsa "Run"
-- Se puede ejecutar varias veces sin problema (usa IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ============================================================
-- 1. TABLA: profiles
-- Un perfil por usuario, vinculado 1:1 con auth.users.
-- "userdata" guarda TODO el objeto que hoy vive en
-- localStorage (k1_data_<email>): cuestionario, progreso,
-- entrenos completados, pesos, fotos, hitos, notas, etc.
-- "plan" guarda el plan de entrenamiento/nutrición generado.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  userdata jsonb default '{}'::jsonb,
  plan jsonb,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columna para marcar beta testers (acceso completo sin pago). Es SENSIBLE: concede
-- acceso gratuito, así que el usuario NO debe poder cambiarla. La política RLS de update
-- permite al usuario modificar su propia fila y Postgres no restringe por columna, por lo
-- que sin protección extra un usuario podría ejecutar
--   supabase.from('profiles').update({ is_beta: true })
-- y darse premium gratis. El trigger de abajo lo impide.
alter table public.profiles add column if not exists is_beta boolean not null default false;

-- Fecha en la que expira el acceso premium gratuito concedido vía is_beta
-- (invitaciones de admin, api/admin-crear-cliente.js). Esta columna se venía
-- usando en el código (index.html:17353,17756; api/admin-*.js) desde antes
-- de estar documentada aquí -- si se reconstruía la base desde este schema
-- limpio, faltaba en silencio. Igual de sensible que is_beta: protegida por
-- el mismo trigger de abajo.
alter table public.profiles add column if not exists beta_expires timestamptz;

-- Crédito acumulado (en euros) del programa de referidos, aplicado como saldo
-- negativo real en Stripe en la siguiente renovación (api/stripe-webhook.js,
-- case customer.subscription.updated). Tan sensible como is_beta: hasta agosto
-- de 2026 esta columna NO estaba en la lista de protegidas del trigger de abajo,
-- así que cualquier usuario podía hacer
--   supabase.from('profiles').update({ descuento_referidos: 1000 })
-- desde la consola y quedarse la suscripción gratis en la siguiente renovación
-- (el bloque que APLICA el descuento no tiene tope máximo; el límite de 15€
-- solo existe en el bloque que ACREDITA nuevos referidos, que está pausado).
-- Encontrado auditando pg_policies de todas las tablas, no solo las conocidas
-- -- ver supabase/migration-fix-criticos-agosto-2.sql para el detalle completo
-- (también cerró una política vieja que anulaba la moderación de testimonios,
-- y dos tablas más con políticas huérfanas: invitaciones_premium y referidos).
alter table public.profiles add column if not exists descuento_referidos numeric not null default 0;

-- Notas internas del admin sobre el cliente (CRM en Jarvis) y heartbeat de última
-- actividad. Añadidas originalmente por migration-last-seen.sql; se repiten aquí
-- porque el trigger de más abajo referencia nota_admin -- sin esta columna, ese
-- trigger fallaría con "column does not exist" en cada UPDATE de un perfil si
-- este fichero se ejecuta solo, en una base nueva.
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists nota_admin text;

alter table public.profiles enable row level security;

-- Protección de columnas sensibles: los roles de cliente (authenticated/anon) no pueden
-- cambiar is_beta/beta_expires/descuento_referidos/nota_admin. Si lo intentan, se conserva
-- el valor anterior silenciosamente. Solo service_role / postgres (SQL Editor, scripts de
-- admin) pueden modificarlas.
-- OJO: esta función se define con CREATE OR REPLACE, que sustituye el cuerpo entero (no
-- fusiona versiones) -- por eso nota_admin está aquí ya incluida y no solo en la migración
-- que la añadió (migration-fix-rls-referidos-y-otros.sql). Si este fichero se vuelve a
-- ejecutar sin esa columna en la lista, se anula esa protección en silencio.
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

drop trigger if exists profiles_protect_sensitive on public.profiles;
create trigger profiles_protect_sensitive
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_cols();

-- Cada usuario solo puede ver y modificar su propia fila.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Mantiene updated_at al día en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. TRIGGER: crear perfil automáticamente al registrarse
-- Cuando alguien se registra (auth.users), se crea su fila en
-- profiles con el nombre que mandó en signUp (user_metadata.nombre).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. TABLA: subscriptions
-- Estado de la suscripción de pago (se rellena en la Fase 2 con Stripe).
-- Solo el backend (service role) puede escribir aquí; el usuario
-- solo puede leer su propia fila.
-- ============================================================
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text not null default 'none', -- active | trialing | past_due | canceled | none
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false, -- true: oferta 0,99€ o cancelación; no renovará
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- (Sin políticas de insert/update/delete para usuarios: solo el
-- service role, usado por el webhook de Stripe, puede escribir.)

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. VISTA: admin_clientes
-- Vista de solo lectura para que tú (con el panel de Supabase)
-- veas de un vistazo todos tus clientes: plan contratado, estado
-- de la suscripción, objetivo, deporte, semana actual, entrenos
-- completados y cambios de ejercicios preferidos.
-- Esta vista NO es accesible para los usuarios normales (RLS de
-- las tablas base la protege); consúltala desde el Table/SQL Editor.
-- ============================================================
create or replace view public.admin_clientes as
select
  p.id,
  p.nombre,
  p.email,
  p.created_at as alta,
  coalesce(s.status, 'none') as estado_suscripcion,
  s.plan as plan_pago,
  s.current_period_end as renovacion,
  p.userdata->>'objetivo' as objetivo,
  p.userdata->>'deporte' as deporte,
  p.userdata->>'tipoPlan' as tipo_plan,
  p.userdata->>'lesion' as lesion,
  p.userdata->>'lesionDetalle' as lesion_detalle,
  p.userdata->>'alergia' as alergia,
  p.userdata->>'alergiaOtra' as alergia_otra,
  p.userdata->>'medicacion' as medicacion,
  (p.userdata->'progreso'->>'semana')::int as semana_actual,
  jsonb_array_length(coalesce(p.userdata->'entrenosCompletados', '[]'::jsonb)) as entrenos_completados_total,
  p.userdata->'variantPreferences' as cambios_ejercicios,
  p.userdata->'hitos' as hitos,
  p.saved_at
from public.profiles p
left join public.subscriptions s on s.user_id = p.id
order by p.created_at desc;

-- ============================================================
-- 5. TABLA: webhook_events
-- Garantiza idempotencia en el webhook de Stripe: Stripe envía cada
-- evento "al menos una vez", por lo que puede llegar duplicado.
-- Al inicio del handler se intenta insertar el event_id; si ya existe
-- (código de error 23505 = unique_violation) el handler devuelve 200
-- inmediatamente sin procesar el evento de nuevo.
-- Solo escribe el backend con service_role; sin acceso para usuarios.
-- ============================================================
create table if not exists public.webhook_events (
  event_id     text        primary key,
  type         text        not null,
  processed_at timestamptz not null default now()
);

-- RLS activado: ningún usuario con anon/authenticated key puede leer ni
-- escribir aquí. El service role bypasea RLS y es el único que escribe.
alter table public.webhook_events enable row level security;
-- (No se crean políticas de usuario: la tabla queda cerrada a todos excepto
--  al service role, que ignora RLS por diseño de Supabase.)

-- ============================================================
-- 5b. TABLA: rate_limits
-- Rate-limit server-side para peticiones sin sesión a api/notify.js
-- (lead/mensaje). Ver supabase/migration-rate-limits.sql para el detalle.
-- Igual que webhook_events: cerrada a todos salvo service_role.
-- ============================================================
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_clave_fecha_idx
  on public.rate_limits (clave, created_at desc);
alter table public.rate_limits enable row level security;

-- ============================================================
-- 6. FUNCIÓN HELPER: is_admin()
-- Devuelve true si el usuario autenticado tiene app_metadata.is_admin = true.
-- app_metadata solo puede ser modificado por el service role (no por el usuario),
-- lo que la hace más segura que user_metadata.
-- Uso: WHERE public.is_admin() en políticas RLS de tablas analíticas.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

-- ============================================================
-- 7. TABLA: leads
-- Emails recogidos desde el formulario "Avísame de ofertas" de la
-- landing. Cualquier visitante puede insertar; solo el admin lee.
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert with check (true);

-- ============================================================
-- 8. TABLA: testimonios
-- Opiniones de clientes (públicas). Cualquiera puede insertar y leer.
-- ============================================================
create table if not exists public.testimonios (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  inicial text,
  edad int,
  plan text,
  estrellas int not null default 5,
  texto text,
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.testimonios enable row level security;

drop policy if exists "testimonios_insert" on public.testimonios;
create policy "testimonios_insert" on public.testimonios
  for insert with check (true);

-- Solo se muestran públicamente los testimonios ya moderados/aprobados
-- (ver supabase/migration-testimonios-moderacion.sql) -- el insert público
-- sin login sigue abierto, pero nada se ve hasta aprobarlo a mano en el
-- Table Editor de Supabase.
drop policy if exists "testimonios_select" on public.testimonios;
create policy "testimonios_select" on public.testimonios
  for select using (aprobado = true);

-- OJO -- hasta agosto de 2026 convivía aquí una política huérfana
-- "testimonios_public_read" (using (true), sin filtrar por aprobado) que
-- ANULABA la de arriba: las políticas permisivas se combinan con OR, así
-- que cualquier testimonio sin aprobar seguía siendo público pese a esta
-- política. Se detectó auditando pg_policies de todas las tablas (no solo
-- las documentadas aquí) y se borró en migration-fix-criticos-agosto-2.sql.
-- Moraleja para el futuro: el número de políticas de una tabla no dice si
-- están bien: hay que leer el contenido de cada una.

-- ============================================================
-- 8b. TABLA: mensajes_cliente (formulario de contacto del dashboard)
-- No se define aquí su "create table" porque su esquema completo no vive
-- en este repositorio (columnas conocidas por el código que la usa:
-- user_id, nombre, email, asunto, mensaje, respuesta, created_at, id).
--
-- Verificado directamente en la base real (agosto 2026): YA tiene RLS
-- activado con políticas correctas, con nombres que no coinciden con el
-- resto de convenciones de este archivo:
--   mensajes_insert_own (insert)
--   mensajes_select_own (select using auth.uid() = user_id)
-- Cada cliente solo puede leer sus propios mensajes, nunca los de otro.
-- El panel de admin gestiona la tabla aparte con el service_role.
-- No hace falta ninguna migración extra para esta tabla.
-- ============================================================

-- ============================================================
-- 8c. TABLAS: invitaciones_premium y referidos
-- Tampoco viven en este repositorio (igual que mensajes_cliente). Ambas
-- tenían RLS activado pero con políticas huérfanas -- de una versión
-- anterior, probablemente de cuando se estaba depurando el feature -- que
-- dejaban la tabla abierta a cualquiera pese a que las políticas correctas
-- también estaban puestas al lado (las permisivas se combinan con OR, así
-- que la más abierta siempre gana). Encontrado y cerrado en agosto de 2026
-- auditando pg_policies de TODAS las tablas, no solo las conocidas -- ver
-- migration-fix-criticos-agosto-2.sql.
--
-- invitaciones_premium (email invitado a premium por el admin, ver
-- api/admin-crear-cliente.js): se borraron "invitaciones_select" (dejaba
-- leer la tabla entera, con roles anon+authenticated, a cualquiera) e
-- "invitaciones_delete" (dejaba a cualquier usuario logueado borrar la
-- invitación de OTRO). Quedan solo las políticas que limitan a "tu propio
-- email" (comparando contra auth.jwt()->>'email' o un join a auth.users).
--
-- referidos (referrer_id, referido_id, estado, pagado_at): se borraron
-- "Service role inserta" y "Service role actualiza" -- pese al nombre,
-- tenían roles = public (cualquiera, no solo el backend) y using/with_check
-- = true sin comprobar propiedad. El service_role real no necesita ninguna
-- política porque salta RLS por diseño; estas dos solo abrían la tabla a
-- cualquier usuario.
--
-- ACTUALIZADO (ver migration-fix-rls-referidos-y-otros.sql): la política
-- "referidos_insert_self" (auth.uid() = referido_id) mencionada arriba
-- también se borró después -- validaba quién RECIBE el referido pero no
-- quién lo ENVÍA, así que cualquiera podía insertar {referrer_id: <uuid
-- ajeno>, referido_id: propio} y acreditarle un referido a otra persona sin
-- su intervención. Los INSERT ahora pasan por la función SECURITY DEFINER
-- registrar_referido(p_codigo), que valida ambos lados desde el servidor.
-- No debe quedar ninguna política de INSERT directo en esta tabla.
-- ============================================================

-- ============================================================
-- 9. CUENTA DE TEST (opcional)
-- La cuenta de demo (test@k-one.es / kone123) se crea desde la
-- propia app la primera vez que alguien entra con esas credenciales
-- (login() la registra vía supabase.auth.signUp si no existe).
-- No hace falta crearla aquí.
-- ============================================================
