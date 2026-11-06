-- ============================================================
-- K-ONE — Migración: códigos promocionales (mes gratis, descuentos)
-- ============================================================
-- Cómo usar: SQL Editor de Supabase → New query → pega TODO → Run.
-- Es idempotente (se puede ejecutar varias veces sin romper nada).
--
-- Qué añade:
--   · tabla codigos_promo  → los códigos que reparte K-ONE
--   · tabla canjes_promo   → quién ha usado cada código (evita repetir)
--   · profiles.codigo_promo→ el código que puso el cliente al registrarse
--   · validar_codigo_promo()→ comprueba un código sin exponer la tabla
--   · crear_codigo_promo() → atajo para generar códigos nuevos
--   · crea el código GRATIS1MES (1 mes gratis, ilimitado, sin caducidad)
--
-- IMPORTANTE: el "mes gratis" se aplica como PERIODO DE PRUEBA de Stripe
-- (30 días). Así el cliente recibe exactamente un mes, sea su plan mensual,
-- trimestral o anual. Un cupón del 100% le habría regalado el año entero.
--
-- IMPORTANTE 2: este fichero por sí solo deja canjear_codigo_promo() y
-- crear_codigo_promo() ejecutables por PUBLIC (el "revoke ... from anon,
-- authenticated" de más abajo NO quita el EXECUTE que Postgres concede a
-- PUBLIC al crear la función). Este fichero SIEMPRE debe ir seguido de:
--   1. migration-fix-criticos-agosto.sql   (revoke real de PUBLIC en crear_codigo_promo)
--   2. migration-fix-canjear-codigo-promo.sql (mismo fix, para canjear_codigo_promo)
-- Mismo patrón de riesgo que ya costó una ronda de auditoría con
-- migration-referidos.sql -- no reconstruir la base solo con este archivo.
-- ============================================================

-- 1. TABLA DE CÓDIGOS ----------------------------------------
create table if not exists public.codigos_promo (
  codigo      text primary key,
  tipo        text not null default 'mes_gratis',   -- mes_gratis | descuento_pct
  valor       int  not null default 30,             -- días de prueba, o % de descuento
  descripcion text,
  usos_max    int,                                  -- null = ilimitado
  usos        int  not null default 0,
  activo      boolean not null default true,
  expira_at   timestamptz,                          -- null = no caduca
  created_at  timestamptz not null default now(),
  check (tipo in ('mes_gratis','descuento_pct')),
  check (valor > 0)
);

alter table public.codigos_promo enable row level security;
-- Cerrada a los clientes: solo se consulta con la función de abajo o service role.

-- 2. TABLA DE CANJES (un código, una vez por persona) --------
create table if not exists public.canjes_promo (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null references public.codigos_promo(codigo) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (codigo, user_id)
);

alter table public.canjes_promo enable row level security;

drop policy if exists "canjes_select_own" on public.canjes_promo;
create policy "canjes_select_own" on public.canjes_promo
  for select using (auth.uid() = user_id);
-- La inserción la hace el servidor (service role) al crear el pago.

-- 3. COLUMNA EN profiles -------------------------------------
alter table public.profiles add column if not exists codigo_promo text;

-- 4. VALIDAR UN CÓDIGO SIN EXPONER LA TABLA ------------------
-- Devuelve jsonb: { valido, tipo, valor, descripcion, motivo }
-- Se usa en el registro para dar feedback inmediato al cliente.
-- No revela cuántos usos quedan ni ningún otro código.
create or replace function public.validar_codigo_promo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.codigos_promo;
  cod text := upper(trim(coalesce(p_codigo, '')));
begin
  if cod = '' then
    return jsonb_build_object('valido', false, 'motivo', 'vacio');
  end if;

  select * into c from public.codigos_promo where codigo = cod;

  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'no_existe');
  end if;
  if not c.activo then
    return jsonb_build_object('valido', false, 'motivo', 'inactivo');
  end if;
  if c.expira_at is not null and c.expira_at < now() then
    return jsonb_build_object('valido', false, 'motivo', 'caducado');
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return jsonb_build_object('valido', false, 'motivo', 'agotado');
  end if;

  return jsonb_build_object(
    'valido', true,
    'tipo', c.tipo,
    'valor', c.valor,
    'descripcion', c.descripcion
  );
end;
$$;

grant execute on function public.validar_codigo_promo(text) to anon, authenticated;

-- 5. ATAJO PARA CREAR CÓDIGOS --------------------------------
-- Ejemplo de uso desde el SQL Editor:
--   select public.crear_codigo_promo('VERANO26', 'mes_gratis', 30, 'Campaña verano', 100, null);
--   select public.crear_codigo_promo('AMIGO20', 'descuento_pct', 20, '20% primera cuota', null, now() + interval '60 days');
create or replace function public.crear_codigo_promo(
  p_codigo      text,
  p_tipo        text default 'mes_gratis',
  p_valor       int  default 30,
  p_descripcion text default null,
  p_usos_max    int  default null,
  p_expira_at   timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cod text := upper(trim(p_codigo));
begin
  insert into public.codigos_promo (codigo, tipo, valor, descripcion, usos_max, expira_at)
  values (cod, p_tipo, p_valor, p_descripcion, p_usos_max, p_expira_at)
  on conflict (codigo) do update
    set tipo = excluded.tipo,
        valor = excluded.valor,
        descripcion = excluded.descripcion,
        usos_max = excluded.usos_max,
        expira_at = excluded.expira_at,
        activo = true;
  return cod;
end;
$$;

-- 6. CANJEAR UN CÓDIGO (lo llama el servidor al crear el pago) ----
-- Atómico: bloquea la fila del código para que dos pagos simultáneos no
-- puedan pasarse del límite de usos. Es idempotente por usuario: si el mismo
-- cliente vuelve al pago, conserva su beneficio y no se cuenta dos veces.
create or replace function public.canjear_codigo_promo(p_codigo text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.codigos_promo;
  cod text := upper(trim(coalesce(p_codigo, '')));
  ya_estaba boolean;
begin
  select * into c from public.codigos_promo where codigo = cod for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  -- ¿Este usuario ya lo tenía canjeado? Entonces mantiene su beneficio.
  select exists(
    select 1 from public.canjes_promo where codigo = cod and user_id = p_user_id
  ) into ya_estaba;

  if not ya_estaba then
    if not c.activo then
      return jsonb_build_object('ok', false, 'motivo', 'inactivo');
    end if;
    if c.expira_at is not null and c.expira_at < now() then
      return jsonb_build_object('ok', false, 'motivo', 'caducado');
    end if;
    if c.usos_max is not null and c.usos >= c.usos_max then
      return jsonb_build_object('ok', false, 'motivo', 'agotado');
    end if;

    insert into public.canjes_promo (codigo, user_id) values (cod, p_user_id);
    update public.codigos_promo set usos = usos + 1 where codigo = cod;
  end if;

  return jsonb_build_object('ok', true, 'tipo', c.tipo, 'valor', c.valor, 'repetido', ya_estaba);
end;
$$;

-- Solo el servidor (service role) puede canjear. Los clientes no.
revoke execute on function public.canjear_codigo_promo(text, uuid) from anon, authenticated;

-- 7. EL CÓDIGO DEL MES GRATIS --------------------------------
-- Este es el que se reparte por redes / mensaje privado.
-- Ilimitado y sin caducidad. Para limitarlo, pon un número en usos_max
-- o una fecha en expira_at (ver ejemplos del punto 5).
select public.crear_codigo_promo(
  'GRATIS1MES',
  'mes_gratis',
  30,
  'Un mes gratis — campaña redes sociales',
  null,
  null
);

-- ------------------------------------------------------------
-- CHULETA DE ADMINISTRACIÓN (ejecutar cuando haga falta)
-- ------------------------------------------------------------
-- Ver los códigos y cuánto se han usado:
--   select codigo, tipo, valor, usos, usos_max, activo, expira_at from public.codigos_promo order by created_at desc;
--
-- Ver quién ha canjeado cada código:
--   select c.codigo, p.nombre, p.email, c.created_at
--   from public.canjes_promo c join public.profiles p on p.id = c.user_id
--   order by c.created_at desc;
--
-- Desactivar un código (deja de funcionar al instante):
--   update public.codigos_promo set activo = false where codigo = 'GRATIS1MES';
--
-- Limitar a los primeros 50:
--   update public.codigos_promo set usos_max = 50 where codigo = 'GRATIS1MES';
-- ------------------------------------------------------------
