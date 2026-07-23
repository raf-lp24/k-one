# =============================================================================
#  K-ONE · Montaje TikTok — "Así funciona el área de clientes"
#
#  Coge una grabación de pantalla vertical del móvil y la convierte en un vídeo
#  1080x1920 listo para TikTok: fondo desenfocado del propio clip (rellena el
#  9:16 y disimula la baja resolución de WhatsApp), la grabación enmarcada en
#  color K-ONE, rótulos sincronizados y barra de progreso.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#
#  Uso:   .\montar-tiktok-area-clientes.ps1 -Src "C:\ruta\grabacion.mp4"
#
#  NOTA: el audio original de una grabación de pantalla suele estar mudo, así
#  que se descarta (-an). La música se pone después en la propia app de TikTok.
# =============================================================================
param(
  [string]$Src    = "$env:USERPROFILE\Downloads\WhatsApp Video 2026-07-24 at 00.18.07.mp4",
  [string]$Out    = "$PSScriptRoot\tiktok-area-clientes.mp4",
  [double]$Inicio = 28.0,   # segundo en el que arranca el área de clientes
  [double]$Dur    = 34.7    # duración a exportar
)

$ErrorActionPreference = 'Stop'

# --- localizar ffmpeg ---
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw "No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e" }
if (-not (Test-Path $Src)) { throw "No existe el vídeo de origen: $Src" }

# --- rótulos (en ficheros UTF-8: así los acentos no se rompen en el filtro) ---
$txtDir = Join-Path $env:TEMP "kone-tiktok-txt"
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
$textos = [ordered]@{
  'marca' = 'K-ONE'
  'sub'   = 'ASÍ FUNCIONA POR DENTRO'
  'c1'    = 'Tu sesión de hoy, nada más entrar'
  'c2'    = 'Adherencia, racha, calorías y tu código'
  'c3'    = 'Tu objetivo y tu peso, siempre a la vista'
  'c4'    = 'Toda tu semana, día a día'
  'c5'    = 'Cada ejercicio: series, reps, peso y RPE'
  'c6'    = 'Y cómo se hace, paso a paso'
}
foreach ($k in $textos.Keys) { [System.IO.File]::WriteAllText("$txtDir\$k.txt", $textos[$k], $enc) }

# Dentro de un filtro de ffmpeg hay que escapar los dos puntos de la unidad (C\:)
$T     = ($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'
$FIMP  = "C\:/Windows/Fonts/impact.ttf"      # titulares (condensado, aire Bebas)
$FBAH  = "C\:/Windows/Fonts/bahnschrift.ttf" # rótulos
$EMBER = "0xE8490F"

# Grabación enmarcada: 620 de ancho -> 1370 de alto, centrada
$VW=620; $VH=1370; $VX=230; $VY=270

$f  = @()
$f += "[0:v]trim=start=$Inicio,setpts=PTS-STARTPTS,fps=30[v0]"
$f += "[v0]split=2[bg][fg]"
$f += "[bg]scale=1080:-2,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.34:saturation=0.55[bgb]"
$f += "[fg]scale=${VW}:-2[fgs]"
$f += "[bgb][fgs]overlay=${VX}:${VY}[base]"
$f += "[base]drawbox=x=$($VX-2):y=$($VY-2):w=$($VW+4):h=$($VH+4):color=${EMBER}@0.75:t=3[fr]"
# Cabecera
$f += "[fr]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=96:fontsize=88:fontcolor=white:alpha=0.96[h1]"
$f += "[h1]drawbox=x=(iw-150)/2:y=196:w=150:h=4:color=${EMBER}@0.95:t=fill[h2]"
$f += "[h2]drawtext=fontfile='$FBAH':textfile='$T/sub.txt':x=(w-tw)/2:y=218:fontsize=34:fontcolor=0xCFCCC6[h3]"

# Rótulos inferiores — tiempos verificados fotograma a fotograma
$cap = @(
  @{f='c1'; a=0.0;  b=9.0},    # hero: sesión de hoy, mensaje, marcar completado
  @{f='c2'; a=9.0;  b=14.0},   # rail: adherencia, racha, kcal, plan, referido
  @{f='c3'; a=14.0; b=19.0},   # cabecera: objetivo y peso actual
  @{f='c4'; a=19.0; b=23.0},   # menú + semana completa
  @{f='c5'; a=23.0; b=30.0},   # bloques de entreno con RPE y pesos
  @{f='c6'; a=30.0; b=$Dur}    # ficha del ejercicio
)
$prev='h3'; $i=0
foreach ($c in $cap) {
  $i++; $lbl="cap$i"
  $f += "[$prev]drawtext=fontfile='$FBAH':textfile='$T/$($c.f).txt':x=(w-tw)/2:y=1700:fontsize=46:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=22:enable='between(t,$($c.a),$($c.b))'[$lbl]"
  $prev=$lbl
}
$f += "[$prev]drawbox=x=0:y=1906:w='1080*t/$Dur':h=8:color=${EMBER}@0.95:t=fill[vout]"

& $ff -y -hide_banner -v error -i $Src `
  -filter_complex ($f -join ";") -map "[vout]" -an `
  -t $Dur -c:v libx264 -profile:v high -preset slow -crf 20 `
  -pix_fmt yuv420p -r 30 -movflags +faststart $Out

if (Test-Path $Out) {
  "OK -> $Out  ($([math]::Round((Get-Item $Out).Length/1MB,2)) MB)"
} else { throw "No se generó el vídeo" }
