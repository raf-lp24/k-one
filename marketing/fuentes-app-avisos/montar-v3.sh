#!/bin/bash
# Monta el reel v3: fondo de video generado (Higgsfield) + rotulos animados
# renderizados con alfa desde el navegador.
#
# El fondo son dos planos de 5 s a 24 fps. Se ralentizan a ~11,6 s cada uno
# (setpts) para que el movimiento sea lento y no compita con el texto, se
# encadenan con un fundido, y se oscurecen y desenfocan un poco: el video
# esta ahi para dar atmosfera, no para que lo mires.
set -e
cd "$(dirname "$0")"

FPS=25
DUR=21.52

echo "1/2 · pista de fondo"
ffmpeg -y -loglevel error \
  -i bg-a.mp4 -i bg-b.mp4 \
  -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=2.3*PTS,fps=$FPS,eq=brightness=-0.16:contrast=1.06:saturation=0.80,gblur=sigma=3.5[a];[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=2.3*PTS,fps=$FPS,eq=brightness=-0.20:contrast=1.06:saturation=0.72,gblur=sigma=4.5[b];[a][b]xfade=transition=fade:duration=1.2:offset=10.4[bg]" \
  -map "[bg]" -t $DUR -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium fondo.mp4

echo "2/2 · rotulos con alfa encima"
ffmpeg -y -loglevel error \
  -i fondo.mp4 \
  -framerate $FPS -i "framesA/f%05d.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" \
  -map "[v]" -t $DUR \
  -c:v libx264 -profile:v high -crf 18 -preset medium -movflags +faststart \
  kone-app-avisos-v3.mp4

ffprobe -v error -show_entries format=duration,size:stream=width,height,nb_frames -of default=noprint_wrappers=1 kone-app-avisos-v3.mp4
