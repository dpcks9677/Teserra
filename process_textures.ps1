Add-Type -AssemblyName System.Drawing

function Remove-WhiteBg($srcPath, $dstPath) {
    Write-Host "Processing $srcPath -> $dstPath"
    $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    $outBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    # Simple threshold cutout with soft alpha blending for anti-aliasing
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            $brightness = ($pixel.R + $pixel.G + $pixel.B) / 3.0
            
            if ($pixel.R -gt 245 -and $pixel.G -gt 245 -and $pixel.B -gt 245) {
                # Fully transparent for pure white
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } elseif ($pixel.R -gt 230 -and $pixel.G -gt 230 -and $pixel.B -gt 230) {
                # Smooth edge transition
                $alpha = [int]([Math]::Max(0, [Math]::Min(255, (255 - $brightness) * 10)))
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $pixel.R, $pixel.G, $pixel.B))
            } else {
                $outBmp.SetPixel($x, $y, $pixel)
            }
        }
    }
    $bmp.Dispose()
    $outBmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()
    Write-Host "Done: $dstPath"
}

$destDirs = @(
    'c:\Users\dpcks\Unity\My project\preset-studio\public\textures\backgrounds',
    'c:\Users\dpcks\Unity\My project\Assets\Textures\Backgrounds'
)

foreach ($dir in $destDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$sourceWood = 'C:\Users\dpcks\.gemini\antigravity-ide\brain\6b8818f8-d7b5-4a55-aff0-19fd94c1649c\fantasy_wood_horizontal_bg_1786809045914.jpg'
$sourceWideRunner = 'C:\Users\dpcks\.gemini\antigravity-ide\brain\6b8818f8-d7b5-4a55-aff0-19fd94c1649c\stylized_emerald_runner_wide_1786809081381.jpg'
$sourceRibbonRunner = 'C:\Users\dpcks\.gemini\antigravity-ide\brain\6b8818f8-d7b5-4a55-aff0-19fd94c1649c\stylized_emerald_runner_1786809063601.jpg'

foreach ($dir in $destDirs) {
    Copy-Item -Path $sourceWood -Destination (Join-Path $dir 'table_wood_horizontal_bg.jpg') -Force
}

$tempWidePng = 'c:\Users\dpcks\Unity\My project\preset-studio\public\textures\backgrounds\runner_emerald_wide.png'
$tempRibbonPng = 'c:\Users\dpcks\Unity\My project\preset-studio\public\textures\backgrounds\runner_emerald_ribbon.png'

Remove-WhiteBg $sourceWideRunner $tempWidePng
Remove-WhiteBg $sourceRibbonRunner $tempRibbonPng

# Copy PNGs to Unity Assets as well
Copy-Item $tempWidePng 'c:\Users\dpcks\Unity\My project\Assets\Textures\Backgrounds\runner_emerald_wide.png' -Force
Copy-Item $tempRibbonPng 'c:\Users\dpcks\Unity\My project\Assets\Textures\Backgrounds\runner_emerald_ribbon.png' -Force

Write-Host "All assets prepared and copied successfully!"
