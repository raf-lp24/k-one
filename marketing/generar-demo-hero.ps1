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

$W = 1080; $H = 1920
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
  @{n='PRESS MILITAR';     s='3'; r='10'; rpe='8.5'},
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
    FillRound $g $bGrafito 26 $y 588 132 12
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
    $y += 144
  }
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
$SC = @(
  @{tipo='hook';    n=60},
  @{tipo='entreno'; n=180; cap='Tu plan se adapta a tu deporte y a tu nivel'; scroll=420},
  @{tipo='nutri';   n=150; cap='5 opciones por comida, cada dia';            scroll=340},
  @{tipo='hitos';   n=150; cap='Hitos que se convierten en descuentos';      scroll=260},
  @{tipo='cta';     n=90}
)
$total = 0; foreach($s in $SC){ $total += $s.n }
$durSeg = [math]::Round($total / $Fps, 2)

Write-Host "Generando $total fotogramas ($durSeg s)…"

$PX = [int](($W - $PW)/2)
$PY = 330

$idx = 0
foreach($s in $SC){
  for($k=0; $k -lt $s.n; $k++){
    $idx++
    $bmp = New-Object System.Drawing.Bitmap($W,$H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear($cNegro)

    $gp = RoundPath -260 900 1600 1200 600
    $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $gp
    $pgb.CenterColor = [System.Drawing.Color]::FromArgb(46,22,10)
    $pgb.SurroundColors = @($cNegro)
    $g.FillPath($pgb,$gp); $pgb.Dispose(); $gp.Dispose()

    if($s.tipo -eq 'hook' -or $s.tipo -eq 'cta'){
      TxtC $g 'K-ONE' $fMarca $bBlanco ($W/2) 780
      $g.FillRectangle($bBrasa,[int](($W-150)/2),882,150,4)
      if($s.tipo -eq 'hook'){
        $p = $k / [double]$s.n
        if($p -gt 0.15){ TxtC $g 'Tu plan, tu progreso' $fTitulo $bBlanco ($W/2) 940 }
        if($p -gt 0.4){ TxtC $g 'en un solo sitio' $fTitulo $bBrasa ($W/2) 1050 }
      } else {
        TxtC $g 'Empieza tu plan hoy' $fTitulo $bBlanco ($W/2) 940
        $pen2 = New-Object System.Drawing.Pen $cBrasa,3
        StrokeRound $g $pen2 ([int](($W-420)/2)) 1080 420 96 16
        $pen2.Dispose()
        TxtC $g 'k-one.fit' $fCap $bBrasa ($W/2) 1105
      }
    } else {
      TxtC $g 'K-ONE' $fMarca $bBlanco ($W/2) 96
      $g.FillRectangle($bBrasa,[int](($W-150)/2),196,150,4)
      TxtC $g 'TU AREA DE CLIENTE' $fSub $bMetalCl ($W/2) 216

      $scr = New-Object System.Drawing.Bitmap($PW,$PH)
      $sg = [System.Drawing.Graphics]::FromImage($scr)
      $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
      $sg.Clear($cCarbon)
      $pr = $k / [double]$s.n
      $e  = [Math]::Max(0.0, [Math]::Min(1.0, ($pr - 0.22) / 0.78))
      $e  = $e * $e * (3 - 2 * $e)
      $off = [int]($e * $s.scroll)
      switch($s.tipo){
        'entreno' { Draw-Entreno $sg $off }
        'nutri'   { Draw-Nutricion $sg $off }
        'hitos'   { Draw-Hitos $sg $off }
      }
      $sg.Dispose()

      $clip = RoundPath $PX $PY $PW $PH 26
      $g.SetClip($clip)
      $g.DrawImage($scr,$PX,$PY,$PW,$PH)
      $g.ResetClip(); $clip.Dispose(); $scr.Dispose()
      StrokeRound $g $pBrasa $PX $PY $PW $PH 26

      if($s.cap){
        $cy = $PY + $PH + 42
        $cw = (Wid $g $s.cap $fCap) + 56
        $bBox = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,0,0,0))
        FillRound $g $bBox ([int](($W-$cw)/2)) $cy $cw 74 14
        $bBox.Dispose()
        TxtC $g $s.cap $fCap $bBlanco ($W/2) ($cy+14)
      }
    }

    $g.FillRectangle($bBrasa,0,1906,[int]($W * $idx / $total),8)

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
