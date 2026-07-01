-- ============================================================
-- K-ONE — Migración: sistema de referidos + tablas auxiliares
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega TODO → Run.
-- Es idempotente (se puede ejecutar varias veces sin romper nada).
-- Arregla el sistema de referidos, que estaba incompleto:
--   · genera un código único por usuario (antes nunca se creaba)
--   · crea las tablas referidos / invitaciones_premium / email_log
--   · añade una función segura para buscar al referrer por su código
-- ============================================================

-- 1. COLUMNAS DE REFERIDOS EN profiles ------------------------
alter table public.profiles add column if not exists codigo_referido    text;
alter table public.profiles add column if not exists referido_por       text;
alter table public.profiles add column if not exists descuento_referidos int not null default 0;

-- Índice único para el código (permite nulls; único cuando existe).
create unique index if not exists profiles_codigo_referido_key
  on public.profiles (codigo_referido);

-- 2. GENERADOR DE CÓDIGO ÚNICO (ej: "RAFA-5239") --------------
create or replace function public.generar_codigo_referido(p_nombre text)
returns text
language plpgsql
as $$
declare
  base    text;
  codigo  text;
  intentos int := 0;
begin
  -- Base: primeras 4 letras del nombre (solo A-Z sin acentos), en mayúsculas.
  base := upper(regexp_replace(unaccent_simple(coalesce(p_nombre, '')), '[^a-zA-Z]', '', 'g'));
  base := substring(base from 1 for 4);
  if length(base) < 3 then base := 'KONE'; end if;
  loop
    codigo := base || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where codigo_referido = codigo);
    intentos := intentos + 1;
    if intentos > 25 then
      codigo := base || '-' || substring(md5(random()::text) from 1 for 5);
      exit;
    end if;
  end loop;
  return codigo;
end;
$$;

-- Helper para quitar acentos sin depender de la extensión unaccent.
create or replace function public.unaccent_simple(t text)
returns text language sql immutable as $$
  select translate(coalesce(t,''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

-- 3. ASIGNAR CÓDIGO AL CREAR EL PERFIL ------------------------
-- Reescribe handle_new_user para incluir el código de referido.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, email, codigo_referido)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.email,
    public.generar_codigo_referido(coalesce(new.raw_user_meta_data->>'nombre', ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. BACKFILL: código para perfiles existentes sin él ---------
update public.profiles
set codigo_referido = public.generar_codigo_referido(nombre)
where codigo_referido is null;

-- 5. BÚSQUEDA SEGURA DEL REFERRER POR CÓDIGO ------------------
-- La RLS de profiles (select_own) impide que un usuario lea la fila de otro.
-- Esta función SECURITY DEFINER devuelve SOLO el id del dueño de un código,
-- sin exponer ningún otro dato del perfil.
create or replace function public.buscar_referrer_por_codigo(p_codigo text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.profiles
  where codigo_referido = upper(trim(p_codigo))
  limit 1;
$$;

-- 6. TABLA referidos -----------------------------------------
create table if not exists public.referidos (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references auth.users(id) on delete cascade,
  referido_id   uuid not null references auth.users(id) on delete cascade,
  referido_email text,
  estado        text not null default 'pendiente', -- pendiente | pagado
  created_at    timestamptz not null default now(),
  pagado_at     timestamptz,
  unique (referido_id),                    -- un usuario solo puede ser referido una vez
  check (referrer_id <> referido_id)       -- no puedes referirte a ti mismo
);

alter table public.referidos enable row level security;

-- El referrer ve sus referidos; el referido ve su propia fila.
drop policy if exists "referidos_select_own" on public.referidos;
create policy "referidos_select_own" on public.referidos
  for select using (auth.uid() = referrer_id or auth.uid() = referido_id);

-- El nuevo usuario inserta la fila donde él es el referido.
drop policy if exists "referidos_insert_self" on public.referidos;
create policy "referidos_insert_self" on public.referidos
  for insert with check (auth.uid() = referido_id);

-- (Las transiciones a 'pagado' y el crédito las hace el webhook con service role.)

-- 7. TABLA invitaciones_premium ------------------------------
-- Emails que el admin marca para acceso premium; el frontend comprueba
-- en el registro si el email entrante está invitado.
create table if not exists public.invitaciones_premium (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table public.invitaciones_premium enable row level security;

drop policy if exists "invitaciones_select_own" on public.invitaciones_premium;
create policy "invitaciones_select_own" on public.invitaciones_premium
  for select using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "invitaciones_delete_own" on public.invitaciones_premium;
create policy "invitaciones_delete_own" on public.invitaciones_premium
  for delete using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

-- (La inserción la hace el admin vía service role en api/admin-crear-cliente.js.)

-- 8. TABLA email_log -----------------------------------------
-- Registro de emails enviados por el webhook/cron (solo service role).
create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  tipo         text,
  destinatario text,
  asunto       text,
  datos        jsonb,
  created_at   timestamptz not null default now()
);
alter table public.email_log enable row level security;
-- Sin políticas de usuario: cerrada a anon/authenticated; el service role la usa.
