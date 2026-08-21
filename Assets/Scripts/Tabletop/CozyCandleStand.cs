using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 테이블 좌측 하단을 아늑하게 장식하는 3D 스타일라이즈드 밀랍 필라 양초 3구 클러스터
    /// - 레퍼런스 스타일: 하단이 완만하게 퍼지는 테이퍼드 바디, 비스듬히 기울어진 상단 멜팅 림, 두툼하게 흘러내리는 유기적 왁스 숄더
    /// - 몸체 간 겹침/간섭이 전혀 없는 완벽한 이격 배치 및 바닥 왁스 웅덩이 공유
    /// - 팁이 부드러운 S자 곡선으로 휘어진 3D 스타일라이즈드 불꽃 메쉬 & 탄화된 흑갈색 심지
    /// - 대/중/소 3개 양초 클러스터 및 개별 위상의 부드러운 불꽃 흔들림, 따뜻한 골든 앰버 촛불 조명
    /// </summary>
    [ExecuteAlways]
    public sealed class CozyCandleStand : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("Lighting Settings")]
        [SerializeField] private float baseLightIntensity = 1.35f;
        [SerializeField] private float lightFlickerAmount = 0.18f;
        [SerializeField] private float flickerSpeed = 3.2f;

        private Light candleLight;
        private Transform mainFlameTransform;
        private Transform medFlameTransform;
        private Transform smallFlameTransform;

        private Vector3 mainFlameBaseScale = new Vector3(0.095f, 0.20f, 0.095f);
        private Vector3 medFlameBaseScale = new Vector3(0.080f, 0.16f, 0.080f);
        private Vector3 smallFlameBaseScale = new Vector3(0.065f, 0.13f, 0.065f);

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
            Transform mainCandle = transform.Find("Candle_Trio_Cluster/Candle_Main");
            return mainCandle == null;
        }

        public static CozyCandleStand Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Cozy Beeswax Candle Decoration");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            CozyCandleStand comp = root.AddComponent<CozyCandleStand>();
            comp.BuildGeometry();
            return comp;
        }

        private void Update()
        {
            float t = Time.time * flickerSpeed;
            float noiseA = Mathf.PerlinNoise(t, 0f);
            float noiseB = Mathf.PerlinNoise(0f, t * 1.3f);
            float flicker = (noiseA - 0.5f) * 2f * lightFlickerAmount;

            if (candleLight != null)
            {
                candleLight.intensity = Mathf.Max(0.2f, baseLightIntensity + flicker);
            }

            // 1. 메인 불꽃 모션
            if (mainFlameTransform != null)
            {
                float pY = 1.0f + (noiseA - 0.5f) * 0.16f;
                float pXZ = 1.0f - (noiseA - 0.5f) * 0.08f;
                mainFlameTransform.localScale = new Vector3(mainFlameBaseScale.x * pXZ, mainFlameBaseScale.y * pY, mainFlameBaseScale.z * pXZ);
                float swayX = Mathf.Sin(t * 1.4f) * 3.5f + (noiseB - 0.5f) * 4.0f;
                float swayZ = Mathf.Cos(t * 1.1f) * 3.5f + (noiseA - 0.5f) * 4.0f;
                mainFlameTransform.localRotation = Quaternion.Euler(swayX, 0f, swayZ);
            }

            // 2. 중형 불꽃 모션
            if (medFlameTransform != null)
            {
                float tMed = t + 8.4f;
                float nMed = Mathf.PerlinNoise(tMed, 0f);
                float pY = 1.0f + (nMed - 0.5f) * 0.15f;
                float pXZ = 1.0f - (nMed - 0.5f) * 0.08f;
                medFlameTransform.localScale = new Vector3(medFlameBaseScale.x * pXZ, medFlameBaseScale.y * pY, medFlameBaseScale.z * pXZ);
                float swayX = Mathf.Sin(tMed * 1.3f) * 3.0f;
                float swayZ = Mathf.Cos(tMed * 1.0f) * 3.0f;
                medFlameTransform.localRotation = Quaternion.Euler(swayX, 0f, swayZ);
            }

            // 3. 소형 불꽃 모션
            if (smallFlameTransform != null)
            {
                float tSmall = t + 16.7f;
                float nSmall = Mathf.PerlinNoise(tSmall, 0f);
                float pY = 1.0f + (nSmall - 0.5f) * 0.14f;
                float pXZ = 1.0f - (nSmall - 0.5f) * 0.07f;
                smallFlameTransform.localScale = new Vector3(smallFlameBaseScale.x * pXZ, smallFlameBaseScale.y * pY, smallFlameBaseScale.z * pXZ);
                float swayX = Mathf.Sin(tSmall * 1.6f) * 2.8f;
                float swayZ = Mathf.Cos(tSmall * 1.2f) * 2.8f;
                smallFlameTransform.localRotation = Quaternion.Euler(swayX, 0f, swayZ);
            }
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
            Shader unlitShader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? litShader;

            // 1. 레퍼런스 스타일 Opaque 머티리얼 구성 (완전 불투명 렌더링)
            // 1-1. 부드럽고 뽀얀 밀랍 아이보리 톤 (Soft Warm Ivory Wax)
            Color waxColor = new Color(0.98f, 0.95f, 0.92f);
            Material waxMat = CreateOpaqueMaterial("Stylized_Wax_Mat", litShader, waxColor, 0.02f, 0.52f);

            // 1-2. 탄화된 흑갈색 심지 (Charred Wick)
            Color wickColor = new Color(0.18f, 0.12f, 0.08f);
            Material wickMat = CreateOpaqueMaterial("Candle_Wick_Mat", litShader, wickColor, 0.10f, 0.25f);

            // 1-3. 스타일라이즈드 골든 앰버 불꽃 머티리얼 (Golden Amber S-Curve Flame)
            Color flameColor = new Color(1.00f, 0.82f, 0.32f, 1.0f);
            Color flameEmission = new Color(1.00f, 0.55f, 0.10f) * 2.6f;
            Material flameMat = new Material(unlitShader) { name = "Stylized_Flame_Mat" };
            if (flameMat.HasProperty("_BaseColor")) flameMat.SetColor("_BaseColor", flameColor);
            if (flameMat.HasProperty("_Color")) flameMat.SetColor("_Color", flameColor);
            if (flameMat.HasProperty("_EmissionColor"))
            {
                flameMat.EnableKeyword("_EMISSION");
                flameMat.SetColor("_EmissionColor", flameEmission);
            }

            GameObject clusterRoot = new("Candle_Trio_Cluster");
            clusterRoot.layer = DecorationLayer;
            clusterRoot.transform.SetParent(transform, false);

            // 2. 바닥에 자연스럽게 굳은 왁스 웅덩이 베이스 (Wax Base Puddles - 3개 양초를 넓게 감싸는 일체형 풀)
            CreateWaxPuddle(clusterRoot.transform, new Vector3(0.00f, 0.004f, 0.00f), 0.55f, 0.52f, waxMat);
            CreateWaxPuddle(clusterRoot.transform, new Vector3(-0.70f, 0.004f, 0.36f), 0.48f, 0.44f, waxMat);
            CreateWaxPuddle(clusterRoot.transform, new Vector3(0.62f, 0.004f, 0.44f), 0.40f, 0.38f, waxMat);
            CreateWaxPuddle(clusterRoot.transform, new Vector3(-0.05f, 0.003f, 0.26f), 0.65f, 0.50f, waxMat);

            // 3. 3구 캔들 클러스터 생성 (대, 중, 소 - 서로 겹치지 않도록 반경 합 이상 이격 배치)
            // 3-1. 대형 메인 양초 (Main Pillar Candle - 키 1.05m, 반경 0.38m, 우측 14도 슬랜트)
            CreateCandle(clusterRoot.transform, "Candle_Main", new Vector3(0.00f, 0f, 0.00f),
                baseRadius: 0.38f, topRadius: 0.27f, height: 1.05f, slantAngleDeg: 14f, slantDirDeg: 60f,
                waxMat, wickMat, flameMat, mainFlameBaseScale, out mainFlameTransform, seed: 1);

            // 3-2. 중형 서브 양초 (Medium Pillar Candle - 키 0.72m, 반경 0.32m, 좌측앞 -16도 슬랜트, 거리 0.78m)
            CreateCandle(clusterRoot.transform, "Candle_Medium", new Vector3(-0.70f, 0f, 0.36f),
                baseRadius: 0.32f, topRadius: 0.23f, height: 0.72f, slantAngleDeg: -16f, slantDirDeg: 210f,
                waxMat, wickMat, flameMat, medFlameBaseScale, out medFlameTransform, seed: 2);

            // 3-3. 소형 미니 양초 (Small Pillar Candle - 키 0.48m, 반경 0.26m, 우측뒤 18도 슬랜트, 거리 0.76m)
            CreateCandle(clusterRoot.transform, "Candle_Small", new Vector3(0.62f, 0f, 0.44f),
                baseRadius: 0.26f, topRadius: 0.19f, height: 0.48f, slantAngleDeg: 18f, slantDirDeg: 135f,
                waxMat, wickMat, flameMat, smallFlameBaseScale, out smallFlameTransform, seed: 3);

            // 4. 아늑한 골든 앰버 촛불 포인트 라이트 (Warm Golden Amber Point Light)
            GameObject lightObj = new("Candle_Point_Light");
            lightObj.layer = DecorationLayer;
            lightObj.transform.SetParent(clusterRoot.transform, false);
            lightObj.transform.localPosition = new Vector3(0f, 1.30f, 0f);

            candleLight = lightObj.AddComponent<Light>();
            candleLight.type = LightType.Point;
            candleLight.color = new Color(1.00f, 0.60f, 0.20f); // 2800K Warm Golden Amber
            candleLight.range = 6.5f;
            candleLight.intensity = baseLightIntensity;
            candleLight.shadows = LightShadows.None;
        }

        private void CreateCandle(Transform parent, string name, Vector3 localPos,
            float baseRadius, float topRadius, float height, float slantAngleDeg, float slantDirDeg,
            Material waxMat, Material wickMat, Material flameMat, Vector3 flameScale, out Transform flameTransform, int seed)
        {
            GameObject candleObj = new(name);
            candleObj.layer = DecorationLayer;
            candleObj.transform.SetParent(parent, false);
            candleObj.transform.localPosition = localPos;

            // 1. 레퍼런스 1:1 유기적 멜팅 필라 캔들 메쉬 (테이퍼드 바디 + 비스듬한 림 + 왁스 숄더 드립)
            Mesh candleMesh = CreateStylizedCandleMesh(baseRadius, topRadius, height, slantAngleDeg, slantDirDeg, seed);
            MeshFilter mf = candleObj.AddComponent<MeshFilter>();
            mf.sharedMesh = candleMesh;

            MeshRenderer mr = candleObj.AddComponent<MeshRenderer>();
            if (Application.isPlaying) mr.material = waxMat;
            else mr.sharedMaterial = waxMat;
            mr.shadowCastingMode = ShadowCastingMode.On;
            mr.receiveShadows = true;

            // 2. 탄화된 흑갈색 심지 (Wick)
            float wickH = 0.09f;
            Vector3 wickBasePos = new Vector3(0f, height - 0.015f, 0f);
            GameObject wick = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wick.name = "Wick";
            SetupPart(wick, candleObj.transform, wickBasePos + new Vector3(0f, wickH * 0.5f, 0f), Vector3.zero, new Vector3(0.024f, wickH * 0.5f, 0.024f), wickMat);

            // 3. 레퍼런스 스타일 3D S-커브 불꽃 메쉬 (Curved S-Tip Flame)
            GameObject flame = new("Flame");
            flame.layer = DecorationLayer;
            flame.transform.SetParent(candleObj.transform, false);
            flame.transform.localPosition = wickBasePos + new Vector3(0f, wickH + 0.008f, 0f);

            Mesh flameMesh = CreateCurvedFlameMesh();
            MeshFilter flameMf = flame.AddComponent<MeshFilter>();
            flameMf.sharedMesh = flameMesh;

            MeshRenderer flameMr = flame.AddComponent<MeshRenderer>();
            if (Application.isPlaying) flameMr.material = flameMat;
            else flameMr.sharedMaterial = flameMat;
            flameMr.shadowCastingMode = ShadowCastingMode.Off;
            flameMr.receiveShadows = false;

            flame.transform.localScale = flameScale;
            flameTransform = flame.transform;
        }

        private static void CreateWaxPuddle(Transform parent, Vector3 localPos, float radiusX, float radiusZ, Material mat)
        {
            GameObject puddle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            puddle.name = "Wax_Base_Puddle";
            SetupPart(puddle, parent, localPos, Vector3.zero, new Vector3(radiusX * 2f, 0.006f, radiusZ * 2f), mat);
        }

        /// <summary>
        /// 레퍼런스 이미지 스타일의 유기적인 멜팅 캔들 메쉬 생성
        /// </summary>
        private static Mesh CreateStylizedCandleMesh(float baseRadius, float topRadius, float height, float slantAngleDeg, float slantDirDeg, int seed)
        {
            Mesh mesh = new() { name = $"StylizedCandle_H{height:F2}" };
            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            int radialSegments = 28;
            int heightSegments = 24;

            float slantRad = slantAngleDeg * Mathf.Deg2Rad;
            float slantDirRad = slantDirDeg * Mathf.Deg2Rad;

            // 1. 측면 몸체 및 멜팅 드립 메쉬 버텍스 생성
            for (int h = 0; h <= heightSegments; h++)
            {
                float v = (float)h / heightSegments; // 0 (bottom) to 1 (top)

                // 완만한 테이퍼드 반경 보간 (하단 플레어 곡선)
                float baseR = Mathf.Lerp(baseRadius, topRadius, Mathf.Pow(v, 0.75f));

                for (int s = 0; s <= radialSegments; s++)
                {
                    float u = (float)s / radialSegments;
                    float angle = u * Mathf.PI * 2f;

                    // 상단 림 높이 계산 (경사각 적용)
                    float slantHeight = Mathf.Sin(angle - slantDirRad) * Mathf.Sin(slantRad) * topRadius * 0.65f;
                    float curY = v * height + (v * slantHeight);

                    // 레퍼런스 스타일 유기적 멜팅 왁스 숄더 팽창 (상단 50%~96% 구간에서 겉으로 두툼하게 돌출된 드립)
                    float dripBulge = 0f;
                    if (v > 0.45f && v < 0.98f)
                    {
                        float dripPhase = angle + (seed * 1.7f);
                        float dripWave1 = Mathf.Max(0f, Mathf.Sin(dripPhase * 1.5f));
                        float dripWave2 = Mathf.Max(0f, Mathf.Sin(dripPhase * 3.0f + 1.2f)) * 0.5f;
                        float dripProfile = Mathf.Sin((v - 0.45f) / 0.53f * Mathf.PI);

                        float directionalWeight = 0.5f + 0.5f * Mathf.Sin(angle - slantDirRad);
                        dripBulge = (dripWave1 + dripWave2) * dripProfile * (topRadius * 0.22f) * (0.6f + 0.6f * directionalWeight);
                    }

                    float r = baseR + dripBulge;
                    float x = Mathf.Cos(angle) * r;
                    float z = Mathf.Sin(angle) * r;

                    Vector3 pos = new(x, curY, z);
                    vertices.Add(pos);

                    Vector3 n = new Vector3(x, (baseRadius - topRadius) * 0.3f, z).normalized;
                    normals.Add(n);
                    uvs.Add(new Vector2(u, v));
                }
            }

            // 측면 트라이앵글
            for (int h = 0; h < heightSegments; h++)
            {
                for (int s = 0; s < radialSegments; s++)
                {
                    int i0 = h * (radialSegments + 1) + s;
                    int i1 = i0 + 1;
                    int i2 = (h + 1) * (radialSegments + 1) + s;
                    int i3 = i2 + 1;

                    triangles.Add(i0); triangles.Add(i2); triangles.Add(i1);
                    triangles.Add(i1); triangles.Add(i2); triangles.Add(i3);
                }
            }

            // 2. 상단 오목한 멜팅 풀 캡 (Slanted Inset Top Pool)
            int topCenterIdx = vertices.Count;
            float topCenterY = height - (topRadius * 0.12f);
            vertices.Add(new Vector3(0f, topCenterY, 0f));
            normals.Add(Vector3.up);
            uvs.Add(new Vector2(0.5f, 0.5f));

            int topRimStartIdx = heightSegments * (radialSegments + 1);
            for (int s = 0; s < radialSegments; s++)
            {
                triangles.Add(topCenterIdx);
                triangles.Add(topRimStartIdx + s);
                triangles.Add(topRimStartIdx + s + 1);
            }

            // 3. 바닥 수평 평면 캡 (Flat Bottom Cap)
            int botCenterIdx = vertices.Count;
            vertices.Add(Vector3.zero);
            normals.Add(Vector3.down);
            uvs.Add(new Vector2(0.5f, 0.5f));

            for (int s = 0; s < radialSegments; s++)
            {
                triangles.Add(botCenterIdx);
                triangles.Add(s + 1);
                triangles.Add(s);
            }

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// 레퍼런스 이미지와 일치하는 상단 팁이 부드럽게 S자 곡선으로 휘어진 3D 스타일라이즈드 불꽃 메쉬 생성
        /// </summary>
        private static Mesh CreateCurvedFlameMesh()
        {
            Mesh mesh = new() { name = "StylizedCurvedFlame" };
            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            int rings = 10;
            int segments = 14;

            for (int r = 0; r <= rings; r++)
            {
                float v = (float)r / rings;

                float radiusFactor = Mathf.Sin(v * Mathf.PI) * (1.0f - v * 0.42f);
                if (v >= 0.99f) radiusFactor = 0f;

                float curveX = Mathf.Pow(v, 2.2f) * 0.16f;
                float curveZ = Mathf.Sin(v * Mathf.PI * 1.2f) * 0.05f;

                float y = v;

                for (int s = 0; s <= segments; s++)
                {
                    float u = (float)s / segments;
                    float angle = u * Mathf.PI * 2f;
                    float x = Mathf.Cos(angle) * radiusFactor * 0.5f + curveX;
                    float z = Mathf.Sin(angle) * radiusFactor * 0.5f + curveZ;

                    Vector3 pos = new(x, y, z);
                    vertices.Add(pos);
                    normals.Add(new Vector3(x - curveX, 0.2f, z - curveZ).normalized);
                    uvs.Add(new Vector2(u, v));
                }
            }

            for (int r = 0; r < rings; r++)
            {
                for (int s = 0; s < segments; s++)
                {
                    int i0 = r * (segments + 1) + s;
                    int i1 = i0 + 1;
                    int i2 = (r + 1) * (segments + 1) + s;
                    int i3 = i2 + 1;

                    triangles.Add(i0); triangles.Add(i2); triangles.Add(i1);
                    triangles.Add(i1); triangles.Add(i2); triangles.Add(i3);
                }
            }

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Material CreateOpaqueMaterial(string name, Shader shader, Color color, float metallic, float smoothness)
        {
            Material mat = new(shader) { name = name };
            if (mat.HasProperty("_Surface")) mat.SetFloat("_Surface", 0f); // 0 = Opaque
            if (mat.HasProperty("_Blend")) mat.SetFloat("_Blend", 0f);
            if (mat.HasProperty("_ZWrite")) mat.SetFloat("_ZWrite", 1f);
            if (mat.HasProperty("_Cull")) mat.SetFloat("_Cull", 2f); // 2 = Back
            mat.SetOverrideTag("RenderType", "Opaque");
            mat.renderQueue = (int)RenderQueue.Geometry;

            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);
            mat.SetFloat("_Metallic", metallic);
            mat.SetFloat("_Smoothness", smoothness);
            return mat;
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
                mr.shadowCastingMode = ShadowCastingMode.On;
                mr.receiveShadows = true;
            }
        }
    }
}
