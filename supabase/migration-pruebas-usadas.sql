-- MES GRATIS UNA SOLA VEZ POR EMAIL (1 oct 2026). Ver api/_pruebaGratis.js.
-- Guarda una huella (SHA-256 del email normalizado, nunca el email) de cada
-- email que ya ha tenido suscripción. Sin FK a auth.users a propósito: tiene que
-- sobrevivir al borrado de la cuenta.

create table if not exists public.pruebas_usadas (
  email_hash text primary key,
  creado     timestamptz not null default now()
);

-- Solo la usa el servidor (service role). Nadie desde la web puede leerla ni tocarla.
alter table public.pruebas_usadas enable row level security;
revoke all on public.pruebas_usadas from anon, authenticated;

-- Misma normalización que normalizarEmail() en api/_pruebaGratis.js:
-- minúsculas, sin espacios, sin "+loquesea" y, en Gmail, sin puntos.
create or replace function public.normalizar_email_prueba(e text)
returns text language plpgsql immutable as $$
declare
  x   text := lower(trim(coalesce(e, '')));
  pos int;
  loc text;
  dom text;
begin
  if position('@' in x) = 0 then return x; end if;
  pos := length(x) - position('@' in reverse(x)) + 1;  -- última @
  if pos <= 1 then return x; end if;
  loc := split_part(substr(x, 1, pos - 1), '+', 1);
  dom := substr(x, pos + 1);
  if dom in ('gmail.com', 'googlemail.com') then
    loc := replace(loc, '.', '');
    dom := 'gmail.com';
  end if;
  return loc || '@' || dom;
end $$;

revoke all on function public.normalizar_email_prueba(text) from anon, authenticated;

-- Relleno inicial: todos los clientes actuales que ya han tenido suscripción.
insert into public.pruebas_usadas (email_hash)
select distinct encode(sha256(convert_to(public.normalizar_email_prueba(u.email), 'UTF8')), 'hex')
from auth.users u
join public.subscriptions s on s.user_id = u.id
where u.email is not null
  and s.status is not null
  and s.status not in ('none', 'incomplete', 'incomplete_expired')
on conflict (email_hash) do nothing;

-- Comprobación: cuántas huellas hay ahora.
select count(*) as emails_con_mes_gratis_usado from public.pruebas_usadas;
