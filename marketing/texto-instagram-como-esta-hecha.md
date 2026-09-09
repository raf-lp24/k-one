# Reel · Cómo funciona K-ONE

Archivo: `marketing/kone-como-esta-hecha.mp4` — 1080×1920, 37 s, sin audio
(la música se le pone desde el propio Instagram al publicar).

Tercero de la serie. El de novedades anuncia, el tutorial enseña a instalar, y
este responde a la pregunta que sale en comentarios tarde o temprano: *¿esto
quién lo hace y de dónde sale?*

**Registro: serio.** Está escrito para poder enseñárselo a alguien y que se lo
tome en serio, no como un clip de broma. Frases declarativas, sin
coloquialismos y sin hablarle de tú a tú al espectador.

---

## Pie de publicación

**Opción A — la del feed**

Cómo funciona K-ONE.

**Construcción.** La plataforma, el recetario y las fichas de ejercicio se han
desarrollado con inteligencia artificial. Se declara de forma expresa.

**Base de datos propia.** 386 alimentos con sus macronutrientes, 345 opciones
de comida con sus pasos de preparación y 300 fichas de ejercicio, 179 de ellas
con fotografía. Las calorías de cada plato se calculan ingrediente a
ingrediente sobre esa base.

**Metodología.** Cálculo calórico mediante Mifflin-St Jeor. Periodización del
entrenamiento en bloques de cuatro semanas con su descarga. Filtrado por
lesiones y alergias declaradas. Metodología pública y documentada: no se
reproduce el programa de ningún entrenador.

**Personalización.** Edad, peso, altura, objetivo, disponibilidad y deporte
determinan la estructura del plan: gimnasio, running o híbrido, y modalidad de
solo nutrición para quien ya entrena en CrossFit o Hyrox.

**Soporte.** Las consultas recibidas se leen y se responden de forma
individual, sin respuestas automáticas. Plazo habitual: menos de 24 horas.

**Alcance.** K-ONE no sustituye a un médico ni a un dietista-nutricionista.
Ante cualquier duda de salud, debe consultarse con un profesional sanitario.

k-one.fit — primer mes gratuito, sin permanencia.

---

**Opción B — corta, para Stories**

Cómo funciona K-ONE.

386 alimentos, 345 opciones de comida y 300 fichas de ejercicio.
Cálculo calórico con Mifflin-St Jeor, periodización en bloques de cuatro
semanas y filtrado por lesiones y alergias.

Consultas respondidas de forma individual, en menos de 24 horas.

No sustituye a un médico ni a un dietista-nutricionista.

k-one.fit

---

## Hashtags

#kone #entrenamiento #nutricion #entrenamientopersonalizado
#dietapersonalizada #azuqueca #guadalajara #fitness #transparencia
#perdergrasa #ganarmusculo #appfitness

## Notas de honestidad (no publicar, para ti)

Comprobado en el código antes de escribir el guion:

- **Las cifras están contadas, no redondeadas al alza**: 386 claves en
  `data/alimentos.json`, 345 opciones repartidas en las 15 tomas del
  recetario, 300 fichas en `data/ejercicios-info.json` y 179 archivos en
  `data/ej-img/`.
- **No se dice "información de otros entrenadores"** aunque salió en la
  conversación. En público eso suena a haber copiado el programa de alguien.
  Lo que se ha usado es metodología pública y estándar, y el vídeo lo afirma
  explícitamente: *"no se reproduce el programa de ningún entrenador"*.
- **Sobre la IA**: el vídeo dice que la app está construida con IA, que es
  cierto. Lo que NO dice es que el plan lo genere una IA cada vez, porque no
  es verdad: en todo el código no hay una sola llamada a ningún modelo, y
  `buildPlanFromData` no hace ni una petición de red. El plan lo calcula un
  motor de reglas en el propio móvil del cliente.
- **El soporte individual** es verificable: cada mensaje y cada opinión llegan
  al panel de administración y los responde una persona.
- **El aviso de alcance** es el mismo que ya está en la web (sección de
  pilares y FAQ). Se repite en el vídeo a propósito.

## Cómo se hizo

`marketing/fuentes-como-esta-hecha/` lleva los rótulos (`quienes.html`,
1080×1920, animación dirigida por `render(t)`) y el script de montaje
(`montar-quienes.sh`). El fondo son los mismos dos planos generados que los
otros dos reels, ralentizados ×3,75: aquí hay cifras y fichas que leer.
