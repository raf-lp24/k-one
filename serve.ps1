param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Sirviendo $Root en http://localhost:$Port/"

$mimeMap = @{
  ".html" = "text/html"
  ".htm"  = "text/html"
  ".js"   = "application/javascript"
  ".css"  = "text/css"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".webp" = "image/webp"
  ".pdf"  = "application/pdf"
  ".woff2"= "font/woff2"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $path = $request.Url.AbsolutePath
  if ($path -eq "/") { $path = "/index.html" }

  $filePath = Join-Path $Root ($path.TrimStart("/"))

  # Un cliente que cancela la descarga (recargar con imágenes a medias) tumbaba el
  # servidor entero; se ignora el error de esa conexión y se sigue escuchando.
  try {
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $contentType = $mimeMap[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.StatusCode = 404
      $response.ContentType = "text/plain"
      $response.ContentLength64 = $msg.Length   # sin esto, Write excedía Content-Length y lanzaba
      $response.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch { }

  try { $response.OutputStream.Close() } catch { }
}
