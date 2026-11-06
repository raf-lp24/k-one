-- =============================================================================
--  K-ONE · Conversación real en "Contacto" (2 sept 2026)
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run.
--
--  Antes: el cliente escribía desde "Contacto" (mensajes_cliente), pero la
--  respuesta del admin salía por un enlace "Responder" que abría Gmail y
--  escribía un correo suelto -- nunca quedaba guardada, así que el cliente
--  jamás la veía dentro de la app, solo en su bandeja de entrada.
--
--  Qué hace esta migración:
--  1. Tabla nueva mensajes_respuestas: cada fila es un mensaje dentro de un
--     hilo (mensaje_id -> mensajes_cliente.id), de admin o del propio
--     cliente, para que la conversación completa se pueda reconstruir.
--  2. RLS: el cliente solo puede leer y escribir en hilos que sean suyos
--     (comprobado vía mensajes_cliente.user_id = auth.uid()), y solo puede
--     insertar como autor='cliente' -- nunca puede hacerse pasar por admin.
--     El admin escribe con el service role desde api/admin-mensaje.js, que
--     ya salta RLS por diseño (igual que el resto del panel).
--
--  OJO: asume que mensajes_cliente.id es uuid (así son todas las demás
--  tablas del proyecto -- profiles, subscriptions, leads, testimonios...).
--  Si tu mensajes_cliente.id fuera de otro tipo, el CREATE TABLE de abajo
--  fallará con un error de tipos incompatibles al crear la FK -- en ese caso
--  cambia "uuid" por el tipo real antes de re-ejecutar.
-- =============================================================================

create table if not exists public.mensajes_respuestas (
  id         uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references public.mensajes_cliente(id) on delete cascade,
  autor      text not null check (autor in ('admin','cliente')),
  texto      text not null,
  created_at timestamptz not null default now()
);

create index if not exists mensajes_respuestas_mensaje_id_idx
  on public.mensajes_respuestas (mensaje_id);

alter table public.mensajes_respuestas enable row level security;

drop policy if exists "mensajes_respuestas_select_own" on public.mensajes_respuestas;
create policy "mensajes_respuestas_select_own" on public.mensajes_respuestas
  for select using (
    exists (
      select 1 from public.mensajes_cliente m
      where m.id = mensaje_id and m.user_id = auth.uid()
    )
  );

-- El cliente puede seguir la conversación, pero nunca insertar como si
-- fuera 'admin' (ese check ya lo bloquea aunque alguien manipule la
-- petición desde la consola del navegador).
drop policy if exists "mensajes_respuestas_insert_own" on public.mensajes_respuestas;
create policy "mensajes_respuestas_insert_own" on public.mensajes_respuestas
  for insert with check (
    autor = 'cliente'
    and exists (
      select 1 from public.mensajes_cliente m
      where m.id = mensaje_id and m.user_id = auth.uid()
    )
  );

-- (Sin política de update/delete para clientes: una conversación no se
-- edita ni se borra desde fuera, solo el service role del panel admin.)

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select tablename from pg_tables where tablename = 'mensajes_respuestas';
-- select policyname from pg_policies where tablename = 'mensajes_respuestas';
-- -- debe devolver mensajes_respuestas_select_own y mensajes_respuestas_insert_own
