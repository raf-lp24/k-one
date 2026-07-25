# =============================================================================
#  K-ONE · GENERADOR DE VÍDEO TikTok — "Un mes gratis"
#
#  Genera el vídeo COMPLETO desde cero (1080x1920, 30 fps): no usa grabaciones
#  de pantalla, sino que dibuja la interfaz de K-ONE fotograma a fotograma con
#  System.Drawing y luego ensambla con ffmpeg. Así se controla exactamente qué
#  aparece en pantalla.
#
#  CUMPLIMIENTO DE NORMAS DE TikTok (por diseño, no por recorte):
#    · Cero calorías, kcal y macros            (política de salud conductual)
#    · Cero peso corporal y cero "perder grasa"
#    · Cero antes/después ni promesas de resultados
#    · Cero cuerpos: solo interfaz de producto
#    · El mensaje es una prueba gratuita, no un sorteo
#
#  Requiere ffmpeg:  winget install --id Gyan.FFmpeg -e
#  Guardar este .ps1 con BOM UTF-8 (si no, PS 5.1 rompe tildes y €).
#
#  Uso:  .\generar-tiktok-mes-gratis.ps1
# =============================================================================
param(
  [string]$Out = "$PSScriptRoot\tiktok-mes-gratis.mp4",
  [int]$Fps    = 30
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) {
  $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -EA SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ff) { throw "No encuentro ffmpeg. Instálalo con:  winget install --id Gyan.FFmpeg -e" }

$W = 1080; $H = 1920
$frameDir = Join-Path $env:TEMP "kone-frames"
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

$bNegro=New-Object System.Drawing.SolidBrush $cNegro
$bCarbon=New-Object System.Drawing.SolidBrush $cCarbon
$bGrafito=New-Object System.Drawing.SolidBrush $cGrafito
$bBrasa=New-Object System.Drawing.SolidBrush $cBrasa
$bBlanco=New-Object System.Drawing.SolidBrush $cBlanco
$bMetal=New-Object System.Drawing.SolidBrush $cMetal
$bMetalCl=New-Object System.Drawing.SolidBrush $cMetalCl
$pBrasa=New-Object System.Drawing.Pen $cBrasa,3
$pHumo=New-Object System.Drawing.Pen $cHumo,2

# ---------- tipografías ----------
function F($name,$size,$style='Regular'){
  New-Object System.Drawing.Font($name,$size,[System.Drawing.FontStyle]::$style,[System.Drawing.GraphicsUnit]::Pixel)
}
$fTitulo   = F 'Impact' 92
$fTitXL    = F 'Impact' 140
$fMarca    = F 'Impact' 78
$fAppTit   = F 'Impact' 42
$fAppTit2  = F 'Impact' 34
$fSub      = F 'Bahnschrift' 32
$fCap      = F 'Bahnschrift' 44
$fBody     = F 'Segoe UI' 24
$fBodyB    = F 'Segoe UI' 24 'Bold'
$fSmall    = F 'Segoe UI' 20
$fTiny     = F 'Segoe UI' 17
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
# Píldora tipo etiqueta (músculos, tags…)
function Pill($g,$s,$font,$x,$y,$colBorde,$colTexto){
  $w=(Wid $g $s $font)+26; $h=34
  $pen=New-Object System.Drawing.Pen $colBorde,2
  StrokeRound $g $pen $x $y $w $h 17
  $pen.Dispose()
  $br=New-Object System.Drawing.SolidBrush $colTexto
  Txt $g $s $font $br ($x+13) ($y+7)
  $br.Dispose()
  return $w
}

# =============================================================================
#  CONTENIDO DE LAS PANTALLAS (sin calorías, sin peso, sin "perder grasa")
# =============================================================================
$bloque1 = @(
  @{n='PRESS BANCA';       s='3'; r='8';  p='3';  rpe='8.5'},
  @{n='REMO CON BARRA';    s='3'; r='10'; p='0';  rpe='8.5'},
  @{n='PRESS MILITAR';     s='3'; r='10'; p='3';  rpe='8.5'},
  @{n='DOMINADAS O JALÓN'; s='3'; r='8';  p='0';  rpe='8.5'}
)
$bloque2 = @(
  @{n='FACE PULL';         s='3'; r='15'; p='2';  rpe='8'},
  @{n='CURL BÍCEPS';       s='3'; r='12'; p='2';  rpe='8'},
  @{n='EXTENSIÓN TRÍCEPS'; s='3'; r='12'; p='2';  rpe='8'}
)
$comidas = @(
  @{t='DESAYUNO';     o=@('Tostadas con guacamole, huevo y pavo','Porridge de avena con frutos rojos','Crepes de avena con yogur y fruta','Tostada de aguacate con huevo pochado','Tostadas con jamón serrano y tomate')},
  @{t='MEDIA MAÑANA'; o=@('Skyr con fruta y canela','Yogur griego con miel y nueces','Queso batido con manzana','Kéfir con frutos rojos','Edamame con sal marina')},
  @{t='COMIDA';       o=@('Salmón con arroz y edamame','Pollo al curry con basmati','Ternera con patata y verduras','Lentejas guisadas con verduras','Pavo a la plancha con quinoa')}
)
$compra = @(
  @{g='PROTEÍNAS';  it=@('Pechuga de pollo','Salmón fresco','Huevos camperos','Pavo en lonchas','Yogur griego')},
  @{g='VERDURAS';   it=@('Espinacas frescas','Tomate cherry','Pimiento rojo','Calabacín','Aguacate')},
  @{g='DESPENSA';   it=@('Avena integral','Arroz basmati','Pan de centeno','Aceite de oliva virgen extra','Lentejas','Quinoa')}
)

# =============================================================================
#  DIBUJO DE LA PANTALLA DEL MÓVIL  (bitmap propio, recortado por el marco)
# =============================================================================
$PW=640; $PH=1290   # tamaño de la pantalla del móvil

function Draw-Entreno($g,$off){
  $y = 30 - $off
  Txt $g '// SEMANA 6 · VIERNES' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'FUERZA · TREN SUPERIOR' $fAppTit $bBlanco 28 $y
  $y += 56
  [void](Pill $g 'PUSH/PULL' $fTiny 30 $y $cBrasa $cBrasa)
  $y += 56
  Txt $g 'CALENTAMIENTO · 8-10 min de movilidad' $fTiny $bMetal 30 $y
  $y += 26
  Txt $g 'articular + 2 series de aproximación' $fTiny $bMetal 30 $y
  $y += 50
  # Bloque numerado
  Txt $g '01' $fAppTit2 $bBrasa 30 $y
  Txt $g 'BLOQUE DE FUERZA' $fAppTit2 $bBlanco 84 ($y+4)
  $y += 56
  $lista = @()
  foreach($e in $bloque1){ $lista += ,@{e=$e; sep=$null} }
  $lista += ,@{e=$null; sep='02  BLOQUE DE HIPERTROFIA'}
  foreach($e in $bloque2){ $lista += ,@{e=$e; sep=$null} }
  foreach($item in $lista){
    if($y -gt $PH){ break }
    if($item.sep){
      Txt $g '02' $fAppTit2 $bBrasa 30 $y
      Txt $g 'BLOQUE DE HIPERTROFIA' $fAppTit2 $bBlanco 84 ($y+4)
      $y += 56
      continue
    }
    $e = $item.e
    FillRound $g $bGrafito 26 $y 588 132 12
    # botón play (círculo + triángulo centrado dentro del círculo)
    $cxp = 66; $cyp = $y + 44          # centro del círculo
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
    Txt $g 'REPS' $fMonoS $bMetal 200 ($y+62)
    Txt $g $e.r $fBodyB $bBlanco 200 ($y+84)
    # "CARGA" y no "PESO": es el peso levantado, no el corporal. Así ningún
    # revisor automático puede confundirlo con seguimiento de peso personal.
    Txt $g 'CARGA (KG)' $fMonoS $bMetal 300 ($y+62)
    FillRound $g $bCarbon 300 ($y+82) 120 34 8
    TxtC $g $e.p $fSmall $bBlanco 360 ($y+87)
    $y += 144
  }
}

function Draw-Nutricion($g,$off){
  $y = 30 - $off
  Txt $g '// TU SEMANA, DÍA A DÍA' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'NUTRICIÓN' $fAppTit $bBlanco 28 $y
  $y += 62
  # días
  $dx=28
  foreach($d in @('L','M','X','J','V','S','D')){
    $sel = ($d -eq 'V')
    if($sel){ FillRound $g $bBrasa $dx $y 72 48 10 } else { FillRound $g $bGrafito $dx $y 72 48 10 }
    TxtC $g $d $fSmall $bBlanco ($dx+36) ($y+12)
    $dx += 82
  }
  $y += 74
  foreach($c in $comidas){
    if($y -gt $PH){ break }
    Txt $g $c.t $fAppTit2 $bBrasa 30 $y
    Txt $g '5 OPCIONES · TOCA PARA VER' $fMonoS $bMetal 30 ($y+40)
    $y += 74
    $i=0
    foreach($o in $c.o){
      if($y -gt $PH){ break }
      $i++
      $sel = ($i -eq 2)
      FillRound $g $bGrafito 26 $y 588 78 12
      if($sel){ StrokeRound $g $pBrasa 26 $y 588 78 12 }
      Txt $g ("OPCIÓN $i") $fMonoS ($(if($sel){$bBrasa}else{$bMetal})) 44 ($y+12)
      # nombre recortado si no cabe
      $nom=$o
      while((Wid $g $nom $fSmall) -gt 540 -and $nom.Length -gt 6){ $nom=$nom.Substring(0,$nom.Length-2) }
      if($nom -ne $o){ $nom=$nom.TrimEnd()+'…' }
      Txt $g $nom $fSmall $bBlanco 44 ($y+38)
      $y += 90
    }
    $y += 24
  }
}

function Draw-Compra($g,$off){
  $y = 30 - $off
  Txt $g '// LOS 7 DÍAS COMPLETADOS' $fMonoS $bBrasa 30 $y
  $y += 34
  Txt $g 'LISTA DE LA COMPRA' $fAppTit $bBlanco 28 $y
  $y += 60
  Txt $g 'Generada con lo que has elegido esta semana' $fTiny $bMetalCl 30 $y
  $y += 52
  foreach($grp in $compra){
    if($y -gt $PH){ break }
    Txt $g $grp.g $fAppTit2 $bBrasa 30 $y
    $y += 52
    foreach($it in $grp.it){
      if($y -gt $PH){ break }
      FillRound $g $bGrafito 26 $y 588 62 10
      # casilla marcada
      $pen=New-Object System.Drawing.Pen $cBrasa,3
      StrokeRound $g $pen 46 ($y+16) 30 30 7
      $pen.Dispose()
      $pv=New-Object System.Drawing.Pen $cBrasa,4
      $g.DrawLines($pv,@(
        (New-Object System.Drawing.PointF(53,($y+31))),
        (New-Object System.Drawing.PointF(60,($y+38))),
        (New-Object System.Drawing.PointF(70,($y+23)))
      ))
      $pv.Dispose()
      Txt $g $it $fSmall $bBlanco 96 ($y+17)
      $y += 72
    }
    $y += 18
  }
}

# =============================================================================
#  ESCENAS
# =============================================================================
# frames por escena
# El scroll de cada escena se ajusta al alto real de su contenido, para que no
# quede hueco vacío al final ni se corte el título al empezar.
$SC = @(
  @{tipo='hook';   n=78},
  @{tipo='entreno';n=126; cap='Tu plan de entrenamiento, semana a semana'; scroll=250},
  @{tipo='nutri';  n=126; cap='Tus comidas, con 5 opciones cada una';      scroll=520},
  @{tipo='compra'; n=108; cap='Y tu lista de la compra, hecha sola';       scroll=250},
  @{tipo='cta';    n=96}
)
$total = 0; foreach($s in $SC){ $total += $s.n }
$durSeg = [math]::Round($total / $Fps, 2)

Write-Host "Generando $total fotogramas ($durSeg s)…"

$PX = [int](($W - $PW)/2)   # posición del móvil
$PY = 330

$idx = 0
foreach($s in $SC){
  for($k=0; $k -lt $s.n; $k++){
    $idx++
    $t = $idx / $Fps
    $bmp = New-Object System.Drawing.Bitmap($W,$H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear($cNegro)

    # resplandor de brasa de fondo
    $gp = RoundPath -260 900 1600 1200 600
    $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $gp
    $pgb.CenterColor = [System.Drawing.Color]::FromArgb(46,22,10)
    $pgb.SurroundColors = @($cNegro)
    $g.FillPath($pgb,$gp); $pgb.Dispose(); $gp.Dispose()

    if($s.tipo -eq 'hook' -or $s.tipo -eq 'cta'){
      # ---------- pantallas de mensaje ----------
      TxtC $g 'K-ONE' $fMarca $bBlanco ($W/2) 150
      $g.FillRectangle($bBrasa,[int](($W-150)/2),252,150,4)

      if($s.tipo -eq 'hook'){
        $p = $k / [double]$s.n
        TxtC $g 'UN MES GRATIS' $fTitXL $bBrasa ($W/2) 760
        if($p -gt 0.18){ TxtC $g 'al probar tu plan' $fCap $bBlanco ($W/2) 930 }
        if($p -gt 0.42){ TxtC $g 'Entrenamiento + nutrición' $fSub $bMetalCl ($W/2) 1010 }
      } else {
        TxtC $g 'UN MES GRATIS' $fTitulo $bBrasa ($W/2) 640
        TxtC $g 'Escríbenos la palabra' $fSub $bMetalCl ($W/2) 790
        TxtC $g '"GRATIS"' $fTitulo $bBlanco ($W/2) 840
        TxtC $g 'por mensaje privado' $fSub $bMetalCl ($W/2) 970
        $pen2 = New-Object System.Drawing.Pen $cBrasa,3
        StrokeRound $g $pen2 ([int](($W-460)/2)) 1080 460 96 16
        $pen2.Dispose()
        TxtC $g 'k-one.fit' $fCap $bBrasa ($W/2) 1105
      }
    } else {
      # ---------- pantallas de producto ----------
      TxtC $g 'K-ONE' $fMarca $bBlanco ($W/2) 96
      $g.FillRectangle($bBrasa,[int](($W-150)/2),196,150,4)
      TxtC $g 'ENTRENAMIENTO + NUTRICIÓN' $fSub $bMetalCl ($W/2) 216
      TxtC $g 'UN MES GRATIS' (F 'Impact' 46) $bBrasa ($W/2) 258

      # móvil
      $scr = New-Object System.Drawing.Bitmap($PW,$PH)
      $sg = [System.Drawing.Graphics]::FromImage($scr)
      $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
      $sg.Clear($cCarbon)
      # El scroll arranca tras un 22% de la escena (para poder leer el título)
      # y avanza suavizado hasta el final.
      $pr = $k / [double]$s.n
      $e  = [Math]::Max(0.0, [Math]::Min(1.0, ($pr - 0.22) / 0.78))
      $e  = $e * $e * (3 - 2 * $e)      # suavizado
      $off = [int]($e * $s.scroll)
      switch($s.tipo){
        'entreno' { Draw-Entreno $sg $off }
        'nutri'   { Draw-Nutricion $sg $off }
        'compra'  { Draw-Compra $sg $off }
      }
      $sg.Dispose()

      $clip = RoundPath $PX $PY $PW $PH 26
      $g.SetClip($clip)
      $g.DrawImage($scr,$PX,$PY,$PW,$PH)
      $g.ResetClip(); $clip.Dispose(); $scr.Dispose()
      StrokeRound $g $pBrasa $PX $PY $PW $PH 26

      # rótulo inferior
      if($s.cap){
        $cy = $PY + $PH + 42
        $cw = (Wid $g $s.cap $fCap) + 56
        $bBox = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,0,0,0))
        FillRound $g $bBox ([int](($W-$cw)/2)) $cy $cw 74 14
        $bBox.Dispose()
        TxtC $g $s.cap $fCap $bBlanco ($W/2) ($cy+14)
      }
    }

    # barra de progreso
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
} else { throw "No se generó el vídeo" }
