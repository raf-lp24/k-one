-- ============================================================
-- K-ONE — Migración: candado anti doble-checkout
-- ============================================================
-- api/create-checkout-session.js usaba un guard ("yaTieneActiva") que solo
-- mira suscripciones YA existentes en Stripe. Pero la suscripción real solo
-- se crea al COMPLETAR el Checkout, no al crear la sesión -- así que dos
-- peticiones casi simultáneas (doble click, doble pestaña) pasan las dos ese
-- guard viendo 0 suscripciones, y si el cliente completa ambas, acaba con
-- 2 suscripciones reales cobrando en paralelo.
--
-- Esta columna guarda hasta cuándo hay un checkout "en curso" para ese
-- usuario. create-checkout-session.js hace un UPDATE...WHERE atómico sobre
-- ella justo antes de crear la sesión de Stripe: con dos peticiones a la vez,
-- Postgres serializa el UPDATE a nivel de fila, así que como mucho UNA de
-- las dos consigue poner el candado; la otra ve la condición ya no cumplida
-- y recibe un 429 ("ya hay un pago en curso"). El candado expira solo a los
-- 30 segundos (no hace falta liberarlo a mano): así una función que falla a
-- medias no lo deja pillado para siempre.
-- ============================================================

alter table public.subscriptions add column if not exists checkout_lock_until timestamptz;

-- Verificación tras ejecutar (debe devolver la columna):
-- select column_name from information_schema.columns where table_name = 'subscriptions' and column_name = 'checkout_lock_until';
