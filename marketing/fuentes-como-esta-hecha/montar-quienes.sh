#!/bin/bash
# Monta el video de "como esta hecha": mismos planos de fondo que los otros dos
# (no gasta creditos nuevos y los tres videos quedan de la misma familia) +
# rotulos con alfa renderizados desde el navegador.
#
# Dura 37 s y cada plano son 5 s: se ralentizan x3,75 (18,7 s cada uno). Mas
# lento aun que en el tutorial: aqui hay cifras y tres fichas que leer.
set -e
cd "$(dirname "$0")"

FPS=25
DUR=37.0

echo "1/2 · pista de fondo"
ffmpeg -y -loglevel error \
  -i bg-gimnasio.mp4 -i bg-calle.mp4 \
  -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=3.75*PTS,fps=$FPS,eq=brightness=-0.18:contrast=1.05:saturation=0.75,gblur=sigma=5[a];[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=3.75*PTS,fps=$FPS,eq=brightness=-0.22:contrast=1.05:saturation=0.68,gblur=sigma=6[b];[a][b]xfade=transition=fade:duration=1.2:offset=17.6[bg]" \
  -map "[bg]" -t $DUR -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium fondo-quienes.mp4

echo "2/2 · rotulos con alfa encima"
ffmpeg -y -loglevel error \
  -i fondo-quienes.mp4 \
  -framerate $FPS -i "framesQ/f%05d.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" \
  -map "[v]" -t $DUR \
  -c:v libx264 -profile:v high -crf 18 -preset medium -movflags +faststart \
  kone-como-esta-hecha.mp4

ffprobe -v error -show_entries format=duration,size:stream=width,height,nb_frames -of default=noprint_wrappers=1 kone-como-esta-hecha.mp4
