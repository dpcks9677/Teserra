using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace Tessera.Games.AugmentedYacht
{
    public enum ScoreCategory
    {
        Aces = 0,
        Deuces = 1,
        Threes = 2,
        Fours = 3,
        Fives = 4,
        Sixes = 5,
        Bonus = 6,
        Choice = 7,
        FourOfAKind = 8,
        FullHouse = 9,
        SmallStraight = 10,
        LargeStraight = 11,
        Yacht = 12,
        Total = 13
    }

    [Serializable]
    public class PlayerScoreData
    {
        public int[] upperScores = new int[] { -1, -1, -1, -1, -1, -1 };
        public bool hasBonus = false;
        public int bonusScore = 0;
        public int[] lowerScores = new int[] { -1, -1, -1, -1, -1, -1 };
        public int totalScore = 0;

        public void Reset()
        {
            for (int i = 0; i < 6; i++) upperScores[i] = -1;
            hasBonus = false;
            bonusScore = 0;
            for (int i = 0; i < 6; i++) lowerScores[i] = -1;
            totalScore = 0;
        }

        public int CalculateUpperSum()
        {
            int sum = 0;
            for (int i = 0; i < 6; i++)
            {
                if (upperScores[i] > 0) sum += upperScores[i];
            }
            return sum;
        }

        public void RecalculateTotal()
        {
            int upperSum = CalculateUpperSum();
            if (upperSum >= 63)
            {
                hasBonus = true;
                bonusScore = 35;
            }
            else
            {
                hasBonus = false;
                bonusScore = 0;
            }

            int sum = upperSum + bonusScore;
            for (int i = 0; i < 6; i++)
            {
                if (lowerScores[i] > 0) sum += lowerScores[i];
            }
            totalScore = sum;
        }
    }

    public sealed class ParchmentScoreSheet : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        [Header("Parchment Dimensions")]
        [SerializeField] private float sheetWidth = 5.06f; // 기존 4.6f 대비 1.1배 확대
        [SerializeField] private float sheetHeight = 8.625f; // 15행 비례 높이
        [SerializeField] private float sheetThickness = 0.012f;

        [Header("Score Sheet State")]
        [SerializeField] private PlayerScoreData player1Data = new();
        [SerializeField] private PlayerScoreData player2Data = new();

        private GameObject topLayerObject;
        private RectTransform highResOverlayRect;
        private Camera targetWorldCamera;

        private readonly Text[] p1ScoreLabels = new Text[14];
        private readonly Text[] p2ScoreLabels = new Text[14];
        private Text p1BonusProgressText;
        private Text p2BonusProgressText;

        public PlayerScoreData Player1 => player1Data;
        public PlayerScoreData Player2 => player2Data;

        public static ParchmentScoreSheet Create(Transform parent, Vector3 worldPosition, Vector3? scale = null)
        {
            GameObject sheetRoot = new("3D Layered Parchment Score Sheet");
            sheetRoot.layer = DecorationLayer;
            sheetRoot.transform.SetParent(parent, false);
            sheetRoot.transform.position = worldPosition;
            sheetRoot.transform.rotation = Quaternion.identity;
            sheetRoot.transform.localScale = scale ?? Vector3.one;

            ParchmentScoreSheet comp = sheetRoot.AddComponent<ParchmentScoreSheet>();
            comp.Build3DLayeredParchments();
            return comp;
        }

        public void Build3DLayeredParchments()
        {
            while (transform.childCount > 0)
            {
                Transform child = transform.GetChild(0);
                if (Application.isPlaying) Destroy(child.gameObject);
                else DestroyImmediate(child.gameObject);
            }

            CleanupExistingPipelines();

            Shader litShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            Texture2D baseTex = null;
            Texture2D burntTex = null;
            Texture2D warmTex = null;

#if UNITY_EDITOR
            baseTex = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/Parchment/parchment_base.png");
            burntTex = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/Parchment/parchment_burnt_edge.png");
            warmTex = UnityEditor.AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/Parchment/parchment_warm_sand.png");
#endif

            // Layer 1 (Bottom): -5.2° 회전 / 짙은 에크루 톤 / 그을린 모서리
            CreateParchmentLayer("Layer 1 - Bottom Burnt Parchment", -5.2f, new Vector3(-0.08f, 0.000f, -0.05f), 1.14f, 1.12f,
                burntTex, new Color(0.82f, 0.74f, 0.60f), 0.08f, litShader);

            // Layer 2: +3.6° 회전 / 웜 샌드 톤
            CreateParchmentLayer("Layer 2 - Warm Sand Parchment", 3.6f, new Vector3(0.06f, sheetThickness * 0.7f, 0.03f), 1.10f, 1.08f,
                warmTex ?? baseTex, new Color(0.88f, 0.81f, 0.69f), 0.09f, litShader);

            // Layer 3: -2.4° 회전 / 빈티지 에이지드 톤
            CreateParchmentLayer("Layer 3 - Aged Parchment", -2.4f, new Vector3(-0.04f, sheetThickness * 1.4f, -0.02f), 1.06f, 1.05f,
                baseTex, new Color(0.90f, 0.84f, 0.73f), 0.10f, litShader);

            // Layer 4: +1.2° 회전 / 밝은 크림 톤
            CreateParchmentLayer("Layer 4 - Cream Parchment", 1.2f, new Vector3(0.03f, sheetThickness * 2.1f, 0.01f), 1.03f, 1.02f,
                baseTex, new Color(0.94f, 0.89f, 0.79f), 0.11f, litShader);

            // Layer 5 (Top): 0.0° 회전 / 정갈한 양피지 표면
            topLayerObject = CreateParchmentLayer("Layer 5 - Top Game Score Sheet", 0.0f, new Vector3(0f, sheetThickness * 2.8f, 0f), 1.00f, 1.00f,
                baseTex, Color.white, 0.12f, litShader);

            // 미니멀 도트 시트 UI 구축 (큼직한 폰트 & 도트 밴드)
            BuildDotMinimalOverlayUI();
            RefreshAllScores();
        }

        private GameObject CreateParchmentLayer(string layerName, float rotY, Vector3 localPos, float scaleXMul, float scaleZMul,
            Texture2D texture, Color tintColor, float smoothness, Shader shader)
        {
            GameObject layer = GameObject.CreatePrimitive(PrimitiveType.Cube);
            layer.name = layerName;
            layer.layer = DecorationLayer;
            layer.transform.SetParent(transform, false);
            layer.transform.localPosition = localPos;
            layer.transform.localRotation = Quaternion.Euler(0f, rotY, 0f);
            layer.transform.localScale = new Vector3(sheetWidth * scaleXMul, sheetThickness, sheetHeight * scaleZMul);
            RemoveCollider(layer);

            Material mat = new(shader)
            {
                name = $"{layerName} Material",
                color = tintColor
            };
            if (texture != null)
            {
                mat.mainTexture = texture;
                if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", texture);
                if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", texture);
            }
            mat.SetFloat("_Smoothness", smoothness);
            mat.SetFloat("_Metallic", 0f);
            ApplyRendererSettings(layer, mat);

            return layer;
        }

        private void CleanupExistingPipelines()
        {
            GameObject oldOverlay = GameObject.Find("HighRes Score Sheet Overlay");
            if (oldOverlay != null)
            {
                if (Application.isPlaying) Destroy(oldOverlay);
                else DestroyImmediate(oldOverlay);
            }

            GameObject oldCam = GameObject.Find("ScoreSheet Pixel UI Camera");
            if (oldCam != null)
            {
                if (Application.isPlaying) Destroy(oldCam);
                else DestroyImmediate(oldCam);
            }

            GameObject oldSourceCanvas = GameObject.Find("ScoreSheet Pixel UI Source Canvas");
            if (oldSourceCanvas != null)
            {
                if (Application.isPlaying) Destroy(oldSourceCanvas);
                else DestroyImmediate(oldSourceCanvas);
            }

            GameObject oldWorldCanvas = GameObject.Find("Score Sheet World Canvas");
            if (oldWorldCanvas != null)
            {
                if (Application.isPlaying) Destroy(oldWorldCanvas);
                else DestroyImmediate(oldWorldCanvas);
            }
        }

        private void BuildDotMinimalOverlayUI()
        {
            Canvas presentationCanvas = GameObject.Find("Pixel Presentation")?.GetComponent<Canvas>() ?? FindFirstObjectByType<Canvas>();
            if (presentationCanvas == null) return;

            GameObject overlayRoot = new("HighRes Score Sheet Overlay", typeof(RectTransform));
            overlayRoot.transform.SetParent(presentationCanvas.transform, false);
            highResOverlayRect = overlayRoot.GetComponent<RectTransform>();
            highResOverlayRect.pivot = new Vector2(0.5f, 0.5f);

            targetWorldCamera = GameObject.Find("Full Field World Camera")?.GetComponent<Camera>() ?? Camera.main;
            SyncOverlayTransform();

            // 큼직하고 굵은 폰트 로드
            Font fontMain = null;
            Font fontHeader = null;
#if UNITY_EDITOR
            fontMain = UnityEditor.AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/Alegreya.ttf");
            fontHeader = UnityEditor.AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/AlegreyaSC-Bold.ttf") ?? fontMain;
#endif
            if (fontMain == null) fontMain = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (fontHeader == null) fontHeader = fontMain;

            // 도트 색상 팔레트
            Color headerBandColor = new Color32(40, 26, 16, 235);    // #281a10
            Color headerTextGold = new Color32(240, 220, 190, 255);   // #f0dcb3
            Color playerHeaderGold = new Color32(240, 175, 70, 255);  // #f0af46

            Color footerBandColor = new Color32(40, 26, 16, 235);
            Color footerTextGold = new Color32(240, 220, 190, 255);
            Color footerScoreGold = new Color32(245, 185, 70, 255);

            Color bonusBandColor = new Color32(185, 155, 120, 75);
            Color bonusTextDark = new Color32(42, 26, 16, 245);
            Color bonusScoreGold = new Color32(175, 95, 25, 255);

            Color zebraTint = new Color32(150, 120, 90, 22);
            Color slotInsetColor = new Color32(160, 130, 95, 45);

            Color inkMain = new Color32(38, 24, 15, 255);
            Color inkScoreEmpty = new Color32(155, 130, 105, 180);

            float totalW = highResOverlayRect.rect.width;
            float totalH = highResOverlayRect.rect.height;
            if (totalW < 10f) totalW = 430f;
            if (totalH < 10f) totalH = 808f;

            float marginX = totalW * 0.040f;
            float marginY = totalH * 0.025f;
            float tableW = totalW - marginX * 2f;
            float tableH = totalH - marginY * 2f;

            float[] colRatios = { 0.34f, 0.16f, 0.16f, 0.34f }; // 족보 이름 칸 여백 확장
            float[] colX = new float[5];
            colX[0] = marginX;
            for (int i = 0; i < 4; i++) colX[i + 1] = colX[i] + tableW * colRatios[i];

            int numRows = 15;
            float rowH = tableH / numRows;

            // 1. 짝수 행 제브라 틴트
            for (int r = 1; r < numRows - 1; r++)
            {
                if (r == 7) continue;
                if (r % 2 == 0)
                {
                    float y = totalH - marginY - (r + 1) * rowH;
                    CreateColoredBox(overlayRoot.transform, $"Zebra_{r}", new Vector2(colX[0], y), new Vector2(tableW, rowH), zebraTint);
                }
            }

            // Header Band (Row 0)
            float headerY_top = totalH - marginY - rowH;
            CreateColoredBox(overlayRoot.transform, "Header_Band", new Vector2(colX[0], headerY_top), new Vector2(tableW, rowH), headerBandColor);

            // Bonus Band (Row 7)
            float bonusY_bottom = totalH - marginY - 8f * rowH;
            CreateColoredBox(overlayRoot.transform, "Bonus_Band", new Vector2(colX[0], bonusY_bottom), new Vector2(tableW, rowH), bonusBandColor);

            // Footer Band (Row 14 - TOTAL)
            float footerY_bottom = marginY;
            CreateColoredBox(overlayRoot.transform, "Footer_Band", new Vector2(colX[0], footerY_bottom), new Vector2(tableW, rowH), footerBandColor);

            // 2. 점수 슬롯 배경 박스
            for (int r = 1; r < numRows - 1; r++)
            {
                if (r == 7) continue;
                float slotY = totalH - marginY - (r + 1) * rowH + 3f;
                float slotH = rowH - 6f;

                CreateColoredBox(overlayRoot.transform, $"P1_Slot_{r}", new Vector2(colX[1] + 3f, slotY), new Vector2(colX[2] - colX[1] - 6f, slotH), slotInsetColor);
                CreateColoredBox(overlayRoot.transform, $"P2_Slot_{r}", new Vector2(colX[2] + 3f, slotY), new Vector2(colX[3] - colX[2] - 6f, slotH), slotInsetColor);
            }

            // 3. 헤더 텍스트 (1.4배 상향)
            float headerCenterY = -(marginY + rowH * 0.5f);
            CreateLabel(overlayRoot.transform, fontHeader, "CATEGORIES", new Vector2(colX[0] + 4f, headerCenterY), new Vector2(colX[1] - colX[0] - 8f, rowH), 20, FontStyle.Bold, headerTextGold, TextAnchor.MiddleCenter);
            CreateLabel(overlayRoot.transform, fontHeader, "P1", new Vector2(colX[1], headerCenterY), new Vector2(colX[2] - colX[1], rowH), 25, FontStyle.Bold, playerHeaderGold, TextAnchor.MiddleCenter);
            CreateLabel(overlayRoot.transform, fontHeader, "P2", new Vector2(colX[2], headerCenterY), new Vector2(colX[3] - colX[2], rowH), 25, FontStyle.Bold, playerHeaderGold, TextAnchor.MiddleCenter);
            CreateLabel(overlayRoot.transform, fontHeader, "CATEGORIES", new Vector2(colX[3] + 4f, headerCenterY), new Vector2(colX[4] - colX[3] - 8f, rowH), 20, FontStyle.Bold, headerTextGold, TextAnchor.MiddleCenter);

            // 4. 족보 데이터
            string[] upperNames = { "Aces", "Deuces", "Threes", "Fours", "Fives", "Sixes" };
            string[] upperIcons = { "dice_1", "dice_2", "dice_3", "dice_4", "dice_5", "dice_6" };
            string[] lowerNames = { "Choice", "4 of a Kind", "Full House", "S. Straight", "L. Straight", "Yacht" };
            string[] lowerIcons = { "choice", "4oak", "fullhouse", "s_straight", "l_straight", "yacht" };

            float iconSize = rowH * 0.46f;

            // 상단 섹션 (Row 1..6)
            for (int i = 0; i < 6; i++)
            {
                int rowIdx = i + 1;
                float y = -(marginY + (rowIdx + 0.5f) * rowH);

                // Col 0
                CreateIconImage(overlayRoot.transform, upperIcons[i], new Vector2(colX[0] + 6f, y), iconSize, inkMain);
                CreateLabel(overlayRoot.transform, fontMain, upperNames[i], new Vector2(colX[0] + 6f + iconSize + 6f, y), new Vector2(colX[1] - colX[0] - iconSize - 14f, rowH), 22, FontStyle.Bold, inkMain, TextAnchor.MiddleLeft);

                // Col 1 & 2
                p1ScoreLabels[i] = CreateLabel(overlayRoot.transform, fontHeader, "-", new Vector2(colX[1], y), new Vector2(colX[2] - colX[1], rowH), 28, FontStyle.Bold, inkMain, TextAnchor.MiddleCenter);
                p2ScoreLabels[i] = CreateLabel(overlayRoot.transform, fontHeader, "-", new Vector2(colX[2], y), new Vector2(colX[3] - colX[2], rowH), 28, FontStyle.Bold, inkMain, TextAnchor.MiddleCenter);

                // Col 3
                CreateIconImage(overlayRoot.transform, upperIcons[i], new Vector2(colX[3] + 6f, y), iconSize, inkMain);
                CreateLabel(overlayRoot.transform, fontMain, upperNames[i], new Vector2(colX[3] + 6f + iconSize + 6f, y), new Vector2(colX[4] - colX[3] - iconSize - 14f, rowH), 22, FontStyle.Bold, inkMain, TextAnchor.MiddleLeft);
            }

            // 보너스 행 (Row 7)
            float bonusRowY = -(marginY + (7 + 0.5f) * rowH);
            p1BonusProgressText = CreateLabel(overlayRoot.transform, fontMain, "Bonus (0/63)", new Vector2(colX[0] + 6f, bonusRowY), new Vector2(colX[1] - colX[0] - 10f, rowH), 21, FontStyle.Bold, bonusTextDark, TextAnchor.MiddleLeft);
            p2BonusProgressText = CreateLabel(overlayRoot.transform, fontMain, "Bonus (0/63)", new Vector2(colX[3] + 6f, bonusRowY), new Vector2(colX[4] - colX[3] - 10f, rowH), 21, FontStyle.Bold, bonusTextDark, TextAnchor.MiddleLeft);

            p1ScoreLabels[6] = CreateLabel(overlayRoot.transform, fontHeader, "+35", new Vector2(colX[1], bonusRowY), new Vector2(colX[2] - colX[1], rowH), 24, FontStyle.Bold, bonusScoreGold, TextAnchor.MiddleCenter);
            p2ScoreLabels[6] = CreateLabel(overlayRoot.transform, fontHeader, "+35", new Vector2(colX[2], bonusRowY), new Vector2(colX[3] - colX[2], rowH), 24, FontStyle.Bold, bonusScoreGold, TextAnchor.MiddleCenter);

            // 하단 섹션 (Row 8..13)
            for (int i = 0; i < 6; i++)
            {
                int rowIdx = i + 8;
                float y = -(marginY + (rowIdx + 0.5f) * rowH);

                // Col 0
                CreateIconImage(overlayRoot.transform, lowerIcons[i], new Vector2(colX[0] + 6f, y), iconSize, inkMain);
                CreateLabel(overlayRoot.transform, fontMain, lowerNames[i], new Vector2(colX[0] + 6f + iconSize + 6f, y), new Vector2(colX[1] - colX[0] - iconSize - 14f, rowH), 22, FontStyle.Bold, inkMain, TextAnchor.MiddleLeft);

                // Col 1 & 2
                p1ScoreLabels[i + 7] = CreateLabel(overlayRoot.transform, fontHeader, "-", new Vector2(colX[1], y), new Vector2(colX[2] - colX[1], rowH), 28, FontStyle.Bold, inkMain, TextAnchor.MiddleCenter);
                p2ScoreLabels[i + 7] = CreateLabel(overlayRoot.transform, fontHeader, "-", new Vector2(colX[2], y), new Vector2(colX[3] - colX[2], rowH), 28, FontStyle.Bold, inkMain, TextAnchor.MiddleCenter);

                // Col 3
                CreateIconImage(overlayRoot.transform, lowerIcons[i], new Vector2(colX[3] + 6f, y), iconSize, inkMain);
                CreateLabel(overlayRoot.transform, fontMain, lowerNames[i], new Vector2(colX[3] + 6f + iconSize + 6f, y), new Vector2(colX[4] - colX[3] - iconSize - 14f, rowH), 22, FontStyle.Bold, inkMain, TextAnchor.MiddleLeft);
            }

            // 푸터 행 (Row 14: TOTAL)
            float footerCenterY = -(marginY + (14 + 0.5f) * rowH);
            CreateLabel(overlayRoot.transform, fontHeader, "TOTAL", new Vector2(colX[0] + 4f, footerCenterY), new Vector2(colX[1] - colX[0] - 8f, rowH), 22, FontStyle.Bold, footerTextGold, TextAnchor.MiddleCenter);
            CreateLabel(overlayRoot.transform, fontHeader, "TOTAL", new Vector2(colX[3] + 4f, footerCenterY), new Vector2(colX[4] - colX[3] - 8f, rowH), 22, FontStyle.Bold, footerTextGold, TextAnchor.MiddleCenter);

            p1ScoreLabels[13] = CreateLabel(overlayRoot.transform, fontHeader, "0", new Vector2(colX[1], footerCenterY), new Vector2(colX[2] - colX[1], rowH), 34, FontStyle.Bold, footerScoreGold, TextAnchor.MiddleCenter);
            p2ScoreLabels[13] = CreateLabel(overlayRoot.transform, fontHeader, "0", new Vector2(colX[2], footerCenterY), new Vector2(colX[3] - colX[2], rowH), 34, FontStyle.Bold, footerScoreGold, TextAnchor.MiddleCenter);
        }

        private void LateUpdate()
        {
            SyncOverlayTransform();
        }

        public void SyncOverlayTransform()
        {
            if (highResOverlayRect == null) return;
            if (topLayerObject == null) topLayerObject = transform.Find("Layer 5 - Top Game Score Sheet")?.gameObject;
            if (topLayerObject == null) return;

            if (targetWorldCamera == null)
            {
                targetWorldCamera = GameObject.Find("Full Field World Camera")?.GetComponent<Camera>() ?? Camera.main;
            }
            if (targetWorldCamera == null) return;

            Vector3 center = topLayerObject.transform.position;
            Vector3 lossyScale = topLayerObject.transform.lossyScale;

            Vector3 worldMin = center - new Vector3(lossyScale.x * 0.5f, 0f, lossyScale.z * 0.5f);
            Vector3 worldMax = center + new Vector3(lossyScale.x * 0.5f, 0f, lossyScale.z * 0.5f);

            Vector3 screenMin = targetWorldCamera.WorldToScreenPoint(worldMin);
            Vector3 screenMax = targetWorldCamera.WorldToScreenPoint(worldMax);

            float width = Mathf.Abs(screenMax.x - screenMin.x);
            float height = Mathf.Abs(screenMax.y - screenMin.y);
            Vector3 screenCenter = (screenMin + screenMax) * 0.5f;

            highResOverlayRect.position = screenCenter;
            highResOverlayRect.sizeDelta = new Vector2(width, height);
        }

        private static void CreateColoredBox(Transform parent, string name, Vector2 posMin, Vector2 size, Color color)
        {
            GameObject box = new(name, typeof(RectTransform), typeof(Image));
            box.layer = DecorationLayer;
            box.transform.SetParent(parent, false);

            RectTransform rect = box.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = Vector2.zero;
            rect.pivot = Vector2.zero;
            rect.anchoredPosition = posMin;
            rect.sizeDelta = size;

            Image img = box.GetComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
        }

        private static Image CreateIconImage(Transform parent, string iconName, Vector2 pos, float size, Color? tint = null)
        {
            GameObject obj = new($"Icon_{iconName}", typeof(RectTransform), typeof(Image));
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);

            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 0.5f);
            rect.anchoredPosition = pos;
            rect.sizeDelta = new Vector2(size, size);

            Image img = obj.GetComponent<Image>();
#if UNITY_EDITOR
            Sprite sp = UnityEditor.AssetDatabase.LoadAssetAtPath<Sprite>($"Assets/Textures/Parchment/Icons/{iconName}.png");
            if (sp != null) img.sprite = sp;
#endif
            img.color = tint ?? Color.white;
            img.raycastTarget = false;
            return img;
        }

        private Text CreateLabel(Transform parent, Font font, string text, Vector2 pos, Vector2 size, int fontSize, FontStyle style, Color color, TextAnchor alignment)
        {
            GameObject obj = new("Label", typeof(RectTransform), typeof(Text));
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);

            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 0.5f);
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            Text txt = obj.GetComponent<Text>();
            txt.font = font;
            txt.text = text;
            txt.fontSize = fontSize;
            txt.fontStyle = style;
            txt.color = color;
            txt.alignment = alignment;
            txt.horizontalOverflow = HorizontalWrapMode.Overflow;
            txt.verticalOverflow = VerticalWrapMode.Overflow;
            txt.raycastTarget = false;
            return txt;
        }

        public void SetPlayerScore(int playerIndex, ScoreCategory category, int score)
        {
            PlayerScoreData data = playerIndex == 0 ? player1Data : player2Data;
            int catIdx = (int)category;

            if (catIdx >= 0 && catIdx <= 5)
            {
                data.upperScores[catIdx] = score;
            }
            else if (catIdx >= 7 && catIdx <= 12)
            {
                data.lowerScores[catIdx - 7] = score;
            }

            data.RecalculateTotal();
            RefreshAllScores();
        }

        public void RefreshAllScores()
        {
            UpdatePlayerScoreUI(player1Data, p1ScoreLabels, p1BonusProgressText);
            UpdatePlayerScoreUI(player2Data, p2ScoreLabels, p2BonusProgressText);
        }

        private void UpdatePlayerScoreUI(PlayerScoreData data, Text[] labels, Text bonusText)
        {
            if (labels == null || labels.Length < 14) return;

            Color inkMain = new Color32(38, 24, 15, 255);
            Color inkScoreEmpty = new Color32(155, 130, 105, 180);
            Color bonusScoreGold = new Color32(175, 95, 25, 255);
            Color footerScoreGold = new Color32(245, 185, 70, 255);

            for (int i = 0; i < 6; i++)
            {
                if (labels[i] != null)
                {
                    labels[i].text = data.upperScores[i] >= 0 ? data.upperScores[i].ToString() : "-";
                    labels[i].color = data.upperScores[i] >= 0 ? inkMain : inkScoreEmpty;
                }
            }

            int upperSum = data.CalculateUpperSum();
            if (bonusText != null)
            {
                bonusText.text = $"Bonus ({upperSum}/63)";
                bonusText.color = upperSum >= 63 ? bonusScoreGold : new Color32(42, 26, 16, 245);
            }
            if (labels[6] != null)
            {
                labels[6].text = "+35";
                labels[6].color = data.hasBonus ? bonusScoreGold : new Color32(150, 125, 105, 160);
            }

            for (int i = 0; i < 6; i++)
            {
                if (labels[i + 7] != null)
                {
                    labels[i + 7].text = data.lowerScores[i] >= 0 ? data.lowerScores[i].ToString() : "-";
                    labels[i + 7].color = data.lowerScores[i] >= 0 ? inkMain : inkScoreEmpty;
                }
            }

            if (labels[13] != null)
            {
                labels[13].text = data.totalScore.ToString();
                labels[13].color = footerScoreGold;
            }
        }

        private static void RemoveCollider(GameObject go)
        {
            Collider col = go.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }
        }

        private static void ApplyRendererSettings(GameObject go, Material mat)
        {
            MeshRenderer mr = go.GetComponent<MeshRenderer>();
            if (mr != null)
            {
                mr.material = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }

        private void OnDestroy()
        {
            CleanupExistingPipelines();
        }
    }
}
