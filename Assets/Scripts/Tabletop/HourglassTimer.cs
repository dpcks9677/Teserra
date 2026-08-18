using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 주사위 트레이 상단에 배치되는 3D 스타일라이즈드 앤틱 모래시계 1분 타이머 오브젝트
    /// - 정원형(Circular) 바닥 베이스를 가진 테이블 직교 고정 짐벌 스탠드 (Upright Gimbal Stand)
    /// - 피벗 힌지 중심(Y=1.30f)에서 40도 기본 각도로 거치된 독립 틸트 모래시계 본체 (Hourglass_RotatingBody)
    /// - 계단식 단차로 Z-fighting이 완벽히 방지된 앤틱 브론즈 캡 & 짐벌 베이스 플레이트
    /// - 유리 내부의 물방울 곡면 형상과 완벽히 일치하는 부드러운 곡면 돔(Sphere) 모래 지오메트리
    /// - 턴 시작 시 부드러운 180도 플립(Flip) 애니메이션 (0.55초 SmoothStep) 및 상/하단 모래 자동 스왑
    /// </summary>
    public sealed class HourglassTimer : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("Timer Settings")]
        [SerializeField] private float defaultDuration = 60.0f;
        [SerializeField] private float remainingTime = 60.0f;
        [SerializeField] private bool isRunning;
        [SerializeField] private bool isFlipping;

        [Header("Visual References")]
        private Transform bodyRoot;
        private Transform upperSandTransform;
        private Transform lowerSandTransform;
        private Transform sandStreamTransform;
        private Material sandMaterial;
        private Material sandStreamMaterial;
        private Material glassMaterial;
        private Material bronzeMainMaterial;
        private Material bronzeDarkMaterial;
        private Material goldTrimMaterial;
        private Material royalVioletMaterial;

        private int flipCount;

        // 피벗 높이 및 기본 카메라 대면 틸트 각도 (40도 기본 거치)
        private const float PivotHeight = 1.30f;
        private const float DefaultBodyPitch = 40.0f;

        // 곡면 모래 기본 스케일 및 오프셋 기준치 (유리 내벽 곡선에 꽉 차는 볼륨)
        private const float UpperSandBaseY = 0.50f;
        private const float LowerSandBaseY = -0.50f;
        private const float SandStreamBaseHeight = 1.15f;

        // 컬러 팔레트 (레퍼런스 이미지 기반)
        private readonly Color bronzeBaseColor = new(0.48f, 0.34f, 0.17f);
        private readonly Color bronzeDarkColor = new(0.32f, 0.22f, 0.10f);
        private readonly Color goldTrimColor = new(0.85f, 0.66f, 0.28f);
        private readonly Color royalVioletColor = new(0.34f, 0.10f, 0.32f);
        private readonly Color glassColor = new(0.80f, 0.88f, 0.96f, 0.26f);
        private readonly Color sandBaseColor = new(0.96f, 0.88f, 0.65f); // 웜 바닐라 크림 골드
        private readonly Color sandEmissionNormal = new(0.20f, 0.16f, 0.06f);
        private readonly Color sandEmissionWarning = new(0.85f, 0.30f, 0.05f);

        // 이벤트 콜백
        public event Action OnTimerStarted;
        public event Action<float, float> OnTimerTick; // (remaining, total)
        public event Action OnTimerExpired;

        public float RemainingTime => remainingTime;
        public float TotalDuration => defaultDuration;
        public bool IsRunning => isRunning;
        public bool IsFlipping => isFlipping;

        public static HourglassTimer Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Hourglass Timer");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;

            // 바닥과 완벽히 직교/수평을 이루는 기본 로테이션 (Yaw -40도)
            Quaternion defaultRot = Quaternion.Euler(0f, -40f, 0f);
            root.transform.rotation = rotation ?? defaultRot;
            root.transform.localScale = scale ?? (Vector3.one * 0.95f);

            HourglassTimer timer = root.AddComponent<HourglassTimer>();
            timer.BuildGeometry();
            return timer;
        }

        private void Awake()
        {
            if (bodyRoot == null)
            {
                BuildGeometry();
            }
        }

        private void Update()
        {
            if (isFlipping) return;

            if (isRunning)
            {
                remainingTime -= Time.deltaTime;
                float progress = Mathf.Clamp01(remainingTime / defaultDuration); // 1.0 (시작) -> 0.0 (종료)

                UpdateSandVisuals(progress);
                OnTimerTick?.Invoke(Mathf.Max(0f, remainingTime), defaultDuration);

                // 남은 시간 10초 이하 경고 펄스
                if (remainingTime <= 10f && remainingTime > 0f)
                {
                    float pulse = (Mathf.Sin(Time.time * 8.0f) + 1.0f) * 0.5f;
                    Color alertEmission = Color.Lerp(sandEmissionNormal, sandEmissionWarning, pulse);
                    if (sandMaterial != null) sandMaterial.SetColor("_EmissionColor", alertEmission);
                    if (sandStreamMaterial != null) sandStreamMaterial.SetColor("_EmissionColor", alertEmission * 1.6f);
                }

                if (remainingTime <= 0f)
                {
                    remainingTime = 0f;
                    isRunning = false;
                    UpdateSandVisuals(0f);
                    OnTimerExpired?.Invoke();
                }
            }
        }

        /// <summary>
        /// 180도 플립 애니메이션과 함께 60초 타이머를 시작합니다.
        /// </summary>
        public void StartTimer(float duration = 60f, bool animateFlip = true)
        {
            defaultDuration = Mathf.Max(1f, duration);
            remainingTime = defaultDuration;

            if (sandMaterial != null)
            {
                sandMaterial.SetColor("_EmissionColor", sandEmissionNormal);
            }
            if (sandStreamMaterial != null)
            {
                sandStreamMaterial.SetColor("_EmissionColor", sandEmissionNormal * 1.4f);
            }

            if (animateFlip && gameObject.activeInHierarchy)
            {
                StartCoroutine(FlipAndStartRoutine());
            }
            else
            {
                isRunning = true;
                UpdateSandVisuals(1.0f);
                OnTimerStarted?.Invoke();
            }
        }

        public void PauseTimer()
        {
            isRunning = false;
            if (sandStreamTransform != null) sandStreamTransform.gameObject.SetActive(false);
        }

        public void ResumeTimer()
        {
            if (remainingTime > 0f)
            {
                isRunning = true;
                if (sandStreamTransform != null) sandStreamTransform.gameObject.SetActive(true);
            }
        }

        public void StopTimer()
        {
            isRunning = false;
            if (sandStreamTransform != null) sandStreamTransform.gameObject.SetActive(false);
        }

        public void ResetTimer(float duration = 60f)
        {
            StopTimer();
            defaultDuration = duration;
            remainingTime = duration;
            UpdateSandVisuals(1.0f);
        }

        private IEnumerator FlipAndStartRoutine()
        {
            isFlipping = true;
            isRunning = false;

            if (sandStreamTransform != null) sandStreamTransform.gameObject.SetActive(false);

            flipCount++;
            float startPitch = DefaultBodyPitch + (flipCount - 1) * 180f;
            float targetPitch = DefaultBodyPitch + flipCount * 180f;

            float duration = 0.55f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / duration);
                float currentPitch = Mathf.Lerp(startPitch, targetPitch, t);

                if (bodyRoot != null)
                {
                    // 짐벌의 좌우 피벗 핀(Local X축)을 중심으로 정확히 180도 회전
                    bodyRoot.localRotation = Quaternion.Euler(currentPitch, 0f, 0f);
                }
                yield return null;
            }

            if (bodyRoot != null)
            {
                bodyRoot.localRotation = Quaternion.Euler(targetPitch, 0f, 0f);
            }

            // 모래시계 회전 완료 직후 1.0f 상태(위쪽 꽉 참)로 0.5초 대기 (모래가 바로 떨어지지 않고 여유를 둠)
            UpdateSandVisuals(1.0f);
            yield return new WaitForSeconds(0.5f);

            isFlipping = false;
            isRunning = true;
            UpdateSandVisuals(1.0f);
            OnTimerStarted?.Invoke();
        }

        /// <summary>
        /// 남은 시간 비율 (1.0 -> 0.0)에 따라 유리 내벽 형상에 맞춘 곡면 모래 레벨을 실시간 업데이트합니다.
        /// (홀수/짝수 플립에 따라 상/하단 모래 역할을 자동 스왑)
        /// </summary>
        private void UpdateSandVisuals(float progress)
        {
            float clamped = Mathf.Clamp01(progress);

            // 플립 홀수/짝수에 따라 상/하단 역할 스왑
            bool isEvenFlip = (flipCount % 2 == 0);
            Transform sourceSand = isEvenFlip ? upperSandTransform : lowerSandTransform;
            Transform targetSand = isEvenFlip ? lowerSandTransform : upperSandTransform;

            float sourceBaseY = isEvenFlip ? UpperSandBaseY : LowerSandBaseY;
            float targetBaseY = isEvenFlip ? LowerSandBaseY : UpperSandBaseY;

            // 1. 배출되는 모래 (위쪽): 유리 내벽 곡면을 따라 부드러운 돔 형태로 아래로 수축
            if (sourceSand != null)
            {
                float radiusFactor = Mathf.Pow(clamped, 0.40f); // 유리 내벽 곡률에 맞춘 비선형 반경 보간
                float sourceHeight = Mathf.Max(0.01f, clamped * 0.84f);
                sourceSand.localScale = new Vector3(0.78f * radiusFactor, sourceHeight, 0.78f * radiusFactor);
                
                float yOffset = isEvenFlip ? -((1f - clamped) * 0.28f) : ((1f - clamped) * 0.28f);
                sourceSand.localPosition = new Vector3(0f, sourceBaseY + yOffset, 0f);
                sourceSand.gameObject.SetActive(clamped > 0.005f);
            }

            // 2. 쌓이는 모래 (아래쪽): 유리 바닥 돔을 메우며 부드러운 곡면 돔(Sphere)으로 솟아오름
            if (targetSand != null)
            {
                float fill = 1.0f - clamped;
                float radiusFactor = Mathf.Pow(fill, 0.40f);
                float targetHeight = Mathf.Max(0.01f, fill * 0.84f);
                targetSand.localScale = new Vector3(0.80f * radiusFactor, targetHeight, 0.80f * radiusFactor);
                
                float yOffset = isEvenFlip ? -((1f - fill) * 0.12f) : ((1f - fill) * 0.12f);
                targetSand.localPosition = new Vector3(0f, targetBaseY + yOffset, 0f);
                targetSand.gameObject.SetActive(fill > 0.005f);
            }

            // 3. 중앙 모래 낙하 스트림
            if (sandStreamTransform != null)
            {
                bool showStream = isRunning && clamped > 0.005f && clamped < 0.999f;
                sandStreamTransform.gameObject.SetActive(showStream);
                if (showStream)
                {
                    float streamPulse = 1.0f + Mathf.Sin(Time.time * 16f) * 0.15f;
                    sandStreamTransform.localScale = new Vector3(0.022f * streamPulse, SandStreamBaseHeight * 0.5f, 0.022f * streamPulse);
                }
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
            bronzeMainMaterial = CreateMaterial("Hourglass_BronzeMain", litShader, bronzeBaseColor, 0.76f, 0.48f);
            bronzeDarkMaterial = CreateMaterial("Hourglass_BronzeDark", litShader, bronzeDarkColor, 0.80f, 0.42f);
            goldTrimMaterial = CreateMaterial("Hourglass_GoldTrim", litShader, goldTrimColor, 0.88f, 0.68f);
            royalVioletMaterial = CreateMaterial("Hourglass_RoyalViolet", litShader, royalVioletColor, 0.12f, 0.56f);

            // 페일 프로스트 크리스탈 글래스 (투명 및 하이 스무스니스)
            glassMaterial = CreateTransparentMaterial("Hourglass_PaleGlass", litShader, glassColor, 0.08f, 0.97f);

            // 웜 바닐라 크림 골드 모래 머티리얼
            sandMaterial = CreateMaterial("Hourglass_CreamSand", litShader, sandBaseColor, 0.05f, 0.22f);
            sandMaterial.EnableKeyword("_EMISSION");
            sandMaterial.SetColor("_EmissionColor", sandEmissionNormal);

            sandStreamMaterial = CreateMaterial("Hourglass_SandStream", litShader, sandBaseColor * 1.12f, 0.05f, 0.20f);
            sandStreamMaterial.EnableKeyword("_EMISSION");
            sandStreamMaterial.SetColor("_EmissionColor", sandEmissionNormal * 1.4f);

            // 2. 바닥면과 완벽히 직교/수평을 이루는 정원형(Circular) 고정 짐벌 스탠드
            CreateGimbalStand(litShader);

            // 3. 180도 회전 가능한 모래시계 본체 (Hourglass Rotating Body - 피벗 중심 Y=1.30f, 기본 40도 틸트)
            GameObject bodyRootObj = new("Hourglass_RotatingBody");
            bodyRootObj.layer = DecorationLayer;
            bodyRootObj.transform.SetParent(transform, false);
            bodyRootObj.transform.localPosition = new Vector3(0f, PivotHeight, 0f); // 짐벌 피벗 높이에 정확히 정렬
            bodyRootObj.transform.localRotation = Quaternion.Euler(DefaultBodyPitch, 0f, 0f); // 40도 기본 카메라 대면 틸트
            bodyRoot = bodyRootObj.transform;

            // 3-1. 상단 다면체 앤틱 브론즈 캡 (Top Faceted Cap, Y = +1.10f)
            CreateFacetedCap(bodyRoot, 1.10f, true);

            // 3-2. 하단 다면체 앤틱 브론즈 캡 (Bottom Faceted Cap, Y = -1.10f)
            CreateFacetedCap(bodyRoot, -1.10f, false);

            // 3-3. 좌우 슬림 로열 바이올렛 윙 가드 (Left & Right Wings with Scrolls & Bands)
            CreateSlenderWing(bodyRoot, -0.52f, 1f);  // 좌측 윙
            CreateSlenderWing(bodyRoot, 0.52f, -1f); // 우측 윙

            // 3-4. 프레임에 꽉 차는 세로형 페일 프로스트 크리스탈 글래스 (Elongated Frost Glass Bulbs)
            // 상단 메인 유리구 (Upper Bulb)
            GameObject upperGlass = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            upperGlass.name = "Glass_UpperBulb";
            SetupPart(upperGlass, bodyRoot, new Vector3(0f, 0.50f, 0f), Vector3.zero, new Vector3(0.82f, 0.88f, 0.82f), glassMaterial);

            // 상단 캡 소켓 밀착 넥 링 (Upper Cap Seal)
            GameObject upperNeck = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            upperNeck.name = "Glass_UpperNeck";
            SetupPart(upperNeck, bodyRoot, new Vector3(0f, 0.96f, 0f), Vector3.zero, new Vector3(0.72f, 0.16f, 0.72f), glassMaterial);

            // 하단 메인 유리구 (Lower Bulb)
            GameObject lowerGlass = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            lowerGlass.name = "Glass_LowerBulb";
            SetupPart(lowerGlass, bodyRoot, new Vector3(0f, -0.50f, 0f), Vector3.zero, new Vector3(0.82f, 0.88f, 0.82f), glassMaterial);

            // 하단 캡 소켓 밀착 넥 링 (Lower Cap Seal)
            GameObject lowerNeck = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            lowerNeck.name = "Glass_LowerNeck";
            SetupPart(lowerNeck, bodyRoot, new Vector3(0f, -0.96f, 0f), Vector3.zero, new Vector3(0.72f, 0.16f, 0.72f), glassMaterial);

            // 중앙 잘록한 목 골드 링 (Narrow Neck / Waist)
            GameObject waistRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            waistRing.name = "Glass_WaistRing";
            SetupPart(waistRing, bodyRoot, Vector3.zero, Vector3.zero, new Vector3(0.18f, 0.025f, 0.18f), goldTrimMaterial);

            // 3-5. 유리 내벽 형상과 일치하는 맞춤형 곡면 돔(Sphere) 모래 지오메트리
            // 상단 모래 (Upper Sand - 둥근 돔 형상으로 유리 상단 내벽에 꼭 맞게 안착)
            GameObject upperSand = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            upperSand.name = "Sand_Upper";
            SetupPart(upperSand, bodyRoot, new Vector3(0f, UpperSandBaseY, 0f), Vector3.zero, new Vector3(0.78f, 0.84f, 0.78f), sandMaterial);
            upperSandTransform = upperSand.transform;

            // 하단 모래 (Lower Sand - 둥근 돔 형상으로 유리 바닥 내벽을 꽉 채우며 솟아오름)
            GameObject lowerSand = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            lowerSand.name = "Sand_Lower";
            SetupPart(lowerSand, bodyRoot, new Vector3(0f, LowerSandBaseY, 0f), Vector3.zero, new Vector3(0.80f, 0.02f, 0.80f), sandMaterial);
            lowerSandTransform = lowerSand.transform;

            // 중앙 낙하 스트림 (Sand Stream)
            GameObject stream = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            stream.name = "Sand_Stream";
            SetupPart(stream, bodyRoot, Vector3.zero, Vector3.zero, new Vector3(0.022f, SandStreamBaseHeight * 0.5f, 0.022f), sandStreamMaterial);
            sandStreamTransform = stream.transform;
            sandStreamTransform.gameObject.SetActive(false);

            // 초기 모래 상태 적용 (100% 가득 참)
            UpdateSandVisuals(1.0f);
        }

        /// <summary>
        /// 바닥면과 완벽히 직교/수평을 이루는 정원형(Circular) 고정 짐벌 스탠드 조형
        /// </summary>
        private void CreateGimbalStand(Shader shader)
        {
            GameObject standRoot = new("Gimbal_StationaryStand");
            standRoot.layer = DecorationLayer;
            standRoot.transform.SetParent(transform, false);
            standRoot.transform.localPosition = Vector3.zero;
            standRoot.transform.localRotation = Quaternion.identity; // 바닥면과 완벽히 평행

            // 1. 완벽한 정원형 묵직한 에이지드 브론즈 베이스 플레이트 (Base Pedestal - Y=0.04f 바닥면 안착, X=Z=1.68f)
            GameObject basePedestal = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            basePedestal.name = "Stand_BasePedestal";
            SetupPart(basePedestal, standRoot.transform, new Vector3(0f, 0.04f, 0f), Vector3.zero, new Vector3(1.68f, 0.04f, 1.68f), bronzeMainMaterial);

            // 2. 정원형 베이스 골드 인셋 몰딩 링 (명확한 계단식 Y축 단차 적용: Y=0.075f)
            GameObject baseGoldRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseGoldRing.name = "Stand_BaseGoldRing";
            SetupPart(baseGoldRing, standRoot.transform, new Vector3(0f, 0.075f, 0f), Vector3.zero, new Vector3(1.48f, 0.020f, 1.48f), goldTrimMaterial);

            // 3. 정원형 베이스 중앙 다크 브론즈 인셋 플레이트 (명확한 계단식 Y축 단차 적용: Y=0.092f -> Z-fighting 100% 방지)
            GameObject baseInner = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseInner.name = "Stand_BaseInnerPlate";
            SetupPart(baseInner, standRoot.transform, new Vector3(0f, 0.092f, 0f), Vector3.zero, new Vector3(1.32f, 0.015f, 1.32f), bronzeDarkMaterial);

            // 4. 좌우 수직 지지 기둥 (Vertical Support Pillars - 바닥에서 피벗 높이 Y=1.30f까지 수직 상승)
            CreateVerticalSupportArm(standRoot.transform, -0.74f, 1f);
            CreateVerticalSupportArm(standRoot.transform, 0.74f, -1f);
        }

        private void CreateVerticalSupportArm(Transform parent, float xPos, float sign)
        {
            GameObject armRoot = new($"Stand_Arm_{(xPos < 0 ? "Left" : "Right")}");
            armRoot.layer = DecorationLayer;
            armRoot.transform.SetParent(parent, false);
            armRoot.transform.localPosition = new Vector3(xPos, 0f, 0f);

            // 1. 수직 메인 지지 기둥 (Vertical Pillar - 바닥에서 피벗까지 수직으로 곧게 올라옴)
            GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pillar.name = "Arm_Pillar";
            SetupPart(pillar, armRoot.transform, new Vector3(0f, PivotHeight * 0.5f, 0f), Vector3.zero, new Vector3(0.12f, PivotHeight * 0.5f, 0.14f), bronzeMainMaterial);

            // 2. 바닥 기둥 받침 정원형 소켓 칼라 (X=Z=0.24f)
            GameObject footSocket = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            footSocket.name = "Arm_FootSocket";
            SetupPart(footSocket, armRoot.transform, new Vector3(0f, 0.095f, 0f), Vector3.zero, new Vector3(0.24f, 0.05f, 0.24f), goldTrimMaterial);

            // 3. 상단 피벗 힌지 보스 칼라 (Pivot Axis Collar at Y=PivotHeight)
            GameObject pivotCollar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pivotCollar.name = "Arm_PivotCollar";
            SetupPart(pivotCollar, armRoot.transform, new Vector3(0f, PivotHeight, 0f), new Vector3(0f, 0f, 90f), new Vector3(0.22f, 0.06f, 0.22f), goldTrimMaterial);

            // 4. 모래시계 본체와 연결되는 황동 피벗 핀 (Pivot Pin)
            GameObject pivotPin = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pivotPin.name = "Arm_PivotPin";
            SetupPart(pivotPin, armRoot.transform, new Vector3(sign * 0.10f, PivotHeight, 0f), new Vector3(0f, 0f, 90f), new Vector3(0.09f, 0.12f, 0.09f), bronzeDarkMaterial);

            // 5. 외곽 앤틱 골드 캡 너트 (Acorn Cap Nut)
            GameObject capNut = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            capNut.name = "Arm_CapNut";
            SetupPart(capNut, armRoot.transform, new Vector3(sign * -0.04f, PivotHeight, 0f), Vector3.zero, new Vector3(0.16f, 0.16f, 0.16f), goldTrimMaterial);
        }

        /// <summary>
        /// 계단식 단차로 메쉬 간섭(Z-fighting)이 방지된 상하단 다면체 베벨 브론즈 캡
        /// </summary>
        private void CreateFacetedCap(Transform parent, float yPos, bool isTop)
        {
            GameObject capRoot = new(isTop ? "Top_FacetedCap" : "Bottom_FacetedCap");
            capRoot.layer = DecorationLayer;
            capRoot.transform.SetParent(parent, false);
            capRoot.transform.localPosition = new Vector3(0f, yPos, 0f);

            float sign = isTop ? 1f : -1f;

            // 1단. 외곽 다면체 챔퍼 브론즈 림 (Chiseled Faceted Rim, Y = 0)
            GameObject outerRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            outerRim.name = "Cap_OuterRim";
            SetupPart(outerRim, capRoot.transform, Vector3.zero, Vector3.zero, new Vector3(1.15f, 0.05f, 1.15f), bronzeMainMaterial);

            // 2단. 다면체 챔퍼 링 (Faceted Chamfer Ring, 명확한 단차 Y = ±0.028f)
            GameObject chamferRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            chamferRing.name = "Cap_ChamferRing";
            SetupPart(chamferRing, capRoot.transform, new Vector3(0f, sign * 0.028f, 0f), Vector3.zero, new Vector3(1.02f, 0.025f, 1.02f), bronzeMainMaterial);

            // 3단. 골든 림 엑센트 링 (Gold Inset Rim, 명확한 단차 Y = ±0.052f)
            GameObject goldRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            goldRing.name = "Cap_GoldRing";
            SetupPart(goldRing, capRoot.transform, new Vector3(0f, sign * 0.052f, 0f), Vector3.zero, new Vector3(0.84f, 0.015f, 0.84f), goldTrimMaterial);

            // 4단. 중앙 원형 인셋 브론즈 플레이트 (Circular Recessed Plate, 명확한 단차 Y = ±0.068f -> Z-fighting 100% 방지)
            GameObject innerPlate = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            innerPlate.name = "Cap_InnerPlate";
            SetupPart(innerPlate, capRoot.transform, new Vector3(0f, sign * 0.068f, 0f), Vector3.zero, new Vector3(0.76f, 0.012f, 0.76f), bronzeDarkMaterial);

            // 5단. 유리와 맞닿는 안쪽 골드 소켓 칼라 (Inner Glass Socket)
            GameObject socket = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            socket.name = "Cap_GlassSocket";
            SetupPart(socket, capRoot.transform, new Vector3(0f, -sign * 0.030f, 0f), Vector3.zero, new Vector3(0.68f, 0.02f, 0.68f), goldTrimMaterial);
        }

        /// <summary>
        /// 슬림하고 호리호리한 로열 바이올렛 윙 가드 (Slender Royal Violet Wings with Scrolls & Bands)
        /// </summary>
        private void CreateSlenderWing(Transform parent, float xPos, float scrollSign)
        {
            GameObject wingRoot = new($"Wing_{(xPos < 0 ? "Left" : "Right")}");
            wingRoot.layer = DecorationLayer;
            wingRoot.transform.SetParent(parent, false);
            wingRoot.transform.localPosition = new Vector3(xPos, 0f, 0f);

            // 1. 호리호리하게 중앙이 쏙 들어간 3단 곡면 로열 바이올렛 패널
            // 1-1. 상단 윙 패널
            GameObject topPanel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topPanel.name = "Wing_TopPanel";
            SetupPart(topPanel, wingRoot.transform, new Vector3(0f, 0.52f, 0f), new Vector3(0f, 0f, scrollSign * 5f), new Vector3(0.12f, 0.70f, 0.36f), royalVioletMaterial);

            // 1-2. 중앙 잘록한 윙 패널 (안쪽으로 쏙 들어간 허리 라인)
            GameObject midPanel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            midPanel.name = "Wing_MidPanel";
            SetupPart(midPanel, wingRoot.transform, new Vector3(scrollSign * 0.035f, 0f, 0f), Vector3.zero, new Vector3(0.10f, 0.45f, 0.30f), royalVioletMaterial);

            // 1-3. 하단 윙 패널
            GameObject bottomPanel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bottomPanel.name = "Wing_BottomPanel";
            SetupPart(bottomPanel, wingRoot.transform, new Vector3(0f, -0.52f, 0f), new Vector3(0f, 0f, scrollSign * -5f), new Vector3(0.12f, 0.70f, 0.36f), royalVioletMaterial);

            // 2. 전면/후면 골든 트림 립 (Gold Trim Ribs)
            GameObject frontTrim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            frontTrim.name = "Wing_FrontTrim";
            SetupPart(frontTrim, wingRoot.transform, new Vector3(scrollSign * 0.05f, 0f, 0.17f), Vector3.zero, new Vector3(0.045f, 0.95f, 0.045f), goldTrimMaterial);

            GameObject backTrim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            backTrim.name = "Wing_BackTrim";
            SetupPart(backTrim, wingRoot.transform, new Vector3(scrollSign * 0.05f, 0f, -0.17f), Vector3.zero, new Vector3(0.045f, 0.95f, 0.045f), goldTrimMaterial);

            // 3. 상단/하단 끝부분 둥근 골든 볼류트 스크롤 장식 (Volute Scrolls)
            // 상단 스크롤 롤
            GameObject topScroll = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            topScroll.name = "Wing_TopScroll";
            SetupPart(topScroll, wingRoot.transform, new Vector3(scrollSign * 0.05f, 0.98f, 0.03f), new Vector3(90f, 0f, 0f), new Vector3(0.16f, 0.20f, 0.16f), goldTrimMaterial);

            // 하단 스크롤 롤
            GameObject bottomScroll = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            bottomScroll.name = "Wing_BottomScroll";
            SetupPart(bottomScroll, wingRoot.transform, new Vector3(scrollSign * 0.05f, -0.98f, 0.03f), new Vector3(90f, 0f, 0f), new Vector3(0.16f, 0.20f, 0.16f), goldTrimMaterial);

            // 4. 2단 수평 황동 리브 밴드 (Horizontal Rib Bands)
            // 상단 밴드
            GameObject topBand = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topBand.name = "Wing_TopBand";
            SetupPart(topBand, wingRoot.transform, new Vector3(0f, 0.38f, 0f), Vector3.zero, new Vector3(0.16f, 0.04f, 0.40f), bronzeDarkMaterial);

            // 하단 밴드
            GameObject bottomBand = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bottomBand.name = "Wing_BottomBand";
            SetupPart(bottomBand, wingRoot.transform, new Vector3(0f, -0.38f, 0f), Vector3.zero, new Vector3(0.16f, 0.04f, 0.40f), bronzeDarkMaterial);

            // 5. 윙 중심 피벗 리시버 칼라 (Wing Pivot Receiver Collar at Y=0)
            GameObject pivotSocket = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pivotSocket.name = "Wing_PivotSocket";
            SetupPart(pivotSocket, wingRoot.transform, new Vector3(scrollSign * -0.02f, 0f, 0f), new Vector3(0f, 0f, 90f), new Vector3(0.16f, 0.08f, 0.16f), goldTrimMaterial);
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

        private static Material CreateMaterial(string name, Shader shader, Color color, float metallic, float smoothness)
        {
            Material mat = new(shader)
            {
                name = name,
                color = color
            };
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            return mat;
        }

        private static Material CreateTransparentMaterial(string name, Shader shader, Color color, float metallic, float smoothness)
        {
            Material mat = new(shader)
            {
                name = name,
                color = color
            };

            // URP Lit Transparent Setup
            if (mat.HasProperty("_Surface")) mat.SetFloat("_Surface", 1.0f); // 1 = Transparent
            if (mat.HasProperty("_Blend")) mat.SetFloat("_Blend", 0.0f); // 0 = Alpha
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);

            mat.SetOverrideTag("RenderType", "Transparent");
            mat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            mat.SetInt("_ZWrite", 0);
            mat.renderQueue = (int)RenderQueue.Transparent;

            return mat;
        }
    }
}
