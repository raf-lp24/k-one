# K-ONE — Estado actual

*Reescrito el 1 oct 2026. La versión anterior (997 líneas, de las primeras semanas) está en el historial de git.*

Web de entrenamiento y nutrición personalizados en **https://k-one.fit**. Primer mes gratis; después 7,99 €/mes (o 14,99 € el trimestre) el plan completo y 4,99 €/mes solo nutrición.

## Cómo está montado

| Pieza | Qué es |
|---|---|
| `index.html` | La app entera (SPA de ~30.000 líneas, un solo archivo): landing, cuestionario, panel del cliente, panel de admin («Jarvis») y el **motor de planes** (`buildPlanFromData`). |
| `running.html`, `gimnasio.html`, `hibrido.html`, `solo-nutricion.html` | Páginas públicas para buscadores, **generadas** con `node scripts/generar-paginas.js` (no editar a mano). |
| `api/*.js` (sin guion bajo) | **12 funciones de Vercel — es el tope del plan Hobby.** La 13ª rompe TODOS los despliegues. Si hace falta lógica nueva, va como `accion` dentro de una existente (ver `update-subscription.js`) y su código en un archivo `api/_xxx.js`. |
| `api/_*.js` | Módulos compartidos (no cuentan como función): hitos, premium, Stripe, Sentry, borrado de cuenta. |
| `lib/` | Código que usa el servidor: `motor-servidor.js` (ejecuta el MISMO script de `index.html` en Node), `normalizador-alimentos.js` (**Thor**, el agente que revisa planes), `aviso-del-dia.js`. `/lib/*` está tapado al público en `vercel.json`. |
| `data/` | `alimentos.json` (tabla de macros; **va copiada dentro de `index.html`**: `node scripts/incrustar-alimentos.js` tras tocarla) y fichas de ejercicios. |
| `supabase/*.sql` | Esquema y migraciones (se aplican a mano en el SQL Editor). |
| Servicios | Vercel (hosting + funciones + cron 09:00 UTC), Supabase (Auth, Postgres con RLS, Storage), Stripe (cobros), Resend (emails), Web Push, Sentry, Google Analytics (solo con consentimiento). |

## Lo que hace el cron de las 09:00 (`GET /api/notify`)
Avisos push de entreno · emails de retención (día 1, día 8, reenganche 7/14/21 días, resumen semanal) · **puesta al día de los planes** con el motor actual (y revisión de Thor) · resumen para el admin · **copia de seguridad** en Storage (bucket `backups`, privado). Incluye el **aviso antes del primer cobro** (a quien sigue en prueba, sin cancelar, a 3 días o menos). Se prueba entero con una base de datos simulada; ver «Pruebas».

## Pruebas — pasar siempre antes de subir
```
npm test
```
Encadena: estructura del proyecto (`comprobar-proyecto.js`: ≤12 funciones, sintaxis, JSON, FAQ = JSON-LD, precios, tabla de alimentos incrustada, páginas SEO) → borrado de cuenta (`probar-eliminar-cuenta.js`) → el cron de las 09:00 entero con 8 días simulados (`probar-cron.js`) → ~600 planes con el motor real y Thor (`comprobar-motor.js`, incluye que «Ver macros» cuadre ≥90 %) → auditoría de alimentos y recetario (`auditoria-completa.js`).
Además `tests.html` (20 pruebas en el navegador; abrir con el servidor local). GitHub Actions lo pasa en cada subida y avisa si falla, **pero no bloquea el despliegue**.

## Reglas que hay que respetar
- **Subir `CACHE_NAME` en `sw.js`** (`kone-vN`) con cada cambio de la web, o los móviles siguen con la copia vieja.
- **Motor y Thor van en espejo**: los patrones de `neutralizar` están en `index.html` Y en `lib/normalizador-alimentos.js` y deben ser idénticos (`auditoria-completa.js` lo comprueba).
- Los macros de una receta **nunca a mano**: `scripts/componer.js`.
- Cambiar un precio = Price nuevo en Stripe + variable de entorno + redeploy; y actualizar `index.html`, `llms.txt`, términos y las páginas generadas.
- El vídeo de la portada se llama `demo-septiembre.mp4`: `vercel.json` cachea `/demo-*` 30 días como inmutable, así que **al cambiarlo hay que cambiar el nombre**.
- Iconos: `node marketing/generar-iconos.mjs`. Vídeo demo: `node marketing/grabar-demo-oct.mjs` (lo deja en marketing/Videos/demo-octubre.mp4; la portada usa la copia de la raíz).
- Archivos con saltos de línea mezclados (CRLF/LF): editar con herramientas que los respeten; en scripts de shell se pierden las barras invertidas (`\d`, `\n`) — escribir los scripts a archivo.

## Variables de entorno (Vercel)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_COMPLETO_MENSUAL`, `STRIPE_PRICE_COMPLETO_TRIMESTRAL`, `STRIPE_PRICE_NUTRICION_MENSUAL`, `STRIPE_PRICE_OFERTA_MES` (+ las `_OLD` y `_ANUAL` de precios retirados), `RESEND_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`, `APP_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SENTRY_DSN`.

## Copias de seguridad
- **Automática:** cada día, a las 09:00, el cron guarda `backup-AAAA-MM-DD.json` en Supabase Storage (bucket `backups`): clientes con su cuestionario, suscripciones, mensajes, hitos, referidos, opiniones y leads. **Sin planes** (se regeneran). Borra las de más de 30 días. Si falla, llega un push al admin.
- **Fuera de Supabase:** `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/copia-seguridad.js` baja las copias a `copias/` (ignorada por git). Conviene hacerlo **una vez por semana**.
- **Restaurar:** un cliente → copiar su `userdata` de la copia a `profiles.userdata` y pulsar «Regenerar plan» en Jarvis. Todo el proyecto → importar `profiles`/`subscriptions` con el SQL Editor.

## Avisar si la web se cae
Crear un monitor gratuito en UptimeRobot (o similar): tipo **HTTP(s) con palabra clave**, URL `https://k-one.fit/`, palabra clave `K-ONE`, cada 5 minutos, aviso por email. Si se quiere vigilar también el cobro: monitor sobre `https://k-one.fit/api/is-admin` con método POST (responde `{"isAdmin":false}`).

## Privacidad
El cliente puede **eliminar su cuenta** desde el menú del panel (la copia de sus datos se pide por email) (`api/_eliminarCuenta.js`: cancela Stripe, borra fotos, mensajes, emails, lead y el usuario; la cascada de la base de datos borra el resto). No se borran los datos de facturación de Stripe ni las opiniones ya publicadas (se quitan a petición por email).

## Pendiente conocido
- «Bajo en carbohidratos» queda en ~38 % de las calorías en hidratos (hacen falta platos más grasos en el recetario).
- La proteína de la etiqueta de cada plato queda ~15 % por debajo de la que suman sus ingredientes.
- Stripe (v16) y Sentry (v10) van una versión mayor por detrás; sin vulnerabilidades conocidas.
- Opiniones externas (Google Business / Trustpilot): cuenta por crear.
