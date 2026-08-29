# =============================================================================
#  K-ONE · Instagram Reel — vídeo de presentación de la cuenta
#
#  Monta un Reel vertical (1080x1920) que presenta la marca y la app:
#    1. Gancho: somos nuevos -> por eso el primer mes es gratis
#    2. Cuatro fragmentos REALES de la app (demo-completo.mp4), que ya traen
#       sus propios rótulos explicativos grabados
#    3. Cierre: primer mes gratis, sin código, + k-one.fit
#
#  A propósito NO usa imágenes de stock ni vídeo generado por IA: para que una
#  cuenta nueva no parezca falsa, lo que más convence es enseñar el producto
#  real funcionando.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe las tildes y el €).
#
#  Uso:  .\generar-instagram-presentacion.ps1
# =============================================================================
param(
  [string]$Src = "$PSScriptRoot\..\demo-completo.mp4",
  [string]$Out = "$PSScriptRoot\instagram-presentacion.mp4"
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Src)) { throw "No existe la grabación de origen: $Src" }

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

# --- textos en ficheros (evita pelearse con el escapado de drawtext) ---
$txtDir = Join-Path $env:TEMP 'kone-ig-presentacion'
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
$textos = [ordered]@{
  'marca' = 'K-ONE'
  'sub'   = 'ENTRENAMIENTO · NUTRICIÓN'
  'hook1' = 'SOMOS NUEVOS'
  'hook2' = 'Por eso tu primer mes'
  'hook3' = 'es gratis'
  # Cada frase acompaña a lo que se ve en su tramo: la del tramo de nutrición
  # habla de comida, la del tramo de entreno habla de entreno. Y ninguna repite
  # el rótulo que la propia grabación ya trae grabado debajo.
  'cap1'  = 'Tu entrenamiento y tu dieta, en un solo sitio'
  'cap2'  = 'Se ajusta cada semana según tu progreso'
  'cap3'  = 'Comidas con opciones reales, no una lista cerrada'
  'cap4'  = 'Y tu lista de la compra, hecha sola'
  'cta1'  = 'PRIMER MES'
  'cta2'  = 'GRATIS'
  'cta3'  = 'Sin código. Automático al registrarte.'
  'cta4'  = 'k-one.fit'
}
foreach ($k in $textos.Keys) { [System.IO.File]::WriteAllText((Join-Path $txtDir "$k.txt"), $textos[$k], $enc) }

$T     = ($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'
$FIMP  = "C\:/Windows/Fonts/impact.ttf"
$FBAH  = "C\:/Windows/Fonts/bahnschrift.ttf"
$EMBER = '0xD1420E'
$W = 1080; $H = 1920; $FPS = 30

$work = Join-Path $env:TEMP 'kone-ig-escenas'
Remove-Item $work -Recurse -Force -EA SilentlyContinue
New-Item -ItemType Directory -Force -Path $work | Out-Null

# Encuadre del teléfono dentro del lienzo vertical. La grabación es 384x764;
# a 660 de ancho sube x1.72, suficiente para que se lean sus propios rótulos
# sin que se vea pixelada.
$VW = 660
$VH = 1312
$VX = [int](($W - $VW) / 2)
$VY = 300

function Invoke-Escena($filtro, $dur, $salida, $entrada) {
  $a = @('-y', '-hide_banner', '-v', 'error')
  if ($entrada) { $a += $entrada } else { $a += @('-f', 'lavfi', '-i', "color=c=0x08090B:s=${W}x${H}:d=$dur") }
  $a += @('-filter_complex', $filtro, '-map', '[vout]', '-an', '-t', $dur,
          '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
          '-pix_fmt', 'yuv420p', '-r', $FPS, $salida)
  & $ff @a
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg falló generando $salida" }
}

# ---------- ESCENA 1: gancho ----------
$f = @()
$f += "[0:v]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=430:fontsize=110:fontcolor=white:alpha='min(1,t*2)'[s1]"
$f += "[s1]drawbox=x=(iw-160)/2:y=580:w=160:h=5:color=${EMBER}@0.95:t=fill:enable='gte(t,0.25)'[s2]"
$f += "[s2]drawtext=fontfile='$FBAH':textfile='$T/sub.txt':x=(w-tw)/2:y=610:fontsize=32:fontcolor=0xCFCCC6:enable='gte(t,0.35)'[s3]"
$f += "[s3]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=880:fontsize=128:fontcolor=${EMBER}:enable='gte(t,0.8)'[s4]"
$f += "[s4]drawtext=fontfile='$FBAH':textfile='$T/hook2.txt':x=(w-tw)/2:y=1060:fontsize=54:fontcolor=white:enable='gte(t,1.5)'[s5]"
$f += "[s5]drawtext=fontfile='$FIMP':textfile='$T/hook3.txt':x=(w-tw)/2:y=1130:fontsize=104:fontcolor=white:enable='gte(t,1.9)'[vout]"
Invoke-Escena ($f -join ';') 3.6 (Join-Path $work '01.mp4') $null

# ---------- ESCENAS 2-5: fragmentos reales de la app ----------
# Cada tramo se eligió por lo que enseña; sus rótulos explicativos ya vienen
# grabados en la grabación original, así que aquí solo se añade la frase de
# arriba (y por eso el texto propio nunca baja de y=182: chocaría con ellos).
$tramos = @(
  @{ ini = 3.0;  dur = 4.6; cap = 'cap1' },
  @{ ini = 38.0; dur = 4.6; cap = 'cap2' },
  @{ ini = 97.0; dur = 4.6; cap = 'cap3' },
  @{ ini = 78.0; dur = 4.2; cap = 'cap4' }
)
$i = 1
foreach ($tr in $tramos) {
  $i++
  $n = '{0:00}' -f $i
  $g = @()
  $g += "[0:v]trim=start=$($tr.ini):duration=$($tr.dur),setpts=PTS-STARTPTS,fps=$FPS[v0]"
  $g += '[v0]split=2[bg][fg]'
  # Fondo: la propia grabación ampliada, desenfocada y oscurecida -> da color
  # y profundidad sin necesitar ninguna imagen de stock.
  $g += "[bg]scale=${W}:-2,crop=${W}:${H},gblur=sigma=42,eq=brightness=-0.40:saturation=0.55[bgb]"
  $g += "[fg]scale=${VW}:${VH}[fgs]"
  $g += "[bgb][fgs]overlay=${VX}:${VY}[base]"
  $g += "[base]drawbox=x=$($VX-2):y=$($VY-2):w=$($VW+4):h=$($VH+4):color=${EMBER}@0.7:t=3[fr]"
  $g += "[fr]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=88:fontsize=62:fontcolor=white:alpha=0.95[h1]"
  $g += "[h1]drawtext=fontfile='$FBAH':textfile='$T/$($tr.cap).txt':x=(w-tw)/2:y=182:fontsize=42:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=20[vout]"
  Invoke-Escena ($g -join ';') $tr.dur (Join-Path $work "$n.mp4") @('-i', $Src)
}

# ---------- ESCENA 6: cierre con la oferta ----------
$c = @()
$c += "[0:v]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=300:fontsize=72:fontcolor=white:alpha=0.95[c1]"
$c += "[c1]drawbox=x=(iw-140)/2:y=400:w=140:h=4:color=${EMBER}@0.95:t=fill[c2]"
$c += "[c2]drawtext=fontfile='$FBAH':textfile='$T/cta1.txt':x=(w-tw)/2:y=700:fontsize=58:fontcolor=white:enable='gte(t,0.2)'[c3]"
$c += "[c3]drawtext=fontfile='$FIMP':textfile='$T/cta2.txt':x=(w-tw)/2:y=780:fontsize=190:fontcolor=${EMBER}:enable='gte(t,0.45)'[c4]"
$c += "[c4]drawtext=fontfile='$FBAH':textfile='$T/cta3.txt':x=(w-tw)/2:y=1030:fontsize=40:fontcolor=0xCFCCC6:enable='gte(t,1.1)'[c5]"
$c += "[c5]drawbox=x=(iw-420)/2:y=1180:w=420:h=96:color=${EMBER}@0.95:t=fill:enable='gte(t,1.6)'[c6]"
$c += "[c6]drawtext=fontfile='$FIMP':textfile='$T/cta4.txt':x=(w-tw)/2:y=1196:fontsize=64:fontcolor=white:enable='gte(t,1.6)'[vout]"
Invoke-Escena ($c -join ';') 4.4 (Join-Path $work '06.mp4') $null

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
