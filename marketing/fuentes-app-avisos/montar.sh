#!/bin/bash
# Monta el reel 1080x1920 a partir de los 5 fotogramas ya renderizados.
# Cada slide lleva un zoom lento (Ken Burns) y entre slides un fundido de 0,5s.
#
# GOTCHA que costo un render de 8 minutos: zoompan emite `d` fotogramas POR
# CADA fotograma de ENTRADA. Con `-loop 1 -t 4` la entrada ya son 100
# fotogramas, asi que d=100 daba 10.000 -> un video de 523 segundos en vez de
# 21. La entrada tiene que ser UNA sola imagen (sin -loop), y es zoompan quien
# genera la duracion con su `d`.
#
# Y escalar x2 ANTES del zoompan: sobre la imagen a tamano final el zoom da
# saltos de pixel visibles.
set -e
cd "$(dirname "$0")"

FPS=25
XF=0.5
D1=4.0; D2=5.0; D3=5.5; D4=4.5; D5=4.5
F1=$(awk "BEGIN{print int($D1*$FPS)}"); F2=$(awk "BEGIN{print int($D2*$FPS)}")
F3=$(awk "BEGIN{print int($D3*$FPS)}"); F4=$(awk "BEGIN{print int($D4*$FPS)}")
F5=$(awk "BEGIN{print int($D5*$FPS)}")

ffmpeg -y -loglevel error \
  -i slide-1.png -i slide-2.png -i slide-3.png -i slide-4.png -i slide-5.png \
  -filter_complex "
    [0:v]scale=2160:3840,zoompan=z='min(zoom+0.00040,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$F1:s=1080x1920:fps=$FPS,setsar=1,fade=t=in:st=0:d=0.6[v0];
    [1:v]scale=2160:3840,zoompan=z='min(zoom+0.00035,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$F2:s=1080x1920:fps=$FPS,setsar=1[v1];
    [2:v]scale=2160:3840,zoompan=z='min(zoom+0.00035,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$F3:s=1080x1920:fps=$FPS,setsar=1[v2];
    [3:v]scale=2160:3840,zoompan=z='min(zoom+0.00035,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$F4:s=1080x1920:fps=$FPS,setsar=1[v3];
    [4:v]scale=2160:3840,zoompan=z='min(zoom+0.00040,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$F5:s=1080x1920:fps=$FPS,setsar=1,fade=t=out:st=$(awk "BEGIN{print $D5-0.8}"):d=0.8[v4];
    [v0][v1]xfade=transition=fade:duration=$XF:offset=$(awk "BEGIN{print $D1-$XF}")[a];
    [a][v2]xfade=transition=fade:duration=$XF:offset=$(awk "BEGIN{print $D1+$D2-2*$XF}")[b];
    [b][v3]xfade=transition=fade:duration=$XF:offset=$(awk "BEGIN{print $D1+$D2+$D3-3*$XF}")[c];
    [c][v4]xfade=transition=fade:duration=$XF:offset=$(awk "BEGIN{print $D1+$D2+$D3+$D4-4*$XF}")[v]
  " -map "[v]" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset medium -r $FPS \
  -movflags +faststart \
  kone-app-avisos.mp4

ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 kone-app-avisos.mp4
