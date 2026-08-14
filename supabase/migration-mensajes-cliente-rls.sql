-- ============================================================
-- K-ONE — Migración: RLS para mensajes_cliente (fix seguridad)
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
--
-- Por qué: mensajes_cliente (formulario de contacto dentro del dashboard,
-- index.html:15389) no aparecía documentada en schema.sql -- a diferencia
-- de leads/testimonios/rate_limits, no había forma de confirmar desde el
-- repositorio si tenía RLS activado. Sin RLS, la clave pública (anon) podría
-- leer TODOS los mensajes de contacto de TODOS los clientes (incluye email,
-- nombre y el texto libre que escriben) directamente contra la API REST de
-- Supabase, sin pasar por la app.
--
-- Qué hace: activa RLS (si no lo estaba ya -- es idempotente) y añade una
-- política de "insert" que exige que el user_id de la fila coincida con el
-- usuario autenticado que hace la petición (auth.uid() = user_id), igual
-- que ya envía el propio código del cliente. NO se añade política de
-- select/update/delete para usuarios: el panel de admin ya gestiona esta
-- tabla siempre con el service_role (api/admin-clientes.js,
-- api/admin-mensaje.js, api/notify.js), que ignora RLS por diseño de
-- Supabase -- los clientes nunca han necesitado leer esta tabla desde el
-- navegador. Si ya existía alguna política de select permisiva de antes,
-- esta migración NO la toca (no se puede hacer drop de una política sin
-- saber su nombre exacto) -- revísalo a mano en Authentication → Policies
-- si quieres confirmarlo del todo.
-- ============================================================

alter table public.mensajes_cliente enable row level security;

drop policy if exists "mensajes_cliente_insert" on public.mensajes_cliente;
create policy "mensajes_cliente_insert" on public.mensajes_cliente
  for insert with check (auth.uid() = user_id);
