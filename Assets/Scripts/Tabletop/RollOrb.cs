using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 주사위 트레이 하단 우측에 배치되는 3D 스타일라이즈드 마법 수정구 롤 오브젝트
    /// - 맑고 청량한 비비드 아쿠아 사파이어 크리스탈 글래스 (투명감 및 반사광 극대화)
    /// - 스노우 글로브 은하수 궤도 회전 파티클: 구슬 내벽을 따라 둥글게 소용돌이치며 반짝이는(Twinkle) 별가루 입자들
    /// - 내부 발광 마나 코어 (Luminous Inner Core): 3차원 볼륨감과 부드러운 숨쉬기 맥동
    /// - 호버링 인터랙션: 과도한 눈부심 없는 은은한 미세 발광(0.10f -> 0.22f) & 수정 구슬 외곽 실루엣을 감싸며 피어오르는 테두리 오라(Rim Aura)
    /// </summary>
    public sealed class RollOrb : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("Hover & Glow State")]
        [SerializeField] private bool isHovered;
        private float hoverLerp;

        private Material orbMaterial;
        private Material coreMaterial;
        private Material ambientHaloMaterial;
        private MeshRenderer ambientHaloRenderer;
        private Material hearthstoneAuraMaterial;
        private MeshRenderer hearthstoneAuraRenderer;
        private GameObject hearthstoneAuraObject;
        private Light orbPointLight;
        private ParticleSystem magicParticles;

        // 레퍼런스 이미지 추출 팔레트 (묵직하고 깊은 딥 사파이어 크리스탈 & 1.3배 유영)
        private readonly Color baseOrbColor = new(0.04f, 0.16f, 0.38f, 0.98f);
        private readonly Color hoverOrbColor = new(0.07f, 0.24f, 0.50f, 1.00f);
        private readonly Color baseEmissionColor = new(0.01f, 0.02f, 0.06f);
        private readonly Color hoverEmissionColor = new(0.015f, 0.04f, 0.10f);

        private readonly Color coreBaseEmission = new Color(0.08f, 0.42f, 0.72f) * 0.75f;
        private readonly Color coreHoverEmission = new Color(0.08f, 0.42f, 0.72f) * 0.75f;

        // 상시 적용 콤팩트 사파이어 후광 컬러
        private readonly Color ambientHaloColor = new(0.12f, 0.55f, 0.95f, 1.0f);

        // 하스스톤 스타일 카드 활성화 마나 불꽃 아우라 컬러 (톤온톤)
        private readonly Color hearthstoneFlameColor = new(0.12f, 0.50f, 0.90f, 0.85f);
        private readonly Color hearthstoneCoreFilamentColor = new(0.45f, 0.88f, 1.00f, 1.00f);

        public static RollOrb Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Roll Orb");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            RollOrb comp = root.AddComponent<RollOrb>();
            comp.BuildGeometry();
            return comp;
        }

        private void Awake()
        {
            BuildGeometry();
        }

        public void SetHovered(bool hovered)
        {
            isHovered = hovered;
        }

        private void OnMouseEnter()
        {
            isHovered = true;
        }

        private void OnMouseExit()
        {
            isHovered = false;
        }

        private void Update()
        {
            float target = isHovered ? 1f : 0f;
            hoverLerp = Mathf.MoveTowards(hoverLerp, target, Time.deltaTime * 5f);

            // 1. 상시 외곽 후광 (Ambient Halo - 호버 여부와 상관없이 은은하게 상시 발광)
            if (ambientHaloMaterial != null)
            {
                float idleBreath = Mathf.Sin(Time.time * 2.0f) * 0.05f;
                float ambientIntensity = 0.55f + idleBreath + (hoverLerp * 0.15f);
                if (ambientHaloMaterial.HasProperty("_Intensity"))
                    ambientHaloMaterial.SetFloat("_Intensity", Mathf.Max(0f, ambientIntensity));
            }

            // 2. 호버 시 하스스톤 스타일 마나 불꽃 아우라 (Hearthstone Playable Mana Flame Aura)
            if (hearthstoneAuraRenderer != null)
            {
                bool showAura = hoverLerp > 0.01f;
                hearthstoneAuraRenderer.enabled = showAura;

                if (showAura && hearthstoneAuraMaterial != null)
                {
                    float auraPulse = Mathf.Sin(Time.time * 3.5f) * 0.08f;
                    float auraIntensity = Mathf.Lerp(0.0f, 1.0f, hoverLerp) + (hoverLerp * auraPulse);
                    if (hearthstoneAuraMaterial.HasProperty("_Intensity"))
                        hearthstoneAuraMaterial.SetFloat("_Intensity", Mathf.Max(0f, auraIntensity));

                    // 미세한 스케일 트윈 (0.98 -> 1.0)
                    if (hearthstoneAuraObject != null)
                    {
                        float scaleFactor = Mathf.Lerp(0.98f, 1.0f, hoverLerp);
                        hearthstoneAuraObject.transform.localScale = new Vector3(2.35f * scaleFactor, 2.35f * scaleFactor, 1.0f);
                    }
                }
            }

            // 3. 외부 글래스 구체 머티리얼 반응 (외곽 림 라이트 은은한 상승)
            if (orbMaterial != null)
            {
                if (orbMaterial.HasProperty("_RimIntensity"))
                    orbMaterial.SetFloat("_RimIntensity", Mathf.Lerp(0.65f, 0.90f, hoverLerp));
            }

            // 4. 내부 포인트 라이트 (받침대 및 테이블로 은은하게 퍼지는 빛)
            if (orbPointLight != null)
            {
                orbPointLight.intensity = Mathf.Lerp(0.04f, 0.18f, hoverLerp);
            }
        }

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
            // 1-1. 스톤 베이스 머티리얼 (Aged Warm Slate / Marble)
            Material stoneBaseMat = CreateMat(litShader, "Orb_StoneBaseMat", new Color(0.52f, 0.56f, 0.60f), 0.05f, 0.32f);
            Material marblePillarMat = CreateMat(litShader, "Orb_MarblePillarMat", new Color(0.72f, 0.76f, 0.80f), 0.08f, 0.48f);
            Material stoneRimMat = CreateMat(litShader, "Orb_StoneRimMat", new Color(0.34f, 0.38f, 0.42f), 0.04f, 0.28f);

            // 1-2. 앤틱 골든 림 & 장식 머티리얼 (Antique Brass / Gold)
            Material goldTrimMat = CreateMat(litShader, "Orb_GoldTrimMat", new Color(0.86f, 0.68f, 0.28f), 0.88f, 0.68f);
            Material goldDarkMat = CreateMat(litShader, "Orb_GoldDarkMat", new Color(0.58f, 0.44f, 0.16f), 0.85f, 0.52f);

            // 1-3. 맑고 깊은 사파이어 수정구 구체 머티리얼 (2배 두꺼운 오로라 Caustics 셰이더 적용, 속도 0.65)
            Shader causticsShader = Shader.Find("DicePoC/OrbCaustics") ?? litShader;
            orbMaterial = new Material(causticsShader) { name = "Orb_Crystal_Caustics_Mat" };
            if (orbMaterial.HasProperty("_BaseColor")) orbMaterial.SetColor("_BaseColor", baseOrbColor);
            if (orbMaterial.HasProperty("_ShadowColor")) orbMaterial.SetColor("_ShadowColor", new Color(0.015f, 0.06f, 0.15f, 1.0f));
            if (orbMaterial.HasProperty("_CausticColor")) orbMaterial.SetColor("_CausticColor", new Color(0.11f, 0.50f, 0.76f, 1.0f));
            if (orbMaterial.HasProperty("_CausticIntensity")) orbMaterial.SetFloat("_CausticIntensity", 1.35f);
            if (orbMaterial.HasProperty("_WaveSpeed")) orbMaterial.SetFloat("_WaveSpeed", 0.65f);
            if (orbMaterial.HasProperty("_WaveScale")) orbMaterial.SetFloat("_WaveScale", 0.95f);
            if (orbMaterial.HasProperty("_WaveDistortion")) orbMaterial.SetFloat("_WaveDistortion", 0.75f);
            if (orbMaterial.HasProperty("_RimColor")) orbMaterial.SetColor("_RimColor", new Color(0.12f, 0.45f, 0.72f, 1.0f));
            if (orbMaterial.HasProperty("_RimPower")) orbMaterial.SetFloat("_RimPower", 3.0f);
            if (orbMaterial.HasProperty("_RimIntensity")) orbMaterial.SetFloat("_RimIntensity", 0.65f);
            if (orbMaterial.HasProperty("_Smoothness")) orbMaterial.SetFloat("_Smoothness", 0.98f);

            // 1-4. 내부 발광 마나 코어 머티리얼 (Luminous Inner Core)
            coreMaterial = CreateTransparentMat(litShader, "Orb_CoreMat", new Color(0.65f, 0.95f, 1.00f, 0.75f), 0.0f, 0.90f);
            coreMaterial.EnableKeyword("_EMISSION");
            coreMaterial.SetColor("_EmissionColor", coreBaseEmission);

            // 1-5. 앤틱 실버 플로럴 브로치 머티리얼 (Antique Silver / White Platinum)
            Material broochSilverMat = CreateMat(litShader, "Orb_BroochSilverMat", new Color(0.88f, 0.91f, 0.95f), 0.92f, 0.88f);

            // 1-6. 상시 외곽 은은한 후광 머티리얼 (Ambient Compact Halo Material)
            Shader outerGlowShader = Shader.Find("DicePoC/OrbOuterGlow") ?? Shader.Find("Universal Render Pipeline/Unlit") ?? litShader;
            ambientHaloMaterial = new Material(outerGlowShader) { name = "Orb_Ambient_Halo_Mat" };
            if (ambientHaloMaterial.HasProperty("_GlowColor")) ambientHaloMaterial.SetColor("_GlowColor", ambientHaloColor);
            if (ambientHaloMaterial.HasProperty("_InnerRadius")) ambientHaloMaterial.SetFloat("_InnerRadius", 0.67f);
            if (ambientHaloMaterial.HasProperty("_OuterRadius")) ambientHaloMaterial.SetFloat("_OuterRadius", 0.98f);
            if (ambientHaloMaterial.HasProperty("_FalloffPower")) ambientHaloMaterial.SetFloat("_FalloffPower", 2.2f);
            if (ambientHaloMaterial.HasProperty("_Intensity")) ambientHaloMaterial.SetFloat("_Intensity", 0.60f);
            if (ambientHaloMaterial.HasProperty("_ShimmerIntensity")) ambientHaloMaterial.SetFloat("_ShimmerIntensity", 0.12f);

            // 1-7. 호버 시 하스스톤 스타일 마나 불꽃 아우라 머티리얼 (Hearthstone Swirling Flame Aura Material)
            Shader hearthstoneAuraShader = Shader.Find("DicePoC/OrbHearthstoneAura") ?? outerGlowShader;
            hearthstoneAuraMaterial = new Material(hearthstoneAuraShader) { name = "Orb_Hearthstone_Aura_Mat" };
            if (hearthstoneAuraMaterial.HasProperty("_AuraColor")) hearthstoneAuraMaterial.SetColor("_AuraColor", hearthstoneFlameColor);
            if (hearthstoneAuraMaterial.HasProperty("_CoreColor")) hearthstoneAuraMaterial.SetColor("_CoreColor", hearthstoneCoreFilamentColor);
            if (hearthstoneAuraMaterial.HasProperty("_InnerRadius")) hearthstoneAuraMaterial.SetFloat("_InnerRadius", 0.675f);
            if (hearthstoneAuraMaterial.HasProperty("_OuterRadius")) hearthstoneAuraMaterial.SetFloat("_OuterRadius", 0.950f);
            if (hearthstoneAuraMaterial.HasProperty("_FlowSpeed")) hearthstoneAuraMaterial.SetFloat("_FlowSpeed", 1.6f);
            if (hearthstoneAuraMaterial.HasProperty("_FlameTurbulence")) hearthstoneAuraMaterial.SetFloat("_FlameTurbulence", 0.85f);
            if (hearthstoneAuraMaterial.HasProperty("_Intensity")) hearthstoneAuraMaterial.SetFloat("_Intensity", 0.0f);

            // 2. 계단식 원형 스톤 받침대 (Tiered Stepped Base)
            GameObject baseRoot = new("Base_Platform");
            baseRoot.layer = DecorationLayer;
            baseRoot.transform.SetParent(transform, false);

            // 2-1. 최하단 원형 스톤 플레이트 (넓고 묵직한 외곽)
            GameObject lowerBase = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            lowerBase.name = "LowerBase_Stone";
            SetupPart(lowerBase, baseRoot.transform, new Vector3(0f, 0.04f, 0f), Vector3.zero, new Vector3(2.55f, 0.04f, 2.55f), stoneRimMat);

            // 2-2. 2단 원형 스톤 플레이트
            GameObject upperBase = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            upperBase.name = "UpperBase_Stone";
            SetupPart(upperBase, baseRoot.transform, new Vector3(0f, 0.10f, 0f), Vector3.zero, new Vector3(2.25f, 0.035f, 2.25f), stoneBaseMat);

            // 2-3. 베이스 골드 링 림
            GameObject baseGoldRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseGoldRing.name = "Base_GoldRing";
            SetupPart(baseGoldRing, baseRoot.transform, new Vector3(0f, 0.135f, 0f), Vector3.zero, new Vector3(1.95f, 0.018f, 1.95f), goldTrimMat);

            // 2-4. 8방향 골드 스터드/스파이크
            int studCount = 8;
            for (int i = 0; i < studCount; i++)
            {
                float angle = i * (360f / studCount);
                float rad = angle * Mathf.Deg2Rad;
                Vector3 studPos = new(Mathf.Sin(rad) * 1.05f, 0.135f, Mathf.Cos(rad) * 1.05f);
                GameObject stud = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                stud.name = $"Base_Stud_{i}";
                SetupPart(stud, baseRoot.transform, studPos, Vector3.zero, new Vector3(0.14f, 0.08f, 0.14f), goldTrimMat);
            }

            // 3. 사각 대리석/스톤 기둥 (Square Marble Pedestal)
            GameObject pillarRoot = new("Pillar_Pedestal");
            pillarRoot.layer = DecorationLayer;
            pillarRoot.transform.SetParent(transform, false);

            // 3-1. 기둥 하단 몰딩 베이스
            GameObject pillarFoot = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pillarFoot.name = "Pillar_Foot";
            SetupPart(pillarFoot, pillarRoot.transform, new Vector3(0f, 0.20f, 0f), Vector3.zero, new Vector3(1.48f, 0.08f, 1.48f), goldDarkMat);

            // 3-2. 사각 대리석 본체
            GameObject pillarBody = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pillarBody.name = "Pillar_MarbleBody";
            SetupPart(pillarBody, pillarRoot.transform, new Vector3(0f, 0.44f, 0f), Vector3.zero, new Vector3(1.30f, 0.40f, 1.30f), marblePillarMat);

            // 3-3. 기둥 상단 골드 캡 몰딩
            GameObject pillarCap = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pillarCap.name = "Pillar_Cap";
            SetupPart(pillarCap, pillarRoot.transform, new Vector3(0f, 0.68f, 0f), Vector3.zero, new Vector3(1.52f, 0.08f, 1.52f), goldTrimMat);

            // 4. 상단 원형 골드 링 받침대 (Top Golden Collar Bracket)
            GameObject collarRoot = new("Collar_Bracket");
            collarRoot.layer = DecorationLayer;
            collarRoot.transform.SetParent(transform, false);

            // 4-1. 둥글고 두툼한 골드 림
            GameObject collarRing1 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            collarRing1.name = "Collar_Ring_Lower";
            SetupPart(collarRing1, collarRoot.transform, new Vector3(0f, 0.75f, 0f), Vector3.zero, new Vector3(1.65f, 0.045f, 1.65f), goldDarkMat);

            GameObject collarRing2 = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            collarRing2.name = "Collar_Ring_Upper";
            SetupPart(collarRing2, collarRoot.transform, new Vector3(0f, 0.83f, 0f), Vector3.zero, new Vector3(1.45f, 0.055f, 1.45f), goldTrimMat);

            // 4-2. 구체를 받치는 4개 골든 스터드 캡
            for (int i = 0; i < 4; i++)
            {
                float angle = i * 90f + 45f;
                float rad = angle * Mathf.Deg2Rad;
                Vector3 studPos = new(Mathf.Sin(rad) * 0.65f, 0.88f, Mathf.Cos(rad) * 0.65f);
                GameObject stud = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                stud.name = $"Collar_Stud_{i}";
                SetupPart(stud, collarRoot.transform, studPos, Vector3.zero, new Vector3(0.12f, 0.12f, 0.12f), goldTrimMat);
            }

            // 5. 마법 수정구 (Magic Crystal Orb)
            GameObject orbRoot = new("Crystal_Orb_Root");
            orbRoot.layer = DecorationLayer;
            orbRoot.transform.SetParent(transform, false);
            orbRoot.transform.localPosition = new Vector3(0f, 1.58f, 0f);

            // 5-1. 메인 수정구 구체 (반투명 맑은 비비드 아쿠아 사파이어)
            GameObject orbSphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            orbSphere.name = "Crystal_Orb_Sphere";
            SetupPart(orbSphere, orbRoot.transform, Vector3.zero, Vector3.zero, Vector3.one * 1.55f, orbMaterial);

            // 5-2. 내부 발광 마나 코어 (Luminous Inner Core Sphere)
            GameObject coreSphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            coreSphere.name = "Crystal_Inner_Core";
            SetupPart(coreSphere, orbRoot.transform, Vector3.zero, Vector3.zero, Vector3.one * 0.35f, coreMaterial);

            // 5-3. 상시 외곽 은은한 후광 평면 (Ambient Halo Plane - 스케일 2.20f)
            GameObject ambientHalo = GameObject.CreatePrimitive(PrimitiveType.Quad);
            ambientHalo.name = "Orb_Ambient_Halo_Plane";
            SetupPart(ambientHalo, orbRoot.transform, new Vector3(0f, 0f, 0f), new Vector3(90f, 0f, 0f), new Vector3(2.20f, 2.20f, 1.0f), ambientHaloMaterial);
            ambientHaloRenderer = ambientHalo.GetComponent<MeshRenderer>();
            if (ambientHaloRenderer != null) ambientHaloRenderer.enabled = true;

            // 5-4. 호버 시 하스스톤 스타일 마나 불꽃 아우라 평면 (Hearthstone Flame Aura Plane, 스케일 2.35f)
            hearthstoneAuraObject = GameObject.CreatePrimitive(PrimitiveType.Quad);
            hearthstoneAuraObject.name = "Orb_Hearthstone_Aura_Plane";
            SetupPart(hearthstoneAuraObject, orbRoot.transform, new Vector3(0f, 0.005f, 0f), new Vector3(90f, 0f, 0f), new Vector3(2.35f, 2.35f, 1.0f), hearthstoneAuraMaterial);
            hearthstoneAuraRenderer = hearthstoneAuraObject.GetComponent<MeshRenderer>();
            if (hearthstoneAuraRenderer != null) hearthstoneAuraRenderer.enabled = false;

            // 5-5. 내부 은은한 포인트 라이트 (묵직한 딥 블루 톤, 절제된 미세 강도)
            GameObject lightObj = new("Orb_PointLight");
            lightObj.transform.SetParent(orbRoot.transform, false);
            orbPointLight = lightObj.AddComponent<Light>();
            orbPointLight.type = LightType.Point;
            orbPointLight.color = new Color(0.15f, 0.55f, 0.82f);
            orbPointLight.range = 2.4f;
            orbPointLight.intensity = 0.04f;
            orbPointLight.shadows = LightShadows.None;

            // 6. 구슬을 포근하게 감싸는 큼지막한 스타일라이즈드 대형 나뭇잎 장식 (Chunky Wrapping Leaves)
            CreateChunkyWrappingLeaves(orbRoot.transform, goldTrimMat);

            // 7. 내부 스노우 글로브 은하수 궤도 파티클 시스템
            CreateMagicParticles(orbRoot.transform);

            // 8. 마우스 인터랙션을 위한 Sphere Collider 장착
            SphereCollider col = gameObject.GetComponent<SphereCollider>();
            if (col == null) col = gameObject.AddComponent<SphereCollider>();
            col.center = new Vector3(0f, 1.50f, 0f);
            col.radius = 1.30f;
        }

        private void CreateChunkyWrappingLeaves(Transform parent, Material leafMat)
        {
            GameObject leafRoot = new("Orb_Wrapping_Leaves");
            leafRoot.layer = DecorationLayer;
            leafRoot.transform.SetParent(parent, false);

            // 픽셀 필터에서도 실루엣이 시원하고 또렷하게 읽히는 5개의 대형 월계수 잎사귀 구성
            // (구슬 R=0.775 둘레를 하단에서 대각선으로 포근하게 감싸 안는 3D 요람 구조)
            var leafConfigs = new (float azimuthDeg, float elevationDeg, float rollDeg, float length, float width)[]
            {
                ( -30f, -28f,  38f, 0.58f, 0.24f ), // 1. 정면 하단에서 우측으로 올라가는 대형 잎사귀
                (  35f, -18f,  50f, 0.68f, 0.26f ), // 2. 5시 방향 우하단을 감싸 올라가는 메인 대형 잎사귀
                (  75f,  12f,  65f, 0.56f, 0.22f ), // 3. 우측 측면 상단을 휘감는 잎사귀
                ( -75f, -32f, -35f, 0.50f, 0.20f ), // 4. 좌측 하단을 받쳐주는 대형 잎사귀
                (   5f, -48f,  10f, 0.44f, 0.18f )  // 5. 하단 중심을 받치는 베이스 잎사귀
            };

            for (int i = 0; i < leafConfigs.Length; i++)
            {
                var cfg = leafConfigs[i];
                float azRad = cfg.azimuthDeg * Mathf.Deg2Rad;
                float elRad = cfg.elevationDeg * Mathf.Deg2Rad;

                // 구면 표면 법선 방향 벡터 계산
                Vector3 surfaceDir = new Vector3(
                    Mathf.Sin(azRad) * Mathf.Cos(elRad),
                    Mathf.Sin(elRad),
                    -Mathf.Cos(azRad) * Mathf.Cos(elRad)
                ).normalized;

                // 구슬 표면에 밀착 (R = 0.775)
                Vector3 leafBasePos = surfaceDir * 0.765f;
                Quaternion baseRot = Quaternion.LookRotation(surfaceDir, Vector3.up) * Quaternion.Euler(0f, 0f, cfg.rollDeg);

                // 1. 대형 잎사귀 본체 (도톰한 스타일라이즈드 타원체)
                GameObject leafObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                leafObj.name = $"Chunky_Leaf_{i}";
                // 잎사귀 끝단이 구슬 곡면을 따라 감싸도록 전방으로 살짝 굽힘
                Quaternion leafRot = baseRot * Quaternion.Euler(18f, 0f, 0f);
                Vector3 leafCenter = leafBasePos + (leafRot * Vector3.up * (cfg.length * 0.45f));
                SetupPart(leafObj, leafRoot.transform, leafCenter, leafRot.eulerAngles, new Vector3(cfg.width, cfg.length, 0.08f), leafMat);

                // 2. 잎사귀 중앙 굵은 엽맥 융기 라인 (픽셀 셰이딩에서 확실한 입체감 형성)
                GameObject ribObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                ribObj.name = $"Chunky_Leaf_Rib_{i}";
                Vector3 ribCenter = leafBasePos + (leafRot * Vector3.up * (cfg.length * 0.45f)) + (leafRot * Vector3.forward * -0.025f);
                SetupPart(ribObj, leafRoot.transform, ribCenter, (leafRot * Quaternion.Euler(90f, 0f, 0f)).eulerAngles, new Vector3(0.04f, cfg.length * 0.42f, 0.04f), leafMat);

                // 3. 잎사귀 기저부 앤틱 골드 비드
                GameObject bead = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                bead.name = $"Chunky_Leaf_BaseBead_{i}";
                SetupPart(bead, leafRoot.transform, leafBasePos, Vector3.zero, new Vector3(0.09f, 0.09f, 0.09f), leafMat);
            }
        }

        private void CreateMagicParticles(Transform parent)
        {
            GameObject psObj = new("Magic_SnowGlobe_Particles");
            psObj.layer = DecorationLayer;
            psObj.transform.SetParent(parent, false);

            magicParticles = psObj.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = magicParticles.main;
            main.loop = true;
            main.playOnAwake = true;
            main.maxParticles = 75;
            main.startLifetime = new ParticleSystem.MinMaxCurve(2.2f, 4.0f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.02f, 0.08f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.035f, 0.09f);
            main.startColor = new ParticleSystem.MinMaxGradient(new Color(0.45f, 0.90f, 1.00f, 0.95f), new Color(1.00f, 1.00f, 1.00f, 1.00f));
            main.simulationSpace = ParticleSystemSimulationSpace.Local;

            ParticleSystem.EmissionModule emission = magicParticles.emission;
            emission.rateOverTime = 26f;

            ParticleSystem.ShapeModule shape = magicParticles.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.65f;

            // 스노우 글로브 은하수 궤도 회전 (Swirling Orbital Velocity)
            ParticleSystem.VelocityOverLifetimeModule vel = magicParticles.velocityOverLifetime;
            vel.enabled = true;
            vel.orbitalX = new ParticleSystem.MinMaxCurve(0f, 0f);
            vel.orbitalY = new ParticleSystem.MinMaxCurve(2.4f, 3.8f);
            vel.orbitalZ = new ParticleSystem.MinMaxCurve(0f, 0f);
            vel.radial = new ParticleSystem.MinMaxCurve(-0.05f, 0.05f);

            // 반짝이는 별빛 (Twinkle & Multi-pulse Alpha)
            ParticleSystem.ColorOverLifetimeModule col = magicParticles.colorOverLifetime;
            col.enabled = true;
            Gradient grad = new();
            grad.SetKeys(
                new[]
                {
                    new GradientColorKey(new Color(0.4f, 0.85f, 1f), 0f),
                    new GradientColorKey(Color.white, 0.35f),
                    new GradientColorKey(new Color(0.6f, 0.95f, 1f), 0.7f),
                    new GradientColorKey(new Color(0.3f, 0.75f, 1f), 1f)
                },
                new[]
                {
                    new GradientAlphaKey(0f, 0f),
                    new GradientAlphaKey(1.0f, 0.25f),
                    new GradientAlphaKey(0.4f, 0.50f),
                    new GradientAlphaKey(1.0f, 0.75f),
                    new GradientAlphaKey(0f, 1f)
                }
            );
            col.color = grad;

            // 다단계 트윙클 크기 커브
            ParticleSystem.SizeOverLifetimeModule size = magicParticles.sizeOverLifetime;
            size.enabled = true;
            AnimationCurve curve = new(
                new Keyframe(0f, 0.2f),
                new Keyframe(0.25f, 1.0f),
                new Keyframe(0.50f, 0.4f),
                new Keyframe(0.75f, 1.1f),
                new Keyframe(1f, 0f)
            );
            size.size = new ParticleSystem.MinMaxCurve(1f, curve);

            ParticleSystemRenderer psRenderer = psObj.GetComponent<ParticleSystemRenderer>();
            Shader particleShader = Shader.Find("Universal Render Pipeline/Particles/Unlit")
                ?? Shader.Find("Particles/Standard Unlit")
                ?? Shader.Find("Universal Render Pipeline/Unlit")
                ?? Shader.Find("Standard");

            Material psMat = new(particleShader) { name = "Orb_Particle_Mat" };
            if (psMat.HasProperty("_Surface")) psMat.SetFloat("_Surface", 1);
            if (psMat.HasProperty("_Blend")) psMat.SetFloat("_Blend", 0);
            if (psMat.HasProperty("_BaseColor")) psMat.SetColor("_BaseColor", new Color(0.88f, 0.98f, 1f, 1f));
            if (psMat.HasProperty("_Color")) psMat.SetColor("_Color", new Color(0.88f, 0.98f, 1f, 1f));
            if (psMat.HasProperty("_EmissionColor"))
            {
                psMat.EnableKeyword("_EMISSION");
                psMat.SetColor("_EmissionColor", new Color(0.60f, 0.95f, 1.00f) * 2.5f);
            }
            psRenderer.material = psMat;
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

        private static Material CreateTransparentMat(Shader shader, string name, Color color, float metallic, float smoothness)
        {
            Material m = new(shader) { name = name };
            if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 1f); // 1 = Transparent
            if (m.HasProperty("_Blend")) m.SetFloat("_Blend", 0f);   // 0 = Alpha
            if (m.HasProperty("_ZWrite")) m.SetFloat("_ZWrite", 0f);
            if (m.HasProperty("_SrcBlend")) m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            if (m.HasProperty("_DstBlend")) m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.renderQueue = (int)RenderQueue.Transparent;
            m.SetOverrideTag("RenderType", "Transparent");

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
