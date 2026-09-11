-- ============================================================
-- K-ONE — Migración: tabla de auditorías automáticas de clientes
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
--
-- Qué es: el agente de reglas que corre cada día dentro del cron ya
-- existente (api/notify.js, 09:00, ver vercel.json) revisa el plan
-- GUARDADO de cada cliente real contra lo que dijo que no puede/no quiere
-- comer (userData.noComida, userData.alergia, userData.alergiaOtra) --
-- exactamente la misma clase de fallo que se encontró a mano con Esther y
-- Pablo esta sesión (11 sept 2026), pero de forma automática y para todos
-- los clientes, no solo cuando alguien lo pide.
--
-- NO es una IA generativa: usa reglas fijas (lib/normalizador-alimentos.js,
-- espejo de las mismas funciones de index.html) sobre el texto del plan ya
-- generado. Nunca decide nada por su cuenta ni toca el plan del cliente --
-- solo avisa aquí. El arreglo lo aplica el admin desde Jarvis con el botón
-- "Regenerar plan" que ya existía.
--
-- Un cliente solo tiene una fila abierta a la vez (user_id es la clave
-- primaria): cada ejecución del cron BORRA la fila si ya no encuentra nada
-- mal (se resuelve sola en cuanto se regenera el plan) y la vuelve a crear
-- si el problema sigue ahí. No hace falta ningún endpoint nuevo para
-- "marcar como resuelto" -- se resuelve solo al día siguiente.
-- ============================================================

create table if not exists public.auditorias_clientes (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  nombre       text,
  email        text,
  hallazgos    jsonb not null,        -- [{ token, coincidencia }, ...]
  creado_at    timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index if not exists auditorias_clientes_creado_idx
  on public.auditorias_clientes (creado_at desc);

alter table public.auditorias_clientes enable row level security;

-- Sin políticas permisivas a propósito: solo la escribe/lee el service_role
-- (el cron en api/notify.js y el panel de Jarvis en api/admin-clientes.js),
-- que ignora RLS. Ningún cliente debe poder ver ni las suyas ni las ajenas
-- directamente vía REST -- esto es información interna del negocio, no del
-- perfil del cliente.
