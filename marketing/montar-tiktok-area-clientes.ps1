# =============================================================================
#  K-ONE · Montaje TikTok — grabación del área de clientes
#
#  Coge una grabación de pantalla vertical del móvil y la convierte en un vídeo
#  1080x1920 listo para TikTok: fondo desenfocado del propio clip (rellena el
#  9:16 y disimula la baja resolución de WhatsApp), la grabación enmarcada en
#  color K-ONE, gancho de apertura, rótulos sincronizados, cierre con CTA y
#  barra de progreso.
#
#  El encuadre se calcula solo a partir del tamaño real de la grabación, así que
#  vale para cualquier móvil (las grabaciones no siempre tienen la misma forma).
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#
#  Uso:
#    .\montar-tiktok-area-clientes.ps1 -Src "C:\ruta\grabacion.mp4" -Perfil hibrido
#
#  IMPORTANTE: guardar este .ps1 con BOM UTF-8. Sin BOM, PowerShell 5.1 lo lee
#  como ANSI y rompe el símbolo del euro y las tildes de los rótulos.
#
#  NOTA: el audio de una grabación de pantalla suele estar mudo, así que se
#  descarta (-an). La música se pone después en la propia app de TikTok.
# =============================================================================
param(
  [string]$Src    = "$env:USERPROFILE\Downloads\WhatsApp Video 2026-07-24 at 00.57.50.mp4",
  [string]$Out    = "$PSScriptRoot\tiktok-area-clientes.mp4",
  [double]$Inicio = 28.0,   # segundo en el que arranca el área de clientes
  [double]$Dur    = 34.7,   # duración a exportar
  [ValidateSet('generico','hibrido')]
  [string]$Perfil = 'hibrido'
)

$ErrorActionPreference = 'Stop'

# --- localizar ffmpeg / ffprobe ---
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw "No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e" }
$fp = Join-Path (Split-Path $ff) 'ffprobe.exe'
if (-not (Test-Path $Src)) { throw "No existe el vídeo de origen: $Src" }

# --- tamaño real de la grabación, para calcular el encuadre ---
$dim = (& $fp -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x $Src).Trim()
$sw, $sh = $dim.Split('x')
$ratio = [double]$sh / [double]$sw

# --- textos por perfil ---
$comunes = [ordered]@{
  'marca' = 'K-ONE'
  'c2'    = 'Tu adherencia, tu racha y tus calorías'
  'c3'    = 'Tu objetivo y tu peso, siempre delante'
  'c5'    = 'Series, repeticiones, peso y esfuerzo'
  'c6'    = 'Y cómo se hace cada ejercicio, paso a paso'
}
if ($Perfil -eq 'hibrido') {
  # Gancho: el dolor real del que entrena fuerza y resistencia a la vez.
  $propios = [ordered]@{
    'sub'    = 'PLAN HÍBRIDO · FUERZA + RESISTENCIA'
    'hook1'  = 'Corres y pierdes fuerza.'
    'hook2'  = 'Levantas y pierdes fondo.'
    'hook3'  = 'Fuerza y fondo, sin pisarse'
    'c1'     = 'Hoy: fuerza y cardio en la misma sesión'
    'c4'     = 'La semana entera, ya repartida'
    'cierre' = 'Tu plan híbrido por 1,99 € el primer mes'
  }
} else {
  $propios = [ordered]@{
    'sub'    = 'ESTO NO ES OTRA APP DE GIMNASIO'
    'hook1'  = 'Entrenas sin saber'
    'hook2'  = 'si vas a mejorar.'
    'hook3'  = 'Esto te lo ordena'
    'c1'     = 'Abres la app y ya sabes qué toca hoy'
    'c4'     = 'La semana entera, día a día'
    'cierre' = 'Tu plan por 1,99 € el primer mes'
  }
}
$textos = [ordered]@{}
foreach ($k in $comunes.Keys) { $textos[$k] = $comunes[$k] }
foreach ($k in $propios.Keys) { $textos[$k] = $propios[$k] }

# --- rótulos en ficheros UTF-8: así los acentos no se rompen dentro del filtro ---
$txtDir = Join-Path $env:TEMP "kone-tiktok-txt"
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($k in $textos.Keys) { [System.IO.File]::WriteAllText("$txtDir\$k.txt", $textos[$k], $enc) }

# Dentro de un filtro de ffmpeg hay que escapar los dos puntos de la unidad (C\:)
$T     = ($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'
$FIMP  = "C\:/Windows/Fonts/impact.ttf"      # titulares (condensado, aire Bebas)
$FBAH  = "C\:/Windows/Fonts/bahnschrift.ttf" # rótulos
$EMBER = "0xE8490F"

# --- encuadre: se elige el ancho mayor que deje sitio a cabecera y rótulo ---
$VW = 680
$VH = [int][Math]::Round($VW * $ratio / 2) * 2      # par, que lo exige yuv420p
$maxH = 1360
if ($VH -gt $maxH) { $VW = [int][Math]::Round($maxH / $ratio / 2) * 2; $VH = [int][Math]::Round($VW * $ratio / 2) * 2 }
$VX = [int]((1080 - $VW) / 2)
$VY = 262
$capY = [Math]::Min(1735, $VY + $VH + 46)           # rótulo justo debajo del marco

$f  = @()
$f += "[0:v]trim=start=$Inicio,setpts=PTS-STARTPTS,fps=30[v0]"
$f += "[v0]split=2[bg][fg]"
$f += "[bg]scale=1080:-2,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.34:saturation=0.55[bgb]"
$f += "[fg]scale=${VW}:${VH}[fgs]"
$f += "[bgb][fgs]overlay=${VX}:${VY}[base]"
$f += "[base]drawbox=x=$($VX-2):y=$($VY-2):w=$($VW+4):h=$($VH+4):color=${EMBER}@0.75:t=3[fr]"

# Cabecera
$f += "[fr]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=90:fontsize=88:fontcolor=white:alpha=0.96[h1]"
$f += "[h1]drawbox=x=(iw-150)/2:y=190:w=150:h=4:color=${EMBER}@0.95:t=fill[h2]"
$f += "[h2]drawtext=fontfile='$FBAH':textfile='$T/sub.txt':x=(w-tw)/2:y=212:fontsize=32:fontcolor=0xCFCCC6[h3]"

# --- GANCHO (0-3,2 s): tapa la pantalla y obliga a leer antes de soltar el producto ---
$f += "[h3]drawbox=x=0:y=0:w=1080:h=1920:color=black@0.82:t=fill:enable='between(t,0,3.2)'[gk0]"
$f += "[gk0]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=740:fontsize=92:fontcolor=white:enable='between(t,0,3.2)'[gk1]"
$f += "[gk1]drawtext=fontfile='$FIMP':textfile='$T/hook2.txt':x=(w-tw)/2:y=848:fontsize=92:fontcolor=0x8F877E:enable='between(t,0,3.2)'[gk2]"
$f += "[gk2]drawtext=fontfile='$FIMP':textfile='$T/hook3.txt':x=(w-tw)/2:y=1010:fontsize=96:fontcolor=${EMBER}:enable='between(t,1.1,3.2)'[gk3]"

# Rótulos inferiores — tiempos verificados fotograma a fotograma
$cap = @(
  @{f='c1'; a=3.2;  b=8.0},    # hero: sesión de hoy (metcon fuerza + cardio)
  @{f='c2'; a=8.0;  b=14.0},   # rail: adherencia, racha, kcal, plan, referido
  @{f='c3'; a=14.0; b=19.5},   # cabecera: objetivo y peso actual
  @{f='c4'; a=19.5; b=22.0},   # semana completa
  @{f='c5'; a=22.0; b=30.0},   # bloques de entreno con RPE y pesos
  @{f='c6'; a=30.0; b=$Dur}    # ficha del ejercicio
)
$prev='gk3'; $i=0
foreach ($c in $cap) {
  $i++; $lbl="cap$i"
  $f += "[$prev]drawtext=fontfile='$FBAH':textfile='$T/$($c.f).txt':x=(w-tw)/2:y=${capY}:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=22:enable='between(t,$($c.a),$($c.b))'[$lbl]"
  $prev=$lbl
}

# Cierre: llamada a la acción sobre la propia grabación (últimos 3 s)
$f += "[$prev]drawbox=x=0:y=1130:w=1080:h=250:color=black@0.80:t=fill:enable='gte(t,$($Dur-3))'[cta0]"
$f += "[cta0]drawtext=fontfile='$FIMP':textfile='$T/cierre.txt':x=(w-tw)/2:y=1190:fontsize=58:fontcolor=white:enable='gte(t,$($Dur-3))'[cta1]"
$f += "[cta1]drawtext=fontfile='$FBAH':text='k-one.fit':x=(w-tw)/2:y=1285:fontsize=52:fontcolor=${EMBER}:enable='gte(t,$($Dur-3))'[cta2]"

$f += "[cta2]drawbox=x=0:y=1906:w='1080*t/$Dur':h=8:color=${EMBER}@0.95:t=fill[vout]"

& $ff -y -hide_banner -v error -i $Src `
  -filter_complex ($f -join ";") -map "[vout]" -an `
  -t $Dur -c:v libx264 -profile:v high -preset slow -crf 20 `
  -pix_fmt yuv420p -r 30 -movflags +faststart $Out

if (Test-Path $Out) {
  "OK ($Perfil, origen ${sw}x${sh}, marco ${VW}x${VH}) -> $Out  ($([math]::Round((Get-Item $Out).Length/1MB,2)) MB)"
} else { throw "No se generó el vídeo" }
