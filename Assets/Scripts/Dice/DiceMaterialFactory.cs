using System;
using UnityEngine;

namespace Tessera.Dice
{
    public static class DiceMaterialFactory
    {
        private const int TextureSize = 256;
        // 서브메쉬 순서: Right(3), Left(4), Top(1), Bottom(6), Front(2), Back(5)
        private static readonly int[] FaceValues = { 3, 4, 1, 6, 2, 5 };
        private static Material[] normalMaterials;
        private static Material[] faceOverlayMaterials;

        public static Material[] GetNormalMaterials()
        {
            if (normalMaterials != null && Array.TrueForAll(normalMaterials, material => material != null))
            {
                return normalMaterials;
            }

            normalMaterials = new Material[FaceValues.Length];
            for (int index = 0; index < FaceValues.Length; index++)
            {
                Texture2D texture = CreateFaceTexture(FaceValues[index]);
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                Material material = new(shader)
                {
                    name = $"Dice_Face_{FaceValues[index]}",
                    color = Color.white
                };
                if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", Color.white);
                if (material.HasProperty("_BaseMap")) material.SetTexture("_BaseMap", texture);
                if (material.HasProperty("_MainTex")) material.SetTexture("_MainTex", texture);
                material.mainTexture = texture;
                if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", 0f);
                if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 0.58f);
                normalMaterials[index] = material;
            }
            return normalMaterials;
        }

        public static void AttachFaceOverlays(Transform die)
        {
            if (die == null) return;
            Material[] materials = GetFaceOverlayMaterials();
            for (int face = 0; face < FaceValues.Length; face++)
            {
                Vector3 normal = DiceFaceOrientation.GetFaceNormal(FaceValues[face]);
                Vector3 verticalAxis = DiceFaceOrientation.GetFaceUpAxis(FaceValues[face]);
                GameObject overlay = GameObject.CreatePrimitive(PrimitiveType.Quad);
                overlay.name = $"Face_{FaceValues[face]}_Overlay";
                overlay.transform.SetParent(die, false);
                overlay.transform.localPosition = normal * 0.8105f;
                overlay.transform.localRotation = Quaternion.LookRotation(normal, verticalAxis);
                overlay.transform.localScale = Vector3.one * 1.18f;
                overlay.GetComponent<Renderer>().sharedMaterial = materials[face];
                overlay.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                overlay.GetComponent<Renderer>().receiveShadows = false;
                Collider collider = overlay.GetComponent<Collider>();
                if (Application.isPlaying) UnityEngine.Object.Destroy(collider);
                else UnityEngine.Object.DestroyImmediate(collider);
            }
        }

        public static void ApplyPredictedTopValue(Transform die, Quaternion landingRotation, int targetTopValue)
        {
            if (die == null) return;
            int[] remappedValues = DiceFaceOrientation.GetRemappedFaceValues(landingRotation, targetTopValue);
            Material[] baseMaterials = GetNormalMaterials();
            Material[] overlayMaterials = GetFaceOverlayMaterials();
            Material[] remappedBaseMaterials = new Material[FaceValues.Length];

            for (int physicalFace = 0; physicalFace < FaceValues.Length; physicalFace++)
            {
                int faceValue = FaceValues[physicalFace];
                int targetValueForThisFace = remappedValues[faceValue - 1];
                int materialIndex = GetMaterialIndex(targetValueForThisFace);
                remappedBaseMaterials[physicalFace] = baseMaterials[materialIndex];

                Transform overlay = die.Find($"Face_{faceValue}_Overlay");
                if (overlay != null)
                {
                    overlay.GetComponent<Renderer>().sharedMaterial = overlayMaterials[materialIndex];
                }
            }

            Renderer renderer = die.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterials = remappedBaseMaterials;
        }

        private static int GetMaterialIndex(int value)
        {
            for (int index = 0; index < FaceValues.Length; index++)
            {
                if (FaceValues[index] == value) return index;
            }
            throw new ArgumentOutOfRangeException(nameof(value));
        }

        private static Material[] GetFaceOverlayMaterials()
        {
            if (faceOverlayMaterials != null && Array.TrueForAll(faceOverlayMaterials, material => material != null))
            {
                return faceOverlayMaterials;
            }

            Material[] source = GetNormalMaterials();
            faceOverlayMaterials = new Material[source.Length];
            for (int index = 0; index < source.Length; index++)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Texture");
                Material material = new(shader)
                {
                    name = $"Dice_Face_{FaceValues[index]}_Overlay",
                    color = Color.white
                };
                Texture texture = source[index].mainTexture;
                if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", Color.white);
                if (material.HasProperty("_BaseMap")) material.SetTexture("_BaseMap", texture);
                if (material.HasProperty("_MainTex")) material.SetTexture("_MainTex", texture);
                if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);
                material.mainTexture = texture;
                faceOverlayMaterials[index] = material;
            }
            return faceOverlayMaterials;
        }

        private static Texture2D CreateFaceTexture(int value)
        {
            Color32 background = new(0xff, 0xff, 0xff, 0xff);
            Color32 dotColor = new(0x1a, 0x1a, 0x1a, 0xff);

            Color32[] pixels = new Color32[TextureSize * TextureSize];
            for (int y = 0; y < TextureSize; y++)
            {
                for (int x = 0; x < TextureSize; x++)
                {
                    pixels[y * TextureSize + x] = background;
                }
            }

            const int center = 128;
            const int offset = 60;
            int radius = value == 1 ? 36 : 25;

            if (value == 1 || value == 3 || value == 5) DrawDot(pixels, center, center, dotColor, radius);
            if (value >= 2)
            {
                DrawDot(pixels, center - offset, center - offset, dotColor, radius);
                DrawDot(pixels, center + offset, center + offset, dotColor, radius);
            }
            if (value >= 4)
            {
                DrawDot(pixels, center + offset, center - offset, dotColor, radius);
                DrawDot(pixels, center - offset, center + offset, dotColor, radius);
            }
            if (value == 6)
            {
                DrawDot(pixels, center - offset, center, dotColor, radius);
                DrawDot(pixels, center + offset, center, dotColor, radius);
            }

            Texture2D texture = new(TextureSize, TextureSize, TextureFormat.RGBA32, true, false)
            {
                name = $"Dice_Face_Tex_{value}",
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            texture.SetPixels32(pixels);
            texture.Apply(true, false);
            return texture;
        }

        private static void DrawDot(Color32[] pixels, int centerX, int centerY, Color32 color, int radius)
        {
            int radiusSquared = radius * radius;
            for (int y = centerY - radius; y <= centerY + radius; y++)
            {
                for (int x = centerX - radius; x <= centerX + radius; x++)
                {
                    int dx = x - centerX;
                    int dy = y - centerY;
                    int distSq = dx * dx + dy * dy;
                    if (distSq <= radiusSquared)
                    {
                        // 음각 입체감: 상단(-dy) 방향으로 갈수록 어둡게, 하단(+dy) 방향으로 갈수록 살짝 밝게
                        float normalizedY = dy / (float)radius; // -1.0(상단) ~ +1.0(하단)
                        float shadowFactor = Mathf.Lerp(0.72f, 1.15f, (normalizedY + 1f) * 0.5f);
                        byte r = (byte)Mathf.Clamp((int)(color.r * shadowFactor), 0, 255);
                        byte g = (byte)Mathf.Clamp((int)(color.g * shadowFactor), 0, 255);
                        byte b = (byte)Mathf.Clamp((int)(color.b * shadowFactor), 0, 255);

                        pixels[y * TextureSize + x] = new Color32(r, g, b, color.a);
                    }
                }
            }
        }
    }
}
