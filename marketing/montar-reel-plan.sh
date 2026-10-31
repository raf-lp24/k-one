#!/usr/bin/env bash
# Monta el reel «Le pido un plan a K-ONE» (1080x1920, ~36 s) a partir de:
#   1) la grabación de la app:   node marketing/grabar-reel-plan.mjs <R>
#   2) las piezas gráficas:      marketing/reel-piezas.html?reel=plan (fondo, marco, máscara, textos, final)
# Uso (con el servidor local en :8080):  bash marketing/montar-reel-plan.sh <carpetaTrabajo>
# Mismo montaje que montar-reel-entreno.sh, pero las ventanas de los textos salen
# de tiempos.json (la grabación apunta en qué segundo empieza cada tramo).
set -e
R="${1:?carpeta de trabajo}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
REEL="${REEL:-plan}"   # REEL=ia → «Le pido un plan a mi app» (30 oct 2026)
OUT="${OUT:-$RAIZ/marketing/publicar/videos/12-le-pido-un-plan-a-kone.mp4}"
mkdir -p "$(dirname "$OUT")"

[ -f "$R/tiempos.json" ] || node "$RAIZ/marketing/grabar-reel-plan.mjs" "$R"
( cd "$R" && ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset medium app.mp4 )

mkdir -p "$R/piezas"
pz(){ node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reel-piezas.html?reel=$REEL&$1" "$R/piezas/tmp" 0.04 25 1080 1920 2>/dev/null && mv "$R/piezas/tmp/f00000.png" "$R/piezas/$2.png"; }
pz "pieza=fondo" fondo; pz "pieza=marco" marco; pz "pieza=mascara" mascara; pz "pieza=final" final
for i in 0 1 2 3 4 5 6 7; do pz "pieza=texto&i=$i" "t$i"; done

# Ventanas: portada, datos, salud, comida, objetivo, entreno, generar, adelanto → fin (+1,6 s quieto)
read -r -a W <<< "$(node -e "const t=require(process.argv[1]);const fin=t.total+1.6;console.log([t.portada,t.datos,t.salud,t.comida,t.objetivo,t.entreno,t.generar,t.adelanto,fin].map(x=>x.toFixed(2)).join(' '))" "$R/tiempos.json")"
D=${W[8]}
OFF=$(node -e "console.log((+process.argv[1]-0.6).toFixed(2))" "$D")
cd "$R/piezas"
ins="-loop 1 -t $D -i fondo.png -i ../app.mp4 -loop 1 -t $D -i mascara.png -loop 1 -t $D -i marco.png"
for i in 0 1 2 3 4 5 6 7; do ins="$ins -loop 1 -t $D -i t$i.png"; done
f="[1:v]tpad=stop_mode=clone:stop_duration=2,trim=duration=$D,scale=610:1320:flags=lanczos,format=rgba,pad=1080:1920:235:450:color=black@0[ap];[2:v]format=gray,scale=1080:1920[mk];[ap][mk]alphamerge[apm];[0:v]format=rgba[bg];[bg][apm]overlay=0:0[b1];[b1][3:v]overlay=0:0[c];"
prev=c
for i in 0 1 2 3 4 5 6 7; do a=${W[$i]}; b=${W[$((i+1))]}; f="$f[$prev][$((i+4)):v]overlay=0:0:enable='between(t,$a,$b)'[o$i];"; prev=o$i; done
f="$f[$prev]fps=30,format=yuv420p,setsar=1[v]"
# En dos pasadas: con el cierre en la misma (13 entradas a 1080x1920) ffmpeg se queda sin memoria.
ffmpeg -y -loglevel error $ins -filter_complex "$f" -map "[v]" -t "$D" -c:v libx264 -crf 18 -preset medium main.mp4
ffmpeg -y -loglevel error -i main.mp4 -loop 1 -t 3.4 -framerate 30 -i final.png -filter_complex "[0:v]fps=30,format=yuv420p,setsar=1[m];[1:v]fps=30,format=yuv420p,setsar=1[fin];[m][fin]xfade=transition=fade:duration=0.6:offset=$OFF,format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 19 -preset medium -movflags +faststart "$OUT"
echo "Listo: $OUT"
