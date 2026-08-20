using System;
using System.Collections.Generic;
using UnityEngine;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 황도 12궁(Zodiac 12 Constellations) 천문학적 벡터 데이터 및 고품질 프로시저럴 텍스처 베이킹 시스템
    /// - 12종의 황도 12궁 별 좌표와 연결선 정의
    /// - 안티앨리어싱 선분 및 4각 스파이크 글로우 스타 렌더링
    /// - R 채널: 선분/글로우, G 채널: 트윙클용 별 코어, B 채널: 배경 미세 별가루, A 채널: 종합 알파
    /// </summary>
    public static class ZodiacConstellationData
    {
        public enum ZodiacType
        {
            Aries = 0,       // 1. 양자리
            Taurus = 1,      // 2. 황소자리
            Gemini = 2,      // 3. 쌍둥이자리
            Cancer = 3,      // 4. 게자리
            Leo = 4,         // 5. 사자자리
            Virgo = 5,       // 6. 처녀자리
            Libra = 6,       // 7. 천칭자리
            Scorpio = 7,     // 8. 전갈자리
            Sagittarius = 8, // 9. 궁수자리
            Capricorn = 9,   // 10. 염소자리
            Aquarius = 10,   // 11. 물병자리
            Pisces = 11      // 12. 물고기자리
        }

        public struct StarPoint
        {
            public Vector2 pos;      // -0.65 ~ +0.65 정규화 좌표
            public float brightness; // 0.6 ~ 1.5 별의 상대적 밝기
            public float size;       // 0.8 ~ 1.6 별의 크기

            public StarPoint(float x, float y, float b = 1.0f, float s = 1.0f)
            {
                pos = new Vector2(x, y);
                brightness = b;
                size = s;
            }
        }

        public struct ConstellationDefinition
        {
            public ZodiacType type;
            public string nameKr;
            public string nameEn;
            public StarPoint[] stars;
            public (int a, int b)[] lines;

            public ConstellationDefinition(ZodiacType t, string kr, string en, StarPoint[] s, (int, int)[] l)
            {
                type = t;
                nameKr = kr;
                nameEn = en;
                stars = s;
                lines = l;
            }
        }

        private static readonly ConstellationDefinition[] Definitions = new ConstellationDefinition[]
        {
            // 1. Aries (양자리) - 완만한 아치형 3~4개의 별
            new(
                ZodiacType.Aries, "양자리", "Aries",
                new StarPoint[]
                {
                    new(-0.35f,  0.08f, 1.4f, 1.3f), // 하말 (Hamal, 가장 밝음)
                    new(-0.08f,  0.18f, 1.2f, 1.1f), // 셰라탄 (Sheratan)
                    new( 0.22f,  0.12f, 0.9f, 0.9f), // 메사르팀 (Mesarthim)
                    new( 0.38f, -0.15f, 0.8f, 0.8f)  // 41 Arietis
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3) }
            ),

            // 2. Taurus (황소자리) - V자 히아데스 성단 + 알데바란 + 두 뿔
            new(
                ZodiacType.Taurus, "황소자리", "Taurus",
                new StarPoint[]
                {
                    new(-0.38f,  0.36f, 1.0f, 1.0f), // 엘나스 (Elnath - 북쪽 뿔)
                    new(-0.26f,  0.10f, 0.9f, 0.9f), 
                    new(-0.05f, -0.06f, 1.0f, 1.0f), // V자 중심
                    new( 0.16f, -0.18f, 1.5f, 1.4f), // 알데바란 (Aldebaran - 붉은 거성)
                    new( 0.36f, -0.12f, 0.9f, 0.9f),
                    new( 0.26f,  0.10f, 1.0f, 1.0f), // 티앙관 (Tianguan - 남쪽 뿔)
                    new( 0.45f,  0.32f, 0.8f, 0.8f),
                    new(-0.12f,  0.26f, 1.1f, 1.1f)  // 플레이아데스 방향
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 2), (5, 6), (1, 7) }
            ),

            // 3. Gemini (쌍둥이자리) - 카스토르 & 폴룩스 머리와 나란한 두 몸체
            new(
                ZodiacType.Gemini, "쌍둥이자리", "Gemini",
                new StarPoint[]
                {
                    new(-0.20f,  0.38f, 1.3f, 1.2f), // 카스토르 (Castor)
                    new( 0.16f,  0.40f, 1.5f, 1.3f), // 폴룩스 (Pollux)
                    new(-0.22f,  0.12f, 0.9f, 0.9f),
                    new( 0.14f,  0.15f, 1.0f, 1.0f),
                    new(-0.25f, -0.15f, 0.9f, 0.9f),
                    new( 0.10f, -0.12f, 0.9f, 0.9f),
                    new(-0.30f, -0.38f, 1.1f, 1.0f), // 알헤나 (Alhena)
                    new( 0.05f, -0.38f, 0.9f, 0.9f),
                    new(-0.04f,  0.14f, 0.8f, 0.8f)  // 중앙 연결 노드
                },
                new (int, int)[] { (0, 2), (2, 4), (4, 6), (1, 3), (3, 5), (5, 7), (2, 8), (3, 8) }
            ),

            // 4. Cancer (게자리) - 중심 Y자 반전 클로 형태 (프레세페 성단)
            new(
                ZodiacType.Cancer, "게자리", "Cancer",
                new StarPoint[]
                {
                    new( 0.00f,  0.06f, 1.3f, 1.2f), // 아셀루스 아우스트랄리스 (중심)
                    new(-0.26f,  0.30f, 1.0f, 1.0f), // 아쿠벤스 방향 집게 1
                    new( 0.26f,  0.28f, 1.0f, 1.0f), // 집게 2
                    new(-0.16f, -0.32f, 1.1f, 1.0f), // 남쪽 다리
                    new( 0.16f, -0.30f, 1.1f, 1.0f)  // 아쿠벤스 (Acubens)
                },
                new (int, int)[] { (0, 1), (0, 2), (0, 3), (0, 4), (3, 4) }
            ),

            // 5. Leo (사자자리) - 낫(Sickle) 머리 + 삼각형 몸통 + 레굴루스 & 데네볼라
            new(
                ZodiacType.Leo, "사자자리", "Leo",
                new StarPoint[]
                {
                    new(-0.35f, -0.15f, 1.5f, 1.4f), // 레굴루스 (Regulus - 사자의 심장)
                    new(-0.15f, -0.12f, 1.0f, 1.0f),
                    new( 0.20f, -0.15f, 1.0f, 1.0f), // 조스마 (Zosma)
                    new( 0.38f,  0.02f, 1.4f, 1.3f), // 데네볼라 (Denebola - 꼬리)
                    new( 0.20f,  0.22f, 0.9f, 0.9f), // 카프라 (Chertan)
                    new( 0.00f,  0.32f, 1.1f, 1.1f), // 알게바 (Algieba)
                    new(-0.16f,  0.22f, 1.0f, 1.0f),
                    new(-0.16f,  0.06f, 0.9f, 0.9f),
                    new(-0.35f,  0.10f, 1.0f, 1.0f)  // 낫의 끝 (Ras Elased)
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 1), (0, 8), (8, 6) }
            ),

            // 6. Virgo (처녀자리) - 스피카 중심 Y/다이아몬드 날개 구조
            new(
                ZodiacType.Virgo, "처녀자리", "Virgo",
                new StarPoint[]
                {
                    new( 0.05f, -0.32f, 1.6f, 1.5f), // 스피카 (Spica - 가장 밝음)
                    new(-0.10f, -0.06f, 1.1f, 1.1f), // 포리마 (Porrima)
                    new(-0.28f,  0.14f, 1.0f, 1.0f), // 빈데미아트릭스
                    new(-0.38f,  0.32f, 0.9f, 0.9f),
                    new( 0.12f,  0.08f, 1.1f, 1.1f), // 헤제 (Heze)
                    new( 0.32f,  0.24f, 1.0f, 1.0f),
                    new( 0.18f,  0.35f, 0.8f, 0.8f),
                    new( 0.28f, -0.16f, 0.9f, 0.9f),
                    new(-0.30f, -0.22f, 0.8f, 0.8f)
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3), (1, 4), (4, 5), (5, 6), (4, 7), (1, 8) }
            ),

            // 7. Libra (천칭자리) - 사각형 저울 바디 + 양쪽 접시
            new(
                ZodiacType.Libra, "천칭자리", "Libra",
                new StarPoint[]
                {
                    new(-0.24f,  0.22f, 1.3f, 1.2f), // 주벤엘게누비 (Zubenelgenubi)
                    new( 0.24f,  0.22f, 1.3f, 1.2f), // 주벤에샤마리 (Zubeneschemali)
                    new(-0.32f, -0.15f, 1.0f, 1.0f), // 브라키움 (Brachium)
                    new( 0.32f, -0.15f, 1.0f, 1.0f),
                    new( 0.00f, -0.30f, 0.9f, 0.9f)  // 저울추
                },
                new (int, int)[] { (0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (2, 3) }
            ),

            // 8. Scorpio (전갈자리) - 안타레스 + 우아한 S자 낚싯바늘 꼬리 & 독침
            new(
                ZodiacType.Scorpio, "전갈자리", "Scorpio",
                new StarPoint[]
                {
                    new(-0.38f,  0.30f, 1.0f, 1.0f), // 그라피아스 (Acrab)
                    new(-0.28f,  0.20f, 1.1f, 1.1f), // 드슈바 (Dschubba)
                    new(-0.35f,  0.08f, 0.9f, 0.9f),
                    new(-0.10f,  0.15f, 1.6f, 1.5f), // 안타레스 (Antares - 전갈의 심장)
                    new( 0.02f,  0.02f, 1.0f, 1.0f),
                    new( 0.08f, -0.16f, 1.0f, 1.0f),
                    new( 0.12f, -0.32f, 1.1f, 1.1f), // 웨이 (Wei)
                    new( 0.26f, -0.34f, 1.2f, 1.2f), // 사르가스 (Sargas)
                    new( 0.36f, -0.20f, 1.3f, 1.2f), // 샤울라 (Shaula - 독침)
                    new( 0.30f, -0.06f, 1.1f, 1.1f)  // 레사트 (Lesath)
                },
                new (int, int)[] { (0, 1), (2, 1), (1, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 9) }
            ),

            // 9. Sagittarius (궁수자리) - 완벽한 티팟(Teapot) 주전자 형태
            new(
                ZodiacType.Sagittarius, "궁수자리", "Sagittarius",
                new StarPoint[]
                {
                    new(-0.32f,  0.04f, 1.1f, 1.1f), // 알나슬 (Alnasl - 주둥이)
                    new(-0.18f,  0.24f, 1.2f, 1.2f), // 카우스 메디우스 (Kaus Media)
                    new( 0.00f,  0.35f, 1.3f, 1.2f), // 카우스 보레알리스 (Kaus Borealis - 뚜껑)
                    new( 0.14f,  0.18f, 1.2f, 1.2f), // 피 사지타리 (Phi Sgr)
                    new( 0.28f,  0.22f, 1.1f, 1.1f), // 누노키 (Nunki - 손잡이 상단)
                    new( 0.35f, -0.06f, 1.1f, 1.1f), // 아셀라 (Ascella - 손잡이 하단)
                    new( 0.15f, -0.24f, 1.4f, 1.3f), // 카우스 아우스트랄리스 (Kaus Australis)
                    new(-0.15f, -0.20f, 1.0f, 1.0f),
                    new(-0.02f,  0.04f, 0.8f, 0.8f)  // 티팟 중앙 노드
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 0), (1, 8), (8, 3), (8, 6), (7, 8) }
            ),

            // 10. Capricorn (염소자리) - 거대한 역삼각형/부메랑 바다염소 형태
            new(
                ZodiacType.Capricorn, "염소자리", "Capricorn",
                new StarPoint[]
                {
                    new(-0.38f,  0.25f, 1.3f, 1.2f), // 알게디 (Algedi)
                    new(-0.24f,  0.30f, 1.2f, 1.2f), // 다비흐 (Dabih)
                    new( 0.25f,  0.25f, 1.0f, 1.0f),
                    new( 0.38f,  0.15f, 1.4f, 1.3f), // 데네브 알게디 (Deneb Algedi - 꼬리)
                    new( 0.18f, -0.26f, 1.0f, 1.0f),
                    new(-0.05f, -0.32f, 1.0f, 1.0f),
                    new(-0.25f, -0.15f, 0.9f, 0.9f)
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 0), (1, 6), (2, 4) }
            ),

            // 11. Aquarius (물병자리) - 물병과 지그재그로 흘러내리는 신비로운 물줄기
            new(
                ZodiacType.Aquarius, "물병자리", "Aquarius",
                new StarPoint[]
                {
                    new(-0.28f,  0.30f, 1.3f, 1.2f), // 사달멜릭 (Sadalmelik)
                    new(-0.10f,  0.35f, 1.4f, 1.3f), // 사달수드 (Sadalsuud - 물병 입구)
                    new( 0.06f,  0.28f, 1.0f, 1.0f),
                    new(-0.35f,  0.08f, 0.9f, 0.9f),
                    new(-0.15f,  0.05f, 1.0f, 1.0f), // 물줄기 1층
                    new( 0.10f,  0.02f, 0.9f, 0.9f),
                    new( 0.30f,  0.05f, 1.1f, 1.1f), // 스카트 (Skat)
                    new(-0.25f, -0.25f, 0.9f, 0.9f),
                    new( 0.00f, -0.28f, 1.0f, 1.0f), // 물줄기 2층
                    new( 0.25f, -0.25f, 0.9f, 0.9f)
                },
                new (int, int)[] { (0, 1), (1, 2), (0, 3), (1, 4), (2, 5), (5, 6), (3, 7), (4, 8), (6, 9), (7, 8), (8, 9) }
            ),

            // 12. Pisces (물고기자리) - 두 마리 물고기(서클)와 이를 잇는 우아한 V자 리본
            new(
                ZodiacType.Pisces, "물고기자리", "Pisces",
                new StarPoint[]
                {
                    new(-0.35f,  0.32f, 1.1f, 1.1f), // 서쪽 물고기 1
                    new(-0.22f,  0.28f, 1.0f, 1.0f), // 서쪽 물고기 2
                    new(-0.28f,  0.15f, 1.0f, 1.0f), // 서쪽 물고기 3
                    new(-0.10f, -0.05f, 0.9f, 0.9f), // 리본 중간
                    new( 0.00f, -0.32f, 1.4f, 1.3f), // 알레샤 (Alrescha - 매듭점)
                    new( 0.15f, -0.10f, 0.9f, 0.9f), // 리본 중간
                    new( 0.28f,  0.08f, 1.0f, 1.0f), // 북쪽 물고기
                    new( 0.35f,  0.25f, 1.1f, 1.1f),
                    new( 0.22f,  0.28f, 1.0f, 1.0f),
                    new( 0.18f,  0.12f, 0.9f, 0.9f)
                },
                new (int, int)[] { (0, 1), (1, 2), (2, 0), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 9), (9, 6) }
            )
        };

        private static Texture2D[] cachedTextures;

        /// <summary>
        /// 캐시된 별자리 텍스처 초기화 (런타임/에디터 리빌드 시 갱신 보장)
        /// </summary>
        public static void ClearCache()
        {
            cachedTextures = null;
        }

        /// <summary>
        /// 12개 황도 12궁 텍스처 배열 반환 (필요 시 자동 생성 및 캐싱)
        /// </summary>
        public static Texture2D[] GetAllZodiacTextures(int resolution = 256)
        {
            if (cachedTextures != null && cachedTextures.Length == 12 && cachedTextures[0] != null)
            {
                return cachedTextures;
            }

            cachedTextures = new Texture2D[12];
            for (int i = 0; i < 12; i++)
            {
                cachedTextures[i] = BakeConstellationTexture(Definitions[i], resolution);
            }
            return cachedTextures;
        }

        public static Texture2D GetZodiacTexture(int index, int resolution = 256)
        {
            Texture2D[] all = GetAllZodiacTextures(resolution);
            int idx = Mathf.Clamp(index, 0, 11);
            return all[idx];
        }

        public static ConstellationDefinition GetDefinition(int index)
        {
            int idx = Mathf.Clamp(index, 0, 11);
            return Definitions[idx];
        }

        /// <summary>
        /// 지정된 별자리 정의를 고해상도 안티앨리어스 RGBA32 텍스처로 프로시저럴 베이킹
        /// </summary>
        public static Texture2D BakeConstellationTexture(ConstellationDefinition def, int resolution = 256)
        {
            Texture2D tex = new(resolution, resolution, TextureFormat.RGBA32, false)
            {
                name = $"Zodiac_{def.type}_{def.nameEn}",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };

            Color32[] pixels = new Color32[resolution * resolution];
            float invRes = 1.0f / resolution;
            float lineThickness = (1.8f / resolution) * 2.0f; // 선명한 얇은 천문도 선
            float lineGlowWidth = (5.5f / resolution) * 2.0f; // 부드러운 선 글로우
            const float ConstellationScale = 1.50f; // 구체 전반으로 1.5배 확장

            // 배경 고정 은하수 별가루 80개 생성 (별자리 일러스트 주변 회피 필터링)
            int seed = (int)def.type * 100 + 42;
            UnityEngine.Random.InitState(seed);
            List<Vector4> stardust = new(); // (x, y, brightness, size)
            int attempts = 0;
            while (stardust.Count < 80 && attempts < 500)
            {
                attempts++;
                float angle = UnityEngine.Random.Range(0f, Mathf.PI * 2f);
                float dist = UnityEngine.Random.Range(0.04f, 0.78f);
                Vector2 sPos = new(Mathf.Cos(angle) * dist, Mathf.Sin(angle) * dist);

                // 별자리 선 및 별과의 거리 검사
                float minDist = float.MaxValue;
                for (int l = 0; l < def.lines.Length; l++)
                {
                    Vector2 pA = def.stars[def.lines[l].a].pos * ConstellationScale;
                    Vector2 pB = def.stars[def.lines[l].b].pos * ConstellationScale;
                    minDist = Mathf.Min(minDist, DistanceToSegment(sPos, pA, pB));
                }
                for (int s = 0; s < def.stars.Length; s++)
                {
                    Vector2 starPos = def.stars[s].pos * ConstellationScale;
                    minDist = Mathf.Min(minDist, (sPos - starPos).magnitude);
                }

                // 별자리에서 일정 거리(약 14픽셀) 이상 떨어진 위치에만 스폰
                if (minDist >= 0.11f)
                {
                    float sb = UnityEngine.Random.Range(0.35f, 1.0f);
                    float ss = UnityEngine.Random.Range(0.85f, 1.8f);
                    stardust.Add(new Vector4(sPos.x, sPos.y, sb, ss));
                }
            }

            // 은하수 성운 흐름 밴드 회전 각도
            float nebulaAngle = ((int)def.type * 30f + 35f) * Mathf.Deg2Rad;
            float cosNeb = Mathf.Cos(nebulaAngle);
            float sinNeb = Mathf.Sin(nebulaAngle);

            for (int y = 0; y < resolution; y++)
            {
                float ny = (y + 0.5f) * invRes * 2.0f - 1.0f; // -1.0 ~ +1.0
                int rowIdx = y * resolution;

                for (int x = 0; x < resolution; x++)
                {
                    float nx = (x + 0.5f) * invRes * 2.0f - 1.0f; // -1.0 ~ +1.0
                    Vector2 uvPos = new(nx, ny);
                    float rDist = uvPos.magnitude;

                    // 구체 밖(r > 0.88)은 0
                    if (rDist > 0.88f)
                    {
                        pixels[rowIdx + x] = new Color32(0, 0, 0, 0);
                        continue;
                    }

                    float lineAccum = 0.0f;
                    float starCoreAccum = 0.0f;
                    float minConstDist = float.MaxValue;

                    // 1. 선분(Lines) 렌더링 및 최소 거리 트래킹 - 1.5배 확장된 좌표계
                    for (int l = 0; l < def.lines.Length; l++)
                    {
                        var line = def.lines[l];
                        Vector2 pA = def.stars[line.a].pos * ConstellationScale;
                        Vector2 pB = def.stars[line.b].pos * ConstellationScale;

                        float dist = DistanceToSegment(uvPos, pA, pB);
                        minConstDist = Mathf.Min(minConstDist, dist);

                        float core = Mathf.Exp(-Mathf.Pow(dist / lineThickness, 2.0f)) * 1.0f;
                        float glow = Mathf.Exp(-Mathf.Pow(dist / lineGlowWidth, 2.0f)) * 0.40f;
                        lineAccum += Mathf.Max(core, glow);
                    }

                    // 2. 별(Stars) 렌더링 및 최소 거리 트래킹
                    for (int s = 0; s < def.stars.Length; s++)
                    {
                        var star = def.stars[s];
                        Vector2 starPos = star.pos * ConstellationScale;
                        Vector2 delta = uvPos - starPos;
                        float dist = delta.magnitude;
                        minConstDist = Mathf.Min(minConstDist, dist);

                        float starRadius = (2.2f / resolution) * 2.0f * star.size;
                        float starGlowRadius = (6.0f / resolution) * 2.0f * star.size;

                        // 작고 선명한 별 코어 점
                        float core = Mathf.Exp(-Mathf.Pow(dist / starRadius, 2.0f)) * star.brightness * 1.35f;
                        // 정교한 4각 다이아몬드 크로스 스파이크 (Sharp Diamond Star Spikes)
                        float crossX = Mathf.Exp(-Mathf.Abs(delta.x) / ((1.1f / resolution) * 2.0f)) * Mathf.Exp(-Mathf.Abs(delta.y) / (starGlowRadius * 1.2f));
                        float crossY = Mathf.Exp(-Mathf.Abs(delta.y) / ((1.1f / resolution) * 2.0f)) * Mathf.Exp(-Mathf.Abs(delta.x) / (starGlowRadius * 1.2f));
                        float spikes = (crossX + crossY) * 0.75f * star.brightness;

                        starCoreAccum += core + spikes;
                    }

                    // 3. 별자리 일러스트 주변 클리어런스 마스크 (Clearance Mask - 별자리 주변 깨끗한 여백)
                    float clearanceRadius = (16.0f / resolution) * 2.0f; // 약 16픽셀 너비의 마스킹 여백
                    float clearanceMask = Mathf.SmoothStep(0.0f, 1.0f, minConstDist / clearanceRadius);

                    // 4. 풍성한 은하수 성운 띠(Milky Way Nebula Belt) + 미세 별가루 80개 (클리어런스 마스크 적용)
                    // 4-1. 은하수 다층 성운 밴드
                    float rotatedU = nx * cosNeb + ny * sinNeb;
                    float neb1 = Mathf.Exp(-Mathf.Pow(rotatedU / 0.36f, 2.0f)) * 0.55f;
                    float neb2 = Mathf.Exp(-Mathf.Pow((rotatedU - 0.22f) / 0.25f, 2.0f)) * 0.30f;
                    float nebulaBand = neb1 + neb2;

                    // 4-2. 미세 별가루 입자들
                    float dustAccum = 0.0f;
                    for (int d = 0; d < stardust.Count; d++)
                    {
                        Vector4 dust = stardust[d];
                        float dDist = (uvPos - new Vector2(dust.x, dust.y)).magnitude;
                        float dustRadius = (2.4f / resolution) * 2.0f * dust.w;
                        dustAccum += Mathf.Exp(-Mathf.Pow(dDist / dustRadius, 2.0f)) * dust.z;
                    }

                    // 별자리 일러스트 주변에는 은하수 및 별가루가 침범하지 않도록 마스킹
                    float totalStardust = Mathf.Clamp01((nebulaBand * 0.75f + dustAccum * 1.25f) * clearanceMask);

                    // 채널별 패킹
                    // R: 선 및 섬세한 연결선
                    float rVal = Mathf.Clamp01(lineAccum * 0.95f);
                    // G: 샤프한 다이아몬드 별 코어 (트윙클 대상)
                    float gVal = Mathf.Clamp01(starCoreAccum * 1.2f);
                    // B: 은하수 성운 띠 + 미세 별가루 (별자리 주변 제외 적용)
                    float bVal = Mathf.Clamp01(totalStardust);
                    // A: 종합 알파 (원형 마스킹 적용)
                    float circleFalloff = Mathf.SmoothStep(0.85f, 0.70f, rDist);
                    float totalAlpha = Mathf.Clamp01(rVal + gVal * 1.3f + bVal * 0.75f) * circleFalloff;

                    pixels[rowIdx + x] = new Color32(
                        (byte)Mathf.Clamp(Mathf.RoundToInt(rVal * 255f), 0, 255),
                        (byte)Mathf.Clamp(Mathf.RoundToInt(gVal * 255f), 0, 255),
                        (byte)Mathf.Clamp(Mathf.RoundToInt(bVal * 255f), 0, 255),
                        (byte)Mathf.Clamp(Mathf.RoundToInt(totalAlpha * 255f), 0, 255)
                    );
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply(false, true);
            return tex;
        }

        private static float DistanceToSegment(Vector2 p, Vector2 a, Vector2 b)
        {
            Vector2 ab = b - a;
            float l2 = ab.sqrMagnitude;
            if (l2 < 1e-6f) return (p - a).magnitude;

            float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / l2);
            Vector2 projection = a + t * ab;
            return (p - projection).magnitude;
        }
    }
}
