-- ============================================================
-- K-ONE — Migración: extras de Jarvis (última conexión + notas)
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
-- Es idempotente y opcional. Todo degrada con elegancia si no se ejecuta:
--   · last_seen: sin él, el panel muestra la última vez que el cliente
--     INICIÓ SESIÓN (auth.last_sign_in_at). Con él, muestra la última vez
--     que ABRIÓ la web (más preciso), gracias al "latido" del front.
--   · nota_admin: sin él, el campo de notas por cliente no guarda; con él,
--     puedes apuntar notas privadas en cada ficha (CRM).
-- ============================================================

alter table public.profiles add column if not exists last_seen  timestamptz;
alter table public.profiles add column if not exists nota_admin text;

-- El usuario solo actualiza su propia fila (política profiles_update_own existente);
-- nota_admin la escribe el admin vía service role (api/admin-mensaje.js), que ignora RLS.
-- last_seen lo escribe cada usuario en su propia fila (heartbeat del front).
