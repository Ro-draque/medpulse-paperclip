param([Parameter(Mandatory)][string]$OutputPath, [ValidateSet('respiratory','kit')][string]$Theme='respiratory')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bitmap = [Drawing.Bitmap]::new(1080, 1350)
$canvas = [Drawing.Graphics]::FromImage($bitmap)
$canvas.SmoothingMode = 'AntiAlias'
$canvas.TextRenderingHint = 'AntiAliasGridFit'
function Color([string]$Hex) { [Drawing.ColorTranslator]::FromHtml($Hex) }
function Fill([string]$Hex) { [Drawing.SolidBrush]::new((Color $Hex)) }
function Label([string]$Value, [string]$Font, [float]$Size, [string]$Hex, [float]$X, [float]$Y, [bool]$Bold=$false) {
    $style = if ($Bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    $face = [Drawing.Font]::new($Font, $Size, $style, [Drawing.GraphicsUnit]::Pixel)
    $ink = Fill $Hex
    try { $canvas.DrawString($Value, $face, $ink, $X, $Y, [Drawing.StringFormat]::GenericTypographic) }
    finally { $ink.Dispose(); $face.Dispose() }
}
function Box([string]$Hex,[float]$X,[float]$Y,[float]$W,[float]$H) {
    $ink=Fill $Hex
    try { $canvas.FillRectangle($ink,$X,$Y,$W,$H) } finally { $ink.Dispose() }
}
if ($Theme -eq 'kit') {
    $canvas.Clear((Color '#FAF0E3'))
    Box '#592D26' 72 71 36 36
    Box '#F3BE92' 87 78 6 22
    Box '#F3BE92' 79 86 22 6
    Label 'SALUDPRO / DEMO' 'Segoe UI' 23 '#592D26' 122 75 $true
    Box '#B48D7A' 72 134 936 1
    Label '02    INVENTARIO PARA CONSULTORIOS' 'Segoe UI' 22 '#765145' 73 166 $true
    Label 'Tu botiquín,' 'Georgia' 98 '#592D26' 71 212
    Label 'al día.' 'Georgia' 110 '#592D26' 71 320
    Label 'Gasas estériles  /  Paquete x100' 'Segoe UI' 31 '#765145' 76 456
    Box '#713B2E' 72 531 936 514
    $canvas.TranslateTransform(502,790)
    $canvas.RotateTransform(-12)
    Box '#4B271F' -215 -120 522 275
    Box '#CE8268' -264 -83 487 258
    Box '#F2BA94' -251 -70 461 232
    Box '#F9D6BD' -244 -146 487 258
    Box '#FFF0DE' -229 -131 457 228
    Box '#B9654E' -190 -90 52 8
    Box '#B9654E' -168 -112 8 52
    Label 'GASAS' 'Georgia' 58 '#592D26' -180 -36
    Label 'CONTROL DE INVENTARIO' 'Segoe UI' 19 '#765145' -179 44 $true
    $canvas.ResetTransform()
    Box '#F3BE92' 72 1093 936 96
    Label 'Consultá por gasas' 'Segoe UI' 38 '#592D26' 103 1118 $true
    Label '↗' 'Segoe UI' 48 '#592D26' 925 1107 $true
    Box '#B48D7A' 72 1242 936 1
    Label 'PROPUESTA PARA REVISIÓN' 'Segoe UI' 18 '#765145' 73 1261 $true
    Label 'ILUSTRACIÓN EDITORIAL' 'Segoe UI' 18 '#765145' 790 1261 $true
} else {
$canvas.Clear((Color '#F3F0E8'))
Box '#183B33' 70 68 34 34
Box '#C7EA8E' 84 75 6 20
Box '#C7EA8E' 77 82 20 6
Label 'SALUDPRO / DEMO' 'Segoe UI' 23 '#183B33' 120 70 $true
Label 'COMPRAS PARA CONSULTORIOS' 'Segoe UI' 18 '#52665B' 724 76 $true
Box '#A9B4A4' 70 131 940 1
Label '01    PLANIFICACIÓN DE INSUMOS' 'Segoe UI' 21 '#52665B' 72 164 $true
Label 'Reponer' 'Georgia' 105 '#183B33' 69 207
Label 'con tiempo.' 'Georgia' 105 '#183B33' 69 316
Label 'Barbijos tricapa  /  Caja x50' 'Segoe UI' 31 '#52665B' 74 446

$field=[Drawing.Rectangle]::new(70,521,940,535)
$gradient=[Drawing.Drawing2D.LinearGradientBrush]::new($field,(Color '#23493B'),(Color '#0B2B26'),35)
$canvas.FillRectangle($gradient,$field)
$gradient.Dispose()
$clip=$canvas.Save()
$canvas.SetClip($field)
$ring=[Drawing.Pen]::new((Color '#42634E'),2)
foreach($r in @(175,208,242,277,313,351,390)){
    $canvas.DrawEllipse($ring,(540-$r),(795-$r),(2*$r),(2*$r))
}
$ring.Dispose()
Label 'INSUMOS' 'Segoe UI' 19 '#BDD3BC' 101 550 $true
Label 'TRICAPA' 'Segoe UI' 19 '#BDD3BC' 902 1001 $true

$canvas.TranslateTransform(540,793)
$canvas.RotateTransform(-13)
$shadow=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(65,0,15,10))
for($i=0;$i -lt 12;$i++){
    $canvas.FillEllipse($shadow,(-246-$i),(-34+$i*3),(492+$i*2),190)
}
$shadow.Dispose()
$loops=[Drawing.Pen]::new((Color '#E5F4DD'),10)
$canvas.DrawBezier($loops,-225,-119,-415,-194,-424,134,-225,116)
$canvas.DrawBezier($loops,225,-119,415,-194,424,134,225,116)
$loops.Dispose()
$mask=[Drawing.Drawing2D.GraphicsPath]::new()
$mask.AddBezier(-234,-122,-100,-152,114,-151,234,-121)
$mask.AddBezier(234,-121,239,-39,238,70,232,125)
$mask.AddBezier(232,125,121,165,-106,164,-231,126)
$mask.AddBezier(-231,126,-242,42,-240,-53,-234,-122)
$mask.CloseFigure()
$maskBounds=[Drawing.Rectangle]::new(-242,-156,485,331)
$surface=[Drawing.Drawing2D.LinearGradientBrush]::new($maskBounds,(Color '#EAF5DF'),(Color '#86BCAB'),85)
$canvas.FillPath($surface,$mask)
$surface.Dispose()
$seam=[Drawing.Pen]::new((Color '#EAF4DC'),6)
$canvas.DrawPath($seam,$mask)
$seam.Dispose()
$mask.Dispose()
foreach($y in @(-63,-9,44,98)){
    $fold=[Drawing.Pen]::new((Color '#74A797'),5)
    $highlight=[Drawing.Pen]::new((Color '#E0F2DE'),4)
    $canvas.DrawBezier($fold,-219,$y,-84,($y+36),90,($y+35),219,$y)
    $canvas.DrawBezier($highlight,-219,($y+6),-84,($y+42),90,($y+41),219,($y+6))
    $fold.Dispose(); $highlight.Dispose()
}
$canvas.Restore($clip)

Box '#D2ED9C' 70 1091 940 99
Label 'Pedí una cotización' 'Segoe UI' 37 '#193B31' 104 1116 $true
Label '↗' 'Segoe UI' 49 '#193B31' 922 1106 $true
Box '#A9B4A4' 70 1242 940 1
Label 'PROPUESTA PARA REVISIÓN' 'Segoe UI' 18 '#52665B' 72 1260 $true
Label 'ILUSTRACIÓN EDITORIAL' 'Segoe UI' 18 '#52665B' 790 1260 $true
}
$codec=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$quality=[Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0]=[Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality,[long]94)
try { $bitmap.Save($OutputPath,$codec,$quality) }
finally { $quality.Dispose(); $canvas.Dispose(); $bitmap.Dispose() }
