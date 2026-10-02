#!/usr/bin/env bash
# Monta el reel del modo entrenamiento (1080x1920, ~30 s) a partir de:
#   1) la grabación de la app:   node marketing/grabar-reel-entreno.mjs <R>
#   2) las piezas gráficas:      marketing/reel-piezas.html (fondo, marco, máscara, textos, final)
# Uso (con el servidor local en :8080):  bash marketing/montar-reel-entreno.sh <carpetaTrabajo>
set -e
R="${1:?carpeta de trabajo}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$RAIZ/marketing/Videos/reel-modo-entrenamiento.mp4"

node "$RAIZ/marketing/grabar-reel-entreno.mjs" "$R"
( cd "$R" && ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset medium app.mp4 )

mkdir -p "$R/piezas"
pz(){ node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reel-piezas.html?$1" "$R/piezas/tmp" 0.04 25 1080 1920 2>/dev/null && mv "$R/piezas/tmp/f00000.png" "$R/piezas/$2.png"; }
pz "pieza=fondo" fondo; pz "pieza=marco" marco; pz "pieza=mascara" mascara; pz "pieza=final" final
for i in 0 1 2 3 4 5 6 7 8; do pz "pieza=texto&i=$i" "t$i"; done

# Ventanas de cada texto (segundos del vídeo de la app; ver tiempos.json de la grabación)
cd "$R/piezas"
D=27.9; W=(0 2.2 7.3 9.2 10.8 17.0 19.3 22.0 25.9 27.9)
ins="-loop 1 -t $D -i fondo.png -i ../app.mp4 -loop 1 -t $D -i mascara.png -loop 1 -t $D -i marco.png"
for i in 0 1 2 3 4 5 6 7 8; do ins="$ins -loop 1 -t $D -i t$i.png"; done
ins="$ins -loop 1 -t 3.2 -i final.png"
f="[1:v]tpad=stop_mode=clone:stop_duration=1.6,trim=duration=$D,scale=610:1320:flags=lanczos,format=rgba,pad=1080:1920:235:450:color=black@0[ap];[2:v]format=gray,scale=1080:1920[mk];[ap][mk]alphamerge[apm];[0:v]format=rgba[bg];[bg][apm]overlay=0:0[b1];[b1][3:v]overlay=0:0[c];"
prev=c
for i in 0 1 2 3 4 5 6 7 8; do a=${W[$i]}; b=${W[$((i+1))]}; f="$f[$prev][$((i+4)):v]overlay=0:0:enable='between(t,$a,$b)'[o$i];"; prev=o$i; done
f="$f[$prev]fps=30,format=yuv420p,setsar=1[main];[13:v]fps=30,format=yuv420p,setsar=1[fin];[main][fin]xfade=transition=fade:duration=0.6:offset=27.3,format=yuv420p[v]"
ffmpeg -y -loglevel error $ins -filter_complex "$f" -map "[v]" -c:v libx264 -crf 19 -preset medium -movflags +faststart "$OUT"
echo "Listo: $OUT"
