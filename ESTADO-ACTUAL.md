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

### 42.4 Más textos grises a blanco (revisión general)
El usuario aportó ejemplos adicionales de textos en gris que seguían viéndose poco visibles tras el cambio anterior: la descripción "por qué" de cada comida en Nutrición, el rango de semana y los botones de valoración del check-in semanal, las cifras de la sección "El hierro no se forja solo" de la landing, y las descripciones de "Tres pilares, un sistema" (Entrenamiento/Nutrición/Mentalidad).

Cambios de color (de `var(--metal)`/`var(--metal-claro)` a `var(--blanco)`, sin tocar tamaños porque ya eran legibles):
- `.meal-block-why` (texto "por qué" de cada comida, en cursiva, a la derecha de cada bloque de comida en Nutrición).
- `.checkin-week` (rango de fechas "Semana del X al Y" en la cabecera de la tarjeta de check-in).
- `.rating-btn` (texto de los botones de valoración 0-5/5+ y "Muy mal/Regular/Bien/Muy bien"; los estados hover/seleccionado ya eran blancos/naranjas y no cambian).
- `.stat-label` (subtítulos de las cifras "30+ / 7 / 100%" en la sección "El hierro no se forja solo" de la landing).
- `.pillar-desc` (descripciones de Entrenamiento/Nutrición/Mentalidad en "Tres pilares, un sistema").

Otros usos de `var(--metal)`/`var(--metal-claro)` (navegación, hints de formulario, placeholders, estados hover, textos de apoyo en pantallas de login/registro) se dejaron sin cambios: son elementos de interfaz secundarios donde el contraste reducido es intencional, no contenido principal que el usuario deba leer.

Verificado en preview: check-in semanal, bloques de comida en Nutrición, y secciones "El hierro no se forja solo" / "Tres pilares, un sistema" de la landing, todos con el texto descriptivo en blanco. Sin errores en consola. Cuenta de test restaurada al finalizar.

### 42.5 Sección "Resultados reales": 20 opiniones + textos en blanco
El usuario pidió ampliar la sección de testimonios de la landing (antes solo 3 tarjetas) a unas 20 opiniones que parecieran más reales, incluyendo estrellas de valoración, edad, plan contratado y resultado conseguido, además de arreglar el gris poco visible del subtítulo de la sección y del pie de cada tarjeta.

- `.section-note` (subtítulo de cada sección, p. ej. "Personas que entrenan y comen mejor desde que usan K-One.") y `.testimonial-role` (línea bajo el nombre, p. ej. "34 años · Plan Gimnasio · -8 kg en 3 meses"): color `var(--metal-claro)`/`var(--metal)` → `var(--blanco)`. Como `.section-note` es una clase compartida, también mejora la legibilidad en "Tres pilares", "Cómo funciona", "Tu deporte, tu plan" y "Sin letra pequeña".
- `testimonials-grid` ampliado de 3 a 20 tarjetas (`.testimonial-card`), cubriendo todos los tipos de plan (Gimnasio, Solo nutrición, Hyrox, Running, CrossFit, Casa/Calistenia, Combinación), distintas edades (22-55 años), valoraciones de 4 y 5 estrellas, y un resultado concreto por persona (pérdida de peso, ganancia muscular, tiempos de carrera, vuelta de lesiones, etc.). Cada `.testimonial-role` sigue el formato "{edad} años · {plan} · {resultado}".

Verificado en preview: las 20 tarjetas se renderizan correctamente en el grid de 3 columnas, con estrellas, cita, avatar/nombre y la línea de edad/plan/resultado en blanco. Sin errores en consola. Cuenta de test restaurada al finalizar.

### 42.6 Sección "Resultados reales": carrusel horizontal con botones de navegación
Con 20 tarjetas, el grid de 3 columnas hacía la sección demasiado alta y "apretada". Primero se probó un carrusel con desplazamiento automático continuo, pero el usuario prefirió un carrusel con botones de flecha a izquierda y derecha para que cada persona avance a su ritmo y pueda leer tranquilamente.

- `.testimonials-grid` (grid de 3 columnas) sustituido por `.testimonials-carousel` (contenedor relativo) + `.testimonials-track` (fila flex con `overflow-x: auto`, `scroll-behavior: smooth`, sin barra de scroll visible, y un degradado de máscara en los bordes izquierdo/derecho).
- `.testimonial-card` ahora tiene ancho fijo (380px en escritorio, 280px en móvil) y `flex-shrink: 0` para que las 20 tarjetas se coloquen en fila en lugar de en columnas.
- Dos botones circulares `.testimonials-nav` (`‹` y `›`) superpuestos a izquierda/derecha del carrusel, con `onclick="scrollTestimonials(±1)"`; en hover se ponen en color "brasa". En móvil son más pequeños y se acercan al borde.
- Nueva función `scrollTestimonials(direction)` (junto a `scrollToSection`): desplaza `.testimonials-track` un ancho de tarjeta (+gap) en la dirección indicada con `scrollBy({ behavior: 'smooth' })`.
- Se quitó la regla de móvil que forzaba `.testimonials-grid` a una columna (ya no aplica con el nuevo layout en fila) y se añadieron los tamaños/posiciones de los botones para móvil.

Verificado en preview en escritorio y móvil (375px): los botones avanzan/retroceden la fila de tarjetas un elemento cada vez con scroll suave, con difuminado en los bordes. Sin errores en consola. Cuenta de test restaurada al finalizar.

### 42.7 Revisión general de errores de maquetación en móvil
El usuario pidió revisar toda la web en móvil y escritorio buscando errores y comprobando que ambas vistas fueran coherentes. Recorriendo la landing completa en 375px se encontraron varios solapamientos de texto causados por reglas pensadas solo para escritorio:

- `.section-header` usaba `display:flex; justify-content: space-between` con el título y el `.section-note` lado a lado; en móvil, los títulos largos (p. ej. "TRES PILARES, UN SISTEMA", "CÓMO FUNCIONA") ocupan varias líneas y el subtítulo de la derecha quedaba pisado encima del texto. Fix: en `@media (max-width: 768px)` ahora `.section-header` pasa a columna (`flex-direction: column`), `.section-note` ocupa el ancho completo y se alinea a la izquierda, y `.section-title` se reduce a 40px para que quepa en menos líneas.
- `footer` (`display:flex; justify-content: space-between`) hacía que el logo "K-ONE" se partiera en dos líneas ("K-" / "ONE") y se solapara con el texto de copyright en móvil. Fix: en móvil el footer pasa a columna con los tres bloques apilados.
- `.steps` (las 4 tarjetas de "Cómo funciona") forzaba 2 columnas incluso en móviles estrechos (375px), dejando columnas muy angostas con títulos partidos en 3 líneas. Fix: nueva regla `@media (max-width: 480px) { .steps { grid-template-columns: 1fr; } }` para que cada paso ocupe el ancho completo.
- Los botones del carrusel de opiniones (`.testimonials-nav`) en móvil quedaban como círculos opacos sobre el texto de la tarjeta. Se les dio fondo semitransparente con `backdrop-filter: blur(3px)` para que se note menos el recorte del texto debajo.
- Se añadió `.testimonials` a la lista de secciones con padding reducido en móvil (`80px 24px`), igual que el resto de secciones de la landing.

Verificado en preview recorriendo toda la landing en 375px (manifiesto, tres pilares, cómo funciona, tu deporte/tu plan, resultados reales, sin letra pequeña, CTA final y footer) y en escritorio (sin cambios visuales). También se revisó el dashboard completo (Hoy, Plan semanal, Nutrición, Check-in, Mi progreso, Notas y menú lateral móvil) con la cuenta de test: todo correcto, sin solapamientos ni errores de consola. Cuenta de test restaurada al finalizar.

### 43. "Mi progreso" real (fotos + hitos), favicon/og:image, mensajes de confianza y captura de leads
Tras una revisión general de la web, el usuario pidió abordar varias mejoras: que "Mi progreso" deje de ser un escaparate vacío, completar el `og:image` para compartir en redes, reforzar el mensaje de "cancela cuando quieras" cerca de los puntos de pago, y añadir una captura de email para visitantes que no se registran.

- **Fotos mensuales reales**: las 4 casillas de "Mi progreso" ahora son funcionales. Al pulsar una, se abre el selector de archivos del dispositivo (`<input type="file" accept="image/*">`); la imagen se redimensiona a un máximo de 800px y se comprime a JPEG (`canvas.toDataURL('image/jpeg', 0.75)`) antes de guardarse en `userData.fotosProgreso[idx]`, para no agotar el límite de `localStorage`. La casilla rellena muestra la foto con un botón "✕" para eliminarla. Nuevas funciones: `renderFotosProgreso`, `seleccionarFoto`, `onFotoSelected`, `eliminarFoto`, `guardarProgresoUsuario`.
- **Hitos dinámicos**: "Primera semana completada", "Primer mes completado" y "Primer objetivo conseguido" ya no están fijos en "Pendiente/Bloqueado". Se calculan a partir de datos reales del usuario (`calcularHitos`): semana 1 → `progreso.semana >= 2`; mes 1 → `progreso.semana >= 5`; objetivo 1 → `entrenosCompletados.length >= 12`. La primera vez que se cumple una condición se guarda la fecha en `userData.hitos.<clave>` y el hito pasa a "CONSEGUIDO" (con fecha real y borde naranja); el siguiente hito pendiente muestra "PRÓXIMO" y el resto "BLOQUEADO". Nuevas funciones `calcularHitos`/`renderHitos`, ambas llamadas desde `renderProgresoSection()`, invocada en `buildDashboard()`.
- **`og:image` / `twitter:image`**: se crearon `og-image.svg` (1200x630, branding K-ONE con el motivo de la barra y el lema "No hay atajos. Hay pasos.") y se referenció en `<meta property="og:image">` y `<meta name="twitter:image">` (con `twitter:card` ahora `summary_large_image`). El favicon ya existía como SVG inline y no se ha tocado.
- **Mensajes de confianza junto a los CTA de pago**: nueva línea `.hero-trust` ("Pago seguro · Cancela cuando quieras · Sin permanencia") debajo de los botones del hero, y una línea equivalente (`field-hint`) en el modal de fin de prueba (`#modalPaywall`), antes solo aparecía en la sección de precios.
- **Captura de leads**: nueva sección `.lead-magnet` justo antes del footer, con el mensaje "¿Vas a seguir posponiendo el cambio?" (en línea con el tono "No hay atajos, hay pasos") y un formulario de email. `submitLeadEmail()` guarda `{email, fecha}` en `localStorage['fragua_leads']` y muestra una confirmación in-line. Nota: al no haber backend todavía, estos emails quedan solo en el navegador del visitante (no centralizados); cuando se conecte Supabase (tareas aparcadas) se podrá enviar esta lista a una tabla real.

Verificado en preview en escritorio y móvil (375px): "Mi progreso" muestra correctamente fotos subidas/eliminadas y hitos "CONSEGUIDO" con fecha al simular progreso avanzado; `og-image.svg` se renderiza correctamente al abrirlo directamente; el mensaje de confianza se ve bien en el hero (desktop y móvil) y en el modal de paywall; el formulario de email guarda el lead en `localStorage` y muestra el mensaje de confirmación. Sin errores de consola. Cuenta de test restaurada a su estado original (sin fotos ni hitos forzados).

### 44. Nuevos precios (plan trimestral, anual rebajado, solo nutrición) + periodicidad en la lógica de planes
Tras una discusión sobre precios, se acordó: bajar el plan anual de 119,99€ a 99,99€ (≈8,33€/mes), subir "Solo nutrición" de 4,99€ a 6,99€/mes, y crear un plan trimestral nuevo (Plan completo, 35,99€) para fidelizar clientes que pagan por trimestres. El usuario pidió además que la lógica de datos (contadores, precios, pagos) se actualizara acorde a estos planes, manteniendo todo en `localStorage` (sin tocar Supabase/Stripe, que sigue aparcado). En un segundo ajuste se descartó el plan "Solo nutrición trimestral", se bajó el Trimestral de 39,99€ a 35,99€, se pidió que las 5 tarjetas se vean en una sola fila en escritorio, y se añadió un badge "Oferta" a la tarjeta "Primer mes".

- **Tarjetas de precios** (`#pricing`): 5 tarjetas en una sola fila en escritorio (`.pricing-cards` ahora `grid-template-columns: repeat(5, 1fr)`, `max-width: 1400px`, `.price-card` con padding reducido a `40px 24px` y `.price-badge` con `right: 24px` para que quepan): Primer mes (0,99€, con nuevo badge "Oferta del mes"), Mensual (14,99€, "Más popular"), **Trimestral** (35,99€, "Cada 3 meses · Equivale a 12€/mes · Ahorras 9€"), Anual (99,99€, antes 119,99€, "Equivale a 8,33€/mes · Ahorras 80€"), Solo nutrición (6,99€/mes, antes 4,99€). En móvil sigue colapsando a 1 columna.
- **Hero**: "¿Solo buscas nutrición? También hay plan para ti, desde 4,99€/mes" → "desde 6,99€/mes".
- **Tabla de precios centralizada (`PRECIOS`)**: objeto con el precio, periodo, días de ciclo (30/90/365) y texto de detalle para cada combinación tipoPlan × periodicidad (Plan completo: mensual/trimestral/anual; Solo nutrición: solo mensual). Función `preciosPlan(tipoPlan)` para acceder con fallback al plan completo.
- **`userData.periodicidad`** (nuevo campo, 'mensual' por defecto): determina el ciclo de facturación del usuario. `precioPlanActual(tipoPlan, creadoISO, periodicidad)` calcula el precio/detalle según la tabla `PRECIOS` (en el mes de prueba sigue devolviendo siempre 0,99€). `actualizarDiasRestantesPlan()` usa el ciclo de la periodicidad activa (30/90/365 días) en lugar de fijo a 30.
- **Selector de periodicidad**: nuevo grupo de radios "¿Con qué periodicidad quieres pagar?" (Mensual/Trimestral/Anual) en el modal "Cambiar tu plan" (`cp-periodicidad`) y en el modal de fin de prueba/paywall (`pw-periodicidad`). Nueva función `actualizarOpcionesPeriodicidad(tipoPlan, grupoId)` oculta "Trimestral" y "Anual" cuando el tipo de plan es "Solo nutrición" (solo tiene tarifa mensual) y reasigna a "Mensual" si alguna estaba seleccionada. `valorPeriodicidad(grupoId)` traduce el radio elegido a la clave usada por `PRECIOS`.
- **Modal "Cambiar tu plan"**: `abrirModalCambiarPlan()` preselecciona la periodicidad guardada del usuario y ajusta las opciones visibles según el tipo de plan; `actualizarPrecioCambioPlan()` y `guardarCambioPlan()` ahora también leen/guardan `userData.periodicidad`.
- **Modal de paywall**: ahora muestra el selector de periodicidad y el precio/detalle se recalculan en vivo (`actualizarPrecioPaywall()`). `comprobarPaywall()` preselecciona la periodicidad guardada del usuario. `confirmarPagoSuscripcion()` guarda la periodicidad elegida (en `users[email]` y en `userData`, persistiendo con `saveUserData` salvo cuenta demo) y refresca el contador de días restantes.

Verificado en preview en escritorio y móvil (375px): las 5 tarjetas de precios se muestran en una sola fila en escritorio (con el badge "Oferta del mes" en "Primer mes") y colapsan a 1 columna en móvil; en el modal "Cambiar tu plan", elegir "Solo nutrición" oculta las opciones "Trimestral" y "Anual" de periodicidad; `precioPlanActual` devuelve 35,99€/trimestre (≈12€/mes) para el plan completo trimestral; simulando fin del mes de prueba, el paywall muestra el selector de periodicidad y al confirmar el pago se guarda la periodicidad elegida y se actualiza el contador de días restantes. Sin errores de consola. Cuenta de test restaurada a su estado original.

### 45. Mejora visual del mensaje de confianza del hero ("Pago seguro · Cancela cuando quieras · Sin permanencia")
El usuario compartió una captura de la línea de confianza bajo los botones del hero y dijo que "no se ve bien" (texto pequeño, monoespaciado y en gris claro de baja legibilidad sobre el fondo oscuro).

- `.hero-trust` ahora es un contenedor flex con 3 elementos en línea (uno por mensaje), cada uno con un icono SVG a juego con los ya usados en `.trust-bar` de la sección de precios (candado/check para "Pago seguro", círculo con aspa para "Cancela cuando quieras", candado abierto para "Sin permanencia"). Los iconos se colorean en `var(--brasa)` (naranja) y el texto pasa de `var(--metal-claro)` (gris, 12px) a `var(--blanco)` (casi blanco, 13px), con más espaciado (`gap`, `margin-top: 24px`).
- En móvil los 3 elementos se apilan en columna gracias al `flex-wrap: wrap` ya existente, sin desbordar el ancho de pantalla.

Verificado en preview en escritorio (3 elementos en fila, color de icono `rgb(232, 73, 15)` = `--brasa`, texto `rgb(240, 237, 232)` = `--blanco`) y en móvil 375px (los 3 elementos se apilan en columna sin desbordar). Sin errores de consola. No requiere restaurar cuenta de test (no se modificaron datos de usuario).

### 46. Separar "Solo nutrición" de las opciones de deporte en la sección "Tu deporte, tu plan"
El usuario pidió corregir la categorización de la web: separar claramente las opciones de deporte de las de nutrición para evitar incoherencias en la interfaz. La sección `#sports` ("Tu deporte, tu plan") mostraba 5 tarjetas en una misma cuadrícula: 4 deportes reales (Gimnasio, Running, Hyrox, CrossFit) y, mezclada entre ellas, una tarjeta "Solo nutrición" — que no es un deporte, sino un tipo de plan sin entrenamiento, lo que resultaba incoherente bajo un título que habla de "deporte".

- `.sports-grid` vuelve a `grid-template-columns: repeat(4, 1fr)` y ahora contiene únicamente las 4 tarjetas de deportes reales.
- Se eliminó la tarjeta "Solo nutrición" de `.sports-grid` y se sustituyó por un bloque `.nutrition-callout` aparte, debajo de la cuadrícula de deportes: una franja con borde propio, icono 🥗, el título "¿Solo buscas nutrición?", la descripción del plan y un botón "Ver plan de nutrición →" que lleva al formulario. Visualmente queda claro que es una categoría distinta (plan de alimentación), no un deporte más.
- Nuevo breakpoint en `@media (max-width: 480px)`: `.sports-grid` pasa a 1 columna y `.nutrition-callout` centra su contenido, igual que ya se hacía con `.steps`.

Se revisó también el flujo del cuestionario y el dashboard: al elegir "Solo nutrición, sin entrenamiento" en "¿Qué tipo de plan quieres?", el bloque "Tu entrenamiento" (deporte, días, lugar, etc.) ya se salta automáticamente (`esSoloDieta()` en `nextBlock()`) y el dashboard abre directamente en "Nutrición" ocultando "Hoy", "Plan semanal" y "Check-in" — esa parte ya estaba correctamente separada y no requirió cambios.

Verificado en preview en escritorio (4 tarjetas de deporte en una fila + bloque de nutrición separado debajo, con su propio borde y CTA) y en móvil 375px (4 tarjetas y el bloque de nutrición colapsan a 1 columna sin desbordar, ancho máximo 351px en viewport de 375px). Sin errores de consola. No requiere restaurar cuenta de test (no se modificaron datos de usuario).

### 47. Nueva sección "Cómo funciona la IA" (transparencia y supervisión humana)
El usuario pidió añadir validación/supervisión humana o, al menos, aclarar cómo funciona la IA y cómo se generan los planes, para ganar credibilidad. Se confirmó que K-One es un sistema basado en reglas (sin un profesional humano revisando cada plan individual), por lo que el texto debía ser honesto sobre esto y remitir a un profesional sanitario para casos médicos.

- Nueva sección `<section class="pillars" id="transparencia">` entre "Cómo funciona" y "Tu deporte, tu plan", reutilizando los estilos ya existentes de `.pillars-grid`/`.pillar-card` (misma maquetación que "Tres pilares, un sistema").
- Título "Cómo funciona la IA" / subtítulo "Transparencia sobre cómo se genera y se ajusta tu plan", con 3 tarjetas:
  - **"No es una caja negra"**: explica que el plan lo genera un motor de reglas (progresión de cargas, volumen, macros), no una IA conversacional improvisando.
  - **"Basado en criterios establecidos"**: la lógica sigue principios de entrenamiento/nutrición habituales (periodización, déficit/superávit calórico, macros) adaptados a los datos del usuario (edad, peso, objetivo, nivel, lesiones, alergias, disponibilidad).
  - **"Sus límites"**: deja claro que K-One no sustituye a un médico ni a un dietista-nutricionista y remite a un profesional sanitario ante dudas o cambios importantes (refuerza el disclaimer ya existente en el footer).

Verificado en preview en escritorio (3 tarjetas en una fila, debajo de "Cómo funciona" y encima de "Tu deporte, tu plan") y en móvil 375px (las 3 tarjetas se apilan en 1 columna sin desbordar). Sin errores de consola. No requiere restaurar cuenta de test (solo contenido de la landing, sin datos de usuario).

### 48. Mockup de la interfaz, hibridación de deportes y pilar "Mentalidad" más completo
El usuario dio 3 sugerencias tras revisar la web: (1) mostrar visualmente cómo es la interfaz para aumentar el deseo de compra, (2) destacar en la landing que se pueden combinar disciplinas (p. ej. maratón/Hyrox sin perder gimnasio), aprovechando la opción "Combinación" que ya existe en el configurador interno, y (3) dar más profundidad al pilar "Mentalidad", explicando en qué consiste realmente. Al no haber capturas reales disponibles, se acordó recrear la interfaz con un mockup CSS/HTML, y para "Mentalidad" se acordó mejorar solo el texto sin añadir funcionalidad nueva.

- **Nueva sección "Tu semana, en el móvil"** (`#app-preview`, entre "Tres pilares, un sistema" y "Cómo funciona"): layout a 2 columnas (texto + mockup) reutilizando el patrón de `.manifesto`. El mockup es un `.phone-frame` (marco de teléfono en CSS, con notch) que contiene 3 tarjetas (`.mock-card`) recreadas con los colores y tipografías de K-One: una tabla de ejercicios de hoy (Press banca, Press militar, Fondos lastrados, Elevaciones laterales con series×reps y peso), un selector de comida (Almuerzo con alimentos y macros P/C/G) y una gráfica de progresión de sentadilla (barras `.mock-bar` crecientes de S1 a S6, con la barra final resaltada en `--brasa` y el texto "60 kg → 92,5 kg en 6 semanas"). En móvil (`@media max-width: 768px`) el mockup pasa a mostrarse primero (`order: -1`) y la cuadrícula colapsa a 1 columna.
- **Aviso de hibridación de deportes**: nuevo bloque `.hybrid-callout` al principio de la sección "Tu deporte, tu plan" (antes de las 4 tarjetas de deporte), con icono 🔀, título "¿Entrenas para más de una cosa?" y texto explicando que la opción "Combinación" fusiona fuerza y resistencia en un único plan semanal (ej. maratón/Hyrox sin perder progreso en el gimnasio). Reutiliza el mismo patrón visual que `.nutrition-callout` pero con borde en `var(--brasa-oscura)` para diferenciarlo.
- **Pilar "Mentalidad" ampliado** (sección "Tres pilares, un sistema"): el texto pasa de una frase genérica ("Check-in semanal y mensajes que te ayudan a sostener el proceso, no solo a empezarlo.") a una explicación basada en la lógica real ya existente: el check-in semanal (días entrenados, energía, estado físico y mental) ajusta el volumen de la semana siguiente (`progreso.ajuste`, sube o baja según cómo haya ido la semana), los hitos desbloqueados reflejan la constancia real (`calcularHitos`), y cada día se muestra un mensaje motivacional pensado para los días difíciles (`mensaje_dia`). Sin cambios de funcionalidad, solo de texto.

Verificado en preview en escritorio (961px: mockup del teléfono de 290px de ancho dentro de la nueva sección, sin overflow propio; el único overflow horizontal detectado es el ya existente y esperado del carrusel de testimonios) y en móvil 375px (la sección colapsa a 1 columna con el mockup primero, el `.hybrid-callout` ocupa 327px sin desbordar, sin overflow horizontal adicional). Sin errores de consola. No requiere restaurar cuenta de test (solo contenido de la landing, sin datos de usuario).

### 49. Reducción de texto en toda la landing (~30%)
El usuario indicó que la página es muy larga (explicación del sistema, de la IA, deportes, testimonios, precios, CTA final) y que muchos usuarios no llegan al final, pidiendo reducir el texto entre un 25% y un 35%.

- **Manifiesto** ("El hierro no se forja solo"): de 3 párrafos a 2, fusionando las ideas de acompañamiento semanal y de "entrenamiento, nutrición y mentalidad juntos" en el primero, y eliminando la redundancia del tercero.
- **Pilar "Mentalidad"**: el texto ampliado en el punto 48 se recorta ligeramente (de ~320 a ~240 caracteres) manteniendo las 3 ideas clave (ajuste por check-in, hitos, mensaje diario) pero de forma más directa.
- **"Tu semana, en el móvil"** (mockup): de 3 párrafos a 2, fusionando la descripción de ejercicios y comidas en uno solo.
- **"Cómo funciona"**: los 4 textos de los pasos se acortan (~25-35% cada uno), eliminando repeticiones y palabras de relleno.
- **"Cómo funciona la IA"**: las 3 descripciones se recortan significativamente (~30% cada una), manteniendo los conceptos clave (motor de reglas, criterios establecidos, límites/profesional sanitario).
- **"Tu deporte, tu plan"**: el aviso de hibridación y el bloque "¿Solo buscas nutrición?" se acortan ligeramente (se elimina la pregunta retórica inicial en este último).
- **Precios**: las descripciones de los planes Mensual, Trimestral, Anual y Solo nutrición se acortan, manteniendo el dato clave de cada uno.
- **Testimonios**: de 20 a 10 tarjetas, conservando variedad de deportes (Gimnasio, Running, Hyrox, CrossFit, Solo nutrición, Combinación, Casa/Calistenia) y casos relevantes (alergias, lesiones, condición médica, edad).
- **CTA final**: se fusionan las secciones `.philosophy` y `.lead-magnet` (antes dos secciones consecutivas con CTA) en una sola: la frase "Lo que se construye despacio no se rompe fácil" + botón "Empieza por 0,99€" + un formulario de email más discreto ("O déjanos tu email y te avisamos" / botón "Avísame") debajo. Se eliminó la sección `.lead-magnet` y su CSS específico (`.lead-magnet-title`, `.lead-magnet-sub`, etc.), conservando `.lead-magnet-form`/`.lead-magnet-note` reutilizados dentro de `.philosophy`.

Verificado en preview en escritorio (10 testimonios en el carrusel, formulario de email dentro de la sección `.philosophy`, sección `.lead-magnet` ya no existe en el DOM) y en móvil 375px (formulario en columna, sin overflow horizontal adicional al ya existente del carrusel de testimonios). Sin errores de consola. No requiere restaurar cuenta de test (solo contenido de la landing, sin datos de usuario).

### 50. Mejora visual de los enlaces secundarios en las pantallas de acceso (bienvenida, registro, login)
El usuario compartió capturas de "← Volver a la web", "← Volver", "¿Olvidaste tu contraseña?" y "¿No tienes cuenta?" en las pantallas de autenticación, indicando que se veían planos/poco visuales y pidiendo un estilo más acorde con el resto de la web.

- **Enlaces "Entra aquí" / "Créala aquí"** (`.auth-subtitle a`): pasan de naranja fino sin negrita a `font-weight: 600` y añaden una flecha ("Entra aquí →" / "Créala aquí →"), con transición a blanco al pasar el ratón.
- **"¿Olvidaste tu contraseña?"** (`.auth-forgot`): de texto gris monoespaciado plano a un span en blanco (`var(--blanco)`) con subrayado punteado en `var(--metal)` que se vuelve naranja (`var(--brasa)`) al pasar el ratón.
- **"← Volver" / "← Volver a la web"**: nueva clase `.auth-back` reutilizada en bienvenida, registro y login — texto en blanco, mayúsculas, espaciado tipo etiqueta (`DM Mono`, letter-spacing 2px, igual que otras etiquetas de la web), con la flecha (`.auth-back-arrow`) deslizándose hacia la izquierda al pasar el ratón.

Verificado en preview en escritorio (961px) y móvil (375px) en las pantallas "bienvenida", "registro" y "login". Sin errores de consola. No requiere restaurar cuenta de test (solo estilos, sin datos de usuario).

### 51. Registro de pesos por ejercicio, sincronizado entre "Hoy" y "Plan semanal", con progresión en "Mi progreso"
El usuario pidió poder anotar el peso con el que entrena cada ejercicio directamente en el dashboard, que ese registro se vea también en el plan semanal, y que al repetir el mismo ejercicio más adelante se recuerde automáticamente el último peso usado, para facilitar ver la progresión.

- **`formatearSesion(day)`** (usada tanto para "Entrenamiento de hoy" como para cada día de "Plan semanal"): los ejercicios del "Bloque de fuerza" y "Bloque de hipertrofia" (los que tienen series×reps con carga) ahora se renderizan como filas (`.ejercicio-fila`) con un input numérico de peso (`.peso-input`, en kg) al lado. Los bloques de "Acondicionamiento" y "Core" (distancia/tiempo/peso corporal) no cambian.
- **`normalizarEjercicio(nombre)`**: genera una clave estable (minúsculas, sin acentos) a partir del nombre del ejercicio (p. ej. "Press banca" → "press banca"), usada para identificar el mismo ejercicio aunque aparezca en distintos días/semanas.
- **`getPesoEjercicio(key)` / `guardarPesoEjercicio(input)`**: al cambiar un input de peso, se guarda en `userData.pesosEjercicios[key] = { nombre, peso, fecha, historial: [{fecha, peso}, ...] }` (una entrada por día, sin duplicados) y se persiste con `saveUserData`. Si el mismo ejercicio aparece en varias filas visibles (p. ej. "Hoy" y "Plan semanal" a la vez), todos los inputs con esa clave se sincronizan al instante. La próxima vez que aparezca ese ejercicio (otro día, otra semana), el input se precarga con el último peso guardado.
- **Nueva sección "Progresión de pesos"** en "Mi progreso" (`#pesosProgresoList`, función `renderPesosProgreso`): una tarjeta por ejercicio registrado, con el peso actual, la diferencia respecto al primer registro ("+12.5 kg desde tu primer registro") y un mini-gráfico de barras (`.peso-bar`) con el historial de los últimos registros (la barra más reciente resaltada en `var(--brasa)`).
- Nuevas clases CSS: `.ejercicios-peso-list`, `.ejercicio-fila`, `.ejercicio-fila-texto`, `.ejercicio-fila-peso`, `.peso-input`, `.peso-unit`, `.peso-progreso-card`, `.peso-progreso-nombre`, `.peso-progreso-actual`, `.peso-progreso-diff`, `.peso-progreso-bars`, `.peso-bar`.

Verificado en preview con la cuenta de test: al introducir 60 kg en "Press banca" desde "Hoy", se guarda en `userData.pesosEjercicios`, el mismo input aparece precargado con 60 en "Plan semanal", y la tarjeta "Press banca · 60 kg" aparece en "Progresión de pesos" dentro de "Mi progreso". Probado también con un plan de CrossFit (bloques tipo WOD/AMRAP): el input de peso solo se añade al ejercicio con barra (p. ej. "Sentadilla trasera con barra"), no a ejercicios de acondicionamiento/core. Verificado en escritorio y móvil (375px, sin overflow). Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 52. Registro de peso por ejercicio más interactivo (stepper +/-) y mini-historial inline
El usuario compartió una captura del input de peso en "Hoy" (un simple `<input type="number">` con flechitas nativas pequeñas y la etiqueta "KG") y pidió que fuera más interactivo (no solo "unas flechitas y ya"), además de mostrar un histórico de pesos por ejercicio similar al de "Mi progreso" pero más pequeño, integrado en cada fila.

- **`.peso-input` → stepper**: cada fila de ejercicio (`.ejercicio-fila`, ahora en columna) tiene una `.ejercicio-fila-controls` con un `.peso-stepper`: botón "−" / input de peso / botón "+" / etiqueta "kg", sustituyendo las flechitas nativas del `<input type="number">` (ocultas vía `-webkit-appearance: none`). Los botones `.peso-btn` ajustan el peso en ±2,5 kg (`ajustarPeso(btn, delta)`), clampando a un mínimo de 0 y redondeando a 1 decimal, y guardan al instante llamando a `guardarPesoEjercicio`.
- **Mini-historial inline**: nuevo `.peso-mini-historial` junto al stepper de cada ejercicio, con barras pequeñas (`.peso-bar-mini`, igual estilo que `.peso-bar` de "Mi progreso" pero más compactas) mostrando los últimos 6 registros; la barra más reciente se resalta en `var(--brasa)`. Nueva función `renderMiniHistorialHTML(historial)` calcula la altura de cada barra como porcentaje del máximo (mínimo 15% para que las barras pequeñas sigan siendo visibles).
- **`guardarPesoEjercicio(input)`**: además de sincronizar todos los `.peso-input` con la misma clave de ejercicio (ya existente), ahora también re-renderiza todos los `.peso-mini-historial[data-ejercicio="..."]` con el historial actualizado, manteniendo "Hoy" y "Plan semanal" sincronizados tanto en el valor como en el mini-gráfico.

Verificado en preview con la cuenta de test: el stepper se ve correctamente en escritorio y móvil (375px), los botones +/- incrementan/decrementan el peso de "Press banca" en pasos de 2,5 kg y persisten el valor; con un historial de ejemplo (40→42,5→45→45→50 kg), el mini-historial muestra 5 barras crecientes con la última en naranja, sincronizado entre "Hoy" y "Plan semanal", y la tarjeta de "Press banca" en "Progresión de pesos" (Mi progreso) sigue mostrando el mismo historial con su gráfico de barras grande. Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 53. Botón de precio del hero más grande ("Oferta del mes") y reordenación del menú
El usuario compartió capturas del badge de precio del hero ("PRIMER MES 0,99€") y de la barra de navegación, pidiendo que el badge fuera más grande y dijera "Oferta del mes", y que en el menú "Entrar" apareciera primero.

- **`.hero-price`**: padding de `12px 22px` a `16px 28px`, borde de `1px solid rgba(232,73,15,0.35)` a `2px solid var(--brasa)` (más visible).
- **`.hero-price-main`**: tamaño de fuente de `42px` a `56px`.
- **`.hero-price-label`**: tamaño de fuente de `11px` a `12px`, color de `var(--metal)` a `var(--blanco)` con `font-weight: 600`, y el texto pasa de "Primer mes" a "Oferta del mes".
- **Menú de escritorio (`.nav-links`)**: "Entrar" se mueve al primer lugar, antes de "Cómo funciona", "Deportes", "Opiniones" y "Precios". El menú móvil ya tenía "Entrar" primero, sin cambios.

Verificado en preview en escritorio y móvil (375px): el badge de precio se ve notablemente más grande con el nuevo texto "Oferta del mes", y "Entrar" aparece como primer elemento del menú. Sin errores de consola. No requiere restaurar cuenta de test (solo contenido/estilos de la landing).

### 54. Reordenación de secciones de la landing: precios más arriba, opiniones antes del CTA final
El usuario indicó que los precios estaban demasiado abajo (los visitantes tienen que hacer mucho scroll para verlos) y que las opiniones deberían aparecer un poco antes del final de la web, ya que pocos usuarios llegan hasta el final. Se propuso mover la sección de precios justo después del manifiesto, lo que automáticamente deja "Opiniones" como la sección inmediatamente anterior al CTA final; el usuario aprobó la propuesta.

- La sección `<section class="pricing" id="pricing">` (5 tarjetas de precio + barra de confianza) se traslada de su posición original (entre "Opiniones" y el CTA final "Lo que se construye despacio...") a justo después de `<section class="manifesto" id="manifesto">`, antes de "Tres pilares, un sistema".
- Nuevo orden de secciones: hero → manifiesto → **precios** → tres pilares → tu semana en el móvil → cómo funciona → cómo funciona la IA → tu deporte, tu plan → **opiniones** → CTA final.
- No se modificó el contenido de la sección de precios, solo su posición.

Verificado en preview en escritorio: navegando a "Tres pilares" se ve la sección de precios justo antes; navegando a "Opiniones" se confirma que es la sección inmediatamente anterior al CTA final. Sin errores de consola. No requiere restaurar cuenta de test (solo contenido de la landing).

### 55. Reducción del espaciado general del dashboard en móvil
El usuario indicó que en móvil la pantalla "Hoy" del dashboard se sentía incómoda, con demasiado espacio entre elementos. Tras compartir una captura real desde el móvil y aclarar que el problema era el "espaciado general de toda la pantalla", se redujeron los márgenes y paddings de los bloques principales del dashboard dentro de `@media (max-width: 768px)`:

- `.dash-main`: padding de `24px` a `20px`.
- `.dash-header`: `margin-bottom` de `48px` (escritorio) a `28px`.
- `.dash-title`: `font-size` de `48px` (escritorio) a `36px`.
- `.motivation-card`: padding de `28px 32px` a `18px 20px`, `margin-bottom` de `40px` a `24px`.
- `.motivation-text`: `font-size` de `18px` a `16px`.
- `.stats-row`: `gap` de `2px` (escritorio) a `1px`, `margin-bottom` de `40px` a `24px`.
- `.stat-card`: padding de `24px 28px` a `16px 18px`.
- `.stat-card-value`: `font-size` de `36px` a `30px`.
- `#todayPlan`, `#feedbackPanel`, `.checkin-card`, `.subst-box` (tarjetas con padding inline de `40px`): `padding: 20px !important` en móvil.

Verificado en preview en móvil (375x812) con la cuenta de test: la pantalla "Hoy" se ve notablemente más compacta. Se revisaron también "Plan semanal", "Nutrición" y "Mi progreso", que usan los mismos estilos reducidos y se ven correctamente sin elementos rotos ni desbordamiento. Verificado en escritorio (1440px) que el cambio, al estar dentro de `@media (max-width: 768px)`, no afecta al espaciado de escritorio. Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 56. Corrección del menú en tablets/móviles grandes y nueva reordenación de secciones (precios justo después de "Tu deporte, tu plan")
El usuario compartió una captura desde su móvil mostrando el menú de escritorio ("ENTRAR CÓMO FUNCIONA DEPORTES OPINIONES PRECIOS") desbordando la pantalla, con la necesidad de desplazarse hacia la derecha para ver todas las opciones y solapándose con el logo. Además pidió que la sección "Tu deporte, tu plan" (lo que se ofrece) apareciera justo encima de "Precios", para que el cliente vea primero la oferta y justo debajo el precio.

- **Bug del menú en pantallas medianas (769px-1024px, p. ej. móviles grandes/tablets)**: el menú de escritorio (`.nav-links`) solo cambiaba al icono de hamburguesa por debajo de 768px, pero con 6 elementos (tras añadir "Entrar") no cabía en pantallas de hasta ~1024px, desbordando horizontalmente y solapándose con el logo. Se añadió un nuevo punto de corte `@media (max-width: 1024px)` que oculta `.nav-links` y muestra `.nav-toggle` (hamburguesa) en ese rango; se eliminaron las reglas duplicadas que ya existían dentro de `@media (max-width: 768px)`.
- **Tarjetas de precios en pantallas medianas**: `.pricing-cards` usaba `grid-template-columns: repeat(5, 1fr)` en cualquier ancho ≥769px, lo que en tablets (769-1024px) hacía que las 5 tarjetas no cupieran y desbordaran la página horizontalmente. Dentro del mismo nuevo punto de corte de 1024px, `.pricing-cards` pasa a `repeat(2, 1fr)` (2 columnas) en ese rango; por debajo de 768px sigue en 1 columna como ya estaba.
- **Reordenación de secciones**: la sección `<section class="pricing" id="pricing">` se traslada de justo después de "Manifiesto" (punto 54) a justo después de "Tu deporte, tu plan" (`id="sports"`) y antes de "Opiniones". Nuevo orden: hero → manifiesto → tres pilares → tu semana en el móvil → cómo funciona → cómo funciona la IA → **tu deporte, tu plan → precios** → opiniones → CTA final. Esto mantiene "Opiniones" justo antes del CTA final (como se pidió en el punto 54) y además sitúa "Precios" justo debajo de la sección que muestra la oferta.

Verificado en preview en tres anchos: 375px (menú hamburguesa, precios en 1 columna, sin desbordamiento), 800-1024px (menú hamburguesa en vez del menú de escritorio desbordado, precios en 2 columnas, `scrollWidth === clientWidth` sin desbordamiento) y 1440px (menú de escritorio completo con "Entrar" primero, precios en 5 columnas). Orden de secciones confirmado por DOM: manifesto → pillars → app-preview → how → transparencia → sports → pricing → testimonials. Sin errores de consola. No requiere restaurar cuenta de test (solo contenido/estilos de la landing).

### 57. Bloqueo del scroll horizontal de toda la página en móvil
El usuario envió un vídeo grabado desde su móvil (sitio en producción, k-one-six.vercel.app) mostrando que tanto la landing como el dashboard se podían desplazar horizontalmente unos 15-20px, cortando el logo "K-ONE" y el texto del hero/título por el borde izquierdo, con una barra de scroll horizontal visible.

- Las comprobaciones programáticas en el preview (375, 414, 800, 1024, 1440px) no detectaron ningún elemento que sobresaliera del viewport (`scrollWidth === clientWidth` en todos los casos), por lo que el origen exacto del pequeño desbordamiento en el dispositivo real no se pudo aislar con certeza.
- Como red de seguridad, se añade `overflow-x: hidden` en `html, body` (y `width: 100%` en `body`): así, aunque algún elemento sobresalga ligeramente del viewport, la página ya no podrá desplazarse horizontalmente como conjunto. El carrusel de "Opiniones" (`.testimonials-track`) conserva su propio scroll horizontal interno (`overflow-x: auto`), que es intencional.

Verificado en preview (375/414px): `overflowX` de `html`/`body` es `hidden`, `docScrollWidth === clientWidth`, y el carrusel de testimonios sigue teniendo `overflow-x: auto` con `scrollWidth > clientWidth` (sigue siendo desplazable). Sin errores de consola. No requiere restaurar cuenta de test (solo estilos globales).

### 58. Corregido el zoom automático de iOS que dejaba la web "desencuadrada" en el móvil
El usuario envió varias capturas/vídeos desde su iPhone donde toda la web (landing y dashboard) aparecía ampliada y cortada por los bordes (logo y botón de menú cortados, texto saliéndose de pantalla), obligando a desplazarse lateralmente. La causa raíz identificada: **Safari en iOS hace zoom automático al tocar cualquier campo de texto cuya letra sea menor de 16px**, y como K-One es una SPA (una sola página que nunca se recarga), ese zoom se quedaba fijo para siempre tras tocar el email/contraseña del login, el cuestionario o el input de peso — dejando todo "desencuadrado".

- **Viewport meta**: de `width=device-width, initial-scale=1.0` a `width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover`. `maximum-scale=1.0` impide el zoom automático al enfocar campos (desde iOS 10 el pellizco manual del usuario sigue funcionando, solo se bloquea el zoom automático).
- **Campos a 16px en táctil**: dentro de `@media (max-width: 1024px)`, regla global `input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), select, textarea { font-size: 16px !important; }` — ataca la causa de raíz: con 16px o más, iOS nunca dispara el zoom. Afecta a login/registro (email, contraseña), cuestionario (`.field input/select/textarea`, 14px), stepper de peso (`.peso-input`, 14px) y formulario de email del CTA final (`.lead-magnet-form input`, 14px). En escritorio (>1024px) se mantienen los tamaños originales.

Verificado en preview a 375px: campos de login, `.peso-input` (el stepper sigue cabiendo, fila de 295px en viewport de 375px) y formulario de email a 16px, sin desbordamiento (`scrollWidth === clientWidth`); a 1440px los campos mantienen 14px. Sin errores de consola. Cuenta de test restaurada tras la prueba.

### 59. Sidebar del dashboard oculto también en tablets (igual que en móvil)
El usuario compartió una captura "QUÉ MEJORARÍA" señalando que en tablets el sidebar fijo del dashboard ocupaba aproximadamente un tercio del ancho de la pantalla.

- El patrón "off-canvas" (sidebar oculto con `transform: translateX(-100%)`, botón hamburguesa `.dash-mobile-bar`, clase `.open` para mostrarlo) que ya existía solo en `@media (max-width: 768px)` se extendió a `@media (max-width: 1024px)`: `.dash-layout { grid-template-columns: 1fr; }`, `.dash-sidebar` pasa a `position: fixed`, `width: 80%` (máx. 300px), `z-index: 200` y `.dash-mobile-bar { display: flex; }`.
- `.dash-main` pasa a `padding: 28px` en este rango (768px sigue sobrescribiéndolo a `20px` para móviles).

Verificado en preview a 800px (tablet): el sidebar queda oculto, aparece el botón hamburguesa y se abre/cierra correctamente sobre el contenido; a 1440px el layout de escritorio no cambia. Sin errores de consola. No requiere restaurar cuenta de test (solo estilos).

### 60. Gráfica de líneas real para "Progresión de pesos"
El usuario pidió gráficas de progreso "reales" en lugar de las barras simples de la tarjeta de cada ejercicio en "Mi progreso".

- Nueva función `pesosLineChartHTML(hist)`: genera un SVG (`viewBox="0 0 140 48"`) con un `<polyline>` y un `<circle>` por cada uno de los últimos 4-6 registros de peso, escalados según el mínimo/máximo del historial; el último punto se resalta en `var(--brasa)` (vía `style="fill:..."`/`style="stroke:..."` para que la variable CSS se resuelva en SVG), los anteriores en `var(--metal)`. Si hay menos de 2 registros, muestra un mensaje (`.peso-line-chart-empty`) en su lugar.
- `renderPesosProgreso()` ahora llama a `pesosLineChartHTML(hist)` en vez de generar las antiguas `.peso-bar`/`.peso-progreso-bars` (eliminadas del CSS).
- Nuevas clases CSS: `.peso-line-chart` (140x48px) y `.peso-line-chart-empty`.

Verificado en preview con la cuenta de test (historial de ejemplo de 6 semanas en "Press banca"): la gráfica de líneas se renderiza correctamente con el último punto en naranja, sin errores de consola, en escritorio y móvil (375px). Cuenta de test restaurada a su estado original tras la prueba.

### 61. Vista previa de las opciones de comida en "Nutrición" sin necesidad de expandir
El usuario pidió poder ver de un vistazo las alternativas de cada comida sin tener que desplegar cada bloque.

- Cada `.meal-block` añade ahora `.meal-block-count` ("X opciones · toca para ver detalles") y, antes de `.meal-options`, una nueva fila `.meal-preview-row` (`#mealPreview${mealIdx}`) con una píldora `.meal-preview-pill` por cada una de las 4 alternativas (nombre + kcal), en grid de 4 columnas (2 columnas por debajo de 900px).
- Cada píldora es clicable (`selectMealOptionPreview(mealIdx, optIdx)`, con `event.stopPropagation()` para no abrir/cerrar el bloque) y selecciona esa opción directamente; la píldora seleccionada recibe la clase `.meal-preview-pill.selected`.
- `selectMealOption(el, mealIdx, optIdx)` se refactorizó para delegar en una nueva función común `aplicarSeleccionComida(mealIdx, optIdx, nombre)`, que `selectMealOptionPreview` también usa, sincronizando tanto las píldoras de vista previa como las tarjetas `.meal-option` expandidas. El texto de la comida elegida pasa a "Elegida: ${nombre}".
- Nuevas clases CSS: `.meal-block-count`, `.meal-preview-row`, `.meal-preview-pill`, `.meal-preview-pill.selected`, `.meal-preview-num`, `.meal-preview-name` (line-clamp 2 líneas), `.meal-preview-kcal`.

Verificado en preview con la cuenta de test: las 4 píldoras de cada comida muestran nombre y kcal sin expandir el bloque; al pulsar una píldora se marca como seleccionada y se sincroniza con la tarjeta expandida correspondiente. Verificado en escritorio (4 columnas) y tablet/móvil (2 columnas), sin desbordamiento. Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 62. Pantalla de resumen al completar el check-in semanal
El usuario pidió un feedback más claro justo después de enviar el check-in semanal, en vez de solo una respuesta de texto.

- Nuevo bloque `#checkinSummary` (`.checkin-summary`, oculto por defecto, clase `.visible` para mostrarlo) que sustituye visualmente a `#checkinForm` (ahora con `id="checkinForm"`) tras enviar el check-in. Incluye: cabecera con icono ✓, título "Check-in completado" y `#checkinSummarySemana` ("Resumen de la semana N"); una rejilla `#checkinSummaryStats` de 4 estadísticas (días entrenados, físico, energía, cabeza); `#checkinSummaryAdjust` con un mensaje sobre el ajuste aplicado al plan; la respuesta de la IA (`#checkinResponse`, antes `.ai-response`) ahora anidada y siempre visible; y `.checkin-summary-actions` con dos botones ("Ver plan de la semana" → `showSection('semana')`, y "Hacer otro check-in" → `resetCheckinForm()`).
- `submitCheckin()`: en el `setTimeout` existente, además de la lógica previa, ahora rellena `#checkinSummaryStats` y `#checkinSummaryAdjust` (según `ajuste` sea -1/0/+1), pone el texto de `#checkinSummarySemana`, oculta `#checkinForm` y muestra/hace scroll a `#checkinSummary`.
- Nueva función `resetCheckinForm()`: oculta el resumen, vuelve a mostrar el formulario y limpia las valoraciones y el textarea para un nuevo check-in.
- Nuevas clases CSS: `.checkin-summary`, `.checkin-summary.visible`, `.checkin-summary-header`, `.checkin-summary-icon`, `.checkin-summary-title`, `.checkin-summary-sub`, `.checkin-summary-stats` (grid 4 columnas, 2 por debajo de 600px), `.checkin-summary-stat`, `.checkin-summary-stat-value`, `.checkin-summary-stat-label`, `.checkin-summary-adjust`, `.checkin-summary-actions`.

Verificado en preview con la cuenta de test: al enviar un check-in se oculta el formulario y aparece la pantalla de resumen con las 4 estadísticas, el mensaje de ajuste del plan y los dos botones de acción; "Hacer otro check-in" devuelve al formulario vacío. Verificado en escritorio y móvil (375px, estadísticas en 2 columnas), sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 63. Racha de días entrenando ("🔥 X días seguidos")
El usuario pidió un elemento de gamificación tipo "racha de días" junto a "Días restantes".

- Nueva tarjeta de estadística antes de "Días restantes": `#rachaDias` ("🔥 0") con etiqueta `#rachaDiasLabel` ("días seguidos entrenando"), color `var(--brasa)`.
- Nuevo array persistente `userData.historialEntrenos` (a diferencia de `entrenosCompletados`, que se vacía cada semana tras el check-in, este nunca se resetea), actualizado por `toggleEntrenoCompletado()` en paralelo al array semanal.
- Nueva función `calcularRachaDias()`: cuenta los días consecutivos en `historialEntrenos` terminando hoy o ayer (para no romper la racha si todavía no se ha entrenado hoy). Nueva función `actualizarRacha()`: actualiza `#rachaDias`/`#rachaDiasLabel` (con singular/plural) y se llama desde `actualizarEstadoCompletado()`.

Verificado en preview con la cuenta de test: al marcar entrenos completados en días consecutivos (simulando `historialEntrenos`), la racha se actualiza correctamente y el texto pluraliza bien ("1 día" / "X días"). Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 64. Tour guiado del primer día (onboarding) tras generar el plan
El usuario pidió dar contexto al usuario nuevo justo después de generar su plan, para que entienda dónde encontrar cada cosa.

- Nuevo modal `#onboardingModal` (`.onboarding-modal`, `z-index: 400`, clase `.visible` para mostrarlo) con `.onboarding-box`: paso actual, icono, título, texto, puntos de progreso (`.onboarding-dots`/`.onboarding-dot`/`.onboarding-dot.active`) y acciones ("Saltar" → `skipOnboarding()`, "Siguiente"/"Empezar" → `nextOnboardingStep()`).
- Nuevo array `ONBOARDING_STEPS` con 5 pasos (Hoy, Plan semanal, Nutrición, Check-in, Progreso), cada uno con icono/título/texto explicando esa sección del dashboard.
- Nuevas funciones `startOnboarding()`, `renderOnboardingStep()`, `nextOnboardingStep()`, `skipOnboarding()` y `finishOnboarding()` (marca `userData.onboardingCompletado = true`, lo persiste con `saveUserData` si no es el usuario demo, y muestra la sección "Hoy").
- En `generatePlan()`, justo después de `goTo('dashboard')`, se añade `if (!userData.onboardingCompletado) startOnboarding();` — el tour solo se dispara la primera vez, justo tras generar el plan (el verdadero "día 1").
- `ensureTestAccount()` siembra `onboardingCompletado: true` en los datos de la cuenta de test, para que no aparezca el tour durante las pruebas habituales.

Verificado en preview generando un plan nuevo desde el cuestionario: el modal aparece automáticamente con los 5 pasos, "Saltar" y "Siguiente"/"Empezar" funcionan correctamente y al finalizar se muestra la sección "Hoy"; en la cuenta de test (con `onboardingCompletado: true`) el tour no aparece. Verificado en escritorio y móvil (375px), sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 65. Guía y acción en los slots vacíos de "Fotos mensuales"
El usuario compartió una captura "ERRORES Y PROBLEMAS DETECTADOS" señalando que los 4 huecos de "Fotos mensuales" no daban ninguna indicación de cómo añadir una foto.

- `renderFotosProgreso()`: cada slot vacío añade ahora un `.photo-slot-hint` ("+ Añadir foto", en `var(--brasa)`) entre el icono de cámara y la etiqueta "Mes N".
- Nuevo párrafo `.field-hint` justo encima de `#photosGrid` explicando que se puede tocar cualquier hueco para subir una foto desde el dispositivo, que se guardan solo localmente y que sirven para ver la evolución mes a mes.
- Nueva clase CSS `.photo-slot-hint` (DM Mono, 10px, mayúsculas, color `var(--brasa)`).

Verificado en preview con la cuenta de test: los 4 huecos muestran "+ AÑADIR FOTO" en naranja bajo el icono de cámara, y el texto explicativo aparece sobre la rejilla. Sin errores de consola.

### 66. Modal "Cambiar tu plan" dividido en dos pasos (preferencias vs. periodicidad de pago)
La misma captura señalaba que la sección de precios (Mensual/Trimestral/Anual + "0,99€ primer mes") aparecía mezclada dentro del modal de "Cambiar objetivo/deporte", mezclando configuración funcional con decisión de compra.

- `#modalCambiarPlan` se dividió en `#cpStep1` (todas las preferencias: tipo de plan, objetivo, enfoque nutricional, deporte, días, tiempo, nivel, lugar) y `#cpStep2` (nuevo paso "Confirma tu periodicidad de pago", con el campo `cp-periodicidad`/`#cpPrecioInfo` que antes estaba mezclado en el paso 1).
- El botón final del paso 1 pasa de "Recalcular mi plan →" a "Continuar →" (`irPasoPrecioCambioPlan()`); el paso 2 añade "← Volver" (`volverPasoCambioPlan()`) y "Confirmar y recalcular →" (`guardarCambioPlan()`, sin cambios en su lógica de guardado).
- Nuevas funciones: `irPasoPrecioCambioPlan()` valida que todos los campos del paso 1 estén rellenos (si no, muestra un toast), actualiza las opciones/precio de periodicidad y muestra el paso 2; `volverPasoCambioPlan()` vuelve al paso 1 sin perder lo seleccionado. `abrirModalCambiarPlan()` ahora resetea siempre a `#cpStep1` visible / `#cpStep2` oculto al abrir el modal.

Verificado en preview con la cuenta de test: el modal abre mostrando solo las preferencias (sin precios); "Continuar →" pasa al paso de periodicidad de pago; "← Volver" regresa al paso 1 conservando la selección; "Confirmar y recalcular →" recalcula el plan y cierra el modal. Sin errores de consola.

### 67. Feedback de hora al marcar un entrenamiento como completado
La misma captura señalaba que el botón "✓ Completado" no indicaba si lo había marcado el usuario ni cuándo.

- `toggleEntrenoCompletado()` guarda ahora `userData.horaCompletado[fecha]` (hora local `HH:MM`) al marcar un entrenamiento como completado, y la elimina si se desmarca.
- `actualizarEstadoCompletado()`: cuando el entrenamiento de hoy está completado, el texto de `#entrenoCompletadoBadge` pasa de "Entrenamiento de hoy completado. Buen trabajo." a "Marcado como completado hoy a las HH:MM. Buen trabajo." si existe la hora guardada.

Verificado en preview con la cuenta de test: al pulsar "✓ Marcar como completado" el botón cambia a "✓ Completado" y el badge muestra "Marcado como completado hoy a las HH:MM. Buen trabajo.". Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### Revisión de los otros 3 puntos de la captura "ERRORES Y PROBLEMAS DETECTADOS"
- **"Scrollbar naranja huérfana"**: no se ha encontrado ningún elemento, estilo o scrollbar real en el código que coincida (la hoja de estilos solo define un scrollbar gris `var(--humo)`, global). Durante la verificación con las herramientas de preview se reprodujo una línea naranja similar, pero resultó ser un artefacto de renderizado del navegador de previsualización (apareció junto con un "tiling" completo de la página) y desapareció tras recargar; no parece un bug del código.
- **"Datos de peso incongruentes" (Press inclinado 52kg/Fondos 36kg con historial vs. Press plano/Sentadilla 2.5kg)**: la cuenta de test no tiene datos de pesos sembrados, así que esos valores son datos reales introducidos en una cuenta real al probar el nuevo selector de pesos. No es un bug de código; si se quiere, se puede limpiar/editar ese historial manualmente desde "Mi progreso".
- **"Texto gris sobre oscuro"**: revisado `.stat-card-sub` (usado en "tu meta", "tu disciplina", "de tu proceso", etc.) — su color ya es `var(--blanco-puro)` (#FFFFFF) sobre `var(--carbon)` (#141414), ratio de contraste ~21:1 (máximo). Parece ya resuelto en el código actual; si en producción se sigue viendo gris claro, puede ser caché del navegador/CDN de una versión anterior.

### 68. Ajustes de landing: jerarquía de CTAs, reseña más matizada y feature de nutrición destacada
El usuario compartió un análisis "Puntos a mejorar" de la landing con 6 observaciones.

- **Identidad de marca, tagline principal y sección "Cómo funciona la IA"**: revisados — ya están resueltos en el código actual (marca "K-ONE"/"K-One" consistente en toda la landing y el dashboard; el `<h1>` del hero ya es "No hay atajos. Hay pasos."; la sección "Cómo funciona la IA" ya usa tarjetas `.pillar-card` con icono SVG propio cada una). Probablemente el análisis se hizo sobre una versión cacheada anterior.
- **CTA "Ver demo" como acción secundaria**: nueva clase `.btn-link` (sin fondo ni borde, subrayado en `var(--humo)`, texto en `var(--metal-claro)`) aplicada al botón "Ver demo →" del hero, dejando "Empieza ahora" (`.btn-primary`) como único CTA con peso visual fuerte.
- **Reseña más matizada**: la reseña de Diego F. (calistenia) pasa de 5 a 4 estrellas y su texto ahora menciona que las primeras semanas le costó encontrar hueco y algún día no completó el entreno, antes de llegar a su primera dominada estricta — para no dar la sensación de que todas las experiencias son perfectas desde el día 1.
- **Feature "elige entre 4 opciones por comida" destacada en landing**: el `.nutrition-callout` de la sección "Tu deporte, tu plan" ahora incluye `.nutrition-callout-demo`, un mockup estático con la fila `.meal-preview-row`/`.meal-preview-pill` (las mismas clases del dashboard, item 61) mostrando 4 opciones de ejemplo para una comida, bajo la etiqueta "// Cada comida, a tu manera — elige entre 4 opciones".

Verificado en preview (escritorio 1440px y móvil 375px): el botón "Ver demo →" se ve claramente secundario sin solapar con "Empieza ahora"; la reseña de Diego F. muestra 4 estrellas y el nuevo texto; las 4 píldoras de comida se muestran en 4 columnas en escritorio y 2 en móvil sin desbordamiento horizontal. Sin errores de consola. Solo cambios de landing (sin datos de usuario), no requiere restaurar cuenta de test.

### 69. "Entrenamiento de hoy" y "Hoy" en el plan semanal ahora coinciden con el día real
El usuario reportó: "Veo que no está sincronizado las semanas, con el día de entrenamiento que te marca. Hoy es sábado y te está marcando el entrenamiento del lunes." El diseño anterior fijaba deliberadamente "Entrenamiento de hoy" y el badge "Hoy" del plan semanal al primer día del array `semana` (Lunes), independientemente del día real.

- Nueva función `getIndiceDiaHoy()`: convierte `new Date().getDay()` (0=domingo...6=sábado) al índice del array `semana` (0=Lunes...6=Domingo) con `(getDay() + 6) % 7`.
- `buildPlanFromData()`: `entrenamiento_hoy` se genera ahora a partir de `semana[getIndiceDiaHoy()]` en lugar de `semana[0]`.
- `buildDashboard()`: la etiqueta `dashWeekDay` pasa de `// Semana N · Día 1` a `// Semana N · <nombre del día real>` (p. ej. "// Semana 1 · Sábado").
- `renderWeekList()`: el badge "Hoy"/fila resaltada del plan semanal (`isToday`) usa `i === getIndiceDiaHoy()` en lugar de `i === 0`.
- `regenerarEntrenamientoHoy()` (se ejecuta al cargar el dashboard de una cuenta existente): recalcula `entrenamiento_hoy` a partir de `semana[getIndiceDiaHoy()]` en lugar de `semana[0]`, conservando la nota "Tu plan, adaptado" si existía.
- Si el día de hoy es de descanso (`tipo: "Descanso"`), "Entrenamiento de hoy" muestra ahora el resumen del día (p. ej. "Sábado — Descanso activo") con un mensaje de recuperación, y se ocultan los botones "✓ Marcar como completado" y "¿Cómo va el entreno? →" (no aplican en un día sin sesión).

Verificado en preview con la cuenta de test (hoy sábado): "Entrenamiento de hoy" muestra "Sábado — Descanso activo" con mensaje de recuperación y sin los botones de completado/feedback; en "Plan semanal", la fila de Sábado tiene el badge "Hoy" y está expandida, el resto de días no. Probado también con un plan de Gimnasio (Sábado = "Full body o cardio"): `entrenamiento_hoy` genera la sesión completa de fuerza correctamente. Sin errores de consola. Cuenta de test restaurada a su estado original tras la prueba.

### 70. Semanas contadas desde el registro + link compartible sin demo ni cuenta de test visible
El usuario pidió: (a) que las semanas de entrenamiento cuenten desde la fecha de registro del email, y (b) que al pasar el link entre clientes salte la pantalla de inicio, sin que aparezca ninguna cuenta demo.

**Semanas desde el registro (antes solo avanzaban al hacer check-in):**
- Nueva función `getSemanaActual()`: calcula el número de semana a partir de `creado` (fecha de alta del usuario en `getUsers()`), con `Math.max(1, Math.floor(díasDesdeRegistro / 7) + 1)`. Sin fecha de registro, conserva el valor guardado o 1.
- `buildDashboard()`: fija `progreso.semana = getSemanaActual()` y garantiza que `userData.progreso` exista y lleve esa semana (antes, si `userData` no tenía `progreso` —p. ej. la cuenta de test—, los hitos caían a "semana 1").
- El check-in ya no incrementa la semana con `+1`; toma `getSemanaActual()` y solo registra `diasEntrenados`/`ajuste` para adaptar el plan que viene. El resumen "Resumen de la semana N" usa `getSemanaActual()`.
- Cambiar objetivo/deporte ya no reinicia la semana a 1; usa `getSemanaActual()` (solo se reinicia `ajuste`/`diasEntrenados`/`entrenosCompletados`).
- Verificado: registro hace 0 d → Semana 1, 8 d → Semana 2, 22 d → Semana 4, 100 d → Semana 15. Las pestañas de "Plan semanal" marcan la semana actual ("Semana 4 · Actual" + futuras) y los hitos se desbloquean por calendario ("Primera semana completada" conseguido en Semana 4).

**Link compartible sin demo / sin cuenta de test a la vista:**
- Eliminado el botón "Ver demo →" del hero y la función `demoAccess()` (ya no hay acceso a un dashboard demo falso).
- Eliminado del login el recuadro "// Cuenta de testeo" con las credenciales `test@fragua.es` / `fragua123` y los `value=""` precargados de email y contraseña (los campos salen vacíos).
- La cuenta de test sigue existiendo de forma invisible (`ensureTestAccount()` en `window.onload`) para poder verificar, pero ya no se anuncia en ninguna pantalla.
- Verificado con `localStorage` vacío (simulando un cliente nuevo que abre el link): la única pantalla visible es `landing`, no hay botón de demo, `demoAccess` es `undefined`, y los campos de login salen vacíos.

Verificado en escritorio y móvil (375px) sin desbordamiento horizontal ni errores de consola. Cuenta de test restaurada a su estado original tras las pruebas.

### 71. Pesos en pasos de 1,5 kg y el +/- ya no colapsa el día en el plan semanal
El usuario pidió que los botones +/- del selector de peso sumen/resten de 1,5 en 1,5 (antes 2,5) y reportó que al pulsar "+" dentro del plan semanal la fila del día se cerraba ("se sale para atrás").

- `formatearSesion()` (plantilla del `.peso-stepper`): el `delta` de los botones pasa de `±2.5` a `±1.5`, con sus `aria-label` actualizados ("Sumar/Restar 1,5 kg").
- Causa del colapso: el clic en los botones/input se propagaba hasta el `onclick="toggleWeekDay(this)"` de `.week-day-row`, que cierra el día. Solución: `event.stopPropagation()` en `.peso-stepper` (contenedor), en cada `.peso-btn` y en el `.peso-input`, para que interactuar con el peso no plegue la tarjeta del día.

Verificado en preview con la cuenta de test: en el plan semanal, con un día expandido, pulsar "+" suma 1,5 kg (0 → 1,5 → 3) y "−" resta 1,5, y la fila permanece expandida en ambos casos. Sin errores de consola. Cuenta de test restaurada tras la prueba.

### 72. La cuenta de test ya no se siembra sola ni se reanuda al refrescar en la landing
El usuario reportó que estando en la página de inicio (landing) y pulsando refrescar, la app se metía directamente en la cuenta de testeo. Causa: `window.onload` sembraba la cuenta de test (`ensureTestAccount()`) en TODOS los navegadores y luego reanudaba cualquier sesión guardada (`fragua_current_user`), incluida la de test.

- `window.onload`: eliminada la llamada automática a `ensureTestAccount()`. La cuenta de test ya no se crea en el navegador de cada visitante; solo se siembra bajo demanda al iniciar sesión con sus credenciales (el fallback ya existente en `login()`: si el email es `test@fragua.es` y la contraseña `fragua123`, se llama a `ensureTestAccount()`).
- `window.onload`: nuevo guardado — si la sesión almacenada es la cuenta de test (`user.email === TEST_EMAIL`), no se reanuda; se hace `clearCurrentUser()` y se va a `landing`. Las cuentas reales sí siguen reanudando su sesión al refrescar (UX normal).

Verificado en preview: (1) con sesión de test guardada, al recargar se muestra `landing` y la sesión queda limpia (`fragua_current_user` = null); (2) el login de test (`test@fragua.es` / `fragua123`) sigue funcionando desde cero y entra al dashboard (Semana 1); (3) una cuenta real de ejemplo con plan guardado sí reanuda en el dashboard al refrescar. Sin errores de consola. Estado de pruebas limpiado tras la verificación.

### 73. Página legal (Aviso legal + Privacidad RGPD + Términos + Cookies) y disclaimer médico
A raíz del análisis de producto, se añade la capa legal obligatoria (se recogen datos de salud — categoría especial art. 9 RGPD — sin base legal documentada).

- Nueva pantalla `#legal` (`goTo('legal')`) con:
  - **Aviso de salud destacado** arriba (banner `.legal-disclaimer`): no es consejo médico, consultar antes de empezar, parar si hay dolor/mareo.
  - **1. Aviso legal** (LSSI-CE): datos del titular con placeholders `[NOMBRE/RAZÓN SOCIAL]`, `[NIF/CIF]`, `[DIRECCIÓN FISCAL]`, `[EMAIL DE CONTACTO]` (7 en total, marcados con `.legal-placeholder`, pendientes de rellenar por el usuario).
  - **2. Política de privacidad (RGPD/LOPDGDD)**: responsable, datos tratados (incluida categoría especial de salud), finalidad, base jurídica (ejecución de contrato + consentimiento explícito art. 9.2.a), conservación, destinatarios/encargados, derechos ARCO+RGPD y reclamación ante la AEPD, seguridad (con nota honesta de que en esta fase los datos viven en el localStorage del navegador).
  - **3. Términos y condiciones**: objeto, registro, precios/prueba 0,99€, cancelación sin permanencia, exención de responsabilidad, modificaciones.
  - **4. Cookies**: actualmente sin cookies de seguimiento, solo localStorage técnico.
- Navegación: enlaces nuevos en el `footer` (Aviso legal / Privacidad / Términos) y `nav` interno con scroll a cada sección. Funciones `goToLegal(seccion)` (abre y salta) y `scrollToLegal(id)`.
- La casilla de términos del registro ahora enlaza a las secciones reales (`goToLegal('terminos')` / `goToLegal('privacidad')`) y menciona explícitamente el consentimiento para tratar datos de salud.
- CSS nuevo: `.footer-links`, bloque `.legal-*` (wrap, back, h1, disclaimer, nav, section, placeholder), usando `Bebas Neue` (display real del sitio) y las variables de color existentes.

Verificado en preview (escritorio y móvil 375px): la pantalla abre desde footer y desde la casilla de registro, las 4 secciones existen y el scroll funciona, el disclaimer se muestra arriba, sin desbordamiento horizontal ni errores de consola.

**Pendiente del usuario:** rellenar los 7 placeholders con los datos reales del titular (nombre/razón social, NIF, dirección fiscal y email de contacto) antes de operar de cara al público.

### 74. Fase 1 de la migración a Supabase: cuentas y datos reales en la nube
Hasta ahora todo (usuarios, contraseñas, cuestionario, plan, progreso) vivía solo en el `localStorage` del navegador de cada cliente: no había forma de ver quién se registraba ni qué plan tenía. Se ha conectado la app a un proyecto real de Supabase (Postgres + Auth) manteniendo toda la interfaz y el comportamiento igual.

- **SDK y conexión**: añadido `@supabase/supabase-js@2` por CDN y `const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` con las credenciales del proyecto "K-one" (`sb_publishable_...`, segura para el navegador gracias a RLS).
- **Esquema** (`supabase/schema.sql`, ejecutado por el usuario en el SQL Editor): tabla `profiles` (`id` = usuario de Auth, `nombre`, `email`, `userdata` jsonb, `plan` jsonb, `saved_at`) con RLS (cada usuario solo ve/edita su fila), trigger que crea automáticamente el perfil al registrarse, tabla `subscriptions` (preparada para Stripe, Fase 2) y vista `admin_clientes` (perfil + suscripción + objetivo/deporte/lesión/alergia/semana actual/entrenos completados/hitos) consultable desde el Table Editor de Supabase.
- **Capa de datos reescrita** (`getCurrentUser`/`setCurrentUser`/`getUserData`/`saveUserData` mantienen la misma firma, ahora respaldadas por Supabase):
  - `registrar()` y `login()` usan `supabase.auth.signUp` / `signInWithPassword`. `logout()` cierra sesión en Supabase.
  - `saveUserData()` sigue cacheando en `localStorage` para acceso instantáneo y además sincroniza en segundo plano `userdata`/`plan`/`saved_at` en la tabla `profiles`.
  - Nueva `syncProfileFromSupabase()` rellena las cachés locales tras login/registro/recarga de página.
  - `userData._cuenta = {creado, suscripcionActiva, fechaPago}` sustituye al antiguo "almacén de usuarios" local (`getUsers`/`saveUsers`/`hashPassword`, eliminados) para el estado de la suscripción/mes de prueba.
  - `ensureTestAccount()` ahora crea/inicia sesión con `test@fragua.es` en Supabase Auth y siembra su plan de ejemplo si no existe.
- **Recuperación de contraseña real por email**: el modal "Recuperar acceso" ahora llama a `supabase.auth.resetPasswordForEmail()` (mensaje genérico, sin confirmar si el email existe); al volver desde el enlace del correo, `onAuthStateChange('PASSWORD_RECOVERY')` abre el modal en el paso de elegir nueva contraseña, que se guarda con `supabase.auth.updateUser()`.
- **Configuración de Supabase** (hecha por el usuario): desactivado "Confirm email" en Authentication para que el registro siga siendo instantáneo, igual que antes.

Verificado en preview (localhost:8080): login de la cuenta de test funciona y su perfil/plan se sincronizan en `profiles` (incluido `_cuenta.suscripcionActiva: true`); registro de un usuario nuevo crea su fila en `auth.users` y `profiles` automáticamente (vía trigger) y entra directo al cuestionario; al recargar la página se restaura la sesión desde Supabase y vuelve a la pantalla correcta. Sin errores de consola.

**Nota**: durante la verificación se creó un usuario de prueba (`prueba_...@fragua.es`) en Supabase Auth; se puede borrar desde Authentication → Users si se quiere limpiar.

### 75. Mensaje de error correcto si falla el login de la cuenta de test
Revisión de la capa de autenticación: si `ensureTestAccount()` fallaba por cualquier motivo (p. ej. error de red), `login()` mostraba el mensaje "Email no encontrado" bajo el campo de email, que era engañoso (el problema no era que el email no existiera).

- `login()`: en el `catch` de la rama de la cuenta de test, ahora se muestra `showToast('No se pudo iniciar sesión con la cuenta de test: ' + e.message, 5000)` en lugar de marcar el campo de email como erróneo.

Verificado en preview: login de la cuenta de test sigue entrando correctamente al dashboard tras recargar, sin errores nuevos en consola.

### 76. Eliminado "Fragua" de toda la app: ahora todo es K-ONE
El usuario pidió que el nombre "Fragua" no aparezca en ningún sitio (interfaz, URL, código interno), solo "K-ONE".

- **URL de producción**: `fragua-fitness.html` pasa a ser `index.html` (la home del sitio, `https://k-one-six.vercel.app/`). El antiguo `fragua-fitness.html` ahora es una página de redirección a `/` para no romper enlaces antiguos compartidos. `serve.ps1` (servidor de preview local) actualizado para servir `index.html` en la raíz.
- **Caja visible de credenciales de test** en la pantalla de login (con `test@fragua.es` / `fragua123` a la vista de cualquier visitante) — eliminada por completo.
- **Claves de `localStorage`** renombradas con prefijo `k1_`: `fragua_current_user` → `k1_current_user`, `fragua_data_<email>` → `k1_data_<email>`, `fragua_leads` → `k1_leads`, `fragua_storage_test` → `k1_storage_test` (diagnóstico de `window.onload`).
- **Cuenta de test**: nuevas credenciales `test@k-one.es` / `kone123` (antes `test@fragua.es` / `fragua123`), creada en Supabase Auth desde la propia app (flujo normal de `ensureTestAccount()`/`signUp`, sin usar claves privadas). `supabase/schema.sql` actualizado con las nuevas credenciales en sus comentarios.
- **Código muerto eliminado**: ~10 comprobaciones `user.email !== 'demo@fragua.es'` (una cuenta `demo@fragua.es` que nunca existió) que envolvían las llamadas a `saveUserData()`; simplificadas a `if (user) {` o eliminadas donde `user` ya era no-nulo.

Verificado en preview (`http://localhost:8080/`): la home carga como `index.html`, login con `test@k-one.es` / `kone123` crea la cuenta en Supabase y entra al dashboard, la sesión persiste al recargar, las claves de `localStorage` son `k1_current_user` y `k1_data_test@k-one.es` (sin ninguna clave `fragua_*`), y la pantalla de login ya no muestra la caja de credenciales de test. Sin errores de consola.

**Nota**: la antigua cuenta `test@fragua.es` sigue existiendo en Supabase Auth; se puede borrar desde Authentication → Users si se quiere limpiar.

### 77. Vuelve la caja de credenciales de test en el login (solo para testeo)
A petición del usuario, se restaura la caja "// Cuenta de testeo" en la pantalla de login (eliminada en el punto 76), ahora con las credenciales nuevas (`test@k-one.es` / `kone123`), para facilitar las pruebas mientras se sigue desarrollando.

### 78. Fase 2 de Stripe: cobros reales para la suscripción
Se conecta el paywall de fin de mes de prueba a Stripe (modo suscripción), siguiendo el reparto de tareas: el código vive en el repo, las claves y productos de Stripe se configuran en Vercel/Stripe (no en el HTML).

- **`package.json`** (nuevo, raíz): dependencias `stripe` y `@supabase/supabase-js` para las funciones serverless de Vercel (`api/`).
- **`api/_stripeHelpers.js`**: utilidades comunes — cliente de Stripe, cliente de Supabase con `service_role` (solo en el servidor), validación del usuario a partir del token de sesión de Supabase, y el mapeo de `(tipoPlan, periodicidad)` → Price ID de Stripe vía variables de entorno.
- **`api/create-checkout-session.js`**: valida la sesión del usuario, crea (o reutiliza) su `customer` de Stripe, y crea una Checkout Session de suscripción para el plan/periodicidad elegidos; devuelve la URL de pago.
- **`api/stripe-webhook.js`**: verifica la firma de Stripe y, en `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`, hace `upsert` en `public.subscriptions` (estado, `current_period_end`, ids de Stripe) con la `service_role key`.
- **`api/create-portal-session.js`**: abre el Portal de Clientes de Stripe (cambiar método de pago, cambiar plan o cancelar) para el `customer` del usuario.
- **Frontend** (`index.html`):
  - `confirmarPagoSuscripcion()` (modal de fin de prueba) ya no simula el pago: ahora pide una Checkout Session a `/api/create-checkout-session` (con el token de Supabase) y redirige a Stripe.
  - `syncProfileFromSupabase()` ahora también lee `public.subscriptions` (RLS: cada usuario ve solo la suya); si `status` es `active` o `trialing`, `suscripcionActiva = true` (se combina con el flag local `_cuenta.suscripcionActiva` que sigue usando la cuenta de test).
  - Al volver de Stripe (`/?checkout=exito` o `/?checkout=cancelado`), se limpia la URL, se vuelve a sincronizar el perfil y se muestra un aviso.
  - Nuevo botón "Gestionar suscripción" en el menú lateral del dashboard → `gestionarSuscripcion()` → `/api/create-portal-session`.
- `.gitignore`: añadido `node_modules/`.

**Pendiente del usuario, imprescindible para que funcione en producción** (nada de esto se prueba en el preview local, que es solo HTML estático — requiere despliegue en Vercel):
1. En el [Dashboard de Stripe](https://dashboard.stripe.com) (modo *test* para probar primero): crear un producto "K-ONE" con 4 precios recurrentes:
   - Plan completo mensual → 14,99€/mes
   - Plan completo trimestral → 35,99€/3 meses
   - Plan completo anual → 99,99€/año
   - Solo nutrición mensual → 6,99€/mes
   - Pasarme los 4 **Price ID** (`price_...`).
2. Copiar la **clave secreta** de Stripe (`sk_test_...` en modo test).
3. En Supabase → Project Settings → API: copiar la **`service_role` key** (secreta, nunca va en el HTML).
4. En Vercel → Settings → Environment Variables, añadir:
   - `STRIPE_SECRET_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_PRICE_COMPLETO_MENSUAL`, `STRIPE_PRICE_COMPLETO_TRIMESTRAL`, `STRIPE_PRICE_COMPLETO_ANUAL`, `STRIPE_PRICE_NUTRICION_MENSUAL`
5. Desplegar (push a `main` ya dispara el deploy). Una vez desplegado, en Stripe → Developers → Webhooks: crear un endpoint a `https://k-one-six.vercel.app/api/stripe-webhook` para los eventos `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, y copiar su **Signing secret** (`whsec_...`) a Vercel como `STRIPE_WEBHOOK_SECRET` (y volver a desplegar para que la función lo recoja).
6. Activar el **Portal de Clientes** de Stripe (Settings → Billing → Customer portal) para que `api/create-portal-session.js` funcione.

**No probado end-to-end todavía** (requiere los pasos anteriores + despliegue): el flujo de Checkout, el webhook y el Portal de Clientes. Una vez configurado, probar con la tarjeta de test `4242 4242 4242 4242` desde una cuenta real (no la de test, que ya tiene `suscripcionActiva` forzado).

### 79. Los clientes "Solo nutrición" ya pueden cambiar de plan (antes quedaban atrapados)
El usuario reportó que en una cuenta real ("ree") no aparecían ni la sección "Hoy" ni el plan semanal. Diagnóstico: **no es un fallo** que falte el entrenamiento — esa cuenta se registró con el plan "Solo nutrición, sin entrenamiento", y el dashboard oculta a propósito las pestañas Hoy / Plan semanal / Check-in para esos planes (abre directo en Nutrición).

**El fallo real encontrado**: el único botón para cambiar de plan ("Cambiar objetivo / deporte") vivía dentro de la sección "Hoy", que está oculta para los planes solo-nutrición. Resultado: un cliente de solo-nutrición no tenía forma de volver al plan completo (con entrenamiento) ni de cambiar nada — quedaba atrapado.

- `index.html`: nuevo botón "Cambiar plan / añadir entrenamiento" (`#nutriCambiarPlan`) en la cabecera de la sección Nutrición, que llama a `abrirModalCambiarPlan()`.
- `buildDashboard()`: el botón solo se muestra cuando el plan es solo-nutrición (`generatedPlan.soloDieta`); en planes completos queda oculto (esos ya tienen el botón en "Hoy").

Verificado en preview reproduciendo el caso (forzando `tipoPlan: 'Solo nutrición, sin entrenamiento'`): con solo-nutrición se ocultan Hoy/Semana/Check-in, se abre en Nutrición y aparece el nuevo botón; al cambiar a plan completo desde ese botón, reaparecen las pestañas de entrenamiento y el botón se oculta. Sin errores de consola. Cuenta de test restaurada tras la prueba.

### 80. "Solo nutrición": se recupera la pestaña "Hoy" (solo se oculta el entrenamiento semanal)
Tras el punto 79, el usuario aclaró el comportamiento deseado: en un plan "Solo nutrición" **sí** quiere ver la pestaña **"Hoy"** (resumen/motivación: mensaje del día, objetivo, racha, días restantes y el botón de cambiar plan), y lo único que no debe aparecer es **"Planning" / plan semanal** (el entrenamiento), porque no hay entrenamiento. El punto 79 ocultaba "Hoy" de más.

- `buildDashboard()` (`index.html`): para `generatedPlan.soloDieta` ahora solo se ocultan `nav-semana` (Planning) y `nav-checkin`; `nav-hoy` y `nav-nutricion` quedan visibles. Si al recalcular el plan la sección activa era una de entrenamiento que se acaba de ocultar (`section-semana`/`section-checkin`), se redirige a "Hoy" en lugar de a Nutrición.

Verificado en preview (plan solo-dieta forzado, partiendo de la sección "Semana" activa): queda visible Hoy + Nutrición, ocultos Semana y Check-in, y la vista cae correctamente a "Hoy". Sin errores de consola.

### 81. Foto de perfil del usuario
Antes el avatar del sidebar solo mostraba la inicial del nombre y no se podía cambiar. Ahora cada usuario puede ponerse su foto.

- `index.html` (markup): el avatar (`#userAvatar`) es clicable y abre un `<input type="file" accept="image/*">` oculto (`#fotoPerfilInput`); lleva un badge de cámara (`.avatar-cam`) y la inicial pasa a un `<span id="userAvatarLetter">`.
- `subirFotoPerfil(event)`: valida que sea imagen (y < 12 MB), la recorta a un cuadrado centrado de **256×256** y la exporta a **JPEG calidad 0,8** vía canvas (≈4-6 KB en base64), la guarda en `userData.fotoPerfil` y persiste con `saveUserData` (→ localStorage + `profiles.userdata` jsonb de Supabase). No requiere cambios de esquema: viaja dentro del blob `userData` que ya se guarda/recarga.
- `aplicarAvatarPerfil()`: pinta el avatar con la foto guardada (clase `has-photo`, `background-image`) o, si no hay, con la inicial del nombre/objetivo. Sustituye los 3 puntos donde antes se fijaba la inicial a mano (login, `buildDashboard`, `loadUserDashboard`).
- CSS: `.user-avatar` con `background-size:cover`, cursor pointer, badge de cámara que se intensifica en hover; `.user-avatar.has-photo #userAvatarLetter{display:none}`.

Verificado en preview: con foto se aplica `has-photo` + `background-image` y se oculta la inicial; sin foto vuelve a la inicial; el flujo real con un archivo de imagen sintético redimensiona a 256×256, produce JPEG y lo persiste. Sin errores de consola.

## Notas técnicas del entorno
- No hay Node.js, Python ni WSL instalados en esta máquina — para verificar JS/servir archivos hay que usar PowerShell puro (HttpListener, etc.) o el navegador.
- Claude in Chrome (extensión) no está conectada en esta sesión — no se pudo usar automatización de navegador.
- Para inspeccionar vídeos (p. ej. capturas de WhatsApp) sin ffmpeg/VLC instalados, se puede extraer un frame con PowerShell usando `System.Windows.Media.MediaPlayer` + `RenderTargetBitmap` dentro de un `DispatcherTimer`/`Dispatcher.Run()` (WPF, requiere hilo STA).
