using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.Networking;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Tessera.Core;
using Tessera.Dice;
using Tessera.Tabletop;

namespace Tessera.Games.AugmentedYacht
{
    public sealed class AugmentedYachtController : MonoBehaviour
    {
        [Header("Source assets")]
        [SerializeField] private GameObject diceModel;
        [SerializeField] private Mesh yachtTrayMesh;
        [SerializeField] private Texture2D playmatTexture;

        [Header("Rendering")]
        [SerializeField] private Shader upscaleShader;
        [SerializeField] private Vector2Int internalResolution = new(640, 360);

        [Header("Game Settings")]
        [SerializeField, Min(1)] private int diceCount = 5;
        [SerializeField] private DieType selectedDieType = DieType.Normal;
        [SerializeField] private bool editableLayoutBuilt;

        private readonly List<GameObject> activeDice = new();
        private readonly List<bool> keptDice = new();
        private readonly List<int> diceValues = new();
        private readonly List<int> keptSlotIndices = new();

        private Material diceBodyMaterial;
        private Material dicePipMaterial;

        private DicePresetCatalog presetCatalog;
        private BakedDiceController bakedDiceController;
        private AudioSource audioSource;
        private readonly List<AudioClip> rollAudioClips = new();
        private readonly List<AudioClip> impactAudioClips = new();

        private Camera worldCamera;
        private Camera presentationCamera;
        private RenderTexture lowResolutionTarget;
        private RawImage gameImage;
        private Material upscaleMaterial;
        private Text statusText;
        private RectTransform gameAreaRect;
        private RectTransform gameImageRect;
        private Transform layoutRoot;
        private Transform diceRoot;
        private ParchmentScoreSheet parchmentScoreSheet;
        private AugmentCardTray augmentCardTray;
        private RollOrb rollOrb;
        private RerollCounterBar rerollCounterBar;
        private HourglassTimer hourglassTimer;

        public ParchmentScoreSheet ScoreSheet => parchmentScoreSheet;
        public AugmentCardTray CardTray => augmentCardTray;
        public RollOrb RollOrb => rollOrb;
        public RerollCounterBar RerollCounter => rerollCounterBar;
        public HourglassTimer Hourglass => hourglassTimer;

        private Coroutine rollRoutine;
        private Coroutine keepRoutine;
        private Button keyLightToggleButton;
        private int rollIndex;
        private bool hasCompletedRoll;
        private bool isArranging;
        private int hoveredDieIndex = -1;

        private readonly (string name, Color color, float intensity)[] keyLightPresets = new[]
        {
            ("Pure White", new Color(1.00f, 1.00f, 1.00f), 1.25f),
            ("Warm Amber", new Color(1.00f, 0.62f, 0.23f), 1.50f),
            ("Soft Neutral", new Color(1.00f, 0.88f, 0.74f), 1.35f),
            ("Cool Moon", new Color(0.55f, 0.70f, 0.95f), 1.35f),
            ("Cozy Candle", new Color(1.00f, 0.48f, 0.16f), 1.55f)
        };
        private int currentKeyLightPresetIndex = 1; // Warm Amber 기본 시작

        private static readonly Vector2Int ResolutionA = new(960, 540);
        private static readonly Vector2Int ResolutionB = new(640, 360);
        private static readonly Vector2Int OutputResolution = new(1920, 1080);
        private static readonly Color DarkCharcoalBackground = new(0.06f, 0.05f, 0.07f);

        private const float TableWidth = 15.6f;
        private const float LeftSectionWidth = TableWidth * 0.25f;
        private const float CenterSectionWidth = TableWidth * 0.45f;
        private const float RightSectionWidth = TableWidth * 0.3f;
        private const float CenterSectionX = -TableWidth * 0.5f + LeftSectionWidth + CenterSectionWidth * 0.5f;
        private const float TrayScale = 0.05f;
        private const float RollSurfaceY = 0.2f;
        private const float TrayVisualY = RollSurfaceY + 10.283531f * TrayScale;
        private const int DiceLayer = 8;
        private const int DecorationLayer = 11;

        public bool IsSettled => hasCompletedRoll && !isArranging && rollRoutine == null;
        public int KeptDieCount => keptDice.FindAll(kept => kept).Count;

        public int GetDieValue(int index)
        {
            return index >= 0 && index < diceValues.Count ? diceValues[index] : 0;
        }

        public void BuildEditableLayout(bool forceRebuild = false)
        {
            if (Application.isPlaying) return;
            if (!forceRebuild && editableLayoutBuilt && ResolveEditableLayout()) return;

            if (upscaleShader == null)
            {
#if UNITY_EDITOR
                upscaleShader = UnityEditor.AssetDatabase.LoadAssetAtPath<Shader>("Assets/Rendering/Shaders/DicePixelUpscale.shader")
                    ?? Shader.Find("DicePoC/PixelUpscale");
#else
                upscaleShader = Shader.Find("DicePoC/PixelUpscale");
#endif
            }

            // 부모 transform 아래의 기존 모든 프레젠테이션 및 레이아웃 오브젝트 전수 제거
            List<GameObject> toDestroy = new();
            for (int i = 0; i < transform.childCount; i++)
            {
                Transform child = transform.GetChild(i);
                if (child != null && (child.name.Contains("Pixel Presentation") || child.name.Contains("Graphics Layout") || child.name.Contains("Display 1 Camera")))
                {
                    toDestroy.Add(child.gameObject);
                }
            }
            foreach (GameObject go in toDestroy)
            {
                if (Application.isPlaying) Destroy(go);
                else DestroyImmediate(go);
            }

            BuildWorld();
            BuildPresentation();
            editableLayoutBuilt = true;
        }

        public void UpgradeYachtTrayLayout(Mesh trayMesh)
        {
            if (Application.isPlaying || trayMesh == null) return;
            yachtTrayMesh = trayMesh;
            EnsureLayoutRoot();
            CreateGameTray();
            ApplyTopDownCamera();
            ConfigureLighting();
            editableLayoutBuilt = true;
        }

        private void CreateGameTray()
        {
            Transform existing = layoutRoot != null ? layoutRoot.Find("Yacht Tray Visual") : null;
            if (existing != null)
            {
                if (Application.isPlaying) Destroy(existing.gameObject);
                else DestroyImmediate(existing.gameObject);
            }
            CreateYachtTrayVisual();
        }

        private void Awake()
        {
            QualitySettings.antiAliasing = 0;
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = 60;
            Application.runInBackground = true;

            EnsureDiceMaterials();

            if (diceModel == null)
            {
#if UNITY_EDITOR
                diceModel = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Reference/normal_dice.fbx");
#endif
            }

            if (!editableLayoutBuilt || !ResolveEditableLayout())
            {
                BuildWorld();
                BuildPresentation();
            }
            else
            {
                EnsureEventSystem();
                BindPresentationActions();
                CreateRenderTarget();
            }

            ApplyRenderSettings();
            ConfigureLighting();
            SyncTrayVisualMat();
            EnsureSingleAudioListener();
            InitializeAudio();
            InitializePresetCatalog();
            InitializeBakedController();
            EnsureDiceRoot();
            EnsureDiceState();

            if (parchmentScoreSheet == null) parchmentScoreSheet = FindFirstObjectByType<ParchmentScoreSheet>();
            if (parchmentScoreSheet != null)
            {
                parchmentScoreSheet.RefreshAllScores();
            }

            if (rollOrb == null) rollOrb = FindFirstObjectByType<RollOrb>();
            if (rollOrb != null)
            {
                rollOrb.BuildGeometry();
            }

            if (rerollCounterBar == null) rerollCounterBar = FindFirstObjectByType<RerollCounterBar>();
            if (rerollCounterBar != null)
            {
                rerollCounterBar.BuildGeometry();
                rerollCounterBar.SetRollsRemaining(3, 3);
            }

            if (hourglassTimer == null) hourglassTimer = FindFirstObjectByType<HourglassTimer>();
            if (hourglassTimer != null)
            {
                hourglassTimer.BuildGeometry();
            }
        }

        private void EnsureDiceMaterials()
        {
            diceBodyMaterial = DicePaletteCatalog.GetBodyMaterial(selectedDieType);
            dicePipMaterial = DicePaletteCatalog.GetPipMaterial(selectedDieType);
        }

        public void SetDieType(DieType type)
        {
            selectedDieType = type;
            EnsureDiceMaterials();
            foreach (GameObject die in activeDice)
            {
                if (die == null) continue;
                Transform visual = die.transform.Find("Visual");
                if (visual != null)
                {
                    ApplyDiceMaterialsToFbx(visual.gameObject);
                }
            }
        }

        private void OnValidate()
        {
            if (Application.isPlaying && activeDice.Count > 0)
            {
                SetDieType(selectedDieType);
            }
#if UNITY_EDITOR
            if (!Application.isPlaying)
            {
                SyncTableBackground();
                SyncTrayVisualMat();
                ApplyRenderSettings();
            }
#endif
        }

#if UNITY_EDITOR
        private void OnEnable()
        {
            if (!Application.isPlaying)
            {
                SyncTableBackground();
                SyncTrayVisualMat();
                ApplyRenderSettings();
            }
        }
#endif

        public void SyncTrayVisualMat()
        {
            GameObject trayObj = GameObject.Find("Yacht Tray Visual");
            if (trayObj == null) return;
            MeshFilter mf = trayObj.GetComponent<MeshFilter>();
            MeshRenderer mr = trayObj.GetComponent<MeshRenderer>();
            if (mf == null || mr == null) return;

            Mesh mesh = mf.sharedMesh;
            if (mesh != null && (mesh.uv == null || mesh.uv.Length == 0))
            {
                Mesh copy = Instantiate(mesh);
                Vector3[] verts = copy.vertices;
                Vector3[] norms = copy.normals;
                Vector2[] uvs = new Vector2[verts.Length];
                for (int i = 0; i < verts.Length; i++)
                {
                    Vector3 v = verts[i];
                    Vector3 n = (norms != null && i < norms.Length) ? norms[i] : Vector3.up;
                    if (Mathf.Abs(n.y) >= 0.7f)
                        uvs[i] = new Vector2(v.x * (1f / 50f), v.z * (1f / 50f));
                    else
                        uvs[i] = new Vector2((Mathf.Abs(n.x) > Mathf.Abs(n.z) ? v.z : v.x) * (1f / 50f), v.y * (1f / 50f));
                }
                copy.uv = uvs;
                mf.sharedMesh = copy;
            }

            Texture2D corduroyTex = CreateBurgundyCorduroyTexture();
            Material[] mats = mr.sharedMaterials;
            if (mats != null && mats.Length >= 2)
            {
                Material felt = mats[1];
                if (felt != null)
                {
                    felt.mainTexture = corduroyTex;
                    if (felt.HasProperty("_BaseMap")) felt.SetTexture("_BaseMap", corduroyTex);
                    if (felt.HasProperty("_MainTex")) felt.SetTexture("_MainTex", corduroyTex);
                    if (felt.HasProperty("_BaseColor")) felt.SetColor("_BaseColor", Color.white);
                    if (felt.HasProperty("_Color")) felt.SetColor("_Color", Color.white);
                    felt.mainTextureScale = new Vector2(1f, 1f);
                    felt.color = Color.white;
                    felt.SetFloat("_Smoothness", 0.12f);
                }
            }
        }

        [ContextMenu("Rebuild Layout")]
        public void RebuildLayoutMenu()
        {
            EnsureLayoutRoot();
            BuildTableLayout();
            ApplyTopDownCamera();
            ConfigureLighting();
            SyncTrayVisualMat();
            if (parchmentScoreSheet != null)
            {
                parchmentScoreSheet.EnsureStructure();
                parchmentScoreSheet.RefreshAllScores();
            }
            editableLayoutBuilt = true;
        }

        private void Start()
        {
            SyncTrayVisualMat();
            StartCoroutine(LoadSoundsAsync());
        }

        private void InitializeAudio()
        {
            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
                audioSource.playOnAwake = false;
                audioSource.spatialBlend = 0f;
            }
        }

        private void InitializePresetCatalog()
        {
            presetCatalog = DicePresetCatalog.LoadAll();
            if (!presetCatalog.IsLoaded)
            {
                presetCatalog = DicePresetCatalog.LoadNormalFiveDice();
            }
            Debug.Log($"Preset Catalog loaded: {presetCatalog.NormalFiveDiceClipCount} clips available.");
        }

        private void InitializeBakedController()
        {
            bakedDiceController = GetComponent<BakedDiceController>();
            if (bakedDiceController == null)
            {
                bakedDiceController = gameObject.AddComponent<BakedDiceController>();
            }
        }

        private IEnumerator LoadSoundsAsync()
        {
            string soundsPath = Path.Combine(Application.streamingAssetsPath, "WebSource", "sounds");
            if (!Directory.Exists(soundsPath)) yield break;

            string[] rollFiles = { "dice_roll.mp3", "dice-throw-1.ogg", "dice-throw-2.ogg", "dice-throw-3.ogg" };
            string[] impactFiles = { "die-throw-1.ogg", "die-throw-2.ogg", "die-throw-3.ogg", "die-throw-4.ogg" };

            foreach (string file in rollFiles)
            {
                string path = Path.Combine(soundsPath, file);
                if (File.Exists(path))
                {
                    yield return LoadAudioClip(path, clip => rollAudioClips.Add(clip));
                }
            }

            foreach (string file in impactFiles)
            {
                string path = Path.Combine(soundsPath, file);
                if (File.Exists(path))
                {
                    yield return LoadAudioClip(path, clip => impactAudioClips.Add(clip));
                }
            }

            bakedDiceController.SetAudioSource(audioSource, rollAudioClips.ToArray(), impactAudioClips.ToArray());
        }

        private static IEnumerator LoadAudioClip(string filePath, Action<AudioClip> onLoaded)
        {
            string uri = "file://" + filePath.Replace("\\", "/");
            AudioType audioType = filePath.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase)
                ? AudioType.MPEG
                : AudioType.OGGVORBIS;

            using UnityWebRequest uwr = UnityWebRequestMultimedia.GetAudioClip(uri, audioType);
            yield return uwr.SendWebRequest();

            if (uwr.result == UnityWebRequest.Result.Success)
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(uwr);
                if (clip != null)
                {
                    clip.name = Path.GetFileNameWithoutExtension(filePath);
                    onLoaded?.Invoke(clip);
                }
            }
        }

        private void EnsureDiceRoot()
        {
            if (diceRoot != null) return;
            GameObject root = GameObject.Find("Dice Visual Root");
            if (root == null)
            {
                root = new GameObject("Dice Visual Root");
                root.transform.SetParent(layoutRoot != null ? layoutRoot : transform, false);
                root.transform.position = new Vector3(CenterSectionX, 0f, 0f);
                root.transform.rotation = Quaternion.identity;
                root.transform.localScale = Vector3.one;
            }
            diceRoot = root.transform;
        }

        private void EnsureDiceState()
        {
            if (activeDice.Count == diceCount && keptDice.Count == diceCount && diceValues.Count == diceCount)
            {
                return;
            }

            foreach (GameObject die in activeDice)
            {
                if (die != null) Destroy(die);
            }
            activeDice.Clear();
            keptDice.Clear();
            diceValues.Clear();
            keptSlotIndices.Clear();

            EnsureDiceRoot();
            for (int index = 0; index < diceCount; index++)
            {
                GameObject die = CreateVisualDie(index + 1);
                activeDice.Add(die);
                keptDice.Add(false);
                diceValues.Add(index + 1); // 기본 1~5 눈 설정
                keptSlotIndices.Add(-1);
            }

            hasCompletedRoll = false;
            ArrangeDiceInitialPositions();
        }

        private GameObject CreateVisualDie(int index)
        {
            GameObject root = new($"Die_{index}", typeof(BoxCollider), typeof(DiceKeepTarget));
            root.layer = DiceLayer;
            root.transform.SetParent(diceRoot, false);
            root.transform.localPosition = Vector3.zero;
            root.transform.localRotation = Quaternion.identity;
            root.transform.localScale = Vector3.one * DiceBoardMetrics.DieSize;

            if (diceModel != null)
            {
                GameObject visual = Instantiate(diceModel, root.transform);
                visual.name = "Visual";
                DisableImportedSceneComponents(visual);
                visual.transform.localPosition = Vector3.zero;

                // FBX 자체의 isometric 기울기(333, 318, 0)를 0도로 직교 보정
                Quaternion baseCorrection = DiceFaceOrientation.MeasureModelBasis(visual.transform);
                visual.transform.localRotation = baseCorrection;

                // 로컬 메쉬 바운드 기준으로 정확히 1단위 큐브로 정규화
                NormalizeVisual(visual.transform, 1.0f);
                ApplyDiceMaterialsToFbx(visual);
                SetLayerRecursively(root, DiceLayer);
            }
            else
            {
                Mesh mesh = DiceMeshFactory.Create();
                MeshFilter mf = root.AddComponent<MeshFilter>();
                MeshRenderer mr = root.AddComponent<MeshRenderer>();
                mf.sharedMesh = mesh;
                mr.sharedMaterials = DiceMaterialFactory.GetNormalMaterials();
                mr.shadowCastingMode = ShadowCastingMode.On;
                mr.receiveShadows = false;
                DiceMaterialFactory.AttachFaceOverlays(root.transform);
            }

            BoxCollider collider = root.GetComponent<BoxCollider>();
            collider.size = Vector3.one;
            collider.center = Vector3.zero;

            DiceKeepTarget target = root.GetComponent<DiceKeepTarget>();
            target.Index = index - 1;

            return root;
        }

        private static void NormalizeVisual(Transform visual, float targetLocalSize = 1.0f)
        {
            visual.localPosition = Vector3.zero;
            // 큐브 원본 규격 크기(DiceBoardMetrics.SourceDiceSize = 1.62f) 기준으로 고정 정규화하여 모델링 변경 시 크기 오차 방지
            float rawBodySize = DiceBoardMetrics.SourceDiceSize;
            visual.localScale = Vector3.one * (targetLocalSize / rawBodySize);
        }

        private void ApplyDiceMaterialsToFbx(GameObject visual)
        {
            EnsureDiceMaterials();

            // 솔리드 그림자 프록시(ShadowProxy) 확인 및 설정 (음각 홈으로 인한 그림자 구멍 완전 차단)
            EnsureShadowProxy(visual.transform);

            foreach (Renderer renderer in visual.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name.Equals("ShadowProxy", StringComparison.OrdinalIgnoreCase))
                {
                    renderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
                    renderer.receiveShadows = false;
                    renderer.sharedMaterial = diceBodyMaterial;
                    continue;
                }

                if (renderer.name.StartsWith("Pip", StringComparison.OrdinalIgnoreCase))
                {
                    renderer.sharedMaterial = dicePipMaterial;
                    renderer.shadowCastingMode = ShadowCastingMode.Off; // Pip 메시 그림자 캐스팅 제외
                }
                else
                {
                    // Plain_D6 몸체: 슬롯 0(바탕 Body), 슬롯 1(음각 홈 내부 Pip)
                    if (renderer.sharedMaterials != null && renderer.sharedMaterials.Length > 1)
                    {
                        renderer.sharedMaterials = new Material[] { diceBodyMaterial, dicePipMaterial };
                    }
                    else
                    {
                        renderer.sharedMaterial = diceBodyMaterial;
                    }
                    renderer.shadowCastingMode = ShadowCastingMode.Off; // 시각 메시는 렌더 전용, 그림자는 프록시가 담당
                }

                renderer.receiveShadows = false;
                renderer.lightProbeUsage = LightProbeUsage.Off;
                renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
            }
        }

        private static void EnsureShadowProxy(Transform visual)
        {
            Transform existing = visual.Find("ShadowProxy");
            if (existing != null) return;

            GameObject proxy = GameObject.CreatePrimitive(PrimitiveType.Cube);
            proxy.name = "ShadowProxy";
            proxy.transform.SetParent(visual, false);
            proxy.transform.localPosition = Vector3.zero;
            proxy.transform.localRotation = Quaternion.identity;
            proxy.transform.localScale = Vector3.one * DiceBoardMetrics.SourceDiceSize;

            Collider col = proxy.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }

            MeshRenderer mr = proxy.GetComponent<MeshRenderer>();
            mr.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
            mr.receiveShadows = false;
        }

        private static void SetLayerRecursively(GameObject root, int layer)
        {
            root.layer = layer;
            foreach (Transform child in root.transform) SetLayerRecursively(child.gameObject, layer);
        }

        private static void DisableImportedSceneComponents(GameObject visual)
        {
            foreach (Camera cam in visual.GetComponentsInChildren<Camera>(true)) cam.enabled = false;
            foreach (Light l in visual.GetComponentsInChildren<Light>(true)) l.enabled = false;
            foreach (AudioListener al in visual.GetComponentsInChildren<AudioListener>(true)) al.enabled = false;
            foreach (Collider c in visual.GetComponentsInChildren<Collider>(true)) Destroy(c);
        }

        private void ArrangeDiceInitialPositions()
        {
            for (int i = 0; i < activeDice.Count; i++)
            {
                if (activeDice[i] == null) continue;
                Vector3 targetPos = DiceBoardMetrics.GetActivePosition(i, activeDice.Count);
                activeDice[i].transform.localPosition = targetPos;
                activeDice[i].transform.localScale = Vector3.one * DiceBoardMetrics.ActiveDieSize;
                Quaternion targetRot = DiceFaceOrientation.GetCameraFacingRotation(diceValues[i], 75.0f);
                activeDice[i].transform.localRotation = targetRot;

                Transform visual = activeDice[i].transform.Find("Visual");
                if (visual != null)
                {
                    visual.localRotation = DiceFaceOrientation.MeasureModelBasis(visual);
                }
                else
                {
                    DiceMaterialFactory.ApplyPredictedTopValue(activeDice[i].transform, targetRot, diceValues[i]);
                }
            }
        }

        public void RollDice()
        {
            if (rollRoutine != null || isArranging) return;
            if (keptDice.Count > 0 && keptDice.TrueForAll(kept => kept))
            {
                UpdateStatusText("모든 주사위가 킵되어 있습니다.");
                return;
            }

            rollRoutine = StartCoroutine(PerformBakedRollSequence());
        }

        public void ResetAndRollDice()
        {
            if (rollRoutine != null)
            {
                StopCoroutine(rollRoutine);
                rollRoutine = null;
            }
            if (keepRoutine != null)
            {
                StopCoroutine(keepRoutine);
                keepRoutine = null;
            }

            for (int i = 0; i < keptDice.Count; i++)
            {
                keptDice[i] = false;
            }

            rollRoutine = StartCoroutine(PerformBakedRollSequence());
        }

        private IEnumerator PerformBakedRollSequence()
        {
            isArranging = false;
            hasCompletedRoll = false;
            SetRollInteraction(false);
            hoveredDieIndex = -1;
            rollIndex++;

            // 첫 굴림 / 턴 시작 시 모래시계 타이머 자동 가동 (60초)
            if (hourglassTimer != null && !hourglassTimer.IsRunning && !hourglassTimer.IsFlipping)
            {
                hourglassTimer.StartTimer(60f);
            }

            // 수정구 황도 12궁 다음 별자리로 순차 전환 (부드러운 크로스페이드)
            if (rollOrb != null)
            {
                rollOrb.AdvanceZodiac();
            }

            // 1. 결정론적 타겟 눈 생성 (1~6)
            for (int i = 0; i < diceCount; i++)
            {
                if (!keptDice[i])
                {
                    diceValues[i] = UnityEngine.Random.Range(1, 7);
                }
            }

            // 2. 프리셋 클립 선택 (인덱스 순환/랜덤 + 좌우 미러링)
            int clipIndex = UnityEngine.Random.Range(0, Mathf.Max(1, presetCatalog.NormalFiveDiceClipCount));
            presetCatalog.TryGetClip(clipIndex, out WebPresetClip clip);
            bool isMirrored = UnityEngine.Random.value < 0.5f;

            List<int> rolledValues = new();
            List<int> keptValues = new();
            for (int i = 0; i < diceCount; i++)
            {
                if (keptDice[i]) keptValues.Add(diceValues[i]);
                else rolledValues.Add(diceValues[i]);
            }
            Debug.Log($"<color=#2EA3FF>[주사위 굴림 #{rollIndex}]</color> Preset #{clipIndex + 1} (미러링: {isMirrored}) | 굴린 눈: [{string.Join(", ", rolledValues)}], 킵된 눈: [{string.Join(", ", keptValues)}], 전체 결과: [{string.Join(", ", diceValues)}]");

            UpdateStatusText($"주사위 굴리는 중... (Preset #{clipIndex + 1})");

            // 3. Transform 리스트 수집 및 스케일 보장
            var diceTransforms = new Transform[activeDice.Count];
            for (int i = 0; i < activeDice.Count; i++)
            {
                if (activeDice[i] != null)
                {
                    activeDice[i].transform.localScale = Vector3.one * DiceBoardMetrics.DieSize;
                    diceTransforms[i] = activeDice[i].transform;
                }
            }

            // 4. 프리셋 궤적 재생 (사운드 싱크 포함)
            yield return bakedDiceController.Play(
                diceTransforms,
                clipIndex,
                clip,
                keptDice,
                diceValues,
                isMirrored);

            // 5. 굴림 완료 후 보드 중앙 정렬 (작은 눈 -> 큰 눈 오름차순)
            yield return AnimateDiceLayout(0.45f);

            hasCompletedRoll = true;
            rollRoutine = null;
            SetRollInteraction(true);
            UpdateStatusText();
        }

        public bool SetDieKept(int index, bool kept)
        {
            if (!hasCompletedRoll || isArranging || rollRoutine != null) return false;
            if (index < 0 || index >= keptDice.Count || activeDice[index] == null) return false;
            if (keptDice[index] == kept) return true;

            keptDice[index] = kept;
            if (kept)
            {
                // 왼쪽부터 비어있는 가장 빠른 슬롯 탐색 (기존 킵 주사위를 밀어내지 않음)
                bool[] occupied = new bool[diceCount];
                for (int i = 0; i < diceCount; i++)
                {
                    if (keptDice[i] && i != index && keptSlotIndices.Count > i && keptSlotIndices[i] >= 0 && keptSlotIndices[i] < diceCount)
                    {
                        occupied[keptSlotIndices[i]] = true;
                    }
                }
                int targetSlot = 0;
                for (int s = 0; s < diceCount; s++)
                {
                    if (!occupied[s])
                    {
                        targetSlot = s;
                        break;
                    }
                }
                while (keptSlotIndices.Count <= index) keptSlotIndices.Add(-1);
                keptSlotIndices[index] = targetSlot;
            }
            else
            {
                if (keptSlotIndices.Count > index) keptSlotIndices[index] = -1;
            }

            if (keepRoutine != null) StopCoroutine(keepRoutine);
            keepRoutine = StartCoroutine(AnimateKeepToggleRoutine());
            return true;
        }

        public void ToggleKeep(int dieIndex)
        {
            if (dieIndex < 0 || dieIndex >= keptDice.Count) return;
            SetDieKept(dieIndex, !keptDice[dieIndex]);
        }

        private IEnumerator AnimateKeepToggleRoutine()
        {
            yield return AnimateDiceLayout(0.32f);
            keepRoutine = null;
        }

        private IEnumerator AnimateDiceLayout(float duration)
        {
            isArranging = true;

            var diceTransforms = new Transform[activeDice.Count];
            var targetPositions = new Vector3[activeDice.Count];
            var targetRotations = new Quaternion[activeDice.Count];
            var targetScales = new Vector3[activeDice.Count];

            var unkeptIndices = new List<int>();

            // 1. 킵된 주사위와 활성(킵되지 않은) 주사위 분류 및 카메라 정면 틸트 정렬 목표 회전 계산
            for (int i = 0; i < activeDice.Count; i++)
            {
                diceTransforms[i] = activeDice[i] != null ? activeDice[i].transform : null;
                float normalScale = DiceBoardMetrics.DieSize;

                // 현재 주사위 루트의 착지 회전으로부터 윗면(Top)을 유지한 채 카메라 렌즈를 정면으로 바라보도록 회전 계산
                Quaternion currentRot = activeDice[i] != null ? activeDice[i].transform.localRotation : Quaternion.identity;
                Quaternion cameraFacingRot = DiceFaceOrientation.GetCameraFacingUprightRotation(currentRot, 75.0f);

                if (keptDice[i])
                {
                    int slot = (keptSlotIndices.Count > i && keptSlotIndices[i] >= 0) ? keptSlotIndices[i] : 0;
                    targetPositions[i] = DiceBoardMetrics.GetKeepPosition(slot);
                    targetScales[i] = Vector3.one * (normalScale * DiceBoardMetrics.KeepDieScale);
                    targetRotations[i] = cameraFacingRot;
                }
                else
                {
                    unkeptIndices.Add(i);
                    targetRotations[i] = cameraFacingRot;
                }
            }

            // 2. 킵되지 않은 활성 주사위들을 왼쪽부터 오른쪽으로 작은 눈 -> 큰 눈 오름차순 정렬
            unkeptIndices.Sort((a, b) =>
            {
                int cmp = diceValues[a].CompareTo(diceValues[b]);
                return cmp != 0 ? cmp : a.CompareTo(b);
            });

            for (int slot = 0; slot < unkeptIndices.Count; slot++)
            {
                int dieIndex = unkeptIndices[slot];
                targetPositions[dieIndex] = DiceBoardMetrics.GetActivePosition(slot, unkeptIndices.Count);
                targetScales[dieIndex] = Vector3.one * DiceBoardMetrics.ActiveDieSize;
            }

            // 3. 머티리얼 방식 렌더러 fallback
            for (int i = 0; i < activeDice.Count; i++)
            {
                if (activeDice[i] == null) continue;
                Transform visual = activeDice[i].transform.Find("Visual");
                if (visual == null)
                {
                    DiceMaterialFactory.ApplyPredictedTopValue(activeDice[i].transform, targetRotations[i], diceValues[i]);
                }
            }

            // 4. 부드러운 위치/회전/스케일 보간 애니메이션 수행 (순수 Yaw 수평 슬라이딩)
            yield return bakedDiceController.AnimateKeptDice(
                diceTransforms,
                keptDice,
                diceValues,
                targetPositions,
                targetRotations,
                targetScales,
                duration);

            isArranging = false;
            UpdateStatusText();
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (keyboard.spaceKey.wasPressedThisFrame) RollDice();
                if (keyboard.f1Key.wasPressedThisFrame) SetResolution(ResolutionA);
                if (keyboard.f2Key.wasPressedThisFrame) SetResolution(ResolutionB);

                // 숫자키 1~8로 주사위 색상 팔레트 실시간 전환
                if (keyboard.digit1Key.wasPressedThisFrame || keyboard.numpad1Key.wasPressedThisFrame) SetDieType(DieType.Normal);
                if (keyboard.digit2Key.wasPressedThisFrame || keyboard.numpad2Key.wasPressedThisFrame) SetDieType(DieType.HeavyRed);
                if (keyboard.digit3Key.wasPressedThisFrame || keyboard.numpad3Key.wasPressedThisFrame) SetDieType(DieType.Golden);
                if (keyboard.digit4Key.wasPressedThisFrame || keyboard.numpad4Key.wasPressedThisFrame) SetDieType(DieType.Metal);
                if (keyboard.digit5Key.wasPressedThisFrame || keyboard.numpad5Key.wasPressedThisFrame) SetDieType(DieType.Sevens);
                if (keyboard.digit6Key.wasPressedThisFrame || keyboard.numpad6Key.wasPressedThisFrame) SetDieType(DieType.Couple);
                if (keyboard.digit7Key.wasPressedThisFrame || keyboard.numpad7Key.wasPressedThisFrame) SetDieType(DieType.Promotion);
                if (keyboard.digit8Key.wasPressedThisFrame || keyboard.numpad8Key.wasPressedThisFrame) SetDieType(DieType.Weird);
            }

            UpdateDicePointer();
            FitFullScreen();
        }

        private void UpdateDicePointer()
        {
            Mouse mouse = Mouse.current;
            if (mouse == null || worldCamera == null || activeDice.Count == 0)
            {
                hoveredDieIndex = -1;
                return;
            }

            Vector2 pointer = mouse.position.ReadValue();
            Vector3 viewport = new(
                Screen.width > 0 ? pointer.x / Screen.width : 0.5f,
                Screen.height > 0 ? pointer.y / Screen.height : 0.5f,
                0f);
            Ray ray = worldCamera.ViewportPointToRay(viewport);
            int hitIndex = -1;
            bool hitOrb = false;
            if (Physics.Raycast(ray, out RaycastHit hit, 50f))
            {
                DiceKeepTarget target = hit.collider.GetComponentInParent<DiceKeepTarget>();
                if (target != null) hitIndex = target.Index;

                RollOrb orb = hit.collider.GetComponentInParent<RollOrb>();
                if (orb != null) hitOrb = true;
            }

            if (rollOrb != null)
            {
                rollOrb.SetHovered(hitOrb);
            }

            if (hoveredDieIndex != hitIndex)
            {
                hoveredDieIndex = hitIndex;
                UpdateStatusText();
            }

            if (hitOrb && mouse.leftButton.wasPressedThisFrame)
            {
                OnRollOrbClicked();
            }

            if (hitIndex >= 0 && mouse.leftButton.wasPressedThisFrame)
            {
                ToggleKeep(hitIndex);
            }
        }

        private void OnRollOrbClicked()
        {
            if (rollRoutine != null || isArranging) return;
            if (keptDice.Count > 0 && keptDice.TrueForAll(kept => kept))
            {
                UpdateStatusText("모든 주사위가 킵되어 있습니다.");
                return;
            }

            if (rollOrb != null)
            {
                rollOrb.TriggerClickFeedback();
            }

            RollDice();
        }

        private void SetRollInteraction(bool interactable)
        {
            if (rollOrb != null)
            {
                rollOrb.SetInteractable(interactable);
            }
        }

        private void UpdateStatusText(string message = null)
        {
            if (statusText == null) return;
            int keptCount = keptDice.FindAll(kept => kept).Count;
            string interaction = hoveredDieIndex >= 0 && hasCompletedRoll && !isArranging
                ? (keptDice[hoveredDieIndex] ? "CLICK: UNKEEP" : "CLICK: KEEP")
                : $"KEEP {keptCount}/{diceCount}";

            string valuesSummary = hasCompletedRoll ? $" [ {string.Join(", ", diceValues)} ]" : "";
            string zodiacInfo = rollOrb != null ? $"  |  ★ {rollOrb.CurrentZodiacName}" : "";

            statusText.text = string.IsNullOrEmpty(message)
                ? $"{internalResolution.x} x {internalResolution.y}  |  {interaction}{valuesSummary}{zodiacInfo}  |  ORB / SPACE: ROLL"
                : $"{message}  |  {interaction}{valuesSummary}{zodiacInfo}";
        }

        public void ToggleResolution()
        {
            SetResolution(internalResolution == ResolutionA ? ResolutionB : ResolutionA);
        }

        public void ToggleKeyLightPreset()
        {
            currentKeyLightPresetIndex = (currentKeyLightPresetIndex + 1) % keyLightPresets.Length;
            ApplyKeyLightPreset();
        }

        public void ApplyKeyLightPreset()
        {
            var preset = keyLightPresets[currentKeyLightPresetIndex];
            Light key = GameObject.Find("Key Light")?.GetComponent<Light>();
            if (key != null)
            {
                key.color = preset.color;
                key.intensity = preset.intensity;
            }

            if (keyLightToggleButton != null)
            {
                Text label = keyLightToggleButton.GetComponentInChildren<Text>();
                if (label != null) label.text = $"Light: {preset.name}";
            }
        }

        private void SetResolution(Vector2Int resolution)
        {
            internalResolution = resolution;
            ApplyRenderSettings();
            if (parchmentScoreSheet != null) parchmentScoreSheet.SyncOverlayTransform();
        }

        private bool ResolveEditableLayout()
        {
            GameObject layoutObject = GameObject.Find("Graphics Layout");
            GameObject worldCameraObject = GameObject.Find("Full Field World Camera") ?? GameObject.Find("Low Resolution World Camera");
            GameObject displayCameraObject = GameObject.Find("Display 1 Camera");
            GameObject gameAreaObject = GameObject.Find("Game Area");
            GameObject imageObject = GameObject.Find("Point Upscale");
            GameObject statusObject = GameObject.Find("Status");

            if (layoutObject == null || worldCameraObject == null || displayCameraObject == null || gameAreaObject == null || imageObject == null)
            {
                return false;
            }

            layoutRoot = layoutObject.transform;
            worldCamera = worldCameraObject.GetComponent<Camera>();
            presentationCamera = displayCameraObject.GetComponent<Camera>();
            gameAreaRect = gameAreaObject.GetComponent<RectTransform>();
            gameImageRect = imageObject.GetComponent<RectTransform>();
            gameImage = imageObject.GetComponent<RawImage>();
            statusText = statusObject != null ? statusObject.GetComponent<Text>() : null;
            upscaleMaterial = gameImage != null ? gameImage.material : null;

            if (imageObject != null)
            {
                imageObject.SetActive(true);
            }

            EnsureSingleAudioListener();

            // 씬 내 테이블 요소들 안전 바인딩 또는 누락분 생성 (파괴 없이)
            EnsureTableLayoutElements();

            ApplyTopDownCamera();
            CreateRenderTarget();
            ApplyRenderSettings();
            return worldCamera != null && presentationCamera != null && gameImage != null;
        }

        private void EnsureSingleAudioListener()
        {
            if (worldCamera == null)
            {
                GameObject camObj = GameObject.Find("Full Field World Camera") ?? GameObject.Find("Low Resolution World Camera");
                if (camObj != null) worldCamera = camObj.GetComponent<Camera>();
            }

            AudioListener[] allListeners = Resources.FindObjectsOfTypeAll<AudioListener>();
            bool foundPrimary = false;
            foreach (AudioListener al in allListeners)
            {
                if (al == null) continue;
#if UNITY_EDITOR
                if (UnityEditor.EditorUtility.IsPersistent(al.gameObject)) continue;
#endif
                if (!foundPrimary && worldCamera != null && al.gameObject == worldCamera.gameObject)
                {
                    al.enabled = true;
                    foundPrimary = true;
                }
                else
                {
                    if (Application.isPlaying) Destroy(al);
                    else DestroyImmediate(al);
                }
            }

            if (!foundPrimary && worldCamera != null)
            {
                AudioListener al = worldCamera.GetComponent<AudioListener>();
                if (al == null) al = worldCamera.gameObject.AddComponent<AudioListener>();
                al.enabled = true;
            }
        }

        public void SyncTableBackground()
        {
            EnsureLayoutRoot();
            Transform existingMat = layoutRoot != null ? layoutRoot.Find("Solid Burgundy Game Mat") : null;
            if (existingMat != null)
            {
                if (Application.isPlaying) Destroy(existingMat.gameObject);
                else DestroyImmediate(existingMat.gameObject);
            }

            Transform existingTable = layoutRoot != null ? layoutRoot.Find("3D Wood Planks Table") : null;
            Transform existingRunner = layoutRoot != null ? layoutRoot.Find("3D Fabric Runner") : null;

            if (existingTable == null || existingRunner == null)
            {
                BuildTableLayout();
            }
        }

        private void EnsureEventSystem()
        {
            if (!Application.isPlaying || FindFirstObjectByType<EventSystem>() != null) return;

            GameObject events = new("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            events.GetComponent<InputSystemUIInputModule>().AssignDefaultActions();
            DontDestroyOnLoad(events);
        }

        private void BindPresentationActions()
        {
            Button resolutionButton = GameObject.Find("Debug")?.GetComponent<Button>();
            keyLightToggleButton = GameObject.Find("KeyLightToggle")?.GetComponent<Button>();
            GameObject quantizeObject = GameObject.Find("Quantize");
            if (resolutionButton != null)
            {
                resolutionButton.onClick.RemoveAllListeners();
                resolutionButton.onClick.AddListener(ToggleResolution);
            }
            if (keyLightToggleButton == null)
            {
                GameObject canvasObj = GameObject.Find("Pixel Presentation");
                if (canvasObj != null)
                {
                    keyLightToggleButton = CreateButton(canvasObj.transform, "KeyLightToggle", $"Light: {keyLightPresets[currentKeyLightPresetIndex].name}", new Vector2(158f, -18f), new Vector2(165f, 38f), new Vector2(0f, 1f), ToggleKeyLightPreset);
                }
            }
            if (keyLightToggleButton != null)
            {
                keyLightToggleButton.onClick.RemoveAllListeners();
                keyLightToggleButton.onClick.AddListener(ToggleKeyLightPreset);
                Text label = keyLightToggleButton.GetComponentInChildren<Text>();
                if (label != null) label.text = $"Light: {keyLightPresets[currentKeyLightPresetIndex].name}";
            }
            if (quantizeObject != null) quantizeObject.SetActive(false);
        }

        private void BuildWorld()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.48f, 0.44f, 0.40f);

            EnsureLayoutRoot();

            // 씬 전체의 모든 구버전 카메라 전수 검색 및 삭제 (중복 생성 방지)
            GameObject[] allSceneObjects = Resources.FindObjectsOfTypeAll<GameObject>();
            foreach (GameObject go in allSceneObjects)
            {
                if (go == null) continue;
#if UNITY_EDITOR
                if (UnityEditor.EditorUtility.IsPersistent(go)) continue;
#endif
                if (go.name == "Full Field World Camera" || go.name == "Low Resolution World Camera")
                {
                    if (Application.isPlaying) Destroy(go);
                    else DestroyImmediate(go);
                }
            }

            Transform existingLight = layoutRoot != null ? layoutRoot.Find("Key Light") : null;
            if (existingLight != null)
            {
                if (Application.isPlaying) Destroy(existingLight.gameObject);
                else DestroyImmediate(existingLight.gameObject);
            }

            GameObject cameraObject = new("Full Field World Camera", typeof(Camera), typeof(AudioListener));
            cameraObject.transform.SetParent(layoutRoot, false);
            worldCamera = cameraObject.GetComponent<Camera>();
            ApplyTopDownCamera();
            worldCamera.nearClipPlane = 0.1f;
            worldCamera.farClipPlane = 40f;
            worldCamera.clearFlags = CameraClearFlags.SolidColor;
            worldCamera.backgroundColor = new Color(0.06f, 0.045f, 0.04f);
            worldCamera.allowHDR = false;
            worldCamera.allowMSAA = false;

            GameObject lightObject = new("Key Light", typeof(Light));
            Light key = lightObject.GetComponent<Light>();
            key.type = LightType.Directional;
            key.color = new Color(1f, 0.93f, 0.78f);
            key.intensity = 1.45f;
            key.shadows = LightShadows.Soft;
            key.shadowStrength = 0.58f;
            key.shadowBias = 0.005f;
            key.shadowNormalBias = 0.03f;
            lightObject.transform.rotation = Quaternion.Euler(60f, -35f, 0f);
            lightObject.transform.SetParent(layoutRoot, true);

            BuildTableLayout();
            ConfigureLighting();
        }

        private void ApplyTopDownCamera()
        {
            ApplyAngledWorldCamera(75.0f);
        }

        private void ApplyAngledWorldCamera(float pitchAngle = 75.0f)
        {
            if (worldCamera == null) return;
            worldCamera.transform.position = new Vector3(CenterSectionX, 11.5f, -3.1f);
            worldCamera.transform.rotation = Quaternion.Euler(pitchAngle, 0f, 0f);
            worldCamera.orthographic = true;
            worldCamera.orthographicSize = 8.2f;
        }

        private void EnsureLayoutRoot()
        {
            if (layoutRoot != null) return;
            GameObject existing = GameObject.Find("Graphics Layout");
            if (existing != null)
            {
                layoutRoot = existing.transform;
                return;
            }

            GameObject root = new("Graphics Layout");
            root.transform.SetParent(transform, false);
            layoutRoot = root.transform;
        }

        private void EnsureTableLayoutElements()
        {
            EnsureLayoutRoot();

            // 1. Table
            Transform table = layoutRoot.Find("3D Wood Planks Table");
            if (table == null) Create3DWoodPlanksTable();

            // 2. Runner
            Transform runner = layoutRoot.Find("3D Fabric Runner");
            if (runner == null) Create3DFabricRunner();

            // 3. Tray Visual
            Transform tray = layoutRoot.Find("Yacht Tray Visual");
            if (tray == null) CreateGameTray();

            // 4. Augment Card Tray
            if (augmentCardTray == null)
            {
                augmentCardTray = layoutRoot.GetComponentInChildren<AugmentCardTray>() ?? FindFirstObjectByType<AugmentCardTray>();
            }
            if (augmentCardTray == null) CreateAugmentCardTray();

            // 5. Parchment Score Sheet
            if (parchmentScoreSheet == null)
            {
                parchmentScoreSheet = layoutRoot.GetComponentInChildren<ParchmentScoreSheet>() ?? FindFirstObjectByType<ParchmentScoreSheet>();
            }
            if (parchmentScoreSheet == null)
            {
                CreateScoreSheet();
            }
            else
            {
                parchmentScoreSheet.EnsureStructure();
                parchmentScoreSheet.RefreshAllScores();
            }

            // 6. Inkwell and Quill
            Transform inkwell = layoutRoot.Find("3D Inkwell and Quill Decoration");
            if (inkwell == null) CreateInkwellAndQuill();

            // 7. Paperweight
            Transform paperweight = layoutRoot.Find("3D Parchment Paperweight");
            if (paperweight == null) CreatePaperweight();

            // 8. Reroll Counter Bar
            if (rerollCounterBar == null)
            {
                rerollCounterBar = layoutRoot.GetComponentInChildren<RerollCounterBar>() ?? FindFirstObjectByType<RerollCounterBar>();
            }
            if (rerollCounterBar == null)
            {
                CreateRerollCounterBar();
            }
            else
            {
                rerollCounterBar.BuildGeometry();
                rerollCounterBar.SetRollsRemaining(3, 3);
            }

            // 9. Roll Orb
            if (rollOrb == null)
            {
                rollOrb = layoutRoot.GetComponentInChildren<RollOrb>() ?? FindFirstObjectByType<RollOrb>();
            }
            if (rollOrb == null)
            {
                CreateRollOrb();
            }
            else
            {
                rollOrb.BuildGeometry();
            }

            // 10. Hourglass Timer
            if (hourglassTimer == null)
            {
                hourglassTimer = layoutRoot.GetComponentInChildren<HourglassTimer>() ?? FindFirstObjectByType<HourglassTimer>();
            }
            if (hourglassTimer == null)
            {
                CreateHourglassTimer();
            }
            else
            {
                hourglassTimer.BuildGeometry();
            }
        }

        private void BuildTableLayout()
        {
            // 기존 layoutRoot 직계 자식 정리 (중복 생성 방지)
            if (layoutRoot != null)
            {
                string[] cleanupKeywords = { "Paper", "Score Sheet", "Layered Parchment", "Game Info", "Burgundy", "3D Wood Planks Table", "3D Fabric Runner", "Medieval Wood Planks Table", "Emerald Wide Runner", "Emerald Ribbon Runner", "Solid Burgundy Game Mat", "Augment Card Tray", "Stone Augment Card Tray", "Roll Orb", "Reroll Counter Bar", "Inkwell", "Quill", "Paperweight", "Hourglass" };
                List<GameObject> directChildrenToDelete = new();
                for (int i = 0; i < layoutRoot.childCount; i++)
                {
                    Transform child = layoutRoot.GetChild(i);
                    foreach (string kw in cleanupKeywords)
                    {
                        if (child.name.Contains(kw))
                        {
                            directChildrenToDelete.Add(child.gameObject);
                            break;
                        }
                    }
                }
                foreach (GameObject go in directChildrenToDelete)
                {
                    if (Application.isPlaying) Destroy(go);
                    else DestroyImmediate(go);
                }
            }

            // Layer 1 (Bottom): 4개 대형 원목 판자 3D 테이블 생성 (옹이 및 나뭇결 텍스처 적용)
            Create3DWoodPlanksTable();

            // Layer 2 (Mid): 가로 기준 + 약 4.5도 사선 회전 3D 딥 크림슨 패브릭 러너 + 골드 트림 생성
            Create3DFabricRunner();

            // Layer 3 (Center): 주사위 트레이 배치
            CreateGameTray();

            // Layer 4 (Left): 좌측 3D 스톤 증강 카드 트레이 (카탄 3구 슬롯 + 하스스톤 스톤 룩앤필)
            CreateAugmentCardTray();

            // Layer 5 (Right): 우측 3D 레이어드 양피지 야추 족보 점수표 생성
            CreateScoreSheet();

            // Layer 6 (Bottom-Right): 우측 하단 3D 앤틱 원통형 황동 잉크통 & 2시 방향 깃펜 오브젝트 생성
            CreateInkwellAndQuill();

            // Layer 7 (Top-Parchment): 양피지 상단 3D 고풍스러운 다크 조약돌 누름돌(Paperweight) 생성
            CreatePaperweight();

            // Layer 8 (Tray Bottom-Left): 주사위 트레이 하단 좌측 3D 남은 롤 횟수 안내 마나 크리스탈 바
            CreateRerollCounterBar();

            // Layer 9 (Tray Bottom-Right): 주사위 트레이 하단 우측 3D 스타일라이즈드 마법 수정구 롤 오브젝트
            CreateRollOrb();

            // Layer 10 (Tray Top): 주사위 트레이 상단 3D 스타일라이즈드 앤틱 모래시계 1분 타이머
            CreateHourglassTimer();
        }

        private void CreateHourglassTimer()
        {
            Vector3 timerPos = new Vector3(-3.5f, 0.12f, 5.73f);
            Quaternion timerRot = Quaternion.Euler(0f, -40f, 0f);
            Vector3 timerScale = Vector3.one * 1.1f;
            hourglassTimer = HourglassTimer.Create(layoutRoot, timerPos, timerRot, timerScale);
        }

        private void CreateRerollCounterBar()
        {
            Vector3 counterPos = new Vector3(0.53f, 0.12f, 5.73f);
            Vector3 counterScale = Vector3.one * 1.30f;
            rerollCounterBar = RerollCounterBar.Create(layoutRoot, counterPos, null, counterScale);
        }

        private void CreateRollOrb()
        {
            Vector3 orbPos = new Vector3(-0.35f, 0.12f, -6.30f);
            Vector3 orbScale = Vector3.one * 1.35f;
            rollOrb = RollOrb.Create(layoutRoot, orbPos, null, orbScale);
        }

        private void CreateAugmentCardTray()
        {
            Vector3 trayPos = new Vector3(-10f, 0.1f, -0.3f);
            Vector3 trayScale = Vector3.one * 1.5f;
            augmentCardTray = AugmentCardTray.Create(layoutRoot, trayPos, trayScale);
        }

        private void CreateScoreSheet()
        {
            Vector3 scoreSheetPos = new Vector3(8.8f, -0.38f, 0.03f);
            Vector3 scoreSheetScale = Vector3.one * 1.5f;
            parchmentScoreSheet = ParchmentScoreSheet.Create(layoutRoot, scoreSheetPos, scoreSheetScale);
            parchmentScoreSheet.RefreshAllScores();
        }

        private void CreateInkwellAndQuill()
        {
            Vector3 inkwellPos = new Vector3(13.0f, 0.08f, -7.9f);
            Quaternion inkwellRot = Quaternion.Euler(0f, 110f, 0f);
            Vector3 inkwellScale = Vector3.one * 2.5f;
            InkwellAndQuill.Create(layoutRoot, inkwellPos, inkwellRot, inkwellScale);
        }

        private void CreatePaperweight()
        {
            Vector3 weightPos = new Vector3(8.8f, -0.34f, 6.70f);
            Quaternion weightRot = Quaternion.identity;
            Vector3 weightScale = Vector3.one * 1.30f;
            ParchmentPaperweight.Create(layoutRoot, weightPos, weightRot, weightScale);
        }

        private void Create3DWoodPlanksTable()
        {
            GameObject tableRoot = new("3D Wood Planks Table");
            tableRoot.layer = DecorationLayer;
            tableRoot.transform.SetParent(layoutRoot, false);
            tableRoot.transform.position = Vector3.zero;

            int plankCount = 4;
            float totalHeight = 20.0f;
            float plankHeight = 4.90f;
            float gap = 0.10f;
            float plankWidth = 38.0f;
            float plankThickness = 0.60f;
            float baseY = -0.72f;

            // 0. 판자 틈새 그림자 역할의 언더레이어 밑판 (틈새로 배경이 비치지 않고 자연스러운 음영 연출)
            GameObject underlay = GameObject.CreatePrimitive(PrimitiveType.Cube);
            underlay.name = "Table Shadow Underlay";
            underlay.layer = DecorationLayer;
            underlay.transform.SetParent(tableRoot.transform, false);
            underlay.transform.position = new Vector3(CenterSectionX, baseY - 0.20f, 0f);
            underlay.transform.localScale = new Vector3(plankWidth, 0.20f, totalHeight + 1.0f);

            Collider underlayCol = underlay.GetComponent<Collider>();
            if (underlayCol != null)
            {
                if (Application.isPlaying) Destroy(underlayCol);
                else DestroyImmediate(underlayCol);
            }

            Material underlayMat = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Runtime Table Shadow Underlay Material",
                color = new Color32(20, 15, 12, 255)
            };
            if (underlayMat.HasProperty("_BaseColor")) underlayMat.SetColor("_BaseColor", new Color32(20, 15, 12, 255));
            if (underlayMat.HasProperty("_Color")) underlayMat.SetColor("_Color", new Color32(20, 15, 12, 255));
            underlayMat.SetFloat("_Smoothness", 0.05f);
            underlayMat.SetFloat("_Metallic", 0f);

            MeshRenderer underlayMr = underlay.GetComponent<MeshRenderer>();
            underlayMr.material = underlayMat;
            underlayMr.shadowCastingMode = ShadowCastingMode.TwoSided;
            underlayMr.receiveShadows = true;

            Color[] plankColors = new Color[]
            {
                new Color32(110, 67, 42, 255), // Plank 1: #6e432a (Warm Honey Brown)
                new Color32(120, 73, 46, 255), // Plank 2: #78492e (Amber Toast Brown)
                new Color32(99, 60, 37, 255),  // Plank 3: #633c25 (Deep Toffee Walnut)
                new Color32(115, 69, 43, 255)  // Plank 4: #73452b (Warm Walnut Brown)
            };

            // 판자마다 서로 다른 옹이(Knot)와 결 위치를 위한 UV Offset & Scale
            Vector2[] uvOffsets = new Vector2[]
            {
                new(0.00f, 0.00f),
                new(0.40f, 0.20f),
                new(0.80f, 0.60f),
                new(0.20f, 0.40f)
            };

            Texture2D woodTexture = null;
#if UNITY_EDITOR
            woodTexture = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/Wood/wood_grain_knots.png");
#endif

            float startZ = -totalHeight * 0.5f + plankHeight * 0.5f;

            for (int i = 0; i < plankCount; i++)
            {
                float z = startZ + i * (plankHeight + gap);
                float yOffset = ((i % 2 == 0) ? 0.008f : -0.008f); // 판자 간 자연스러운 3D 높낮이 단차
                Vector3 pos = new(CenterSectionX, baseY + yOffset, z);
                Vector3 size = new(plankWidth, plankThickness, plankHeight);

                GameObject plank = GameObject.CreatePrimitive(PrimitiveType.Cube);
                plank.name = $"Heavy Wood Plank {i + 1}";
                plank.layer = DecorationLayer;
                plank.transform.SetParent(tableRoot.transform, false);
                plank.transform.position = pos;
                plank.transform.localScale = size;

                Collider col = plank.GetComponent<Collider>();
                if (col != null)
                {
                    if (Application.isPlaying) Destroy(col);
                    else DestroyImmediate(col);
                }

                Material mat = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
                {
                    name = $"Runtime Heavy Wood Plank {i + 1} Material",
                    color = plankColors[i % plankColors.Length]
                };

                if (woodTexture != null)
                {
                    mat.mainTexture = woodTexture;
                    if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", woodTexture);
                    if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", woodTexture);

                    Vector2 tiling = new(1.5f, 1.0f);
                    Vector2 offset = uvOffsets[i % uvOffsets.Length];
                    mat.mainTextureScale = tiling;
                    mat.mainTextureOffset = offset;
                    if (mat.HasProperty("_BaseMap"))
                    {
                        mat.SetTextureScale("_BaseMap", tiling);
                        mat.SetTextureOffset("_BaseMap", offset);
                    }
                    if (mat.HasProperty("_MainTex"))
                    {
                        mat.SetTextureScale("_MainTex", tiling);
                        mat.SetTextureOffset("_MainTex", offset);
                    }
                }

                mat.SetFloat("_Smoothness", 0.20f);
                mat.SetFloat("_Metallic", 0f);

                MeshRenderer mr = plank.GetComponent<MeshRenderer>();
                mr.material = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }

        private static Texture2D CreateBurgundyCorduroyTexture()
        {
            int width = 512;
            int height = 512;
            Texture2D tex = new(width, height, TextureFormat.RGBA32, true)
            {
                name = "Runtime Burgundy Corduroy Texture",
                wrapMode = TextureWrapMode.Repeat,
                filterMode = FilterMode.Bilinear
            };

            Color[] pixels = new Color[width * height];
            int numRibs = 20; // 20개의 선명하고 굵은 가로 코듀로이 골

            for (int y = 0; y < height; y++)
            {
                float v = (float)y / height;
                float phase = v * numRibs * 2f * Mathf.PI;
                float sinVal = Mathf.Sin(phase);
                float ridgeProfile = Mathf.Sign(sinVal) * Mathf.Pow(Mathf.Abs(sinVal), 0.55f);
                float tRidge = (ridgeProfile + 1f) * 0.5f;

                for (int x = 0; x < width; x++)
                {
                    float u = (float)x / width;
                    float s1 = Mathf.Sin(u * 3.7f * 2f * Mathf.PI + v * 2.1f * 2f * Mathf.PI) * Mathf.Cos(u * 1.9f * 2f * Mathf.PI - v * 3.4f * 2f * Mathf.PI);
                    float s2 = Mathf.Sin(u * 8.3f * 2f * Mathf.PI - v * 6.5f * 2f * Mathf.PI) * 0.5f;
                    float organicWave = (s1 + s2) / 1.5f;
                    float toneBlend = Mathf.Clamp01(0.5f + 0.5f * organicWave);
                    float microWeave = ((Mathf.Sin(x * 0.85f) + Mathf.Cos(y * 0.85f)) * 0.5f) * 0.04f;

                    float r = Mathf.Clamp01((35f + 110f * tRidge + 35f * toneBlend + microWeave * 40f) / 255f);
                    float g = Mathf.Clamp01((4f + 26f * tRidge + 18f * toneBlend + microWeave * 25f) / 255f);
                    float b = Mathf.Clamp01((10f + 48f * tRidge + 24f * toneBlend + microWeave * 25f) / 255f);

                    pixels[y * width + x] = new Color(r, g, b, 1f);
                }
            }

            tex.SetPixels(pixels);
            tex.Apply(true);
            return tex;
        }

        private void Create3DFabricRunner()
        {
            GameObject runnerRoot = new("3D Fabric Runner");
            runnerRoot.layer = DecorationLayer;
            runnerRoot.transform.SetParent(layoutRoot, false);
            runnerRoot.transform.position = new Vector3(CenterSectionX, -0.40f, 0.4f);
            runnerRoot.transform.rotation = Quaternion.Euler(0f, 4.5f, 0f);

            // 1. 딥 크림슨 펠트 본체 (로우폴리 스타일라이즈드 솔리드 메쉬)
            GameObject feltBody = GameObject.CreatePrimitive(PrimitiveType.Cube);
            feltBody.name = "Crimson Felt Body";
            feltBody.layer = DecorationLayer;
            feltBody.transform.SetParent(runnerRoot.transform, false);
            feltBody.transform.localPosition = Vector3.zero;
            feltBody.transform.localScale = new Vector3(42.0f, 0.040f, 7.2f);

            Collider bodyCol = feltBody.GetComponent<Collider>();
            if (bodyCol != null)
            {
                if (Application.isPlaying) Destroy(bodyCol);
                else DestroyImmediate(bodyCol);
            }

            Color crimsonColor = new Color32(136, 45, 34, 255); // #882d22 (Deep Crimson)
            Material feltMat = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Runtime 3D LowPoly Crimson Felt Material",
                color = crimsonColor
            };
            if (feltMat.HasProperty("_BaseColor")) feltMat.SetColor("_BaseColor", crimsonColor);
            if (feltMat.HasProperty("_Color")) feltMat.SetColor("_Color", crimsonColor);
            feltMat.SetFloat("_Smoothness", 0.12f);
            feltMat.SetFloat("_Metallic", 0f);

            MeshRenderer bodyMr = feltBody.GetComponent<MeshRenderer>();
            bodyMr.material = feltMat;
            bodyMr.shadowCastingMode = ShadowCastingMode.TwoSided;
            bodyMr.receiveShadows = true;

            // 2. 상/하 앤틱 골드 리본 트림 2줄 (안쪽 인셋 ±2.75f)
            Color goldColor = new Color32(229, 169, 60, 255); // #e5a93c (Antique Gold)
            Material goldMat = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"))
            {
                name = "Runtime 3D LowPoly Antique Gold Ribbon Material",
                color = goldColor
            };
            if (goldMat.HasProperty("_BaseColor")) goldMat.SetColor("_BaseColor", goldColor);
            if (goldMat.HasProperty("_Color")) goldMat.SetColor("_Color", goldColor);
            goldMat.SetFloat("_Smoothness", 0.78f);
            goldMat.SetFloat("_Metallic", 0.88f);

            float[] trimZ = { -2.75f, 2.75f };
            for (int t = 0; t < 2; t++)
            {
                GameObject trim = GameObject.CreatePrimitive(PrimitiveType.Cube);
                trim.name = $"Gold Trim {(t == 0 ? "Top" : "Bottom")}";
                trim.layer = DecorationLayer;
                trim.transform.SetParent(runnerRoot.transform, false);
                trim.transform.localPosition = new Vector3(0f, 0.004f, trimZ[t]);
                trim.transform.localScale = new Vector3(42.0f, 0.044f, 0.20f);

                Collider trimCol = trim.GetComponent<Collider>();
                if (trimCol != null)
                {
                    if (Application.isPlaying) Destroy(trimCol);
                    else DestroyImmediate(trimCol);
                }

                MeshRenderer trimMr = trim.GetComponent<MeshRenderer>();
                trimMr.material = goldMat;
                trimMr.shadowCastingMode = ShadowCastingMode.TwoSided;
                trimMr.receiveShadows = true;
            }
        }

        private void CreateYachtTrayVisual()
        {
            if (yachtTrayMesh == null) return;
            GameObject tray = new("Yacht Tray Visual", typeof(MeshFilter), typeof(MeshRenderer));
            tray.transform.SetParent(layoutRoot, false);
            tray.transform.localPosition = new Vector3(CenterSectionX, TrayVisualY, 0f);
            tray.transform.localRotation = Quaternion.identity;
            tray.transform.localScale = Vector3.one * TrayScale;

            Mesh trayMeshInstance = yachtTrayMesh;
            if (trayMeshInstance.uv == null || trayMeshInstance.uv.Length == 0)
            {
                trayMeshInstance = Instantiate(yachtTrayMesh);
                Vector3[] verts = trayMeshInstance.vertices;
                Vector3[] norms = trayMeshInstance.normals;
                Vector2[] uvs = new Vector2[verts.Length];
                for (int i = 0; i < verts.Length; i++)
                {
                    Vector3 v = verts[i];
                    Vector3 n = (norms != null && i < norms.Length) ? norms[i] : Vector3.up;
                    if (Mathf.Abs(n.y) >= 0.7f)
                        uvs[i] = new Vector2(v.x * (1f / 50f), v.z * (1f / 50f));
                    else
                        uvs[i] = new Vector2((Mathf.Abs(n.x) > Mathf.Abs(n.z) ? v.z : v.x) * (1f / 50f), v.y * (1f / 50f));
                }
                trayMeshInstance.uv = uvs;
            }
            tray.GetComponent<MeshFilter>().sharedMesh = trayMeshInstance;

            Material rim = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            rim.name = "Runtime Yacht Tray Rim Material";
            rim.color = new Color(0.045f, 0.045f, 0.05f);
            rim.SetFloat("_Smoothness", 0.22f);

            Material felt = new(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            felt.name = "Runtime Yacht Tray Felt Material";
            Texture2D corduroyTex = CreateBurgundyCorduroyTexture();
            felt.mainTexture = corduroyTex;
            if (felt.HasProperty("_BaseMap")) felt.SetTexture("_BaseMap", corduroyTex);
            if (felt.HasProperty("_MainTex")) felt.SetTexture("_MainTex", corduroyTex);
            if (felt.HasProperty("_BaseColor")) felt.SetColor("_BaseColor", Color.white);
            if (felt.HasProperty("_Color")) felt.SetColor("_Color", Color.white);
            felt.mainTextureScale = new Vector2(1f, 1f);
            felt.color = Color.white;
            felt.SetFloat("_Smoothness", 0.12f);

            tray.GetComponent<MeshRenderer>().sharedMaterials = new[] { rim, felt };
            tray.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.TwoSided;
            tray.GetComponent<MeshRenderer>().receiveShadows = true;
        }

        private void ConfigureLighting()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.16f, 0.12f, 0.09f);
            Light key = GameObject.Find("Key Light")?.GetComponent<Light>();
            if (key != null)
            {
                key.enabled = true;
                key.transform.rotation = Quaternion.Euler(60f, -35f, 0f);
                key.cullingMask |= 1 << DiceLayer;
                key.shadows = LightShadows.Soft;
                key.shadowStrength = 0.58f;
                key.shadowBias = 0.005f;
                key.shadowNormalBias = 0.03f;
                ApplyKeyLightPreset();
            }
        }

        private void BuildPresentation()
        {
            EnsureEventSystem();

            // 씬 전체의 모든 구버전 Pixel Presentation 및 Display 1 Camera 전수 검색 및 영구 삭제
            GameObject[] allSceneObjects = Resources.FindObjectsOfTypeAll<GameObject>();
            foreach (GameObject go in allSceneObjects)
            {
                if (go == null) continue;
#if UNITY_EDITOR
                if (UnityEditor.EditorUtility.IsPersistent(go)) continue;
#endif
                if (go.name == "Pixel Presentation" || go.name == "Display 1 Camera")
                {
                    if (Application.isPlaying) Destroy(go);
                    else DestroyImmediate(go);
                }
            }

            GameObject canvasObject = new("Pixel Presentation", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;

            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;

            CreatePresentationCamera();

            GameObject gameArea = new("Game Area", typeof(RectTransform));
            gameArea.transform.SetParent(canvasObject.transform, false);
            gameAreaRect = gameArea.GetComponent<RectTransform>();
            gameAreaRect.anchorMin = Vector2.zero;
            gameAreaRect.anchorMax = Vector2.one;
            gameAreaRect.offsetMin = gameAreaRect.offsetMax = Vector2.zero;

            GameObject imageObject = new("Point Upscale", typeof(RectTransform), typeof(RawImage));
            imageObject.transform.SetParent(gameArea.transform, false);
            gameImageRect = imageObject.GetComponent<RectTransform>();
            gameImageRect.anchorMin = gameImageRect.anchorMax = new Vector2(0.5f, 0.5f);
            gameImageRect.pivot = new Vector2(0.5f, 0.5f);
            gameImage = imageObject.GetComponent<RawImage>();
            gameImage.raycastTarget = false;

            upscaleMaterial = new Material(upscaleShader != null ? upscaleShader : Shader.Find("UI/Default"));
            gameImage.material = upscaleMaterial;
            imageObject.SetActive(true);

            CreateButton(canvasObject.transform, "Debug", "960 / 640", new Vector2(18f, -18f), new Vector2(130f, 38f), new Vector2(0f, 1f), ToggleResolution);
            keyLightToggleButton = CreateButton(canvasObject.transform, "KeyLightToggle", $"Light: {keyLightPresets[currentKeyLightPresetIndex].name}", new Vector2(158f, -18f), new Vector2(165f, 38f), new Vector2(0f, 1f), ToggleKeyLightPreset);

            statusText = CreateText(canvasObject.transform, "Status", "", new Vector2(0f, -20f), new Vector2(600f, 30f), new Vector2(0.5f, 1f), 15, TextAnchor.MiddleCenter);
            Canvas.ForceUpdateCanvases();
            CreateRenderTarget();
            BindPresentationActions();

            if (parchmentScoreSheet == null) parchmentScoreSheet = FindFirstObjectByType<ParchmentScoreSheet>();
            if (parchmentScoreSheet != null)
            {
                parchmentScoreSheet.EnsureStructure();
                parchmentScoreSheet.RefreshAllScores();
                parchmentScoreSheet.SyncOverlayTransform();
            }
        }

        private void CreatePresentationCamera()
        {
            GameObject cameraObject = new("Display 1 Camera", typeof(Camera));
            cameraObject.transform.SetParent(layoutRoot, false);
            presentationCamera = cameraObject.GetComponent<Camera>();
            presentationCamera.targetDisplay = 0;
            presentationCamera.clearFlags = CameraClearFlags.SolidColor;
            presentationCamera.backgroundColor = DarkCharcoalBackground;
            presentationCamera.cullingMask = 0;
            presentationCamera.depth = -100f;
            presentationCamera.nearClipPlane = 0.01f;
            presentationCamera.farClipPlane = 1f;
            presentationCamera.allowHDR = false;
            presentationCamera.allowMSAA = false;
        }

        private Button CreateButton(Transform parent, string name, string label, Vector2 position, Vector2 size, Vector2 anchor, UnityEngine.Events.UnityAction action)
        {
            GameObject buttonObject = new(name, typeof(RectTransform), typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;

            Image image = buttonObject.GetComponent<Image>();
            image.color = new Color(0.06f, 0.4f, 0.46f, 0.94f);

            Button button = buttonObject.GetComponent<Button>();
            button.targetGraphic = image;
            ColorBlock colors = button.colors;
            colors.highlightedColor = new Color(1f, 0.82f, 0.3f, 1f);
            colors.pressedColor = new Color(0.72f, 0.13f, 0.18f, 1f);
            button.colors = colors;
            button.onClick.AddListener(action);

            CreateText(buttonObject.transform, "Label", label, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), 15, TextAnchor.MiddleCenter, true);
            return button;
        }

        private static Text CreateText(Transform parent, string name, string value, Vector2 position, Vector2 size, Vector2 anchor, int fontSize, TextAnchor alignment, bool stretch = false)
        {
            GameObject textObject = new(name, typeof(RectTransform), typeof(Text), typeof(Shadow));
            textObject.transform.SetParent(parent, false);
            RectTransform rect = textObject.GetComponent<RectTransform>();
            if (stretch)
            {
                rect.anchorMin = Vector2.zero;
                rect.anchorMax = Vector2.one;
                rect.offsetMin = rect.offsetMax = Vector2.zero;
            }
            else
            {
                rect.anchorMin = rect.anchorMax = anchor;
                rect.pivot = anchor;
                rect.anchoredPosition = position;
                rect.sizeDelta = size;
            }

            Text text = textObject.GetComponent<Text>();
            Font font = null;
#if UNITY_EDITOR
            font = UnityEditor.AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/alagard.ttf")
                ?? UnityEditor.AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/m6x11.ttf");
#endif
            text.font = font ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (text.font != null && text.font.material != null && text.font.material.mainTexture != null)
            {
                text.font.material.mainTexture.filterMode = FilterMode.Point;
            }
            text.text = value;
            text.fontSize = fontSize;
            text.fontStyle = FontStyle.Normal;
            text.alignment = alignment;
            text.color = Color.white;
            text.raycastTarget = false;
            Shadow shadow = textObject.GetComponent<Shadow>();
            shadow.effectColor = new Color(0f, 0f, 0f, 0.9f);
            shadow.effectDistance = new Vector2(2f, -2f);
            return text;
        }

        private void CreateRenderTarget()
        {
            if (worldCamera != null) worldCamera.targetTexture = null;
            if (lowResolutionTarget != null)
            {
                lowResolutionTarget.Release();
                Destroy(lowResolutionTarget);
            }

            lowResolutionTarget = new RenderTexture(OutputResolution.x, OutputResolution.y, 24, RenderTextureFormat.ARGB32)
            {
                name = $"Dice PoC Full Field {OutputResolution.x}x{OutputResolution.y}",
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp,
                antiAliasing = 1,
                useMipMap = false,
                autoGenerateMips = false
            };
            lowResolutionTarget.Create();
            worldCamera.targetTexture = lowResolutionTarget;
            if (gameImage != null)
            {
                gameImage.gameObject.SetActive(true);
                gameImage.texture = lowResolutionTarget;
            }
            FitFullScreen();
        }

        private void ApplyRenderSettings()
        {
            if (upscaleMaterial != null)
            {
                if (upscaleMaterial.HasProperty("_Quantize")) upscaleMaterial.SetFloat("_Quantize", 0f);
                upscaleMaterial.SetVector("_VirtualResolution", new Vector4(internalResolution.x, internalResolution.y, 0f, 0f));
            }
        }

        private void FitFullScreen()
        {
            if (gameImageRect == null) return;
            gameImageRect.anchorMin = Vector2.zero;
            gameImageRect.anchorMax = Vector2.one;
            gameImageRect.anchoredPosition = Vector2.zero;
            gameImageRect.sizeDelta = Vector2.zero;
        }

        private void OnDestroy()
        {
            if (worldCamera != null) worldCamera.targetTexture = null;
            if (lowResolutionTarget != null)
            {
                lowResolutionTarget.Release();
                if (Application.isPlaying) Destroy(lowResolutionTarget);
                else DestroyImmediate(lowResolutionTarget);
            }
            if (upscaleMaterial != null)
            {
                if (Application.isPlaying) Destroy(upscaleMaterial);
                else DestroyImmediate(upscaleMaterial);
            }
            if (diceBodyMaterial != null)
            {
                if (Application.isPlaying) Destroy(diceBodyMaterial);
                else DestroyImmediate(diceBodyMaterial);
            }
            if (dicePipMaterial != null)
            {
                if (Application.isPlaying) Destroy(dicePipMaterial);
                else DestroyImmediate(dicePipMaterial);
            }
        }
    }
}
