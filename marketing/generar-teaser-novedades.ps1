# =============================================================================
#  K-ONE · teaser "TRAEMOS NOVEDADES" (6,7 s, vertical 1080x1920)
#
#  Pieza de intriga para subir ANTES del vídeo que anuncia la novedad de verdad
#  (la app en la pantalla de inicio y los avisos al móvil: kone-app-avisos.mp4).
#  No cuenta qué es la novedad a propósito -- solo la anuncia y remata con la
#  marca.
#
#  Montaje, dos trozos pegados a corte seco:
#    1. Rótulo "TRAEMOS / NOVEDADES" sobre negro, con un rescoldo que late y
#       chispas subiendo. Se apaga al final dejando solo las chispas, que es lo
#       que engancha con el trozo 2 -- por eso el corte no se nota como dos
#       vídeos distintos. Se renderiza aquí (titulo-novedades.html + Chrome).
#    2. logo-brasas.mp4: las brasas se juntan y forman el logotipo, que se queda
#       quieto y legible. Ese clip ya está hecho y NO gasta créditos de IA
#       (ver generar-logo-brasas.ps1 para saber cómo se hizo).
#
#  Al trozo 2 se le da un zoom de 1,4x recortando al centro. Sin él, el
#  logotipo del clip original queda a la mitad de tamaño que el rótulo
#  "NOVEDADES" y el remate se ve flojo justo donde tiene que pegar más.
#
#  Por qué el rótulo se renderiza con Chrome y no con drawtext de ffmpeg: la
#  tipografía de la marca es Bebas Neue y NO está instalada en esta máquina, así
#  que ffmpeg no puede escribirla. Chrome la carga de Google Fonts (hace falta
#  conexión). Ojo al gotcha documentado en el HTML: un canvas no dispara por sí
#  solo la descarga de una webfont.
#
#  Requiere:
#    - ffmpeg   ->  winget install --id Gyan.FFmpeg -e
#    - Node.js  (ya instalado)
#    - Google Chrome en la ruta estándar de Program Files
#
#  Uso:  .\generar-teaser-novedades.ps1
# =============================================================================
param(
  [string]$Salida = "$PSScriptRoot\kone-teaser-novedades.mp4",
  [double]$DuracionRotulo = 2.7,   # segundos del rótulo antes del corte
  [int]   $Fps = 30,
  [double]$Zoom = 1.4              # ampliación del clip de brasas
)

$ErrorActionPreference = 'Stop'

$rotulo = "$PSScriptRoot\titulo-novedades.html"
$brasas = "$PSScriptRoot\logo-brasas.mp4"
$render = "$PSScriptRoot\cdp-frames.mjs"
foreach ($f in @($rotulo, $brasas, $render)) {
  if (-not (Test-Path $f)) { throw "Falta un archivo necesario: $f" }
}

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

# Carpeta temporal para los PNG del rótulo; se borra al terminar.
$frames = Join-Path $env:TEMP ("kone-teaser-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $frames -Force | Out-Null

try {
  $urlRotulo = 'file:///' + ($rotulo -replace '\\', '/' -replace ' ', '%20')
  Write-Host "Renderizando el rótulo ($DuracionRotulo s a $Fps fps)..."
  & node $render $urlRotulo $frames $DuracionRotulo $Fps 1080 1920
  if ($LASTEXITCODE -ne 0) { throw 'Falló el render del rótulo' }

  $n = (Get-ChildItem $frames -Filter '*.png').Count
  if ($n -lt 2) { throw "El render solo produjo $n fotogramas" }
  Write-Host "$n fotogramas listos. Montando..."

  # El clip de brasas se amplía y se recorta al centro (el logotipo va centrado,
  # así que sigue centrado). Las dos partes se normalizan a yuv420p y SAR 1:1
  # antes de concatenar, o concat se queja.
  $w = [int](1080 * $Zoom); $h = [int](1920 * $Zoom)
  $filtro = "[0:v]format=yuv420p,setsar=1[a];" +
            "[1:v]scale=${w}:${h},crop=1080:1920,format=yuv420p,setsar=1[b];" +
            "[a][b]concat=n=2:v=1:a=0[v]"

  & $ff -y -hide_banner -v error `
    -framerate $Fps -i (Join-Path $frames 'f%05d.png') `
    -i $brasas `
    -filter_complex $filtro -map '[v]' `
    -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -r $Fps -movflags +faststart `
    $Salida
  if ($LASTEXITCODE -ne 0) { throw 'Falló el montaje con ffmpeg' }
}
finally {
  Remove-Item $frames -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $Salida) {
  $mb = [math]::Round((Get-Item $Salida).Length / 1MB, 2)
  "OK -> $Salida  ($mb MB)"
} else { throw 'No se generó el vídeo' }
