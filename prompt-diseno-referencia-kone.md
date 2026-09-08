# Prompt de referencia — cómo está construida K-ONE (k-one.fit)

Quiero que uses mi web K-ONE como referencia técnica y de diseño para este proyecto nuevo. No la copies literal — es una web de fitness y esta es de [DESCRIBE AQUÍ EL NUEVO NEGOCIO] — pero constrúyela con el mismo nivel de cuidado en estas áreas: diseño, animación/interactividad, flujos de pago, seguridad, SEO y marketing.

## 1. Diseño

**Dirección de arte**: oscuro, cinematográfico y premium. Fondo casi negro (no negro puro), un único color de acento saturado usado con mucha disciplina (nunca más de 2-3 elementos por pantalla), el resto en escala de grises cálidos. SVGs propios de trazo fino, no iconos de stock genéricos.

```css
:root {
  --negro: #0A0A0A;        /* fondo base */
  --carbon: #141414;       /* superficie de cards */
  --grafito: #1E1E1E;      /* superficie elevada */
  --acero: #2A2A2A;        /* bordes/divisores sutiles */
  --acento: #E8490F;       /* CAMBIAR por el color de marca del proyecto nuevo */
  --acento-oscuro: #C03A08;
  --metal: #8A8A8A;        /* texto secundario */
  --metal-claro: #B5B2AD;  /* texto terciario */
  --humo: #3A3A3A;         /* bordes sobre fondo oscuro */
  --blanco: #F0EDE8;       /* texto principal (blanco roto, no #FFF puro) */
}
```
Si hay modo claro: no es el oscuro invertido — fondo crema `#F8F6F3`, cards `#FFFFFF`, texto `#1A1A1A`, bordes `#E0DCD5`. El acento se mantiene igual en ambos modos.

**Tipografía — 3 fuentes, cada una con un rol fijo**:
- Display/titulares: condensada en mayúsculas (K-ONE usa "Bebas Neue") — solo números grandes y títulos de sección.
- Cuerpo: sans-serif neutra ("Inter", pesos 300-600) — todo el texto normal.
- Datos/etiquetas: monoespaciada ("DM Mono") — estadísticas, badges, timestamps, con letter-spacing y mayúsculas pequeñas. Es el detalle que más distingue el estilo.

**Componentes**: radios de 6-8px en botones/inputs, 12-16px en cards grandes, `999px` en badges, círculo en avatares. Cards con fondo elevado + borde de 1px, nunca sombras duras — la profundidad viene del contraste de superficies.

**Fotografía**: siempre en la misma dirección oscura, nunca stock genérico y luminoso. Si aparece marca en una imagen (camiseta, cartel), debe ser SIEMPRE la marca del proyecto, nunca marcas de terceros.

## 2. Animación e interactividad

- Transiciones cortas y consistentes en TODO: `transition: all 0.2s` como valor por defecto en botones, cards e inputs — nada de animaciones largas de más de medio segundo, deben sentirse instantáneas pero suaves.
- Entradas de contenido con `fadeInUp`/`fadeInDown` (opacidad + desplazamiento de 4-20px), nunca apariciones bruscas: cada sección/modal que se abre usa una de estas dos.
- **Skeleton loading** con efecto shimmer (gradiente que se desliza en bucle) mientras carga contenido real desde el servidor — nunca una pantalla en blanco ni un spinner genérico girando; los bloques skeleton deben tener la misma forma/tamaño que el contenido final para que no haya "salto" al cargar.
- Feedback en tiempo real en formularios largos: si el usuario está rellenando datos que alimentan un cálculo (precio, resultado, recomendación), ese cálculo se recalcula y se muestra en vivo mientras escribe, no solo al final.
- Micro-celebraciones en hitos reales del usuario (confeti al completar un logro, por ejemplo) — con moderación, solo en momentos que de verdad lo merecen, nunca en cada clic.
- Sistema de notificaciones tipo "toast" (mensaje flotante que aparece y se retira solo) para confirmaciones y errores, en vez de `alert()` del navegador.

## 3. Flujos de pago

- El precio a cobrar SIEMPRE se resuelve en el servidor a partir de un identificador fijo (tipo de plan + periodicidad → Price ID), nunca un número que llegue del navegador.
- **Cambios de plan sin prorrateo**: si el negocio promete "el cambio se aplica en el siguiente periodo, no a mitad de mes", se implementa con una programación de fases en el proveedor de pagos (ej. `subscriptionSchedules` de Stripe: fase actual con el precio viejo hasta que acabe lo ya pagado, fase siguiente con el precio nuevo) — no con prorrateo automático, que cobra la diferencia al momento y contradice esa promesa.
- **Ofertas de primer pago** (ej. "primer mes a X€"): la elegibilidad se verifica contra el HISTORIAL REAL del cliente en el proveedor de pagos (¿ha tenido alguna suscripción antes?), nunca contra un flag guardado en tu propia base de datos que el usuario pudiera manipular o que se pudiera perder al volver atrás sin completar el pago.
- **Evitar suscripciones duplicadas**: antes de crear una sesión de pago nueva, comprobar si el cliente ya tiene una suscripción activa/en prueba/con pago pendiente y bloquear si es así — sin este check, un doble clic o una petición repetida crea dos suscripciones reales y cobra dos veces.
- **Webhooks idempotentes y con firma verificada**: cada evento que llega del proveedor de pagos se valida por firma criptográfica, y se guarda su ID antes de procesarlo — si el proveedor reenvía el mismo evento (pasa con frecuencia, "al menos una vez" es la garantía habitual), se detecta el duplicado y se responde OK sin volver a aplicar el efecto.
- **Sincronizar el estado eligiendo siempre "la mejor" suscripción del cliente**, no la última que llegó por webhook — un evento de cancelación de una suscripción vieja no debe quitarle el acceso a alguien que ya tiene una nueva activa.
- **Portal de cliente** del propio proveedor de pagos para que gestione su método de pago/cancelación, en vez de construir esa UI a mano.
- **Códigos promocionales**: se validan y canjean en el servidor, nunca solo en el cliente; y cualquier columna de la base de datos que conceda beneficio económico (descuento acumulado, acceso gratuito, etc.) debe estar protegida para que el propio usuario no pueda escribirla directamente aunque tenga permiso para actualizar el resto de su fila — ver sección de seguridad.
- **Avisar al admin** cuando algo del flujo de pago falla silenciosamente (no se pudo programar un cambio de precio, no se pudo cancelar una suscripción al borrar un cliente, se abrió una disputa/chargeback) — un `console.warn` que nadie mira no es un aviso.

## 4. Seguridad — lo mínimo no negociable

- **RLS en cada tabla de la base de datos**, sin excepción, limitada siempre a "el dueño de la fila" (`auth.uid() = user_id`), nunca `using (true)` salvo contenido deliberadamente público. Antes de dar una tabla por cerrada, lee el contenido real de cada política (`cmd`/`roles`/`qual`/`with_check`) — el número de políticas no dice nada por sí solo: dos políticas pueden anularse entre sí porque las permisivas se combinan con OR y gana siempre la más abierta. Es el fallo más fácil de dejar pasar y el más grave si se escapa.
- **Ninguna columna con beneficio económico o de acceso queda protegida "por casualidad"**: si un usuario puede actualizar su propia fila, cualquier columna sensible de esa fila (crédito, flag de acceso gratuito, fecha de expiración) necesita protección explícita (trigger que ignore el cambio si viene del propio usuario), no solo confiar en que "nadie se le va a ocurrir tocarla".
- **Nunca confíes en el cliente para decidir un precio o un permiso.** El servidor resuelve el precio por un mapeo fijo, y cualquier acción de administrador vuelve a comprobar en el servidor quién es admin — nunca solo un flag que el cliente diga tener.
- **Validar el JWT de verdad**: llamar al método oficial del proveedor de auth para verificar la firma del token, nunca decodificar el payload sin comprobarla.
- **Rate-limit server-side por IP** en cualquier endpoint público sin login — un límite solo en el navegador se salta con una petición directa.
- **Todo lo que un usuario escriba y acabe en HTML se escapa** antes de insertarlo, sin excepción.
- **Secretos solo en variables de entorno**, nunca en el código; `.gitignore` cubriendo `.env*` desde el primer commit.
- **Cabeceras de seguridad HTTP** en todas las respuestas: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` con preload, `Referrer-Policy`.
- **Contraseñas**: mínimo 8 caracteres, exigir complejidad, activar comprobación contra contraseñas filtradas si el plan del proveedor lo permite, y exigir la contraseña actual para cambiarla (evita que alguien con una sesión ya abierta secuestre la cuenta cambiándola sin más).

## 5. SEO

- `<title>` único y descriptivo, `<meta name="description">` con la propuesta de valor + precio.
- Open Graph completo: `og:title`, `og:description`, `og:image` (1200×630 dedicada, no un logo genérico), dimensiones y tipo.
- `<link rel="canonical">`.
- **JSON-LD** con datos estructurados, y sincronizado de verdad con los precios reales que se cobran — si cambias un precio en el código de pago, cámbialo también aquí.
- `sitemap.xml` y `robots.txt` en la raíz.
- `manifest.json` + service worker si se quiere que sea instalable como PWA.

## 6. Marketing

- **Analítica real** desde el primer día (GA4 u otra), con el ID de verdad, no un placeholder olvidado.
- **Captura de leads** (email a cambio de algo de valor) guardada en base de datos con su propio rate-limit, no solo un formulario que manda un email y ya.
- **Secuencia de emails automática de retención**, disparada por inactividad (ej. "te registraste hace 3 días y no completaste el cuestionario", "hace 8 días que lo completaste y no has pagado") — con control de que no se envíe el mismo email dos veces a la misma persona.
- **Programa de referidos** si aplica: crédito real aplicado en el proveedor de pagos, nunca solo un contador cosmético — y con el mismo cuidado de seguridad que cualquier otro beneficio económico (sección 4).
- **Prueba social real, nunca inventada**: si no hay testimonios reales todavía, no poner ninguno de mentira — se nota y es un problema de confianza, no solo de diseño. Cualquier testimonio enviado por un usuario pasa por moderación antes de ser público.
- Aviso al cliente (no solo al admin) cuando algo de su cuenta requiere acción suya (pago fallido, renovación próxima) — con un periodo de gracia razonable antes de cortar el acceso.

---

**Cómo usar esto**: pega este documento entero al principio de la conversación donde vayas a construir la web nueva, y a continuación describe el negocio concreto (qué vende, a quién, qué tono de marca quieres, y con qué proveedores vas a trabajar: base de datos, pagos, hosting, email). Pide explícitamente que se aplique este mismo nivel de cuidado en todas las áreas, adaptando color, fotos, copy y lógica de negocio al proyecto nuevo.
