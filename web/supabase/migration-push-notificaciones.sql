-- =============================================================================
--  K-ONE · Notificaciones push (recordatorio diario de entreno)
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run.
--
--  Guarda la "suscripción push" que da el navegador (endpoint + claves de
--  cifrado) para poder mandarle una notificación más adelante, sin tener
--  que guardar nada sensible del usuario -- el endpoint es propio del
--  navegador de Google/Apple/Mozilla, no un dato personal identificable.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- El cliente solo puede gestionar SUS propias suscripciones. El envío real
-- lo hace el cron (service role, salta RLS), así que no hace falta política
-- de select amplia -- ninguna política de select = nadie del lado cliente
-- puede leer endpoints ajenos ni los suyos propios (no hace falta leerlos,
-- solo darlos de alta o de baja).
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select tablename from pg_tables where tablename = 'push_subscriptions';
-- select policyname from pg_policies where tablename = 'push_subscriptions';
-- -- debe devolver push_subscriptions_insert_own y push_subscriptions_delete_own
