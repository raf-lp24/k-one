-- Migración: bloqueo atómico contra doble canje de recompensas de hitos.
--
-- Antes, `canjearNivelHitos()` comprobaba si un nivel ya estaba cobrado leyendo
-- customer.metadata de Stripe y, si no estaba, aplicaba el cupón y DESPUÉS
-- reescribía el metadata. Dos peticiones casi simultáneas (doble clic, dos
-- pestañas) podían leer ambas "no canjeado" antes de que la primera terminara
-- de escribir, y cobrar el descuento dos veces.
--
-- Esta tabla usa una clave primaria (user_id, nivel) como cerrojo atómico: la
-- primera petición que consigue el INSERT gana; la segunda choca contra la
-- clave duplicada y se rechaza, sin ninguna condición de carrera posible.

create table if not exists hitos_canjes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  nivel      text not null,
  creado_en  timestamptz not null default now(),
  primary key (user_id, nivel)
);

alter table hitos_canjes enable row level security;

-- Solo el backend (service role) puede leer o escribir esta tabla.
-- Los clientes nunca deben poder insertar aquí directamente (se saltarían
-- la verificación de hitos del servidor).
drop policy if exists "hitos_canjes_service_role_only" on hitos_canjes;
create policy "hitos_canjes_service_role_only" on hitos_canjes
  for all
  using (false)
  with check (false);
