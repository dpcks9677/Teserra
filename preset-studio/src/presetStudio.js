import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { YachtTrayModel } from './YachtTrayModel.js';
import { getSmoothBeveledOctGeo } from './geometryUtils.js';
import { getMaterialForDie } from './diceMaterials.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PresetBaker } from './presetBaker.js';

const viewerContainer = document.getElementById('viewer-container');

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0a10');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
RectAreaLightUniformsLib.init();
renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
viewerContainer.appendChild(renderer.domElement);

// 카메라 설정 (Unity와 정합성 있는 fov 10, y=120)
const camera = new THREE.PerspectiveCamera(10, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 250);
camera.position.set(0, 120, 0);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 조명 설정 (Warm Golden Amber Key + Cool Midnight Indigo Rim 보색 대비)
const hemisphereLight = new THREE.HemisphereLight(0xffb066, 0x1a120e, 0.65);
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xff9e3b, 1.5);
dirLight.position.set(-2.5, 32, 2.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.normalBias = 0.005;
dirLight.shadow.bias = -0.0001;
dirLight.shadow.radius = 2.0;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x364b6e, 0.45);
fillLight.position.set(8, 16, 10);
fillLight.castShadow = false;
scene.add(fillLight);

// 3D 가로 원목 판자 테이블 생성 (4개 대형 판자 + 웜 허니 브라운/토피 월넛 톤)
const tableGroup = new THREE.Group();
tableGroup.name = '3D Wood Planks Table';
const plankCount = 4;
const plankHeight = 4.90;
const gap = 0.10;
const plankWidth = 38.0;
const plankThickness = 0.60;
const baseY = -1.45;
const totalHeight = 20.0;
const startZ = -totalHeight * 0.5 + plankHeight * 0.5;

const plankColors = [
  0x6e432a, 0x78492e, 0x633c25, 0x73452b
];

const uvOffsets = [
  { x: 0.00, y: 0.00 },
  { x: 0.40, y: 0.20 },
  { x: 0.80, y: 0.60 },
  { x: 0.20, y: 0.40 }
];

const textureLoader = new THREE.TextureLoader();
const baseUrl = import.meta.env.BASE_URL || '/';
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

textureLoader.load(`${normalizedBase}textures/wood/wood_grain_knots.png`, (woodTex) => {
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;

  for (let i = 0; i < plankCount; i++) {
    const z = startZ + i * (plankHeight + gap);
    const yOffset = i % 2 === 0 ? 0.008 : -0.008;
    const plankGeo = new THREE.BoxGeometry(plankWidth, plankThickness, plankHeight);

    const plankTex = woodTex.clone();
    plankTex.repeat.set(1.5, 1.0);
    plankTex.offset.set(uvOffsets[i].x, uvOffsets[i].y);
    plankTex.needsUpdate = true;

    const plankMat = new THREE.MeshStandardMaterial({
      map: plankTex,
      color: plankColors[i % plankColors.length],
      roughness: 0.82,
      metalness: 0.0
    });
    const plankMesh = new THREE.Mesh(plankGeo, plankMat);
    plankMesh.position.set(0, baseY + yOffset, z);
    plankMesh.receiveShadow = true;
    tableGroup.add(plankMesh);
  }
});

// 테이블 하단 판자 틈새 섀도우 언더레이어 (틈새로 배경이 비치지 않고 자연스러운 음영 연출)
const underlayGeo = new THREE.BoxGeometry(plankWidth, 0.20, totalHeight + 1.0);
const underlayMat = new THREE.MeshStandardMaterial({
  color: 0x140f0c,
  roughness: 0.95,
  metalness: 0.0
});
const underlayMesh = new THREE.Mesh(underlayGeo, underlayMat);
underlayMesh.position.set(0, baseY - 0.25, 0);
underlayMesh.receiveShadow = true;
tableGroup.add(underlayMesh);

scene.add(tableGroup);

// 3D 딥 크림슨 패브릭 러너 + 앤틱 골드 트림 생성 (로우폴리 스타일라이즈드 솔리드 머티리얼)
const runnerGroup = new THREE.Group();
runnerGroup.name = '3D Fabric Runner';
runnerGroup.position.set(0, -1.13, 0.4);
runnerGroup.rotation.y = THREE.MathUtils.degToRad(4.5);

const feltGeo = new THREE.BoxGeometry(42.0, 0.040, 7.2);
const feltMat = new THREE.MeshStandardMaterial({
  color: 0x882d22,
  roughness: 0.82,
  metalness: 0.0
});
const feltMesh = new THREE.Mesh(feltGeo, feltMat);
feltMesh.castShadow = true;
feltMesh.receiveShadow = true;
runnerGroup.add(feltMesh);

const goldMat = new THREE.MeshStandardMaterial({
  color: 0xe5a93c,
  roughness: 0.28,
  metalness: 0.88
});

// 황금 띠를 러너 안쪽으로 인셋 (±2.75)
[-2.75, 2.75].forEach((trimZ) => {
  const trimGeo = new THREE.BoxGeometry(42.0, 0.044, 0.20);
  const trimMesh = new THREE.Mesh(trimGeo, goldMat);
  trimMesh.position.set(0, 0.004, trimZ);
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  runnerGroup.add(trimMesh);
});
scene.add(runnerGroup);

// 트레이 모델 로드
const tray = new YachtTrayModel(scene, {
  onLoad: () => {
    tray.resize();
    console.log('Unity-synced Tray loaded successfully.');
    setCameraAngle(15);
  }
});
tray.load();

// 카메라 각도 조절 함수
function setCameraAngle(angle) {
  const clamped = THREE.MathUtils.clamp(Number(angle) || 0, 0, 85);
  const distance = 120;
  const radians = THREE.MathUtils.degToRad(clamped);
  camera.position.set(0, distance * Math.cos(radians), distance * Math.sin(radians));
  controls.target.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  controls.update();
  const angleEl = document.getElementById('camera-angle-value');
  const sliderEl = document.getElementById('camera-angle');
  if (angleEl) angleEl.textContent = `${Math.round(clamped)}°`;
  if (sliderEl) sliderEl.value = String(clamped);
}

// 주사위 3D 메쉬 풀 & 선택된 재질 상태
const octGeo = getSmoothBeveledOctGeo();
const boxGeo = new RoundedBoxGeometry(1.62, 1.62, 1.62, 4, 0.22);
let diceMeshes = [];
let currentSelectedMaterial = 'normal';

function setupDiceMeshes(count, octaCount = 0, dieType = currentSelectedMaterial) {
  diceMeshes.forEach(mesh => scene.remove(mesh));
  diceMeshes = [];

  const layout = tray.getLayout();
  for (let i = 0; i < count; i++) {
    const isOct = i >= Math.max(0, count - octaCount);
    const geometry = isOct ? octGeo : boxGeo;
    const mesh = new THREE.Mesh(geometry, getMaterialForDie({ type: isOct ? 'octahedron' : dieType }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set((i - (count - 1) / 2) * 1.5, layout.playSurfaceY + (isOct ? 1.125 : 0.81), 0);
    scene.add(mesh);
    diceMeshes.push(mesh);
  }
}

// 사운드 풀
const soundCache = {};
function playSound(type) {
  const soundFile = type === 'roll' ? '/sounds/dice_roll.mp3' : '/sounds/dice-throw-1.ogg';
  if (!soundCache[soundFile]) {
    soundCache[soundFile] = new Audio(soundFile);
  }
  const audio = soundCache[soundFile].cloneNode();
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

// 상태 변수 (2단 분리: 신규 생성 후보군 vs 채택 보존 목록)
const baker = new PresetBaker();
let keptPresets = [];             // 채택 보존된 프리셋 목록 (하단)
let newCandidates = [];           // 이번에 새로 생성된 후보군 목록 (상단)
let currentLoadedFileName = null; // 현재 불러온 시나리오 파일명 (덮어쓰기 타겟)
let selectedPreset = null;        // 현재 선택된 프리셋
let currentPlaybackPreset = null; // 현재 3D 뷰어에서 재생 중인 프리셋
let currentPlaybackTime = 0;
let isPlaying = false;
let isLooping = true;
let playbackSpeed = 1.0;
let lastPlayedSoundIndex = -1;

// DOM 요소
const diceCountSelect = document.getElementById('dice-count');
const octaCountSelect = document.getElementById('octa-count');
const bakeModeSelect = document.getElementById('bake-mode');
const btnBakeBatch = document.getElementById('btn-bake-batch');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const bakeStatus = document.getElementById('bake-status');
const scenarioBadge = document.getElementById('current-scenario-badge');
const presetListEl = document.getElementById('preset-list');
const btnAutoKeep20 = document.getElementById('btn-auto-keep-20');
const btnClearKept = document.getElementById('btn-clear-kept');
const keptCountEl = document.getElementById('kept-count');
const btnPlayCurrent = document.getElementById('btn-play-current');
const btnExportJson = document.getElementById('btn-export-json');
const btnSyncUnity = document.getElementById('btn-sync-unity');
const savedPresetSelect = document.getElementById('saved-preset-file');
const btnLoadSavedPreset = document.getElementById('btn-load-saved-preset');

// 재생 오버레이 버튼
const btnOverlayPlay = document.getElementById('btn-overlay-play');
const btnOverlayPause = document.getElementById('btn-overlay-pause');
const btnOverlayLoop = document.getElementById('btn-overlay-loop');
const btnOverlaySpeed = document.getElementById('btn-overlay-speed');

// 50개 배치 자동 베이킹 & 20개 미만 시 자동 반복 보충 함수
async function handleBatchBake() {
  btnBakeBatch.disabled = true;
  progressContainer.style.display = 'block';
  progressFill.style.width = '0%';
  
  const count = parseInt(diceCountSelect.value, 10);
  const octa = parseInt(octaCountSelect.value, 10);
  const mode = bakeModeSelect.value;
  
  const startTime = performance.now();
  let totalSimulated = 0;
  let totalValidGenerated = 0;
  let batchIndex = 0;
  const maxBatches = 10;
  
  // 이번 베이킹을 위한 신규 후보군 초기화
  newCandidates = [];

  while ((keptPresets.length + newCandidates.length) < 20 && batchIndex < maxBatches) {
    batchIndex++;
    const needed = 20 - (keptPresets.length + newCandidates.length);
    bakeStatus.textContent = `베이킹 실행 중 (배치 ${batchIndex}/${maxBatches}) | 필요: ${needed}개 더 수집 중...`;

    const { validResults, allCount, validCount } = await baker.bakeBatch(
      mode, count, octa, 50,
      (current, total, valid) => {
        const globalCurrent = (batchIndex - 1) * 50 + current;
        const globalTarget = Math.max(50, batchIndex * 50);
        const pct = Math.min(100, (globalCurrent / globalTarget) * 100);
        progressFill.style.width = `${pct}%`;
        bakeStatus.textContent = `시뮬레이션 [배치 ${batchIndex}] (${current}/50) | 이번 배치 합격: ${valid}개 (누적: ${totalValidGenerated + valid}개)`;
      }
    );

    totalSimulated += allCount;
    totalValidGenerated += validCount;
    newCandidates.push(...validResults);

    // 20개를 채웠으면 루프 조기 종료
    if (keptPresets.length + newCandidates.length >= 20) {
      break;
    }
  }

  // 신규 후보군 점수 기준 내림차순 정렬
  newCandidates.sort((a, b) => b.score - a.score);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  bakeStatus.textContent = `베이킹 완료! (총 ${totalSimulated}개 시뮬레이션 중 ${totalValidGenerated}개 통과, ${elapsed}s)`;

  // 기존에 채택된 프리셋이 전혀 없었던 상태라면 상위 필요한 만큼 자동 채택
  if (keptPresets.length === 0 && newCandidates.length > 0) {
    const autoKeepCount = Math.min(20, newCandidates.length);
    keptPresets = newCandidates.splice(0, autoKeepCount);
  }

  renderPresetLists();
  if (keptPresets.length > 0) {
    selectAndPlayPreset(keptPresets[0]);
  } else if (newCandidates.length > 0) {
    selectAndPlayPreset(newCandidates[0]);
  }

  btnBakeBatch.disabled = false;
  setTimeout(() => { progressContainer.style.display = 'none'; }, 1200);
}

btnBakeBatch.onclick = handleBatchBake;

// 프리셋 리스트 2단 렌더링 (상단: 신규 생성 후보군 / 하단: 채택 보존 목록)
function renderPresetLists() {
  presetListEl.innerHTML = '';
  
  const totalCount = newCandidates.length + keptPresets.length;
  if (totalCount === 0) {
    presetListEl.innerHTML = '<div class="status-text" style="padding: 12px 0;">통과된 프리셋이 없습니다. 1번에서 베이킹을 실행하거나 3번에서 프리셋을 불러오세요.</div>';
    updateKeptCountUI();
    return;
  }

  // 1. 상단: 신규 생성 후보군 영역
  if (newCandidates.length > 0) {
    const newHeader = document.createElement('div');
    newHeader.className = 'preset-sub-header';
    newHeader.innerHTML = `<span>✨ 신규 생성 후보군 (${newCandidates.length}개)</span> <span style="color: #79b8ff; font-size: 0.70rem;">클릭 시 미리보기 / 채택 시 하단 보존</span>`;
    presetListEl.appendChild(newHeader);

    newCandidates.forEach((preset, index) => {
      const item = createPresetItemElement(preset, index, false);
      presetListEl.appendChild(item);
    });
  }

  // 2. 중앙 구분선 (채택 보존 목록 구분)
  const divider = document.createElement('div');
  divider.className = 'preset-divider';
  divider.innerHTML = `<span>📌 채택 보존된 프리셋</span> <span class="badge ${keptPresets.length >= 20 ? 'badge-success' : 'badge-gold'}">${keptPresets.length} / 20개</span>`;
  presetListEl.appendChild(divider);

  // 3. 하단: 채택 보존 목록 영역
  if (keptPresets.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'status-text';
    emptyNotice.style.padding = '6px 4px';
    emptyNotice.textContent = '현재 채택된 프리셋이 없습니다. 상단 후보군에서 [채택] 버튼을 누르세요.';
    presetListEl.appendChild(emptyNotice);
  } else {
    keptPresets.forEach((preset, index) => {
      const item = createPresetItemElement(preset, index, true);
      presetListEl.appendChild(item);
    });
  }

  updateKeptCountUI();
}

// 개별 프리셋 DOM 아이템 생성 헬퍼
function createPresetItemElement(preset, index, isKept) {
  const item = document.createElement('div');
  const isSelected = selectedPreset === preset;

  item.className = `preset-item ${isSelected ? 'selected' : ''} ${isKept ? 'is-kept' : 'is-new'}`;
  
  const info = document.createElement('div');
  info.className = 'preset-info';
  
  const title = document.createElement('div');
  title.className = 'preset-title';
  title.innerHTML = `<span>${isKept ? '★' : '•'} #${index + 1}</span> <span style="color: #ffd700;">Score: ${preset.score}</span>`;
  
  const meta = document.createElement('div');
  meta.className = 'preset-meta';
  meta.textContent = `안정화: ${preset.settleTime}s | 프레임: ${preset.frames.length}F (@${preset.fps || 20}fps)`;
  
  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'preset-actions';

  const actionBtn = document.createElement('button');
  if (isKept) {
    actionBtn.className = 'btn-mini-action btn-remove';
    actionBtn.textContent = '채택 해제';
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      unadoptPreset(index);
    };
  } else {
    actionBtn.className = 'btn-mini-action btn-adopt';
    actionBtn.textContent = '★ 채택';
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      adoptPreset(index);
    };
  }

  actions.appendChild(actionBtn);
  item.appendChild(info);
  item.appendChild(actions);

  item.onclick = () => selectAndPlayPreset(preset);
  return item;
}

// 상단 신규 후보 -> 하단 채택 목록으로 이동
function adoptPreset(candidateIndex) {
  if (candidateIndex < 0 || candidateIndex >= newCandidates.length) return;
  const [adopted] = newCandidates.splice(candidateIndex, 1);
  keptPresets.push(adopted);
  renderPresetLists();
}

// 하단 채택 목록 -> 상단 후보군으로 이동 (채택 해제)
function unadoptPreset(keptIndex) {
  if (keptIndex < 0 || keptIndex >= keptPresets.length) return;
  const [removed] = keptPresets.splice(keptIndex, 1);
  newCandidates.unshift(removed);
  renderPresetLists();
}

function updateKeptCountUI() {
  const count = keptPresets.length;
  keptCountEl.textContent = String(count);
  btnExportJson.disabled = count === 0;
  btnSyncUnity.disabled = count === 0;
}

// 상위 20개 일괄 자동 채택
btnAutoKeep20.onclick = () => {
  const all = [...keptPresets, ...newCandidates];
  all.sort((a, b) => b.score - a.score);
  keptPresets = all.slice(0, 20);
  newCandidates = all.slice(20);
  renderPresetLists();
};

// 채택 전체 해제
btnClearKept.onclick = () => {
  newCandidates = [...keptPresets, ...newCandidates];
  keptPresets = [];
  renderPresetLists();
};

// 프리셋 선택 및 재생
function selectAndPlayPreset(preset) {
  if (!preset) return;
  selectedPreset = preset;
  renderPresetLists();
  playPreset(preset);
  btnPlayCurrent.disabled = false;
}

// 3D 애니메이션 재생
function playPreset(preset) {
  currentPlaybackPreset = preset;
  currentPlaybackTime = 0;
  isPlaying = true;
  lastPlayedSoundIndex = -1;

  setupDiceMeshes(preset.diceCount, preset.octaCount);
}

btnPlayCurrent.onclick = () => {
  if (selectedPreset) playPreset(selectedPreset);
};

// 재생 오버레이 바인딩
btnOverlayPlay.onclick = () => { isPlaying = true; };
btnOverlayPause.onclick = () => { isPlaying = false; };
btnOverlayLoop.onclick = () => {
  isLooping = !isLooping;
  btnOverlayLoop.classList.toggle('active', isLooping);
  btnOverlayLoop.textContent = isLooping ? '🔁 루프 ON' : '🔁 루프 OFF';
};
btnOverlaySpeed.onclick = () => {
  if (playbackSpeed === 1.0) playbackSpeed = 0.5;
  else if (playbackSpeed === 0.5) playbackSpeed = 2.0;
  else playbackSpeed = 1.0;
  btnOverlaySpeed.textContent = `속도: ${playbackSpeed.toFixed(1)}x`;
};

// 카메라 툴 바인딩
document.getElementById('btn-camera-top').onclick = () => setCameraAngle(85);
document.getElementById('btn-camera-quarter').onclick = () => setCameraAngle(35);
document.getElementById('btn-camera-reset').onclick = () => setCameraAngle(15);
document.getElementById('camera-angle').oninput = (e) => setCameraAngle(e.target.value);

// 3번 탭: 저장된 프리셋 카탈로그 로딩
async function loadSavedPresetCatalog() {
  try {
    const res = await fetch('/presets/index.json');
    if (!res.ok) return;
    const catalog = await res.json();
    savedPresetSelect.innerHTML = '<option value="">저장 프리셋 선택...</option>';
    catalog.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.file;
      opt.textContent = item.label || item.file;
      savedPresetSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn('Could not load preset index:', e);
  }
}
loadSavedPresetCatalog();

// 3번 탭: 저장된 프리셋 불러오기 -> 2번 탭 채택 목록 연동 & 1번 설정값 자동 전환
btnLoadSavedPreset.onclick = async () => {
  const file = savedPresetSelect.value;
  if (!file) return;
  btnLoadSavedPreset.disabled = true;
  try {
    const res = await fetch(`/presets/${file}`);
    const data = await res.json();
    
    currentLoadedFileName = file;
    if (scenarioBadge) {
      scenarioBadge.textContent = file;
      scenarioBadge.className = 'badge badge-gold';
    }

    // 파일에서 불러온 프리셋들을 하단 '채택 보존 목록'으로 등록
    keptPresets = data.map((p) => ({
      mode: p.mode || 'normal',
      diceCount: p.diceCount || p.frames[0].length,
      octaCount: p.octaCount || 0,
      score: Number((p.score || 80).toFixed(1)),
      settleTime: 1.8,
      isValid: true,
      frames: p.frames,
      fps: p.fps || 20,
      soundEvents: p.soundEvents || []
    }));
    newCandidates = [];

    // 1번 설정값 자동 동기화
    if (keptPresets.length > 0) {
      const first = keptPresets[0];
      diceCountSelect.value = String(first.diceCount);
      octaCountSelect.value = String(first.octaCount);
      bakeModeSelect.value = first.mode;
    }

    renderPresetLists();
    if (keptPresets.length > 0) selectAndPlayPreset(keptPresets[0]);
    alert(`[로드 완료] ${file} 파일에서 ${keptPresets.length}개의 프리셋을 불러와 채택 목록에 등록했습니다.`);
  } catch (e) {
    alert('프리셋 로드 실패: ' + e.message);
  } finally {
    btnLoadSavedPreset.disabled = false;
  }
};

// 확정된 채택 프리셋 JSON 다운로드 (불러온 시나리오 파일명으로 정확한 덮어쓰기 저장)
btnExportJson.onclick = () => {
  if (keptPresets.length === 0) return;
  const jsonContent = JSON.stringify(keptPresets, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  const dCount = diceCountSelect.value;
  const mode = bakeModeSelect.value;
  const octa = octaCountSelect.value;
  
  // 현재 불러와진 파일명이 있으면 해당 파일명으로 덮어쓰기, 없으면 규격 파일명 생성
  let exportFileName = currentLoadedFileName;
  if (!exportFileName) {
    if (mode === 'octahedron' || parseInt(octa, 10) > 0) {
      const normalCount = Math.max(0, parseInt(dCount, 10) - parseInt(octa, 10));
      exportFileName = `dice_presets_mixed_${normalCount}normal_${octa}octa.json`;
    } else {
      exportFileName = `dice_presets_${mode}_${dCount}.json`;
    }
  }

  a.href = url;
  a.download = exportFileName;
  a.click();
  URL.revokeObjectURL(url);
};

// Unity StreamingAssets로 내보내기 클립보드 복사 및 저장 안내
btnSyncUnity.onclick = async () => {
  if (keptPresets.length === 0) return;
  const jsonContent = JSON.stringify(keptPresets, null, 2);
  
  try {
    await navigator.clipboard.writeText(jsonContent);
    const fileName = currentLoadedFileName || `dice_presets_${bakeModeSelect.value}_${diceCountSelect.value}.json`;
    alert(`[완료] 확정된 ${keptPresets.length}개의 프리셋 JSON이 클립보드에 복사되었습니다!\n파일명: ${fileName}\nUnity 프로젝트의 Assets/StreamingAssets/WebSource/presets 폴더에 덮어쓸 수 있습니다.`);
  } catch (e) {
    btnExportJson.click();
  }
};

// 주사위 모델/재질 버튼 목록 구성 (8가지 전체 지원)
const modelDefs = [
  { id: 'normal', name: '일반(White)' },
  { id: 'metal', name: '메탈(Metal)' },
  { id: 'golden', name: '골드(Gold)' },
  { id: 'sevens', name: '세븐스(Cyan)' },
  { id: 'couple', name: '커플(Pink)' },
  { id: 'heavy', name: '헤비(Red)' },
  { id: 'promotion', name: '프로모션' },
  { id: 'weird', name: '위어드(Purple)' }
];

const modelListContainer = document.getElementById('model-list');
modelDefs.forEach(def => {
  const btn = document.createElement('button');
  btn.textContent = def.name;
  btn.id = `btn-mat-${def.id}`;
  btn.style.fontSize = '0.74rem';
  btn.style.padding = '4px 8px';
  btn.style.margin = '2px';
  if (def.id === currentSelectedMaterial) btn.classList.add('active');

  btn.onclick = () => {
    currentSelectedMaterial = def.id;
    document.getElementById('model-status').textContent = `${def.name} 재질 적용됨`;
    
    modelListContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 현재 선택된 프리셋 또는 기본 주사위 메쉬 재질 즉시 갱신
    const p = selectedPreset || (keptPresets.length > 0 ? keptPresets[0] : (newCandidates.length > 0 ? newCandidates[0] : null));
    const dCount = p ? p.diceCount : parseInt(diceCountSelect.value, 10);
    const oCount = p ? p.octaCount : parseInt(octaCountSelect.value, 10);
    setupDiceMeshes(dCount, oCount, currentSelectedMaterial);
  };
  modelListContainer.appendChild(btn);
});

// 메인 렌더 루프
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (isPlaying && currentPlaybackPreset && currentPlaybackPreset.frames.length > 0) {
    currentPlaybackTime += delta * playbackSpeed;
    const fps = currentPlaybackPreset.fps || 20;
    const totalFrames = currentPlaybackPreset.frames.length;
    const duration = totalFrames / fps;

    // 사운드 트리거
    if (currentPlaybackPreset.soundEvents) {
      currentPlaybackPreset.soundEvents.forEach((ev, sIdx) => {
        if (sIdx > lastPlayedSoundIndex && currentPlaybackTime >= ev.time) {
          playSound(ev.type);
          lastPlayedSoundIndex = sIdx;
        }
      });
    }

    if (currentPlaybackTime >= duration) {
      if (isLooping) {
        currentPlaybackTime = 0;
        lastPlayedSoundIndex = -1;
      } else {
        currentPlaybackTime = duration;
        isPlaying = false;
      }
    }

    const framePos = THREE.MathUtils.clamp(currentPlaybackTime * fps, 0, totalFrames - 1.001);
    const frameIndex = Math.floor(framePos);
    const nextIndex = Math.min(frameIndex + 1, totalFrames - 1);
    const blend = framePos - frameIndex;

    const currentFrame = currentPlaybackPreset.frames[frameIndex];
    const nextFrame = currentPlaybackPreset.frames[nextIndex];

    for (let i = 0; i < diceMeshes.length; i++) {
      if (i < currentFrame.length && i < nextFrame.length) {
        const curDie = currentFrame[i];
        const nxtDie = nextFrame[i];

        const curPos = new THREE.Vector3(curDie[0], curDie[1], curDie[2]);
        const nxtPos = new THREE.Vector3(nxtDie[0], nxtDie[1], nxtDie[2]);
        diceMeshes[i].position.lerpVectors(curPos, nxtPos, blend);

        const curRot = new THREE.Quaternion(curDie[3], curDie[4], curDie[5], curDie[6]);
        const nxtRot = new THREE.Quaternion(nxtDie[3], nxtDie[4], nxtDie[5], nxtDie[6]);
        diceMeshes[i].quaternion.slerpQuaternions(curRot, nxtRot, blend);
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (!viewerContainer) return;
  camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
});

animate();
