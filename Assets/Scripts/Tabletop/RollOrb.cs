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
    /// - 5시 방향 아르누보 팔메트 & 트윈 볼류트 양각 금속 장식 (Palmette Relief Ornament)
    /// </summary>
    [ExecuteAlways]
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

        // 상시 적용 은은한 사파이어 외곽 후광 컬러
        private readonly Color ambientHaloColor = new(0.12f, 0.55f, 0.95f, 1.0f);

        // 하스스톤 스타일 카드 활성화 마나 불꽃 아우라 컬러 (톤온톤)
        private readonly Color hearthstoneFlameColor = new(0.12f, 0.50f, 0.90f, 0.85f);
        private readonly Color hearthstoneCoreFilamentColor = new(0.45f, 0.88f, 1.00f, 1.00f);

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
            if (transform.childCount == 0 || transform.Find("Glass_Orb_Root") == null)
            {
                BuildGeometry();
            }
        }

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

            // 1. 상시 외곽 후광 (베젤 링 바깥쪽으로만 은은하게 방사되는 옅은 빛)
            if (ambientHaloMaterial != null)
            {
                float idleBreath = Mathf.Sin(Time.time * 2.0f) * 0.04f;
                float ambientIntensity = 0.36f + idleBreath + (hoverLerp * 0.12f);
                if (ambientHaloMaterial.HasProperty("_Intensity"))
                    ambientHaloMaterial.SetFloat("_Intensity", Mathf.Max(0f, ambientIntensity));
            }

            // 2. 호버 시 베젤 테두리 마나 아우라 (베젤 링 외곽으로만 퍼지는 옅은 아우라)
            if (hearthstoneAuraRenderer != null)
            {
                bool showAura = hoverLerp > 0.01f;
                hearthstoneAuraRenderer.enabled = showAura;

                if (showAura && hearthstoneAuraMaterial != null)
                {
                    float auraIntensity = Mathf.Lerp(0.0f, 0.45f, hoverLerp);
                    if (hearthstoneAuraMaterial.HasProperty("_Intensity"))
                        hearthstoneAuraMaterial.SetFloat("_Intensity", Mathf.Max(0f, auraIntensity));
                }
            }

            // 3. 외부 글래스 구체 머티리얼 반응 (외곽 림 라이트 은은한 상승)
            if (orbMaterial != null)
            {
                if (orbMaterial.HasProperty("_RimIntensity"))
                    orbMaterial.SetFloat("_RimIntensity", Mathf.Lerp(0.65f, 0.85f, hoverLerp));
            }

            // 4. 내부 포인트 라이트 (받침대 및 테이블로 은은하게 퍼지는 빛)
            if (orbPointLight != null)
            {
                orbPointLight.intensity = Mathf.Lerp(0.04f, 0.15f, hoverLerp);
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

            // 1-6. 상시 외곽 은은한 후광 머티리얼 (베젤 링 바깥쪽으로만 옅게 방사)
            Shader outerGlowShader = Shader.Find("DicePoC/OrbOuterGlow") ?? Shader.Find("Universal Render Pipeline/Unlit") ?? litShader;
            ambientHaloMaterial = new Material(outerGlowShader) { name = "Orb_Ambient_Halo_Mat" };
            if (ambientHaloMaterial.HasProperty("_GlowColor")) ambientHaloMaterial.SetColor("_GlowColor", ambientHaloColor);
            if (ambientHaloMaterial.HasProperty("_InnerRadius")) ambientHaloMaterial.SetFloat("_InnerRadius", 0.735f); // 링 외경에 밀착 (내부 차단)
            if (ambientHaloMaterial.HasProperty("_OuterRadius")) ambientHaloMaterial.SetFloat("_OuterRadius", 0.98f);
            if (ambientHaloMaterial.HasProperty("_FalloffPower")) ambientHaloMaterial.SetFloat("_FalloffPower", 2.2f);
            if (ambientHaloMaterial.HasProperty("_Intensity")) ambientHaloMaterial.SetFloat("_Intensity", 0.38f); // 옅은 강도
            if (ambientHaloMaterial.HasProperty("_ShimmerIntensity")) ambientHaloMaterial.SetFloat("_ShimmerIntensity", 0.08f);

            // 1-7. 호버 시 정적 빛 테두리 아우라 머티리얼 (베젤 링 외곽으로만 퍼지는 옅은 아우라)
            Shader hearthstoneAuraShader = Shader.Find("DicePoC/OrbHearthstoneAura") ?? outerGlowShader;
            hearthstoneAuraMaterial = new Material(hearthstoneAuraShader) { name = "Orb_Hearthstone_Aura_Mat" };
            if (hearthstoneAuraMaterial.HasProperty("_AuraColor")) hearthstoneAuraMaterial.SetColor("_AuraColor", hearthstoneFlameColor);
            if (hearthstoneAuraMaterial.HasProperty("_CoreColor")) hearthstoneAuraMaterial.SetColor("_CoreColor", hearthstoneCoreFilamentColor);
            if (hearthstoneAuraMaterial.HasProperty("_InnerRadius")) hearthstoneAuraMaterial.SetFloat("_InnerRadius", 0.735f); // 링 외경에 밀착 (내부 차단)
            if (hearthstoneAuraMaterial.HasProperty("_BorderWidth")) hearthstoneAuraMaterial.SetFloat("_BorderWidth", 0.10f);
            if (hearthstoneAuraMaterial.HasProperty("_OuterRadius")) hearthstoneAuraMaterial.SetFloat("_OuterRadius", 0.98f);
            if (hearthstoneAuraMaterial.HasProperty("_FalloffPower")) hearthstoneAuraMaterial.SetFloat("_FalloffPower", 1.8f);
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

            // 5-3. 내부 은은한 포인트 라이트 (묵직한 딥 블루 톤, 절제된 미세 강도)
            GameObject lightObj = new("Orb_PointLight");
            lightObj.transform.SetParent(orbRoot.transform, false);
            orbPointLight = lightObj.AddComponent<Light>();
            orbPointLight.type = LightType.Point;
            orbPointLight.color = new Color(0.15f, 0.55f, 0.82f);
            orbPointLight.range = 2.4f;
            orbPointLight.intensity = 0.04f;
            orbPointLight.shadows = LightShadows.None;

            // 6. 카메라 대면 원형 백은 테두리 링 + 덩굴 데코레이션 및 75도 동축 후광/아우라
            CreateOrnateSilverBezelFrame(orbRoot.transform, broochSilverMat, goldTrimMat);

            // 7. 4~5시 방향 아르누보 팔메트 & 트윈 볼류트 양각 금속 장식 (Palmette Relief Ornament)
            CreatePalmetteReliefOrnament(orbRoot.transform, broochSilverMat, goldTrimMat);

            // 8. 내부 스노우 글로브 은하수 궤도 파티클 시스템
            CreateMagicParticles(orbRoot.transform);

            // 9. 마우스 인터랙션을 위한 Sphere Collider 장착
            SphereCollider col = gameObject.GetComponent<SphereCollider>();
            if (col == null) col = gameObject.AddComponent<SphereCollider>();
            col.center = new Vector3(0f, 1.50f, 0f);
            col.radius = 1.30f;
        }

        /// <summary>
        /// 75도 직교 카메라 시선 축에 맞춘 원형 백은 테두리 링 및 둘레를 감싸는 덩굴/잎사귀 데코레이션, 동축 후광/아우라
        /// </summary>
        private void CreateOrnateSilverBezelFrame(Transform parent, Material silverMat, Material goldMat)
        {
            GameObject bezelRoot = new("Orb_Ornate_Silver_Bezel");
            bezelRoot.layer = DecorationLayer;
            bezelRoot.transform.SetParent(parent, false);
            // 75도 직교 카메라 시선 축에 완벽하게 수직 정렬 (화면에서 정원형 렌더링)
            bezelRoot.transform.localRotation = Quaternion.Euler(75.0f, 0f, 0f);
            bezelRoot.transform.localPosition = Vector3.zero;

            // 0. 베젤 링 바로 뒤에 75도 동축으로 밀착된 후광 및 아우라 Quad 배치
            // 0-1. 상시 외곽 은은한 후광 평면 (Ambient Halo - 베젤 링 바깥쪽으로만 은은히 방사)
            GameObject ambientHalo = GameObject.CreatePrimitive(PrimitiveType.Quad);
            ambientHalo.name = "Orb_Ambient_Halo_Plane";
            SetupPart(ambientHalo, bezelRoot.transform, new Vector3(0f, 0f, -0.015f), Vector3.zero, new Vector3(2.40f, 2.40f, 1.0f), ambientHaloMaterial);
            ambientHaloRenderer = ambientHalo.GetComponent<MeshRenderer>();
            if (ambientHaloRenderer != null) ambientHaloRenderer.enabled = true;

            // 0-2. 호버 시 베젤 테두리 마나 아우라 평면 (Hearthstone Aura Ring - 베젤 링 외곽으로만 퍼지는 옅은 아우라)
            hearthstoneAuraObject = GameObject.CreatePrimitive(PrimitiveType.Quad);
            hearthstoneAuraObject.name = "Orb_Hearthstone_Aura_Plane";
            SetupPart(hearthstoneAuraObject, bezelRoot.transform, new Vector3(0f, 0f, -0.008f), Vector3.zero, new Vector3(2.40f, 2.40f, 1.0f), hearthstoneAuraMaterial);
            hearthstoneAuraRenderer = hearthstoneAuraObject.GetComponent<MeshRenderer>();
            if (hearthstoneAuraRenderer != null) hearthstoneAuraRenderer.enabled = false;

            // 1. 메인 3D 원형 튜브 링 (Main Torus Bezel Ring) - 픽셀 필터 투과용 두꺼운 두께
            GameObject mainRing = new("Bezel_MainRing");
            mainRing.layer = DecorationLayer;
            mainRing.transform.SetParent(bezelRoot.transform, false);
            MeshFilter mf = mainRing.AddComponent<MeshFilter>();
            mf.sharedMesh = BuildTorusRingMesh(0.782f, 0.1f, 48, 12);
            MeshRenderer mr = mainRing.AddComponent<MeshRenderer>();
            if (Application.isPlaying) mr.material = silverMat;
            else mr.sharedMaterial = silverMat;
            mr.shadowCastingMode = ShadowCastingMode.TwoSided;
            mr.receiveShadows = true;

            // 2. 링 둘레를 나선형으로 휘감아 도는 덩굴 가지들 (Spiral Vine Strands)
            // (10시 방향, 1시 방향, 7시 방향 등 링의 주요 둘레를 교차하며 감싸는 부드러운 아르누보 덩굴)
            var vineConfigs = new (float startAngleDeg, float sweepDeg, float radialOffset, Material mat)[]
            {
                (  45f,  35f,  0.012f, silverMat ), // 1. 상단 우측(1~2시)을 감싸는 은빛 덩굴
                ( 125f,  40f, -0.010f, silverMat ), // 2. 상단 좌측(10~11시)을 감싸는 은빛 덩굴
                ( 210f,  38f,  0.012f, goldMat   ), // 3. 하단 좌측(7~8시)을 감싸는 골드 덩굴
                ( 285f,  32f, -0.010f, silverMat )  // 4. 하단 우측(5~6시) 메인 장식으로 이어지는 덩굴
            };

            for (int i = 0; i < vineConfigs.Length; i++)
            {
                var v = vineConfigs[i];
                int steps = 6;
                for (int s = 0; s < steps; s++)
                {
                    float t = (float)s / (steps - 1);
                    float angleDeg = v.startAngleDeg + v.sweepDeg * t;
                    float angleRad = angleDeg * Mathf.Deg2Rad;
                    float r = 0.782f + Mathf.Sin(t * Mathf.PI) * v.radialOffset;
                    float zOffset = Mathf.Cos(t * Mathf.PI) * 0.018f;

                    Vector3 vinePt = new Vector3(Mathf.Cos(angleRad) * r, Mathf.Sin(angleRad) * r, zOffset);
                    GameObject node = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                    node.name = $"Bezel_VineStrand_{i}_Node_{s}";
                    SetupPart(node, bezelRoot.transform, vinePt, Vector3.zero, new Vector3(0.076f, 0.076f, 0.076f), v.mat);
                }
            }

            // 3. 링 및 덩굴 주변에 피어난 아르누보 미니 잎사귀 및 젬 비드 (Leaves & Beads)
            var leafConfigs = new (float angleDeg, float rotDeg, float length, float width, Material mat)[]
            {
                (  65f,  45f, 0.24f, 0.090f, silverMat ), // 1시 방향 잎사귀
                ( 145f, -40f, 0.26f, 0.096f, silverMat ), // 10시 방향 잎사귀
                ( 160f,  20f, 0.20f, 0.080f, goldMat   ), // 9시 방향 골드 미니 잎사귀
                ( 230f, -30f, 0.24f, 0.090f, goldMat   ), // 8시 방향 골드 잎사귀
                ( 245f,  40f, 0.20f, 0.080f, silverMat )  // 7시 방향 잎사귀
            };

            for (int i = 0; i < leafConfigs.Length; i++)
            {
                var l = leafConfigs[i];
                float rad = l.angleDeg * Mathf.Deg2Rad;
                Vector3 leafPos = new Vector3(Mathf.Cos(rad) * 0.795f, Mathf.Sin(rad) * 0.795f, 0.012f);
                Quaternion leafRot = Quaternion.Euler(0f, 0f, l.angleDeg + l.rotDeg);

                GameObject leafObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                leafObj.name = $"Bezel_VineLeaf_{i}";
                SetupPart(leafObj, bezelRoot.transform, leafPos, leafRot.eulerAngles, new Vector3(l.width, l.length, 0.050f), l.mat);
            }

            // 4. 아르누보 S/C 커브 스크롤 장식 (1시·7시·4-5시 방향, 절제된 3곳)
            //    메인 링(0.1f)과 유사한 두께감으로 구체 위로 감겨 올라오는 튜브
            AddScrollDecoration(bezelRoot.transform, silverMat, goldMat,
                anchorAngleDeg: 60f,   pitchDeg: 46f, yawDeltaDeg: -22f, isS: true);   // 1시 방향
            AddScrollDecoration(bezelRoot.transform, silverMat, goldMat,
                anchorAngleDeg: 210f,  pitchDeg: 42f, yawDeltaDeg:  18f, isS: false);  // 7시 방향
            AddScrollDecoration(bezelRoot.transform, silverMat, goldMat,
                anchorAngleDeg: 130f,  pitchDeg: 34f, yawDeltaDeg: -12f, isS: true,
                stemScale: 0.88f);     // 4~5시 (팔메트 연결)
        }

        /// <summary>
        /// 링 위 지정 각도에서 구면 표면 위로 감겨 올라오는 아르누보 S/C 커브 튜브 스크롤 장식 생성.
        /// 메인 링 튜브(0.1f)와 조화를 이루는 두께감과 뚜렷한 가시성을 제공합니다.
        /// </summary>
        private void AddScrollDecoration(Transform parent, Material silverMat, Material goldMat,
            float anchorAngleDeg, float pitchDeg, float yawDeltaDeg, bool isS, float stemScale = 1.0f)
        {
            // 구슬 반경(0.775) 위로 튜브가 확실히 드러나도록 중심 궤적 반경 설정
            const float orbR    = 0.855f;  
            float       tubeR   = 0.085f * stemScale; // 메인 링(0.1f)과 유사한 두께
            const int   steps   = 28;
            const int   tubeSeg = 12;
            string      tag     = anchorAngleDeg < 100f ? "1h" : anchorAngleDeg < 180f ? "45" : "7h";

            float aRad = anchorAngleDeg * Mathf.Deg2Rad;

            // 구면 위 시작 방향 (링 평면, Z=0)
            Vector3 startDir = new Vector3(Mathf.Cos(aRad), Mathf.Sin(aRad), 0f).normalized;

            // 링 접선 방향: 앵커 점에서 XY 평면 접선
            Vector3 tangentInPlane = new Vector3(-Mathf.Sin(aRad), Mathf.Cos(aRad), 0f).normalized;

            // pitchDeg: tangentInPlane 축으로 startDir를 회전 → 구슬 앞면(+Z)으로 기어오름
            Vector3 endDir = Quaternion.AngleAxis(pitchDeg, tangentInPlane) * startDir;
            // yawDeltaDeg: Z축으로 추가 회전 → 좌우 방향 조정
            endDir = Quaternion.AngleAxis(yawDeltaDeg, Vector3.forward) * endDir;
            endDir = endDir.normalized;

            // S/C 커브용 중간 제어 방향 (구면 위 제어점)
            Vector3 midBase = Vector3.Slerp(startDir, endDir, 0.5f).normalized;
            Vector3 sideAxis = Vector3.Cross(startDir, endDir).normalized;
            float   sideBend = isS ? 0.38f : 0.24f;
            Vector3 midDir   = (midBase + sideAxis * sideBend).normalized;

            // 구면 위 경로 생성 (Quadratic Bezier on Sphere)
            Vector3[] path = new Vector3[steps];
            for (int i = 0; i < steps; i++)
            {
                float t = (float)i / (steps - 1);
                Vector3 a = Vector3.Slerp(startDir, midDir, t);
                Vector3 b = Vector3.Slerp(midDir,   endDir, t);
                path[i] = Vector3.Slerp(a, b, t).normalized * orbR;
            }

            // 튜브 메쉬 생성
            GameObject scrollObj = new($"Scroll_Tube_{tag}");
            scrollObj.layer = DecorationLayer;
            scrollObj.transform.SetParent(parent, false);
            MeshFilter scrollMf = scrollObj.AddComponent<MeshFilter>();
            scrollMf.sharedMesh = BuildPathTubeMesh(path, tubeR, tubeSeg);
            MeshRenderer scrollMr = scrollObj.AddComponent<MeshRenderer>();
            if (Application.isPlaying) scrollMr.material = silverMat;
            else scrollMr.sharedMaterial = silverMat;
            scrollMr.shadowCastingMode = ShadowCastingMode.TwoSided;
            scrollMr.receiveShadows = true;

            // 볼류트 말림 팁: 튜브 끝에서 자연스러운 골드 말림 구체
            Vector3 tipPos     = path[steps - 1];
            Vector3 tipTangent = (path[steps - 1] - path[steps - 2]).normalized;
            Vector3 tipNormal  = Vector3.Cross(tipTangent, tipPos.normalized).normalized;
            float   vR         = 0.095f * stemScale;
            GameObject vg1 = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            vg1.name = $"Scroll_{tag}_Volute0";
            SetupPart(vg1, parent, tipPos + tipNormal * vR * 0.75f,
                Vector3.zero, Vector3.one * vR, goldMat);
            GameObject vg2 = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            vg2.name = $"Scroll_{tag}_Volute1";
            SetupPart(vg2, parent, tipPos + tipNormal * vR * 0.25f - tipTangent * vR * 0.5f,
                Vector3.zero, Vector3.one * (vR * 0.75f), goldMat);
        }

        /// <summary>
        /// 제공된 레퍼런스 이미지 기반 아칸서스/팔메트 양각 조각(Palmette & Twin Spiral Volute Relief) 3D 금속 장식 생성
        /// - 75도 직교 카메라 뷰 기준 사진 속 4~5시 방향 구면에 완벽 밀착
        /// - 전체 스케일 1.3배(130%) 확대 적용
        /// - 중심 방사형 부채꼴 리본 잎사귀 (Center Fan Petals)
        /// - 좌우 트윈 볼류트 나선 엠블럼 (Twin Spiral Volutes & C-rims)
        /// - 하단 3단 아칸서스 드롭 팁 (Bottom 3-Tier Drops)
        /// - 상단 부드러운 크라운 잎사귀 (Upper Crown Arches)
        /// - 백은(Platinum Silver) 바디 + 앤틱 골드(Gold Trim) 투톤 메탈릭 머티리얼
        /// </summary>
        private void CreatePalmetteReliefOrnament(Transform parent, Material silverMat, Material goldMat)
        {
            GameObject ornamentRoot = new("Orb_Palmette_Ornament");
            ornamentRoot.layer = DecorationLayer;
            ornamentRoot.transform.SetParent(parent, false);
            // 피벗을 구슬 중심(Vector3.zero)에 고정 → Inspector에서 Rotation 조정 시 구슬 중심 기준으로 공전
            ornamentRoot.transform.localPosition = Vector3.zero;
            ornamentRoot.transform.localRotation = Quaternion.identity;

            const float S = 1.30f; // 1.3배 확대 스케일 팩터

            // 75도 직교 카메라 화면 기준 사진 속 4~5시 방향 구면 단위 벡터
            Vector3 centerDir = new Vector3(0.42f, 0.44f, -0.79f).normalized;

            // 구면 법선 방향 기반 좌표계 (Forward = 구면 밖, Up = 구슬 상단 방향, Right = 우측 방향)
            Quaternion surfaceBaseRot = Quaternion.LookRotation(centerDir, Vector3.up);
            Vector3 centerPos = centerDir * 0.770f;

            // 1. 중심 방사형 수렴 코어 보스 (Central Boss Point)
            GameObject centerBoss = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            centerBoss.name = "Palmette_CenterBoss";
            SetupPart(centerBoss, ornamentRoot.transform, centerPos, surfaceBaseRot.eulerAngles, new Vector3(0.085f * S, 0.085f * S, 0.045f * S), silverMat);

            // 2. 방사형 부채꼴 리본 잎맥들 (Center Fan Ribbons - 5 Petals)
            // - 중앙에서 아래/사방으로 방사상으로 뻗어나가는 양각 리본
            var fanPetals = new (float angleOffset, float length, float width, Material mat)[]
            {
                (   0f, 0.38f * S, 0.065f * S, silverMat ), // 중앙 메인 리본
                ( -18f, 0.35f * S, 0.058f * S, silverMat ), // 좌측 1번 리본
                (  18f, 0.35f * S, 0.058f * S, silverMat ), // 우측 1번 리본
                ( -36f, 0.30f * S, 0.050f * S, goldMat   ), // 좌측 2번 골드 리본
                (  36f, 0.30f * S, 0.050f * S, goldMat   )  // 우측 2번 골드 리본
            };

            for (int i = 0; i < fanPetals.Length; i++)
            {
                var petal = fanPetals[i];
                Quaternion petalRot = surfaceBaseRot * Quaternion.Euler(0f, 0f, 180f + petal.angleOffset);
                Vector3 petalPos = centerPos + (petalRot * Vector3.up * (petal.length * 0.45f)) + (centerDir * 0.008f);

                GameObject petalObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                petalObj.name = $"Palmette_FanPetal_{i}";
                SetupPart(petalObj, ornamentRoot.transform, petalPos, petalRot.eulerAngles, new Vector3(petal.width, petal.length, 0.035f * S), petal.mat);
            }

            // 3. 좌우 트윈 볼류트 스크롤 (Twin Spiral Volutes & C-rims)
            // - 이미지 속 양옆의 도톰한 원형 나선 엠블럼과 이를 감싸는 C자형 테두리
            for (int side = -1; side <= 1; side += 2)
            {
                string sideName = side < 0 ? "Left" : "Right";
                Vector3 voluteOffset = (surfaceBaseRot * Vector3.right * (side * 0.18f * S)) + (surfaceBaseRot * Vector3.up * (-0.06f * S));
                Vector3 volutePos = centerPos + voluteOffset;

                // 3-1. 볼류트 중심 원형 보스 (Inner Eye Disc)
                GameObject voluteEye = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                voluteEye.name = $"Palmette_VoluteEye_{sideName}";
                SetupPart(voluteEye, ornamentRoot.transform, volutePos, surfaceBaseRot.eulerAngles, new Vector3(0.11f * S, 0.11f * S, 0.045f * S), silverMat);

                // 3-2. 볼류트 내부 링 (Inner Concentric Ring)
                GameObject voluteRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                voluteRing.name = $"Palmette_VoluteRing_{sideName}";
                Quaternion ringRot = surfaceBaseRot * Quaternion.Euler(90f, 0f, 0f);
                SetupPart(voluteRing, ornamentRoot.transform, volutePos + (centerDir * 0.005f), ringRot.eulerAngles, new Vector3(0.14f * S, 0.015f * S, 0.14f * S), goldMat);

                // 3-3. 볼류트 외곽 C자형 스크롤 아치 (Outer Arch Rim)
                Vector3 archPos = volutePos + (surfaceBaseRot * Vector3.right * (side * 0.06f * S)) + (surfaceBaseRot * Vector3.up * (0.04f * S));
                GameObject voluteArch = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                voluteArch.name = $"Palmette_VoluteArch_{sideName}";
                Quaternion archRot = surfaceBaseRot * Quaternion.Euler(0f, 0f, side * 35f);
                SetupPart(voluteArch, ornamentRoot.transform, archPos, archRot.eulerAngles, new Vector3(0.065f * S, 0.22f * S, 0.038f * S), silverMat);
            }

            // 4. 하단 3단 아칸서스 드롭 팁 (Bottom 3-Tier Acanthus Drops)
            // - 아래쪽으로 뻗어나가는 3개의 우아한 눈물방울형 잎사귀 팁
            var dropTips = new (float offsetX, float offsetY, float rotZ, float length, float width, Material mat)[]
            {
                (  0.00f * S, -0.32f * S,   0f, 0.32f * S, 0.085f * S, silverMat ), // 중앙 메인 드롭 팁
                ( -0.10f * S, -0.28f * S, -22f, 0.24f * S, 0.065f * S, goldMat   ), // 좌측 보조 팁
                (  0.10f * S, -0.28f * S,  22f, 0.24f * S, 0.065f * S, goldMat   )  // 우측 보조 팁
            };

            for (int i = 0; i < dropTips.Length; i++)
            {
                var drop = dropTips[i];
                Vector3 dropPos = centerPos + (surfaceBaseRot * Vector3.right * drop.offsetX) + (surfaceBaseRot * Vector3.up * drop.offsetY);
                Quaternion dropRot = surfaceBaseRot * Quaternion.Euler(0f, 0f, drop.rotZ);

                GameObject dropObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                dropObj.name = $"Palmette_BottomDrop_{i}";
                SetupPart(dropObj, ornamentRoot.transform, dropPos, dropRot.eulerAngles, new Vector3(drop.width, drop.length, 0.038f * S), drop.mat);
            }

            // 5. 상단 크라운 아치 (Upper Crown Leaves)
            // - 중심점 상단으로 부드럽게 퍼지는 3갈래의 상단 잎사귀
            var crownLeaves = new (float rotZ, float length, float width, Material mat)[]
            {
                (   0f, 0.26f * S, 0.060f * S, silverMat ), // 중앙 상단 팁
                ( -28f, 0.22f * S, 0.050f * S, silverMat ), // 좌상단 팁
                (  28f, 0.22f * S, 0.050f * S, silverMat )  // 우상단 팁
            };

            for (int i = 0; i < crownLeaves.Length; i++)
            {
                var crown = crownLeaves[i];
                Quaternion crownRot = surfaceBaseRot * Quaternion.Euler(0f, 0f, crown.rotZ);
                Vector3 crownPos = centerPos + (crownRot * Vector3.up * (crown.length * 0.45f));

                GameObject crownObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                crownObj.name = $"Palmette_UpperCrown_{i}";
                SetupPart(crownObj, ornamentRoot.transform, crownPos, crownRot.eulerAngles, new Vector3(crown.width, crown.length, 0.032f * S), crown.mat);
            }
        }

        private static Mesh BuildTorusRingMesh(float mainRadius, float tubeRadius, int segRadial = 48, int segTube = 8)
        {
            Mesh mesh = new() { name = "Procedural_Torus_Ring" };
            int vertCount = (segRadial + 1) * (segTube + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];
            int[] triangles = new int[segRadial * segTube * 6];

            for (int r = 0; r <= segRadial; r++)
            {
                float theta = (float)r / segRadial * Mathf.PI * 2f;
                float cosTheta = Mathf.Cos(theta);
                float sinTheta = Mathf.Sin(theta);
                Vector3 centerOnRing = new(cosTheta * mainRadius, sinTheta * mainRadius, 0f);

                for (int t = 0; t <= segTube; t++)
                {
                    float phi = (float)t / segTube * Mathf.PI * 2f;
                    float cosPhi = Mathf.Cos(phi);
                    float sinPhi = Mathf.Sin(phi);

                    Vector3 tubeNormal = new(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi);
                    int idx = r * (segTube + 1) + t;
                    vertices[idx] = centerOnRing + tubeNormal * tubeRadius;
                    normals[idx] = tubeNormal;
                    uvs[idx] = new Vector2((float)r / segRadial, (float)t / segTube);
                }
            }

            int triIdx = 0;
            for (int r = 0; r < segRadial; r++)
            {
                for (int t = 0; t < segTube; t++)
                {
                    int current = r * (segTube + 1) + t;
                    int next = (r + 1) * (segTube + 1) + t;

                    triangles[triIdx++] = current;
                    triangles[triIdx++] = next;
                    triangles[triIdx++] = current + 1;

                    triangles[triIdx++] = current + 1;
                    triangles[triIdx++] = next;
                    triangles[triIdx++] = next + 1;
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
        /// 임의 경로(Vector3 배열) 위를 따라 달리는 3D 튜브 메쉬 생성 (Parallel Transport 프레임)
        /// </summary>
        private static Mesh BuildPathTubeMesh(Vector3[] path, float tubeRadius, int tubeSeg)
        {
            int n = path.Length;
            var verts = new List<Vector3>(n * (tubeSeg + 1));
            var norms = new List<Vector3>(n * (tubeSeg + 1));
            var uvs   = new List<Vector2>(n * (tubeSeg + 1));
            var tris  = new List<int>((n - 1) * tubeSeg * 6);

            // 접선 계산
            Vector3[] tangents = new Vector3[n];
            for (int i = 0; i < n; i++)
            {
                if      (i == 0)     tangents[i] = (path[1] - path[0]).normalized;
                else if (i == n - 1) tangents[i] = (path[n - 1] - path[n - 2]).normalized;
                else                 tangents[i] = (path[i + 1] - path[i - 1]).normalized;
            }

            // Parallel Transport: 초기 법선 벡터 설정
            Vector3 initNorm = Vector3.Cross(tangents[0], Vector3.up);
            if (initNorm.sqrMagnitude < 0.001f)
                initNorm = Vector3.Cross(tangents[0], Vector3.right);
            initNorm = initNorm.normalized;

            Vector3[] frameN = new Vector3[n];
            frameN[0] = initNorm;
            for (int i = 1; i < n; i++)
            {
                Vector3 c = Vector3.Cross(tangents[i - 1], tangents[i]);
                if (c.sqrMagnitude < 0.0001f)
                {
                    frameN[i] = frameN[i - 1];
                }
                else
                {
                    float angle = Mathf.Asin(Mathf.Clamp(c.magnitude, 0f, 1f)) * Mathf.Rad2Deg;
                    frameN[i] = Quaternion.AngleAxis(angle, c.normalized) * frameN[i - 1];
                }
            }

            // 버텍스 생성
            for (int i = 0; i < n; i++)
            {
                float   u = (float)i / (n - 1);
                Vector3 T = tangents[i];
                Vector3 N = frameN[i].normalized;
                Vector3 B = Vector3.Cross(T, N).normalized;

                for (int j = 0; j <= tubeSeg; j++)
                {
                    float   a   = (float)j / tubeSeg * Mathf.PI * 2f;
                    Vector3 dir = N * Mathf.Cos(a) + B * Mathf.Sin(a);
                    verts.Add(path[i] + dir * tubeRadius);
                    norms.Add(dir);
                    uvs.Add(new Vector2(u, (float)j / tubeSeg));
                }
            }

            // 트라이앵글 생성
            int ring = tubeSeg + 1;
            for (int i = 0; i < n - 1; i++)
            {
                for (int j = 0; j < tubeSeg; j++)
                {
                    int a = i * ring + j,  b = a + 1;
                    int c2 = (i + 1) * ring + j, d = c2 + 1;
                    tris.AddRange(new[] { a, c2, b, b, c2, d });
                }
            }

            Mesh mesh = new() { name = "Procedural_Path_Tube" };
            mesh.SetVertices(verts);
            mesh.SetNormals(norms);
            mesh.SetTriangles(tris, 0);
            mesh.SetUVs(0, uvs);
            mesh.RecalculateBounds();
            return mesh;
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
                if (Application.isPlaying) mr.material = mat;
                else mr.sharedMaterial = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }
    }
}
