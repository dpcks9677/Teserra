#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using Tessera.Games.AugmentedYacht;

namespace Tessera.EditorTools
{
    public static class ParchmentTextureGenerator
    {
        private static readonly Color InkColor = new Color32(35, 23, 15, 255);          // #23170f (Deep Sepia Ink)
        private static readonly Color MutedInkColor = new Color32(145, 125, 105, 255);  // #917d69 (Classic Grid Ink Line)
        private static readonly Color HeaderBarColor = new Color32(43, 31, 23, 255);    // #2b1f17 (Dark Ebony Sepia Bar)
        private static readonly Color BonusWashColor = new Color32(218, 207, 187, 255); // #dacbb3 (Bonus Tint Wash Box)
        private static readonly Color Transparent = new Color(0, 0, 0, 0);

        [MenuItem("Tools/Tessera/Generate Parchment & Score Sheet Assets")]
        public static void GenerateAllAssets()
        {
            string baseDir = Path.Combine(Application.dataPath, "Textures", "Parchment");
            string iconsDir = Path.Combine(baseDir, "Icons");

            if (!Directory.Exists(baseDir)) Directory.CreateDirectory(baseDir);
            if (!Directory.Exists(iconsDir)) Directory.CreateDirectory(iconsDir);

            // 1. svgicons.js 기반 원본 벡터 둥근 주사위 및 특수 족보 아이콘 12종 PNG 생성 (128x128)
            GenerateSvgIcons(iconsDir);

            // 2. 양피지 기본 텍스처 팩 생성 (Base, Burnt Edge, Warm Sand)
            GenerateParchmentTextures(baseDir);

            AssetDatabase.Refresh();
            ConfigureTextureImporters();
            Debug.Log("✨ svgicons.js 원본 벡터 아이콘 복원 및 양피지 텍스처 생성 완료!");
        }

        [MenuItem("Tools/Tessera/Rebuild Scene Layout (Include Parchment)")]
        public static void RebuildSceneLayout()
        {
            var controller = UnityEngine.Object.FindFirstObjectByType<AugmentedYachtController>();
            if (controller != null)
            {
                controller.BuildEditableLayout();
                Debug.Log("✨ AugmentedYachtController 레이아웃 리빌드 완료 (우측 양피지 족보 포함)!");
            }
            else
            {
                Debug.LogWarning("⚠️ 씬에서 AugmentedYachtController를 찾을 수 없습니다.");
            }
        }

        private static void GenerateSvgIcons(string iconsDir)
        {
            int size = 128;

            for (int num = 1; num <= 6; num++)
            {
                Texture2D tex = RenderDiceSvg(num, size);
                SavePng(tex, Path.Combine(iconsDir, $"dice_{num}.png"));
                UnityEngine.Object.DestroyImmediate(tex);
            }

            string[] specials = { "choice", "4oak", "fullhouse", "s_straight", "l_straight", "yacht" };
            foreach (string id in specials)
            {
                Texture2D tex = RenderSpecialSvg(id, size);
                SavePng(tex, Path.Combine(iconsDir, $"{id}.png"));
                UnityEngine.Object.DestroyImmediate(tex);
            }
        }

        /// <summary>
        /// svgicons.js의 getDiceSvg(1..6) 원본 벡터 둥근 주사위 렌더링 복원
        /// </summary>
        private static Texture2D RenderDiceSvg(int num, int size)
        {
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color[] pixels = new Color[size * size];
            for (int i = 0; i < pixels.Length; i++) pixels[i] = Transparent;

            float scale = size / 24f;

            // 둥근 챔퍼 외곽 테두리 (rx: 4, stroke: 2.0)
            DrawRoundedRectStroke(pixels, size, 2f * scale, 2f * scale, 20f * scale, 20f * scale, 4f * scale, 2.0f * scale, InkColor);

            // 동그란 원형 핍 (radius: 2.0)
            float r = 2.0f * scale;
            float c = 12f * scale;
            float l = 7f * scale;
            float r_pos = 17f * scale;
            float t = 17f * scale;
            float b = 7f * scale;
            float m = 12f * scale;

            if (num == 1)
            {
                DrawCircle(pixels, size, c, c, r, InkColor);
            }
            else if (num == 2)
            {
                DrawCircle(pixels, size, r_pos, t, r, InkColor);
                DrawCircle(pixels, size, l, b, r, InkColor);
            }
            else if (num == 3)
            {
                DrawCircle(pixels, size, r_pos, t, r, InkColor);
                DrawCircle(pixels, size, c, c, r, InkColor);
                DrawCircle(pixels, size, l, b, r, InkColor);
            }
            else if (num == 4)
            {
                DrawCircle(pixels, size, l, t, r, InkColor);
                DrawCircle(pixels, size, r_pos, t, r, InkColor);
                DrawCircle(pixels, size, l, b, r, InkColor);
                DrawCircle(pixels, size, r_pos, b, r, InkColor);
            }
            else if (num == 5)
            {
                DrawCircle(pixels, size, l, t, r, InkColor);
                DrawCircle(pixels, size, r_pos, t, r, InkColor);
                DrawCircle(pixels, size, c, c, r, InkColor);
                DrawCircle(pixels, size, l, b, r, InkColor);
                DrawCircle(pixels, size, r_pos, b, r, InkColor);
            }
            else if (num == 6)
            {
                DrawCircle(pixels, size, l, t, r, InkColor);
                DrawCircle(pixels, size, r_pos, t, r, InkColor);
                DrawCircle(pixels, size, l, m, r, InkColor);
                DrawCircle(pixels, size, r_pos, m, r, InkColor);
                DrawCircle(pixels, size, l, b, r, InkColor);
                DrawCircle(pixels, size, r_pos, b, r, InkColor);
            }

            tex.SetPixels(pixels);
            tex.Apply();
            return tex;
        }

        private static Texture2D RenderSpecialSvg(string id, int size)
        {
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color[] pixels = new Color[size * size];
            for (int i = 0; i < pixels.Length; i++) pixels[i] = Transparent;

            float scale = size / 24f;

            void RectBlock(float x, float ySvg, float w, float h, bool strokeOnly = false)
            {
                float y = 24f - ySvg - h;
                if (strokeOnly)
                {
                    DrawRoundedRectStroke(pixels, size, x * scale, y * scale, w * scale, h * scale, 0.6f * scale, 1.8f * scale, InkColor);
                }
                else
                {
                    DrawRoundedRectFill(pixels, size, x * scale, y * scale, w * scale, h * scale, 0.6f * scale, InkColor);
                }
            }

            if (id == "choice")
            {
                RectBlock(10, 4, 4, 4);
                RectBlock(10, 16, 4, 4);
                RectBlock(4, 10, 4, 4);
                RectBlock(16, 10, 4, 4);
                RectBlock(10, 10, 4, 4);
            }
            else if (id == "4oak")
            {
                Vector2 Pos(int idx)
                {
                    int col = (idx - 1) % 4;
                    int row = (idx - 1) / 4;
                    return new Vector2(2.5f + col * 5f, 2.5f + row * 5f);
                }

                Vector2 p4 = Pos(4);
                RectBlock(p4.x, p4.y, 4, 4, true);

                int[] filledIdx = { 1, 6, 11, 16 };
                foreach (int idx in filledIdx)
                {
                    Vector2 p = Pos(idx);
                    RectBlock(p.x, p.y, 4, 4, false);
                }
            }
            else if (id == "fullhouse")
            {
                RectBlock(3, 5, 4, 4);
                RectBlock(10, 5, 4, 4);
                RectBlock(17, 5, 4, 4);
                RectBlock(6.5f, 14, 4, 4);
                RectBlock(13.5f, 14, 4, 4);
            }
            else if (id == "s_straight")
            {
                RectBlock(4, 16, 4, 4);
                RectBlock(8, 12, 4, 4);
                RectBlock(12, 8, 4, 4);
                RectBlock(16, 4, 4, 4);
            }
            else if (id == "l_straight")
            {
                RectBlock(2, 18, 4, 4);
                RectBlock(6, 14, 4, 4);
                RectBlock(10, 10, 4, 4);
                RectBlock(14, 6, 4, 4);
                RectBlock(18, 2, 4, 4);
            }
            else if (id == "yacht")
            {
                RectBlock(10, 2, 4, 4);
                RectBlock(18, 9, 4, 4);
                RectBlock(14, 17, 4, 4);
                RectBlock(6, 17, 4, 4);
                RectBlock(2, 9, 4, 4);
            }

            tex.SetPixels(pixels);
            tex.Apply();
            return tex;
        }

        private static void DrawCircle(Color[] pixels, int size, float cx, float cy, float r, Color color)
        {
            int minX = Mathf.Max(0, Mathf.FloorToInt(cx - r - 2));
            int maxX = Mathf.Min(size - 1, Mathf.CeilToInt(cx + r + 2));
            int minY = Mathf.Max(0, Mathf.FloorToInt(cy - r - 2));
            int maxY = Mathf.Min(size - 1, Mathf.CeilToInt(cy + r + 2));

            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
                    float alpha = Mathf.Clamp01(r - dist + 0.5f);
                    if (alpha > 0)
                    {
                        int idx = y * size + x;
                        Color existing = pixels[idx];
                        pixels[idx] = Color.Lerp(existing, color, alpha);
                    }
                }
            }
        }

        private static void DrawRoundedRectFill(Color[] pixels, int size, float rx, float ry, float w, float h, float radius, Color color)
        {
            int minX = Mathf.Max(0, Mathf.FloorToInt(rx - 1));
            int maxX = Mathf.Min(size - 1, Mathf.CeilToInt(rx + w + 1));
            int minY = Mathf.Max(0, Mathf.FloorToInt(ry - 1));
            int maxY = Mathf.Min(size - 1, Mathf.CeilToInt(ry + h + 1));

            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    float px = x + 0.5f;
                    float py = y + 0.5f;

                    float dx = Mathf.Max(0f, Mathf.Abs(px - (rx + w * 0.5f)) - (w * 0.5f - radius));
                    float dy = Mathf.Max(0f, Mathf.Abs(py - (ry + h * 0.5f)) - (h * 0.5f - radius));
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);

                    float alpha = Mathf.Clamp01(radius - dist + 0.5f);
                    if (alpha > 0)
                    {
                        int idx = y * size + x;
                        pixels[idx] = Color.Lerp(pixels[idx], color, alpha);
                    }
                }
            }
        }

        private static void DrawRoundedRectStroke(Color[] pixels, int size, float rx, float ry, float w, float h, float radius, float strokeWidth, Color color)
        {
            int minX = Mathf.Max(0, Mathf.FloorToInt(rx - strokeWidth - 1));
            int maxX = Mathf.Min(size - 1, Mathf.CeilToInt(rx + w + strokeWidth + 1));
            int minY = Mathf.Max(0, Mathf.FloorToInt(ry - strokeWidth - 1));
            int maxY = Mathf.Min(size - 1, Mathf.CeilToInt(ry + h + strokeWidth + 1));

            float halfStroke = strokeWidth * 0.5f;

            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    float px = x + 0.5f;
                    float py = y + 0.5f;

                    float dx = Mathf.Max(0f, Mathf.Abs(px - (rx + w * 0.5f)) - (w * 0.5f - radius));
                    float dy = Mathf.Max(0f, Mathf.Abs(py - (ry + h * 0.5f)) - (h * 0.5f - radius));
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);

                    float dBox = dist - radius;
                    float dStroke = Mathf.Abs(dBox + halfStroke) - halfStroke;

                    float alpha = Mathf.Clamp01(0.5f - dStroke);
                    if (alpha > 0)
                    {
                        int idx = y * size + x;
                        pixels[idx] = Color.Lerp(pixels[idx], color, alpha);
                    }
                }
            }
        }

        private static void GenerateParchmentTextures(string baseDir)
        {
            int w = 512;
            int h = 1024;

            // 1. Parchment Base
            Texture2D baseTex = new Texture2D(w, h, TextureFormat.RGBA32, true);
            Color[] basePix = new Color[w * h];
            for (int y = 0; y < h; y++)
            {
                float ny = (float)y / h;
                for (int x = 0; x < w; x++)
                {
                    float nx = (float)x / w;
                    float n1 = Mathf.PerlinNoise(nx * 4f, ny * 8f) * 0.08f;
                    float n2 = Mathf.PerlinNoise(nx * 16f, ny * 32f) * 0.03f;
                    float micro = (Mathf.Sin(x * 1.2f) * Mathf.Cos(y * 1.2f)) * 0.015f;

                    float r = Mathf.Clamp01(0.94f + n1 + n2 + micro);
                    float g = Mathf.Clamp01(0.88f + n1 * 0.9f + n2 + micro);
                    float b = Mathf.Clamp01(0.77f + n1 * 0.8f + n2 + micro);
                    basePix[y * w + x] = new Color(r, g, b, 1f);
                }
            }
            baseTex.SetPixels(basePix);
            baseTex.Apply();
            SavePng(baseTex, Path.Combine(baseDir, "parchment_base.png"));

            // 2. Parchment Burnt Edge
            Texture2D burntTex = new Texture2D(w, h, TextureFormat.RGBA32, true);
            Color[] burntPix = new Color[w * h];
            for (int y = 0; y < h; y++)
            {
                float ny = (float)y / h;
                float edgeY = Mathf.Min(ny, 1f - ny) * 2f;
                for (int x = 0; x < w; x++)
                {
                    float nx = (float)x / w;
                    float edgeX = Mathf.Min(nx, 1f - nx) * 2f;
                    float edgeDist = Mathf.Clamp01(Mathf.Min(edgeX, edgeY));

                    float noise = Mathf.PerlinNoise(nx * 8f, ny * 16f) * 0.25f;
                    float burnFactor = Mathf.Clamp01((0.24f - edgeDist + noise) / 0.24f);

                    float r = Mathf.Lerp(0.92f, 0.50f, burnFactor);
                    float g = Mathf.Lerp(0.85f, 0.36f, burnFactor);
                    float b = Mathf.Lerp(0.73f, 0.22f, burnFactor);
                    burntPix[y * w + x] = new Color(r, g, b, 1f);
                }
            }
            burntTex.SetPixels(burntPix);
            burntTex.Apply();
            SavePng(burntTex, Path.Combine(baseDir, "parchment_burnt_edge.png"));

            // 3. Parchment Warm Sand
            Texture2D warmTex = new Texture2D(w, h, TextureFormat.RGBA32, true);
            Color[] warmPix = new Color[w * h];
            for (int y = 0; y < h; y++)
            {
                float ny = (float)y / h;
                for (int x = 0; x < w; x++)
                {
                    float nx = (float)x / w;
                    float n = Mathf.PerlinNoise(nx * 6f, ny * 12f) * 0.07f;
                    warmPix[y * w + x] = new Color(0.90f + n, 0.82f + n, 0.68f + n, 1f);
                }
            }
            warmTex.SetPixels(warmPix);
            warmTex.Apply();
            SavePng(warmTex, Path.Combine(baseDir, "parchment_warm_sand.png"));

            UnityEngine.Object.DestroyImmediate(baseTex);
            UnityEngine.Object.DestroyImmediate(burntTex);
            UnityEngine.Object.DestroyImmediate(warmTex);
        }

        private static void SavePng(Texture2D tex, string path)
        {
            byte[] bytes = tex.EncodeToPNG();
            File.WriteAllBytes(path, bytes);
        }

        private static void ConfigureTextureImporters()
        {
            string[] iconFiles = Directory.GetFiles("Assets/Textures/Parchment/Icons", "*.png");
            foreach (string file in iconFiles)
            {
                string unityPath = file.Replace("\\", "/");
                TextureImporter importer = AssetImporter.GetAtPath(unityPath) as TextureImporter;
                if (importer != null)
                {
                    importer.textureType = TextureImporterType.Sprite;
                    importer.spriteImportMode = SpriteImportMode.Single;
                    importer.alphaIsTransparency = true;
                    importer.mipmapEnabled = false;
                    importer.filterMode = FilterMode.Bilinear; // 부드럽고 선명한 벡터 렌더링
                    importer.SaveAndReimport();
                }
            }

            string[] parchmentFiles = Directory.GetFiles("Assets/Textures/Parchment", "*.png");
            foreach (string file in parchmentFiles)
            {
                string unityPath = file.Replace("\\", "/");
                TextureImporter importer = AssetImporter.GetAtPath(unityPath) as TextureImporter;
                if (importer != null)
                {
                    importer.textureType = TextureImporterType.Default;
                    importer.alphaIsTransparency = false;
                    importer.mipmapEnabled = true;
                    importer.filterMode = FilterMode.Bilinear;
                    importer.SaveAndReimport();
                }
            }
        }
    }
}
#endif
