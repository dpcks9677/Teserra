using UnityEngine;

namespace Tessera.Core
{
    public static class DiceBoardMetrics
    {
        public const float SourceDiceSize = 1.62f;
        public const float DieSize = 0.78f;
        public const float DieHalfSize = DieSize * 0.5f; // 0.39f

        // 정렬 시 1.3배 스케일업 규격
        public const float ActiveScaleMultiplier = 1.3f;
        public const float ActiveDieSize = DieSize * ActiveScaleMultiplier; // ~1.014f
        public const float ActiveDieHalfSize = ActiveDieSize * 0.5f;        // ~0.507f

        // 원본 프리셋 좌표(SourceDiceSize 1.62)를 현재 프로젝트 크기(0.78)로 스케일링하는 비율
        public const float SourceToUnityScale = DieSize / SourceDiceSize; // ~0.4814815f

        public const float PresetFloorY = -0.528f;
        public const float TrayScale = 0.05f;
        public const float RollSurfaceY = 0.2f;

        // 트레이 내부 바닥 착지 시 Y 중심 좌표 (0.2 + 0.39 = 0.59f)
        public const float FloorRestY = RollSurfaceY + DieHalfSize; // 0.59f

        // 트레이 테두리 림(Rim) 최상단 높이 및 정렬 시 주사위 Y 위치 (트레이 높이보다 조금 더 높은 위치)
        public const float TrayRimTopSourceY = 24.0f;
        public const float TrayRimTopY = RollSurfaceY + (TrayRimTopSourceY - PlayFloorSourceY) * TrayScale; // ~1.914f
        public const float ActiveArrangedY = TrayRimTopY + ActiveDieHalfSize + 0.05f; // ~2.47f (트레이 상단 위로 띄움)

        // 트레이 상단 12시 방향 킵 홈(Keep Surface) 높이 및 위치
        public const float KeepSurfaceSourceY = 13f;
        public const float PlayFloorSourceY = -10.283531f;
        public const float KeepSurfaceY = RollSurfaceY + (KeepSurfaceSourceY - PlayFloorSourceY) * TrayScale + DieHalfSize;

        public const float KeepStartSourceX = -44f;
        public const float KeepSpacingSourceX = 22f;
        public const float KeepCenterSourceZ = 58f; // 12시 방향 (+Z)

        public const float KeepStartX = KeepStartSourceX * TrayScale;       // -2.20f
        public const float KeepSpacingX = KeepSpacingSourceX * TrayScale;   //  1.10f
        public const float KeepCenterZ = KeepCenterSourceZ * TrayScale;     // +2.90f

        // 트레이 전체 외곽 가로폭: 155 * 0.05 = 7.75f
        // 5개 주사위 정렬 시 총 가로폭이 트레이 가로폭과 같아지도록 하는 간격: (7.75 - 1.014) / 4 = 1.684f
        public const float TrayOuterWidth = 155f * TrayScale; // 7.75f
        public const float ActiveSpacing = 1.5f; // 요청에 따른 정렬 간격 조정 (1.5f)

        public const float ActiveCenterZ = 0.0f;
        public const float KeepDieScale = 0.95f;

        /// <summary>
        /// 프리셋 로컬 좌표를 6시 -> 12시 투척 방향으로 180도 회전 변환하여 트레이 내부 좌표로 매핑
        /// </summary>
        public static Vector3 TransformPresetPosition(Vector3 presetPosition, bool isMirrored)
        {
            float px = isMirrored ? -presetPosition.x : presetPosition.x;
            float pz = presetPosition.z;
            float py = presetPosition.y;

            // 180도 회전: (-px, -pz) 및 주사위 크기 비례 스케일링
            float x = -px * SourceToUnityScale;
            float z = -pz * SourceToUnityScale;
            float y = FloorRestY + (py - PresetFloorY) * SourceToUnityScale;

            return new Vector3(x, y, z);
        }

        /// <summary>
        /// 활성 주사위(킵되지 않은 주사위)를 트레이 중앙에 가로로 정렬할 위치
        /// 주사위 개수에 따라 동일 간격을 유지하며 비례하여 가로폭을 줄이고 중앙 정렬
        /// </summary>
        public static Vector3 GetActivePosition(int slot, int totalActive)
        {
            float startX = -(totalActive - 1) * ActiveSpacing * 0.5f;
            return new Vector3(
                startX + slot * ActiveSpacing,
                ActiveArrangedY,
                ActiveCenterZ);
        }

        /// <summary>
        /// 킵(Keep)된 주사위를 트레이 상단(12시 방향) 킵 홈(Keep Zone)에 정렬할 위치
        /// </summary>
        public static Vector3 GetKeepPosition(int slot)
        {
            return new Vector3(
                KeepStartX + slot * KeepSpacingX,
                KeepSurfaceY,
                KeepCenterZ);
        }
    }
}
