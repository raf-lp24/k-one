# Reel · Cómo está hecha K-ONE (quiénes somos / cómo funciona)

Archivo: `marketing/kone-como-esta-hecha.mp4` — 1080×1920, 37 s, sin audio
(la música se le pone desde el propio Instagram al publicar).

Es el tercero de la serie. El de novedades anuncia, el tutorial enseña a
instalar, y este responde a la pregunta que va a salir en comentarios tarde o
temprano: *¿y esto quién lo hace y de dónde sale?*

---

## Pie de publicación

**Opción A — la larga, para el feed**

¿Y esto quién lo hace?

Te lo cuento sin adornos: K-ONE está hecha con IA. La web, el recetario y las
fichas de ejercicio se han construido con inteligencia artificial. No lo
escondo — es lo que ha permitido montar en meses algo que de otra forma
habría costado años.

Pero lo que hay dentro no es humo:
· 386 alimentos con sus macros
· 345 opciones de comida, cada una con sus pasos
· 300 fichas de ejercicio, 179 con foto

Y el criterio no me lo he inventado: tus calorías salen de Mifflin-St Jeor,
que es la fórmula estándar; el entreno va en bloques de 4 semanas con su
descarga; y tus lesiones y alergias filtran de verdad — lo que te afecta no
aparece en tu plan.

No es el plan de ningún entrenador copiado. Es método conocido, aplicado a
tus datos.

Según tu edad, tu peso, tu objetivo y tu deporte, el sistema monta una cosa u
otra: gimnasio, running, híbrido, o solo nutrición si ya entrenas en tu box
de CrossFit o Hyrox.

Y detrás hay alguien: los mensajes que entran por Contacto los leo y los
contesto yo, uno a uno.

Lo que NO es: K-ONE no sustituye a un médico ni a un dietista-nutricionista.
Ante cualquier duda de salud, consulta con un profesional.

👉 k-one.fit · primer mes gratis, sin permanencia

---

**Opción B — corta, para Stories**

¿Quién hay detrás de K-ONE?

Está hecha con IA, y no lo escondo. Dentro hay 386 alimentos, 345 comidas y
300 fichas de ejercicio. El criterio es método estándar: Mifflin-St Jeor,
bloques de 4 semanas, filtros de lesión y alergia.

Y los mensajes los contesto yo.

k-one.fit

---

## Hashtags

#kone #entrenamiento #nutricion #entrenamientopersonalizado
#dietapersonalizada #azuqueca #guadalajara #fitness #transparencia
#perdergrasa #ganarmusculo #appfitness

## Notas de honestidad (no publicar, para ti)

Esto es lo que se comprobó en el código antes de escribir el guion, para que
todo lo que dice el vídeo sea verificable:

- **Las cifras están contadas, no redondeadas al alza**: 386 claves en
  `data/alimentos.json`, 345 opciones repartidas en las 15 tomas del
  recetario, 300 fichas en `data/ejercicios-info.json` y 179 archivos en
  `data/ej-img/`.
- **No se dice "información de otros entrenadores"** aunque salió en la
  conversación. Decir eso en público suena a haber copiado el programa de
  alguien. Lo que se ha usado es metodología pública y estándar, y así se
  cuenta: Mifflin-St Jeor, periodización por bloques, macros por objetivo.
  Además el vídeo lo dice explícitamente: *"no es el plan de ningún
  entrenador copiado"*.
- **Sobre la IA**: el vídeo dice que la app está hecha con IA, que es cierto.
  Lo que NO dice es que tu plan lo genere una IA cada vez, porque no es
  verdad: en todo el código no hay una sola llamada a ningún modelo, y
  `buildPlanFromData` no hace ni una petición de red. El plan lo calcula un
  motor de reglas en el propio móvil del cliente. Es a la vez más honesto y
  mejor argumento.
- **"Si escribes, te contesto yo"** es cierto y verificable: cada mensaje y
  cada opinión llegan al panel de administración y los contesta una persona.
- **El aviso de que no sustituye a un médico ni a un dietista-nutricionista**
  es el mismo que ya está en la web (sección de pilares y FAQ). Se repite en
  el vídeo a propósito.

## Cómo se hizo

`marketing/fuentes-como-esta-hecha/` lleva los rótulos (`quienes.html`,
1080×1920, animación dirigida por `render(t)`) y el script de montaje
(`montar-quienes.sh`). El fondo son los mismos dos planos generados que los
otros dos reels, ralentizados ×3,75: aquí hay cifras y fichas que leer, así
que el fondo estorba aún menos.
