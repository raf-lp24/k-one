#!/bin/bash
# Monta el tutorial de instalacion: mismo fondo generado que el otro reel
# (asi los dos videos se ven de la misma familia y no gasta creditos nuevos)
# + rotulos con alfa renderizados desde el navegador.
#
# El tutorial dura 28,5 s y cada plano de fondo son 5 s: se ralentizan x2,95
# (14,9 s cada uno) y se encadenan. Mas lento que en el otro reel a proposito:
# aqui el fondo tiene que estorbar aun menos, porque hay que LEER.
set -e
cd "$(dirname "$0")"

FPS=25
DUR=28.5

echo "1/2 · pista de fondo"
ffmpeg -y -loglevel error \
  -i bg-gimnasio.mp4 -i bg-calle.mp4 \
  -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=2.95*PTS,fps=$FPS,eq=brightness=-0.18:contrast=1.05:saturation=0.75,gblur=sigma=5[a];[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=2.95*PTS,fps=$FPS,eq=brightness=-0.22:contrast=1.05:saturation=0.68,gblur=sigma=6[b];[a][b]xfade=transition=fade:duration=1.2:offset=13.7[bg]" \
  -map "[bg]" -t $DUR -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium fondo-tut.mp4

echo "2/2 · rotulos con alfa encima"
ffmpeg -y -loglevel error \
  -i fondo-tut.mp4 \
  -framerate $FPS -i "framesT/f%05d.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" \
  -map "[v]" -t $DUR \
  -c:v libx264 -profile:v high -crf 18 -preset medium -movflags +faststart \
  kone-instalar-app.mp4

ffprobe -v error -show_entries format=duration,size:stream=width,height,nb_frames -of default=noprint_wrappers=1 kone-instalar-app.mp4
