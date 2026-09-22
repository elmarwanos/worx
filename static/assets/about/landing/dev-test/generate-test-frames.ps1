# TEMPORARY DEV SCRIPT — generates 32 placeholder test-landing PNG frames
# to exercise the LandingSequence frame-sequence architecture before real
# GLIMPSE mothership artwork exists. Not part of the production build;
# safe to delete along with this whole dev-test/ folder once approved.
Add-Type -AssemblyName System.Drawing

$outDir = "D:\Worx-Documents\Worx-Desk\Worx Website\static\assets\about\landing\dev-test"
$W = 2400
$H = 1350

function Ease-InOut([double]$t) {
  if ($t -lt 0.5) { return 4 * [Math]::Pow($t, 3) }
  else { return 1 - [Math]::Pow(-2 * $t + 2, 3) / 2 }
}
function Ease-Out([double]$t) {
  return 1 - [Math]::Pow(1 - $t, 3)
}

for ($i = 1; $i -le 32; $i++) {
  $t = ($i - 1) / 31.0
  $ease = Ease-InOut $t
  $easeX = Ease-Out $t

  # scale: tiny distant dot -> grounded-but-not-huge mothership silhouette
  $shipW = $W * (0.03 + (0.16 - 0.03) * $ease)
  $shipH = $shipW * 1.6

  # trajectory: horizontal drift settles early (ease-out), vertical descent
  # continues smoothly the whole way (ease-in-out) so the back half of the
  # sequence reads as increasingly vertical/controlled, per spec.
  $cx = $W * (0.66 + (0.72 - 0.66) * $easeX)
  $cy = ($H * 0.10) + (($H * 0.66) - ($H * 0.10)) * $ease

  $bmp = [System.Drawing.Bitmap]::new($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  # --- placeholder dust (touchdown onward: frames 25-32) ---
  if ($i -ge 25) {
    $dustA = [Math]::Min(140, ($i - 24) * 28)
    $dustBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($dustA, 200, 190, 180))
    $dustW = $shipW * 2.6
    $dustH = $shipH * 0.5
    $g.FillEllipse($dustBrush, [float]($cx - $dustW/2), [float]($cy + $shipH*0.42 - $dustH/2), [float]$dustW, [float]$dustH)
    $dustBrush.Dispose()
  }

  # --- placeholder engine flame (descent window: frames 9-24) ---
  if ($i -ge 9 -and $i -le 24) {
    $flameH = $shipH * 0.6
    $flameW = $shipW * 0.28
    $flamePts = @(
      [System.Drawing.PointF]::new([float]($cx - $flameW/2), [float]($cy + $shipH/2)),
      [System.Drawing.PointF]::new([float]($cx + $flameW/2), [float]($cy + $shipH/2)),
      [System.Drawing.PointF]::new([float]$cx, [float]($cy + $shipH/2 + $flameH))
    )
    $flameBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 150, 40))
    $g.FillPolygon($flameBrush, $flamePts)
    $flameBrush.Dispose()
  }

  # --- placeholder ship: nose triangle + body rectangle, unmistakably
  #     a test shape (flat magenta/cyan, no attempt at realism) ---
  $shipBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 230, 40, 220))
  $shipPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 60, 240, 255), [float]($shipW * 0.045))

  $bodyW = $shipW * 0.62
  $bodyTop = $cy - $shipH/2 + $shipH*0.32
  $bodyRect = [System.Drawing.RectangleF]::new([float]($cx - $bodyW/2), [float]$bodyTop, [float]$bodyW, [float]($shipH*0.5))
  $g.FillRectangle($shipBrush, $bodyRect)
  $g.DrawRectangle($shipPen, [float]$bodyRect.X, [float]$bodyRect.Y, [float]$bodyRect.Width, [float]$bodyRect.Height)

  $nosePts = @(
    [System.Drawing.PointF]::new([float]$cx, [float]($cy - $shipH/2)),
    [System.Drawing.PointF]::new([float]($cx - $bodyW/2), [float]$bodyTop),
    [System.Drawing.PointF]::new([float]($cx + $bodyW/2), [float]$bodyTop)
  )
  $g.FillPolygon($shipBrush, $nosePts)
  $g.DrawPolygon($shipPen, $nosePts)
  $shipBrush.Dispose()
  $shipPen.Dispose()

  # --- corner watermark: unmistakable "this is a dev test" marker on
  #     every single frame regardless of the ship's own scale ---
  $wmFont = [System.Drawing.Font]::new("Arial", 34, [System.Drawing.FontStyle]::Bold)
  $wmBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 60, 240, 255))
  $wmShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 0, 0, 0))
  $label1 = "GLIMPSE SHIP TEST -- NOT FINAL ART"
  $label2 = ("DEV FRAME {0:D3} / 032" -f $i)
  $g.DrawString($label1, $wmFont, $wmShadow, 42, 42)
  $g.DrawString($label1, $wmFont, $wmBrush, 40, 40)
  $g.DrawString($label2, $wmFont, $wmShadow, 42, 92)
  $g.DrawString($label2, $wmFont, $wmBrush, 40, 90)
  $wmFont.Dispose(); $wmBrush.Dispose(); $wmShadow.Dispose()

  $g.Dispose()

  $name = "test-landing-{0:D3}.png" -f $i
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Write-Output "Generated 32 frames in $outDir"
