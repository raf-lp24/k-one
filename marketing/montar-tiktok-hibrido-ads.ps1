# K-ONE · Versión APTA PARA ANUNCIOS (sin pantallas de peso/calorías)
# Salta los tramos que TikTok marca como "salud conductual":
#   - rail de calorías/macros (src 36-42)
#   - cabecera "PERDER GRASA / 86 KG" (src 42-47,5)
# Mantiene solo entrenamiento: sesión de hoy, semana, bloques con RPE, técnica.
param(
  [string]$Src = "C:\Users\Usuario\Downloads\WhatsApp Video 2026-07-24 at 00.57.50.mp4",
  [string]$Out = "C:\Users\Usuario\Desktop\Rafa Personl\Proyetos\Fragua\marketing\tiktok-hibrido-ads.mp4"
)
$ErrorActionPreference='Stop'
$ff=(Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue|Select-Object -First 1).FullName

$txtDir=Join-Path $env:TEMP "kone-ads-txt"; New-Item -ItemType Directory -Force -Path $txtDir|Out-Null
$enc=New-Object System.Text.UTF8Encoding($false)
$textos=[ordered]@{
  'marca' ='K-ONE'
  'sub'   ='PLAN HÍBRIDO · FUERZA + RESISTENCIA'
  'hook1' ='Corres y pierdes fuerza.'
  'hook2' ='Levantas y pierdes fondo.'
  'hook3' ='Fuerza y fondo, sin pisarse'
  'c4'    ='Tu semana: fuerza y cardio repartidos'
  'c5'    ='Series, repeticiones, peso y RPE'
  'c6'    ='Y cómo se hace cada ejercicio, paso a paso'
  'cierre'='Tu plan híbrido por 1,99 € el primer mes'
}
foreach($k in $textos.Keys){ [System.IO.File]::WriteAllText("$txtDir\$k.txt",$textos[$k],$enc) }
$T=($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'
$FIMP="C\:/Windows/Fonts/impact.ttf"; $FBAH="C\:/Windows/Fonts/bahnschrift.ttf"; $EMBER="0xE8490F"

# Encuadre (grabación 416x816)
$VW=680; $VH=1334; $VX=200; $VY=262; $capY=1642
$Dur=15.6

$f=@()
# Solo se conservan tramos SIN peso/calorías/"perder grasa":
#   SegA (bajo el gancho): "sesión principal" con el complejo fuerza+cardio
#   SegB: semana (fuerza + zona 2 cardio) + bloques con RPE + técnica
# Se saltan: rail de calorías/macros (36-42), cabecera "PERDER GRASA/86 KG"
# (42-47) y el menú lateral que muestra "Rafa · Perder grasa" (47-49).
$f+="[0:v]split=2[s1][s2]"
$f+="[s1]trim=33.0:35.3,setpts=PTS-STARTPTS[a]"      # sesión de hoy (bajo el gancho)
$f+="[s2]trim=49.2:62.5,setpts=PTS-STARTPTS[b]"      # semana + bloques + técnica
$f+="[a][b]concat=n=2:v=1[v0]"
$f+="[v0]fps=30,split=2[bg][fg]"
$f+="[bg]scale=1080:-2,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.34:saturation=0.55[bgb]"
$f+="[fg]scale=${VW}:${VH}[fgs]"
$f+="[bgb][fgs]overlay=${VX}:${VY}[base]"
$f+="[base]drawbox=x=$($VX-2):y=$($VY-2):w=$($VW+4):h=$($VH+4):color=${EMBER}@0.75:t=3[fr]"
$f+="[fr]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=90:fontsize=88:fontcolor=white:alpha=0.96[h1]"
$f+="[h1]drawbox=x=(iw-150)/2:y=190:w=150:h=4:color=${EMBER}@0.95:t=fill[h2]"
$f+="[h2]drawtext=fontfile='$FBAH':textfile='$T/sub.txt':x=(w-tw)/2:y=212:fontsize=32:fontcolor=0xCFCCC6[h3]"
# Gancho 0-2,3s (dura lo que SegA, para que la semana se vea justo al acabar)
$f+="[h3]drawbox=x=0:y=0:w=1080:h=1920:color=black@0.82:t=fill:enable='between(t,0,2.3)'[gk0]"
$f+="[gk0]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=740:fontsize=90:fontcolor=white:enable='between(t,0,2.3)'[gk1]"
$f+="[gk1]drawtext=fontfile='$FIMP':textfile='$T/hook2.txt':x=(w-tw)/2:y=848:fontsize=90:fontcolor=0x8F877E:enable='between(t,0.4,2.3)'[gk2]"
$f+="[gk2]drawtext=fontfile='$FIMP':textfile='$T/hook3.txt':x=(w-tw)/2:y=1006:fontsize=94:fontcolor=${EMBER}:enable='between(t,0.9,2.3)'[gk3]"
# Rótulos (tiempos según la salida: semana 2,3-3,6 · bloques 3,6-11,1 · técnica 11,1-fin)
$cap=@(
  @{f='c4';a=2.3;b=3.6},
  @{f='c5';a=3.6;b=11.1},
  @{f='c6';a=11.1;b=$Dur}
)
$prev='gk3';$i=0
foreach($c in $cap){ $i++;$lbl="cap$i"
  $f+="[$prev]drawtext=fontfile='$FBAH':textfile='$T/$($c.f).txt':x=(w-tw)/2:y=${capY}:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=22:enable='between(t,$($c.a),$($c.b))'[$lbl]"
  $prev=$lbl }
# Cierre
$f+="[$prev]drawbox=x=0:y=1130:w=1080:h=250:color=black@0.80:t=fill:enable='gte(t,$($Dur-3))'[cta0]"
$f+="[cta0]drawtext=fontfile='$FIMP':textfile='$T/cierre.txt':x=(w-tw)/2:y=1190:fontsize=54:fontcolor=white:enable='gte(t,$($Dur-3))'[cta1]"
$f+="[cta1]drawtext=fontfile='$FBAH':text='k-one.fit':x=(w-tw)/2:y=1285:fontsize=52:fontcolor=${EMBER}:enable='gte(t,$($Dur-3))'[cta2]"
$f+="[cta2]drawbox=x=0:y=1906:w='1080*t/$Dur':h=8:color=${EMBER}@0.95:t=fill[vout]"

& $ff -y -hide_banner -v error -i $Src -filter_complex ($f -join ";") -map "[vout]" -an `
  -t $Dur -c:v libx264 -profile:v high -preset slow -crf 20 -pix_fmt yuv420p -r 30 -movflags +faststart $Out
if(Test-Path $Out){ "OK -> $Out ($([math]::Round((Get-Item $Out).Length/1MB,2)) MB, ${Dur}s)" } else { "FALLO" }
