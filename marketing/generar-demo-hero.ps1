# =============================================================================
#  K-ONE · GENERADOR DEL VIDEO DEMO DE LA PORTADA (hero de la landing)
#
#  Sustituye a demo.mp4, que era una grabacion real de pantalla de antes de
#  julio de 2026 y ya no refleja la app actual (precios viejos, sin hitos con
#  descuento, sesion sin las etiquetas de musculo por tipo de entrenamiento).
#
#  Igual que generar-tiktok-mes-gratis.ps1: no es una grabacion, se dibuja la
#  interfaz fotograma a fotograma con System.Drawing y se ensambla con ffmpeg.
#  Asi se controla exactamente que aparece y se evita mostrar datos reales de
#  ningun cliente.
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe tildes y €).
#
#  Uso:  .\generar-demo-hero.ps1
# =============================================================================
param(
  [string]$Out = "$PSScriptRoot\..\demo.mp4",
  [int]$Fps    = 30
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw "No encuentro ffmpeg. Instalalo con:  winget install --id Gyan.FFmpeg -e" }

# Sin marco de telefono: el video es solo el contenido de pantalla a sangre
# completa (la web ya pone el marco alrededor). Mismo ratio que la pantalla
# interna (PW:PH mas abajo), escalado x1.25 para que se vea nitido.
$W = 800; $H = 1612
$frameDir = Join-Path $env:TEMP "kone-frames-hero"
if (Test-Path $frameDir) { Remove-Item "$frameDir\*.png" -Force -EA SilentlyContinue } else { New-Item -ItemType Directory -Force -Path $frameDir | Out-Null }

# ---------- paleta de la marca ----------
$cNegro   = [System.Drawing.Color]::FromArgb(10,10,10)
$cCarbon  = [System.Drawing.Color]::FromArgb(20,19,18)
$cGrafito = [System.Drawing.Color]::FromArgb(28,27,26)
$cHumo    = [System.Drawing.Color]::FromArgb(38,36,34)
$cBrasa   = [System.Drawing.Color]::FromArgb(232,73,15)
$cBlanco  = [System.Drawing.Color]::FromArgb(244,241,236)
$cMetal   = [System.Drawing.Color]::FromArgb(143,135,126)
$cMetalCl = [System.Drawing.Color]::FromArgb(190,183,175)
$cVerde   = [System.Drawing.Color]::FromArgb(39,174,96)

$bNegro=New-Object System.Drawing.SolidBrush $cNegro
$bCarbon=New-Object System.Drawing.SolidBrush $cCarbon
$bGrafito=New-Object System.Drawing.SolidBrush $cGrafito
$bBrasa=New-Object System.Drawing.SolidBrush $cBrasa
$bBlanco=New-Object System.Drawing.SolidBrush $cBlanco
$bMetal=New-Object System.Drawing.SolidBrush $cMetal
$bMetalCl=New-Object System.Drawing.SolidBrush $cMetalCl
$bVerde=New-Object System.Drawing.SolidBrush $cVerde
$pBrasa=New-Object System.Drawing.Pen $cBrasa,3
$pHumo=New-Object System.Drawing.Pen $cHumo,2

# ---------- tipografias ----------
function F($name,$size,$style='Regular'){
  New-Object System.Drawing.Font($name,$size,[System.Drawing.FontStyle]::$style,[System.Drawing.GraphicsUnit]::Pixel)
}
$fTitulo   = F 'Impact' 92
$fMarca    = F 'Impact' 78
$fAppTit   = F 'Impact' 42
$fAppTit2  = F 'Impact' 30
$fSub      = F 'Bahnschrift' 32
$fCap      = F 'Bahnschrift' 40
$fBody     = F 'Segoe UI' 24
$fBodyB    = F 'Segoe UI' 24 'Bold'
$fSmall    = F 'Segoe UI' 22
$fSmallB   = F 'Segoe UI' 22 'Bold'
$fTiny     = F 'Segoe UI' 18
$fMono     = F 'Consolas' 19
$fMonoS    = F 'Consolas' 16

# ---------- helpers ----------
function RoundPath($x,$y,$w,$h,$r){
  $p=New-Object System.Drawing.Drawing2D.GraphicsPath
  $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
  return $p
}
function FillRound($g,$brush,$x,$y,$w,$h,$r){
  $p=RoundPath $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose()
}
function StrokeRound($g,$pen,$x,$y,$w,$h,$r){
  $p=RoundPath $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose()
}
function Txt($g,$s,$font,$brush,$x,$y){ $g.DrawString($s,$font,$brush,[float]$x,[float]$y) }
function TxtC($g,$s,$font,$brush,$cx,$y){
  $m=$g.MeasureString($s,$font)
  $g.DrawString($s,$font,$brush,[float]($cx-$m.Width/2),[float]$y)
}
function Wid($g,$s,$font){ return $g.MeasureString($s,$font).Width }
function Pill($g,$s,$font,$x,$y,$colBorde,$colTexto){
  $w=(Wid $g $s $font)+26; $h=36
  $pen=New-Object System.Drawing.Pen $colBorde,2
  StrokeRound $g $pen $x $y $w $h 18
  $pen.Dispose()
  $br=New-Object System.Drawing.SolidBrush $colTexto
  Txt $g $s $font $br ($x+13) ($y+8)
  $br.Dispose()
  return $w
}

# =============================================================================
#  CONTENIDO (calcado de textos y datos reales de la app actual, sin usar
#  datos de ningun cliente real)
# =============================================================================
$ejercicios = @(
  @{n='PRESS BANCA';       s='4'; r='8';  rpe='8'},
  @{n='REMO CON MANCUERNA';s='3'; r='10'; rpe='8'},
  @{n='PRESS MILITAR';     s='3'; r='10'; rpe='8.5'; peso='22'; anterior='20'},
  @{n='JALON AL PECHO';    s='3'; r='12'; rpe='8'}
)
$comidas = @(
  @{t='DESAYUNO · 7:30';      n='Muesli con leche, nueces y kiwi';          kcal='630 kcal'; prot='20g prot'},
  @{t='MEDIA MAÑANA · 10:30'; n='Smoothie de platano y frutos rojos';       kcal='265 kcal'; prot='5g prot'},
  @{t='COMIDA · 14:00';       n='Salmon con arroz y edamame';               kcal='710 kcal'; prot='42g prot'}
)
$niveles = @(
  @{n='CHISPA';  min=5;  premio='Insignia en tu perfil';               logrado=$true},
  @{n='BRASA';   min=10; premio='Anillo de fuego en tu avatar';        logrado=$true},
  @{n='FUEGO';   min=15; premio='10% de descuento en tu proxima cuota';logrado=$true},
  @{n='HIERRO';  min=22; premio='20% de descuento en tu proxima cuota';logrado=$false},
  @{n='LEYENDA'; min=30; premio='Titulo Leyenda K-ONE';                logrado=$false}
)

$PW=640; $PH=1290

function Draw-Entreno($g,$off){
  $y = 30 - $off
  Txt $g '// SESION DE HOY · SEMANA 1 · DIA 1' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'FUERZA · TREN SUPERIOR' $fAppTit $bBlanco 28 $y
  $y += 58
  $tx = 30
  foreach($m in @('PECHO','TRICEPS','ESPALDA')){
    $tx += (Pill $g $m $fTiny $tx $y $cMetal $cMetalCl) + 12
  }
  $y += 64
  # fila de stats
  $cols = @(@{l='DURACION';v='65 MIN'},@{l='INTENSIDAD';v='ALTA'},@{l='EJERCICIOS';v='6'})
  $cx = 30
  foreach($c in $cols){
    Txt $g $c.l $fMonoS $bMetal $cx $y
    Txt $g $c.v $fBodyB $bBlanco $cx ($y+26)
    $cx += 200
  }
  $y += 84
  FillRound $g $bBrasa 30 $y 580 84 14
  TxtC $g 'EMPEZAR ENTRENAMIENTO  ▶' $fSmallB $bBlanco (30+290) ($y+30)
  $y += 120
  Txt $g '01  BLOQUE DE FUERZA' $fAppTit2 $bBlanco 30 $y
  $y += 54
  foreach($e in $ejercicios){
    if($y -gt $PH){ break }
    $hCard = if($e.anterior){ 172 } else { 132 }
    FillRound $g $bGrafito 26 $y 588 $hCard 12
    $cxp = 66; $cyp = $y + 44
    $g.FillEllipse($bBrasa,($cxp-22),($cyp-22),44,44)
    $tri=New-Object System.Drawing.Drawing2D.GraphicsPath
    $tri.AddPolygon(@(
      (New-Object System.Drawing.PointF(($cxp-6),($cyp-10))),
      (New-Object System.Drawing.PointF(($cxp-6),($cyp+10))),
      (New-Object System.Drawing.PointF(($cxp+11),$cyp))
    ))
    $g.FillPath($bBlanco,$tri); $tri.Dispose()
    Txt $g $e.n $fBodyB $bBlanco 104 ($y+20)
    Txt $g ('RPE ' + $e.rpe) $fMonoS $bBrasa 500 ($y+22)
    Txt $g 'SERIES' $fMonoS $bMetal 104 ($y+62)
    Txt $g $e.s $fBodyB $bBlanco 104 ($y+84)
    Txt $g 'REPS' $fMonoS $bMetal 300 ($y+62)
    Txt $g $e.r $fBodyB $bBlanco 300 ($y+84)
    if($e.anterior){
      Txt $g 'CARGA (KG)' $fMonoS $bMetal 450 ($y+62)
      FillRound $g $bCarbon 450 ($y+80) 110 34 8
      TxtC $g $e.peso $fSmall $bBlanco 505 ($y+85)
      Txt $g ('Anterior: ' + $e.anterior + ' kg') $fMonoS $bBrasa 104 ($y+134)
    }
    $y += $hCard + 12
  }
}

function Draw-Progreso($g,$off){
  $y = 30 - $off
  Txt $g '// ESTA SEMANA' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'TU CONSTANCIA' $fAppTit $bBlanco 28 $y
  $y += 70
  FillRound $g $bGrafito 26 $y 284 250 14
  Txt $g 'ADHERENCIA' $fMonoS $bMetal 46 ($y+30)
  Txt $g '75%' $fTitulo $bBrasa 46 ($y+66)
  FillRound $g $bCarbon 46 ($y+178) 224 14 7
  FillRound $g $bBrasa 46 ($y+178) 168 14 7
  Txt $g '3/4 dias esta semana' $fTiny $bMetalCl 46 ($y+206)

  FillRound $g $bGrafito 332 $y 284 250 14
  Txt $g 'RACHA' $fMonoS $bMetal 352 ($y+30)
  Txt $g '12' $fTitulo $bBlanco 352 ($y+66)
  Txt $g 'dias seguidos' $fTiny $bMetalCl 352 ($y+178)
  Txt $g 'entrenando' $fTiny $bMetalCl 352 ($y+202)
  $y += 290

  FillRound $g $bGrafito 26 $y 588 96 14
  StrokeRound $g $pBrasa 26 $y 588 96 14
  Txt $g 'INVITA Y GANA' $fMonoS $bBrasa 46 ($y+18)
  Txt $g '5€ por cada amigo que se una (max. 15€)' $fSmall $bBlanco 46 ($y+50)
}

function Draw-KcalMacros($g,$off){
  $y = 30 - $off
  Txt $g '// TU OBJETIVO DIARIO' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'CALORIAS Y MACROS' $fAppTit $bBlanco 28 $y
  $y += 66
  FillRound $g $bGrafito 26 $y 588 130 14
  Txt $g 'KCAL OBJETIVO' $fMonoS $bMetal 46 ($y+26)
  Txt $g '2450' $fTitulo $bBrasa 46 ($y+50)
  $y += 156
  $macros = @(@{l='PROT';v='170g'},@{l='CARB';v='230g'},@{l='GRASA';v='75g'})
  $mx = 26
  foreach($m in $macros){
    FillRound $g $bGrafito $mx $y 184 110 12
    TxtC $g $m.l $fMonoS $bMetal ($mx+92) ($y+22)
    TxtC $g $m.v $fBodyB $bBlanco ($mx+92) ($y+56)
    $mx += 200
  }
  $y += 140
  FillRound $g $bGrafito 26 $y 588 96 14
  Txt $g 'TU PLAN' $fMonoS $bMetal 46 ($y+18)
  Txt $g 'Semana 3 de tu programa actual' $fSmallB $bBlanco 46 ($y+50)
}

function Draw-Nutricion($g,$off){
  $y = 30 - $off
  Txt $g '// TU SEMANA, DIA A DIA' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'NUTRICION' $fAppTit $bBlanco 28 $y
  $y += 56
  Txt $g '5 opciones por comida · cambia la que quieras' $fTiny $bMetalCl 30 $y
  $y += 60
  foreach($c in $comidas){
    if($y -gt $PH){ break }
    Txt $g $c.t $fAppTit2 $bBrasa 30 $y
    $y += 46
    FillRound $g $bGrafito 26 $y 588 130 14
    StrokeRound $g $pBrasa 26 $y 588 130 14
    Txt $g $c.n $fBodyB $bBlanco 44 ($y+24)
    Txt $g ($c.kcal + '  ·  ' + $c.prot) $fSmall $bMetalCl 44 ($y+64)
    Txt $g 'OPCION 1 DE 5' $fMonoS $bBrasa 44 ($y+96)
    $y += 156
  }
  $y += 20
  FillRound $g $bBrasa 30 $y 580 84 14
  TxtC $g 'GENERAR LISTA DE LA COMPRA  ▶' $fSmallB $bBlanco (30+290) ($y+30)
}

function Draw-Hitos($g,$off){
  $y = 30 - $off
  Txt $g '// TU PROGRESO' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'HITOS Y RECOMPENSAS' $fAppTit $bBlanco 28 $y
  $y += 58
  Txt $g '18 hitos conseguidos' $fBodyB $bBlanco 30 $y
  $y += 44
  # barra de progreso hacia Leyenda (30)
  FillRound $g $bGrafito 30 $y 580 18 9
  $pctW = [int](580 * (18.0/30.0))
  FillRound $g $bBrasa 30 $y $pctW 18 9
  $y += 46
  foreach($n in $niveles){
    if($y -gt $PH){ break }
    FillRound $g $bGrafito 26 $y 588 122 12
    if($n.logrado){
      $g.FillEllipse($bBrasa,50,($y+26),70,70)
    } else {
      $pen=New-Object System.Drawing.Pen $cMetal,3
      $g.DrawEllipse($pen,50,($y+26),70,70)
      $pen.Dispose()
    }
    TxtC $g $n.min.ToString() $fBodyB $(if($n.logrado){$bBlanco}else{$bMetal}) 85 ($y+48)
    Txt $g $n.n $fBodyB $(if($n.logrado){$bBlanco}else{$bMetalCl}) 144 ($y+30)
    $nom = $n.premio
    while((Wid $g $nom $fTiny) -gt 400 -and $nom.Length -gt 6){ $nom=$nom.Substring(0,$nom.Length-2) }
    if($nom -ne $n.premio){ $nom=$nom.TrimEnd()+'…' }
    Txt $g $nom $fTiny $bMetalCl 144 ($y+62)
    if($n.logrado){
      Txt $g 'CONSEGUIDO' $fMonoS $bVerde 144 ($y+90)
    } else {
      Txt $g 'POR DESBLOQUEAR' $fMonoS $bMetal 144 ($y+90)
    }
    $y += 138
  }
}

# =============================================================================
#  ESCENAS
# =============================================================================
# Sin logo, sin subtitulo, sin caption ni marco de telefono "dibujados": la
# propia web ya pone ese marco (border, sombra, fondo) y la etiqueta "Area de
# cliente real" alrededor del <video> (ver .hero-demo-inner / .hero-demo-label
# en index.html). Si el video ademas dibuja su propio marco y su propio logo,
# en el hueco pequeno del hero de escritorio (min(25vw,280px)) queda un marco
# dentro de otro marco y unas cartelas de texto negras que no encajan. Por eso
# aqui se renderiza solo el contenido de pantalla, a sangre completa, como si
# fuera una grabacion de pantalla real.
$SC = @(
  @{tipo='entreno';    n=200; scroll=460},
  @{tipo='progreso';   n=120; scroll=0},
  @{tipo='kcalmacros'; n=120; scroll=0},
  @{tipo='nutri';      n=170; scroll=340},
  @{tipo='hitos';      n=170; scroll=260}
)
$total = 0; foreach($s in $SC){ $total += $s.n }
$durSeg = [math]::Round($total / $Fps, 2)

Write-Host "Generando $total fotogramas ($durSeg s)…"

$idx = 0
foreach($s in $SC){
  for($k=0; $k -lt $s.n; $k++){
    $idx++
    $scr = New-Object System.Drawing.Bitmap($PW,$PH)
    $sg = [System.Drawing.Graphics]::FromImage($scr)
    $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $sg.Clear($cCarbon)
    # el scroll arranca tras un 12% de la escena (tiempo para leer el titulo)
    # y avanza suavizado hasta el final
    $pr = $k / [double]$s.n
    $e  = [Math]::Max(0.0, [Math]::Min(1.0, ($pr - 0.12) / 0.88))
    $e  = $e * $e * (3 - 2 * $e)
    $off = [int]($e * $s.scroll)
    switch($s.tipo){
      'entreno'    { Draw-Entreno $sg $off }
      'nutri'      { Draw-Nutricion $sg $off }
      'hitos'      { Draw-Hitos $sg $off }
      'progreso'   { Draw-Progreso $sg $off }
      'kcalmacros' { Draw-KcalMacros $sg $off }
    }
    $sg.Dispose()

    $bmp = New-Object System.Drawing.Bitmap($W,$H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($scr,0,0,$W,$H)
    $scr.Dispose()

    $g.Dispose()
    $bmp.Save((Join-Path $frameDir ('f{0:D5}.png' -f $idx)),[System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }
  Write-Host ("  escena {0} lista ({1} fotogramas)" -f $s.tipo,$s.n)
}

Write-Host "Codificando con ffmpeg…"
& $ff -y -hide_banner -v error -framerate $Fps -i (Join-Path $frameDir 'f%05d.png') `
  -c:v libx264 -profile:v high -preset slow -crf 19 -pix_fmt yuv420p -r $Fps `
  -movflags +faststart $Out

if (Test-Path $Out) {
  "OK -> $Out  ($([math]::Round((Get-Item $Out).Length/1MB,2)) MB, $durSeg s, $total fotogramas)"
} else { throw "No se genero el video" }
