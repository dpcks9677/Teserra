using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 테이블 좌측에 배치되는 3D 스타일라이즈드 스톤 카드 트레이 (Augment Card Stone Tray)
    /// - 3개 카드 슬롯(Slot 0, 1, 2)의 넉넉한 원래 크기(Full Size) 100% 유지
    /// - 4개 외곽 모서리에 풍성하고 둥근 3D 원형 코너 보스 기둥 (Exterior Round Boss Pillars)
    /// - 카탄 트레이 형태의 세로 3구 오목 슬롯(Recessed Wells) 및 9시 방향 외벽 관통 개방형 라운드 노치 스쿱
    /// - 상/하단 크라운 아치 및 우측 스캘럽 곡률 조형
    /// - 하스스톤 보드 외곽 스타일의 따뜻한 웜 샌드스톤/에이지드 슬레이트 룩앤필
    /// </summary>
    public sealed class AugmentCardTray : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("Tray Dimensions")]
        [SerializeField] private float trayWidth = 5.06f;           // 우측 족보(5.06f)와 동일한 기본 가로 폭
        [SerializeField] private float trayHeight = 8.625f;         // 우측 족보(8.625f)와 동일한 기본 세로 높이
        [SerializeField] private float baseThickness = 0.08f;       // 최하단 베이스 플레이트 두께
        [SerializeField] private float wallHeight = 0.16f;          // 외곽 벽 및 격벽 높이
        [SerializeField] private float wallThickness = 0.24f;       // 4방향 균일 외곽 테두리 두께
        [SerializeField] private float dividerThickness = 0.20f;    // 슬롯 간 분할 격벽 두께
        [SerializeField] private float cornerRadius = 0.24f;        // 코너 원형 보스 기둥 반경

        [Header("Slot Configuration")]
        [SerializeField] private int slotCount = 3;
        [SerializeField] private float notchGapZ = 0.82f;           // 핑거 노치 개구부 세로 폭

        private readonly Transform[] slotAnchors = new Transform[3];

        public int SlotCount => slotCount;

        public static AugmentCardTray Create(Transform parent, Vector3 worldPosition, Vector3? scale = null)
        {
            GameObject root = new("3D Stone Augment Card Tray");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            AugmentCardTray comp = root.AddComponent<AugmentCardTray>();
            comp.BuildGeometry();
            return comp;
        }

        public Transform GetSlotAnchor(int slotIndex)
        {
            if (slotIndex >= 0 && slotIndex < slotAnchors.Length)
            {
                return slotAnchors[slotIndex];
            }
            return null;
        }

        public void BuildGeometry()
        {
            while (transform.childCount > 0)
            {
                Transform child = transform.GetChild(0);
                if (Application.isPlaying) Destroy(child.gameObject);
                else DestroyImmediate(child.gameObject);
            }

            Shader litShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            // 1. 하스스톤 스타일 웜 스톤 머티리얼 구성
            // 1-1. 메인 샌드스톤 프레임 바디 (Warm Sandstone)
            Color stoneMainColor = new Color(0.62f, 0.58f, 0.52f); // #9e9484
            Material stoneMainMat = new(litShader)
            {
                name = "Stone Tray Main Material",
                color = stoneMainColor
            };
            if (stoneMainMat.HasProperty("_BaseColor")) stoneMainMat.SetColor("_BaseColor", stoneMainColor);
            if (stoneMainMat.HasProperty("_Color")) stoneMainMat.SetColor("_Color", stoneMainColor);
            stoneMainMat.SetFloat("_Smoothness", 0.24f);
            stoneMainMat.SetFloat("_Metallic", 0.04f);

            // 1-2. 오목한 슬롯 베드 (Shadowed Inset Stone Bed)
            Color stoneDarkColor = new Color(0.35f, 0.31f, 0.26f); // #594f42
            Material stoneDarkMat = new(litShader)
            {
                name = "Stone Tray Dark Inset Material",
                color = stoneDarkColor
            };
            if (stoneDarkMat.HasProperty("_BaseColor")) stoneDarkMat.SetColor("_BaseColor", stoneDarkColor);
            if (stoneDarkMat.HasProperty("_Color")) stoneDarkMat.SetColor("_Color", stoneDarkColor);
            stoneDarkMat.SetFloat("_Smoothness", 0.18f);
            stoneDarkMat.SetFloat("_Metallic", 0.02f);

            // 1-3. 베드보다 더 진한 깊은 음영 인셋 라인 (Deep Dark Carved Inset)
            Color stoneDeepInsetColor = new Color(0.19f, 0.16f, 0.13f); // #302921
            Material stoneDeepInsetMat = new(litShader)
            {
                name = "Stone Tray Deep Dark Inset Material",
                color = stoneDeepInsetColor
            };
            if (stoneDeepInsetMat.HasProperty("_BaseColor")) stoneDeepInsetMat.SetColor("_BaseColor", stoneDeepInsetColor);
            if (stoneDeepInsetMat.HasProperty("_Color")) stoneDeepInsetMat.SetColor("_Color", stoneDeepInsetColor);
            stoneDeepInsetMat.SetFloat("_Smoothness", 0.14f);
            stoneDeepInsetMat.SetFloat("_Metallic", 0.02f);

            // 1-4. 챔퍼 테두리 & 상단 림 하이라이트 (Stone Highlight Rim)
            Color stoneHighlightColor = new Color(0.72f, 0.67f, 0.60f); // #b8ab99
            Material stoneHighlightMat = new(litShader)
            {
                name = "Stone Tray Highlight Material",
                color = stoneHighlightColor
            };
            if (stoneHighlightMat.HasProperty("_BaseColor")) stoneHighlightMat.SetColor("_BaseColor", stoneHighlightColor);
            if (stoneHighlightMat.HasProperty("_Color")) stoneHighlightMat.SetColor("_Color", stoneHighlightColor);
            stoneHighlightMat.SetFloat("_Smoothness", 0.32f);
            stoneHighlightMat.SetFloat("_Metallic", 0.06f);

            // 1-5. 최하단 그림자 베이스 트림 (Deep Aged Slate)
            Color stoneBaseRimColor = new Color(0.21f, 0.19f, 0.16f); // #363028
            Material stoneBaseRimMat = new(litShader)
            {
                name = "Stone Tray Base Rim Material",
                color = stoneBaseRimColor
            };
            if (stoneBaseRimMat.HasProperty("_BaseColor")) stoneBaseRimMat.SetColor("_BaseColor", stoneBaseRimColor);
            if (stoneBaseRimMat.HasProperty("_Color")) stoneBaseRimMat.SetColor("_Color", stoneBaseRimColor);
            stoneBaseRimMat.SetFloat("_Smoothness", 0.15f);
            stoneBaseRimMat.SetFloat("_Metallic", 0.02f);

            // 2. 기본 바닥 및 원래 크기 슬롯 공간 계산 (100% 원래 넉넉한 슬롯 크기 보존)
            float insideH = trayHeight - (wallThickness * 2f);
            float totalDividersH = dividerThickness * (slotCount - 1);
            float slotH = (insideH - totalDividersH) / slotCount; // 원래 넉넉한 높이 (~2.58f)
            float slotW = trayWidth - (wallThickness * 2f);       // 원래 넉넉한 폭 (~4.58f)
            float startZ = (trayHeight * 0.5f) - wallThickness - (slotH * 0.5f);

            float wallCenterY = baseThickness + wallHeight * 0.5f;
            float rimThickness = 0.06f;
            float rimY = baseThickness + wallHeight + 0.008f;
            float rimH = 0.016f;

            // 2-1. 최하단 확장 쉐도우 베이스 플레이트
            GameObject basePlate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            basePlate.name = "Stone_BasePlate";
            SetupPart(basePlate, transform, new Vector3(0f, -baseThickness * 0.5f, 0f), Vector3.zero,
                new Vector3(trayWidth + 0.18f, baseThickness, trayHeight + 0.18f), stoneBaseRimMat);

            // 2-2. 슬롯 내부 전체 바닥 베이스
            GameObject floorPlate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floorPlate.name = "Stone_FloorPlate";
            SetupPart(floorPlate, transform, new Vector3(0f, baseThickness * 0.5f, 0f), Vector3.zero,
                new Vector3(trayWidth, baseThickness, trayHeight), stoneDarkMat);

            // 2-3. 4개 외곽 모서리 3D 원형 코너 보스 기둥 (슬롯 크기를 축소시키지 않고 외곽으로 돌출 조형)
            float cornerBaseX = trayWidth * 0.5f - wallThickness * 0.5f;
            float cornerBaseZ = trayHeight * 0.5f - wallThickness * 0.5f;
            float cornerBossX = trayWidth * 0.5f - cornerRadius * 0.7f;
            float cornerBossZ = trayHeight * 0.5f - cornerRadius * 0.7f;

            (float sx, float sz, string name)[] cornerSigns = new[]
            {
                (1f, 1f, "TopRight"),
                (-1f, 1f, "TopLeft"),
                (1f, -1f, "BottomRight"),
                (-1f, -1f, "BottomLeft")
            };

            for (int c = 0; c < 4; c++)
            {
                // A. 코너 솔리드 베이스 큐브 (안쪽 면은 슬롯 경계선과 완벽 일치하여 슬롯 공간 100% 확보)
                Vector3 basePos = new(cornerSigns[c].sx * cornerBaseX, wallCenterY, cornerSigns[c].sz * cornerBaseZ);
                GameObject cornerCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cornerCube.name = $"Corner_BaseCube_{cornerSigns[c].name}";
                SetupPart(cornerCube, transform, basePos, Vector3.zero,
                    new Vector3(wallThickness, wallHeight, wallThickness), stoneMainMat);

                // B. 외곽 원형 실린더 코너 보스 기둥 (바깥 모서리에 풍성한 원형 볼륨 형성)
                Vector3 bossPos = new(cornerSigns[c].sx * cornerBossX, wallCenterY, cornerSigns[c].sz * cornerBossZ);
                GameObject cornerPillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                cornerPillar.name = $"Corner_BossPillar_{cornerSigns[c].name}";
                SetupPart(cornerPillar, transform, bossPos, Vector3.zero,
                    new Vector3(cornerRadius * 2f, wallHeight * 0.5f, cornerRadius * 2f), stoneMainMat);

                // C. 코너 상단 원형 하이라이트 림 캡
                GameObject cornerRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                cornerRim.name = $"Corner_BossRim_{cornerSigns[c].name}";
                SetupPart(cornerRim, transform, new Vector3(bossPos.x, rimY, bossPos.z), Vector3.zero,
                    new Vector3(cornerRadius * 2.05f, rimH * 0.5f, cornerRadius * 2.05f), stoneHighlightMat);

                // D. 코너 하단 베이스 원형 링
                GameObject cornerBaseRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                cornerBaseRing.name = $"Corner_BossBase_{cornerSigns[c].name}";
                SetupPart(cornerBaseRing, transform, new Vector3(bossPos.x, -baseThickness * 0.5f, bossPos.z), Vector3.zero,
                    new Vector3(cornerRadius * 2.3f, baseThickness * 0.5f, cornerRadius * 2.3f), stoneBaseRimMat);
            }

            // 2-4. 우측 / 상단 / 하단 외벽
            float innerSpanZ = trayHeight - wallThickness * 2f;
            float innerSpanX = trayWidth - wallThickness * 2f;

            // 우측 외벽
            GameObject wallR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wallR.name = "OuterWall_Right";
            SetupPart(wallR, transform, new Vector3(trayWidth * 0.5f - wallThickness * 0.5f, wallCenterY, 0f), Vector3.zero,
                new Vector3(wallThickness, wallHeight, innerSpanZ), stoneMainMat);

            // 우측 외벽 3구 스캘럽 돌출 곡률 액센트
            for (int s = 0; s < slotCount; s++)
            {
                float scallopZ = startZ - s * (slotH + dividerThickness);
                GameObject scallopObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                scallopObj.name = $"OuterWall_Right_Scallop_{s}";
                SetupPart(scallopObj, transform, new Vector3(trayWidth * 0.5f - 0.04f, wallCenterY, scallopZ), Vector3.zero,
                    new Vector3(0.18f, wallHeight * 0.5f, 0.70f), stoneHighlightMat);
            }

            // 상단 외벽
            GameObject wallT = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wallT.name = "OuterWall_Top";
            SetupPart(wallT, transform, new Vector3(0f, wallCenterY, trayHeight * 0.5f - wallThickness * 0.5f), Vector3.zero,
                new Vector3(innerSpanX, wallHeight, wallThickness), stoneMainMat);

            // 상단 아치형 크라운 림
            GameObject crownTop = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            crownTop.name = "Crown_Top_Curvature";
            SetupPart(crownTop, transform, new Vector3(0f, wallCenterY + 0.01f, trayHeight * 0.5f - 0.04f), new Vector3(90f, 0f, 0f),
                new Vector3(2.4f, 0.12f, 0.16f), stoneHighlightMat);

            // 하단 외벽
            GameObject wallB = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wallB.name = "OuterWall_Bottom";
            SetupPart(wallB, transform, new Vector3(0f, wallCenterY, -trayHeight * 0.5f + wallThickness * 0.5f), Vector3.zero,
                new Vector3(innerSpanX, wallHeight, wallThickness), stoneMainMat);

            // 하단 아치형 크라운 림
            GameObject crownBottom = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            crownBottom.name = "Crown_Bottom_Curvature";
            SetupPart(crownBottom, transform, new Vector3(0f, wallCenterY + 0.01f, -trayHeight * 0.5f + 0.04f), new Vector3(90f, 0f, 0f),
                new Vector3(2.4f, 0.12f, 0.16f), stoneHighlightMat);

            // 우측 상단 림 하이라이트
            GameObject rimR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rimR.name = "Rim_Right";
            SetupPart(rimR, transform, new Vector3(trayWidth * 0.5f - rimThickness * 0.5f, rimY, 0f), Vector3.zero,
                new Vector3(rimThickness, rimH, innerSpanZ), stoneHighlightMat);

            // 상/하단 상단 림 하이라이트
            GameObject rimT = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rimT.name = "Rim_Top";
            SetupPart(rimT, transform, new Vector3(0f, rimY, trayHeight * 0.5f - rimThickness * 0.5f), Vector3.zero,
                new Vector3(innerSpanX, rimH, rimThickness), stoneHighlightMat);

            GameObject rimB = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rimB.name = "Rim_Bottom";
            SetupPart(rimB, transform, new Vector3(0f, rimY, -trayHeight * 0.5f + rimThickness * 0.5f), Vector3.zero,
                new Vector3(innerSpanX, rimH, rimThickness), stoneHighlightMat);

            // 2-5. 좌측 외벽 (9시 방향 핑거 노치 3개소를 관통하여 깎아낸 4개 기둥 세그먼트)
            float halfGap = notchGapZ * 0.5f;
            float wallX = -trayWidth * 0.5f + wallThickness * 0.5f;
            float rimX = -trayWidth * 0.5f + rimThickness * 0.5f;

            float p0_min = startZ + halfGap;
            float p0_max = trayHeight * 0.5f - wallThickness;
            BuildLeftWallSegment("Pillar_TopCorner", wallX, rimX, wallCenterY, rimY, wallThickness, wallHeight, rimThickness, rimH, p0_min, p0_max, stoneMainMat, stoneHighlightMat);

            float p1_min = 0f + halfGap;
            float p1_max = startZ - halfGap;
            BuildLeftWallSegment("Pillar_UpperMid", wallX, rimX, wallCenterY, rimY, wallThickness, wallHeight, rimThickness, rimH, p1_min, p1_max, stoneMainMat, stoneHighlightMat);

            float p2_min = -startZ + halfGap;
            float p2_max = 0f - halfGap;
            BuildLeftWallSegment("Pillar_LowerMid", wallX, rimX, wallCenterY, rimY, wallThickness, wallHeight, rimThickness, rimH, p2_min, p2_max, stoneMainMat, stoneHighlightMat);

            float p3_min = -trayHeight * 0.5f + wallThickness;
            float p3_max = -startZ - halfGap;
            BuildLeftWallSegment("Pillar_BottomCorner", wallX, rimX, wallCenterY, rimY, wallThickness, wallHeight, rimThickness, rimH, p3_min, p3_max, stoneMainMat, stoneHighlightMat);

            // 3. 3개 슬롯(Slot 0, 1, 2) 모듈 생성 및 외벽 관통형 핑거 노치 스쿱 (Full Original Slot Size)
            for (int i = 0; i < slotCount; i++)
            {
                float slotCenterZ = startZ - i * (slotH + dividerThickness);

                // 3-1. 슬롯 그룹 루트 (모듈화)
                GameObject slotGroup = new($"Slot_{i}_Group");
                slotGroup.layer = DecorationLayer;
                slotGroup.transform.SetParent(transform, false);
                slotGroup.transform.localPosition = new Vector3(0f, 0f, slotCenterZ);

                // 3-2. 슬롯 오목 바닥면 (넉넉한 원래 크기 카드 베드)
                GameObject slotBed = GameObject.CreatePrimitive(PrimitiveType.Cube);
                slotBed.name = $"CardSlot_{i}_Bed";
                SetupPart(slotBed, slotGroup.transform, new Vector3(0f, baseThickness + 0.015f, 0f), Vector3.zero,
                    new Vector3(slotW - 0.08f, 0.03f, slotH - 0.08f), stoneDarkMat);

                // 3-3. 슬롯 내부 정밀 인셋 프레임 (Bed보다 더 짙은 어두운 음영 컬러 적용)
                GameObject insetAccent = GameObject.CreatePrimitive(PrimitiveType.Cube);
                insetAccent.name = $"CardSlot_{i}_InsetAccent";
                SetupPart(insetAccent, slotGroup.transform, new Vector3(0f, baseThickness + 0.032f, 0f), Vector3.zero,
                    new Vector3(slotW - 0.28f, 0.012f, slotH - 0.28f), stoneDeepInsetMat);

                // 3-4. 9시 방향 외벽 관통 개방형 핑거 노치 스쿱 (Open Finger Scoop Channel)
                float channelW = wallThickness + 0.42f;
                float channelX = -trayWidth * 0.5f + channelW * 0.5f;
                GameObject scoopChannel = GameObject.CreatePrimitive(PrimitiveType.Cube);
                scoopChannel.name = $"CardSlot_{i}_ScoopChannel";
                SetupPart(scoopChannel, slotGroup.transform, new Vector3(channelX, baseThickness + 0.018f, 0f), Vector3.zero,
                    new Vector3(channelW, 0.032f, notchGapZ), stoneDeepInsetMat);

                // 안쪽 부드러운 라운드 실린더 스쿱
                float scoopRadiusX = 0.58f;
                float scoopRadiusZ = notchGapZ;
                GameObject cylinderScoop = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                cylinderScoop.name = $"CardSlot_{i}_CylinderScoop";
                SetupPart(cylinderScoop, slotGroup.transform, new Vector3(-slotW * 0.5f + 0.18f, baseThickness + 0.024f, 0f), Vector3.zero,
                    new Vector3(scoopRadiusX, 0.024f, scoopRadiusZ), stoneDeepInsetMat);

                // 깎여 나간 외벽 입구 상/하 챔퍼 마감
                GameObject flairTop = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                flairTop.name = $"CardSlot_{i}_EntranceFlair_Top";
                SetupPart(flairTop, slotGroup.transform, new Vector3(-trayWidth * 0.5f + wallThickness * 0.5f, baseThickness + wallHeight * 0.5f, halfGap), Vector3.zero,
                    new Vector3(wallThickness * 0.95f, wallHeight * 0.5f, wallThickness * 0.95f), stoneMainMat);

                GameObject flairBottom = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                flairBottom.name = $"CardSlot_{i}_EntranceFlair_Bottom";
                SetupPart(flairBottom, slotGroup.transform, new Vector3(-trayWidth * 0.5f + wallThickness * 0.5f, baseThickness + wallHeight * 0.5f, -halfGap), Vector3.zero,
                    new Vector3(wallThickness * 0.95f, wallHeight * 0.5f, wallThickness * 0.95f), stoneMainMat);

                // 입구 상단 림 캡
                GameObject rimCapTop = GameObject.CreatePrimitive(PrimitiveType.Cube);
                rimCapTop.name = $"CardSlot_{i}_RimCap_Top";
                SetupPart(rimCapTop, slotGroup.transform, new Vector3(rimX, rimY, halfGap + 0.03f), Vector3.zero,
                    new Vector3(rimThickness, rimH, 0.06f), stoneHighlightMat);

                GameObject rimCapBottom = GameObject.CreatePrimitive(PrimitiveType.Cube);
                rimCapBottom.name = $"CardSlot_{i}_RimCap_Bottom";
                SetupPart(rimCapBottom, slotGroup.transform, new Vector3(rimX, rimY, -halfGap - 0.03f), Vector3.zero,
                    new Vector3(rimThickness, rimH, 0.06f), stoneHighlightMat);

                // 3-5. 카드 안착용 3D 앵커 Transform
                GameObject anchorObj = new($"CardSlot_{i}_Anchor");
                anchorObj.transform.SetParent(slotGroup.transform, false);
                anchorObj.transform.localPosition = new Vector3(0f, baseThickness + 0.06f, 0f);
                slotAnchors[i] = anchorObj.transform;

                // 3-6. 슬롯 간 분할 격벽 (Divider Bar)
                if (i < slotCount - 1)
                {
                    float dividerZ = slotCenterZ - (slotH * 0.5f) - (dividerThickness * 0.5f);

                    GameObject divider = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    divider.name = $"Divider_{i}_{i + 1}";
                    SetupPart(divider, transform, new Vector3(0f, wallCenterY, dividerZ), Vector3.zero,
                        new Vector3(slotW, wallHeight, dividerThickness), stoneMainMat);

                    // 격벽 상단 하이라이트 림
                    GameObject dividerRim = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    dividerRim.name = $"DividerRim_{i}_{i + 1}";
                    SetupPart(dividerRim, transform, new Vector3(0f, rimY, dividerZ), Vector3.zero,
                        new Vector3(slotW, rimH, dividerThickness * 0.6f), stoneHighlightMat);
                }
            }
        }

        private void BuildLeftWallSegment(string name, float wallX, float rimX, float wallY, float rimY,
            float wallThickness, float wallHeight, float rimThickness, float rimH,
            float zMin, float zMax, Material wallMat, Material rimMat)
        {
            float length = zMax - zMin;
            if (length <= 0.001f) return;
            float centerZ = (zMin + zMax) * 0.5f;

            GameObject wallSegment = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wallSegment.name = $"OuterWall_Left_{name}";
            SetupPart(wallSegment, transform, new Vector3(wallX, wallY, centerZ), Vector3.zero,
                new Vector3(wallThickness, wallHeight, length), wallMat);

            GameObject rimSegment = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rimSegment.name = $"Rim_Left_{name}";
            SetupPart(rimSegment, transform, new Vector3(rimX, rimY, centerZ), Vector3.zero,
                new Vector3(rimThickness, rimH, length), rimMat);
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
