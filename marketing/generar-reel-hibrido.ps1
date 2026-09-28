# =============================================================================
#  K-ONE · Reel "Plan Híbrido" (~30 s, vertical 1080x1920)
#
#  Copia de generar-reel-hoy.ps1 apuntando al perfil Híbrido (estado-demo-
#  hibrido.js + reel-hibrido.html). Capturas de la app REAL, cliente
#  inventado ("Laura"), sin IA generativa.
#
#  Requiere: ffmpeg, Node.js, Google Chrome, y el servidor local en :8080
#  (npx http-server . -p 8080 desde la raíz del proyecto).
#
#  Uso:  .\generar-reel-hibrido.ps1
# =============================================================================
param(
  [string]$Salida  = "$PSScriptRoot\Videos\kone-hibrido-como-funciona.mp4",
  [string]$BaseUrl = "http://localhost:8080",
  [int]   $Fps     = 25,
  [double]$Dur     = 29.6
)

$ErrorActionPreference = 'Stop'

foreach ($f in @("$PSScriptRoot\cdp-shot.mjs", "$PSScriptRoot\cdp-frames.mjs",
                 "$PSScriptRoot\estado-demo-hibrido.js", "$PSScriptRoot\reel-hibrido.html")) {
  if (-not (Test-Path $f)) { throw "Falta un archivo necesario: $f" }
}
New-Item -ItemType Directory -Force -Path (Split-Path $Salida) | Out-Null

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

$shots  = "$PSScriptRoot\_tmp-hibrido"
$frames = Join-Path $env:TEMP ("kone-reel-hibrido-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $shots, $frames | Out-Null

try {
  Write-Host "1/3 · Capturando la app real (perfil Híbrido)..."
  foreach ($vista in @('hoy','semana','tarjeta','comosehace','peso','feedback')) {
    $prep = Join-Path $frames "prep-$vista.js"
    "window.__VISTA=`"$vista`";" | Out-File -FilePath $prep -Encoding utf8
    Get-Content "$PSScriptRoot\estado-demo-hibrido.js" -Raw | Add-Content -Path $prep -Encoding utf8
    & node "$PSScriptRoot\cdp-shot.mjs" $BaseUrl (Join-Path $shots "$vista.png") 390 844 3 $prep
    if ($LASTEXITCODE -ne 0) { throw "Falló la captura de la vista '$vista'" }
  }

  Write-Host "2/3 · Renderizando los fotogramas del reel..."
  & node "$PSScriptRoot\cdp-frames.mjs" "$BaseUrl/marketing/reel-hibrido.html" $frames $Dur $Fps 1080 1920
  if ($LASTEXITCODE -ne 0) { throw 'Falló el render de los fotogramas' }

  Write-Host "3/3 · Montando el vídeo..."
  & $ff -y -hide_banner -v error -framerate $Fps -i (Join-Path $frames 'f%05d.png') `
    -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -r $Fps -movflags +faststart `
    $Salida
  if ($LASTEXITCODE -ne 0) { throw 'Falló el montaje con ffmpeg' }
}
finally {
  Remove-Item $frames -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $shots -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $Salida) {
  $mb = [math]::Round((Get-Item $Salida).Length / 1MB, 2)
  "OK -> $Salida  ($mb MB)"
} else { throw 'No se generó el vídeo' }
