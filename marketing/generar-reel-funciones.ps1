# =============================================================================
#  K-ONE · Reel "así funciona por dentro" — capturas reales de la app actual
#
#  A diferencia de generar-instagram-presentacion*.ps1 (que usaban un vídeo
#  grabado a mano, demo-completo.mp4), este Reel parte de 4 CAPTURAS de la
#  app real tal como está HOY (index.html en producción), generadas con un
#  usuario de ejemplo inyectado directamente en el estado del cliente (sin
#  necesidad de una cuenta real ni de grabar pantalla a mano) -- ver
#  capturar-demo.mjs en el scratchpad de la sesión que las generó. Cuando la
#  web cambie otra vez, hay que volver a capturar, no reusar estas imágenes.
#
#  Cada captura entra como una escena con zoom lento (Ken Burns) + un
#  subtítulo que explica qué se está viendo. Sin música ni voz -- solo texto.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe tildes y el €).
#
#  Uso:  .\generar-reel-funciones.ps1 -CapturasDir "C:\ruta\a\las\4\capturas"
# =============================================================================
param(
  [Parameter(Mandatory = $true)][string]$CapturasDir,
  [string]$Out = "$PSScriptRoot\reel-funciones.mp4"
)

$ErrorActionPreference = 'Stop'
$capturas = @('1-hoy.png', '2-dia-ejercicios.png', '3-nutricion-comidas.png', '4-lista-compra.png')
foreach ($c in $capturas) {
  if (-not (Test-Path (Join-Path $CapturasDir $c))) { throw "Falta la captura: $c en $CapturasDir" }
}

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

$FIMP  = "C\:/Windows/Fonts/impact.ttf"
$FBAH  = "C\:/Windows/Fonts/bahnschrift.ttf"
$EMBER = '0xD1420E'
$W = 1080; $H = 1920; $FPS = 30

# --- textos en ficheros (evita pelearse con el escapado de drawtext) ---
$txtDir = Join-Path $env:TEMP 'kone-reel-funciones'
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
$textos = [ordered]@{
  'marca'  = 'K-ONE'
  'cap1a'  = 'Tu plan'
  'cap1b'  = 'listo desde el día 1'
  'cap2a'  = 'Cada ejercicio,'
  'cap2b'  = 'explicado paso a paso'
  'cap3a'  = 'Tu nutrición,'
  'cap3b'  = 'calculada al gramo'
  'cap4a'  = 'Y tu lista de la compra...'
  'cap4b'  = 'se hace sola'
  'cta1'   = 'PRIMER MES'
  'cta2'   = 'GRATIS'
  'cta3'   = 'Sin código. Automático al registrarte.'
  'cta4'   = 'k-one.fit'
}
foreach ($k in $textos.Keys) { [System.IO.File]::WriteAllText((Join-Path $txtDir "$k.txt"), $textos[$k], $enc) }
$T = ($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'

$work = Join-Path $env:TEMP 'kone-reel-funciones-escenas'
Remove-Item $work -Recurse -Force -EA SilentlyContinue
New-Item -ItemType Directory -Force -Path $work | Out-Null

function Invoke-Escena($filtro, $dur, $salida, $entrada) {
  $a = @('-y', '-hide_banner', '-v', 'error')
  $a += $entrada
  $a += @('-filter_complex', $filtro, '-map', '[vout]', '-an', '-t', $dur,
          '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19',
          '-pix_fmt', 'yuv420p', '-r', $FPS, $salida)
  & $ff @a
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg falló generando $salida" }
}

# ---------- ESCENAS 1-4: captura real + zoom lento + subtítulo ----------
# Las capturas son 504x836 (Chrome headless en Windows ignora anchos de
# ventana por debajo de ~504px -- ver reference_headless_min_window_width.md
# en la memoria del proyecto). Se escalan a la altura del lienzo y se
# recorta el ancho centrado, en vez de estirar y deformar la UI.
$escenas = @(
  @{ img = '1-hoy.png';               dur = 3.6; capA = 'cap1a'; capB = 'cap1b' },
  @{ img = '2-dia-ejercicios.png';    dur = 3.6; capA = 'cap2a'; capB = 'cap2b' },
  @{ img = '3-nutricion-comidas.png'; dur = 3.6; capA = 'cap3a'; capB = 'cap3b' },
  @{ img = '4-lista-compra.png';      dur = 4.0; capA = 'cap4a'; capB = 'cap4b' }
)
$i = 0
foreach ($esc in $escenas) {
  $i++
  $n = '{0:00}' -f $i
  $frames = [int]([math]::Round($esc.dur * $FPS))
  $rutaImg = (Join-Path $CapturasDir $esc.img) -replace '\\','/'
  $f = @()
  # Ken Burns: zoom lento de 1.0 a ~1.12 a lo largo de toda la escena.
  # Banda sólida de fondo para el texto (no cajas sueltas por línea): así lo
  # que hay debajo de la captura -- botones, otro texto -- nunca se cuela
  # por los huecos entre líneas. Aparece de golpe, el texto encima hace fade.
  $f += "[0:v]scale=-2:${H},crop=${W}:${H},zoompan=z='min(zoom+0.0009\,1.12)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1[zoom]"
  $f += "[zoom]drawbox=x=0:y=${H}-380:w=${W}:h=290:color=black@0.78:t=fill:enable='gte(t,0.2)'[band]"
  $f += "[band]drawtext=fontfile='$FBAH':textfile='$T/$($esc.capA).txt':x=(w-tw)/2:y=${H}-320:fontsize=44:fontcolor=0xCFCCC6:alpha='if(lt(t,0.35),0,min(1,(t-0.35)*3))'[s1]"
  $f += "[s1]drawtext=fontfile='$FIMP':textfile='$T/$($esc.capB).txt':x=(w-tw)/2:y=${H}-255:fontsize=62:fontcolor=${EMBER}:alpha='if(lt(t,0.45),0,min(1,(t-0.45)*3))'[vout]"
  Invoke-Escena ($f -join ';') $esc.dur (Join-Path $work "$n.mp4") @('-loop', '1', '-i', $rutaImg)
}

# ---------- ESCENA 5: cierre con la oferta ----------
$c = @()
$c += "[0:v]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=300:fontsize=72:fontcolor=white:alpha=0.95[c1]"
$c += "[c1]drawbox=x=(iw-140)/2:y=400:w=140:h=4:color=${EMBER}@0.95:t=fill[c2]"
$c += "[c2]drawtext=fontfile='$FBAH':textfile='$T/cta1.txt':x=(w-tw)/2:y=700:fontsize=58:fontcolor=white:enable='gte(t,0.2)'[c3]"
$c += "[c3]drawtext=fontfile='$FIMP':textfile='$T/cta2.txt':x=(w-tw)/2:y=780:fontsize=190:fontcolor=${EMBER}:enable='gte(t,0.45)'[c4]"
$c += "[c4]drawtext=fontfile='$FBAH':textfile='$T/cta3.txt':x=(w-tw)/2:y=1030:fontsize=40:fontcolor=0xCFCCC6:enable='gte(t,1.1)'[c5]"
$c += "[c5]drawbox=x=(iw-420)/2:y=1180:w=420:h=96:color=${EMBER}@0.95:t=fill:enable='gte(t,1.6)'[c6]"
$c += "[c6]drawtext=fontfile='$FIMP':textfile='$T/cta4.txt':x=(w-tw)/2:y=1196:fontsize=64:fontcolor=white:enable='gte(t,1.6)'[vout]"
Invoke-Escena ($c -join ';') 4.4 (Join-Path $work '05.mp4') @('-f', 'lavfi', '-i', "color=c=0x08090B:s=${W}x${H}:d=4.4")

# ---------- unir ----------
$lista = Join-Path $work 'lista.txt'
$rutas = Get-ChildItem $work -Filter '*.mp4' | Sort-Object Name | ForEach-Object { "file '$($_.FullName -replace '\\','/')'" }
[System.IO.File]::WriteAllLines($lista, $rutas, $enc)

& $ff -y -hide_banner -v error -f concat -safe 0 -i $lista -c copy -movflags +faststart $Out
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg falló al unir las escenas' }

if (Test-Path $Out) {
  $mb = [math]::Round((Get-Item $Out).Length / 1MB, 2)
  "OK -> $Out  ($mb MB)"
} else { throw 'No se generó el vídeo' }
