using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 주사위 트레이 하단 좌측에 배치되는 3D 리롤 횟수 안내 오브젝트 (Reroll Counter Bar)
    /// - 좌측 스톤 카드 트레이와 동일한 웜 샌드스톤 룩앤필의 직육면체 바
    /// - 중앙에 일렬로 박힌 3개의 하스스톤 마나 수정 스타일 3D 크리스탈
    /// - 남은 롤 횟수에 따라 크리스탈 점등(Active / Inactive) 제어
    /// </summary>
    public sealed class RerollCounterBar : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("State")]
        [SerializeField] private int rollsRemaining = 3;
        [SerializeField] private int maxRolls = 3;

        private readonly List<MeshRenderer> crystalRenderers = new();
        private readonly List<Light> crystalLights = new();
        private Material activeCrystalMat;
        private Material inactiveCrystalMat;

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
            BuildGeometry();
        }

        public void SetRollsRemaining(int count, int max = 3)
        {
            rollsRemaining = Mathf.Clamp(count, 0, max);
            maxRolls = max;
            UpdateCrystalVisuals();
        }

        private void Update()
        {
            // 활성화된 마나 크리스탈의 은은한 호흡(Breathing/Pulse) 발광 효과 (수정구와 동일한 사파이어 톤)
            if (activeCrystalMat != null)
            {
                float pulse = 1.15f + Mathf.Sin(Time.time * 2.4f) * 0.35f;
                Color emitColor = new Color(0.12f, 0.50f, 0.90f) * pulse;
                if (activeCrystalMat.HasProperty("_EmissionColor"))
                {
                    activeCrystalMat.SetColor("_EmissionColor", emitColor);
                }
            }
        }

        public void BuildGeometry()
        {
            crystalRenderers.Clear();
            crystalLights.Clear();

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

            // 1. 좌측 카드 트레이와 동일한 웜 샌드스톤 머티리얼 구성
            Color stoneMainColor = new(0.62f, 0.58f, 0.52f);     // #9e9484 (Warm Sandstone)
            Color stoneDarkColor = new(0.35f, 0.31f, 0.26f);     // #594f42 (Shadowed Inset)
            Color stoneDeepColor = new(0.19f, 0.16f, 0.13f);     // #302921 (Carved Socket)
            Color stoneHighlightColor = new(0.72f, 0.67f, 0.60f); // #b8ab99 (Chamfer Rim)
            Color stoneBaseRimColor = new(0.21f, 0.19f, 0.16f);   // #363028 (Aged Slate Base)

            Material stoneMainMat = CreateMat(litShader, "Counter_StoneMainMat", stoneMainColor, 0.04f, 0.24f);
            Material stoneDarkMat = CreateMat(litShader, "Counter_StoneDarkMat", stoneDarkColor, 0.02f, 0.18f);
            Material stoneDeepMat = CreateMat(litShader, "Counter_StoneDeepMat", stoneDeepColor, 0.02f, 0.14f);
            Material stoneHighlightMat = CreateMat(litShader, "Counter_StoneHighlightMat", stoneHighlightColor, 0.06f, 0.32f);
            Material stoneBaseRimMat = CreateMat(litShader, "Counter_StoneBaseRimMat", stoneBaseRimColor, 0.02f, 0.15f);

            // 2. 크리스탈 머티리얼 구성 (수정구 딥 사파이어 & 마나 블루 톤 통일)
            // 2-1. 불 켜진 활성 마나 크리스탈 (Active Glowing Sapphire Mana Crystal)
            activeCrystalMat = CreateMat(litShader, "Counter_CrystalActiveMat", new Color(0.06f, 0.24f, 0.55f, 0.95f), 0.10f, 0.96f);
            activeCrystalMat.EnableKeyword("_EMISSION");
            activeCrystalMat.SetColor("_EmissionColor", new Color(0.12f, 0.50f, 0.90f) * 1.2f);

            // 2-2. 불 꺼진 빈 마나 크리스탈 (Inactive Dark Sapphire Crystal)
            inactiveCrystalMat = CreateMat(litShader, "Counter_CrystalInactiveMat", new Color(0.06f, 0.09f, 0.15f, 0.90f), 0.05f, 0.55f);

            // 3. 직육면체 샌드스톤 바 바디 조형 (길쭉한 누름돌/트레이 스타일)
            float barWidth = 3.60f;
            float barDepth = 0.95f;
            float barHeight = 0.22f;
            float baseThickness = 0.08f;
            float cornerRadius = 0.16f;

            // 3-1. 최하단 다크 슬레이트 쉐도우 베이스 플레이트
            GameObject basePlate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            basePlate.name = "Counter_BasePlate";
            SetupPart(basePlate, transform, new Vector3(0f, 0.04f, 0f), Vector3.zero,
                new Vector3(barWidth + 0.16f, baseThickness, barDepth + 0.16f), stoneBaseRimMat);

            // 3-2. 메인 샌드스톤 바 바디
            GameObject mainBar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mainBar.name = "Counter_MainBar";
            SetupPart(mainBar, transform, new Vector3(0f, baseThickness + barHeight * 0.5f, 0f), Vector3.zero,
                new Vector3(barWidth, barHeight, barDepth), stoneMainMat);

            // 3-3. 4개 모서리 원형 코너 보스 기둥 (카드 트레이 시그니처 룩앤필)
            float cx = barWidth * 0.5f - cornerRadius * 0.8f;
            float cz = barDepth * 0.5f - cornerRadius * 0.8f;
            (float sx, float sz, string name)[] corners = new[]
            {
                (1f, 1f, "TR"), (-1f, 1f, "TL"), (1f, -1f, "BR"), (-1f, -1f, "BL")
            };

            for (int i = 0; i < 4; i++)
            {
                Vector3 cPos = new(corners[i].sx * cx, baseThickness + barHeight * 0.5f, corners[i].sz * cz);
                GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pillar.name = $"Counter_CornerPillar_{corners[i].name}";
                SetupPart(pillar, transform, cPos, Vector3.zero,
                    new Vector3(cornerRadius * 2f, barHeight * 0.5f, cornerRadius * 2f), stoneHighlightMat);
            }

            // 3-4. 상단 오목한 음영 인셋 베드
            GameObject insetBed = GameObject.CreatePrimitive(PrimitiveType.Cube);
            insetBed.name = "Counter_InsetBed";
            SetupPart(insetBed, transform, new Vector3(0f, baseThickness + barHeight + 0.005f, 0f), Vector3.zero,
                new Vector3(barWidth - 0.28f, 0.015f, barDepth - 0.26f), stoneDarkMat);

            // 4. 중앙에 일렬로 배치되는 3개의 마나 크리스탈 슬롯 소켓 및 크리스탈
            float crystalSpacing = 1.05f;
            float crystalY = baseThickness + barHeight + 0.06f;

            for (int i = 0; i < 3; i++)
            {
                float posX = (i - 1) * crystalSpacing; // -1.05f, 0f, +1.05f
                Vector3 socketPos = new(posX, crystalY, 0f);

                // 4-1. 마나 수정 안착용 오목한 스톤 소켓 링
                GameObject socketRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                socketRing.name = $"Crystal_SocketRing_{i}";
                SetupPart(socketRing, transform, new Vector3(posX, baseThickness + barHeight + 0.01f, 0f), Vector3.zero,
                    new Vector3(0.68f, 0.02f, 0.68f), stoneDeepMat);

                // 소켓 테두리 하이라이트 림
                GameObject socketRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                socketRim.name = $"Crystal_SocketRim_{i}";
                SetupPart(socketRim, transform, new Vector3(posX, baseThickness + barHeight + 0.02f, 0f), Vector3.zero,
                    new Vector3(0.74f, 0.01f, 0.74f), stoneHighlightMat);

                // 4-2. 3D 다이아몬드/마나 수정 (Diamond / Octahedron Gem Geometry)
                GameObject gemRoot = new($"Mana_Crystal_{i}");
                gemRoot.layer = DecorationLayer;
                gemRoot.transform.SetParent(transform, false);
                gemRoot.transform.localPosition = socketPos;

                // 상단 뾰족한 다이아몬드 피라미드 바디
                GameObject gemTop = GameObject.CreatePrimitive(PrimitiveType.Cube);
                gemTop.name = "Gem_Body";
                SetupPart(gemTop, gemRoot.transform, new Vector3(0f, 0.06f, 0f), new Vector3(35f, 45f, 25f),
                    new Vector3(0.36f, 0.36f, 0.36f), activeCrystalMat);

                MeshRenderer mr = gemTop.GetComponent<MeshRenderer>();
                if (mr != null) crystalRenderers.Add(mr);

                // 4-3. 크리스탈 전용 포인트 라이트 (은은한 발광)
                GameObject lightObj = new($"Crystal_Light_{i}");
                lightObj.transform.SetParent(gemRoot.transform, false);
                lightObj.transform.localPosition = new Vector3(0f, 0.15f, 0f);
                Light l = lightObj.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = new Color(0.15f, 0.55f, 0.85f);
                l.range = 1.6f;
                l.intensity = 0.32f;
                l.shadows = LightShadows.None;
                crystalLights.Add(l);
            }

            UpdateCrystalVisuals();
        }

        private void UpdateCrystalVisuals()
        {
            for (int i = 0; i < crystalRenderers.Count; i++)
            {
                bool isActive = i < rollsRemaining;
                if (crystalRenderers[i] != null)
                {
                    crystalRenderers[i].material = isActive ? activeCrystalMat : inactiveCrystalMat;
                }

                if (i < crystalLights.Count && crystalLights[i] != null)
                {
                    crystalLights[i].enabled = isActive;
                }
            }
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
                mr.material = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }
    }
}
