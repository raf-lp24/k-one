# =============================================================================
#  K-ONE · Reel "Cómo darse de alta" (36,5 s, vertical 1080x1920)
#
#  Explica el alta y los seis bloques del cuestionario.
#
#  NO REGISTRA NINGUNA CUENTA. index.html apunta a la Supabase de PRODUCCIÓN,
#  así que enviar el formulario crearía un cliente falso de verdad y dispararía
#  sus emails. estado-demo-alta.js solo rellena los campos y navega entre
#  bloques: lo que se captura son las PANTALLAS.
#
#  Las capturas son de la app REAL, no maquetas: se generan en el momento con
#  cdp-shot.mjs sobre el servidor local, preparando el estado con
#  estado-demo-alta.js. Los datos son de un cliente INVENTADO ("Carlos García
#  López") a propósito -- nunca los de un cliente de verdad en marketing.
#
#  Por qué las capturas se hacen así y no con una grabación de pantalla:
#  Chrome headless en Windows no baja de ~504 px de ventana, así que una captura
#  normal falsea el diseño móvil. Emulation.setDeviceMetricsOverride (lo que usa
#  cdp-shot.mjs) sí da un 390x844 real a 3x.
#
#  Requiere: ffmpeg, Node.js, Google Chrome, y el servidor local en :8080
#  (npx http-server . -p 8080 desde la raíz del proyecto).
#
#  Uso:  .\generar-reel-hoy.ps1
# =============================================================================
param(
  [string]$Salida  = "$PSScriptRoot\Videos\kone-como-registrarse.mp4",
  [string]$BaseUrl = "http://localhost:8080",
  [int]   $Fps     = 25,
  [double]$Dur     = 36.5
)

$ErrorActionPreference = 'Stop'

foreach ($f in @("$PSScriptRoot\cdp-shot.mjs", "$PSScriptRoot\cdp-frames.mjs",
                 "$PSScriptRoot\estado-demo-alta.js", "$PSScriptRoot\reel-alta.html")) {
  if (-not (Test-Path $f)) { throw "Falta un archivo necesario: $f" }
}
New-Item -ItemType Directory -Force -Path (Split-Path $Salida) | Out-Null

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

# Las capturas van a marketing/_tmp-alta porque reel-alta.html las pide por URL
# (/marketing/_tmp-alta/*.png) y tienen que estar donde las sirva el servidor.
$shots  = "$PSScriptRoot\_tmp-alta"
$frames = Join-Path $env:TEMP ("kone-reel-hoy-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $shots, $frames | Out-Null

try {
  Write-Host "1/3 · Capturando la app real..."
  foreach ($vista in @('registro','cuerpo','salud','vida','alimentacion','objetivo','entrenamiento')) {
    $prep = Join-Path $frames "prep-$vista.js"
    # La vista se inyecta ANTES del script de estado, que la lee de __VISTA.
    "window.__VISTA=`"$vista`";" | Out-File -FilePath $prep -Encoding utf8
    Get-Content "$PSScriptRoot\estado-demo-alta.js" -Raw | Add-Content -Path $prep -Encoding utf8
    & node "$PSScriptRoot\cdp-shot.mjs" $BaseUrl (Join-Path $shots "$vista.png") 390 844 3 $prep
    if ($LASTEXITCODE -ne 0) { throw "Falló la captura de la vista '$vista'" }
  }

  Write-Host "2/3 · Renderizando los fotogramas del reel..."
  & node "$PSScriptRoot\cdp-frames.mjs" "$BaseUrl/marketing/reel-alta.html" $frames $Dur $Fps 1080 1920
  if ($LASTEXITCODE -ne 0) { throw 'Falló el render de los fotogramas' }

  Write-Host "3/3 · Montando el vídeo..."
  & $ff -y -hide_banner -v error -framerate $Fps -i (Join-Path $frames 'f%05d.png') `
    -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -r $Fps -movflags +faststart `
    $Salida
  if ($LASTEXITCODE -ne 0) { throw 'Falló el montaje con ffmpeg' }
}
finally {
  Remove-Item $frames -Recurse -Force -ErrorAction SilentlyContinue
  # Las capturas también: son material intermedio y además reflejan un estado
  # concreto (semana, racha) que caduca.
  Remove-Item $shots -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $Salida) {
  $mb = [math]::Round((Get-Item $Salida).Length / 1MB, 2)
  "OK -> $Salida  ($mb MB)"
} else { throw 'No se generó el vídeo' }
