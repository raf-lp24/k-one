#!/usr/bin/env bash
# Monta un reel «la app grabada en movimiento» (31 oct 2026, 1080x1920, 25-30 s):
#   gancho sobre un clip con nuestras caras de marca → móvil con la app grabada
#   (grabar.mjs) sobre clips desenfocados → cierre. Textos animados de capa.html.
# Uso (con el servidor local en :8080):  bash marketing/reels-app/montar.sh <guion> <carpetaTrabajo>
# Mismo montaje que marketing/montar-reel-celiaco.sh (el que aprobó Rafa).
set -e
G="${1:?guion}"; R="${2:?carpeta de trabajo}"
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/../.." && pwd)"
H=3.0; FIN=3.8
mkdir -p "$R/piezas"

# Datos del guion (salida, clips, velocidad de la app)
eval "$(node "$AQUI/datos.mjs" "$G")"
OUT="${OUT:-$RAIZ/marketing/publicar/videos/$SALIDA}"
mkdir -p "$(dirname "$OUT")"

[ -f "$R/tiempos.json" ] || node "$AQUI/grabar.mjs" "$G" "$R"
[ -f "$R/app.mp4" ] || ( cd "$R" && ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset medium app.mp4 )

pz(){ node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reel-piezas.html?reel=ia&$1" "$R/piezas/tmp" 0.04 25 1080 1920 2>/dev/null && mv "$R/piezas/tmp/f00000.png" "$R/piezas/$2.png"; }
[ -f "$R/piezas/marco.png" ] || pz "pieza=marco" marco
[ -f "$R/piezas/mascara.png" ] || pz "pieza=mascara" mascara

TP=$(node -e "process.stdout.write(encodeURIComponent(require('fs').readFileSync(process.argv[1],'utf8')))" "$R/tiempos.json")
D=$(node -e "const t=require(process.argv[1]);console.log((+process.argv[2]+t.total*(+process.argv[4])+0.3+(+process.argv[3])).toFixed(2))" "$R/tiempos.json" $H $FIN $LENTO)
echo "$G · $D s · app al $(node -e "console.log(Math.round(100/$LENTO))") %"
rm -rf "$R/capa"; node "$RAIZ/marketing/cdp-frames.mjs" "http://localhost:8080/marketing/reels-app/capa.html?g=$G&h=$H&fin=$FIN&lento=$LENTO&tp=$TP" "$R/capa" "$D" 30 1080 1920 2>&1 | tail -1

# Fondo: el clip del gancho (nítido) y luego los demás seguidos, a 1080x1920.
V="$RAIZ/marketing/Videos"; ins=(); n=0
for c in $GANCHO $FONDO; do ins+=(-i "$V/$c"); n=$((n+1)); done
cad=""; for i in $(seq 0 $((n-1))); do cad="$cad[$i:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[c$i];"; done
for i in $(seq 0 $((n-1))); do cad="$cad[c$i]"; done
ffmpeg -y -loglevel error "${ins[@]}" -filter_complex "${cad}concat=n=$n:v=1:a=0,format=yuv420p[v]" -map "[v]" -t "$D" -c:v libx264 -crf 20 -preset fast "$R/fondo.mp4"

ENTRA=$(node -e "console.log((+process.argv[1]-0.2).toFixed(2))" $H)
f="[0:v]split[s][b];[b]gblur=sigma=26,eq=brightness=-0.22:saturation=0.75,format=yuva420p,fade=in:st=$ENTRA:d=0.5:alpha=1[bl];[s]eq=brightness=-0.06[s2];[s2][bl]overlay=0:0[fondo];"
f="$f[1:v]setpts=PTS*$LENTO,fps=30,tpad=start_duration=$H:start_mode=clone:stop_mode=clone:stop_duration=8,trim=duration=$D,setpts=PTS-STARTPTS,scale=610:1320:flags=lanczos,format=rgba,pad=1080:1920:235:450:color=black@0[ap];"
f="$f[2:v]format=gray,scale=1080:1920[mk];[ap][mk]alphamerge[apm];[apm][3:v]overlay=0:0:format=auto[movil];"
f="$f[fondo][movil]overlay=x=0:y='if(lt(t,$ENTRA),1920,1920*0.7*pow(1-min(1,(t-$ENTRA)/0.6),3))':eval=frame[c];"
f="$f[c][4:v]overlay=0:0:format=auto,fps=30,format=yuv420p,setsar=1[v]"
ffmpeg -y -loglevel error -i "$R/fondo.mp4" -i "$R/app.mp4" -loop 1 -t "$D" -i "$R/piezas/mascara.png" -loop 1 -t "$D" -i "$R/piezas/marco.png" -framerate 30 -i "$R/capa/f%05d.png" \
  -filter_complex "$f" -map "[v]" -t "$D" -c:v libx264 -crf 19 -preset medium -movflags +faststart "$OUT"
echo "Listo: $OUT"
