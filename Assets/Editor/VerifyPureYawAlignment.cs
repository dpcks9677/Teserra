using System;
using System.IO;
using System.Text;
using Tessera.Dice;
using UnityEditor;
using UnityEngine;

public static class VerifyPureYawAlignment
{
    [MenuItem("Tools/Tessera/Verify Pure Yaw Alignment")]
    public static void TestPureYaw()
    {
        DicePresetCatalog catalog = DicePresetCatalog.LoadNormalFiveDice();
        int clipCount = catalog.NormalFiveDiceClipCount;

        GameObject dieObj = GameObject.Find("Die_1");
        Transform visual = dieObj != null ? dieObj.transform.Find("Visual") : null;
        if (visual == null)
        {
            Debug.LogError("Die_1/Visual not found in scene!");
            return;
        }

        Quaternion baseCorrection = DiceFaceOrientation.MeasureModelBasis(visual);
        var sb = new StringBuilder();
        sb.AppendLine("===== PURE YAW ALIGNMENT (NO TUMBLE/ROLL) TEST =====");

        int totalPass = 0;
        int totalTests = 0;
        float maxTiltAngle = 0f;

        for (int c = 0; c < clipCount; c++)
        {
            if (!catalog.TryGetClip(c, out WebPresetClip clip)) continue;
            var landingFrame = clip.Frames[clip.Frames.Length - 1];

            for (int d = 0; d < landingFrame.Dice.Length; d++)
            {
                Quaternion rawLandingRot = BakedDiceController.TransformPresetDie(landingFrame.Dice[d], false).Rotation;

                for (int targetValue = 1; targetValue <= 6; targetValue++)
                {
                    totalTests++;

                    // 1. 착지 시점 Visual 로컬 회전 (고정)
                    Quaternion remapRot = DiceFaceOrientation.GetVisualRemapRotation(rawLandingRot, targetValue, baseCorrection);
                    visual.localRotation = remapRot;
                    dieObj.transform.localRotation = rawLandingRot;

                    // 착지 시점 윗면 법선 벡터
                    Vector3 landingUp = rawLandingRot * remapRot * DiceFaceOrientation.GetFaceNormal(targetValue);

                    // 2. 순수 수평 정렬 목표 루트 회전 계산
                    Quaternion stdRotation = DiceFaceOrientation.GetTopRotation(targetValue, Vector3.forward) * baseCorrection;
                    Quaternion targetRootRot = stdRotation * Quaternion.Inverse(remapRot);

                    // 목표 시점 윗면 법선 벡터
                    Vector3 targetUp = targetRootRot * remapRot * DiceFaceOrientation.GetFaceNormal(targetValue);

                    // 윗면 법선 간의 각도 변화 (구르는 각도 = Tilt)
                    float tiltAngle = Vector3.Angle(landingUp, targetUp);
                    if (tiltAngle > maxTiltAngle) maxTiltAngle = tiltAngle;

                    // 3. 목표 루트 회전 적용
                    dieObj.transform.localRotation = targetRootRot;
                    int finalTop = MeasureVisualTop(visual);
                    bool numpadMatch = CheckNumpadOrientation(visual, targetValue);

                    // 프리셋 착지 오차(기울기)를 제외하고 주사위가 뒤집히거나 구르는지(Tilt > 45도) 확인
                    bool noTumble = tiltAngle < 25f; // 프리셋 자체의 약간의 기울기는 보통 0~10도 미만

                    if (finalTop == targetValue && numpadMatch && noTumble)
                    {
                        totalPass++;
                    }
                    else
                    {
                        sb.AppendLine($"[FAIL] Clip #{c}, Die {d}, Target {targetValue} -> Tilt: {tiltAngle:F1}deg, Top: {finalTop}, Numpad: {numpadMatch}");
                    }
                }
            }
        }

        sb.AppendLine($"Summary: {totalPass}/{totalTests} tests PASSED! Max Tilt: {maxTiltAngle:F2} deg");
        Debug.Log(sb.ToString());
        File.WriteAllText("pure_yaw_test_result.txt", sb.ToString());
    }

    private static int MeasureVisualTop(Transform visual)
    {
        int bestValue = 1;
        float bestDot = float.NegativeInfinity;

        for (int v = 1; v <= 6; v++)
        {
            if (DiceFaceOrientation.TryMeasureFaceNormal(visual, v, out Vector3 localNormal))
            {
                Vector3 worldNormal = visual.TransformDirection(localNormal);
                float dot = Vector3.Dot(worldNormal, Vector3.up);
                if (dot > bestDot)
                {
                    bestDot = dot;
                    bestValue = v;
                }
            }
        }

        return bestValue;
    }

    private static bool CheckNumpadOrientation(Transform visual, int value)
    {
        if (value == 1 || value == 4 || value == 5) return true;

        string prefix = $"Pip_{value}";
        int numpadMask = 0;
        foreach (Transform child in visual.GetComponentsInChildren<Transform>(true))
        {
            if (!child.name.StartsWith(prefix, StringComparison.Ordinal)) continue;
            Vector3 worldPos = child.position;
            Vector3 dieRootPos = visual.parent.position;
            Vector3 diff = worldPos - dieRootPos;
            int numpad = GetNumpadNumber(diff.x, diff.z);
            numpadMask |= (1 << numpad);
        }

        if (value == 2) return (numpadMask & (1 << 1)) != 0 && (numpadMask & (1 << 9)) != 0;
        if (value == 3) return (numpadMask & (1 << 1)) != 0 && (numpadMask & (1 << 5)) != 0 && (numpadMask & (1 << 9)) != 0;
        if (value == 6) return (numpadMask & (1 << 4)) != 0 && (numpadMask & (1 << 6)) != 0;

        return true;
    }

    private static int GetNumpadNumber(float x, float z)
    {
        int row = (z > 0.05f) ? 2 : ((z < -0.05f) ? 0 : 1);
        int col = (x < -0.05f) ? 0 : ((x > 0.05f) ? 2 : 1);
        int[,] numpad = {
            { 1, 2, 3 },
            { 4, 5, 6 },
            { 7, 8, 9 }
        };
        return numpad[row, col];
    }
}
