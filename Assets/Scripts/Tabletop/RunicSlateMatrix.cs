using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 모래시계 옆에 배치되는 고대 룬 석판과 동적 추가 턴 룬스톤 표시 장치.
    /// 외부 프레임은 돌출되고 내부 수정진은 내려간 구조이며, 룬스톤은 0~4개를 필요할 때만 생성한다.
    /// </summary>
    [ExecuteAlways]
    public sealed class RunicSlateMatrix : MonoBehaviour
    {
        private const int DecorationLayer = 11;
        private const int OuterRuneCount = 12;
        private const int VisualCapacity = 4;

        private const float OuterRadius = 1.18f;
        private const float FrameInnerRadius = 0.70f;
        private const float FrameBaseY = 0.06f;
        private const float FrameHeight = 0.14f;
        private const float FrameTopY = FrameBaseY + FrameHeight;
        private const float BasinTopY = 0.105f;
        private const float OuterRuneRadius = 0.92f;
        private const float StoneArcRadius = 0.54f;
        private const float StoneBaseY = BasinTopY + 0.012f;

        private static readonly Color StoneMain = new(0.200f, 0.250f, 0.310f, 1f);       // 차가운 청회색 슬레이트
        private static readonly Color StoneDark = new(0.120f, 0.160f, 0.220f, 1f);       // 깊게 깨진 면
        private static readonly Color StoneInset = new(0.100f, 0.120f, 0.160f, 1f);      // 낮은 내부 수정진
        private static readonly Color StoneHighlight = new(0.380f, 0.440f, 0.520f, 1f);  // 깎인 모서리
        private static readonly Color WarmBase = new(0.212f, 0.188f, 0.157f, 1f);        // #363028
        private static readonly Color WarmInset = new(0.349f, 0.310f, 0.259f, 1f);       // #594F42
        private static readonly Color InactiveRune = new(0.015f, 0.060f, 0.150f, 1f);   // 수정구 딥 블루
        private static readonly Color ActiveCore = new(0.427f, 0.875f, 0.965f, 1f);      // #6DDFF6
        private static readonly Color ActiveHalo = new(0.376f, 0.694f, 0.824f, 0.28f);  // #60B1D2

        [Header("Extra Turn State")]
        [SerializeField, Range(0, VisualCapacity)] private int extraTurnCount;
        [SerializeField, Range(1, VisualCapacity)] private int maxExtraTurns = VisualCapacity;

        [Header("Rune Lighting Debug State")]
        [SerializeField, Range(0, OuterRuneCount)] private int outerRuneProgress;
        [SerializeField] private bool stoneRunesLit;

        [Header("Animation")]
        [SerializeField, Min(0.1f)] private float outerRuneStepDuration = 0.065f;
        [SerializeField, Min(0.1f)] private float stoneMoveDuration = 0.72f;
        [SerializeField, Min(0f)] private float stoneLiftHeight = 0.075f;

        private Transform dynamicStoneRoot;
        private Material frameMaterial;
        private Material frameDarkMaterial;
        private Material frameHighlightMaterial;
        private Material basinMaterial;
        private Material warmBaseMaterial;
        private Material warmInsetMaterial;
        private Material channelMaterial;
        private Material runeCoreMaterial;
        private Material runeHaloMaterial;
        private Material runeStoneMaterial;
        private Material runeStoneSideMaterial;

        private readonly List<GlyphVisual> outerRunes = new();
        private readonly List<RuneStoneVisual> runeStones = new();
        private MaterialPropertyBlock propertyBlock;
        private Coroutine stoneTransitionRoutine;
        private Coroutine runeSequenceRoutine;
        private Coroutine grantRoutine;

        public int ExtraTurnCount => extraTurnCount;
        public int MaxExtraTurns => maxExtraTurns;
        public int OuterRuneProgress => outerRuneProgress;
        

        public event Action StateChanged;
public bool StoneRunesLit => stoneRunesLit;

        private sealed class GlyphVisual
        {
            public GameObject root;
            public readonly List<MeshRenderer> cores = new();
            public readonly List<MeshRenderer> halos = new();
        }

        private sealed class RuneStoneVisual
        {
            public GameObject root;
            public GlyphVisual glyph;
        }

        public static RunicSlateMatrix Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Runic Slate & Crystal Matrix");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            RunicSlateMatrix component = root.AddComponent<RunicSlateMatrix>();
            component.BuildGeometry();
            return component;
        }

        private void Awake()
        {
            propertyBlock = new MaterialPropertyBlock();
            EnsureGeometry();
        }

        private void OnEnable()
        {
            propertyBlock ??= new MaterialPropertyBlock();
            EnsureGeometry();
            ApplyRuneStates();
        }

        private void OnValidate()
        {
            maxExtraTurns = Mathf.Clamp(maxExtraTurns, 1, VisualCapacity);
            extraTurnCount = Mathf.Clamp(extraTurnCount, 0, maxExtraTurns);
            outerRuneProgress = Mathf.Clamp(outerRuneProgress, 0, OuterRuneCount);
        }

        public void EnsureGeometry()
        {
            if (transform.childCount == 0)
            {
                BuildGeometry();
                return;
            }

            CacheVisualReferences();
            EnsureMaterials();
            EnsureStoneCountImmediate(extraTurnCount);
            PositionStonesImmediate();
        }

        public void BuildGeometry()
        {
            StopAllManagedCoroutines();
            ClearChildren();
            ClearCaches();
            EnsureMaterials();

            // 카드 트레이와 연결되는 따뜻한 하부 림.
            GameObject underPlate = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            underPlate.name = "Warm Stone Shadow Base";
            SetupPrimitive(underPlate, transform, new Vector3(0f, 0.03f, 0f), Vector3.zero,
                new Vector3(OuterRadius * 2.08f, 0.03f, OuterRadius * 2.08f), warmBaseMaterial);

            // 외부가 돌출된 메인 룬 프레임.
            GameObject outerFrame = new("Raised Outer Rune Frame", typeof(MeshFilter), typeof(MeshRenderer));
            outerFrame.layer = DecorationLayer;
            outerFrame.transform.SetParent(transform, false);
            outerFrame.transform.localPosition = new Vector3(0f, FrameBaseY, 0f);
            outerFrame.GetComponent<MeshFilter>().sharedMesh =
                CreateRingPrismMesh(FrameInnerRadius, OuterRadius, FrameHeight, 64, "RunicSlate_RaisedOuterFrame");
            ApplyRenderer(outerFrame.GetComponent<MeshRenderer>(), frameMaterial);

            // 외곽과 내부 경계의 둥근 챔퍼를 계단식 얇은 링으로 표현.
            CreateRingPart("Outer Frame Highlight Bevel", OuterRadius - 0.070f, OuterRadius - 0.015f,
                0.012f, FrameTopY + 0.002f, frameHighlightMaterial);
            CreateRingPart("Inner Recess Shadow Bevel", FrameInnerRadius - 0.045f, FrameInnerRadius + 0.018f,
                0.035f, BasinTopY + 0.020f, frameDarkMaterial);

            // 돌출 프레임보다 낮은 내부 수정진.
            GameObject basin = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            basin.name = "Recessed Crystal Matrix Basin";
            SetupPrimitive(basin, transform, new Vector3(0f, BasinTopY - 0.022f, 0f), Vector3.zero,
                new Vector3((FrameInnerRadius - 0.04f) * 2f, 0.022f, (FrameInnerRadius - 0.04f) * 2f), basinMaterial);

            GameObject warmInsetRing = new("Warm Aged Inset Accent", typeof(MeshFilter), typeof(MeshRenderer));
            warmInsetRing.layer = DecorationLayer;
            warmInsetRing.transform.SetParent(transform, false);
            warmInsetRing.transform.localPosition = new Vector3(0f, BasinTopY - 0.002f, 0f);
            warmInsetRing.GetComponent<MeshFilter>().sharedMesh =
                CreateRingPrismMesh(0.585f, 0.625f, 0.010f, 48, "RunicSlate_WarmInsetAccent");
            ApplyRenderer(warmInsetRing.GetComponent<MeshRenderer>(), warmInsetMaterial);
            BuildOuterRunes();
            BuildStoneWeathering();
            BuildBasinWeathering();

            dynamicStoneRoot = new GameObject("Dynamic Rune Stones").transform;
            dynamicStoneRoot.gameObject.layer = DecorationLayer;
            dynamicStoneRoot.SetParent(transform, false);

            EnsureStoneCountImmediate(extraTurnCount);
            PositionStonesImmediate();
            ApplyRuneStates();
        }

        public void SetMaxExtraTurns(int capacity)
        {
            maxExtraTurns = Mathf.Clamp(capacity, 1, VisualCapacity);
            if (extraTurnCount > maxExtraTurns)
            {
                SetExtraTurnCount(maxExtraTurns, Application.isPlaying);
            }
        }

        public void SetExtraTurnCount(int count, bool animate = true)
        {
            int target = Mathf.Clamp(count, 0, maxExtraTurns);
            if (!Application.isPlaying || !animate)
            {
                StopStoneTransition();
                extraTurnCount = target;
                EnsureStoneCountImmediate(target);
                PositionStonesImmediate();
                ApplyRuneStates();
                return;
            }

            StopStoneTransition();
            stoneTransitionRoutine = StartCoroutine(AnimateStoneCountRoutine(target));
        }

        public void GrantExtraTurns(int amount)
        {
            if (amount <= 0) return;
            int target = Mathf.Clamp(extraTurnCount + amount, 0, maxExtraTurns);
            if (target == extraTurnCount) return;

            if (!Application.isPlaying)
            {
                outerRuneProgress = OuterRuneCount;
                stoneRunesLit = true;
                SetExtraTurnCount(target, false);
                return;
            }

            StopGrantRoutine();
            grantRoutine = StartCoroutine(GrantExtraTurnsRoutine(target));
        }

        public bool ConsumeExtraTurn()
        {
            if (extraTurnCount <= 0) return false;
            SetExtraTurnCount(extraTurnCount - 1, Application.isPlaying);
            return true;
        }

        public void PlayOuterRuneSequence()
        {
            if (!Application.isPlaying)
            {
                outerRuneProgress = OuterRuneCount;
                stoneRunesLit = true;
                ApplyRuneStates();
                return;
            }

            StopRuneSequence();
            runeSequenceRoutine = StartCoroutine(OuterRuneSequenceRoutine(true));
        }

        public void AdvanceDebugRuneLighting()
        {
            StopRuneSequence();
            if (outerRuneProgress < OuterRuneCount)
            {
                outerRuneProgress++;
            }
            else if (!stoneRunesLit)
            {
                stoneRunesLit = true;
            }
            else
            {
                outerRuneProgress = 0;
                stoneRunesLit = false;
            }
            ApplyRuneStates();
        }

        public void CycleDebugRuneStoneCount()
        {
            int next = extraTurnCount >= maxExtraTurns ? 0 : extraTurnCount + 1;
            SetExtraTurnCount(next, Application.isPlaying);
        }

        public void ResetVisualState(bool clearStones)
        {
            StopAllManagedCoroutines();
            outerRuneProgress = 0;
            stoneRunesLit = false;
            if (clearStones)
            {
                extraTurnCount = 0;
                EnsureStoneCountImmediate(0);
            }
            PositionStonesImmediate();
            ApplyRuneStates();
        }

        private IEnumerator GrantExtraTurnsRoutine(int target)
        {
            stoneRunesLit = false;
            ApplyRuneStates();

            yield return OuterRuneSequenceRoutine(false);
            yield return AnimateStoneCountRoutine(target);

            stoneRunesLit = true;
            ApplyRuneStates();
            grantRoutine = null;
        }

        private IEnumerator OuterRuneSequenceRoutine(bool lightStoneRunesAtEnd)
        {
            outerRuneProgress = 0;
            if (lightStoneRunesAtEnd) stoneRunesLit = false;
            ApplyRuneStates();

            for (int i = 0; i < OuterRuneCount; i++)
            {
                outerRuneProgress = i + 1;
                ApplyRuneStates();
                yield return new WaitForSeconds(outerRuneStepDuration);
            }

            if (lightStoneRunesAtEnd)
            {
                stoneRunesLit = true;
                ApplyRuneStates();
            }
            runeSequenceRoutine = null;
        }

        private IEnumerator AnimateStoneCountRoutine(int target)
        {
            while (runeStones.Count < target)
            {
                yield return AddStoneAnimated();
                extraTurnCount = runeStones.Count;
            }

            while (runeStones.Count > target)
            {
                yield return RemoveStoneAnimated();
                extraTurnCount = runeStones.Count;
            }

            extraTurnCount = target;
            PositionStonesImmediate();
            ApplyRuneStates();
            stoneTransitionRoutine = null;
        }

        private IEnumerator AddStoneAnimated()
        {
            int finalCount = runeStones.Count + 1;
            RuneStoneVisual added = CreateRuneStone(runeStones.Count);
            runeStones.Add(added);

            Vector3 center = new(0f, StoneBaseY - 0.035f, 0f);
            added.root.transform.localPosition = center;
            added.root.transform.localScale = Vector3.one * 0.68f;

            Vector3[] starts = new Vector3[runeStones.Count];
            float[] startAngles = new float[runeStones.Count];
            for (int i = 0; i < runeStones.Count; i++)
            {
                starts[i] = runeStones[i].root.transform.localPosition;
                startAngles[i] = Mathf.Atan2(starts[i].x, starts[i].z) * Mathf.Rad2Deg;
            }

            float elapsed = 0f;
            while (elapsed < stoneMoveDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / stoneMoveDuration);
                float heavyT = HeavyEase(t);

                for (int i = 0; i < runeStones.Count - 1; i++)
                {
                    float targetAngle = GetStoneAngle(i, finalCount);
                    float angle = Mathf.LerpAngle(startAngles[i], targetAngle, heavyT);
                    float radius = Mathf.Lerp(new Vector2(starts[i].x, starts[i].z).magnitude, StoneArcRadius, heavyT);
                    Vector3 p = PolarPosition(angle, radius);
                    p.y = StoneBaseY + Mathf.Sin(t * Mathf.PI) * stoneLiftHeight * 0.35f;
                    runeStones[i].root.transform.localPosition = p;
                    OrientStoneTowardCenter(runeStones[i].root.transform, p, targetAngle);
                }

                Vector3 targetPosition = GetStoneTarget(finalCount - 1, finalCount);
                Vector3 addedPosition = Vector3.Lerp(center, targetPosition, heavyT);
                addedPosition.y += Mathf.Sin(t * Mathf.PI) * stoneLiftHeight;
                added.root.transform.localPosition = addedPosition;
                OrientStoneTowardCenter(added.root.transform, addedPosition, GetStoneAngle(finalCount - 1, finalCount));
                added.root.transform.localScale = Vector3.one * Mathf.Lerp(0.68f, 1f, heavyT);
                yield return null;
            }

            PositionStonesImmediate();
        }

        private IEnumerator RemoveStoneAnimated()
        {
            int removeIndex = runeStones.Count - 1;
            RuneStoneVisual removed = runeStones[removeIndex];
            int finalCount = removeIndex;

            Vector3 removedStart = removed.root.transform.localPosition;
            Vector3 center = new(0f, StoneBaseY - 0.045f, 0f);
            Vector3[] starts = new Vector3[finalCount];
            float[] startAngles = new float[finalCount];
            for (int i = 0; i < finalCount; i++)
            {
                starts[i] = runeStones[i].root.transform.localPosition;
                startAngles[i] = Mathf.Atan2(starts[i].x, starts[i].z) * Mathf.Rad2Deg;
            }

            float elapsed = 0f;
            while (elapsed < stoneMoveDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / stoneMoveDuration);
                float heavyT = HeavyEase(t);

                for (int i = 0; i < finalCount; i++)
                {
                    float targetAngle = GetStoneAngle(i, finalCount);
                    float angle = Mathf.LerpAngle(startAngles[i], targetAngle, heavyT);
                    Vector3 p = PolarPosition(angle, StoneArcRadius);
                    p.y = StoneBaseY + Mathf.Sin(t * Mathf.PI) * stoneLiftHeight * 0.25f;
                    runeStones[i].root.transform.localPosition = p;
                    OrientStoneTowardCenter(runeStones[i].root.transform, p, targetAngle);
                }

                removed.root.transform.localPosition = Vector3.Lerp(removedStart, center, heavyT);
                OrientStoneTowardCenter(removed.root.transform, removed.root.transform.localPosition,
                    Mathf.Atan2(removedStart.x, removedStart.z) * Mathf.Rad2Deg);
                removed.root.transform.localScale = Vector3.one * Mathf.Lerp(1f, 0.2f, heavyT);
                yield return null;
            }

            runeStones.RemoveAt(removeIndex);
            if (Application.isPlaying) Destroy(removed.root);
            else DestroyImmediate(removed.root);
            PositionStonesImmediate();
        }

        private static float HeavyEase(float t)
        {
            t = Mathf.Clamp01(t);
            float eased = 1f - Mathf.Pow(1f - t, 3f);
            float settle = Mathf.Sin(t * Mathf.PI) * (1f - t) * 0.035f;
            return Mathf.Clamp01(eased + settle);
        }

        private void BuildStoneWeathering()
        {
            GameObject detailRoot = new("Chiseled Stone Weathering");
            detailRoot.layer = DecorationLayer;
            detailRoot.transform.SetParent(transform, false);
            detailRoot.transform.localPosition = new Vector3(0f, FrameTopY + 0.006f, 0f);

            float[] crackAngles = { 18f, 104f, 198f, 286f };
            for (int i = 0; i < crackAngles.Length; i++)
            {
                float angle = crackAngles[i];
                Vector3 outer = PolarPosition(angle, OuterRadius - 0.035f);
                Vector3 middle = PolarPosition(angle + (i % 2 == 0 ? 4f : -5f), 0.91f);
                Vector3 inner = PolarPosition(angle + (i % 2 == 0 ? -3f : 3f), FrameInnerRadius + 0.035f);
                CreateHorizontalSegment(detailRoot.transform, $"Deep Crack {i + 1:00}A", outer, middle, 0.018f, 0.005f, channelMaterial);
                CreateHorizontalSegment(detailRoot.transform, $"Deep Crack {i + 1:00}B", middle, inner, 0.013f, 0.004f, channelMaterial);

                Vector3 branch = middle + (PolarPosition(angle + 72f, 0.11f) - PolarPosition(angle + 72f, 0f));
                CreateHorizontalSegment(detailRoot.transform, $"Crack Branch {i + 1:00}", middle, branch, 0.010f, 0.003f, channelMaterial, 0.001f);
            }

            float[] pitAngles = { 45f, 76f, 142f, 171f, 235f, 258f, 326f, 347f };
            for (int i = 0; i < pitAngles.Length; i++)
            {
                float radius = i % 2 == 0 ? 0.80f : 1.06f;
                Vector3 position = PolarPosition(pitAngles[i], radius);
                GameObject pit = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pit.name = $"Weathered Stone Pit {i + 1:00}";
                SetupPrimitive(pit, detailRoot.transform, position + Vector3.up * 0.001f,
                    Vector3.zero, new Vector3(0.022f + (i % 3) * 0.007f, 0.0015f, 0.015f + (i % 2) * 0.006f), frameDarkMaterial);
            }

            float[] facetAngles = { 62f, 156f, 248f, 334f };
            for (int i = 0; i < facetAngles.Length; i++)
            {
                Vector3 center = PolarPosition(facetAngles[i], 0.79f);
                Vector3 tangent = (PolarPosition(facetAngles[i] + 90f, 0.065f) - PolarPosition(facetAngles[i] + 90f, 0f));
                CreateHorizontalSegment(detailRoot.transform, $"Chisel Facet {i + 1:00}", center - tangent, center + tangent,
                    0.045f, 0.003f, i % 2 == 0 ? frameDarkMaterial : frameHighlightMaterial);
            }
        }

        private void BuildBasinWeathering()
        {
            GameObject detailRoot = new("Recessed Basin Fractures");
            detailRoot.layer = DecorationLayer;
            detailRoot.transform.SetParent(transform, false);
            detailRoot.transform.localPosition = new Vector3(0f, BasinTopY + 0.007f, 0f);

            float[] angles = { 132f, 224f, 318f };
            for (int i = 0; i < angles.Length; i++)
            {
                float angle = angles[i];
                Vector3 start = PolarPosition(angle - 5f, 0.11f + i * 0.025f);
                Vector3 middle = PolarPosition(angle + 4f, 0.30f + (i % 2) * 0.05f);
                Vector3 end = PolarPosition(angle - 2f, 0.50f);
                CreateHorizontalSegment(detailRoot.transform, $"Basin Crack {i + 1:00}A", start, middle,
                    0.010f, 0.003f, channelMaterial);
                CreateHorizontalSegment(detailRoot.transform, $"Basin Crack {i + 1:00}B", middle, end,
                    0.007f, 0.003f, channelMaterial);
            }
        }

        private void BuildOuterRunes()
        {
            outerRunes.Clear();
            for (int i = 0; i < OuterRuneCount; i++)
            {
                float angle = i * (360f / OuterRuneCount);
                GameObject runeRoot = new($"Outer Rune {i + 1:00}");
                runeRoot.layer = DecorationLayer;
                runeRoot.transform.SetParent(transform, false);
                runeRoot.transform.localPosition = PolarPosition(angle, OuterRuneRadius) + Vector3.up * (FrameTopY + 0.012f);
                runeRoot.transform.localRotation = Quaternion.Euler(0f, angle, 0f);

                GlyphVisual visual = BuildHorizontalGlyph(runeRoot.transform, RunicGlyphData.GetOuterRune(i), 0.27f, 0.31f, 0.050f);
                visual.root = runeRoot;
                outerRunes.Add(visual);
            }
        }

        private void BuildInnerArcGuide()
        {
            GameObject guideRoot = new("Recessed 120 Degree Arc Guide");
            guideRoot.layer = DecorationLayer;
            guideRoot.transform.SetParent(transform, false);
            guideRoot.transform.localPosition = new Vector3(0f, BasinTopY + 0.006f, 0f);

            const int arcSegments = 24;
            const float radius = 0.575f;
            for (int i = 0; i < arcSegments; i++)
            {
                float a0 = Mathf.Lerp(-60f, 60f, (float)i / arcSegments);
                float a1 = Mathf.Lerp(-60f, 60f, (float)(i + 1) / arcSegments);
                Vector3 p0 = PolarPosition(a0, radius);
                Vector3 p1 = PolarPosition(a1, radius);
                CreateHorizontalSegment(guideRoot.transform, $"Arc_{i:00}", p0, p1, 0.018f, 0.006f, channelMaterial);
            }

            foreach (float boundaryAngle in new[] { -60f, 60f })
            {
                Vector3 p0 = PolarPosition(boundaryAngle, 0.18f);
                Vector3 p1 = PolarPosition(boundaryAngle, radius);
                CreateHorizontalSegment(guideRoot.transform, $"Boundary_{boundaryAngle:+00;-00}", p0, p1, 0.016f, 0.006f, channelMaterial);
            }
        }

        private GlyphVisual BuildHorizontalGlyph(Transform parent, Vector2[] points, float width, float height, float strokeWidth)
        {
            GlyphVisual visual = new();
            for (int i = 0; i + 1 < points.Length; i += 2)
            {
                Vector3 start = new(points[i].x * width, 0f, points[i].y * height);
                Vector3 end = new(points[i + 1].x * width, 0f, points[i + 1].y * height);

                CreateHorizontalSegment(parent, $"Channel_{i / 2:00}", start, end, strokeWidth * 1.85f, 0.008f, channelMaterial);
                MeshRenderer halo = CreateHorizontalSegment(parent, $"Halo_{i / 2:00}", start, end, strokeWidth * 2.25f, 0.004f, runeHaloMaterial, 0.005f);
                MeshRenderer core = CreateHorizontalSegment(parent, $"Core_{i / 2:00}", start, end, strokeWidth, 0.006f, runeCoreMaterial, 0.009f);
                visual.halos.Add(halo);
                visual.cores.Add(core);
            }
            return visual;
        }

        private GlyphVisual BuildVerticalGlyph(Transform parent, Vector2[] points, float width, float height, float strokeWidth, float frontZ)
        {
            GlyphVisual visual = new();
            for (int i = 0; i + 1 < points.Length; i += 2)
            {
                Vector2 start = new(points[i].x * width, points[i].y * height + height * 0.52f);
                Vector2 end = new(points[i + 1].x * width, points[i + 1].y * height + height * 0.52f);

                CreateVerticalSegment(parent, $"Channel_{i / 2:00}", start, end, strokeWidth * 1.9f, 0.008f, frontZ - 0.002f, channelMaterial);
                MeshRenderer halo = CreateVerticalSegment(parent, $"Halo_{i / 2:00}", start, end, strokeWidth * 2.25f, 0.004f, frontZ - 0.006f, runeHaloMaterial);
                MeshRenderer core = CreateVerticalSegment(parent, $"Core_{i / 2:00}", start, end, strokeWidth, 0.006f, frontZ - 0.010f, runeCoreMaterial);
                visual.halos.Add(halo);
                visual.cores.Add(core);
            }
            return visual;
        }

        private RuneStoneVisual CreateRuneStone(int index)
        {
            EnsureMaterials();
            if (dynamicStoneRoot == null)
            {
                dynamicStoneRoot = transform.Find("Dynamic Rune Stones");
                if (dynamicStoneRoot == null)
                {
                    dynamicStoneRoot = new GameObject("Dynamic Rune Stones").transform;
                    dynamicStoneRoot.gameObject.layer = DecorationLayer;
                    dynamicStoneRoot.SetParent(transform, false);
                }
            }

            GameObject root = new($"Rune Stone {index + 1:00}");
            root.layer = DecorationLayer;
            root.transform.SetParent(dynamicStoneRoot, false);
            root.transform.localRotation = Quaternion.Euler(18f, 0f, 0f);

            const float stoneWidth = 0.235f;
            const float stoneHeight = 0.33f;
            const float stoneDepth = 0.15f;
            const float frontSurface = -stoneDepth * 0.56f;

            GameObject body = new("Faceted Chiseled Menhir Body", typeof(MeshFilter), typeof(MeshRenderer));
            body.layer = DecorationLayer;
            body.transform.SetParent(root.transform, false);
            body.GetComponent<MeshFilter>().sharedMesh = CreateRuneStoneMesh(stoneWidth, stoneHeight, stoneDepth, index);
            ApplyRenderer(body.GetComponent<MeshRenderer>(), index % 2 == 0 ? runeStoneMaterial : runeStoneSideMaterial);

            float side = index % 2 == 0 ? -1f : 1f;
            CreateVerticalSegment(root.transform, "Stone Face Fracture A",
                new Vector2(0.055f * side, 0.075f), new Vector2(0.018f * side, 0.145f),
                0.009f, 0.004f, frontSurface - 0.003f, channelMaterial);
            CreateVerticalSegment(root.transform, "Stone Face Fracture B",
                new Vector2(0.018f * side, 0.145f), new Vector2(0.070f * side, 0.185f),
                0.007f, 0.003f, frontSurface - 0.004f, channelMaterial);
            CreateVerticalSegment(root.transform, "Chipped Face Highlight",
                new Vector2(-0.080f, 0.260f), new Vector2(-0.030f, 0.305f),
                0.010f, 0.003f, frontSurface - 0.002f, frameHighlightMaterial);

            GlyphVisual glyph = BuildVerticalGlyph(root.transform, RunicGlyphData.GetStoneRune(index),
                stoneWidth * 0.62f, stoneHeight * 0.58f, 0.024f, frontSurface);
            glyph.root = root;

            return new RuneStoneVisual { root = root, glyph = glyph };
        }

        private void EnsureStoneCountImmediate(int target)
        {
            target = Mathf.Clamp(target, 0, maxExtraTurns);
            CacheStoneReferences();

            while (runeStones.Count < target)
            {
                runeStones.Add(CreateRuneStone(runeStones.Count));
            }

            while (runeStones.Count > target)
            {
                int last = runeStones.Count - 1;
                GameObject root = runeStones[last].root;
                runeStones.RemoveAt(last);
                if (root != null)
                {
                    if (Application.isPlaying) Destroy(root);
                    else DestroyImmediate(root);
                }
            }
        }

        private void PositionStonesImmediate()
        {
            for (int i = 0; i < runeStones.Count; i++)
            {
                if (runeStones[i].root == null) continue;
                Vector3 target = GetStoneTarget(i, runeStones.Count);
                runeStones[i].root.transform.localPosition = target;
                OrientStoneTowardCenter(runeStones[i].root.transform, target, GetStoneAngle(i, runeStones.Count));
                runeStones[i].root.transform.localScale = Vector3.one;
            }
        }

        private static void OrientStoneTowardCenter(Transform stone, Vector3 localPosition, float fallbackAngle)
        {
            if (stone == null) return;
            float angle = new Vector2(localPosition.x, localPosition.z).sqrMagnitude > 0.0025f
                ? Mathf.Atan2(localPosition.x, localPosition.z) * Mathf.Rad2Deg
                : fallbackAngle;
            stone.localRotation = Quaternion.Euler(18f, angle, 0f);
        }

        private static float GetStoneAngle(int index, int count)
        {
            if (count <= 0) return 0f;
            return -60f + 120f * (index + 1f) / (count + 1f);
        }

        private static Vector3 GetStoneTarget(int index, int count)
        {
            Vector3 position = PolarPosition(GetStoneAngle(index, count), StoneArcRadius);
            position.y = StoneBaseY;
            return position;
        }

        private static Vector3 PolarPosition(float angleDeg, float radius)
        {
            float rad = angleDeg * Mathf.Deg2Rad;
            return new Vector3(Mathf.Sin(rad) * radius, 0f, Mathf.Cos(rad) * radius);
        }

        private void ApplyRuneStates()
        {
            propertyBlock ??= new MaterialPropertyBlock();

            for (int i = 0; i < outerRunes.Count; i++)
            {
                bool lit = i < outerRuneProgress;
                ApplyGlyphState(outerRunes[i], lit);
            }

            for (int i = 0; i < runeStones.Count; i++)
            {
                ApplyGlyphState(runeStones[i].glyph, stoneRunesLit);
            }

            StateChanged?.Invoke();
        }

        private void ApplyGlyphState(GlyphVisual visual, bool lit)
        {
            if (visual == null) return;
            Color coreColor = lit ? ActiveCore * 1.45f : InactiveRune;
            coreColor.a = 1f;
            Color haloColor = lit ? ActiveHalo : new Color(ActiveHalo.r, ActiveHalo.g, ActiveHalo.b, 0f);

            foreach (MeshRenderer renderer in visual.cores)
            {
                SetRendererColor(renderer, coreColor);
            }
            foreach (MeshRenderer renderer in visual.halos)
            {
                SetRendererColor(renderer, haloColor);
                renderer.enabled = lit;
            }
        }

        private void SetRendererColor(MeshRenderer renderer, Color color)
        {
            if (renderer == null) return;
            renderer.GetPropertyBlock(propertyBlock);
            propertyBlock.SetColor("_BaseColor", color);
            propertyBlock.SetColor("_Color", color);
            propertyBlock.SetColor("_EmissionColor", color);
            renderer.SetPropertyBlock(propertyBlock);
            propertyBlock.Clear();
        }

        private void CacheVisualReferences()
        {
            outerRunes.Clear();
            for (int i = 0; i < OuterRuneCount; i++)
            {
                Transform runeRoot = transform.Find($"Outer Rune {i + 1:00}");
                if (runeRoot == null) continue;
                GlyphVisual visual = new() { root = runeRoot.gameObject };
                CacheGlyphSegments(runeRoot, visual);
                outerRunes.Add(visual);
            }

            dynamicStoneRoot = transform.Find("Dynamic Rune Stones");
            CacheStoneReferences();
        }

        private void CacheStoneReferences()
        {
            if (dynamicStoneRoot == null)
            {
                dynamicStoneRoot = transform.Find("Dynamic Rune Stones");
            }

            if (dynamicStoneRoot == null)
            {
                runeStones.Clear();
                return;
            }

            if (runeStones.Count == dynamicStoneRoot.childCount && runeStones.TrueForAll(v => v.root != null))
            {
                return;
            }

            runeStones.Clear();
            for (int i = 0; i < dynamicStoneRoot.childCount; i++)
            {
                Transform root = dynamicStoneRoot.GetChild(i);
                GlyphVisual glyph = new() { root = root.gameObject };
                CacheGlyphSegments(root, glyph);
                runeStones.Add(new RuneStoneVisual { root = root.gameObject, glyph = glyph });
            }
        }

        private static void CacheGlyphSegments(Transform root, GlyphVisual visual)
        {
            MeshRenderer[] renderers = root.GetComponentsInChildren<MeshRenderer>(true);
            foreach (MeshRenderer renderer in renderers)
            {
                if (renderer.name.StartsWith("Core_")) visual.cores.Add(renderer);
                else if (renderer.name.StartsWith("Halo_")) visual.halos.Add(renderer);
            }
        }

        private void EnsureMaterials()
        {
            Shader lit = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Shader unlit = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? lit;

            if (frameMaterial == null) frameMaterial = CreateLitMaterial(lit, "Runic Slate Main", StoneMain, 0.03f, 0.20f);
            if (frameDarkMaterial == null) frameDarkMaterial = CreateLitMaterial(lit, "Runic Slate Dark", StoneDark, 0.02f, 0.14f);
            if (frameHighlightMaterial == null) frameHighlightMaterial = CreateLitMaterial(lit, "Runic Slate Bevel", StoneHighlight, 0.05f, 0.28f);
            if (basinMaterial == null) basinMaterial = CreateLitMaterial(lit, "Runic Slate Recess", StoneInset, 0.01f, 0.11f);
            if (warmBaseMaterial == null) warmBaseMaterial = CreateLitMaterial(lit, "Runic Slate Warm Base", WarmBase, 0.02f, 0.15f);
            if (warmInsetMaterial == null) warmInsetMaterial = CreateLitMaterial(lit, "Runic Slate Warm Inset", WarmInset, 0.02f, 0.17f);
            if (channelMaterial == null) channelMaterial = CreateUnlitMaterial(unlit, "Runic Carved Channel", new Color(0.025f, 0.028f, 0.035f, 1f), false);
            if (runeCoreMaterial == null) runeCoreMaterial = CreateUnlitMaterial(unlit, "Runic Core", InactiveRune, false);
            if (runeHaloMaterial == null) runeHaloMaterial = CreateUnlitMaterial(unlit, "Runic Halo", new Color(ActiveHalo.r, ActiveHalo.g, ActiveHalo.b, 0f), true);
            if (runeStoneMaterial == null) runeStoneMaterial = CreateLitMaterial(lit, "Rune Stone Face", new Color(0.45f, 0.48f, 0.52f, 1f), 0.01f, 0.10f);
            if (runeStoneSideMaterial == null) runeStoneSideMaterial = CreateLitMaterial(lit, "Rune Stone Variant", new Color(0.38f, 0.41f, 0.45f, 1f), 0.01f, 0.08f);
            if (runeStoneMaterial.HasProperty("_Cull")) runeStoneMaterial.SetFloat("_Cull", 0f);
            
            ApplyMaterialColor(frameMaterial, StoneMain);
            ApplyMaterialColor(frameDarkMaterial, StoneDark);
            ApplyMaterialColor(frameHighlightMaterial, StoneHighlight);
            ApplyMaterialColor(basinMaterial, StoneInset);
            ApplyMaterialColor(warmBaseMaterial, WarmBase);
            ApplyMaterialColor(warmInsetMaterial, WarmInset);
            ApplyMaterialColor(runeStoneMaterial, new Color(0.45f, 0.48f, 0.52f, 1f));
            ApplyMaterialColor(runeStoneSideMaterial, new Color(0.38f, 0.41f, 0.45f, 1f));
if (runeStoneSideMaterial.HasProperty("_Cull")) runeStoneSideMaterial.SetFloat("_Cull", 0f);
        }

        private static void ApplyMaterialColor(Material material, Color color)
        {
            if (material == null) return;
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color")) material.SetColor("_Color", color);
        }

        private static Material CreateLitMaterial(Shader shader, string name, Color color, float metallic, float smoothness)
        {
            Material material = new(shader) { name = name };
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color")) material.SetColor("_Color", color);
            if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metallic);
            if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", smoothness);
            return material;
        }

        private static Material CreateUnlitMaterial(Shader shader, string name, Color color, bool additive)
        {
            Material material = new(shader) { name = name };
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color")) material.SetColor("_Color", color);

            if (additive)
            {
                if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1f);
                if (material.HasProperty("_Blend")) material.SetFloat("_Blend", 2f);
                if (material.HasProperty("_ZWrite")) material.SetFloat("_ZWrite", 0f);
                if (material.HasProperty("_SrcBlend")) material.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                if (material.HasProperty("_DstBlend")) material.SetFloat("_DstBlend", (float)BlendMode.One);
                material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                material.renderQueue = (int)RenderQueue.Transparent;
                material.SetOverrideTag("RenderType", "Transparent");
            }
            return material;
        }

        private void CreateRingPart(string name, float innerRadius, float outerRadius, float height, float localY, Material material)
        {
            GameObject ring = new(name, typeof(MeshFilter), typeof(MeshRenderer));
            ring.layer = DecorationLayer;
            ring.transform.SetParent(transform, false);
            ring.transform.localPosition = new Vector3(0f, localY, 0f);
            ring.GetComponent<MeshFilter>().sharedMesh = CreateRingPrismMesh(innerRadius, outerRadius, height, 64, name);
            ApplyRenderer(ring.GetComponent<MeshRenderer>(), material);
        }

        private static MeshRenderer CreateHorizontalSegment(Transform parent, string name, Vector3 start, Vector3 end,
            float width, float thickness, Material material, float yOffset = 0f)
        {
            Vector3 delta = end - start;
            float length = new Vector2(delta.x, delta.z).magnitude;
            GameObject segment = GameObject.CreatePrimitive(PrimitiveType.Cube);
            segment.name = name;
            segment.layer = DecorationLayer;
            segment.transform.SetParent(parent, false);
            segment.transform.localPosition = (start + end) * 0.5f + Vector3.up * yOffset;
            segment.transform.localRotation = Quaternion.Euler(0f, Mathf.Atan2(delta.x, delta.z) * Mathf.Rad2Deg, 0f);
            segment.transform.localScale = new Vector3(width, thickness, Mathf.Max(0.001f, length));
            RemoveCollider(segment);
            MeshRenderer renderer = segment.GetComponent<MeshRenderer>();
            ApplyRenderer(renderer, material, false);
            return renderer;
        }

        private static MeshRenderer CreateVerticalSegment(Transform parent, string name, Vector2 start, Vector2 end,
            float width, float thickness, float z, Material material)
        {
            Vector2 delta = end - start;
            GameObject segment = GameObject.CreatePrimitive(PrimitiveType.Cube);
            segment.name = name;
            segment.layer = DecorationLayer;
            segment.transform.SetParent(parent, false);
            segment.transform.localPosition = new Vector3((start.x + end.x) * 0.5f, (start.y + end.y) * 0.5f, z);
            segment.transform.localRotation = Quaternion.Euler(0f, 0f, Mathf.Atan2(-delta.x, delta.y) * Mathf.Rad2Deg);
            segment.transform.localScale = new Vector3(width, Mathf.Max(0.001f, delta.magnitude), thickness);
            RemoveCollider(segment);
            MeshRenderer renderer = segment.GetComponent<MeshRenderer>();
            ApplyRenderer(renderer, material, false);
            return renderer;
        }

        private static void SetupPrimitive(GameObject obj, Transform parent, Vector3 localPosition, Vector3 localRotation,
            Vector3 localScale, Material material)
        {
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);
            obj.transform.localPosition = localPosition;
            obj.transform.localRotation = Quaternion.Euler(localRotation);
            obj.transform.localScale = localScale;
            RemoveCollider(obj);
            ApplyRenderer(obj.GetComponent<MeshRenderer>(), material);
        }

        private static void ApplyRenderer(MeshRenderer renderer, Material material, bool receiveShadows = true)
        {
            if (renderer == null) return;
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.TwoSided;
            renderer.receiveShadows = receiveShadows;
        }

        private static void RemoveCollider(GameObject obj)
        {
            Collider collider = obj.GetComponent<Collider>();
            if (collider == null) return;
            if (Application.isPlaying) Destroy(collider);
            else DestroyImmediate(collider);
        }

        private static Mesh CreateRingPrismMesh(float innerRadius, float outerRadius, float height, int segments, string name)
        {
            Mesh mesh = new() { name = name };
            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            int seed = StableHash(name);
            bool narrowBand = outerRadius - innerRadius < 0.12f;
            float edgeJitter = outerRadius > 0.8f ? 0.030f : 0.009f;
            float[] outerRadii = new float[segments];
            float[] innerRadii = new float[segments];
            float[] topHeights = new float[segments];

            for (int i = 0; i < segments; i++)
            {
                float edgeNoise = StableNoise(i, seed);
                if ((i + Mathf.Abs(seed)) % 13 == 0) edgeNoise -= 1.15f;
                float edgeOffset = edgeNoise * edgeJitter;
                outerRadii[i] = outerRadius + edgeOffset;
                innerRadii[i] = innerRadius + edgeOffset * (narrowBand ? 0.82f : 0.28f)
                    + StableNoise(i + 91, seed) * edgeJitter * 0.22f;
                topHeights[i] = height + StableNoise(i + 177, seed) * (outerRadius > 0.8f ? 0.006f : 0.002f);
            }

            for (int i = 0; i < segments; i++)
            {
                int next = (i + 1) % segments;
                float a0 = i * Mathf.PI * 2f / segments;
                float a1 = next * Mathf.PI * 2f / segments;

                Vector3 in0 = new(Mathf.Sin(a0) * innerRadii[i], topHeights[i], Mathf.Cos(a0) * innerRadii[i]);
                Vector3 out0 = new(Mathf.Sin(a0) * outerRadii[i], topHeights[i], Mathf.Cos(a0) * outerRadii[i]);
                Vector3 out1 = new(Mathf.Sin(a1) * outerRadii[next], topHeights[next], Mathf.Cos(a1) * outerRadii[next]);
                Vector3 in1 = new(Mathf.Sin(a1) * innerRadii[next], topHeights[next], Mathf.Cos(a1) * innerRadii[next]);
                AddQuad(vertices, normals, uvs, triangles, in0, out0, out1, in1, Vector3.up);

                Vector3 bin0 = new(in0.x, 0f, in0.z);
                Vector3 bout0 = new(out0.x, 0f, out0.z);
                Vector3 bout1 = new(out1.x, 0f, out1.z);
                Vector3 bin1 = new(in1.x, 0f, in1.z);
                AddQuad(vertices, normals, uvs, triangles, bin0, bin1, bout1, bout0, Vector3.down);

                Vector3 outerNormal = new(Mathf.Sin((a0 + a1) * 0.5f), 0f, Mathf.Cos((a0 + a1) * 0.5f));
                AddQuad(vertices, normals, uvs, triangles, bout0, out0, out1, bout1, outerNormal);
                AddQuad(vertices, normals, uvs, triangles, bin1, in1, in0, bin0, -outerNormal);
            }

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static int StableHash(string value)
        {
            unchecked
            {
                int hash = 23;
                for (int i = 0; i < value.Length; i++) hash = hash * 31 + value[i];
                return hash;
            }
        }

        private static float StableNoise(int sample, int seed)
        {
            unchecked
            {
                uint value = (uint)(sample * 374761393 + seed * 668265263);
                value = (value ^ (value >> 13)) * 1274126177u;
                value ^= value >> 16;
                return (value & 0xFFFFu) / 32767.5f - 1f;
            }
        }

        private static void AddQuad(List<Vector3> vertices, List<Vector3> normals, List<Vector2> uvs,
            List<int> triangles, Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 normal)
        {
            int index = vertices.Count;
            vertices.Add(a); vertices.Add(b); vertices.Add(c); vertices.Add(d);
            normals.Add(normal); normals.Add(normal); normals.Add(normal); normals.Add(normal);
            uvs.Add(new Vector2(0f, 0f)); uvs.Add(new Vector2(1f, 0f));
            uvs.Add(new Vector2(1f, 1f)); uvs.Add(new Vector2(0f, 1f));
            triangles.Add(index); triangles.Add(index + 1); triangles.Add(index + 2);
            triangles.Add(index); triangles.Add(index + 2); triangles.Add(index + 3);
        }

        private static void AddTriangle(List<Vector3> vertices, List<Vector3> normals, List<Vector2> uvs,
            List<int> triangles, Vector3 a, Vector3 b, Vector3 c, Vector3 normal)
        {
            int index = vertices.Count;
            vertices.Add(a); vertices.Add(b); vertices.Add(c);
            normals.Add(normal); normals.Add(normal); normals.Add(normal);
            uvs.Add(new Vector2(0.5f, 0.5f)); uvs.Add(Vector2.one); uvs.Add(Vector2.zero);
            triangles.Add(index); triangles.Add(index + 1); triangles.Add(index + 2);
        }

        private static Mesh CreateRuneStoneMesh(float width, float height, float depth, int variant)
        {
            float variantOffset = (variant - 1.5f) * 0.018f;
            Vector2[] outline =
            {
                new(-0.46f, 0.01f),
                new(0.36f + variantOffset, 0f),
                new(0.49f, 0.18f),
                new(0.43f - variantOffset, 0.54f),
                new(0.29f, 0.78f),
                new(0.09f + variantOffset, 1.00f),
                new(-0.13f, 0.95f),
                new(-0.35f + variantOffset, 0.78f),
                new(-0.50f, 0.51f),
                new(-0.47f - variantOffset, 0.17f)
            };

            int count = outline.Length;
            Vector3[] face = new Vector3[count];
            Vector3[] rim = new Vector3[count];
            Vector3[] back = new Vector3[count];
            float frontZ = -depth * 0.56f;
            float rimZ = -depth * 0.30f;
            float backZ = depth * 0.50f;

            for (int i = 0; i < count; i++)
            {
                float x = outline[i].x * width;
                float y = outline[i].y * height;
                rim[i] = new Vector3(x, y, rimZ);
                back[i] = new Vector3(x * 0.94f, y * 0.97f + height * 0.008f, backZ);
                face[i] = new Vector3(x * 0.82f, (y - height * 0.46f) * 0.88f + height * 0.48f, frontZ);
            }

            Mesh mesh = new() { name = $"RuneStone_ChiseledMenhir_{variant + 1}" };
            List<Vector3> vertices = new();
            List<Vector3> normals = new();
            List<Vector2> uvs = new();
            List<int> triangles = new();

            Vector3 faceCenter = Vector3.zero;
            Vector3 backCenter = Vector3.zero;
            for (int i = 0; i < count; i++)
            {
                faceCenter += face[i];
                backCenter += back[i];
            }
            faceCenter /= count;
            backCenter /= count;

            for (int i = 0; i < count; i++)
            {
                int next = (i + 1) % count;
                AddTriangle(vertices, normals, uvs, triangles, faceCenter, face[next], face[i], Vector3.back);
                AddTriangle(vertices, normals, uvs, triangles, backCenter, back[i], back[next], Vector3.forward);

                Vector3 edge = (rim[i] + rim[next]) * 0.5f;
                Vector3 bevelNormal = new Vector3(edge.x / Mathf.Max(0.001f, width), edge.y / Mathf.Max(0.001f, height) - 0.45f, -0.75f).normalized;
                AddQuad(vertices, normals, uvs, triangles, face[i], rim[i], rim[next], face[next], bevelNormal);

                Vector3 sideNormal = Vector3.Cross(back[next] - rim[i], back[i] - rim[next]).normalized;
                if (Vector3.Dot(sideNormal, new Vector3(edge.x, edge.y - height * 0.45f, 0f)) < 0f) sideNormal = -sideNormal;
                AddQuad(vertices, normals, uvs, triangles, rim[i], back[i], back[next], rim[next], sideNormal);
            }

            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private void ClearChildren()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                GameObject child = transform.GetChild(i).gameObject;
                if (Application.isPlaying)
                {
                    child.transform.SetParent(null);
                    Destroy(child);
                }
                else
                {
                    DestroyImmediate(child);
                }
            }
        }

        private void ClearCaches()
        {
            dynamicStoneRoot = null;
            outerRunes.Clear();
            runeStones.Clear();
        }

        private void StopStoneTransition()
        {
            if (stoneTransitionRoutine == null) return;
            StopCoroutine(stoneTransitionRoutine);
            stoneTransitionRoutine = null;
        }

        private void StopRuneSequence()
        {
            if (runeSequenceRoutine == null) return;
            StopCoroutine(runeSequenceRoutine);
            runeSequenceRoutine = null;
        }

        private void StopGrantRoutine()
        {
            if (grantRoutine == null) return;
            StopCoroutine(grantRoutine);
            grantRoutine = null;
        }

        private void StopAllManagedCoroutines()
        {
            if (!Application.isPlaying) return;
            StopStoneTransition();
            StopRuneSequence();
            StopGrantRoutine();
        }
    }
}