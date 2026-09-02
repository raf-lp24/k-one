-- =============================================================================
--  K-ONE · Auditoría 2 sept 2026 (ronda de verificación) — límites de longitud
--
--  Pégalo entero en el SQL Editor de Supabase y dale a Run. Es seguro
--  ejecutarlo más de una vez (DO block con manejo de "ya existe").
--
--  Qué hace:
--  mensajes_respuestas.texto y push_subscriptions.endpoint/p256dh/auth_key no
--  tenían ningún tope de longitud. El frontend limita con maxlength/.slice(),
--  pero eso es solo la UI -- un cliente autenticado puede llamar directo al
--  endpoint REST de Supabase (con su propio JWT) y mandar un texto de varios
--  MB, saltándose el límite del navegador sin tocar ninguna política de RLS
--  (que solo comprueba propiedad del hilo/usuario, no tamaño). Mismo patrón
--  ya usado en el proyecto para otras columnas escribibles por clientes
--  (testimonios.estrellas 1-5, profiles.descuento_referidos >= 0).
-- =============================================================================

do $$
begin
  alter table public.mensajes_respuestas
    add constraint mensajes_respuestas_texto_longitud check (char_length(texto) <= 5000);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.push_subscriptions
    add constraint push_subscriptions_endpoint_longitud check (char_length(endpoint) <= 2000);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.push_subscriptions
    add constraint push_subscriptions_p256dh_longitud check (char_length(p256dh) <= 500);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.push_subscriptions
    add constraint push_subscriptions_auth_key_longitud check (char_length(auth_key) <= 500);
exception when duplicate_object then null;
end $$;

-- =============================================================================
--  VERIFICACIÓN — ejecuta esto después para confirmar
-- =============================================================================
-- select conname from pg_constraint where conname in (
--   'mensajes_respuestas_texto_longitud', 'push_subscriptions_endpoint_longitud',
--   'push_subscriptions_p256dh_longitud', 'push_subscriptions_auth_key_longitud'
-- );
-- -- debe devolver las 4 filas
