import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PresetBaker } from './src/presetBaker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unityPresetsDir = path.resolve(__dirname, '../Assets/StreamingAssets/WebSource/presets');
const studioPresetsDir = path.resolve(__dirname, 'public/presets');

// 디렉토리 확인 및 생성
if (!fs.existsSync(unityPresetsDir)) fs.mkdirSync(unityPresetsDir, { recursive: true });
if (!fs.existsSync(studioPresetsDir)) fs.mkdirSync(studioPresetsDir, { recursive: true });

const baker = new PresetBaker();

const scenarios = [
  // 1. 일반 주사위 1~6개 (각 20개씩)
  { file: 'dice_presets_normal_1.json', mode: 'normal', diceCount: 1, octaCount: 0, label: '일반 주사위 1개' },
  { file: 'dice_presets_normal_2.json', mode: 'normal', diceCount: 2, octaCount: 0, label: '일반 주사위 2개' },
  { file: 'dice_presets_normal_3.json', mode: 'normal', diceCount: 3, octaCount: 0, label: '일반 주사위 3개' },
  { file: 'dice_presets_normal_4.json', mode: 'normal', diceCount: 4, octaCount: 0, label: '일반 주사위 4개' },
  { file: 'dice_presets_normal_5.json', mode: 'normal', diceCount: 5, octaCount: 0, label: '일반 주사위 5개' },
  { file: 'dice_presets_normal_6.json', mode: 'normal', diceCount: 6, octaCount: 0, label: '일반 주사위 6개 (확장)' },

  // 2. 판 뒤집기 (Flip) 1~5개 (각 20개씩)
  { file: 'dice_presets_flip_1.json', mode: 'flip', diceCount: 1, octaCount: 0, label: '판 뒤집기 1개' },
  { file: 'dice_presets_flip_2.json', mode: 'flip', diceCount: 2, octaCount: 0, label: '판 뒤집기 2개' },
  { file: 'dice_presets_flip_3.json', mode: 'flip', diceCount: 3, octaCount: 0, label: '판 뒤집기 3개' },
  { file: 'dice_presets_flip_4.json', mode: 'flip', diceCount: 4, octaCount: 0, label: '판 뒤집기 4개' },
  { file: 'dice_presets_flip_5.json', mode: 'flip', diceCount: 5, octaCount: 0, label: '판 뒤집기 5개' },

  // 3. 8면체 혼합 (D6 + D8, 총 1~6개)
  { file: 'dice_presets_mixed_0normal_1octa.json', mode: 'octahedron', diceCount: 1, octaCount: 1, label: '8면체 1개' },
  { file: 'dice_presets_mixed_0normal_2octa.json', mode: 'octahedron', diceCount: 2, octaCount: 2, label: '8면체 2개' },
  { file: 'dice_presets_mixed_1normal_1octa.json', mode: 'octahedron', diceCount: 2, octaCount: 1, label: '일반 1개 + 8면체 1개' },
  { file: 'dice_presets_mixed_1normal_2octa.json', mode: 'octahedron', diceCount: 3, octaCount: 2, label: '일반 1개 + 8면체 2개' },
  { file: 'dice_presets_mixed_2normal_1octa.json', mode: 'octahedron', diceCount: 3, octaCount: 1, label: '일반 2개 + 8면체 1개' },
  { file: 'dice_presets_mixed_2normal_2octa.json', mode: 'octahedron', diceCount: 4, octaCount: 2, label: '일반 2개 + 8면체 2개' },
  { file: 'dice_presets_mixed_3normal_1octa.json', mode: 'octahedron', diceCount: 4, octaCount: 1, label: '일반 3개 + 8면체 1개' },
  { file: 'dice_presets_mixed_3normal_2octa.json', mode: 'octahedron', diceCount: 5, octaCount: 2, label: '일반 3개 + 8면체 2개' },
  { file: 'dice_presets_mixed_4normal_2octa.json', mode: 'octahedron', diceCount: 6, octaCount: 2, label: '일반 4개 + 8면체 2개 (6개 확장)' }
];

console.log('================================================================');
console.log('🎲 프리셋 50개 배치 베이킹 & 품질 필터링 & Unity 동기화 시작');
console.log('================================================================');

const indexData = [];

for (const sc of scenarios) {
  console.log(`\n[시나리오] ${sc.label} (${sc.file}) 50개 시뮬레이션 중...`);
  
  // 50개 배치 베이킹 수행
  const { validResults, allCount, validCount } = await baker.bakeBatch(
    sc.mode,
    sc.diceCount,
    sc.octaCount,
    50
  );

  console.log(`  -> 50개 중 유효 통과: ${validCount}개`);

  // 만약 50개 중 통과된 개수가 20개 미만이면 추가 반복하여 20개 보장
  while (validResults.length < 20) {
    const more = await baker.bakeBatch(sc.mode, sc.diceCount, sc.octaCount, 30);
    validResults.push(...more.validResults);
    validResults.sort((a, b) => b.score - a.score);
  }

  // 상위 20개 선별
  const top20 = validResults.slice(0, 20);
  console.log(`  -> 상위 20개 최고 품질 프리셋 선별 완료 (최고 Score: ${top20[0].score}, 최저: ${top20[19].score})`);

  const jsonContent = JSON.stringify(top20, null, 2);

  // 1. Studio public/presets에 저장
  fs.writeFileSync(path.join(studioPresetsDir, sc.file), jsonContent, 'utf-8');

  // 2. Unity Assets/StreamingAssets/WebSource/presets에 저장
  fs.writeFileSync(path.join(unityPresetsDir, sc.file), jsonContent, 'utf-8');

  indexData.push({
    file: sc.file,
    label: sc.label,
    diceCount: sc.diceCount,
    octaCount: sc.octaCount,
    mode: sc.mode,
    clipCount: top20.length
  });
}

// index.json 업데이트
const indexJson = JSON.stringify(indexData, null, 2);
fs.writeFileSync(path.join(studioPresetsDir, 'index.json'), indexJson, 'utf-8');
fs.writeFileSync(path.join(unityPresetsDir, 'index.json'), indexJson, 'utf-8');

console.log('\n================================================================');
console.log('✨ 모든 시나리오 프리셋 20개씩 베이킹 및 Unity 동기화 완료!');
console.log('================================================================');
