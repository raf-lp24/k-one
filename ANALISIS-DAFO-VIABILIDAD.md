# Fragua — Análisis DAFO, Competencia y Viabilidad

*Fecha: 2026-06-10. Basado en la versión actual del prototipo (`fragua-fitness.html`, v12) y en investigación de mercado.*

---

## 1. Resumen ejecutivo

**El concepto de Fragua tiene un hueco de mercado real y defendible.** No existe hoy un competidor que combine: (a) los 4 deportes (Gimnasio, Running, Hyrox, CrossFit) + nutrición en un solo producto, (b) un onboarding de ~30 preguntas como base de personalización real, (c) un ciclo cerrado de feedback → ajuste sin depender de wearables, (d) sustitución inteligente de ingredientes manteniendo macros, y (e) una identidad de marca propia en español ("disciplina silenciosa") frente al tono motivacional genérico de la competencia.

**El prototipo actual, sin embargo, es una maqueta interactiva, no un MVP cobrable.** Las dos promesas centrales del producto — "tu plan se adapta cada semana" y "personalización basada en tu salud y tu feedback" — **no están implementadas de verdad**: el check-in y el feedback de ejercicios no modifican el plan, y los datos de salud (lesiones, alergias, medicación) se recogen pero se ignoran. A esto se suma que no hay backend, pagos, ni seguridad mínima (contraseñas en texto plano).

**Conclusión de viabilidad:** el negocio es viable *como idea*; el riesgo principal a corto plazo no son los competidores, sino lanzar una versión que rompa la promesa de marca en la primera semana de uso real. Antes de cobrar a un solo usuario, hay que cerrar la brecha entre "lo que dice la landing" y "lo que hace el código".

---

## 2. Análisis DAFO

### Fortalezas (del concepto/diseño)
- **Identidad de marca diferenciada**: "disciplina silenciosa", tono directo, diseño industrial oscuro — ningún competidor analizado tiene una identidad así (todos usan tono motivacional genérico tipo "you got this!").
- **Cobertura de 4 deportes + nutrición en un solo producto**: nadie lo hace bien hoy (Runna = solo running; RoxFit/CompTrain = solo Hyrox/CrossFit sin nutrición; Centr/Sweat = multideporte pero contenido pre-grabado, no generado).
- **Sistema de sustitución de ingredientes**: es, con diferencia, la parte más elaborada del prototipo actual y un hueco real de mercado — ningún competidor analizado lo ofrece de forma robusta.
- **Onboarding profundo (~30 preguntas)** como base teórica de personalización, frente a programas predefinidos de la competencia.
- **Pricing de entrada agresivo (1,99€ primer mes)**: estrategia de conversión no replicada por ningún competidor directo (la mayoría usa trials gratuitos de 7-14 días).
- **Mercado hispanohablante todo-en-uno desatendido**: las alternativas en español son coaches humanos caros (25-340€/mes) o apps de nutrición pura (Fitia).

### Debilidades (del prototipo actual)
- **No es un producto funcional**: sin backend, sin base de datos, sin pasarela de pago. Todo vive en `localStorage` (no portable entre dispositivos, se pierde al borrar caché).
- **Seguridad inexistente**: contraseñas en texto plano, comparación en claro, recuperación de contraseña falsa (deja al usuario bloqueado para siempre).
- **Las promesas centrales no se cumplen**:
  - El check-in semanal y el feedback de ejercicios **no modifican el plan real** — solo muestran un mensaje de texto.
  - El plan está congelado en "Semana 1 · Día 1" para siempre, sin progresión temporal.
- **Datos de salud recogidos pero ignorados**: lesiones, enfermedades, medicación y alergias no afectan al plan generado — riesgo de seguridad para el usuario y riesgo legal/reputacional para el producto.
- **Generación de plan poco diferenciada**:
  - CrossFit reutiliza la plantilla semanal de "Gimnasio/Fuerza" (sin WODs/AMRAPs/EMOMs en la semana).
  - "Combinación" se trata siempre como Running.
  - El nivel (principiante/avanzado) solo afecta al "Día 1", no al resto de la semana.
  - La nutrición no varía según el deporte, solo según el objetivo.
- **`sinGluten` calculado y nunca aplicado**: alguien sin gluten sigue recibiendo avena, pan, pasta.
- **Sustitución de ingredientes no recalcula macros** tras el cambio — los datos mostrados quedan desactualizados.
- **Sin validación de formulario**: se puede llegar al final sin rellenar nada y obtener un plan genérico sin avisos.
- Deuda técnica menor: función duplicada (`selectMealOption`), variables muertas, inconsistencias de copy ("tres opciones" vs 4 reales).

### Oportunidades
- **Sustitución inteligente de ingredientes con macros equivalentes**: hueco de mercado confirmado, ningún competidor lo cubre bien (MacroFactor/Cronometer son trackers pasivos; MyFitnessPal Premium+ tiene "meal planner" pero no sustitución dinámica).
- **Ciclo cerrado feedback→ajuste sin hardware**: diferenciador directo frente a Cora (que depende de Whoop/Garmin/Oura).
- **Construir una marca con tono propio en español**: ningún competidor (ni internacional ni español) ocupa ese espacio hoy.
- **Capitalizar el onboarding de salud** convirtiéndolo en una ventaja real (adaptación por lesión/alergia) en vez de un checkbox decorativo — esto sería un argumento de venta fuerte y honesto ("tu plan tiene en cuenta tu rodilla, de verdad").
- **Progresión real semana a semana** como eje de retención (justifica la suscripción mensual frente a apps con contenido estático).

### Amenazas
- **Cora (corahealth.app)** es el competidor conceptualmente más parecido y **más barato** ($9,99/mes vs 19,99€/mes), ya con programación específica de Hyrox. Su debilidad (depende de wearables) es la oportunidad de Fragua, pero hay que vigilarlo de cerca.
- **Gigantes añadiendo IA a bases de usuarios masivas a coste marginal cero**: MyFitnessPal Premium+, Strava AI Coach, Whoop Coach. Si alguno ofrece "plan completo + nutrición + sustitución" dentro de su suscripción ya pagada, compiten desde una posición de distribución que Fragua no tiene.
- **Freeletics y Centr** ya tienen bundle entreno+nutrición a precio similar o menor (7-12,50€/mes en planes largos), con marcas reconocidas.
- **Riesgo de churn alto por el pricing de entrada**: 1,99€ el primer mes puede atraer usuarios de bajo compromiso que cancelen antes del segundo mes — especialmente si el "ajuste semanal" prometido no se nota porque (en el estado actual) no existe.
- **Pricing opaco de varios competidores directos al nicho Hyrox/multideporte** (ChAIron, RoxFit) — riesgo de que ya estén lanzando algo similar sin que se haya detectado en esta investigación.

---

## 3. Panorama competitivo (resumen)

| Categoría | Competidores clave | Precio aprox. vs 19,99€/mes Fragua | Qué les falta frente a Fragua |
|---|---|---|---|
| Entrenamiento IA (gym) | Fitbod, FitnessAI, BodBot | Similar o menor | Sin nutrición real, sin Hyrox/CrossFit/Running integrados |
| Entreno + nutrición (contenido) | Freeletics, Centr, Sweat | Menor o similar | Contenido pre-programado, no generado dinámicamente; sin sustitución de ingredientes |
| Nutrición/macros IA | MacroFactor, Cronometer, MyFitnessPal Premium+, Fitia | Menor (salvo MFP) | Sin entrenamiento estructurado; trackers pasivos |
| Hyrox/multideporte IA | **Cora** ($9,99/mes), ChAIron, RoxFit | Menor o no determinable | Cora depende de wearables; RoxFit con planes estáticos; ninguno con onboarding tan profundo |
| Running IA | Runna, Strava AI Coach | Similar/mayor | Solo running, sin gym/Hyrox/CrossFit/nutrición |
| Coaching humano (España) | Davfit, AM Fitness, Sitrainer, etc. | Mayor (25-340€/mes) | No escalable, caro, sin IA |

**El competidor a vigilar más de cerca es Cora** (corahealth.app): mismo concepto de ciclo cerrado entreno-recuperación-nutrición con IA, especialización en Hyrox, y más barato. Su dependencia de wearables (Whoop/Garmin/Oura) es la grieta por donde Fragua puede entrar (personalización sin hardware adicional).

---

## 4. Cómo diferenciarse (recomendaciones concretas)

1. **Hacer que la adaptación semanal sea real y visible.** Es el diferenciador #1 frente a Centr/Sweat/Freeletics (contenido estático) y la base de la retención. Si el check-in cambia de verdad el plan de la semana siguiente, es un argumento de venta verificable.
2. **Convertir el onboarding de salud en personalización real**, no solo en un formulario largo. "Tu plan evita sentadilla profunda porque nos dijiste que tienes molestias de rodilla" es un mensaje que ningún competidor genérico puede dar.
3. **Pulir y promocionar la sustitución de ingredientes con macros recalculados de verdad.** Es ya el módulo más fuerte del prototipo; con el recálculo de macros corregido, es un diferenciador defendible.
4. **Especializar de verdad CrossFit y Hyrox** (WODs, AMRAPs, EMOMs, ejercicios específicos como wall balls/burpees/ski erg en la base de variantes) — actualmente se diluyen en plantillas de gimnasio/running, justo el hueco que Cora/RoxFit están intentando ocupar.
5. **Mantener el pricing de entrada (1,99€) pero vigilar retención** del segundo mes — si la adaptación real no está lista, considerar retrasar esta promo hasta que el ciclo de feedback funcione, para no quemar la primera impresión con los usuarios más sensibles al precio.
6. **Doblar la apuesta por el tono de marca** ("disciplina silenciosa") en todos los textos generados (planes, mensajes motivacionales, check-ins) — es el diferenciador más fácil de defender porque no depende de tecnología, solo de consistencia editorial.

---

## 5. Estado del prototipo: puntos fuertes, débiles y prioridades

### Puntos fuertes del código actual
- Buen volumen de contenido (planes, textos motivacionales) coherente con el tono de marca.
- Sistema de sustitución de ingredientes con cobertura razonable de categorías y fallback genérico inteligente.
- Estructura del onboarding y dashboard ya cubre la mayoría de pantallas descritas en el producto.
- Base de variantes de ejercicios (~16 ejercicios con 3-4 variantes cada uno) con buen nivel de detalle para gimnasio tradicional.

### Puntos débiles (los que importan de verdad)
- **Brecha promesa↔realidad**: adaptación semanal y feedback de ejercicios no tienen efecto persistente.
- **Seguridad**: contraseñas en texto plano, recuperación de contraseña falsa.
- **Datos de salud ignorados** en la generación del plan — riesgo de seguridad/legal.
- **CrossFit y "Combinación" mal cubiertos** — contradicen el mensaje "planes específicos, no genéricos".
- **Sin backend/pagos**: no se puede cobrar a nadie tal cual está.
- **Sin progresión temporal**: siempre "Semana 1 · Día 1".

### Lista priorizada de próximos pasos

**Bloqueantes (antes de cualquier usuario de pago):**
1. Backend real + BD (usuarios, planes, check-ins) con auth segura (hashing de contraseñas, JWT/sesiones).
2. Recuperación de contraseña real (o eliminar el placeholder engañoso).
3. Integración de pago real (Stripe) conectada a los 3 planes.
4. Usar lesiones/alergias/medicación en la generación del plan (la variable `sinGluten` ya existe, solo falta aplicarla — y extenderlo a lesiones).
5. Quitar la cuenta de test visible en el login de producción.
6. Hacer que check-in y feedback de variantes **modifiquen de verdad** el plan (o ajustar el copy mientras tanto para no prometer algo que no ocurre).

**Importantes (antes de escalar marketing):**
7. Plan semanal real y diferenciado para CrossFit (WODs) y "Combinación" (mezcla real de deportes).
8. Progresión real por nivel a lo largo de toda la semana, no solo en el "Día 1".
9. Recalcular macros al sustituir ingredientes.
10. Tracking real de "días entrenados" / semana actual / progresión temporal.
11. Validación de campos obligatorios en el onboarding.
12. Ampliar `variantesDB` con ejercicios de Hyrox/CrossFit (wall balls, burpees, ski erg, sled push, farmer carry...).
13. Persistir sustituciones y variantes elegidas.

**Pulido (no bloqueante):**
14. Eliminar duplicados y código muerto (`selectMealOption`, `sinGluten` ya cubierto arriba, comentarios obsoletos).
15. Corregir copy "tres opciones" → "cuatro opciones".
16. Conectar botones de precio del landing con el plan elegido.
17. Accesibilidad: inputs reales en vez de `<div onclick>`.
18. Subida real de fotos de progreso y desbloqueo dinámico de hitos.

---

## 6. Veredicto final

- **Idea**: viable, con diferenciación real y hueco de mercado verificado (especialmente frente a Cora, Centr, Freeletics y Runna).
- **Producto actual**: prototipo de alta fidelidad visual pero funcionalmente una maqueta — **no apto para cobrar** sin resolver los 6 puntos bloqueantes.
- **Mayor riesgo a corto plazo**: no es la competencia, es la **disonancia entre lo que la marca promete** ("tu plan se adapta cada semana", "personalización basada en tu salud") **y lo que el código hace hoy**. Cerrar esa brecha es el camino crítico antes de cualquier lanzamiento, campaña de pricing agresivo (1,99€) o inversión en adquisición.
