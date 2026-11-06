-- ============================================================
-- K-ONE — Migración: moderación de testimonios (fix seguridad/legal)
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega esto → Run.
--
-- Por qué: la política de "select" dejaba ver a CUALQUIERA (sin login)
-- cualquier fila insertada por CUALQUIERA (sin login, sin moderación,
-- sin límite) -- la landing carga esa tabla automáticamente para todo
-- visitante. Combinado con el fix de escape ya aplicado en index.html
-- (cargarTestimoniosLanding), esta migración cierra el otro lado del
-- mismo problema: aunque el HTML ya escape bien, sin esto un opinión
-- ofensiva/spam/falsa se publica en la web al instante, sin revisión.
--
-- Qué hace: añade una columna "aprobado" (false por defecto) y cambia
-- la política de lectura para que solo se muestren testimonios ya
-- aprobados. Las filas que YA existían se marcan aprobadas (se asume
-- que lo que ya está en producción ya se revisó/es legítimo) -- así
-- la migración no hace desaparecer testimonios reales que ya se veían.
-- Cualquier testimonio NUEVO que llegue por el formulario público queda
-- oculto hasta que se apruebe a mano.
--
-- Cómo aprobar uno nuevo (sin necesidad de UI extra por ahora):
--   Supabase → Table Editor → testimonios → edita la fila → aprobado = true
-- (o por SQL: update public.testimonios set aprobado = true where id = '...';)
-- ============================================================

alter table public.testimonios add column if not exists aprobado boolean not null default false;

-- Backfill: lo que ya estaba en la tabla antes de esta migración se
-- considera ya revisado/legítimo, para no ocultar testimonios reales
-- que ya se estaban mostrando en producción.
update public.testimonios set aprobado = true where aprobado = false;

drop policy if exists "testimonios_select" on public.testimonios;
create policy "testimonios_select" on public.testimonios
  for select using (aprobado = true);

-- El insert sigue abierto (formulario público sin login), pero ya no
-- se ve nada de una fila nueva hasta que un admin la apruebe a mano.
-- Política de insert sin cambios (testimonios_insert, "with check (true)").
