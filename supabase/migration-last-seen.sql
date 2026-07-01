-- ============================================================
-- K-ONE — Migración: última conexión de clientes (last_seen)
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
-- Es idempotente y opcional: sin ejecutarlo, el panel muestra la última
-- vez que el cliente INICIÓ SESIÓN (auth.last_sign_in_at). Ejecutándolo,
-- el "latido" del front rellena last_seen y el panel muestra la última
-- vez que el cliente ABRIÓ la web (más preciso).
-- ============================================================

alter table public.profiles add column if not exists last_seen timestamptz;

-- El usuario solo actualiza su propia fila (ya cubierto por la política
-- profiles_update_own existente); el panel de admin la lee con service role.
