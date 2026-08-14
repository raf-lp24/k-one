-- ============================================================
-- K-ONE — Migración: rate-limit server-side para lead/mensaje
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
--
-- Por qué: api/notify.js aceptaba peticiones de tipo "lead" y "mensaje"
-- (formulario de contacto y lead-magnet) sin sesión y sin ningún límite
-- real en servidor -- solo había un contador cosmético en localStorage
-- del propio navegador del cliente, trivial de saltar con curl/Postman.
-- Cualquiera podía hacer que el dominio de K-ONE mandara correos
-- arbitrarios sin límite y quemara la cuota de Resend.
--
-- Qué hace: una tabla simple que registra cada petición sin sesión
-- (clave = "tipo:ip"), consultada por api/notify.js antes de enviar
-- cualquier email de ese tipo. Solo el service_role (backend) la toca;
-- no necesita política de acceso para el cliente porque nunca se lee
-- ni se escribe desde el frontend.
-- ============================================================

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_clave_fecha_idx
  on public.rate_limits (clave, created_at desc);

alter table public.rate_limits enable row level security;
-- Sin políticas: cerrado a cal y canto salvo el service_role (que ignora
-- RLS), igual que webhook_events. Nadie desde el cliente necesita tocar
-- esta tabla jamás.

-- Housekeeping opcional: las filas de más de 24h ya no aportan nada al
-- cálculo de rate-limit (la ventana es de 1h). Si quieres limpiarla de vez
-- en cuando, puedes correr esto a mano o programarlo como cron aparte:
--   delete from public.rate_limits where created_at < now() - interval '1 day';
