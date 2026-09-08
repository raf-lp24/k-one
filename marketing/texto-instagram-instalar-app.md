# Reel · Cómo añadir K-ONE a la pantalla de inicio (iPhone y Android)

Archivo: `marketing/kone-instalar-app.mp4` — 1080×1920, ~28,5 s, sin audio
(la música se le pone desde el propio Instagram al publicar).

Es el tutorial que acompaña al reel de novedades (`kone-app-avisos.mp4`):
aquel anuncia que ya se puede instalar y que llegan avisos, y este enseña
cómo se hace, que es lo que la gente pregunta en comentarios.

---

## Pie de publicación

**Opción A — la que iría con el tutorial**

Cómo poner K-ONE en tu pantalla de inicio 📲

**iPhone (Safari)**
1. Abre k-one.fit
2. Toca Compartir (abajo en el centro)
3. Baja y toca «Añadir a pantalla de inicio»
4. Confirma en «Añadir»

**Android (Chrome)**
1. Abre k-one.fit
2. Toca los tres puntos (arriba a la derecha)
3. Toca «Instalar app» y confirma
   · A veces Chrome te lo ofrece solo al entrar: si ves «Instalar ahora», con eso basta.

Desde ahí se abre como una app y te llegan los avisos de entreno.
Ojo iPhone: los avisos SOLO funcionan con la app añadida a la pantalla de
inicio — es una limitación de Apple, no nuestra.

👉 k-one.fit · primer mes gratis, sin permanencia

---

**Opción B — corta, para Stories**

📲 Cómo instalar K-ONE en tu móvil:

iPhone → Compartir → «Añadir a pantalla de inicio»
Android → ⋮ → «Instalar app»

Sin tiendas de apps. Y así te llegan los avisos de entreno.

k-one.fit

---

## Hashtags

#kone #entrenamiento #nutricion #fitness #rutinapersonalizada #azuqueca
#guadalajara #entrenamientopersonalizado #dietapersonalizada #appfitness
#pwa #perdergrasa #ganarmusculo

## Notas de honestidad (no publicar, para ti)

- Los pasos son los que de verdad tiene la web. El texto coincide con el que
  muestra el propio banner de instalación de `index.html`: en iOS «Toca
  Compartir y luego "Añadir a pantalla de inicio"», y en Android «Toca ⋮ y
  luego "Instalar app"», con el atajo «Instalar ahora» cuando Chrome dispara
  el evento `beforeinstallprompt`.
- Los iconos de los pasos son dibujos propios en el estilo de K-ONE, no
  capturas de la interfaz de Apple ni de Google. La captura del móvil del
  paso 0 sí es de la web real.
- El icono que se ve en la escena final es el icono real de la app
  (`icon-512.png` del manifiesto), no una maqueta.
- Lo de «en iPhone los avisos solo funcionan con la app instalada» es cierto:
  Safari solo expone `PushManager` en modo standalone (iOS 16.4+), y la web
  ya lo explica en el propio interruptor.

## Cómo se hizo

`marketing/fuentes-instalar-app/` lleva los rótulos (`tutorial.html`,
1080×1920, animación dirigida por `render(t)`) y el script de montaje
(`montar-tutorial.sh`). El fondo son los mismos dos planos generados que el
otro reel (`fuentes-app-avisos/bg-*.mp4`), ralentizados ×2,95 y más
oscurecidos: aquí hay que leer, así que el fondo tiene que estorbar menos.
