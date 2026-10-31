#!/usr/bin/env bash
# Monta el reel «Le digo a mi entrenador con IA que no puedo comer gluten» (31 oct 2026,
# 1080x1920, ~28 s) con:
#   1) la grabación de la app:   node marketing/grabar-reel-celiaco.mjs <R>
#   2) el marco del móvil:       marketing/reel-piezas.html?reel=ia (marco y máscara)
#   3) la capa animada:          marketing/reel-celiaco.html (gancho, rótulos y cierre)
#   4) de fondo, en movimiento:  los clips de comida de marketing/Videos (desenfocados detrás del móvil)
# Uso (con el servidor local en :8080):  bash marketing/montar-reel-celiaco.sh <carpetaTrabajo>
set -e
R="${1:?carpeta de trabajo}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT:-$RAIZ/marketing/publicar/videos/18-le-digo-a-mi-entrenador-con-ia-que-no-puedo-comer-gluten.mp4}"
H=3.0      # segundos del gancho
FIN=3.8    # segundos del cierre
LENTO=1.12 # la app, un 12 % más lenta que la grabación (31 oct, Rafa: «un punto menos» de ritmo)
mkdir -p "$(dirname "$OUT")" "$R/piezas"

[ -f "$R/tiempos.json" ] || node "$RAIZ/marketing/grabar-reel-celiaco.mjs" "$R"
[ -f "$R/app.mp4" ] || ( cd "$R" && ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset medium app.mp4 )

pz(){ node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reel-piezas.html?reel=ia&$1" "$R/piezas/tmp" 0.04 25 1080 1920 2>/dev/null && mv "$R/piezas/tmp/f00000.png" "$R/piezas/$2.png"; }
pz "pieza=marco" marco; pz "pieza=mascara" mascara

TP=$(node -e "process.stdout.write(encodeURIComponent(require('fs').readFileSync(process.argv[1],'utf8')))" "$R/tiempos.json")
D=$(node -e "const t=require(process.argv[1]);console.log((+process.argv[2]+t.total*(+process.argv[4])+0.3+(+process.argv[3])).toFixed(2))" "$R/tiempos.json" $H $FIN $LENTO)
echo "Duración: $D s"
rm -rf "$R/capa"; node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reel-celiaco.html?h=$H&fin=$FIN&lento=$LENTO&tp=$TP" "$R/capa" "$D" 30 1080 1920

# Fondo en movimiento: clips de comida seguidos, a 1080x1920.
V="$RAIZ/marketing/Videos"
ffmpeg -y -loglevel error -i "$V/ai-plato-raw.mp4" -i "$V/ai-carrito-raw.mp4" -i "$V/ai-plato-raw.mp4" -i "$V/ai-carrito-raw.mp4" -i "$V/ai-plato-raw.mp4" -i "$V/ai-carrito-raw.mp4" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v]concat=n=6:v=1:a=0,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p[v]" -map "[v]" -t "$D" -c:v libx264 -crf 20 -preset fast "$R/fondo.mp4"

ENTRA=$(node -e "console.log((+process.argv[1]-0.2).toFixed(2))" $H)
f="[0:v]split[s][b];[b]gblur=sigma=26,eq=brightness=-0.22:saturation=0.75,format=yuva420p,fade=in:st=$ENTRA:d=0.5:alpha=1[bl];[s]eq=brightness=-0.06[s2];[s2][bl]overlay=0:0[fondo];"
f="$f[1:v]setpts=PTS*$LENTO,fps=30,tpad=start_duration=$H:start_mode=clone:stop_mode=clone:stop_duration=8,trim=duration=$D,setpts=PTS-STARTPTS,scale=610:1320:flags=lanczos,format=rgba,pad=1080:1920:235:450:color=black@0[ap];"
f="$f[2:v]format=gray,scale=1080:1920[mk];[ap][mk]alphamerge[apm];[apm][3:v]overlay=0:0:format=auto[movil];"
# El móvil sube desde abajo al acabar el gancho.
f="$f[fondo][movil]overlay=x=0:y='if(lt(t,$ENTRA),1920,1920*0.7*pow(1-min(1,(t-$ENTRA)/0.6),3))':eval=frame[c];"
f="$f[c][4:v]overlay=0:0:format=auto,fps=30,format=yuv420p,setsar=1[v]"
ffmpeg -y -loglevel error -i "$R/fondo.mp4" -i "$R/app.mp4" -loop 1 -t "$D" -i "$R/piezas/mascara.png" -loop 1 -t "$D" -i "$R/piezas/marco.png" -framerate 30 -i "$R/capa/f%05d.png" \
  -filter_complex "$f" -map "[v]" -t "$D" -c:v libx264 -crf 19 -preset medium -movflags +faststart "$OUT"
echo "Listo: $OUT"
