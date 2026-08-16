using System;
using UnityEngine;

namespace Tessera.Dice
{
    public static class DiceFaceOrientation
    {
        public static readonly Vector3[] FaceNormals =
        {
            Vector3.up,       // 1 (Top: +Y)
            Vector3.forward,  // 2 (Front: +Z)
            Vector3.left,     // 3 (Left: -X)
            Vector3.right,    // 4 (Right: +X)
            Vector3.back,     // 5 (Back: -Z)
            Vector3.down      // 6 (Bottom: -Y)
        };

        private static readonly Vector3[] FaceUpAxes =
        {
            Vector3.back,     // 1
            Vector3.right,    // 2 (Numpad 1, 9 대각선 슬래시 정렬)
            Vector3.up,       // 3 (Numpad 1, 5, 9 대각선 슬래시 정렬)
            Vector3.up,       // 4
            Vector3.up,       // 5
            Vector3.forward   // 6 (Numpad 1, 3, 4, 6, 7, 9 세로 2열 정렬)
        };

        public static Quaternion GetTopRotation(int value)
        {
            return GetTopRotation(value, Vector3.forward);
        }

        public static Quaternion GetTopRotation(int value, Vector3 faceUpDirection)
        {
            if (value < 1 || value > FaceNormals.Length) value = 1;

            Vector3 alignedFaceUp = Vector3.ProjectOnPlane(faceUpDirection, Vector3.up).normalized;
            if (alignedFaceUp.sqrMagnitude < 0.5f) alignedFaceUp = Vector3.forward;

            Quaternion sourceBasis = Quaternion.LookRotation(FaceNormals[value - 1], FaceUpAxes[value - 1]);
            Quaternion targetBasis = Quaternion.LookRotation(Vector3.up, alignedFaceUp);
            return targetBasis * Quaternion.Inverse(sourceBasis);
        }

        public static Vector3 GetFaceNormal(int value)
        {
            if (value < 1 || value > FaceNormals.Length) return Vector3.up;
            return FaceNormals[value - 1];
        }

        public static Vector3 GetFaceUpAxis(int value)
        {
            if (value < 1 || value > FaceUpAxes.Length) return Vector3.forward;
            return FaceUpAxes[value - 1];
        }

        public static int GetTopValue(Quaternion rotation)
        {
            Quaternion normalizedRotation = rotation.normalized;
            int topValue = 1;
            float bestUpDot = float.NegativeInfinity;
            for (int index = 0; index < FaceNormals.Length; index++)
            {
                float upDot = Vector3.Dot(normalizedRotation * FaceNormals[index], Vector3.up);
                if (upDot <= bestUpDot) continue;
                bestUpDot = upDot;
                topValue = index + 1;
            }

            return topValue;
        }

        public static Quaternion GetUprightRotation(Quaternion landingRotation, Vector3 faceUpDirection)
        {
            return GetTopRotation(GetTopValue(landingRotation), faceUpDirection);
        }

        /// <summary>
        /// FBX 3D 모델의 Pip 위치를 측정하여 모델 자체의 고유한 기울임/회전 각도를 표준 직교 기저로 보정하는 Quaternion 반환
        /// </summary>
        public static Quaternion MeasureModelBasis(Transform visualRoot)
        {
            if (visualRoot == null) return Quaternion.identity;

            if (!TryMeasureFaceNormal(visualRoot, 1, out Vector3 actualUp)) return Quaternion.identity;
            if (!TryMeasureFaceNormal(visualRoot, 2, out Vector3 actualForward)) return Quaternion.identity;

            actualForward = Vector3.ProjectOnPlane(actualForward, actualUp).normalized;
            if (actualForward.sqrMagnitude < 0.5f) return Quaternion.identity;

            Quaternion modelBasis = Quaternion.LookRotation(actualForward, actualUp);
            return Quaternion.Inverse(modelBasis);
        }

        /// <summary>
        /// 프리셋 착지 회전에서 목표 눈이 상단으로 오며 목표 지향성(FaceUpAxis)이 물리적 지향성에 일치하도록 하는 Visual 직교 기저 회전 계산
        /// </summary>
        public static Quaternion GetVisualRemapRotation(Quaternion landingRotation, int targetTopValue, Quaternion baseCorrection)
        {
            int physicalTop = GetTopValue(landingRotation);

            Quaternion sourceBasis = Quaternion.LookRotation(
                FaceNormals[targetTopValue - 1],
                GetFaceUpAxis(targetTopValue));
            Quaternion targetBasis = Quaternion.LookRotation(
                FaceNormals[physicalTop - 1],
                GetFaceUpAxis(physicalTop));

            Quaternion step = targetBasis * Quaternion.Inverse(sourceBasis);
            return step * baseCorrection;
        }

        public static int[] GetRemappedFaceValues(Quaternion landingRotation, int targetTopValue)
        {
            if (targetTopValue < 1 || targetTopValue > FaceNormals.Length)
            {
                throw new ArgumentOutOfRangeException(nameof(targetTopValue));
            }

            int physicalTopValue = GetTopValue(landingRotation);
            Quaternion labelRotation = Quaternion.Inverse(GetTopRotation(physicalTopValue, Vector3.back))
                * GetTopRotation(targetTopValue, Vector3.back);
            Quaternion inverseLabelRotation = Quaternion.Inverse(labelRotation);
            int[] values = new int[FaceNormals.Length];
            for (int physicalFace = 0; physicalFace < FaceNormals.Length; physicalFace++)
            {
                Vector3 labelDirection = inverseLabelRotation * FaceNormals[physicalFace];
                values[physicalFace] = GetClosestFaceValue(labelDirection);
            }

            return values;
        }

        private static int GetClosestFaceValue(Vector3 direction)
        {
            int value = 1;
            float bestDot = float.NegativeInfinity;
            for (int index = 0; index < FaceNormals.Length; index++)
            {
                float dot = Vector3.Dot(direction, FaceNormals[index]);
                if (dot <= bestDot) continue;
                bestDot = dot;
                value = index + 1;
            }

            return value;
        }

        public static bool TryMeasureFaceNormal(Transform dieRoot, int value, out Vector3 normal)
        {
            normal = Vector3.zero;
            if (dieRoot == null || value < 1 || value > FaceNormals.Length) return false;

            string prefix = $"Pip_{value}";
            int count = 0;
            foreach (Transform child in dieRoot.GetComponentsInChildren<Transform>(true))
            {
                if (!child.name.StartsWith(prefix, StringComparison.Ordinal)) continue;
                normal += dieRoot.InverseTransformPoint(child.position);
                count++;
            }

            if (count == 0 || normal.sqrMagnitude < 0.0001f)
            {
                normal = FaceNormals[value - 1];
                return true;
            }

            normal.Normalize();
            return true;
        }
    }
}
