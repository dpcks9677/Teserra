using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 수정구(RollOrb)의 스톤 베이스와 결합/연장되는 100도 순수 스톤 부채꼴 3D 리롤 카운터 플랫폼
    /// - 3시 방향(+X)을 대칭 중심축으로 하는 100도 중심각(-50도 ~ +50도) 순수 스톤 2단 플레이트
    /// - RollOrb와 완벽히 동일한 높이(Y=0~0.060m, Y=0.060~0.118m) 및 스톤 머티리얼로 일체화
    /// - 상단판 내부에 여유 있는 스톤 여백(R = 1.460m, 각도 -28도, 0도, +28도)을 두고 3D 입체 패싯 보석 안착
    /// - 수정구 내부 오로라 리본 색상(맑은 아쿠아 사파이어)과 100% 톤 매칭 및 0.4초 부드러운 페이드 아웃
    /// </summary>
    public sealed class RerollCounterBar : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("State")]
        [SerializeField] private int rollsRemaining = 3;
        [SerializeField] private int maxRolls = 3;

        private readonly List<MeshRenderer> gemRenderers = new();
        private readonly List<List<MeshRenderer>> gemRidgeRenderers = new();
        private readonly List<Light> gemLights = new();
        private readonly float[] gemFadeProgress = new float[3] { 1f, 1f, 1f };

        private Material baseGemMat;
        private Material baseRidgeMat;
        private MaterialPropertyBlock propBlock;

        // 수정구(RollOrb) 내부 오로라 리본(Caustics Wave)과 1:1 매칭된 맑고 청명한 사파이어 블루
        private readonly Color activeBodyColor = new(0.12f, 0.48f, 0.75f, 0.98f);    // 수정구 오로라 리본 색상
        private readonly Color inactiveBodyColor = new(0.015f, 0.06f, 0.15f, 0.95f); // 수정구 딥 쉐도우 미드나잇
        private readonly Color activeEmissionColor = new(0.14f, 0.52f, 0.80f);        // 맑은 오로라 에미션 발광
        private readonly Color activeRidgeColor = new(0.32f, 0.70f, 0.95f, 1.0f);     // 오로라 하이라이트 림
        private readonly Color inactiveRidgeColor = new(0.03f, 0.08f, 0.16f, 0.90f);  // 소등 딥 림

        public int RollsRemaining => rollsRemaining;

        public static RerollCounterBar Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Reroll Counter Bar");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            RerollCounterBar comp = root.AddComponent<RerollCounterBar>();
            comp.BuildGeometry();
            return comp;
        }

        private void Awake()
        {
            propBlock = new MaterialPropertyBlock();
            BuildGeometry();
        }

        public void SetRollsRemaining(int count, int max = 3)
        {
            rollsRemaining = Mathf.Clamp(count, 0, max);
            maxRolls = max;
        }

        private void Update()
        {
            if (propBlock == null) propBlock = new MaterialPropertyBlock();

            float t = Time.time;
            float pulse = 1.0f + Mathf.Sin(t * 2.2f) * 0.18f; // 은은한 오로라 호흡 펄스

            // 3개 보석 각각에 대해 부드러운 페이드 아웃/인 전환 보간 (0.4초)
            for (int i = 0; i < 3; i++)
            {
                float targetFade = (i < rollsRemaining) ? 1.0f : 0.0f;
                gemFadeProgress[i] = Mathf.MoveTowards(gemFadeProgress[i], targetFade, Time.deltaTime * 2.5f);
                float f = gemFadeProgress[i];

                // 1. 보석 본체 색상 및 에미션 페이드 (오로라 리본 색상 매칭)
                if (i < gemRenderers.Count && gemRenderers[i] != null)
                {
                    Color curBody = Color.Lerp(inactiveBodyColor, activeBodyColor, f);
                    Color curEmit = Color.Lerp(Color.black, activeEmissionColor * (0.75f * pulse), f);

                    gemRenderers[i].GetPropertyBlock(propBlock);
                    propBlock.SetColor("_BaseColor", curBody);
                    propBlock.SetColor("_Color", curBody);
                    propBlock.SetColor("_EmissionColor", curEmit);
                    gemRenderers[i].SetPropertyBlock(propBlock);
                }

                // 2. 6방향 리지 라인 색상 페이드
                if (i < gemRidgeRenderers.Count && gemRidgeRenderers[i] != null)
                {
                    Color curRidge = Color.Lerp(inactiveRidgeColor, activeRidgeColor, f);
                    Color curRidgeEmit = Color.Lerp(Color.black, activeRidgeColor * (0.80f * pulse), f);

                    for (int r = 0; r < gemRidgeRenderers[i].Count; r++)
                    {
                        if (gemRidgeRenderers[i][r] == null) continue;
                        gemRidgeRenderers[i][r].GetPropertyBlock(propBlock);
                        propBlock.SetColor("_BaseColor", curRidge);
                        propBlock.SetColor("_Color", curRidge);
                        propBlock.SetColor("_EmissionColor", curRidgeEmit);
                        gemRidgeRenderers[i][r].SetPropertyBlock(propBlock);
                    }
                }

                // 3. 포인트 라이트 강도 페이드
                if (i < gemLights.Count && gemLights[i] != null)
                {
                    gemLights[i].intensity = f * 0.22f;
                    gemLights[i].enabled = f > 0.01f;
                }
            }
        }

        public void BuildGeometry()
        {
            gemRenderers.Clear();
            gemRidgeRenderers.Clear();
            gemLights.Clear();

            for (int i = 0; i < 3; i++)
            {
                gemFadeProgress[i] = (i < rollsRemaining) ? 1.0f : 0.0f;
            }

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

            // 1. RollOrb의 lowerBase_stone과 upperBase_stone과 100% 동일한 순수 스톤 머티리얼 구성
            Material stoneRimMat = CreateMat(litShader, "Counter_StoneRimMat", new Color(0.34f, 0.38f, 0.42f), 0.04f, 0.28f);
            Material stoneBaseMat = CreateMat(litShader, "Counter_StoneBaseMat", new Color(0.52f, 0.56f, 0.60f), 0.05f, 0.32f);

            // 2. 오로라 리본과 동일한 사파이어 보석 및 리지 기본 머티리얼
            baseGemMat = CreateMat(litShader, "Counter_HexGemBaseMat", activeBodyColor, 0.12f, 0.95f);
            baseGemMat.EnableKeyword("_EMISSION");

            baseRidgeMat = CreateMat(litShader, "Counter_GemRidgeBaseMat", activeRidgeColor, 0.15f, 0.95f);
            baseRidgeMat.EnableKeyword("_EMISSION");

            // 3. 100도 부채꼴 순수 스톤 베이스 지오메트리 생성 (중심 대칭축: 3시 방향, RollOrb 높이 1:1 일치)
            const float StartAngle = -50f;
            const float EndAngle = 50f;
            const int Segments = 24;

            // RollOrb LowerBase 지름 2.55f (반지름 1.275f) * 1.4f = 1.785f, 윗면 Y = 0.060m
            const float LowerRadius = 1.785f;
            const float LowerHeight = 0.060f;

            // RollOrb UpperBase 윗면 Y = 0.118m (Lower 위에 0.058m 두께), 반지름 1.680m
            const float UpperRadius = 1.680f;
            const float UpperHeight = 0.058f;

            GameObject platformRoot = new("Sector_100_Stone_Platform");
            platformRoot.layer = DecorationLayer;
            platformRoot.transform.SetParent(transform, false);

            // 3-1. 1단 하단 100도 부채꼴 스톤 플레이트 (LowerBase_Stone)
            Mesh lowerMesh = CreateSectorPrismMesh(LowerRadius, LowerHeight, StartAngle, EndAngle, Segments);
            GameObject lowerPlate = new("LowerBase_Stone_Sector");
            SetupMeshPart(lowerPlate, platformRoot.transform, new Vector3(0f, 0.0f, 0f), lowerMesh, stoneRimMat);

            // 3-2. 2단 상단 100도 부채꼴 스톤 플레이트 (UpperBase_Stone - 1.680m 확장)
            Mesh upperMesh = CreateSectorPrismMesh(UpperRadius, UpperHeight, StartAngle, EndAngle, Segments);
            GameObject upperPlate = new("UpperBase_Stone_Sector");
            SetupMeshPart(upperPlate, platformRoot.transform, new Vector3(0f, LowerHeight, 0f), upperMesh, stoneBaseMat);

            // 4. 상단판 내부에 여유 있는 스톤 여백(R = 1.460m)을 두고 안착되는 3D 입체 패싯 사파이어 보석 3개
            float[] gemAngles = new float[] { -28f, 0f, 28f };
            float gemArcRadius = 1.460f;
            float gemY = LowerHeight + UpperHeight + 0.005f;

            for (int i = 0; i < gemAngles.Length; i++)
            {
                float angleDeg = gemAngles[i];
                float rad = angleDeg * Mathf.Deg2Rad;
                Vector3 gemPos = new(Mathf.Cos(rad) * gemArcRadius, gemY, Mathf.Sin(rad) * gemArcRadius);

                GameObject gemRoot = new($"Faceted_Sapphire_Gem_{i}");
                gemRoot.layer = DecorationLayer;
                gemRoot.transform.SetParent(platformRoot.transform, false);
                gemRoot.transform.localPosition = gemPos;
                gemRoot.transform.localRotation = Quaternion.Euler(0f, -angleDeg, 0f);

                // 4-1. 3D 입체 패싯 컷 사파이어 보석 본체 (반지름 0.170m, 피라미드 크라운 0.14m, 거들 0.035m)
                Mesh facetedGemMesh = CreateFacetedHexGemMesh(0.170f, 0.14f, 0.035f);
                GameObject gemObj = new("Faceted_Gem_Mesh");
                SetupMeshPart(gemObj, gemRoot.transform, Vector3.zero, facetedGemMesh, baseGemMat);

                MeshRenderer mr = gemObj.GetComponent<MeshRenderer>();
                if (mr != null) gemRenderers.Add(mr);

                // 4-2. 보석 중심(Apex)에서 6개 꼭짓점으로 이어지는 6방향 입체 리지 라인 (Ridge Lines)
                GameObject ridgesRoot = new("Facet_Ridge_Lines");
                ridgesRoot.layer = DecorationLayer;
                ridgesRoot.transform.SetParent(gemRoot.transform, false);

                List<MeshRenderer> ridges = new();
                Vector3 apexPos = new(0f, 0.14f + 0.035f, 0f);
                for (int v = 0; v < 6; v++)
                {
                    float a = (v * 60f + 30f) * Mathf.Deg2Rad;
                    Vector3 girdlePos = new(Mathf.Cos(a) * 0.170f, 0.035f, Mathf.Sin(a) * 0.170f);

                    GameObject ridgeLine = CreateCylinderBetweenPoints(apexPos, girdlePos, 0.0065f);
                    ridgeLine.name = $"Ridge_Line_{v}";
                    ridgeLine.transform.SetParent(ridgesRoot.transform, false);

                    MeshRenderer rmr = ridgeLine.GetComponent<MeshRenderer>();
                    if (rmr != null)
                    {
                        rmr.material = baseRidgeMat;
                        ridges.Add(rmr);
                    }
                }
                gemRidgeRenderers.Add(ridges);

                // 4-3. 사파이어 보석 전용 은은한 포인트 라이트
                GameObject lightObj = new($"Gem_Light_{i}");
                lightObj.transform.SetParent(gemRoot.transform, false);
                lightObj.transform.localPosition = new Vector3(0f, 0.12f, 0f);
                Light l = lightObj.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = new Color(0.14f, 0.55f, 0.88f);
                l.range = 1.1f;
                l.intensity = 0.22f;
                l.shadows = LightShadows.None;
                gemLights.Add(l);
            }
        }

        private static GameObject CreateCylinderBetweenPoints(Vector3 start, Vector3 end, float radius)
        {
            GameObject cylinder = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            cylinder.layer = DecorationLayer;

            Collider col = cylinder.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }

            Vector3 dir = end - start;
            float length = dir.magnitude;
            Vector3 midPoint = start + dir * 0.5f;

            cylinder.transform.localPosition = midPoint;
            cylinder.transform.localRotation = Quaternion.FromToRotation(Vector3.up, dir);
            cylinder.transform.localScale = new Vector3(radius * 2f, length * 0.5f, radius * 2f);

            return cylinder;
        }

        private static Mesh CreateSectorPrismMesh(float radius, float height, float startAngleDeg, float endAngleDeg, int segments)
        {
            Mesh mesh = new() { name = $"Sector100Prism_R{radius:F2}_H{height:F2}" };

            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            float startRad = startAngleDeg * Mathf.Deg2Rad;
            float endRad = endAngleDeg * Mathf.Deg2Rad;

            // 1. 상단 면 (Top Face - Normal Up)
            int topCenterIdx = vertices.Count;
            vertices.Add(new Vector3(0f, height, 0f));
            normals.Add(Vector3.up);
            uvs.Add(new Vector2(0.5f, 0.5f));

            int topArcStartIdx = vertices.Count;
            for (int i = 0; i <= segments; i++)
            {
                float t = (float)i / segments;
                float angle = Mathf.Lerp(startRad, endRad, t);
                float x = Mathf.Cos(angle) * radius;
                float z = Mathf.Sin(angle) * radius;

                vertices.Add(new Vector3(x, height, z));
                normals.Add(Vector3.up);
                uvs.Add(new Vector2(x / (radius * 2f) + 0.5f, z / (radius * 2f) + 0.5f));
            }

            for (int i = 0; i < segments; i++)
            {
                triangles.Add(topCenterIdx);
                triangles.Add(topArcStartIdx + i);
                triangles.Add(topArcStartIdx + i + 1);
            }

            // 2. 하단 면 (Bottom Face - Normal Down)
            int botCenterIdx = vertices.Count;
            vertices.Add(new Vector3(0f, 0f, 0f));
            normals.Add(Vector3.down);
            uvs.Add(new Vector2(0.5f, 0.5f));

            int botArcStartIdx = vertices.Count;
            for (int i = 0; i <= segments; i++)
            {
                float t = (float)i / segments;
                float angle = Mathf.Lerp(startRad, endRad, t);
                float x = Mathf.Cos(angle) * radius;
                float z = Mathf.Sin(angle) * radius;

                vertices.Add(new Vector3(x, 0f, z));
                normals.Add(Vector3.down);
                uvs.Add(new Vector2(x / (radius * 2f) + 0.5f, z / (radius * 2f) + 0.5f));
            }

            for (int i = 0; i < segments; i++)
            {
                triangles.Add(botCenterIdx);
                triangles.Add(botArcStartIdx + i + 1);
                triangles.Add(botArcStartIdx + i);
            }

            // 3. 외곽 원호 측면 (Outer Curved Wall)
            for (int i = 0; i < segments; i++)
            {
                float t0 = (float)i / segments;
                float t1 = (float)(i + 1) / segments;
                float a0 = Mathf.Lerp(startRad, endRad, t0);
                float a1 = Mathf.Lerp(startRad, endRad, t1);

                Vector3 p0Top = new(Mathf.Cos(a0) * radius, height, Mathf.Sin(a0) * radius);
                Vector3 p1Top = new(Mathf.Cos(a1) * radius, height, Mathf.Sin(a1) * radius);
                Vector3 p0Bot = new(Mathf.Cos(a0) * radius, 0f, Mathf.Sin(a0) * radius);
                Vector3 p1Bot = new(Mathf.Cos(a1) * radius, 0f, Mathf.Sin(a1) * radius);

                Vector3 wallNormal = Vector3.Cross(Vector3.up, p1Top - p0Top).normalized;

                int idx = vertices.Count;
                vertices.Add(p0Bot); normals.Add(wallNormal); uvs.Add(new Vector2(t0, 0f));
                vertices.Add(p0Top); normals.Add(wallNormal); uvs.Add(new Vector2(t0, 1f));
                vertices.Add(p1Top); normals.Add(wallNormal); uvs.Add(new Vector2(t1, 1f));
                vertices.Add(p1Bot); normals.Add(wallNormal); uvs.Add(new Vector2(t1, 0f));

                triangles.Add(idx); triangles.Add(idx + 1); triangles.Add(idx + 2);
                triangles.Add(idx); triangles.Add(idx + 2); triangles.Add(idx + 3);
            }

            // 4. 시작/끝 절단 측면 벽 (Start / End Cut Walls)
            Vector3 startDir = new(Mathf.Cos(startRad), 0f, Mathf.Sin(startRad));
            Vector3 startNormal = new(-Mathf.Sin(startRad), 0f, Mathf.Cos(startRad));
            int sIdx = vertices.Count;
            vertices.Add(new Vector3(0f, 0f, 0f)); normals.Add(startNormal); uvs.Add(new Vector2(0f, 0f));
            vertices.Add(new Vector3(0f, height, 0f)); normals.Add(startNormal); uvs.Add(new Vector2(0f, 1f));
            vertices.Add(new Vector3(startDir.x * radius, height, startDir.z * radius)); normals.Add(startNormal); uvs.Add(new Vector2(1f, 1f));
            vertices.Add(new Vector3(startDir.x * radius, 0f, startDir.z * radius)); normals.Add(startNormal); uvs.Add(new Vector2(1f, 0f));

            triangles.Add(sIdx); triangles.Add(sIdx + 1); triangles.Add(sIdx + 2);
            triangles.Add(sIdx); triangles.Add(sIdx + 2); triangles.Add(sIdx + 3);

            Vector3 endDir = new(Mathf.Cos(endRad), 0f, Mathf.Sin(endRad));
            Vector3 endNormal = new(Mathf.Sin(endRad), 0f, -Mathf.Cos(endRad));
            int eIdx = vertices.Count;
            vertices.Add(new Vector3(endDir.x * radius, 0f, endDir.z * radius)); normals.Add(endNormal); uvs.Add(new Vector2(0f, 0f));
            vertices.Add(new Vector3(endDir.x * radius, height, endDir.z * radius)); normals.Add(endNormal); uvs.Add(new Vector2(0f, 1f));
            vertices.Add(new Vector3(0f, height, 0f)); normals.Add(endNormal); uvs.Add(new Vector2(1f, 1f));
            vertices.Add(new Vector3(0f, 0f, 0f)); normals.Add(endNormal); uvs.Add(new Vector2(1f, 0f));

            triangles.Add(eIdx); triangles.Add(eIdx + 1); triangles.Add(eIdx + 2);
            triangles.Add(eIdx); triangles.Add(eIdx + 2); triangles.Add(eIdx + 3);

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Mesh CreateFacetedHexGemMesh(float radius, float crownHeight, float girdleHeight)
        {
            Mesh mesh = new() { name = $"FacetedHexGem_R{radius:F2}_H{crownHeight:F2}" };
            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            Vector3 apex = new(0f, crownHeight + girdleHeight, 0f);

            Vector3[] girdleTop = new Vector3[6];
            Vector3[] girdleBot = new Vector3[6];
            for (int i = 0; i < 6; i++)
            {
                float a = (i * 60f + 30f) * Mathf.Deg2Rad;
                girdleTop[i] = new Vector3(Mathf.Cos(a) * radius, girdleHeight, Mathf.Sin(a) * radius);
                girdleBot[i] = new Vector3(Mathf.Cos(a) * radius, 0.01f, Mathf.Sin(a) * radius);
            }

            Vector3 culet = new(0f, 0f, 0f);

            // 상단 6개 삼각형 패싯
            for (int i = 0; i < 6; i++)
            {
                Vector3 p0 = apex;
                Vector3 p1 = girdleTop[i];
                Vector3 p2 = girdleTop[(i + 1) % 6];
                Vector3 facetNormal = Vector3.Cross(p1 - p0, p2 - p0).normalized;

                int idx = vertices.Count;
                vertices.Add(p0); normals.Add(facetNormal); uvs.Add(new Vector2(0.5f, 0.5f));
                vertices.Add(p1); normals.Add(facetNormal); uvs.Add(new Vector2(p1.x / (radius * 2f) + 0.5f, p1.z / (radius * 2f) + 0.5f));
                vertices.Add(p2); normals.Add(facetNormal); uvs.Add(new Vector2(p2.x / (radius * 2f) + 0.5f, p2.z / (radius * 2f) + 0.5f));

                triangles.Add(idx);
                triangles.Add(idx + 1);
                triangles.Add(idx + 2);
            }

            // 측면 6개 거들 사각형 패싯
            for (int i = 0; i < 6; i++)
            {
                Vector3 p0Top = girdleTop[i];
                Vector3 p1Top = girdleTop[(i + 1) % 6];
                Vector3 p0Bot = girdleBot[i];
                Vector3 p1Bot = girdleBot[(i + 1) % 6];

                Vector3 sideNormal = Vector3.Cross(Vector3.up, p1Top - p0Top).normalized;

                int idx = vertices.Count;
                vertices.Add(p0Bot); normals.Add(sideNormal); uvs.Add(new Vector2(0f, 0f));
                vertices.Add(p0Top); normals.Add(sideNormal); uvs.Add(new Vector2(0f, 1f));
                vertices.Add(p1Top); normals.Add(sideNormal); uvs.Add(new Vector2(1f, 1f));
                vertices.Add(p1Bot); normals.Add(sideNormal); uvs.Add(new Vector2(1f, 0f));

                triangles.Add(idx); triangles.Add(idx + 1); triangles.Add(idx + 2);
                triangles.Add(idx); triangles.Add(idx + 2); triangles.Add(idx + 3);
            }

            // 하단 6개 삼각형 패싯
            for (int i = 0; i < 6; i++)
            {
                Vector3 p0 = culet;
                Vector3 p1 = girdleBot[(i + 1) % 6];
                Vector3 p2 = girdleBot[i];
                Vector3 botFacetNormal = Vector3.Cross(p1 - p0, p2 - p0).normalized;

                int idx = vertices.Count;
                vertices.Add(p0); normals.Add(botFacetNormal); uvs.Add(new Vector2(0.5f, 0.5f));
                vertices.Add(p1); normals.Add(botFacetNormal); uvs.Add(new Vector2(p1.x / (radius * 2f) + 0.5f, p1.z / (radius * 2f) + 0.5f));
                vertices.Add(p2); normals.Add(botFacetNormal); uvs.Add(new Vector2(p2.x / (radius * 2f) + 0.5f, p2.z / (radius * 2f) + 0.5f));

                triangles.Add(idx);
                triangles.Add(idx + 1);
                triangles.Add(idx + 2);
            }

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Material CreateMat(Shader shader, string name, Color color, float metallic, float smoothness)
        {
            Material m = new(shader) { name = name };
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
            if (m.HasProperty("_Color")) m.SetColor("_Color", color);
            m.SetFloat("_Metallic", metallic);
            m.SetFloat("_Smoothness", smoothness);
            return m;
        }

        private static void SetupMeshPart(GameObject obj, Transform parent, Vector3 localPos, Mesh mesh, Material mat)
        {
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);
            obj.transform.localPosition = localPos;
            obj.transform.localRotation = Quaternion.identity;
            obj.transform.localScale = Vector3.one;

            MeshFilter mf = obj.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;

            MeshRenderer mr = obj.AddComponent<MeshRenderer>();
            mr.material = mat;
            mr.shadowCastingMode = ShadowCastingMode.TwoSided;
            mr.receiveShadows = true;
        }
    }
}
