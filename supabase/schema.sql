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
-- Guarda el cuestionario, el plan generado y el progreso.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  cuestionario jsonb default '{}'::jsonb,
  plan jsonb,
  entrenos_completados jsonb default '[]'::jsonb,
  ejercicios_no_gustan jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

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
  current_period_end timestamptz,
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
-- de la suscripción, objetivo, deporte y ejercicios que no le gustan.
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
  p.cuestionario->>'objetivo' as objetivo,
  p.cuestionario->>'deporte' as deporte,
  p.cuestionario->>'tipoPlan' as tipo_plan,
  p.cuestionario->>'lesion' as lesion,
  p.cuestionario->>'alergia' as alergia,
  p.ejercicios_no_gustan,
  jsonb_array_length(coalesce(p.entrenos_completados, '[]'::jsonb)) as entrenos_completados_total
from public.profiles p
left join public.subscriptions s on s.user_id = p.id
order by p.created_at desc;

-- ============================================================
-- 5. CUENTA DE TEST (opcional)
-- La cuenta de demo (test@fragua.es / fragua123) se crea desde la
-- propia app la primera vez que alguien entra con esas credenciales
-- (botón "Probar con cuenta demo" → registra el usuario vía
-- supabase.auth.signUp si no existe). No hace falta crearla aquí.
-- ============================================================
