# Auditores del recetario, los alimentos y el entrenamiento

Scripts de comprobación que se pueden volver a pasar cada vez que se toca la
nutrición. Todos se ejecutan con `node scripts/<archivo>` desde la raíz del
proyecto y no modifican nada: solo miden y avisan.

| Script | Qué comprueba |
|---|---|
| `auditar-alimentos.js` | Los alimentos uno por uno: macros que quepan en 100 g, que la fibra no supere a los hidratos, que las kcal cuadren con 4p+4c+9g descontando fibra, plausibilidad por categoría y duplicados con valores distintos. |
| `auditar-coherencia.js` | Que ningún plato de comida o cena esté colocado en desayuno, media mañana o merienda; ingredientes grasos o de bollería por rama; y nombres que prometen algo que la receta no lleva (una "César" sin salsa César). |
| `auditar-salsas.js` | Todas las salsas del recetario y si están marcadas como caseras o 0%. Regla: si el plan recomienda una salsa, o es cero o es casera. |
| `auditar-grasas.js` | Reparto de grasa por plato y fibra del día tipo, por rama. Ojo al interpretarlo: un plato con mucha grasa no es malo si la grasa es buena (salmón, frutos secos, aguacate, AOVE). |
| `auditar-reparto.js` | Reparto de calorías y proteína entre tomas y presencia de verdura, por rama. En déficit la comida debe pesar más que la cena. |
| `medir-pools.js` | Cuántas opciones tiene cada (rama × toma). Sirve para saber qué pool está más corto antes de ampliar a ciegas. |
| `auditar-rotacion.js` | **Entrenamiento.** La tabla de rotación de ejercicios: que cada alternativa trabaje el mismo músculo, con el mismo patrón de movimiento y medida en la misma unidad que el ejercicio al que sustituye. Avisa también de reglas muertas (ejercicios que ya no escribe ninguna plantilla). |
| `validar-recetas.js` | Reimplementa "Ver macros": qué % de frases de ingrediente resuelven contra `alimentos.json` y cuánto se desvían las kcal declaradas de lo que suman los ingredientes. |

`componer.js` y `cant-defecto.js` son auxiliares: el primero genera la línea
`op(...)` de una receta con los macros **calculados de sus ingredientes** en
vez de escritos a mano, y el segundo extrae `CANT_DEFECTO` de `index.html`
para que los auditores midan el mismo texto que ve el cliente.

## Por qué están aquí

Estos auditores nacieron de fallos reales que llegaron a producción: una
"Ensalada César" en un plan de pérdida de grasa, huevos poché con espárragos
puestos como desayuno, el mismo producto con dos valores distintos en la
tabla, y salsas sin especificar si eran de bote. Pasarlos antes de tocar la
nutrición evita que vuelvan.

## El auditor de rotación

`auditar-rotacion.js` nació igual que los demás: de fallos reales repetidos. La
rotación cambia el NOMBRE de un ejercicio por el de otro sin mirar el resto de la
frase, y de ahí salieron, uno detrás de otro, un peso muerto rumano convertido en
hip thrust (isquios a 0,9 series por semana), una plancha convertida en "Rueda
abdominal 3x30s", unos A-skips convertidos en "Comba 3x20m" y un complejo que
decía "8 RDL + 8 Peso muerto rumano" (el mismo ejercicio dos veces). Todos son el
mismo error de fondo, así que se comprueban de una vez y automáticamente.

Si el script marca un cambio que de verdad está justificado, se añade a la lista
`ACEPTADAS` **con su motivo escrito**. Esa lista es la documentación de por qué se
acepta cada excepción: sin motivo, no es una excepción, es un fallo.
