$csharpSource = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class PureContinuousWoodGenerator
{
    public static void Generate(string[] outputPaths, int width, int height)
    {
        Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        
        // 옹이 정의 (완전한 지수 가우시안 와류)
        var knots = new[]
        {
            new { X = 0.30, Y = 0.44, RadiusX = 0.20, RadiusY = 0.14, Strength = 1.1 },
            new { X = 0.76, Y = 0.65, RadiusX = 0.16, RadiusY = 0.11, Strength = 0.9 }
        };

        for (int y = 0; y < height; y++)
        {
            double v = (double)y / height;
            
            // 1. 도톰하고 둥글둥글한 필로우 엣지 프로파일 (상/하 베벨)
            double edgeDistTop = v;
            double edgeDistBottom = 1.0 - v;
            double minEdgeDist = Math.Min(edgeDistTop, edgeDistBottom);
            
            // 틈새 딥 섀도우
            double creviceShadow = 0.0;
            if (minEdgeDist < 0.022)
            {
                creviceShadow = Math.Pow(1.0 - (minEdgeDist / 0.022), 1.6) * 0.75;
            }
            
            // 볼록한 필로우 하이라이트 림
            double rimPeak = 0.038;
            double rimDist = Math.Abs(minEdgeDist - rimPeak);
            double rimHighlight = 0.0;
            if (rimDist < 0.034)
            {
                double rNorm = 1.0 - (rimDist / 0.034);
                rimHighlight = Math.Pow(rNorm, 1.8) * 0.60;
            }

            for (int x = 0; x < width; x++)
            {
                double u = (double)x / width;
                double pi2 = Math.PI * 2.0;

                // 2. 100% Seamless 유기적 웨이브 워핑 (정수배 주파수)
                double wave1 = Math.Sin(u * pi2 * 1.0) * 0.024 + Math.Cos(u * pi2 * 2.0) * 0.012;
                double wave2 = Math.Sin(u * pi2 * 3.0 + v * pi2 * 1.0) * 0.006;
                double wave3 = Math.Cos(u * pi2 * 1.0 - v * pi2 * 0.5) * 0.010;
                double warpedV = v + wave1 + wave2 + wave3;

                // 3. 순수 가우시안 연속 옹이 회전 (원형 경계선 0%)
                double knotEffect = 0.0;
                foreach (var k in knots)
                {
                    double dx = u - k.X;
                    if (dx > 0.5) dx -= 1.0;
                    if (dx < -0.5) dx += 1.0;
                    
                    double normX = dx / k.RadiusX;
                    double normY = (v - k.Y) / k.RadiusY;
                    double distSq = normX * normX + normY * normY;
                    
                    // 매끄러운 2차 가우시안 감쇄
                    double g = Math.Exp(-distSq * 1.8);
                    
                    // 연속 와류
                    double angle = Math.Atan2(normY, normX);
                    double swirlAngle = angle + g * 0.65 * k.Strength;
                    double dist = Math.Sqrt(distSq);
                    double newNormY = Math.Sin(swirlAngle) * dist;
                    
                    warpedV += (newNormY - normY) * k.RadiusY * 0.75;
                    
                    // 옹이 중심 음영 (경계 없는 가우시안 블렌딩)
                    double ring = Math.Cos(dist * Math.PI * 2.0) * 0.12;
                    double core = Math.Exp(-distSq * 3.5) * 0.28;
                    knotEffect += (ring - core) * g;
                }

                // 4. 끊김 없이 길고 유려하게 이어지는 굵은 카툰 나뭇결 (12줄)
                double grainPhase = warpedV * 12.0 * Math.PI;
                double grainSin = Math.Sin(grainPhase);
                double grainBand = Math.Sign(grainSin) * Math.Pow(Math.Abs(grainSin), 0.54);
                double grainVal = (grainBand + 1.0) * 0.5;

                // 5. 완벽한 주기적 브러시 워시
                double brushWash = Math.Sin(u * pi2 * 2.0 + v * pi2 * 0.5) * 0.035 + Math.Cos(u * pi2 * 4.0 - v * pi2 * 0.5) * 0.018;

                double t = grainVal * 0.58 + 0.26 + brushWash + knotEffect;
                t = Math.Max(0.0, Math.Min(1.0, t));

                // 6. 레퍼런스 컬러 팔레트 매핑 (Rich Warm Amber Walnut)
                double redVal, greenVal, blueVal;
                if (t < 0.40)
                {
                    double kVal = t / 0.40;
                    redVal = 56.0 + (104.0 - 56.0) * kVal;
                    greenVal = 30.0 + (59.0 - 30.0) * kVal;
                    blueVal = 17.0 + (34.0 - 17.0) * kVal;
                }
                else
                {
                    double kVal = (t - 0.40) / 0.60;
                    redVal = 104.0 + (162.0 - 104.0) * kVal;
                    greenVal = 59.0 + (98.0 - 59.0) * kVal;
                    blueVal = 34.0 + (56.0 - 34.0) * kVal;
                }

                // 필로우 엣지 림 하이라이트
                redVal += rimHighlight * 58.0;
                greenVal += rimHighlight * 40.0;
                blueVal += rimHighlight * 25.0;

                // 틈새 섀도우
                redVal -= creviceShadow * 45.0;
                greenVal -= creviceShadow * 26.0;
                blueVal -= creviceShadow * 15.0;

                redVal = Math.Max(0.0, Math.Min(255.0, redVal));
                greenVal = Math.Max(0.0, Math.Min(255.0, greenVal));
                blueVal = Math.Max(0.0, Math.Min(255.0, blueVal));

                bmp.SetPixel(x, y, Color.FromArgb(255, (int)redVal, (int)greenVal, (int)blueVal));
            }
        }

        foreach (var path in outputPaths)
        {
            bmp.Save(path, ImageFormat.Png);
        }
        bmp.Dispose();
    }
}
"@

Add-Type -TypeDefinition $csharpSource -ReferencedAssemblies "System.Drawing"

$destPaths = @(
    "c:\Users\dpcks\Unity\My project\Assets\Textures\Wood\wood_grain_knots.png",
    "c:\Users\dpcks\Unity\My project\preset-studio\public\textures\wood\wood_grain_knots.png"
)

[PureContinuousWoodGenerator]::Generate($destPaths, 1024, 1024)
Write-Host "✨ Pure Continuous Seamless Chunky Wood Texture Created Successfully!"
