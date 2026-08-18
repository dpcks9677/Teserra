using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 중세 여관/서재 테이블탑 우측 하단을 장식하는 3D 고광택 블랙 세라믹 잉크통과 깃펜 오브젝트
    /// </summary>
    [ExecuteAlways]
    public sealed class InkwellAndQuill : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        private void Awake()
        {
            EnsureGeometry();
        }

        private void OnEnable()
        {
            EnsureGeometry();
        }

#if UNITY_EDITOR
        private void OnValidate()
        {
            if (!Application.isPlaying)
            {
                UnityEditor.EditorApplication.delayCall -= DelayEnsureGeometry;
                UnityEditor.EditorApplication.delayCall += DelayEnsureGeometry;
            }
        }

        private void DelayEnsureGeometry()
        {
            if (this == null || gameObject == null) return;
            EnsureGeometry();
        }
#endif

        public void EnsureGeometry()
        {
            if (transform.childCount == 0 || IsGeometryMissing())
            {
                BuildGeometry();
            }
        }

        private bool IsGeometryMissing()
        {
            Transform quillRoot = transform.Find("Quill Pen Root");
            if (quillRoot == null) return true;
            Transform shaft = quillRoot.Find("Quill_Curved_Shaft");
            Transform blade = quillRoot.Find("Quill_Feather_Blade");
            if (shaft == null || blade == null) return true;
            MeshFilter shaftMf = shaft.GetComponent<MeshFilter>();
            MeshFilter bladeMf = blade.GetComponent<MeshFilter>();
            if (shaftMf == null || shaftMf.sharedMesh == null || shaftMf.sharedMesh.vertexCount == 0) return true;
            if (bladeMf == null || bladeMf.sharedMesh == null || bladeMf.sharedMesh.vertexCount == 0) return true;
            return false;
        }

        public static InkwellAndQuill Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Inkwell and Quill Decoration");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            InkwellAndQuill comp = root.AddComponent<InkwellAndQuill>();
            comp.BuildGeometry();
            return comp;
        }

        [ContextMenu("Rebuild Geometry")]
        public void BuildGeometry()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                Transform child = transform.GetChild(i);
                if (child == null) continue;
                if (Application.isPlaying)
                {
                    child.SetParent(null);
                    Destroy(child.gameObject);
                }
                else
                {
                    DestroyImmediate(child.gameObject);
                }
            }

            Shader litShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            // 1. 머티리얼 구성
            // 검은색 잉크통 머티리얼 (고광택 블랙 세라믹)
            Material blackCeramicBodyMat = CreateMaterial("Black Ceramic Body Material", litShader, new Color(0.08f, 0.08f, 0.09f), 0.25f, 0.90f);
            Material blackCeramicRimMat = CreateMaterial("Black Ceramic Rim Material", litShader, new Color(0.05f, 0.05f, 0.06f), 0.35f, 0.92f);
            Material liquidInkMat = CreateMaterial("Liquid Ink Material", litShader, new Color(0.02f, 0.02f, 0.02f), 0.10f, 0.96f);
            Material goldTrimMat = CreateMaterial("Antique Gold Trim Material", litShader, new Color(0.78f, 0.58f, 0.22f), 0.82f, 0.68f);

            // 깃털 펜 머티리얼 (깃대 뼈대 & 스타일라이즈드 깃털 텍스처)
            Material quillShaftMat = CreateMaterial("Quill Shaft Material", litShader, new Color(0.93f, 0.89f, 0.80f), 0.04f, 0.45f);
            Material quillFeatherMat = CreateMaterial("Quill Feather Material", litShader, Color.white, 0.01f, 0.16f);

            // 핸드페인티드 스타일의 깃털 알베도 & 노멀 텍스처 생성
            Texture2D featherTexture = GenerateStylizedFeatherTexture();
            Texture2D featherNormal = GenerateFeatherNormalMap();

            quillFeatherMat.mainTexture = featherTexture;
            if (quillFeatherMat.HasProperty("_BaseMap"))
            {
                quillFeatherMat.SetTexture("_BaseMap", featherTexture);
            }
            if (quillFeatherMat.HasProperty("_BumpMap"))
            {
                quillFeatherMat.SetTexture("_BumpMap", featherNormal);
                quillFeatherMat.EnableKeyword("_NORMALMAP");
                quillFeatherMat.SetFloat("_BumpScale", 0.75f);
            }

            // 2. 원통형 블랙 잉크통 (Cylindrical Black Inkwell)
            GameObject inkwellGroup = new("Inkwell Body");
            inkwellGroup.layer = DecorationLayer;
            inkwellGroup.transform.SetParent(transform, false);

            // 2-1. 하단 받침대 (Base Rim)
            GameObject baseRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseRim.name = "Inkwell_BaseRim";
            SetupPart(baseRim, inkwellGroup.transform, new Vector3(0f, 0.08f, 0f), Vector3.zero, new Vector3(1.35f, 0.08f, 1.35f), blackCeramicRimMat);

            // 2-2. 중앙 원통형 메인 바디 (빛 반사 하이라이트가 맺히는 본체)
            GameObject mainBody = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mainBody.name = "Inkwell_MainBody";
            SetupPart(mainBody, inkwellGroup.transform, new Vector3(0f, 0.40f, 0f), Vector3.zero, new Vector3(1.05f, 0.28f, 1.05f), blackCeramicBodyMat);

            // 2-3. 입구 골드 림 액센트 링 (Antique Gold Ring)
            GameObject goldRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            goldRing.name = "Inkwell_GoldRing";
            SetupPart(goldRing, inkwellGroup.transform, new Vector3(0f, 0.68f, 0f), Vector3.zero, new Vector3(0.82f, 0.02f, 0.82f), goldTrimMat);

            // 2-4. 상단 병목 및 입구 림 (Neck Rim)
            GameObject neckRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            neckRim.name = "Inkwell_NeckRim";
            SetupPart(neckRim, inkwellGroup.transform, new Vector3(0f, 0.74f, 0f), Vector3.zero, new Vector3(0.72f, 0.07f, 0.72f), blackCeramicRimMat);

            // 2-5. 입구 내부 액체 잉크 표면 (Liquid Ink Surface)
            GameObject inkSurface = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            inkSurface.name = "Inkwell_LiquidInk";
            SetupPart(inkSurface, inkwellGroup.transform, new Vector3(0f, 0.78f, 0f), Vector3.zero, new Vector3(0.56f, 0.01f, 0.56f), liquidInkMat);

            // 3. 2시 방향으로 우아하게 기울어진 깃펜 (Feather Quill Pen)
            GameObject quillRoot = new("Quill Pen Root");
            quillRoot.layer = DecorationLayer;
            quillRoot.transform.SetParent(transform, false);
            quillRoot.transform.localPosition = new Vector3(0f, 0.78f, 0f);

            // 사선 틸트: Pitch 40°, Yaw -65°, Roll 20°
            quillRoot.transform.localRotation = Quaternion.Euler(40f, -65f, 20f);

            // 3-1. 펜촉 (금속 골든 닙)
            GameObject nib = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            nib.name = "Quill_Nib";
            SetupPart(nib, quillRoot.transform, new Vector3(0f, 0.12f, 0f), Vector3.zero, new Vector3(0.06f, 0.14f, 0.06f), goldTrimMat);

            // 3-2. 펜대-깃털 연결 장식 링 (Ornate Gold Ferrule)
            GameObject ferrule = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ferrule.name = "Quill_Ferrule";
            SetupPart(ferrule, quillRoot.transform, new Vector3(0f, 0.28f, 0f), Vector3.zero, new Vector3(0.085f, 0.035f, 0.085f), goldTrimMat);

            // 3-3. 프로시저럴 곡선 깃대 (Tapered Curved Spine / Rachis)
            GameObject shaftObj = new("Quill_Curved_Shaft");
            MeshFilter shaftMf = shaftObj.AddComponent<MeshFilter>();
            shaftMf.sharedMesh = BuildCurvedShaftMesh();
            MeshRenderer shaftMr = shaftObj.AddComponent<MeshRenderer>();
            shaftMr.sharedMaterial = quillShaftMat;
            SetupPart(shaftObj, quillRoot.transform, Vector3.zero, Vector3.zero, Vector3.one, quillShaftMat);

            // 3-4. 프로시저럴 정교한 3D 깃판 (Procedural Stylized Feather Blade)
            GameObject featherObj = new("Quill_Feather_Blade");
            MeshFilter featherMf = featherObj.AddComponent<MeshFilter>();
            featherMf.sharedMesh = BuildProceduralFeatherMesh();
            MeshRenderer featherMr = featherObj.AddComponent<MeshRenderer>();
            featherMr.sharedMaterial = quillFeatherMat;
            SetupPart(featherObj, quillRoot.transform, Vector3.zero, Vector3.zero, Vector3.one, quillFeatherMat);
        }

        /// <summary>
        /// 깃털 중심을 따라 완만하게 위로 뻗어나가며 가늘어지는 곡선형 깃대(Rachis) 3D 메쉬 생성
        /// </summary>
        private static Mesh BuildCurvedShaftMesh()
        {
            Mesh mesh = new() { name = "Procedural_Quill_Shaft" };

            const int segments = 28;
            const int radialSegments = 8;
            const float startY = 0.25f;
            const float totalLength = 2.45f;
            const float baseRadius = 0.026f;
            const float tipRadius = 0.005f;

            int vertCount = (segments + 1) * radialSegments;
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];

            for (int s = 0; s <= segments; s++)
            {
                float t = (float)s / segments;
                float y = startY + t * totalLength;

                // 완만한 자연스러운 곡선 (상단으로 갈수록 살짝 우측/후방으로 휨)
                float curveX = Mathf.Pow(t, 1.35f) * 0.085f;
                float curveZ = Mathf.Sin(t * Mathf.PI * 0.85f) * 0.030f;
                Vector3 center = new(curveX, y, curveZ);

                float radius = Mathf.Lerp(baseRadius, tipRadius, t);

                for (int r = 0; r < radialSegments; r++)
                {
                    float angle = ((float)r / radialSegments) * Mathf.PI * 2f;
                    float cos = Mathf.Cos(angle);
                    float sin = Mathf.Sin(angle);

                    Vector3 normal = new(cos, 0f, sin);
                    Vector3 pos = center + new Vector3(cos * radius, 0f, sin * radius);

                    int idx = s * radialSegments + r;
                    vertices[idx] = pos;
                    normals[idx] = normal;
                    uvs[idx] = new Vector2((float)r / radialSegments, t);
                }
            }

            int triCount = segments * radialSegments * 6;
            int[] triangles = new int[triCount];
            int triIdx = 0;

            for (int s = 0; s < segments; s++)
            {
                for (int r = 0; r < radialSegments; r++)
                {
                    int nextR = (r + 1) % radialSegments;

                    int i0 = s * radialSegments + r;
                    int i1 = (s + 1) * radialSegments + r;
                    int i2 = (s + 1) * radialSegments + nextR;
                    int i3 = s * radialSegments + nextR;

                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i1;
                    triangles[triIdx++] = i2;

                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i2;
                    triangles[triIdx++] = i3;
                }
            }

            mesh.vertices = vertices;
            mesh.normals = normals;
            mesh.uv = uvs;
            mesh.triangles = triangles;
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// 실제 조류 깃털(Primary Feather)의 우아한 비대칭 타원형 실루엣과 부드러운 아치 곡면을 가진 3D 깃판 메쉬 생성
        /// </summary>
        private static Mesh BuildProceduralFeatherMesh()
        {
            Mesh mesh = new() { name = "Procedural_Quill_Feather_Blade" };

            const int slices = 48;          // 높이 방향 세그먼트 (매끄러운 곡선)
            const int cols = 7;             // 횡단면 정점 수 (더 둥글고 부드러운 날개 곡면)
            const float startY = 0.42f;
            const float totalLength = 2.25f;

            int vertCount = (slices + 1) * cols;
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];

            for (int s = 0; s <= slices; s++)
            {
                float t = (float)s / slices; // 0.0 (하단) ~ 1.0 (최상단 팁)
                float y = startY + t * totalLength;

                // 깃대 중심 스플라인과 일치하는 곡선 좌표
                float curveX = Mathf.Pow(t, 1.35f) * 0.085f;
                float curveZ = Mathf.Sin(t * Mathf.PI * 0.85f) * 0.030f;
                Vector3 center = new(curveX, y, curveZ);

                // 1. 매끄러운 깃털 타원 실루엣 (Smooth Feather Silhouette - 찢어짐 없는 유기적 곡선)
                // - 하단 기저부(0.0~0.15): 부드러운 꽃봉오리 확장
                // - 중앙 바디(0.15~0.75): 35% 높이에서 최대 폭(0.40f) 달성 후 완만하게 수렴
                // - 상단 팁(0.75~1.0): 날렵하고 뾰족한 끝으로 우아하게 마감
                float baseWidth;
                if (t < 0.15f)
                {
                    float u = t / 0.15f;
                    baseWidth = Mathf.Sin(u * Mathf.PI * 0.5f) * 0.28f;
                }
                else if (t < 0.40f)
                {
                    float u = (t - 0.15f) / 0.25f;
                    baseWidth = Mathf.Lerp(0.28f, 0.41f, Mathf.Sin(u * Mathf.PI * 0.5f));
                }
                else
                {
                    float u = (t - 0.40f) / 0.60f;
                    // 상단 끝으로 갈수록 부드러운 코사인 곡선으로 뾰족하게 수렴
                    baseWidth = Mathf.Cos(u * Mathf.PI * 0.5f) * 0.41f;
                    baseWidth = Mathf.Pow(Mathf.Max(0f, baseWidth / 0.41f), 0.85f) * 0.41f;
                }

                // 2. 조류 비행 깃의 자연스러운 비대칭 폭 (좌측: 바깥 날개 1.14, 우측: 안쪽 날개 0.86)
                float leftWidth = baseWidth * 1.14f;
                float rightWidth = baseWidth * 0.86f;

                // 3. 횡단면 7개 정점 계산 (중심 깃대에서 외곽으로 완만하게 둥글어지는 파라볼릭 아치)
                for (int c = 0; c < cols; c++)
                {
                    float colFactor = (c - 3) / 3.0f; // -1.0(좌외곽) ~ 0(중심) ~ 1.0(우외곽)
                    float spanX = colFactor < 0 ? (-colFactor * leftWidth) : (colFactor * rightWidth);

                    // 깃대 중심에서 외곽으로 갈수록 뒤쪽(-Z)으로 완만하게 굽어지는 부드러운 돔 곡면
                    float camberZ = -Mathf.Pow(Mathf.Abs(colFactor), 1.6f) * 0.038f;

                    Vector3 pos = center + new Vector3(spanX, 0f, camberZ);

                    int idx = s * cols + c;
                    vertices[idx] = pos;

                    // UV 매핑: U는 0(좌) ~ 1(우), V는 0(하) ~ 1(상)
                    float uCoord = (float)c / (cols - 1);
                    uvs[idx] = new Vector2(uCoord, t);

                    normals[idx] = new Vector3(0f, 0f, 1f);
                }
            }

            // 양면 렌더링(Double-sided) 삼각형 인덱스 구성 (앞면 + 뒷면)
            int quadCount = slices * (cols - 1);
            int[] triangles = new int[quadCount * 6 * 2];
            int triIdx = 0;

            for (int s = 0; s < slices; s++)
            {
                for (int c = 0; c < cols - 1; c++)
                {
                    int i0 = s * cols + c;
                    int i1 = (s + 1) * cols + c;
                    int i2 = (s + 1) * cols + (c + 1);
                    int i3 = s * cols + (c + 1);

                    // 앞면 (Front Face)
                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i1;
                    triangles[triIdx++] = i2;

                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i2;
                    triangles[triIdx++] = i3;

                    // 뒷면 (Back Face)
                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i2;
                    triangles[triIdx++] = i1;

                    triangles[triIdx++] = i0;
                    triangles[triIdx++] = i3;
                    triangles[triIdx++] = i2;
                }
            }

            mesh.vertices = vertices;
            mesh.uv = uvs;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// 40° 사선 깃털 결(Fine Barbs)과 3단 웜 판타지 그라데이션이 적용된 512x1024 깃털 텍스처 생성
        /// </summary>
        private static Texture2D GenerateStylizedFeatherTexture()
        {
            const int width = 512;
            const int height = 1024;
            Texture2D tex = new(width, height, TextureFormat.RGBA32, false)
            {
                name = "Stylized_Quill_Feather_Albedo",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };

            // 3단 웜 판타지 컬러 팔레트
            Color centerIvory = new(0.98f, 0.95f, 0.88f, 1.0f);     // 웜 바닐라 크림 / 아이보리
            Color middleWarmToffee = new(0.74f, 0.48f, 0.27f, 1.0f); // 웜 토피 브라운 / 골든 앰버
            Color edgeMahogany = new(0.38f, 0.20f, 0.10f, 1.0f);    // 앤틱 마호가니 에스프레소
            Color spineBright = new(1.0f, 0.99f, 0.95f, 1.0f);      // 중심 깃대 하이라이트

            Color[] pixels = new Color[width * height];

            for (int y = 0; y < height; y++)
            {
                float v = (float)y / height; // 0 (하단) ~ 1 (상단)

                for (int x = 0; x < width; x++)
                {
                    float u = (float)x / width; // 0 (좌) ~ 0.5 (중심) ~ 1 (우)
                    float distFromCenter = Mathf.Abs(u - 0.5f) * 2.0f; // 0.0 (중심) ~ 1.0 (외곽)

                    // 1. 깃대에서 바깥쪽으로 뻗어나가는 40° 사선 결(Barb) 좌표
                    float barbLine = v - distFromCenter * 0.35f;

                    // 미세한 깃털 결 (다중 주파수 합성)
                    float barbNoise1 = Mathf.Sin(barbLine * 140f * Mathf.PI * 2f);
                    float barbNoise2 = Mathf.Sin(barbLine * 280f * Mathf.PI * 2f);
                    float barbPattern = (barbNoise1 * 0.6f + barbNoise2 * 0.4f) * 0.06f;

                    // 2. 중심 -> 중간 -> 외곽 3단 그라데이션
                    float blendDist = Mathf.Clamp01(Mathf.Pow(distFromCenter, 1.15f) + barbPattern);
                    Color col;
                    if (blendDist < 0.45f)
                    {
                        float t1 = blendDist / 0.45f;
                        col = Color.Lerp(centerIvory, middleWarmToffee, t1);
                    }
                    else
                    {
                        float t2 = (blendDist - 0.45f) / 0.55f;
                        col = Color.Lerp(middleWarmToffee, edgeMahogany, t2);
                    }

                    // 3. 상단 팁 앤틱 마호가니 블렌드
                    if (v > 0.60f)
                    {
                        float tipFactor = Mathf.Clamp01((v - 0.60f) / 0.40f);
                        col = Color.Lerp(col, edgeMahogany, tipFactor * 0.80f);
                    }

                    // 4. 중심 깃대(Spine) 하이라이트
                    if (distFromCenter < 0.08f)
                    {
                        float spineBlend = 1.0f - (distFromCenter / 0.08f);
                        col = Color.Lerp(col, spineBright, spineBlend * 0.60f);
                    }

                    pixels[y * width + x] = col;
                }
            }

            tex.SetPixels(pixels);
            tex.Apply(false, true);
            return tex;
        }

        /// <summary>
        /// 깃털 결(Barb)을 입체적으로 살려주는 512x1024 프로시저럴 노멀맵 생성
        /// </summary>
        private static Texture2D GenerateFeatherNormalMap()
        {
            const int width = 512;
            const int height = 1024;
            Texture2D tex = new(width, height, TextureFormat.RGBA32, false)
            {
                name = "Stylized_Quill_Feather_Normal",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };

            Color[] pixels = new Color[width * height];

            for (int y = 0; y < height; y++)
            {
                float v = (float)y / height;

                for (int x = 0; x < width; x++)
                {
                    float u = (float)x / width;
                    float distFromCenter = Mathf.Abs(u - 0.5f) * 2.0f;
                    float sign = u >= 0.5f ? 1f : -1f;

                    // 40° 사선 방향의 결 노멀 벡터 계산
                    float barbLine = v - distFromCenter * 0.35f;
                    float barbSlope = Mathf.Cos(barbLine * 140f * Mathf.PI * 2f);

                    float nx = -sign * 0.25f + barbSlope * 0.15f;
                    float ny = barbSlope * 0.12f;
                    float nz = 1.0f;

                    Vector3 norm = new Vector3(nx, ny, nz).normalized;
                    // [-1, 1] -> [0, 1]
                    pixels[y * width + x] = new Color(norm.x * 0.5f + 0.5f, norm.y * 0.5f + 0.5f, norm.z * 0.5f + 0.5f, 1.0f);
                }
            }

            tex.SetPixels(pixels);
            tex.Apply(false, true);
            return tex;
        }

        private static void SetupPart(GameObject obj, Transform parent, Vector3 localPos, Vector3 localRot, Vector3 localScale, Material mat)
        {
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);
            obj.transform.localPosition = localPos;
            obj.transform.localRotation = Quaternion.Euler(localRot);
            obj.transform.localScale = localScale;

            Collider col = obj.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }

            MeshRenderer mr = obj.GetComponent<MeshRenderer>();
            if (mr != null)
            {
                if (Application.isPlaying) mr.material = mat;
                else mr.sharedMaterial = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }

        private static Material CreateMaterial(string name, Shader shader, Color color, float metallic, float smoothness)
        {
            Material mat = new(shader)
            {
                name = name,
                color = color
            };
            mat.SetFloat("_Metallic", metallic);
            mat.SetFloat("_Smoothness", smoothness);
            return mat;
        }
    }
}
