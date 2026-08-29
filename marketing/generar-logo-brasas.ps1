# =============================================================================
#  K-ONE · "K-ONE" formándose de brasas — pieza independiente (bumper/logo)
#
#  NO es para el Reel de presentación (eso es generar-instagram-presentacion-
#  brasas.ps1) -- esto es un vídeo suelto de 4s: el logotipo se forma a
#  partir de brasas y chispas en la oscuridad, y se queda quieto y legible
#  al final. Sirve como apertura para cualquier vídeo futuro, o como pieza
#  para subir sola (historia, portada de perfil animada, etc.).
#
#  Cómo se hizo (para poder repetirlo o generar una variante nueva):
#  1. Se renderizó el logotipo real de la marca (Bebas Neue, "K-" blanco +
#     "ONE" en brasa) como imagen nítida -- ai-logo-brasas-startimage.png.
#     Esto es clave: a un vídeo de IA NUNCA se le pide que "escriba" el
#     nombre, porque el texto generado por IA en vídeo sale deformado o
#     ilegible casi siempre. La tipografía la pone ffmpeg/Chrome, no la IA.
#  2. Esa imagen se mandó a Higgsfield (Kling 3.0 Turbo, imagen->vídeo,
#     start_image) pidiendo que las letras se desintegren en brasas y
#     chispas que se dispersan en la oscuridad -- ai-logo-brasas-raw.mp4.
#  3. Aquí se INVIERTE ese vídeo: lo que se grabó como "el logo se deshace"
#     se reproduce al revés y se ve como "las brasas se juntan y forman el
#     logo". Es el mismo truco que evita pedirle texto a la IA: dejar que
#     haga la física de las partículas (se le da bien) e invertir para
#     conseguir el efecto contrario (que no sabe hacer directamente).
#  4. Se añade una pausa al final (se clona el último fotograma) para que
#     el logo se quede quieto y legible en vez de cortar en seco.
#
#  Este script SOLO hace el paso 3-4 (no gasta créditos de Higgsfield): usa
#  el vídeo crudo ya generado y guardado en el repo (ai-logo-brasas-raw.mp4).
#  Para una variante nueva desde cero, generar primero otra imagen de logo y
#  otro vídeo imagen->vídeo con el mismo planteamiento, y apuntar -RawClip
#  al nuevo fichero.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#
#  Uso:  .\generar-logo-brasas.ps1
# =============================================================================
param(
  [string]$RawClip = "$PSScriptRoot\ai-logo-brasas-raw.mp4",
  [string]$Out      = "$PSScriptRoot\logo-brasas.mp4",
  [double]$Pausa    = 1.0   # segundos que el logo queda quieto al final
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $RawClip)) { throw "No existe el clip crudo de brasas: $RawClip" }

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw 'No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e' }

& $ff -y -hide_banner -v error -i $RawClip `
  -vf "reverse,scale=1080:1920,tpad=stop_mode=clone:stop_duration=$Pausa" `
  -an -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart `
  $Out

if (Test-Path $Out) {
  $mb = [math]::Round((Get-Item $Out).Length / 1MB, 2)
  "OK -> $Out  ($mb MB)"
} else { throw 'No se generó el vídeo' }
