using UnityEngine;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 저해상도에서도 읽히는 선분 기반 룬 문자 데이터.
    /// 각 배열은 시작점/끝점 쌍으로 구성되며 좌표 범위는 대략 -0.5~0.5이다.
    /// </summary>
    internal static class RunicGlyphData
    {
        private static Vector2[] Segments(params float[] values)
        {
            Vector2[] result = new Vector2[values.Length / 2];
            for (int i = 0; i < values.Length; i += 2)
            {
                result[i / 2] = new Vector2(values[i], values[i + 1]);
            }
            return result;
        }

        private static readonly Vector2[][] OuterRunes =
        {
            // Fehu
            Segments(0f, -0.5f, 0f, 0.5f, 0f, 0.38f, 0.42f, 0.18f, 0f, 0.12f, 0.36f, -0.08f),
            // Uruz
            Segments(-0.35f, -0.5f, -0.35f, 0.38f, -0.35f, 0.38f, 0.18f, 0.5f, 0.18f, 0.5f, 0.36f, 0.22f, 0.36f, 0.22f, 0.18f, -0.5f),
            // Thurisaz
            Segments(-0.2f, -0.5f, -0.2f, 0.5f, -0.2f, 0.3f, 0.35f, 0f, 0.35f, 0f, -0.2f, -0.3f),
            // Ansuz
            Segments(-0.22f, -0.5f, -0.22f, 0.5f, -0.22f, 0.38f, 0.38f, 0.06f, -0.22f, 0.05f, 0.32f, -0.25f),
            // Raidho
            Segments(-0.28f, -0.5f, -0.28f, 0.5f, -0.28f, 0.5f, 0.28f, 0.3f, 0.28f, 0.3f, -0.28f, 0.05f, -0.28f, 0.05f, 0.34f, -0.5f),
            // Kenaz
            Segments(-0.3f, 0.5f, 0.3f, 0f, 0.3f, 0f, -0.3f, -0.5f),
            // Gebo
            Segments(-0.38f, -0.5f, 0.38f, 0.5f, -0.38f, 0.5f, 0.38f, -0.5f),
            // Wunjo
            Segments(-0.28f, -0.5f, -0.28f, 0.5f, -0.28f, 0.5f, 0.32f, 0.22f, 0.32f, 0.22f, -0.28f, -0.04f),
            // Hagalaz
            Segments(-0.32f, -0.5f, -0.32f, 0.5f, 0.32f, -0.5f, 0.32f, 0.5f, -0.32f, -0.28f, 0.32f, 0.28f),
            // Nauthiz
            Segments(0f, -0.5f, 0f, 0.5f, -0.38f, 0.22f, 0.38f, -0.18f),
            // Isa
            Segments(0f, -0.5f, 0f, 0.5f),
            // Jera
            Segments(-0.4f, 0.22f, 0f, 0.5f, 0f, 0.5f, 0.4f, 0.2f, 0.4f, -0.22f, 0f, -0.5f, 0f, -0.5f, -0.4f, -0.2f)
        };

        private static readonly Vector2[][] StoneRunes =
        {
            // Tiwaz
            Segments(0f, -0.48f, 0f, 0.48f, 0f, 0.48f, -0.34f, 0.18f, 0f, 0.48f, 0.34f, 0.18f),
            // Sowilo
            Segments(0.28f, 0.48f, -0.2f, 0.15f, -0.2f, 0.15f, 0.22f, -0.12f, 0.22f, -0.12f, -0.28f, -0.48f),
            // Ehwaz
            Segments(-0.3f, -0.48f, -0.3f, 0.48f, 0.3f, -0.48f, 0.3f, 0.48f, -0.3f, 0.42f, 0.3f, -0.05f, -0.3f, -0.05f, 0.3f, -0.42f),
            // Othala
            Segments(0f, 0.48f, 0.34f, 0.05f, 0.34f, 0.05f, 0f, -0.28f, 0f, -0.28f, -0.34f, 0.05f, -0.34f, 0.05f, 0f, 0.48f, -0.18f, -0.12f, -0.42f, -0.48f, 0.18f, -0.12f, 0.42f, -0.48f)
        };

        public static Vector2[] GetOuterRune(int index)
        {
            return OuterRunes[Mathf.Abs(index) % OuterRunes.Length];
        }

        public static Vector2[] GetStoneRune(int index)
        {
            return StoneRunes[Mathf.Abs(index) % StoneRunes.Length];
        }
    }
}