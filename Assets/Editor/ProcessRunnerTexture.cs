#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Tessera.EditorTools
{
    public static class ProcessRunnerTexture
    {
        [MenuItem("Tools/Tessera/Clean Emerald Wide Runner (Remove White Edges)")]
        public static void CleanWideRunner()
        {
            string sourceJpgPath = @"C:\Users\dpcks\.gemini\antigravity-ide\brain\6b8818f8-d7b5-4a55-aff0-19fd94c1649c\stylized_emerald_runner_wide_1786809081381.jpg";
            string destPngPath = Path.Combine(Application.dataPath, "Textures", "Backgrounds", "runner_emerald_wide.png");
            string publicPngPath = Path.Combine(Application.dataPath, "..", "preset-studio", "public", "textures", "backgrounds", "runner_emerald_wide.png");

            if (!File.Exists(sourceJpgPath))
            {
                Debug.LogError($"원본 JPG 파일을 찾을 수 없습니다: {sourceJpgPath}");
                return;
            }

            byte[] fileData = File.ReadAllBytes(sourceJpgPath);
            Texture2D sourceTex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            sourceTex.LoadImage(fileData);

            int width = sourceTex.width;
            int height = sourceTex.height;
            Color[] pixels = sourceTex.GetPixels();
            float[] alphaMask = new float[width * height];

            // 1. 초기 배경 마스크 판별 (흰색 배경 검출)
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    Color c = pixels[index];

                    // 배경 흰색/밝은 픽셀 감지 (RGB가 모두 높고 채도가 낮은 영역)
                    float maxComponent = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
                    float minComponent = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
                    float saturation = maxComponent > 0.001f ? (maxComponent - minComponent) / maxComponent : 0f;

                    // 흰색 배경 조건
                    bool isWhiteBackground = (c.r > 0.86f && c.g > 0.86f && c.b > 0.86f && saturation < 0.12f)
                                          || (c.r > 0.92f && c.g > 0.92f && c.b > 0.92f);

                    alphaMask[index] = isWhiteBackground ? 0f : 1f;
                }
            }

            // 2. 외곽 흰색 번짐(Halo) 방지를 위한 2단계 Erosion(침식) 처리
            float[] erodedMask = new float[width * height];
            System.Array.Copy(alphaMask, erodedMask, alphaMask.Length);

            int erosionRadius = 2;
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    if (alphaMask[index] <= 0f)
                    {
                        erodedMask[index] = 0f;
                        continue;
                    }

                    // 주변 반경에 배경(0)이 있으면 투명화
                    bool hasBackgroundNeighbor = false;
                    for (int dy = -erosionRadius; dy <= erosionRadius && !hasBackgroundNeighbor; dy++)
                    {
                        int ny = y + dy;
                        if (ny < 0 || ny >= height) { hasBackgroundNeighbor = true; break; }
                        for (int dx = -erosionRadius; dx <= erosionRadius; dx++)
                        {
                            int nx = x + dx;
                            if (nx < 0 || nx >= width) { hasBackgroundNeighbor = true; break; }
                            if (alphaMask[ny * width + nx] <= 0f)
                            {
                                hasBackgroundNeighbor = true;
                                break;
                            }
                        }
                    }

                    erodedMask[index] = hasBackgroundNeighbor ? 0f : 1f;
                }
            }

            // 3. 외곽 1픽셀 부드러운 안티앨리어싱
            Color[] finalPixels = new Color[width * height];
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    Color c = pixels[index];
                    float alpha = erodedMask[index];

                    if (alpha > 0f)
                    {
                        // 주변 불투명 비율로 경계 부드럽게
                        float sum = 0f;
                        int count = 0;
                        for (int dy = -1; dy <= 1; dy++)
                        {
                            int ny = y + dy;
                            if (ny < 0 || ny >= height) continue;
                            for (int dx = -1; dx <= 1; dx++)
                            {
                                int nx = x + dx;
                                if (nx < 0 || nx >= width) continue;
                                sum += erodedMask[ny * width + nx];
                                count++;
                            }
                        }
                        alpha = sum / count;
                    }

                    finalPixels[index] = new Color(c.r, c.g, c.b, alpha);
                }
            }

            Texture2D resultTex = new Texture2D(width, height, TextureFormat.RGBA32, false);
            resultTex.SetPixels(finalPixels);
            resultTex.Apply();

            byte[] pngBytes = resultTex.EncodeToPNG();
            File.WriteAllBytes(destPngPath, pngBytes);
            if (Directory.Exists(Path.GetDirectoryName(publicPngPath)))
            {
                File.WriteAllBytes(publicPngPath, pngBytes);
            }

            Object.DestroyImmediate(sourceTex);
            Object.DestroyImmediate(resultTex);

            AssetDatabase.ImportAsset("Assets/Textures/Backgrounds/runner_emerald_wide.png", ImportAssetOptions.ForceUpdate);
            TextureImporter importer = AssetImporter.GetAtPath("Assets/Textures/Backgrounds/runner_emerald_wide.png") as TextureImporter;
            if (importer != null)
            {
                importer.alphaIsTransparency = true;
                importer.alphaSource = TextureImporterAlphaSource.FromInput;
                importer.SaveAndReimport();
            }

            Debug.Log("✨ runner_emerald_wide.png 테두리 흰색 제거 및 투명 컷아웃 완료!");
        }
    }
}
#endif
