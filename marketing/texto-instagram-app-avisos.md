# Reel · K-ONE ya es una app (novedades: pantalla de inicio + avisos)

Archivo: `marketing/kone-app-avisos.mp4` — 1080×1920, ~21 s, sin audio
(la música se le pone desde el propio Instagram al publicar).

---

## Pie de publicación

**Opción A — directa**

K-ONE ya se instala en tu móvil. 📲

Sin pasar por ninguna tienda de apps: entras a k-one.fit, la añades a la
pantalla de inicio y la abres como una app más.

Y desde ahí te avisa. Solo los días que no hayas marcado ningún entreno, a
media mañana. Ni spam ni notificaciones de relleno — y se apagan desde tu
menú cuando quieras.

Primer mes gratis. Sin permanencia.

👉 k-one.fit

---

**Opción B — más corta, para Stories o si prefieres poco texto**

Novedad: K-ONE ya se añade a tu pantalla de inicio y te avisa en el móvil
los días que no has entrenado.

Sin descargar nada. Sin permanencia. Primer mes gratis.

k-one.fit

---

## Cómo se instala (por si alguien pregunta en comentarios)

- **iPhone (Safari):** compartir → «Añadir a pantalla de inicio».
  En iPhone los avisos SOLO funcionan con la app añadida a la pantalla de
  inicio; es una limitación de Apple, no de K-ONE.
- **Android (Chrome):** sale solo un aviso de «Instalar app», o desde el menú
  de tres puntos → «Instalar aplicación».

## Hashtags

#kone #entrenamiento #nutricion #fitness #rutinapersonalizada #azuqueca
#guadalajara #entrenamientopersonalizado #dietapersonalizada #gimnasio
#perdergrasa #ganarmusculo

## Notas de honestidad (no publicar, para ti)

- Las capturas del vídeo son de la web real, no maquetas: el banner de
  instalar, el de avisos y el interruptor del menú están tal cual salen.
- El texto del aviso que se ve en el vídeo («K-ONE · Lunes / Tu plan de hoy
  te está esperando.») es literalmente uno de los que manda el cron de
  `api/notify.js`, no un texto inventado para el anuncio.
- «Primer mes gratis» sigue siendo cierto (Stripe, trial de 30 días).

## Cómo se hizo (para rehacerlo)

`marketing/fuentes-app-avisos/` lleva los rótulos (`slides.html`, 1080×1920,
un slide por `?s=N`) y el script de montaje (`montar.sh`). Las capturas de la
app salen de Chrome headless por CDP con emulación de móvil — ver la nota
`project_kone_capturas_demo_reales` en la memoria.

Gotcha del montaje: `zoompan` emite `d` fotogramas **por cada fotograma de
entrada**. Con `-loop 1 -t 4` la entrada ya son 100, así que `d=100` daba
10.000 y un vídeo de 523 s en vez de 21. La entrada tiene que ser una sola
imagen, sin `-loop`.

## v2 — con fondo generado (8 sept)

El vídeo se rehizo con fondo de vídeo en vez de degradado plano:

- **Dos planos generados con Higgsfield** (`seedance_2_0_mini`, 9:16, 5 s, 720p,
  12,5 créditos cada uno): gimnasio industrial de noche con un haz de luz y
  polvo de magnesio, y calle mojada de madrugada con farolas naranjas.
  Sin personas, sin texto y sin marcas ajenas a propósito. Están en
  `fuentes-app-avisos/bg-gimnasio.mp4` y `bg-calle.mp4`.
- Se ralentizan ×2,3, se oscurecen y se desenfocan: el fondo da atmósfera, no
  compite con el texto.
- Los rótulos ya no son imágenes fijas: se renderizan **con canal alfa**
  (`anim-overlay.html`) fotograma a fotograma y se superponen. Los textos
  entran escalonados desde detrás de una máscara, y el interruptor de avisos
  **se enciende solo** cruzando dos capturas reales (apagado → encendido).

Gotchas que costaron un render cada uno:
- La máscara de línea (`overflow:hidden`) recorta también lo que sobresale por
  ARRIBA: en Bebas Neue la tilde de una mayúscula pasa de la altura de caja, y
  salía «MOVIL» y «NUTRICION» sin acento. Se arregla con
  `padding-top:.20em; margin-top:-.20em` en la línea.
- Para capturar con transparencia hay que llamar a
  `Emulation.setDefaultBackgroundColorOverride` con alfa 0 **y volver a
  aplicarlo después de `Page.navigate`**, o Chrome pinta blanco debajo.
