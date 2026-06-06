Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$outDir = Join-Path (Resolve-Path "$PSScriptRoot\..").Path 'public\assets\generated'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Color($hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($hex.Substring(0, 2), 16),
    [Convert]::ToInt32($hex.Substring(2, 2), 16),
    [Convert]::ToInt32($hex.Substring(4, 2), 16)
  )
}

function Fill-Gradient($g, $rect, $top, $bottom) {
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, (New-Color $top), (New-Color $bottom), 90)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Fill-Ellipse($g, $x, $y, $w, $h, $color, [int]$alpha = 255) {
  $brush = [System.Drawing.SolidBrush]::new((New-Color $color $alpha))
  $g.FillEllipse($brush, [single]$x, [single]$y, [single]$w, [single]$h)
  $brush.Dispose()
}

function Fill-Polygon($g, $points, $color, [int]$alpha = 255) {
  $brush = [System.Drawing.SolidBrush]::new((New-Color $color $alpha))
  $g.FillPolygon($brush, [System.Drawing.PointF[]]$points)
  $brush.Dispose()
}

function Draw-Line($g, $x1, $y1, $x2, $y2, $color, [single]$width = 2, [int]$alpha = 255) {
  $pen = [System.Drawing.Pen]::new((New-Color $color $alpha), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
  $pen.Dispose()
}

function Fill-Rect($g, $x, $y, $w, $h, $color, [int]$alpha = 255) {
  $brush = [System.Drawing.SolidBrush]::new((New-Color $color $alpha))
  $g.FillRectangle($brush, [single]$x, [single]$y, [single]$w, [single]$h)
  $brush.Dispose()
}

function Stroke-Ellipse($g, $x, $y, $w, $h, $color, [single]$width = 2, [int]$alpha = 255) {
  $pen = [System.Drawing.Pen]::new((New-Color $color $alpha), $width)
  $g.DrawEllipse($pen, [single]$x, [single]$y, [single]$w, [single]$h)
  $pen.Dispose()
}

function Draw-Portal($g, $cx, $cy, $rx, $ry, $color) {
  for ($i = 0; $i -lt 7; $i++) {
    $a = 70 - $i * 8
    $pen = [System.Drawing.Pen]::new((New-Color $color $a), [single](2 + $i * 0.7))
    $g.DrawEllipse($pen, [single]($cx - $rx - $i * 5), [single]($cy - $ry - $i * 4), [single](($rx + $i * 5) * 2), [single](($ry + $i * 4) * 2))
    $pen.Dispose()
  }
}

function Draw-CaveArch($g, $accent) {
  Fill-Ellipse $g 148 118 420 430 '#031b18' 230
  Fill-Ellipse $g 224 174 268 336 '#081f1c' 255
  for ($i = 0; $i -lt 9; $i++) {
    Draw-Line $g (172 + $i * 44) 178 (120 + $i * 72) 420 '#86efac' 4 95
  }
  for ($i = 0; $i -lt 16; $i++) {
    Fill-Ellipse $g (125 + $i * 42) (355 + (($i * 17) % 58)) 92 34 '#86efac' 92
  }
  Draw-Portal $g 358 286 84 134 $accent
}

function Draw-StarArray($g, $accent) {
  Draw-Ruins $g '#16245f' $accent -16
  $cx = 520
  $cy = 252
  for ($i = 0; $i -lt 5; $i++) {
    Stroke-Ellipse $g ($cx - 72 - $i * 24) ($cy - 72 - $i * 24) (144 + $i * 48) (144 + $i * 48) $accent (3 + $i * 0.3) (150 - $i * 16)
  }
  for ($i = 0; $i -lt 8; $i++) {
    $a = $i * [Math]::PI * 2 / 8
    Draw-Line $g $cx $cy ($cx + [Math]::Cos($a) * 210) ($cy + [Math]::Sin($a) * 120) '#facc15' 3 125
    Fill-Ellipse $g ($cx + [Math]::Cos($a) * 210 - 11) ($cy + [Math]::Sin($a) * 120 - 11) 22 22 '#facc15' 170
  }
}

function Draw-MistForest($g, $accent) {
  for ($i = 0; $i -lt 15; $i++) {
    $x = -20 + $i * 72
    Fill-Polygon $g @(
      [System.Drawing.PointF]::new([single]($x + 28), 145),
      [System.Drawing.PointF]::new([single]($x + 62), 408),
      [System.Drawing.PointF]::new([single]($x - 10), 408)
    ) '#063932' (120 + ($i % 3) * 34)
  }
  Draw-Lanterns $g '#99f6e4' $accent
  for ($i = 0; $i -lt 12; $i++) { Fill-Ellipse $g (-90 + $i * 108) (310 + (($i * 29) % 60)) 230 68 '#ccfbf1' 52 }
  Draw-Portal $g 610 268 96 104 $accent
}

function Draw-HugeCrystals($g, $accent) {
  Draw-Crystals $g '#a78bfa' $accent 428 42
  $clusters = @(
    @(430, 96, 112, 312),
    @(548, 150, 82, 244),
    @(338, 188, 78, 210)
  )
  foreach ($c in $clusters) {
    $x = $c[0]; $y = $c[1]; $w = $c[2]; $h = $c[3]
    Fill-Polygon $g @(
      [System.Drawing.PointF]::new([single]$x, [single]$y),
      [System.Drawing.PointF]::new([single]($x + $w * 0.54), [single]($y + $h * 0.42)),
      [System.Drawing.PointF]::new([single]($x + $w * 0.32), [single]($y + $h)),
      [System.Drawing.PointF]::new([single]($x - $w * 0.32), [single]($y + $h)),
      [System.Drawing.PointF]::new([single]($x - $w * 0.54), [single]($y + $h * 0.42))
    ) '#c4b5fd' 220
    Draw-Line $g $x ($y + 6) $x ($y + $h - 12) '#f5f3ff' 4 150
  }
}

function Draw-BloodRift($g, $accent) {
  Fill-Ellipse $g 648 34 174 174 '#fb7185' 160
  Fill-Ellipse $g 680 66 112 112 '#fecdd3' 52
  $points = @(
    [System.Drawing.PointF]::new(438, 110),
    [System.Drawing.PointF]::new(510, 210),
    [System.Drawing.PointF]::new(478, 276),
    [System.Drawing.PointF]::new(570, 420),
    [System.Drawing.PointF]::new(486, 384),
    [System.Drawing.PointF]::new(414, 472),
    [System.Drawing.PointF]::new(446, 330),
    [System.Drawing.PointF]::new(368, 246)
  )
  Fill-Polygon $g $points '#7f1d1d' 230
  Draw-Line $g 438 116 508 210 '#fef08a' 8 170
  Draw-Line $g 510 210 478 276 '#f97316' 8 180
  Draw-Line $g 478 276 570 420 '#fef08a' 8 170
  for ($i = 0; $i -lt 10; $i++) {
    Draw-Line $g (40 + $i * 108) 418 (115 + $i * 100) (292 + (($i * 19) % 66)) $accent 7 128
  }
}

function Draw-Mountains($g, $baseY, $color, $alpha, $offset) {
  for ($i = 0; $i -lt 7; $i++) {
    $x = -120 + $i * 180 + $offset
    $h = 120 + (($i * 37) % 95)
    $points = @(
      [System.Drawing.PointF]::new([single]($x), [single]$baseY),
      [System.Drawing.PointF]::new([single]($x + 105), [single]($baseY - $h)),
      [System.Drawing.PointF]::new([single]($x + 240), [single]$baseY)
    )
    Fill-Polygon $g $points $color $alpha
  }
}

function Draw-Stars($g, $color, $count, $seed) {
  $rng = [System.Random]::new($seed)
  for ($i = 0; $i -lt $count; $i++) {
    $x = $rng.Next(0, 960)
    $y = $rng.Next(16, 280)
    $size = $rng.Next(2, 7)
    Fill-Ellipse $g $x $y $size $size $color ($rng.Next(65, 190))
  }
}

function Draw-Ruins($g, $color, $accent, $shift) {
  for ($i = 0; $i -lt 5; $i++) {
    $x = 95 + $i * 172 + $shift
    $h = 86 + ($i % 3) * 34
    $brush = [System.Drawing.SolidBrush]::new((New-Color $color 178))
    $g.FillRectangle($brush, [single]$x, [single](350 - $h), [single]38, [single]$h)
    $g.FillRectangle($brush, [single]($x - 16), [single](350 - $h - 14), [single]72, [single]14)
    $brush.Dispose()
    Draw-Line $g ($x + 19) (350 - $h - 18) ($x + 19) (350 - $h - 70) $accent 3 120
  }
}

function Draw-Crystals($g, $color, $accent, $baseY, $seed) {
  $rng = [System.Random]::new($seed)
  for ($i = 0; $i -lt 16; $i++) {
    $x = $rng.Next(30, 930)
    $h = $rng.Next(44, 142)
    $w = $rng.Next(20, 54)
    $y = $baseY - $h + $rng.Next(-12, 20)
    $points = @(
      [System.Drawing.PointF]::new([single]$x, [single]$y),
      [System.Drawing.PointF]::new([single]($x + $w * 0.54), [single]($y + $h * 0.38)),
      [System.Drawing.PointF]::new([single]($x + $w * 0.34), [single]($y + $h)),
      [System.Drawing.PointF]::new([single]($x - $w * 0.34), [single]($y + $h)),
      [System.Drawing.PointF]::new([single]($x - $w * 0.54), [single]($y + $h * 0.38))
    )
    Fill-Polygon $g $points $color 168
    Draw-Line $g $x ($y + 4) $x ($y + $h - 8) $accent 2 145
  }
}

function Draw-Lanterns($g, $color, $accent) {
  for ($i = 0; $i -lt 9; $i++) {
    $x = 74 + $i * 104
    $y = 150 + (($i * 43) % 140)
    Draw-Line $g $x ($y - 54) $x ($y - 12) $accent 2 110
    Fill-Ellipse $g ($x - 13) ($y - 13) 26 26 $color 210
    Fill-Ellipse $g ($x - 45) ($y - 31) 90 56 $color 34
  }
}

function Draw-Tomb($g, $stone, $accent) {
  $brush = [System.Drawing.SolidBrush]::new((New-Color $stone 225))
  $g.FillRectangle($brush, 250, 238, 460, 154)
  $g.FillRectangle($brush, 288, 190, 384, 52)
  $g.FillRectangle($brush, 328, 136, 304, 58)
  $brush.Dispose()
  Draw-Line $g 250 238 710 238 $accent 5 170
  Draw-Line $g 288 190 672 190 $accent 4 145
  for ($i = 0; $i -lt 6; $i++) {
    $x = 305 + $i * 70
    $b = [System.Drawing.SolidBrush]::new((New-Color $stone 235))
    $g.FillRectangle($b, [single]$x, 250, 32, 142)
    $b.Dispose()
    Draw-Line $g ($x + 16) 254 ($x + 16) 386 $accent 2 80
  }
}

function New-DungeonImage($file, $top, $bottom, $mountain, $ground, $accent, $kind) {
  $bmp = [System.Drawing.Bitmap]::new(960, 540)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  Fill-Gradient $g ([System.Drawing.Rectangle]::new(0, 0, 960, 540)) $top $bottom
  Draw-Stars $g $accent 58 ($file.GetHashCode())
  Draw-Mountains $g 382 $mountain 82 0
  Draw-Mountains $g 426 $mountain 130 -70
  Fill-Ellipse $g 110 330 740 130 '#020617' 80

  if ($kind -eq 'moss') {
    Draw-CaveArch $g $accent
  } elseif ($kind -eq 'star') {
    Draw-StarArray $g $accent
  } elseif ($kind -eq 'mist') {
    Draw-MistForest $g $accent
  } elseif ($kind -eq 'crystal') {
    Draw-HugeCrystals $g $accent
  } elseif ($kind -eq 'blood') {
    Draw-BloodRift $g $accent
  } elseif ($kind -eq 'tomb') {
    Draw-Tomb $g '#78350f' $accent
    Draw-Portal $g 484 236 96 126 '#fde68a'
    Draw-Crystals $g '#fbbf24' '#fde68a' 432 84
  }

  $groundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 386, 960, 154),
    (New-Color $ground 235),
    (New-Color '#020617' 255),
    90
  )
  $g.FillRectangle($groundBrush, 0, 386, 960, 154)
  $groundBrush.Dispose()
  for ($i = 0; $i -lt 16; $i++) {
    Draw-Line $g (-20 + $i * 72) (410 + (($i * 19) % 70)) (80 + $i * 72) (386 + (($i * 11) % 70)) $accent 2 55
  }
  Fill-Ellipse $g -80 420 1120 180 '#020617' 86
  $bmp.Save((Join-Path $outDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

New-DungeonImage 'dungeon-moss-cave.png' '#dff7ff' '#0f2a24' '#1f7a6b' '#18382b' '#5eead4' 'moss'
New-DungeonImage 'dungeon-star-hall.png' '#c7d2fe' '#111827' '#334155' '#172033' '#38bdf8' 'star'
New-DungeonImage 'dungeon-mist-maze.png' '#ecfeff' '#052e2b' '#0f766e' '#102f2c' '#99f6e4' 'mist'
New-DungeonImage 'dungeon-crystal-mine.png' '#ede9fe' '#12091f' '#5b21b6' '#211827' '#c084fc' 'crystal'
New-DungeonImage 'dungeon-blood-rift.png' '#fee2e2' '#1f0f12' '#7f1d1d' '#261315' '#fb7185' 'blood'
New-DungeonImage 'dungeon-king-tomb.png' '#fef3c7' '#17120a' '#92400e' '#2a1e10' '#fbbf24' 'tomb'

Write-Host "Generated dungeon images in $outDir"
