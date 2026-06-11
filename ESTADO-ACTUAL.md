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

### 30. Capitalización de `.price-period` en la sección de precios
El usuario detectó que las etiquetas bajo el precio empezaban en minúscula: "mes de prueba", "al mes · cancela cuando quieras" (x2), "al año · equivale a 11,67€/mes · ahorras 40€". Se corrigieron a "Mes de prueba", "Al mes · cancela cuando quieras" y "Al año · equivale a...". Verificado en preview (escritorio).

### 31d. Tipografía de `.price-period` más legible y "Equivale"/"Ahorras" capitalizados
El usuario reportó que el texto bajo el precio (p. ej. "Al año · equivale a 10€/mes · ahorras 60€") se veía pequeño y con una tipografía monoespaciada poco visual, además de "equivale"/"ahorras" en minúscula tras el "·". Se cambió `.price-period` de `font-family: 'DM Mono', monospace; font-size: 12px; color: var(--metal)` a `font-family: 'Inter', sans-serif; font-size: 15px; color: var(--metal-claro); font-weight: 400` (igual que el resto del texto del sitio). Se capitalizó "Equivale"/"Ahorras" en el plan anual: "Al año · Equivale a 10€/mes · Ahorras 60€". Verificado en preview (escritorio).

### 31c. Botones "Empezar" alineados en la sección de precios
Las 4 tarjetas de precios tienen descripciones de distinta longitud, por lo que los botones "Empezar" quedaban a alturas distintas (efecto "escalonado"). Se cambió `.price-card` a `display: flex; flex-direction: column;` y se añadió `.price-card .btn-primary { margin-top: auto; align-self: flex-start; }`, de forma que el botón siempre queda anclado al final de la tarjeta y alineado entre las 4 columnas. Verificado en preview (escritorio); en móvil cada tarjeta ocupa su propia fila, así que no aplica el alineado entre columnas.

### 31b. Precio anual rebajado de 139,99€ a 119,99€
A petición del usuario, el plan "Anual" pasa de 139,99€ a 119,99€. Se recalculó el `.price-period`: "Al año · equivale a 10€/mes · ahorras 60€" (antes "11,67€/mes · ahorras 40€"). Verificado en preview (escritorio).

### 31. Iconos de la barra de confianza (trust-bar) más visuales
Los emojis 🔒/✕/🔐 de "Pago seguro · Cancela cuando quieras · Tus datos nunca se comparten" se sustituyeron por iconos SVG propios (estilo trazo, igual que los de la sección "Pilares"): escudo con check, círculo con X, candado. Nueva clase `.trust-icon` (22x22px, color `var(--brasa)`). También se subió `.trust-bar` de 12px a 13px y su color a `var(--metal-claro)` (consistente con el punto 29). Verificado en preview (escritorio y 375x812).

## Notas técnicas del entorno
- No hay Node.js, Python ni WSL instalados en esta máquina — para verificar JS/servir archivos hay que usar PowerShell puro (HttpListener, etc.) o el navegador.
- Claude in Chrome (extensión) no está conectada en esta sesión — no se pudo usar automatización de navegador.
