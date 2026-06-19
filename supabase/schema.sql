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

alter table public.profiles enable row level security;

-- Protección de columnas sensibles: los roles de cliente (authenticated/anon) no pueden
-- cambiar is_beta. Si lo intentan, se conserva el valor anterior silenciosamente. Solo
-- service_role / postgres (SQL Editor, scripts de admin) pueden modificarla.
create or replace function public.protect_profile_sensitive_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_beta := old.is_beta;
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
  created_at timestamptz not null default now()
);

alter table public.testimonios enable row level security;

drop policy if exists "testimonios_insert" on public.testimonios;
create policy "testimonios_insert" on public.testimonios
  for insert with check (true);

drop policy if exists "testimonios_select" on public.testimonios;
create policy "testimonios_select" on public.testimonios
  for select using (true);

-- ============================================================
-- 9. CUENTA DE TEST (opcional)
-- La cuenta de demo (test@k-one.es / kone123) se crea desde la
-- propia app la primera vez que alguien entra con esas credenciales
-- (login() la registra vía supabase.auth.signUp si no existe).
-- No hace falta crearla aquí.
-- ============================================================
