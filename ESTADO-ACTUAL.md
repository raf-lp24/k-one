# Fragua — Estado actual (resumen de sesión)

*Para retomar sin releer toda la conversación.*

## Contexto
Prototipo single-file en `fragua-fitness.html` (HTML/CSS/JS, sin backend, localStorage).
Análisis DAFO completo en `ANALISIS-DAFO-VIABILIDAD.md` (no tocar, solo referencia).

## Cambios implementados en esta sesión

### 1. Check-in semanal y feedback de ejercicios modifican el plan real
- `submitCheckin()`: calcula `progreso` (semana++, diasEntrenados, ajuste -1/0/+1 según rendimiento), regenera el plan con `buildPlanFromData()`, persiste y refresca dashboard.
- `confirmVariants()`: guarda `userData.variantPreferences`, regenera plan, persiste y refresca dashboard.
- Dashboard ahora muestra semana/días reales vía nuevos IDs: `dashWeekDay`, `statSemana`, `statDiasEntrenados`, `checkinSemanaLabel`.

### 2. Lesiones, alergias, enfermedades y medicación adaptan el plan
- En `buildPlanFromData()`, bloque "ADAPTACIONES POR SALUD, PROGRESIÓN Y FEEDBACK":
  - `mapaLesion` (Rodilla/Espalda/Hombro/Otra) sustituye ejercicios vía regex en `entrenamiento_hoy` y `semana[].detalle`.
  - Notas para enfermedades (cardíacos/Hipertensión/Diabetes/Otra) y medicación (texto libre, tono "consulta a tu médico", nunca prescribe).
  - `sinGluten`/`sinLactosa`/`sinFrutosSecos`/alergia "Otra" adaptan `nutricion` (ingredientes y nombres de comidas).
  - Callout visual "// Tu plan, adaptado" se antepone a `entrenamiento_hoy` cuando hay notas.

### 3. Seguridad de contraseñas
- `hashPassword(pass)`: usa SHA-256 (`crypto.subtle`) si está disponible; si no (p.ej. `file://`, donde `crypto.subtle` es `undefined`), usa hash de respaldo (FNV/DJB2 combinados).
- `registrar()`/`login()` ahora `async`, comparan `passHash`.
- Recuperación de contraseña real: modal en 2 pasos (`checkForgotEmail()` → `resetPassword()`), sin backend de email.

### 4. CrossFit y "Combinación" tienen planes semanales propios
- CrossFit: WOD/AMRAP/EMOM/Hero WOD, distinto de Gimnasio.
- Combinación: mezcla real fuerza+cardio, distinto de Running puro.

## Bugs encontrados y arreglados DESPUÉS de la implementación

### Bug 1 — Pantalla negra al abrir con `file://`
- Causa: `window.onload` es `async` y lo primero que hacía era `await hashPassword(...)` → `crypto.subtle.digest(...)`. En `file://`, `crypto.subtle` es `undefined` → throw → el resto de `onload` (incluido `goTo('landing')`) nunca se ejecutaba → pantalla negra (todas las `.screen` son `display:none` hasta que JS activa una).
- Fix: `hashPassword` ahora detecta si `crypto.subtle` existe; si no, usa hash de respaldo. Además, todo el bloque de "cuenta de test" en `onload` está envuelto en `try/catch` para que `goTo()` SIEMPRE se ejecute pase lo que pase.

### Bug 2 — Cuenta de test (`test@fragua.es` / `fragua123`) da "Email no encontrado"
- Causa probable: el hash guardado en `localStorage` (de una versión/entorno anterior) no coincide con el que produce `hashPassword` ahora, O `localStorage` no persiste en `file://` en ese navegador (Chrome puede bloquear `localStorage` para `file://`).
- Fix aplicado: `onload` recalcula `testPassHash` con el método actual y reescribe la cuenta de test si no coincide.
- Diagnóstico añadido: al cargar, si `localStorage.setItem/getItem` falla, se muestra un toast naranja avisando que el navegador bloquea el guardado local en `file://`.

## Confirmado por el usuario
- Bug 1 (pantalla negra) y Bug 2 (login cuenta de test) funcionan correctamente al abrir con Firefox vía:
  `file:///C:/Users/Usuario/Desktop/Rafa%20Personl/Proyetos/Fragua/fragua-fitness.html`
- Flujo de trabajo acordado: tras cada cambio, se le da al usuario esa misma URL para recargar en Firefox y probar (no hace falta servidor).
- `serve.ps1` ya NO existe (se creó y se borró en una sesión anterior).

### 5. Validación de campos obligatorios en el onboarding (item 11 del DAFO)
- Nuevo CSS (~línea 662): `.field input.error/select.error/textarea.error` y `.radio-group.error .radio-opt` → borde rojo `#e8150f`.
- Nuevo objeto `requiredFieldsByBlock` (junto a `selectRadio`/`updateProgress`) con los campos obligatorios de cada uno de los 6 bloques:
  - Bloque 0 (Cuerpo): edad, sexo, peso, altura, complexión.
  - Bloque 1 (Salud): enfermedad, lesión, alergia (operación/medicación opcionales).
  - Bloque 2 (Vida): ninguno obligatorio.
  - Bloque 3 (Alimentación): dieta, comidas, cocina.
  - Bloque 4 (Objetivo): objetivo, plazo.
  - Bloque 5 (Entrenamiento): deporte, días/semana, tiempo/sesión, nivel, lugar.
- Nueva función `validateBlock(blockIndex)`: marca en rojo los campos vacíos/sin seleccionar, muestra toast "Completa los campos obligatorios marcados en rojo antes de continuar." y hace scroll al primer campo inválido.
- `nextBlock()` y `generatePlan()` ahora llaman a `validateBlock(currentBlock)` y abortan si devuelve `false`.
- `selectRadio()` quita la clase `.error` del grupo al seleccionar una opción; los inputs/selects de texto/número quitan `.error` al escribir/cambiar (listener añadido al cargar el script).
- **Pendiente de probar por el usuario** en Firefox.

## Pendientes generales del DAFO (no abordados, no pedidos aún)
Items 5, 7, 8, 9, 10, 12, 13-18 de la lista priorizada en `ANALISIS-DAFO-VIABILIDAD.md` (quitar cuenta de test visible en producción, recalcular macros tras sustitución, ampliar `variantesDB` con ejercicios Hyrox/CrossFit, subida real de fotos, etc.) — sin acción, no solicitados todavía. Item 11 (validación) ya implementado, ver arriba.

### 6. Plan "solo dieta" (sin entrenamiento) — IMPLEMENTADO
- Nuevo radio-group `tipoPlan` al inicio del Bloque 5 "Objetivo": "Plan completo: entrenamiento + nutrición" / "Solo nutrición, sin entrenamiento" (obligatorio, en `requiredFieldsByBlock[4]` y `collectFormData()`).
- `esSoloDieta()`: lee `#tipoPlan .selected`. `nextBlock()` ahora, si estás en el bloque 4 (Objetivo) y elegiste "Solo nutrición", llama directamente a `generatePlan()` y se salta el Bloque 6 (Entrenamiento) por completo.
- `buildPlanFromData(u)`: nuevo flag `soloDieta`.
  - Si `soloDieta`, no genera `entrenamiento_hoy` ni `semana` (quedan vacíos), y se omiten las adaptaciones por lesión/enfermedad/medicación/progreso/variantes (todo eso es específico de entrenamiento).
  - La nutrición se genera igual que siempre (no depende del deporte).
  - Las notas de alergias/intolerancias (sin gluten, sin lactosa, sin frutos secos, alergia "Otra") se devuelven en `notasNutricion` en vez de en el callout de entrenamiento.
  - Bienvenida (`bienvenida`) tiene un texto propio para plan solo-dieta.
  - El return ahora incluye `soloDieta` y `notasNutricion`.
- `buildDashboard()`: si `generatedPlan.soloDieta`, oculta los nav-items "Hoy", "Plan semanal" y "Check-in semanal" (nuevos IDs `nav-hoy`/`nav-semana`/`nav-checkin`), y abre el dashboard directamente en "Nutrición" (`section-nutricion`/`nav-nutricion`). El callout de adaptación (`notasNutricion`) se muestra en un nuevo div `#nutricionNotas` encima de la cuadrícula de comidas.
- `generatePlan()`: los textos de la pantalla de carga cambian (ej. "Diseñando tu plan de nutrición...") si `tipoPlan` es "Solo nutrición".
- **Probado en el preview (localhost:8080)** con clics reales: tanto el flujo "Solo nutrición" (salta al dashboard solo con Nutrición/Mi progreso, banner de adaptación visible) como el flujo "Plan completo" (sigue mostrando el Bloque 6 Entrenamiento) funcionan correctamente.

### 6.1 Bug encontrado y arreglado: sustitución "sin gluten" no cubría "tostada centeno"
- Al probar el plan "Solo nutrición" con alergia al gluten, la opción de desayuno "Tortilla de claras con verduras" mostraba "1 tostada centeno" sin adaptar (el resto de opciones sí se adaptaban).
- Causa: las regex de `reemplazosNutricion` (sección "Adaptar nutrición a alergias/intolerancias", ~línea 3611) cubrían "X rebanada(s) [de] [pan] centeno" y "tostada(s) DE centeno", pero no "X tostada(s) centeno" (sin "de").
- Fix: añadido `[/(\d+) tostadas? (de )?(pan )?centeno/gi, '$1 tostada(s) de pan sin gluten']`.
- Verificado: ahora la opción muestra "1 tostada(s) de pan sin gluten".

### 6.2 Bugs encontrados y arreglados: sustituciones dobles "sin lactosa" y "sin frutos secos"
- **Sin lactosa**: "Requesón" → regla `/requesón/gi` lo convertía en "queso fresco sin lactosa", pero la regla genérica `/\bqueso\b/gi` volvía a matchear el "queso" resultante, dando "queso sin lactosa fresco sin lactosa" (y lo mismo con "queso cottage" → "queso sin lactosa cottage sin lactosa").
  - Fix: la regla genérica ahora es `/\bqueso\b(?!\s+(?:fresco|cottage)\s+sin\s+lactosa)/gi`, que no vuelve a matchear sobre el resultado de las reglas anteriores.
- **Sin frutos secos**: ingredientes con dos frutos secos en la misma frase (ej. "15g nueces o almendras") se convertían en "15g semillas de calabaza o semillas de calabaza" (duplicado), y nombres de plato como "Fruta de temporada + frutos secos" no se adaptaban (la palabra "frutos secos" no tenía regla propia).
  - Fix: nueva regla `[/(nueces|almendras|avellanas) o (nueces|almendras|avellanas)/gi, 'semillas de calabaza y pipas']` (antes de la regla individual) + nueva regla `[/frutos secos/gi, 'semillas']`.
- Verificado con `buildPlanFromData` para dietas "Sin lactosa"/alergia Lactosa, alergia Frutos secos (normal y vegetariana): ya no quedan menciones de lácteos con lactosa ni de nueces/almendras/avellanas/cacahuete/frutos secos sin adaptar. Captura del dashboard confirma "queso fresco sin lactosa con fruta y canela / 200g queso fresco sin lactosa 0%" (sin duplicado).

### 6.3 Alergia "Otra" + botón de sustitución de ingredientes
- Probado el flujo completo: alergia "Otra" → nota genérica "Revisa los ingredientes... usa el botón de sustitución" se muestra correctamente en `#nutricionNotas`.
- Modal de sustitución (`openSubstModal`/`getSubstitutions`) se abre y funciona en el dashboard solo-dieta.
- **Bug encontrado y arreglado**: al pedir sustituir "1 tostada centeno" (ingrediente sin adaptar a gluten, ej. con alergia "Otra"), `getSubstitutions` no reconocía "centeno"/"tostada" como hidrato (`esHidrato`, ~línea 4039) y devolvía sugerencias genéricas poco útiles ("centeno en versión diferente", "Proteína equivalente de temporada"). Fix: añadidos `tostada|centeno` al regex `esHidrato`. Ahora sugiere quinoa/patata cocida/arroz integral.
- **Limitación pre-existente detectada (no arreglada, fuera de alcance de esta sesión)**: el parser `cantidad`/`tipo` de `getSubstitutions` separa "1 tostada centeno" en `cantidad="1 tostada"` + `tipo="centeno"`, lo que da nombres de sustituto raros tipo "1 tostada quinoa" o "1 tostada patata cocida". Afecta a cualquier ingrediente con formato "N unidad nombre" (no es específico del plan solo-dieta). Necesitaría revisar el regex de extracción de cantidad en `getSubstitutions` (~línea 3898).
- **Recordatorio**: el campo "alergia" del onboarding es un radio de selección única (No/Gluten/Lactosa/Frutos secos/Otra) — un usuario no puede indicar varias alergias a la vez. Limitación de diseño existente, no introducida por el plan solo-dieta.

### 6.4 Bug encontrado y arreglado: la "bienvenida" personalizada (con evento) nunca se veía en planes solo-dieta
- `buildDashboard()` escribe `generatedPlan.bienvenida` (texto que incluye el objetivo y, si lo hay, el evento del usuario, ej. "Tu objetivo \"Hyrox Madrid en marzo\" está en el horizonte...") en `#dashSubtitle`, dentro de `section-hoy`.
- Para planes "solo nutrición", `section-hoy` se oculta (`display:none`) y el dashboard abre directamente en `section-nutricion` → ese texto de bienvenida (el principal "gancho" de la personalización con evento) nunca llegaba a verse.
- Fix:
  - Nuevo `<p id="nutricionBienvenida" style="display:none">` en `section-nutricion` (debajo del subtítulo fijo "Tres opciones por comida...").
  - En `buildDashboard()`, si `generatedPlan.soloDieta` es `true`, se rellena con `generatedPlan.bienvenida` y se muestra; si no, se mantiene oculto.
- Verificado en el preview: con plan "Solo nutrición" + objetivo "Preparar una competición" + evento "Hyrox Madrid en marzo", el texto completo (incluyendo la mención al evento) aparece bajo el título "Hoy comes". Con un plan "Plan completo" normal, el elemento permanece oculto (`display:none`) y `#dashSubtitle` (sección "Hoy") sigue mostrando su bienvenida habitual.

### 7. Plan "Solo nutrición" visible en la landing (deportes + precios)
- Nueva tarjeta "Solo nutrición" (🥗) en la sección "Tu deporte, tu plan" (5 columnas ahora; `.sports-grid` pasó de `repeat(4,1fr)` a `repeat(5,1fr)`).
- Nueva tarjeta de precio "// Solo nutrición" a **4,99€/mes** en "Sin letra pequeña" (`.pricing-cards` pasó de 3 a 4 columnas, max-width 900→1160px). Su botón "Empezar" lleva al registro normal; el usuario elige "Solo nutrición, sin entrenamiento" en el Bloque 5.
- Verificado en preview a 1280px y 390px (en móvil las tarjetas colapsan bien a 2 col / 1 col).

### 8. Revisión completa de la página (landing + dashboard como cliente de test)
Revisión hecha navegando como visitante y como cliente (`test@fragua.es`). Arreglos aplicados y verificados en preview:
- **Bug `showSection(id)`**: usaba la global implícita `event` (`event.currentTarget`) para marcar el nav activo → lanzaba TypeError si se llamaba desde código y era frágil. Ahora hace `document.getElementById('nav-'+id)?.classList.add('active')`.
- **Bug variantes de ejercicio**: al confirmar una variante (ej. Press de banca → Press con mancuernas), el regex solo reemplazaba el nombre y dejaba el material original: "Press con mancuernas **con barra**". El regex ahora consume también el complemento `( (con|en) (barra|mancuernas|máquina|polea (baja|alta)|peso|banco))?`. Verificado: "· Press con mancuernas · 4 × 6" sin restos, y "Press inclinado con mancuernas" (otro ejercicio) intacto.
- **Copy Nutrición**: el subtítulo decía "Tres opciones por comida" pero se generan 4 → ahora "Cuatro opciones por comida".
- **Footer**: © 2025 → © 2026.
- **Hero**: añade "¿Solo buscas nutrición? También hay plan para ti, desde 4,99€/mes."
- **Nota de precios**: "Todo incluido. Sin niveles. Sin sorpresas." (ya había 2 modalidades) → "Precios claros. Cancela cuando quieras. Sin sorpresas."
- **Verificado sin cambios**: check-in semanal completo (semana 1→2, 3 días, respuesta personalizada, plan regenerado y persistido), plan semanal (7 días, descansos correctos), nutrición 5 comidas × 4 opciones, "Mi progreso", flujo demo (`demoAccess`), login/logout.
- Tras las pruebas, la cuenta de test se restauró (se borró `fragua_data_test@fragua.es` para que `onload` la regenere limpia en semana 1).

### 9. Marcar entrenamiento de hoy como completado + sección "Notas" (agenda personal)
- **Marcar entreno como completado** (`section-hoy`):
  - Nuevo botón `#btnCompletado` ("✓ Marcar como completado") junto a "¿Cómo va el entreno? →".
  - `toggleEntrenoCompletado()` añade/quita la fecha de hoy (`getFechaHoyISO()`, formato `YYYY-MM-DD`) en `userData.entrenosCompletados` (array), persiste con `saveUserData` y llama a `actualizarEstadoCompletado()`.
  - `actualizarEstadoCompletado()`: si la fecha de hoy está en `entrenosCompletados`, el botón pasa a "✓ Completado" (estilo relleno, clase `.completado`) y se muestra el aviso `#entrenoCompletadoBadge` ("🔥 Entrenamiento de hoy completado. Buen trabajo."). Se llama desde `buildDashboard()`.
- **Sección "Notas"** (nuevo nav-item `nav-notas` / `section-notas`, agenda personal):
  - Textarea + botón "Guardar nota" (`addNota()`); lista de notas (`renderNotas()`) con fecha/hora y botón "Eliminar" (`deleteNota(idx)`).
  - Notas guardadas en `userData.notas` (array de `{fecha, texto}`, más reciente primero), persistidas con `saveUserData`. Pensada para apuntar pesos, sensaciones, ideas de entreno, etc.
  - Visible para todos los planes (no se oculta en planes "solo nutrición").
- Verificado en preview con `test@fragua.es`: marcar/desmarcar entreno completado cambia el botón y muestra/oculta el badge; añadir y eliminar notas funciona; ambos estados persisten tras recargar la página (`localStorage`). Cuenta de test limpiada después de las pruebas (`entrenosCompletados: []`, `notas: []`).
- **Reflejo en "Plan semanal"**: la tarjeta del día de hoy (`#dayCardHoy`, primera del `weekGrid`) muestra un círculo "✓" (`#dayCompletadoBadge`) cuando el entreno de hoy está marcado como completado. `actualizarEstadoCompletado()` sincroniza el badge de "Hoy" y el de "Plan semanal" a la vez. Verificado en preview: al marcar/desmarcar desde "Hoy", el círculo aparece/desaparece sobre la tarjeta "Lunes" en "Plan semanal".

### 10. Rediseño de "Plan semanal" + vista del mes completo (4 semanas)
- **Rediseño visual**: la cuadrícula de 7 columnas estrechas (`.week-grid`/`.day-card`, texto apretado y truncado) se sustituye por una lista vertical de filas (`.week-list`/`.week-day-row`), cada una a ancho completo: columna izquierda con día/tipo/músculos/etiqueta, columna derecha con la lista de ejercicios sin recortes. Mucho más legible, especialmente con nombres de ejercicios largos. En móvil (`@media max-width:768px`) las filas pasan a apilarse en columna.
- **Vista del mes (4 semanas)**: nuevas pestañas `#weekTabs` ("Semana N · Actual", "Semana N+1", "N+2", "N+3") encima de la lista. La pestaña "Actual" muestra el plan real (`generatedPlan.semana`, con badges "Hoy"/"✓ Completado"). Las otras 3 son una **vista orientativa**: se generan al vuelo con `buildPlanFromData({...userData, progreso:{semana:N, diasEntrenados:0, ajuste:0}})` y se cachean en `semanaPreviewCache` (se invalida al reconstruir el dashboard). Aviso `#weekPreviewNote` ("Vista orientativa. Tu plan real de cada semana se ajusta automáticamente según tu check-in semanal.") se muestra solo en las semanas no actuales.
- Funciones nuevas: `renderWeekTabs(semanaActual)`, `selectSemanaTab(numSemana)`, `renderSemanaTab(numSemana)`, `renderWeekList(semanaArr, esActual)`. `buildDashboard()` ahora llama a `renderWeekTabs()` + `renderSemanaTab()` en vez de pintar `weekGrid` directamente.
- Verificado en preview (1280px y 375px): pestañas cambian de semana correctamente, "Semana 1 · Actual" muestra "Hoy"/"✓" en Lunes, semanas 2-4 muestran el aviso de vista orientativa y no muestran badges de "Hoy". Cuenta de test limpiada tras las pruebas.
- **Bug encontrado y arreglado**: al separar `day.detalle` por comas, solo el primer ejercicio conservaba la mayúscula original del dato fuente (ej. "Press banca 4×8, press militar 3×10, fondos 3×10..."). En `renderWeekList()` se añade `capitalizar(e)` (pone en mayúscula la primera letra) a cada ejercicio. Verificado: "Press banca 4×8 / Press militar 3×10 / Fondos 3×10 / Elevaciones laterales 3×15 / Press inclinado mancuernas 3×12".

### 11. Variación de ejercicios entre semanas en la "Vista del mes" (semanas 2-4)
- Las semanas 2-4 de "Plan del mes" mostraban exactamente los mismos ejercicios que la Semana 1 (la generación es determinista para el mismo `deporte`/`nivel`/`objetivo`; solo `progreso.ajuste` cambia el texto de intensidad, no los ejercicios).
- Nueva función `aplicarVariacionSemanal(semanaArr, offset)`: para cada semana de vista previa (`offset = numSemana - semanaActual`, siempre > 0), recorre los días de entreno y, si algún ejercicio del `detalle` (o el `resumen`, para días tipo "Series"/"Rodaje") tiene variantes en `variantesDB`, sustituye uno por una variante distinta (elegida con `(offset - 1 + idx)` como semilla, donde `idx` es el índice del día), conservando el sufijo de series×reps (ej. "4×8"). Se llama desde `renderSemanaTab()` solo al construir `semanaPreviewCache[numSemana]`.
- Verificado en preview: Semana 1 sin cambios; Semana 2 cambia "Press inclinado mancuernas"→"Press con mancuernas sentado" (Lunes) y "Curl martillo"→"Curl en polea baja" (Viernes); Semana 3 cambia "Fondos"→"Extensión de tríceps en polea" y "Plancha"→"Plancha lateral"; Semana 4 cambia "Elevaciones laterales"→"Face pull" y "Dominadas o jalón"→"Remo en barra invertida". Sin duplicaciones de palabras ni roturas de formato.

### 12. "Días entrenados" (esta semana) refleja los entrenos marcados como completados
- El stat "DÍAS ENTRENADOS / esta semana" (`#statDiasEntrenados`) ya no muestra `progreso.diasEntrenados` (valor fijo, autoinformado en el check-in anterior), sino `(userData.entrenosCompletados || []).length`. Se actualiza tanto en `buildDashboard()` como en `actualizarEstadoCompletado()` (esta última se llama desde `toggleEntrenoCompletado()`), así que el contador sube/baja al instante al marcar/desmarcar el entreno de hoy.
- Al enviar el check-in semanal (`submitCheckin()`, nueva semana), se reinicia `userData.entrenosCompletados = []` para que el contador empiece de nuevo en 0 la semana siguiente.
- Verificado en preview: marcar/desmarcar "Hoy" cambia el contador entre 0 y 1 al instante; con varios días simulados (`entrenosCompletados` con 4 fechas) el contador muestra "4". Cuenta de test limpiada (`entrenosCompletados: []`) tras las pruebas.

### 13. "Hoy comes" (Nutrición) en formato desplegable, sin horas fijas
- Cada comida (`.meal-block`) ya no muestra sus 4 opciones en una rejilla siempre visible (que obligaba a desplazar horizontalmente). Ahora la cabecera (`.meal-block-header`, con `onclick="toggleMealBlock(mealIdx)"`) muestra solo el nombre de la comida (Desayuno, Media mañana, Comida, Merienda, Cena), la opción actualmente elegida y un icono `▾` que rota al desplegar. Al hacer clic se añade/quita la clase `.expanded` en `.meal-block`, que controla con CSS si `.meal-options` se muestra (`display: grid`) o se oculta (`display: none`).
- Quitada la hora fija de cada comida (`meal.hora`, ej. "7:30") de la interfaz — cada persona tiene horarios distintos. El campo `hora` se mantiene en los datos (`buildPlanFromData`) pero no se renderiza; se eliminó también la clase CSS `.meal-time-badge`.
- `selectMealOption()` (había dos copias idénticas, se dejó una sola) ahora también actualiza `#mealSelected{mealIdx}` con el nombre de la opción elegida, para que se vea reflejada en la cabecera aunque el bloque esté colapsado.
- **Redacciones corregidas**: "Batido de masa ganadora casero" → "Batido casero para ganar masa"; "Tarta de arroz con leche proteica" → "Arroz con leche proteico con vainilla" (consistencia con la opción equivalente de la merienda).
- Subtítulo de la sección actualizado: "Toca una comida para ver sus cuatro opciones y elige la que más te apetezca hoy...".
- Verificado en preview (1280px y 375px): las 5 comidas aparecen colapsadas mostrando la opción elegida; al tocar "Desayuno" se despliegan las 4 opciones; al elegir otra opción la cabecera se actualiza ("Batido casero para ganar masa") y el resto de comidas siguen colapsadas. Cuenta de test regenerada con `buildPlanFromData` para aplicar los textos corregidos.

### 14. Ingredientes capitalizados en "Hoy comes" (Nutrición)
- Nueva función global `capitalizarIngrediente(s)`: pone en mayúscula la primera palabra alfabética del texto del ingrediente, ignorando cantidades/unidades iniciales (ej: "80g avena" → "80g Avena", "2 huevos revueltos aparte" → "2 Huevos revueltos aparte", "1/2 aguacate" → "1/2 Aguacate").
- Aplicada solo al texto mostrado en cada `.ingredient-tag`; el valor pasado a `openSubstModal()` (usado para buscar sustituciones) se mantiene sin modificar (texto original en minúsculas).
- Verificado en preview: en "Desayuno" las 4 opciones muestran ingredientes con la primera palabra capitalizada ("80g Avena", "Leche entera", "3 Rebanadas centeno", "100g Salmón ahumado", "1/2 Aguacate", "Queso fresco", etc.). Cuenta de test regenerada con `buildPlanFromData` para aplicar el cambio.

### 17. Caso "sin alternativa" en el modal de sustitución (alergia/intolerancia)
- Cuando `getSubstitutions()` devuelve el caso especial `sinAlternativa` (sección 16, sin sustitución segura registrada para ese ingrediente), `selectReason()` ya no pinta el layout normal de tres columnas (nombre + etiqueta + descripción). Ahora muestra un único recuadro centrado con el texto "Consultar con profesional", sin nombre de ingrediente ni descripción.
- Verificado en preview con "Miel" → motivo "Alergia": el modal muestra solo el recuadro centrado "CONSULTAR CON PROFESIONAL" (captura confirmada). Al confirmar, `confirmSubstitution()` sigue mostrando el toast explicativo y no aplica ningún cambio (comportamiento ya cubierto en la sección 16).

### 18. Estudio de mercado de precios
- Se hizo un estudio comparando Fragua con apps de IA de un solo propósito (Fitbod ~12-15€/mes, Freeletics ~14€/mes, MyFitnessPal Premium ~8€/mes, Yazio, Fitia) y con coaching humano online en España (35-340€/mes). Conclusión: Fragua (entreno + nutrición + adaptación semanal automática) tiene margen para subir de 14,99€/mes (ej. 17,99€/mes) y el descuento anual podría acercarse más al estándar del sector (40-50% en vez del 22% actual).
- Se probó a subir a 17,99€/mes (anual 119,99€) pero **se decidió mantener los precios originales (14,99€/mes mensual, 139,99€/año anual, 0,99€ primer mes, 4,99€/mes solo nutrición)** para el lanzamiento/fase de testeo. La subida queda como recomendación para más adelante, cuando haya tracción.
- Quitado "Desde 4,99€/mes." de la tarjeta "Solo nutrición" en la sección "Tu deporte, tu plan" (quedaba suelto/feo); el precio sigue visible en la sección "Precios".
- **Rediseño del precio del hero**: el texto plano "Primer mes 0,99€ · Después 14,99€/mes" (monospace pequeño, poco visible) se sustituye por una tarjeta (`.hero-price`) con fondo y borde en tono brasa, mostrando solo "PRIMER MES" + "0,99€" en grande y naranja (estilo Bebas Neue, 42px). Se quitó la parte "Después 14,99€/mes" por decisión del cliente (quedaba feo/poco legible). Verificado en preview a 1280px y 390px.

### 20. Renombrado del proyecto: Fragua → K-One Step → K-One
- Cambiado el nombre de marca en todo el contenido visible: `<title>`, logo (en landing, sidebar del dashboard, formulario, login/registro y pantalla de carga), manifiesto, filosofía, footer, etiqueta de la IA, mensajes de toast (creación de cuenta y confirmación de pago) y el texto del paywall.
- Primera pasada: "Fragua" → "K-One Step" (logo `FRAG<span>UA</span>` → `K-ONE <span>STEP</span>`, `<title>` "K-ONE STEP — Un paso cada vez", etc.).
- **Segunda pasada (nombre definitivo)**: "K-One Step" → "K-One" en todo el copy, y el logo pasa de `K-ONE <span>STEP</span>` a `K-<span>ONE</span>` (la "K-" en blanco, "ONE" en naranja). `<title>` queda "K-ONE — Un paso cada vez".
- El titular del hero "HAY PASOS." sigue encajando bien temáticamente (K-One = "un paso"), no fue necesario tocarlo.
- **No se han tocado identificadores internos/técnicos**: el email de la cuenta de test (`test@fragua.es`), el email demo (`demo@fragua.es`) ni las claves de `localStorage` (`fragua_users`, `fragua_data_*`, `fragua_current_user`, `fragua_storage_test`). Son detalles internos no visibles en la marca pública; si se quiere una limpieza completa habría que migrarlos también (afecta a datos guardados de la cuenta de test).
- **Botones "Empezar" de la sección "Precios"**: las tarjetas "Anual" y "Solo nutrición" usaban `btn-ghost` (contorno, fondo oscuro/negro), mientras que "Primer mes" y "Mensual" usaban `btn-primary` (relleno naranja). Ahora las 4 tarjetas usan `btn-primary`, así los 4 botones "Empezar" son naranjas y consistentes.
- Verificado en preview: logo "K-<span style='color:var(--brasa)'>ONE</span>" correcto en sidebar y header de landing; sección "Precios" con los 4 botones "EMPEZAR" en naranja (captura confirmada). Sesión de test restaurada al finalizar.

### 19. Bloqueo tras el mes de prueba (paywall)
- Objetivo: evitar que un usuario se dé de baja y se vuelva a registrar con el mismo correo solo para aprovechar repetidamente el mes de prueba a 0,99€. El registro ya impedía crear una cuenta con un email ya existente (`users[email]`, mensaje "Este email ya está registrado"), así que el foco ha sido bloquear el acceso una vez pasado el mes de prueba si no se ha confirmado el pago.
- **Nuevos campos en `fragua_users`**: al registrarse, cada usuario guarda `creado` (fecha ISO, ya existía) y ahora también `suscripcionActiva: false`. Al "pagar" se añade `fechaPago` y `suscripcionActiva` pasa a `true`.
- **`tieneAccesoActivo(email)`**: devuelve `true` si `suscripcionActiva` es `true`, o si la cuenta no tiene `creado` (cuentas antiguas, no se bloquean), o si han pasado 30 días o menos desde `creado` (`DIAS_PRUEBA = 30`). En caso contrario, `false`.
- **`comprobarPaywall(email)`**: muestra/oculta el modal `#modalPaywall` según `tieneAccesoActivo(email)`. Se llama desde `loadUserDashboard(email)`, por lo que se evalúa cada vez que se entra al área personal (login, recarga con sesión activa, tras registro con plan ya generado).
- **Modal `#modalPaywall`**: overlay a pantalla completa, sin botón de cerrar (no se puede descartar). Muestra "Tu mes de prueba ha terminado", el precio actual (14,99€/mes) y un botón "Continuar con Fragua →" que llama a `confirmarPagoSuscripcion()` (marca `suscripcionActiva: true` y `fechaPago`, simulando el cobro; en producción aquí iría la pasarela de pago real). También incluye un enlace "Cerrar sesión".
- **Cuenta de test**: `test@fragua.es` se crea/actualiza en `window.onload` con `suscripcionActiva: true`, para que nunca quede bloqueada durante las pruebas.
- Verificado en preview: se creó una cuenta de prueba con `creado` hace 40 días y `suscripcionActiva: false` → al cargar el dashboard aparece el paywall a pantalla completa (captura confirmada). Al pulsar "Continuar con Fragua", el modal se oculta y `suscripcionActiva` pasa a `true` (ya no vuelve a aparecer). Cuenta de prueba eliminada y sesión de test restaurada al finalizar.

### 15. Resumen nutricional del día (suma según las opciones elegidas)
- En la sección "Hoy comes", debajo del subtítulo, nuevo bloque `#nutriResumen` ("// Total de hoy, según tus elecciones") con 4 tarjetas (`.stats-row`/`.stat-card`, mismo estilo que las stats de "Hoy"): Calorías, Proteína, Carbohidratos, Grasas.
- Nueva variable global `comidasSeleccionadas` (array con el índice de opción elegida por comida, 0-3). Se inicializa en `buildDashboard()` desde `userData.comidasSeleccionadas` (o 0 por defecto), y se usa para marcar `.selected` en la opción correcta y para que `mealSelected{mealIdx}` muestre el nombre ya elegido al recargar.
- `selectMealOption(el, mealIdx, optIdx)` ahora recibe también `optIdx`, actualiza `comidasSeleccionadas[mealIdx]`, lo guarda en `userData.comidasSeleccionadas` (persistido vía `saveUserData`) y llama a `actualizarResumenNutricional()`.
- `actualizarResumenNutricional()`: recorre `generatedPlan.nutricion`, suma `kcal`/`prot`/`carbs`/`grasa` de la opción elegida en cada una de las 5 comidas (parseando el número con `parseInt`, ej. "590 kcal" → 590) y actualiza `#resumenKcal`/`#resumenProt`/`#resumenCarbs`/`#resumenGrasa`. Se llama también al construir el dashboard, así el resumen está siempre actualizado.
- Verificado en preview: con las opciones por defecto (todas "Opción 1") el total da 2450 kcal / 174g prot / 268g carbs / 58g grasa; al cambiar el desayuno a "Tostadas con salmón ahumado y aguacate" baja a 2430 kcal y se actualiza al instante; tras recargar la página, la elección y el total se mantienen (persistencia en `userData.comidasSeleccionadas`). Cuenta de test devuelta a las opciones "Opción 1" tras la prueba.

### 16. Sustituciones de ingredientes: ahora actualizan macros y se revisó la cobertura de alergias/intolerancias
- **Bug corregido**: `confirmSubstitution()` solo cambiaba el texto del tag, sin tocar `kcal/prot/carbs/grasa` de la opción ni el resumen "Total de hoy". Ahora:
  - Nueva tabla `TABLA_MACROS_100G` (~50 alimentos, valores aproximados por 100g/100ml) + `PESO_UNIDAD` (pesos orientativos de "1 huevo", "1 plátano", "1 cucharada", "1 lata", etc.) + `estimarGramos()` + `estimarMacros(texto)`: estiman {kcal, prot, carbs, grasa} de cualquier texto de ingrediente (ej. "80g avena", "1/2 aguacate", "2 latas de sardinas").
  - Al confirmar una sustitución, se calcula la diferencia entre `estimarMacros(ingredienteOriginal)` y `estimarMacros(sustituto)`, se suma a `opt.kcal/prot/carbs/grasa` (con `Math.max(0, ...)` para no bajar de 0), se actualizan las píldoras `.macro-pill` de esa opción en el DOM y se llama a `actualizarResumenNutricional()`.
  - El ingrediente sustituido se escribe también en `opt.ingredientes` (por índice, vía nuevo parámetro `ingredIdx` en `openSubstModal`/`currentSubst`), y se persiste todo el `generatedPlan` con `saveUserData()` — la sustitución y los nuevos macros sobreviven a un recargo de página.
  - **Importante**: son estimaciones aproximadas (tabla de macros genérica), no una base de datos nutricional profesional. Sirven para que los contadores reaccionen de forma razonable, no como dato clínico exacto.
- **Cobertura de alergias/intolerancias revisada por categoría** en `getSubstitutions()`. Categorías a las que les faltaba `alergia` y/o `intolerancia` y se les añadió:
  - POLLO: + `intolerancia` (opciones bajas en histaminas).
  - SALMÓN: + `intolerancia`.
  - PESCADO BLANCO: + `alergia` y `intolerancia` (antes no tenía ninguna de las dos).
  - HUEVOS: + `intolerancia`.
  - ARROZ: + `alergia`.
  - AVENA: + `alergia`.
  - TOFU/TEMPEH/SEITÁN: + `alergia` e `intolerancia` (soja/gluten — antes no tenía ninguna).
  - AGUACATE: + `alergia` e `intolerancia` (FODMAP) — antes no tenía ninguna.
  - VERDURAS (brócoli, espinaca, etc.): + `alergia` e `intolerancia` (FODMAP) — antes no tenía ninguna.
- **Bloque genérico final** (`esHidrato`/`esGrasa`/fallback, para ingredientes que no encajan en ninguna categoría como "cacao puro", "canela", "1 scoop proteína"...): antes devolvía siempre una sugerencia genérica aunque el motivo fuera alergia/intolerancia, pudiendo sugerir algo no seguro. Ahora, si el motivo es `alergia` o `intolerancia` y el ingrediente no encaja en ninguna categoría conocida, se devuelve una única opción `{ sinAlternativa: true, t: 'Consulta profesional' }` con el texto "Sin alternativa específica para '...'" y una recomendación de consultar con el entrenador/nutricionista. `confirmSubstitution()` detecta `sinAlternativa` y no aplica ningún cambio (solo muestra el aviso).
- Verificado en preview: sustituir "80g avena" por "80g copos de arroz" (motivo alergia) cambia la opción de 580→572 kcal / 30→26g prot / 74→92g carbs / 14→9g grasa, y el "Total de hoy" pasa de 2450 a 2442 kcal al tener esa opción seleccionada; persiste tras recargar. Probar "cacao puro" con motivo alergia devuelve el aviso "Sin alternativa específica..." y no modifica nada. Datos de prueba restaurados al estado original tras la verificación.

### 21. Análisis de mejoras (web dev + marketing) y primeras 3 implementadas
Tras un análisis completo de la página desde la perspectiva de desarrollador web y agente de marketing (SEO, accesibilidad, rendimiento, prueba social, confianza, embudo de conversión), se implementaron las 3 mejoras prioritarias:

- **Meta tags + favicon** (`<head>`):
  - `<meta name="description">`, Open Graph (`og:type`, `og:title`, `og:description`, `og:locale`) y Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`) para que el enlace se vea bien al compartirlo.
  - Favicon inline (SVG data URI): cuadrado oscuro con "K" blanca y un acento naranja, sin necesidad de archivo externo.
  - `<link rel="preconnect">` a `fonts.googleapis.com` y `fonts.gstatic.com` para acelerar la carga de las fuentes (la carga vía `@import` se mantiene, pero el preconnect adelanta la conexión).

- **Analytics básico (Google Analytics / gtag.js)**:
  - Añadido el script de `gtag.js` en el `<head>` con un Measurement ID de marcador de posición `G-XXXXXXXXXX`.
  - **Pendiente del usuario**: crear una propiedad en analytics.google.com y sustituir las dos apariciones de `G-XXXXXXXXXX` por el ID real (`G-XXXXXXXXXX` → `G-XXXXXXX`). Sin esto, el script no envía datos a ninguna cuenta.

- **Prueba social y confianza**:
  - Nueva sección `#testimonials` ("Resultados reales") entre "Tu deporte, tu plan" y "Precios": 3 testimonios ficticios (Marta G. - Gimnasio, Javier R. - Solo nutrición, Lucía M. - Hyrox), cada uno con 5 estrellas, cita y avatar con inicial. Estilo `.testimonial-card` consistente con el resto de la landing (fondo `--carbon`, grid de 2px de gap).
  - Nuevo enlace "Opiniones" en el menú de navegación (`scrollToSection('testimonials')`).
  - Nueva `.trust-bar` al final de la sección de precios: "🔒 Pago seguro · ✕ Cancela cuando quieras · 🔐 Tus datos nunca se comparten".
  - Responsive: `.testimonials-grid` pasa a 1 columna y `.trust-bar` reduce el gap en móvil (`max-width: 768px`).
  - **Nota**: los testimonios son contenido de ejemplo/placeholder. Antes de un lanzamiento real conviene sustituirlos por opiniones reales de beta-testers (nombre, texto y plan reales).

Verificado en preview: meta tags, favicon, sección de testimonios (3 tarjetas) y trust-bar se renderizan correctamente, sin errores en consola.

### 22. Despliegue a producción (Vercel + GitHub)
- Repositorio creado en GitHub: `raf-lp24/k-one` (rama `main`), conectado a Vercel (equipo `rafas-projects24`).
- Proyecto Vercel `k-one` desplegado como sitio estático (preset "Other", sin build).
- **URL pública**: `https://k-one-six.vercel.app` — `index.html` redirige a `fragua-fitness.html` (verificado con código 200 en ambas).
- Flujo de actualización: cualquier `git push` a `main` en `raf-lp24/k-one` dispara un nuevo deploy automático en Vercel.
- Repo local inicializado con `.gitignore` (excluye `desktop.ini`).

### 23. Mejoras de accesibilidad y conversión (siguiente lote del análisis)
- Los 5 emojis decorativos de `.sport-icon` (🏋️ 🏃 ⚡ 🔥 🥗) ahora llevan `aria-hidden="true"`, ya que su significado ya está en `.sport-name`.
- Tarjeta de precio destacada (`.price-card.featured`, "Mensual 14,99€") ahora muestra un badge "MÁS POPULAR" (`.price-badge`, fondo `--brasa`, posicionado sobre el borde superior) para guiar la elección del usuario.

Verificado en preview: badge visible y bien posicionado sobre la tarjeta "Mensual", sin errores en consola.

### 24. Enlace "Volver al inicio" en el área de cliente
- Nuevo `.back-to-landing` en `.dash-sidebar`, debajo del logo, en todas las secciones del dashboard. Llama a `goTo('landing')` (no cierra sesión).

### 25. Elementos visuales en la landing (ilustraciones SVG propias)
La landing era muy plana visualmente. Se han añadido gráficos SVG propios (sin imágenes externas/descargas) que siguen la paleta de marca (`--brasa`, `--metal`, `--humo`):
- **Hero**: ilustración de barra con discos (`.hero-visual`) en la esquina superior derecha, semitransparente y rotada, oculta en móvil (`max-width: 768px`).
- **Nueva sección "Tres pilares, un sistema"** (`#pillars`, entre el manifiesto y "Cómo funciona"): 3 tarjetas con icono SVG + título + descripción para Entrenamiento (mancuerna), Nutrición (plato) y Mentalidad (diana). En móvil pasa a 1 columna.
- **"Cómo funciona"**: cada uno de los 4 pasos ahora tiene un icono SVG (perfil, documento/plan, calendario con check, cámara) encima del número de paso.

Verificado en preview (desktop y móvil): iconos y barbell se renderizan correctamente, sin errores en consola.

**Pendiente detectado (no corregido, fuera del alcance de este cambio)**: en móvil, `.landing-nav` es `position: fixed` con 6 enlaces que no caben en pantallas estrechas y se solapan con el contenido de debajo (hero, títulos de sección). Es un problema preexistente, agravado al añadir el enlace "Opiniones". Convendría un menú hamburguesa en móvil.

### 26. Dashboard utilizable en móvil (menú hamburguesa)
**Problema**: en móvil, `.dash-sidebar` tenía `display: none`, así que en el área de cliente solo se veía el contenido de `.dash-main` (la sección "Hoy"), sin forma de navegar a Plan semanal, Nutrición, Check-in, Mi progreso, Notas, ni de cerrar sesión o volver al inicio.

**Solución**:
- Nueva `.dash-mobile-bar` (logo + botón `.dash-menu-btn` ☰), visible solo en `max-width: 768px`, fija arriba del `.dash-main`.
- `.dash-sidebar` en móvil pasa a `position: fixed`, fuera de pantalla (`translateX(-100%)`), y se desliza dentro con la clase `.open`.
- `.dash-overlay` oscurece el contenido al abrir el menú; clic fuera lo cierra.
- Funciones JS `toggleDashMenu()` / `closeDashMenu()`; `showSection()` cierra el menú automáticamente al elegir una sección.

Verificado en preview (375x812): el menú se abre con todas las secciones, "Volver al inicio" y "Cerrar sesión"; al elegir una sección se cierra y se muestra el contenido correctamente. Desktop sin cambios visuales.

### 27. Menú hamburguesa en la landing (móvil)
Resuelve el pendiente detectado en el punto 25: en `max-width: 768px`, los 6 enlaces de `.nav-links` (Cómo funciona, Deportes, Opiniones, Precios, Entrar, "Empieza por 0,99€") no cabían en una fila, se envolvían en varias líneas y, al ser `.landing-nav` `position: fixed`, ese bloque tapaba el `hero-eyebrow` y el inicio del `hero-title`.

**Solución**:
- En la media query `max-width: 768px` se oculta `.nav-links` (`display: none`) y se muestra `.nav-toggle` (botón hamburguesa de 3 líneas, oculto por defecto en desktop).
- Nuevo `.nav-toggle` (`#navToggle`) dentro de `.landing-nav`: al pulsarlo, las 3 líneas se transforman en una "X" (`.nav-toggle.active`).
- Nuevo `#mobileMenu` (`.mobile-menu`), overlay a pantalla completa (`position: fixed; inset: 0`, fondo `--negro`, oculto con `opacity:0; visibility:hidden`) con los mismos 6 enlaces, centrados verticalmente.
- Funciones JS `toggleMobileMenu()` / `closeMobileMenu()`: alternan la clase `.active` en `#navToggle` y `#mobileMenu`. Cada enlace del menú móvil llama a `closeMobileMenu()` antes de `scrollToSection(...)` / `goTo(...)`.

Verificado en preview (375x812): con `.nav-links` oculto, la nav vuelve a ocupar una sola fila (~85px) y el `hero-title` ("NO HAY ATAJOS. HAY PASOS.") ya no queda tapado (antes, con los 6 enlaces envueltos en 3 filas, la nav medía ~130px y tapaba también el título). El botón hamburguesa abre el menú a pantalla completa con los 6 enlaces, se transforma en "X", y se cierra correctamente al pulsar de nuevo o al elegir un enlace. Sin errores en consola.

**Ajuste adicional**: con la nav ya en una sola fila (~85px), seguía quedando un solapamiento residual: el `.hero` usa `min-height: 100vh` y `justify-content: flex-end`, así que su contenido (empezando por `.hero-eyebrow`) ocupaba casi toda la altura de la pantalla y el `eyebrow` aparecía debajo del nav fijo, tapado por él. Se corrigió añadiendo `padding-top: 100px` a `.hero` en `max-width: 768px` (antes `padding: 0 24px 60px`, ahora `padding: 100px 24px 60px`), dejando espacio suficiente para el nav fijo. Verificado en preview (375x812): el eyebrow "// Entrenamiento · Nutrición · Mentalidad" ya no se solapa con el logo/hamburguesa.

Sin colisiones con el menú del dashboard (punto 26): nombres de clases (`.nav-toggle`/`.mobile-menu` vs `.dash-overlay`/`.dash-menu-btn`), funciones JS (`toggleMobileMenu`/`closeMobileMenu` vs `toggleDashMenu`/`closeDashMenu`) y z-index (`.nav-toggle`: 101, `.mobile-menu`: 99, `.dash-overlay`: 150) son todos independientes.

### 28. "Entrar" como primera opción del menú móvil
A petición del usuario, en `#mobileMenu` el enlace "Entrar" pasa a ser el primero de la lista (antes era el penúltimo, justo antes del botón "Empieza por 0,99€").

### 29. Texto descriptivo más legible (toda la web, móvil y escritorio)
El usuario reportó que los párrafos descriptivos de las tarjetas (p. ej. las descripciones de cada deporte en "Tu deporte, tu plan") apenas se veían: texto pequeño (12-13px), `font-weight: 300` y color `var(--metal)` (#8A8A8A), poco contraste sobre fondos oscuros.

**Solución**:
- Nueva variable `--metal-claro: #B5B2AD` (gris cálido más claro, mejor contraste manteniendo el aspecto "discreto").
- Se actualizaron los párrafos descriptivos (no las etiquetas/labels en mayúsculas) a `var(--metal-claro)`, subiendo el tamaño 1-2px y el peso de 300 a 400 donde aplicaba:
  - Landing: `.hero-sub`, `.manifesto-body`, `.pillar-desc`, `.step-body`, `.sport-desc` (12px→14px), `.price-desc`, `.philosophy-sub`, `.section-note`, `.form-block-desc`.
  - Dashboard: `.dash-subtitle`, `.week-preview-note`, `.week-day-content`, `.subst-opt-desc`, `.meal-opt-ingredients`.

Verificado en preview (escritorio y 375x812): las descripciones de "Tu deporte, tu plan" y el subtítulo "Hoy comes" del dashboard se leen con claridad, sin afectar a las etiquetas pequeñas en mayúsculas (badges, fechas, "kcal", "gramos", etc., que mantienen `var(--metal)`).

**Nota sobre ortografía**: se revisó el HTML/JS en busca de palabras en minúscula al inicio de frase; los textos visibles de la landing y los `.sport-desc` del ejemplo no presentan ese problema (todos empiezan en mayúscula). Si el usuario detecta casos concretos, indicarlos para corregirlos puntualmente.

### 35. Fix: la cuenta de test podía dar "Email no encontrado" en algunos navegadores
Un usuario reportó en producción (móvil, k-one-six.vercel.app) que al intentar entrar con la cuenta de testeo (`test@fragua.es` / `fragua123`) precargada en el formulario, salía el error "Email no encontrado". Causa: la cuenta de test se "siembra" en `localStorage` durante `window.onload` (`fragua_users`), pero si ese navegador bloquea o no persiste `localStorage` (modo privado, restricciones de cookies/storage, etc.), el guardado falla en silencio y `login()` no encuentra la cuenta.

**Solución**: se extrajo la lógica de siembra a una función reutilizable `ensureTestAccount()`, que sigue ejecutándose en `window.onload` pero ahora también se invoca como respaldo dentro de `login()`: si el email/contraseña introducidos son los de la cuenta de test (`TEST_EMAIL`/`TEST_PASS`) y `users[email]` no existe, se vuelve a intentar `ensureTestAccount()` justo antes de validar, usando el objeto en memoria que devuelve aunque el guardado en `localStorage` vuelva a fallar. Así la cuenta de demo siempre permite entrar, incluso en navegadores que bloquean el almacenamiento local.

Verificado en preview: simulando un fallo de seeding (borrando `fragua_users` y los datos de la cuenta de test antes de pulsar "Entrar"), el login con `test@fragua.es`/`fragua123` sigue funcionando y lleva al dashboard; el flujo normal (seeding correcto) y el caso de contraseña incorrecta siguen funcionando igual que antes. Sin errores en consola.

### 36. Fix: el entrenamiento de "Hoy" no coincidía con "Plan semanal" y venía menos detallado
Un usuario detectó que el entrenamiento mostrado en la pestaña "Hoy" del área de cliente no era el mismo que el del lunes en "Plan semanal", y además venía con mucho menos detalle (solo bloques de ejercicios, sin calentamiento ni vuelta a la calma).

**Causa**: `entrenamiento_hoy` se generaba con bloques de texto fijos por deporte/nivel (títulos "Día 1 — ..."), totalmente independientes de `semana[0]` (el "Lunes" real de "Plan semanal"), que además solo tenía músculos + lista de ejercicios sin calentamiento/vuelta a la calma.

**Solución**: se creó una función compartida `formatearSesion(day)` y un mapa `SESION_EXTRAS` (con calentamiento y vuelta a la calma específicos según la `etiqueta` de la sesión: Cardio, Fuerza, Intensidad, Hyrox, WOD, Empuje, Piernas, etc., con un fallback `SESION_EXTRAS_DEFAULT`). Ahora:
- Se eliminaron los bloques fijos de `entrenamiento_hoy` por deporte.
- `entrenamiento_hoy` se genera al final, a partir de `semana[0]` ("Lunes"), con `formatearSesion()`, así que "Hoy" y "Plan semanal" muestran siempre el mismo contenido y nivel de detalle.
- Las adaptaciones por lesión, ajuste de series por progreso y cambios de variante de ejercicio (feedback de la sesión anterior) ahora se aplican a `semana[].detalle` para todos los días (antes solo afectaban a `entrenamiento_hoy`), y de ahí se propagan automáticamente a "Hoy".
- En "Plan semanal" (`renderWeekList`), cada día de entrenamiento ahora muestra calentamiento, bloque principal (con ejercicios) y vuelta a la calma con `formatearSesion()`, en lugar de solo una lista de ejercicios. Se añadió la clase CSS `.week-session-text` para el nuevo formato.

Verificado en preview con la cuenta de test: regenerando el plan para Gimnasio, Running, Hyrox, CrossFit y Combinación, "Hoy" coincide exactamente con el lunes de "Plan semanal" y ambos incluyen calentamiento/bloque principal/vuelta a la calma. También se probó con lesión de rodilla (la nota "Tu plan, adaptado" se antepone correctamente a "Hoy") y con un plan "Solo nutrición" (no genera entrenamiento, como antes). Sin errores en consola.

**Extra**: en los días de gimnasio con split por grupo muscular (Empuje, Tracción, Piernas, Hombros, Complemento), `formatearSesion` ahora separa los ejercicios en "Bloque de fuerza" (series ≤6 reps), "Bloque de hipertrofia" (resto) y "Core" (plancha, russian twist, abdominales), igual que mostraba antes el detalle de "Hoy". Verificado con planes de Gimnasio de 3 y 5 días: por ejemplo, el jueves de piernas separa "Peso muerto 4×6" en fuerza y el resto de ejercicios en hipertrofia, y el viernes de hombros separa plancha/russian twist en "Core".

### 37. Sincronizar "Hoy" con cuentas ya existentes + plegar los días de "Plan semanal"
Tras el punto 36, las cuentas que ya tenían un plan guardado (generado con el código antiguo) seguían mostrando en "Hoy" el texto antiguo "Día 1 — ...", porque `entrenamiento_hoy` se carga tal cual desde `localStorage` y no se regeneraba. Además, en "Plan semanal" cada día mostraba todo el detalle siempre desplegado, ocupando toda la pantalla (a diferencia de "Nutrición", donde cada comida está plegada y se expande al pulsar).

**Solución**:
- Nueva función `regenerarEntrenamientoHoy(plan)`: recalcula `entrenamiento_hoy` a partir de `semana[0]` con `formatearSesion()` (conservando la nota "Tu plan, adaptado" si existía). Se llama desde `loadUserDashboard()` cada vez que se carga un plan guardado, así que cualquier cuenta existente queda sincronizada sin tener que regenerar todo el plan ni perder el progreso/checkins guardados.
- En "Plan semanal" (`renderWeekList`), cada día de entrenamiento ahora se puede plegar/desplegar pulsando sobre la fila (`toggleWeekDay`), igual que los bloques de comida en "Nutrición". El día de "Hoy" empieza desplegado por defecto; el resto empiezan plegados, mostrando solo el resumen y la etiqueta, con una flechita (▾/▴) que indica el estado. Los días de descanso no son plegables (su mensaje es muy corto).

Verificado en preview: con un plan "antiguo" simulado (entrenamiento_hoy desincronizado guardado en `localStorage`), al recargar el dashboard "Hoy" se regenera correctamente y coincide con el lunes de "Plan semanal". En "Plan semanal", el lunes (Hoy) aparece desplegado, el resto de días de entreno aparecen plegados y se despliegan/pliegan correctamente al pulsarlos, sin solaparse con la flechita de plegado. Sin errores en consola.

### 38. Identificar también el tipo de ejercicio (fuerza/hipertrofia/core/acondicionamiento) en los días "Fuerza" de Combinación e Hyrox
El punto 36 ya separaba en bloques "Bloque de fuerza / Bloque de hipertrofia / Core" los días de gimnasio con split por grupo muscular (Empuje, Tracción, Piernas, Hombros, Complemento), pero los días con etiqueta "Fuerza" (usados en los planes de Combinación y en el día de "Fuerza funcional" de Hyrox) seguían mostrando un único "Bloque principal" sin clasificar.

**Solución**: se añadió "Fuerza" a la lista de etiquetas que `formatearSesion` clasifica, y se sumó una cuarta categoría, "Bloque de acondicionamiento", para movimientos funcionales medidos en distancia o tiempo (ej. "Sled push 4×20m", "Farmer carry 4×30m", "Rowing 4×250m" en Hyrox), que no encajan ni en fuerza ni en hipertrofia clásicas.

Verificado en preview: en Combinación (3 y 5 días), los días "Fuerza" ahora muestran "Bloque de hipertrofia" (y "Core" cuando hay plancha); en Hyrox, el día "Fuerza funcional" separa "Sandbag lunges 3×12" en hipertrofia y "Sled push/Farmer carry/Rowing" en "Bloque de acondicionamiento". Sin errores en consola.

### 39. Notas orientativas por ejercicio (intensidad/peso) en "Hoy" y "Plan semanal"
El usuario adjuntó una captura del antiguo formato de "Hoy", que junto a cada ejercicio mostraba una nota orientativa sobre la intensidad o el peso a usar (ej. "Press de banca con barra · 4 × 6 · Al 75-80% de tu máximo", "Elevaciones laterales · 3 × 15 · Peso ligero, control total"). Pidió recuperar ese nivel de detalle por ejercicio, y que apareciera igual en ambos sitios ("Hoy" y "Plan semanal"), no solo en uno.

**Solución**: dentro de la clasificación por ejercicio de `formatearSesion`, se añade una nota según el rango de repeticiones detectado: si son ≤6 reps (bloque de fuerza) se añade "· Al 75-80% de tu máximo"; si son ≥15 reps (bloque de hipertrofia, trabajo accesorio) se añade "· Peso ligero, control total". Los ejercicios con repeticiones intermedias (7-14) no llevan nota adicional. Como tanto "Hoy" como "Plan semanal" usan `formatearSesion` para renderizar la sesión (puntos 36-37), las notas aparecen automáticamente en ambos sitios sin duplicar lógica.

Verificado en preview: en la cuenta de test (día Empuje), "Hoy" y el lunes de "Plan semanal" muestran "· Elevaciones laterales 3×15 · Peso ligero, control total" en "Bloque de hipertrofia". En un plan de 5 días, el jueves (Piernas) muestra "· Peso muerto 4×6 · Al 75-80% de tu máximo" en "Bloque de fuerza" y varias notas "Peso ligero, control total" en "Bloque de hipertrofia" (extensión cuádriceps, hip thrust, gemelos de pie); el viernes (Hombros) muestra las mismas notas en elevaciones laterales y face pull. Sin errores en consola.

### 39b. Clasificar fuerza/hipertrofia/core/acondicionamiento en TODOS los planes (no solo gimnasio por grupo muscular)
El punto 38 ya clasificaba en bloques los días con etiqueta "Fuerza" además de los splits de gimnasio (Empuje/Tracción/Piernas/Hombros/Complemento), pero el resto de etiquetas (Cardio, Intensidad, Fondo, Volumen, Combinado, Hyrox, Simulacro, WOD) seguían mostrando un único "Bloque principal" sin diferenciar tipos de ejercicio. El usuario pidió que la diferenciación de fuerza/hipertrofia/core/resistencia se aplicara a todos los entrenamientos y todos los planes, igual en "Hoy" y "Plan semanal".

**Solución**: en `formatearSesion` se eliminó la lista `gruposMusculares` y la rama "Bloque principal" — ahora TODOS los días de entrenamiento, sea cual sea su etiqueta, pasan por la misma clasificación en "Bloque de fuerza" (≤6 reps), "Bloque de hipertrofia" (resto de series con reps), "Bloque de acondicionamiento" (movimientos/tramos por distancia o tiempo, y cualquier tramo de cardio sin reps) y "Core" (plancha/russian twist/abdominales). Por ejemplo, en un día de "Cardio" puro (running), todos los tramos de la sesión ("Zona 2 (65-75% FCmáx)", "Ritmo conversacional", "30-40 min continuos"...) caen en "Bloque de acondicionamiento"; en Hyrox, los movimientos con reps (wall balls, burpees) van a fuerza/hipertrofia y los de carrera/erg a acondicionamiento.

Verificado en preview: forzando un plan "Hyrox" en la cuenta de test, el lunes ("Running + estaciones") muestra "Bloque de hipertrofia" (Wall balls 4×15 · Peso ligero control total, Burpees 4×10) y "Bloque de acondicionamiento" (3km carrera, Ski erg 4×250m), idéntico en "Hoy" y en "Plan semanal". Sin errores en consola.

### 39c. Clasificar fuerza vs. hipertrofia por tipo de ejercicio, no solo por repeticiones
Tras el punto 39b, en los días de gimnasio reales (p. ej. Empuje: "Press banca 4×8, press militar 3×10, fondos 3×10, elevaciones laterales 3×15, press inclinado mancuernas 3×12") casi ningún ejercicio tiene ≤6 repeticiones, así que con el criterio de reps todo caía en "Bloque de hipertrofia" y no se diferenciaba nada, justo lo contrario de lo que pedía el usuario.

**Solución**: en `formatearSesion`, "Bloque de fuerza" ahora se decide por el TIPO de ejercicio (levantamientos compuestos pesados), usando una lista de palabras clave (`FUERZA_RE`): sentadilla, peso muerto, press de banca/militar, dominadas, remo con barra, zancada, prensa, thruster. Estos ejercicios van siempre a "Bloque de fuerza" con la nota "Al 75-80% de tu máximo", sea cual sea su rango de reps. El resto de ejercicios con reps (aislamiento/accesorio: elevaciones, curl, extensiones, fondos, press inclinado con mancuernas, femoral, gemelos, hip thrust, etc.) van a "Bloque de hipertrofia", con la nota "Peso ligero, control total" solo si tienen ≥15 reps. Acondicionamiento (distancia/tiempo/cardio) y Core (plancha/russian twist/abdominales) se mantienen igual que en el punto 39b.

Verificado en preview: en la cuenta de test (Empuje), "Hoy" y "Plan semanal" muestran "Bloque de fuerza" (Press banca 4×8 · Al 75-80%, Press militar 3×10 · Al 75-80%) y "Bloque de hipertrofia" (Fondos 3×10, Elevaciones laterales 3×15 · Peso ligero control total, Press inclinado mancuernas 3×12), idénticos en ambos sitios. En el día de Piernas (plan de 5 días), "Bloque de fuerza" agrupa Sentadilla 4×8, Peso muerto rumano 4×10 y Prensa 3×12 (todos con nota "Al 75-80%"), y "Bloque de hipertrofia" agrupa Extensiones 3×15, Femoral tumbado 3×12 y Elevación gemelos 4×15 (con nota "Peso ligero, control total" en las de ≥15 reps). Sin errores en consola.

### 33. Onboarding del formulario — Fase B (sliders visuales, feedback en vivo del metabolismo basal, lógica condicional en salud)
Continuación del rediseño UX, "Fase B":
- **Sliders visuales para datos físicos (Bloque 1 "Tu cuerpo")**: `edad`, `peso` y `altura` pasan de `<input type="number">` a `<input type="range">` con un valor en vivo junto a la etiqueta (`.slider-value`, en `var(--brasa)` y fuente Bebas Neue). Rangos: edad 14-80 (def. 28), peso 40-180 (def. 75), altura 140-210 (def. 175). Estilo de slider personalizado (`::-webkit-slider-thumb`/`::-moz-range-thumb`) con el círculo naranja de marca.
- **Feedback inmediato — metabolismo basal estimado**: nuevo panel `.bmr-panel` (oculto hasta que se elige "Sexo") que muestra en vivo "Tu metabolismo basal estimado es de X kcal/día" usando la fórmula de Mifflin-St Jeor (`updateBmrPanel()`), recalculado con cada cambio de edad/peso/altura/sexo.
- **Lógica condicional en Bloque 2 "Tu salud"**: nueva función `selectRadioConditional(el, group)`. Si se elige "Otra" en "¿Tienes alguna enfermedad diagnosticada?" o "¿Tienes alguna alergia alimentaria?", se despliega un campo de texto "¿Cuál?" (`enfermedadOtra`/`alergiaOtra`). Si en "¿Tienes alguna lesión activa ahora mismo?" se elige cualquier opción distinta de "No", se despliega "Cuéntanos más sobre esta lesión" (`lesionDetalle`). Estos campos se añadieron a `collectFormData()`. Estilo `.field-conditional` con borde izquierdo discreto para indicar que es una pregunta derivada.
- `enterFormulario()` ahora resetea sliders, panel BMR y campos condicionales a su estado inicial al (re)entrar al formulario.

Verificado en preview (escritorio y 375x812): los sliders se ven y actualizan correctamente, el panel de metabolismo basal aparece tras elegir sexo y calcula bien (28 años, 75kg, 175cm, hombre → 1709 kcal/día), y los campos condicionales de salud se muestran/ocultan según la respuesta.

### 34. Onboarding del formulario — Fase C (pantalla de carga personalizada y preselección inteligente de enfoque nutricional)
Cierre del rediseño UX del formulario, "Fase C":
- **Preselección inteligente de enfoque nutricional (Bloque 5 "Tu objetivo")**: nuevo campo "¿Qué enfoque nutricional prefieres?" (`#enfoqueMacros`: Equilibrado / Alto en proteína / Bajo en carbohidratos / Flexible-sin restricciones) justo después del objetivo principal. Al elegir el objetivo (`preseleccionarEnfoque()`), se preselecciona automáticamente un enfoque acorde (`enfoquePorObjetivo`: Perder grasa/Ganar músculo/Ganar fuerza → Alto en proteína; Mejorar resistencia/Preparar competición/Sentirme mejor → Equilibrado) y se actualiza el `.field-hint` explicándolo. Si el usuario elige manualmente cualquier opción (`marcarEnfoqueManual()`), se fija un flag `enfoqueMacrosManual` que detiene futuras preselecciones automáticas y el hint pasa a "Has elegido tu propio enfoque nutricional.". `enterFormulario()` resetea el flag, la selección y el hint al (re)entrar al formulario. Añadido a `collectFormData()`.
- **Pantalla de carga personalizada**: nueva función `buildLoadingTexts(userData)` sustituye los textos fijos de `loadingOverlay` en `generatePlan()`. Genera 6 frases combinando datos reales del usuario: si tiene una lesión activa ("Cruzando tus datos con tu historial de [lesión] para diseñar ejercicios seguros..."), si tiene alergia ("Revisando que ningún plato contenga [alérgeno]..."), su objetivo ("Ajustando tu plan para '[objetivo]'...") y su enfoque nutricional ("Calculando tus macros con un enfoque [enfoque]..."), con textos genéricos de respaldo si esos datos no aplican. Distingue "Solo nutrición" vs "Plan completo" para las frases de entrenamiento/cierre.
- **Enfoque nutricional visible en el dashboard**: en `#section-nutricion`, nueva etiqueta `// Enfoque nutricional: [enfoque]` (mismo estilo que `.nutri-resumen-label`) sobre el resumen de macros del día, mostrada solo si el usuario eligió un enfoque.

Verificado en preview (escritorio): elegir "Perder grasa" preselecciona "Alto en proteína" con el hint actualizado; seleccionar manualmente otro enfoque fija el flag y cambia el hint, y se mantiene aunque se cambie de objetivo después. Con lesión "Rodilla", alergia "Otra" (frutos secos), objetivo "Perder grasa" y enfoque "Alto en proteína", la pantalla de carga muestra "Revisando que ningún plato contenga frutos secos..." y el resto de frases personalizadas; el dashboard generado muestra "// Enfoque nutricional: Alto en proteína" en la sección Nutrición. Sin errores en consola.

### 32. Onboarding del formulario — Fase A (sticky CTA, microcopy, "Paso X de 6" clicable, botón atrás)
El usuario propuso un rediseño UX del formulario de registro (`#formulario`) con 10 ideas; se acordó implementar primero la "Fase A":
- **Botón "Siguiente/Continuar" fijo en móvil**: en `max-width: 768px`, `.form-nav` pasa a `position: fixed; bottom: 0; left: 0; right: 0;` con fondo `var(--negro)` y borde superior. `.form-nav-note` ("Campos obligatorios") se oculta en móvil y `.btn-primary` usa `flex: 1` para ocupar el espacio. `.form-main` gana `padding-bottom: 110px` para que el contenido no quede tapado.
- **Microcopy gris bajo campos sensibles**: nueva clase `.field-hint` (12px, `var(--metal)`, cursiva). Añadida bajo "Peso actual (kg)" (Bloque 1), "¿Tienes alguna lesión activa...?" (Bloque 2) y bajo jornada laboral / nivel de estrés / horas de sueño (Bloque 3), explicando para qué se usa cada dato.
- **Barra de progreso "Paso X de 6" + pasos clicables**: el `.progress-label` del sidebar (escritorio) ahora muestra "Paso X de 6" (antes "Progreso"). Como `.form-sidebar` está oculto en móvil, se añadió una nueva `.form-progress-mobile` (visible solo en `max-width: 768px`) al inicio de `.form-main` con su propio "Paso X de 6" + barra. Los `.form-step-item` del sidebar ahora son clicables (`onclick="goToBlock(i)"`) pero solo permiten saltar a bloques ya visitados (`maxBlockReached`), para corregir datos sin perder lo ya rellenado.
- **Botón "atrás" del navegador/móvil retrocede un bloque**: nueva función `enterFormulario()` (sustituye las 3 llamadas a `goTo('formulario')`) que reinicia el formulario al bloque 0 y hace `history.pushState`. `nextBlock()`, `prevBlock()` y `goToBlock()` también hacen `pushState` con `{screen:'formulario', block:N}`. Un listener `popstate` global detecta estos estados y cambia de bloque sin recargar ni salir de la app.

Verificado en preview (375x812 y escritorio): "Paso 1 de 6"/"Paso 2 de 6" se actualiza correctamente, el botón sticky se ve bien en móvil, el botón atrás del navegador retrocede de bloque 1 a bloque 0 sin salir del formulario, y el clic en "Tu salud" (paso ya visitado) navega correctamente mientras que saltar a "Tu entrenamiento" (no visitado) se bloquea.

Pendiente (Fases B y C del rediseño, no implementadas aún): sliders/selectores visuales para datos físicos, lógica condicional if/then para lesiones, feedback inmediato (cálculo de metabolismo basal en vivo), pantalla de transición tipo "cruzando tus datos...", preselecciones inteligentes según objetivo.

### 30. Capitalización de `.price-period` en la sección de precios
El usuario detectó que las etiquetas bajo el precio empezaban en minúscula: "mes de prueba", "al mes · cancela cuando quieras" (x2), "al año · equivale a 11,67€/mes · ahorras 40€". Se corrigieron a "Mes de prueba", "Al mes · cancela cuando quieras" y "Al año · equivale a...". Verificado en preview (escritorio).

### 31e. "Cancela" capitalizado en `.price-period`
También se capitalizó "cancela" → "Cancela" en "Al mes · Cancela cuando quieras" (planes Mensual y Solo nutrición), siguiendo el mismo criterio que "Equivale"/"Ahorras" del punto 31d.

### 31d. Tipografía de `.price-period` más legible y "Equivale"/"Ahorras" capitalizados
El usuario reportó que el texto bajo el precio (p. ej. "Al año · equivale a 10€/mes · ahorras 60€") se veía pequeño y con una tipografía monoespaciada poco visual, además de "equivale"/"ahorras" en minúscula tras el "·". Se cambió `.price-period` de `font-family: 'DM Mono', monospace; font-size: 12px; color: var(--metal)` a `font-family: 'Inter', sans-serif; font-size: 15px; color: var(--metal-claro); font-weight: 400` (igual que el resto del texto del sitio). Se capitalizó "Equivale"/"Ahorras" en el plan anual: "Al año · Equivale a 10€/mes · Ahorras 60€". Verificado en preview (escritorio).

### 31c. Botones "Empezar" alineados en la sección de precios
Las 4 tarjetas de precios tienen descripciones de distinta longitud, por lo que los botones "Empezar" quedaban a alturas distintas (efecto "escalonado"). Se cambió `.price-card` a `display: flex; flex-direction: column;` y se añadió `.price-card .btn-primary { margin-top: auto; align-self: flex-start; }`, de forma que el botón siempre queda anclado al final de la tarjeta y alineado entre las 4 columnas. Verificado en preview (escritorio); en móvil cada tarjeta ocupa su propia fila, así que no aplica el alineado entre columnas.

### 31b. Precio anual rebajado de 139,99€ a 119,99€
A petición del usuario, el plan "Anual" pasa de 139,99€ a 119,99€. Se recalculó el `.price-period`: "Al año · equivale a 10€/mes · ahorras 60€" (antes "11,67€/mes · ahorras 40€"). Verificado en preview (escritorio).

### 31. Iconos de la barra de confianza (trust-bar) más visuales
Los emojis 🔒/✕/🔐 de "Pago seguro · Cancela cuando quieras · Tus datos nunca se comparten" se sustituyeron por iconos SVG propios (estilo trazo, igual que los de la sección "Pilares"): escudo con check, círculo con X, candado. Nueva clase `.trust-icon` (22x22px, color `var(--brasa)`). También se subió `.trust-bar` de 12px a 13px y su color a `var(--metal-claro)` (consistente con el punto 29). Verificado en preview (escritorio y 375x812).

### 40. Botón "Cambiar objetivo / deporte" en "Hoy": recalcula entrenamiento, nutrición y plan semanal
El usuario pidió que un cliente pueda, cuando termine el mes o cuando quiera, cambiar su objetivo, deporte y demás preferencias (p. ej. pasar de "perder grasa"/gimnasio a "mejorar resistencia"/running) y que se recalcule TODO el plan: comidas, entrenamientos y plan semanal.

- Nuevo botón "Cambiar objetivo / deporte" (`.btn-ghost`) bajo la fila de tarjetas Semana/Días entrenados/Objetivo/Deporte en `#section-hoy`.
- Nuevo modal `#modalCambiarPlan` (variante ancha `.modal-box-wide`, `max-width:640px; max-height:85vh; overflow-y:auto`) con grupos de radio para: tipo de plan, objetivo, enfoque nutricional (con preselección automática vía `preseleccionarEnfoqueCambio`/`enfoquePorObjetivo`, igual que en el formulario), deporte, días de entreno, tiempo por sesión, nivel y lugar. IDs prefijados `cp-` para no chocar con los del formulario de registro.
- `abrirModalCambiarPlan()`: preselecciona cada grupo con los valores actuales de `userData` (con valores por defecto "Plan completo"/"Equilibrado" si faltan, p. ej. en la cuenta de test).
- `guardarCambioPlan()`: valida que todos los campos tengan selección, actualiza `userData` (tipoPlan, objetivo, enfoqueMacros, deporte, diasEntreno, tiempoSesion, nivel, lugar), reinicia `progreso` a semana 1 y `entrenosCompletados` a `[]` (nuevo plan desde cero), llama a `generatedPlan = buildPlanFromData(userData)` + `buildDashboard()`, persiste con `saveUserData()`, cierra el modal, navega a "Hoy" y muestra un toast de confirmación.

Verificado en preview con la cuenta de test: cambiando de "Ganar músculo"/Gimnasio/3 días/60-90min a "Mejorar resistencia"/Running/4 días/45-60min/Al aire libre, "Hoy" pasa a mostrar "MEJORAR RESISTENCIA", "RUNNING", semana 1/0 días, y el entrenamiento de hoy cambia a "Rodaje suave" (cardio). "Plan semanal" (Semana 1, Lunes) muestra el mismo "Rodaje suave" con bloque de acondicionamiento. "Nutrición" muestra "Enfoque nutricional: Equilibrado" con macros recalculados. Sin errores en consola. Tras la prueba se restauró la cuenta de test a sus valores originales (Ganar músculo / Gimnasio / Fuerza).

### 41. Regla de precios al cambiar de plan (Plan completo ↔ Solo nutrición)
El usuario aclaró la regla de precios que debe regir tanto el cuestionario inicial como el cambio de plan (punto 40): durante el **primer mes desde el registro** (`DIAS_PRUEBA = 30`, ya existente), el coste es **0,99€ sea cual sea el plan elegido**; pasado ese primer mes, el "Plan completo" cuesta **14,99€/mes** (o 119,99€/año con el anual) y "Solo nutrición" cuesta **4,99€/mes**.

- Nueva función `precioPlanActual(tipoPlan, creadoISO)`: aplica esa regla y devuelve un texto explicativo según el tipo de plan y los días transcurridos desde `creado`.
- En el modal "Cambiar tu plan" (punto 40), bajo "¿Qué tipo de plan quieres?" se añadió un `field-hint` (`#cpPrecioInfo`) que muestra en vivo, vía `actualizarPrecioCambioPlan()`, el precio que corresponde según el plan seleccionado y la fecha de registro del usuario. Se actualiza al abrir el modal y al cambiar la selección de tipo de plan.
- El paywall de fin de mes de prueba (`modalPaywall`) ahora muestra el precio correcto según `userData.tipoPlan`: 14,99€ para "Plan completo", 4,99€ para "Solo nutrición" (antes mostraba siempre 14,99€). `comprobarPaywall()` actualiza el `#paywallPrecio` dinámicamente.

Verificado en preview con datos controlados: `precioPlanActual` devuelve "Sigues en tu primer mes: 0,99€..." para ambos tipos de plan si `creado` es reciente, y "...14,99€/mes (o 119,99€/año)..." / "...4,99€/mes..." respectivamente si `creado` tiene más de 30 días. En el modal "Cambiar tu plan", el hint cambia correctamente al alternar entre "Plan completo" y "Solo nutrición" con una fecha de registro de hace 60 días. Cuenta de test restaurada a sus valores originales al finalizar.

### 42. Contador de días restantes del plan en "Hoy"
El usuario pidió añadir, en la página de inicio del dashboard ("Hoy"), un contador que muestre al cliente cuántos días le quedan de su plan/ciclo actual.

- En `#section-hoy`, justo encima de "Entrenamiento de hoy", se sustituyó la fila que solo tenía el botón "Cambiar objetivo / deporte" por una fila con `display:flex; justify-content:space-between` que combina: a la izquierda, el texto `<span id="diasRestantesPlan">` (número, destacado en color "brasa") + `<span id="diasRestantesPlanLabel">` (texto descriptivo); a la derecha, el mismo botón "Cambiar objetivo / deporte".
- Nueva función `actualizarDiasRestantesPlan()`, llamada desde `buildDashboard()`: calcula los días restantes del ciclo de `DIAS_PRUEBA` (30) días.
  - Si el usuario aún no tiene `suscripcionActiva` (mes de prueba), cuenta desde `creado` y muestra la etiqueta "días restantes de tu mes de prueba (0,99€)".
  - Si tiene `suscripcionActiva`, cuenta desde `fechaPago` (o `creado` si no hay `fechaPago`) en ciclos de 30 días, mostrando "días restantes de tu plan actual" (el plan anual aún no se gestiona de forma distinta porque no hay Stripe).

Verificado en preview con la cuenta de test en dos escenarios simulados: suscripción activa con `fechaPago` de hace 10 días → muestra "20 días restantes de tu plan actual"; usuario en prueba con `creado` de hace 22 días → muestra "8 días restantes de tu mes de prueba (0,99€)". Tras las pruebas, la cuenta de test se restauró a `suscripcionActiva: true` con `creado` en el momento actual (sin `fechaPago`), mostrando correctamente "30 días restantes de tu plan actual" junto al plan original (Ganar músculo / Gimnasio). Sin errores en consola.

### 42.1 Mejora visual de "Volver al inicio" y del contador de días restantes
A petición del usuario, se mejoró la visibilidad de dos elementos del dashboard que quedaban demasiado discretos:

- `.back-to-landing` ("← Volver al inicio"): pasa de `DM Mono` 11px gris a `Bebas Neue` 18px, color blanco con hover en "brasa" y un pequeño desplazamiento al pasar el ratón.
- El contador de días restantes (`#diasRestantesPlan`/`#diasRestantesPlanLabel`, punto 42): ahora va dentro de una tarjeta (`background: var(--carbon)`, borde izquierdo de 3px en "brasa", padding), con el número en `Bebas Neue` 32px en color "brasa" y la etiqueta en `var(--blanco-puro)` y mayúsculas (`text-transform: uppercase`).

Verificado en preview con la cuenta de test: ambos elementos se ven correctamente más grandes y destacados, sin errores en consola.

### 42.2 Contador de días restantes como tarjeta de estadística (`.stat-card`)
El usuario pidió que las etiquetas del nuevo contador de días restantes (punto 42) siguieran el mismo estilo tipográfico que las tarjetas "Semana / Días entrenados / Objetivo / Deporte" (`.stat-card-label` en DM Mono mayúsculas gris, `.stat-card-value` en Bebas Neue naranja "brasa", `.stat-card-sub` en gris), tanto para lo nuevo como para lo existente. Tras revisar el resto de la web, las etiquetas/subtextos ya siguen mayoritariamente esa convención (DM Mono + mayúsculas + `var(--metal)`/`var(--brasa)`), por lo que el cambio se centró en el contador nuevo, que era el elemento que no la seguía.

- El contador ahora reutiliza directamente las clases `.stat-card`/`.stat-card-label`/`.stat-card-value`/`.stat-card-sub`: etiqueta "Días restantes" arriba, número grande en el medio (`#diasRestantesPlan`), y subtexto "de tu plan actual" / "de tu mes de prueba (0,99€)" abajo (`#diasRestantesPlanLabel`).
- `actualizarDiasRestantesPlan()` actualizado: el texto del subtítulo ya no repite "días restantes de...", solo "de tu plan actual" / "de tu mes de prueba (0,99€)" / "de tu mes de prueba (0,99€)".

Verificado en preview con la cuenta de test: la tarjeta "DÍAS RESTANTES / 30 / de tu plan actual" se ve visualmente idéntica en estilo a las tarjetas de la fila de estadísticas. Sin errores en consola.

### 42.3 Texto de las stat-card en blanco
El usuario consideró que el gris (`var(--metal)`) de las etiquetas (`.stat-card-label`: SEMANA, DÍAS ENTRENADOS, OBJETIVO, DEPORTE, DÍAS RESTANTES...) y subtextos (`.stat-card-sub`: de tu proceso, esta semana, tu meta, tu disciplina, kcal, gramos...) de las tarjetas de estadísticas se veía poco visible, y pidió pasarlos a blanco, ajustando el tamaño si era necesario.

- `.stat-card-label`: color `var(--metal)` → `var(--blanco-puro)`, tamaño 10px → 11px (para compensar el mayor contraste).
- `.stat-card-sub`: color `var(--metal)` → `var(--blanco-puro)`, tamaño 11px → 12px.

Al ser clases compartidas, el cambio afecta a todas las stat-card del dashboard: la fila Semana/Días entrenados/Objetivo/Deporte y el contador de Días restantes en "Hoy", y la fila Calorías/Proteína/Carbohidratos/Grasas en "Nutrición". Verificado en preview en ambas secciones: las etiquetas y subtextos se ven en blanco y más legibles, manteniendo el número grande en naranja "brasa". Sin errores en consola.

## Notas técnicas del entorno
- No hay Node.js, Python ni WSL instalados en esta máquina — para verificar JS/servir archivos hay que usar PowerShell puro (HttpListener, etc.) o el navegador.
- Claude in Chrome (extensión) no está conectada en esta sesión — no se pudo usar automatización de navegador.
