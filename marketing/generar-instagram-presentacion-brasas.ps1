# =============================================================================
#  K-ONE · Instagram Reel — presentación con apertura de brasas (IA)
#
#  Variante de generar-instagram-presentacion.ps1: sustituye la escena 1
#  (fondo plano + texto) por un plano de brasas/ascuas generado con Higgsfield
#  (Kling 3.0 Turbo, texto->vídeo, sin caras ni gente -- encaja con el color
#  de marca "brasa" sin arriesgarse al look de "vídeo de IA genérico" de una
#  cara o cuerpo generado). El resto del vídeo sigue igual: cuatro tramos
#  REALES de la app (demo-completo.mp4) y el cierre con la oferta.
#
#  El clip de brasas NO se genera aquí (cuesta créditos de Higgsfield) -- se
#  espera ya descargado en $EmbersClip. Para generar uno nuevo, pedir un
#  vídeo texto->vídeo vertical de brasas/ascuas en la oscuridad, sin texto
#  ni logos ni gente.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe las tildes y el €).
#
#  Uso:  .\generar-instagram-presentacion-brasas.ps1 -EmbersClip "C:\ruta\brasas.mp4"
# =============================================================================
param(
  [Parameter(Mandatory = $true)][string]$EmbersClip,
  [string]$Src = "$PSScriptRoot\..\demo-completo.mp4",
  [string]$Out = "$PSScriptRoot\instagram-presentacion-brasas.mp4"
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Src)) { throw "No existe la grabación de origen: $Src" }
if (-not (Test-Path $EmbersClip)) { throw "No existe el clip de brasas: $EmbersClip" }

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }
$fp = Join-Path (Split-Path $ff) 'ffprobe.exe'

# Duración real del clip de brasas: la escena 1 no puede pedir más de lo que hay.
$embersDur = [double](& $fp -v error -show_entries format=duration -of csv=p=0 $EmbersClip)
$s1Dur = [math]::Min(2.9, [math]::Floor(($embersDur - 0.05) * 10) / 10)
if ($s1Dur -lt 1.5) { throw "El clip de brasas dura solo $embersDur s -- muy corto para la escena 1." }

# --- textos en ficheros (evita pelearse con el escapado de drawtext) ---
$txtDir = Join-Path $env:TEMP 'kone-ig-presentacion'
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
$textos = [ordered]@{
  'marca' = 'K-ONE'
  'hook1' = 'SOMOS NUEVOS'
  'hook2' = 'Por eso tu primer mes'
  'hook3' = 'es gratis'
  # Cada frase acompaña a lo que se ve en su tramo: la de nutrición habla de
  # comida, la de entreno habla de entreno. Ninguna repite el rótulo que la
  # propia grabación ya trae grabado debajo.
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

$work = Join-Path $env:TEMP 'kone-ig-escenas-brasas'
Remove-Item $work -Recurse -Force -EA SilentlyContinue
New-Item -ItemType Directory -Force -Path $work | Out-Null

# Encuadre del teléfono para las escenas de app real (igual que en la versión sin brasas).
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

# ---------- ESCENA 1: brasas (IA) + gancho ----------
# El clip de brasas ya es 9:16 -- solo se escala al lienzo final, sin recorte.
# 0.6s de brasas solas antes de que aparezca nada de texto: que respire.
$f = @()
$f += "[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setpts=PTS-STARTPTS,fps=$FPS[bg]"
$f += "[bg]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=460:fontsize=100:fontcolor=white:alpha='if(lt(t,0.6),0,min(1,(t-0.6)*2.5))'[s1]"
$f += "[s1]drawbox=x=(iw-150)/2:y=602:w=150:h=5:color=${EMBER}@0.95:t=fill:enable='gte(t,1.0)'[s2]"
$f += "[s2]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=920:fontsize=108:fontcolor=${EMBER}:enable='gte(t,1.2)'[s3]"
$f += "[s3]drawtext=fontfile='$FBAH':textfile='$T/hook2.txt':x=(w-tw)/2:y=1090:fontsize=46:fontcolor=white:enable='gte(t,1.9)'[s4]"
$f += "[s4]drawtext=fontfile='$FIMP':textfile='$T/hook3.txt':x=(w-tw)/2:y=1150:fontsize=88:fontcolor=white:enable='gte(t,2.3)'[vout]"
Invoke-Escena ($f -join ';') $s1Dur (Join-Path $work '01.mp4') @('-i', $EmbersClip)

# ---------- ESCENAS 2-5: fragmentos reales de la app ----------
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
