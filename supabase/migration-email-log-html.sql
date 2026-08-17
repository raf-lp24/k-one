-- ============================================================
-- K-ONE — Migración: HTML real de los emails en Jarvis
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
-- Es idempotente y opcional: sin esta columna, Jarvis sigue enseñando el
-- resumen de texto de siempre (columna datos->resumen); con ella, además
-- puede mostrar el email tal cual se envió (renderizado en un iframe).
-- Los emails guardados ANTES de esta migración se quedan sin columna
-- html (NULL) — Jarvis ya contempla ese caso y sigue mostrando el resumen.
-- ============================================================

alter table public.email_log add column if not exists html text;
