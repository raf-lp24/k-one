# =============================================================================
#  K-ONE · TikTok — "Mes gratis para nuevos seguidores"
#
#  Monta una grabación de pantalla vertical en un vídeo 1080x1920 con el
#  mensaje de la promoción: gancho, demo de la web enmarcada y cierre con la
#  mecánica (seguir + DM).
#
#  IMPORTANTE — para que sea promocionable, la grabación debe hacerse con el
#  modo "Ocultar calorías" ACTIVADO en Nutrición, y sin que aparezcan el peso
#  corporal ni la palabra "perder grasa" en pantalla.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe las tildes y el €).
#
#  Uso:
#    .\montar-tiktok-mes-gratis.ps1 -Src "C:\ruta\grabacion.mp4" -Inicio 4 -Dur 18
# =============================================================================
param(
  [string]$Src    = "",
  [string]$Out    = "$PSScriptRoot\tiktok-mes-gratis.mp4",
  [double]$Inicio = 0.0,    # segundo de la grabación donde empieza lo interesante
  [double]$Dur    = 18.0    # duración final del vídeo
)

$ErrorActionPreference = 'Stop'
if (-not $Src) { throw "Falta -Src: la ruta de la grabación de pantalla." }
if (-not (Test-Path $Src)) { throw "No existe el vídeo de origen: $Src" }

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw "No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e" }
$fp = Join-Path (Split-Path $ff) 'ffprobe.exe'

# Tamaño real de la grabación -> encuadre automático
$dim = (& $fp -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x $Src).Trim()
$sw, $sh = $dim.Split('x')
$ratio = [double]$sh / [double]$sw

# La duración pedida no puede superar el material disponible desde -Inicio, o el
# cierre (que va anclado al final) se quedaría fuera del vídeo.
$srcDur = [double](& $fp -v error -show_entries format=duration -of csv=p=0 $Src)
$disp = [math]::Floor(($srcDur - $Inicio) * 10) / 10
if ($disp -le 6) { throw "Solo hay $disp s de material desde el segundo $Inicio. Usa un -Inicio menor." }
if ($Dur -gt $disp) {
  Write-Host "AVISO: pediste $Dur s pero desde el segundo $Inicio solo hay $disp s. Se ajusta a $disp s."
  $Dur = $disp
}

# --- textos ---
$txtDir = Join-Path $env:TEMP "kone-mesgratis-txt"
New-Item -ItemType Directory -Force -Path $txtDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
$textos = [ordered]@{
  'marca'  = 'K-ONE'
  'sub'    = 'PLAN DE ENTRENAMIENTO Y NUTRICIÓN'
  # Gancho: la oferta primero, que es lo que para el scroll
  'hook1'  = 'UN MES GRATIS'
  'hook2'  = 'para nuevos seguidores'
  'c1'     = 'Tu plan de entrenamiento, semana a semana'
  'c2'     = 'Tus comidas, con 5 opciones cada una'
  'c3'     = 'Y tu lista de la compra hecha sola'
  # Cierre: la mecánica, clara y sin promesas de resultados
  'cta1'   = 'SÍGUEME Y ESCRIBE'
  'cta2'   = '"GRATIS"'
  'cta3'   = 'por privado'
}
foreach ($k in $textos.Keys) { [System.IO.File]::WriteAllText("$txtDir\$k.txt", $textos[$k], $enc) }

$T     = ($txtDir -replace '\\','/') -replace '^([A-Za-z]):','$1\:'
$FIMP  = "C\:/Windows/Fonts/impact.ttf"
$FBAH  = "C\:/Windows/Fonts/bahnschrift.ttf"
$EMBER = "0xE8490F"

# Encuadre
$VW = 660
$VH = [int][Math]::Round($VW * $ratio / 2) * 2
$maxH = 1300
if ($VH -gt $maxH) { $VW = [int][Math]::Round($maxH / $ratio / 2) * 2; $VH = [int][Math]::Round($VW * $ratio / 2) * 2 }
$VX = [int]((1080 - $VW) / 2)
$VY = 300
$capY = [Math]::Min(1700, $VY + $VH + 40)

$f  = @()
$f += "[0:v]trim=start=$Inicio,setpts=PTS-STARTPTS,fps=30[v0]"
$f += "[v0]split=2[bg][fg]"
$f += "[bg]scale=1080:-2,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.36:saturation=0.55[bgb]"
$f += "[fg]scale=${VW}:${VH}[fgs]"
$f += "[bgb][fgs]overlay=${VX}:${VY}[base]"
$f += "[base]drawbox=x=$($VX-2):y=$($VY-2):w=$($VW+4):h=$($VH+4):color=${EMBER}@0.75:t=3[fr]"

# Cabecera + chip de oferta permanente (recuerda la promo todo el vídeo)
$f += "[fr]drawtext=fontfile='$FIMP':textfile='$T/marca.txt':x=(w-tw)/2:y=88:fontsize=84:fontcolor=white:alpha=0.96[h1]"
$f += "[h1]drawbox=x=(iw-150)/2:y=184:w=150:h=4:color=${EMBER}@0.95:t=fill[h2]"
$f += "[h2]drawtext=fontfile='$FBAH':textfile='$T/sub.txt':x=(w-tw)/2:y=204:fontsize=30:fontcolor=0xCFCCC6[h3]"
$f += "[h3]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=246:fontsize=44:fontcolor=${EMBER}:enable='gte(t,2.6)'[h4]"

# GANCHO (0-2,6 s): la oferta a pantalla completa
$f += "[h4]drawbox=x=0:y=0:w=1080:h=1920:color=black@0.84:t=fill:enable='between(t,0,2.6)'[gk0]"
$f += "[gk0]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=790:fontsize=136:fontcolor=${EMBER}:enable='between(t,0,2.6)'[gk1]"
$f += "[gk1]drawtext=fontfile='$FBAH':textfile='$T/hook2.txt':x=(w-tw)/2:y=950:fontsize=54:fontcolor=white:enable='between(t,0.5,2.6)'[gk2]"

# Rótulos de funcionalidades
$cap = @(
  @{f='c1'; a=2.6;  b=[Math]::Round($Dur*0.42,1)},
  @{f='c2'; a=[Math]::Round($Dur*0.42,1); b=[Math]::Round($Dur*0.70,1)},
  @{f='c3'; a=[Math]::Round($Dur*0.70,1); b=[Math]::Round($Dur-3.2,1)}
)
$prev='gk2'; $i=0
foreach ($c in $cap) {
  $i++; $lbl="cap$i"
  $f += "[$prev]drawtext=fontfile='$FBAH':textfile='$T/$($c.f).txt':x=(w-tw)/2:y=${capY}:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.58:boxborderw=22:enable='between(t,$($c.a),$($c.b))'[$lbl]"
  $prev=$lbl
}

# CIERRE (últimos 3,2 s): la mecánica de la promo
$ini = [Math]::Round($Dur-3.2,1)
$f += "[$prev]drawbox=x=0:y=0:w=1080:h=1920:color=black@0.86:t=fill:enable='gte(t,$ini)'[cl0]"
$f += "[cl0]drawtext=fontfile='$FIMP':textfile='$T/hook1.txt':x=(w-tw)/2:y=640:fontsize=118:fontcolor=${EMBER}:enable='gte(t,$ini)'[cl1]"
$f += "[cl1]drawtext=fontfile='$FBAH':textfile='$T/cta1.txt':x=(w-tw)/2:y=830:fontsize=52:fontcolor=white:enable='gte(t,$ini)'[cl2]"
$f += "[cl2]drawtext=fontfile='$FIMP':textfile='$T/cta2.txt':x=(w-tw)/2:y=900:fontsize=96:fontcolor=white:enable='gte(t,$ini)'[cl3]"
$f += "[cl3]drawtext=fontfile='$FBAH':textfile='$T/cta3.txt':x=(w-tw)/2:y=1010:fontsize=48:fontcolor=0xCFCCC6:enable='gte(t,$ini)'[cl4]"
$f += "[cl4]drawtext=fontfile='$FBAH':text='k-one.fit':x=(w-tw)/2:y=1120:fontsize=54:fontcolor=${EMBER}:enable='gte(t,$ini)'[cl5]"

$f += "[cl5]drawbox=x=0:y=1906:w='1080*t/$Dur':h=8:color=${EMBER}@0.95:t=fill[vout]"

& $ff -y -hide_banner -v error -i $Src `
  -filter_complex ($f -join ";") -map "[vout]" -an `
  -t $Dur -c:v libx264 -profile:v high -preset slow -crf 20 `
  -pix_fmt yuv420p -r 30 -movflags +faststart $Out

if (Test-Path $Out) {
  "OK (origen ${sw}x${sh}, marco ${VW}x${VH}) -> $Out  ($([math]::Round((Get-Item $Out).Length/1MB,2)) MB, ${Dur}s)"
} else { throw "No se generó el vídeo" }
