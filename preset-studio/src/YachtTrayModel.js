import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const SOURCE_SIZE = 155;
const SOURCE_CENTER = { x: 125, y: 110 };
const SOURCE_PLAY_SURFACE_Z = 14;
const FALLBACK_PLAY_SURFACE_Y = -10.283531188964844;
const FALLBACK_KEEP_SURFACE_Y = 13;
const FALLBACK_OUTER_BOUNDS = { minX: -77.5, maxX: 77.5, minZ: -77.5, maxZ: 77.5 };
const SOURCE_LAUNCH_PADDING = 30;

// 트레이 메쉬(155) 대비 내부 플레이 영역 (원본 STL 좌표계 기준)
// Unity의 0.05 스케일 및 주사위 0.78 규격에 1:1 완벽 대응
const PLAY_BOUNDS = { minX: -52, maxX: 52, minZ: -32, maxZ: 52 };
const COLLISION_FLOOR = { minX: -49, maxX: 49, minZ: -29, maxZ: 49 };
const KEEP_LAYOUT = { startX: -44, spacing: 22, centerZ: -58 };

const REGION_EPSILON = 0.01;
const FLOOR_NORMAL_THRESHOLD = 0.7;
const CORDUROY_UV_SCALE = 1 / 65;
const MATERIAL_INDEX = { rim: 0, floor: 1, plastic: 2, stair: 3 };
const CORDUROY_TEXTURES = {
  color: 'corduroy-color.webp',
  normal: 'corduroy-normal-gl.webp',
  roughness: 'corduroy-roughness.webp'
};
const PLASTIC_TEXTURES = {
  color: 'soft-plastic-albedo.jpg',
  normal: 'soft-plastic-normal.jpg',
  roughness: 'soft-plastic-roughness.jpg'
};

const TRAY_COLORS = {
  felt: new THREE.Color(0x6a1a2f),
  keep: new THREE.Color(0x7b2945),
  rim: new THREE.Color(0x282828)
};

// Unity 규격: DieSize=0.78, TrayScale=0.05 -> 비율 = 0.78 / (155 * 0.05) = 0.100645
// 스튜디오 규격: DIE_SIZE=1.62 -> TRAY_SCALE = 1.62 / (0.78 / 0.05) = 1.62 * 0.05 / 0.78 = 0.1038461538
export const UNITY_SYNCED_TRAY_SCALE = (1.62 * 0.05) / 0.78; // ~0.10384615

function getAssetUrl() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}models/yacht-tray.stl`;
}

function getTextureUrl(filename) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}textures/tray/${filename}`;
}

function createBurgundyCorduroyTextureSet() {
  const width = 1024;
  const height = 1024;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d');

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = normalCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d');

  const colorImg = colorCtx.createImageData(width, height);
  const normalImg = normalCtx.createImageData(width, height);
  const roughImg = roughCtx.createImageData(width, height);

  const numRibs = 32; // 가로 방향 32개의 굵고 선명한 코듀로이 골

  // 다중 옥타브 유사 노이즈 (테이블 옹이/원목 느낌의 유기적인 버건디 색조 변주)
  function pseudoNoise(nx, ny) {
    const s1 = Math.sin(nx * 3.7 + ny * 2.1) * Math.cos(nx * 1.9 - ny * 3.4);
    const s2 = Math.sin(nx * 8.3 - ny * 6.5) * 0.5;
    const s3 = Math.cos(nx * 15.1 + ny * 12.3) * 0.25;
    return (s1 + s2 + s3) / 1.75;
  }

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const phase = v * numRibs * 2 * Math.PI;
    const sinVal = Math.sin(phase); // -1 (groove) ~ +1 (ridge)
    const cosVal = Math.cos(phase); // derivative for normal slope

    // 부드러운 알약형 코듀로이 리브 프로파일
    const ridgeProfile = Math.sign(sinVal) * Math.pow(Math.abs(sinVal), 0.68);
    const tRidge = (ridgeProfile + 1) * 0.5; // 0 (골) ~ 1 (이랑 정점)

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const pixelIndex = (y * width + x) * 4;

      // 유기적 톤 변화 (옹이 & 염색 결 풀링)
      const organicWave = pseudoNoise(u * 4.2, v * 3.2); // -1 ~ 1
      const microWeave = ((Math.sin(x * 0.75) + Math.cos(y * 0.75)) * 0.5) * 0.05;
      const toneBlend = 0.5 + 0.5 * organicWave; // 0 ~ 1

      // 1. Color (Albedo + Deep Groove Shadows + Organic Burgundy Tone Nuances)
      // 골 부분: 짙은 딥 섀도우 버건디 (#2f060f)
      // 이랑 부분: 벨벳 웜 버건디 (#7a1d33 ~ #962844)
      const r = Math.min(255, Math.max(0, Math.round(
        46 + 72 * tRidge + 32 * toneBlend + microWeave * 50
      )));
      const g = Math.min(255, Math.max(0, Math.round(
        6 + 22 * tRidge + 16 * toneBlend + microWeave * 30
      )));
      const b = Math.min(255, Math.max(0, Math.round(
        14 + 34 * tRidge + 20 * toneBlend + microWeave * 30
      )));

      colorImg.data[pixelIndex] = r;
      colorImg.data[pixelIndex + 1] = g;
      colorImg.data[pixelIndex + 2] = b;
      colorImg.data[pixelIndex + 3] = 255;

      // 2. Normal Map (가로 골에 의한 강력한 접선 법선 Y축 기울기 + 미세 패브릭 결)
      const normalSlopeY = -cosVal * 0.72 + (pseudoNoise(u * 12.0, v * 8.0) * 0.08);
      const normalSlopeX = (Math.cos(x * 0.75) * 0.04) + (pseudoNoise(u * 8.0, v * 12.0) * 0.05);

      const nx = Math.min(255, Math.max(0, Math.round(128 + normalSlopeX * 120)));
      const ny = Math.min(255, Math.max(0, Math.round(128 + normalSlopeY * 120)));
      const nz = 255;

      normalImg.data[pixelIndex] = nx;
      normalImg.data[pixelIndex + 1] = ny;
      normalImg.data[pixelIndex + 2] = nz;
      normalImg.data[pixelIndex + 3] = 255;

      // 3. Roughness Map (골은 매트한 0.94, 이랑은 벨벳 광택의 0.74)
      const roughVal = Math.min(255, Math.max(0, Math.round(238 - 48 * tRidge - 18 * toneBlend)));
      roughImg.data[pixelIndex] = roughVal;
      roughImg.data[pixelIndex + 1] = roughVal;
      roughImg.data[pixelIndex + 2] = roughVal;
      roughImg.data[pixelIndex + 3] = 255;
    }
  }

  colorCtx.putImageData(colorImg, 0, 0);
  normalCtx.putImageData(normalImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.colorSpace = THREE.SRGBColorSpace;

  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;

  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  roughTexture.wrapS = THREE.RepeatWrapping;
  roughTexture.wrapT = THREE.RepeatWrapping;

  return {
    textures: [colorTexture, normalTexture, roughTexture],
    maps: { color: colorTexture, normal: normalTexture, roughness: roughTexture }
  };
}

async function loadTextureSet(loader, filenames) {
  const results = await Promise.allSettled(Object.values(filenames).map(filename => loader.loadAsync(getTextureUrl(filename))));
  const textures = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (results.some(result => result.status === 'rejected')) {
    textures.forEach(texture => texture.dispose());
    return null;
  }
  textures.forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  });
  textures[0].colorSpace = THREE.SRGBColorSpace;
  return { textures, maps: { color: textures[0], normal: textures[1], roughness: textures[2] } };
}

function getTrayRegion(x, y, z) {
  const isPlayRegion = x >= PLAY_BOUNDS.minX - REGION_EPSILON
    && x <= PLAY_BOUNDS.maxX + REGION_EPSILON
    && z >= PLAY_BOUNDS.minZ - REGION_EPSILON
    && z <= PLAY_BOUNDS.maxZ + REGION_EPSILON
    && y <= 3 + REGION_EPSILON;
  if (isPlayRegion) return 'play';

  const isKeepRegion = Math.abs(x) <= 55 + REGION_EPSILON
    && z < PLAY_BOUNDS.minZ + REGION_EPSILON
    && z >= -65 - REGION_EPSILON
    && y <= 13 + REGION_EPSILON;
  return isKeepRegion ? 'keep' : 'rim';
}

function getTriangleMaterialIndex(positions, normals, start) {
  const average = getter => (getter(start) + getter(start + 1) + getter(start + 2)) / 3;
  const region = getTrayRegion(
    average(index => positions.getX(index)),
    average(index => positions.getY(index)),
    average(index => positions.getZ(index))
  );
  if (region === 'keep') return MATERIAL_INDEX.stair;
  if (region !== 'play') return MATERIAL_INDEX.rim;
  const normalY = average(index => normals.getY(index));
  return Math.abs(normalY) >= FLOOR_NORMAL_THRESHOLD ? MATERIAL_INDEX.floor : MATERIAL_INDEX.rim;
}

function getProjectedUv(positions, normals, index, materialIndex) {
  const x = positions.getX(index);
  const y = positions.getY(index);
  const z = positions.getZ(index);
  if (materialIndex === MATERIAL_INDEX.floor) return [x * CORDUROY_UV_SCALE, z * CORDUROY_UV_SCALE];
  if (Math.abs(normals.getY(index)) >= FLOOR_NORMAL_THRESHOLD) return [x * CORDUROY_UV_SCALE, z * CORDUROY_UV_SCALE];
  return [
    (Math.abs(normals.getX(index)) > Math.abs(normals.getZ(index)) ? z : x) * CORDUROY_UV_SCALE,
    y * CORDUROY_UV_SCALE
  ];
}

export function prepareCorduroyGeometry(geometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const triangles = [[], [], [], []];

  for (let start = 0; start < positions.count; start += 3) {
    triangles[getTriangleMaterialIndex(positions, normals, start)].push(start);
  }

  const vertexOrder = triangles.flatMap(starts => starts.flatMap(start => [start, start + 1, start + 2]));
  for (const [name, source] of Object.entries(geometry.attributes)) {
    const values = new source.array.constructor(source.array.length);
    vertexOrder.forEach((sourceIndex, targetIndex) => {
      for (let component = 0; component < source.itemSize; component++) {
        values[targetIndex * source.itemSize + component] = source.array[sourceIndex * source.itemSize + component];
      }
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, source.itemSize, source.normalized));
  }

  const uv = new Float32Array(positions.count * 2);
  let targetIndex = 0;
  triangles.forEach((starts, materialIndex) => {
    starts.forEach(start => {
      for (let offset = 0; offset < 3; offset++, targetIndex++) {
        const [u, v] = getProjectedUv(positions, normals, start + offset, materialIndex);
        uv[targetIndex * 2] = u;
        uv[targetIndex * 2 + 1] = v;
      }
    });
  });
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  let groupStart = 0;
  const groups = triangles.map((starts, materialIndex) => {
    const group = { start: groupStart, count: starts.length * 3, materialIndex };
    groupStart += group.count;
    return group;
  });
  geometry.clearGroups();
  geometry.addGroup(0, positions.count, MATERIAL_INDEX.rim);
  geometry.userData.corduroyGroups = groups;
  return groups;
}

export class YachtTrayModel {
  constructor(scene, { onLoad, onError } = {}) {
    this.scene = scene;
    this.onLoad = onLoad;
    this.onError = onError;
    this.mesh = null;
    this.isReady = false;
    this.loadPromise = null;
    this.textures = [];
    this.isDisposed = false;
    this.corduroyMaterials = null;
    this.corduroyEnabled = true;
    this.plasticEnabled = true;
  }

  load() {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise(resolve => {
      new STLLoader().load(
        getAssetUrl(),
        async geometry => {
          await this.createMesh(geometry);
          resolve(true);
        },
        undefined,
        error => {
          this.onError?.(error);
          resolve(false);
        }
      );
    });
    return this.loadPromise;
  }

  async createMesh(geometry) {
    geometry.translate(-SOURCE_CENTER.x, -SOURCE_CENTER.y, -SOURCE_PLAY_SURFACE_Z);
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.applyVertexColors(geometry);
    prepareCorduroyGeometry(geometry);

    this.mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.03
    }));
    this.mesh.name = 'yacht-tray';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.updateMatrixWorld(true);
    this.measuredLayout = {
      playPoint: this.getSurfacePoint(0, 0),
      keepPoints: Array.from({ length: 5 }, (_, index) => {
        const x = KEEP_LAYOUT.startX + index * KEEP_LAYOUT.spacing;
        return this.getSurfacePoint(x, KEEP_LAYOUT.centerZ)
          ?? new THREE.Vector3(x, FALLBACK_KEEP_SURFACE_Y, KEEP_LAYOUT.centerZ);
      }),
      outerBounds: {
        minX: geometry.boundingBox.min.x,
        maxX: geometry.boundingBox.max.x,
        minZ: geometry.boundingBox.min.z,
        maxZ: geometry.boundingBox.max.z
      },
      collisionProfile: this.getCollisionProfile(),
      rimTopY: geometry.boundingBox.max.y
    };
    this.scene?.add(this.mesh);
    await this.loadCorduroyMaterials();
    this.isReady = true;
    this.onLoad?.();
  }

  applyVertexColors(geometry) {
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const region = getTrayRegion(x, y, z);
      const isPlayFloor = region === 'play' && Math.abs(normals.getY(index)) >= FLOOR_NORMAL_THRESHOLD;
      const color = isPlayFloor ? TRAY_COLORS.felt : TRAY_COLORS.rim;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  async loadCorduroyMaterials() {
    const loader = new THREE.TextureLoader();
    const corduroySet = createBurgundyCorduroyTextureSet();
    const plasticSet = await loadTextureSet(loader, PLASTIC_TEXTURES);

    if (this.isDisposed) {
      [corduroySet, plasticSet].filter(Boolean).forEach(set => set.textures.forEach(texture => texture.dispose()));
      return false;
    }

    this.textures = [corduroySet, plasticSet].filter(Boolean).flatMap(set => set.textures);
    const baseMaterial = this.mesh.material;
    const corduroyMaterial = corduroySet
      ? new THREE.MeshStandardMaterial({
        map: corduroySet.maps.color,
        normalMap: corduroySet.maps.normal,
        roughnessMap: corduroySet.maps.roughness,
        roughness: 0.88,
        metalness: 0.02,
        normalScale: new THREE.Vector2(0.85, 0.85)
      })
      : baseMaterial;
    const plasticMaterial = plasticSet
      ? new THREE.MeshStandardMaterial({
        color: 0x303030,
        map: plasticSet.maps.color,
        normalMap: plasticSet.maps.normal,
        roughnessMap: plasticSet.maps.roughness,
        roughness: 0.32,
        metalness: 0,
        normalScale: new THREE.Vector2(0.2, 0.2)
      })
      : baseMaterial;
    const stairMaterial = plasticSet
      ? new THREE.MeshStandardMaterial({
        color: 0x363636,
        map: plasticSet.maps.color,
        normalMap: plasticSet.maps.normal,
        roughnessMap: plasticSet.maps.roughness,
        roughness: 0.46,
        metalness: 0,
        normalScale: new THREE.Vector2(0.2, 0.2)
      })
      : baseMaterial;
    this.mesh.material = [
      baseMaterial,
      corduroyMaterial,
      plasticMaterial,
      stairMaterial
    ];
    this.corduroyMaterials = this.mesh.material;
    this.applyMaterialGroups();
    return true;
  }

  setCorduroyEnabled(enabled) {
    this.corduroyEnabled = Boolean(enabled);
    this.applyMaterialGroups();
  }

  setPlasticEnabled(enabled) {
    this.plasticEnabled = Boolean(enabled);
    this.applyMaterialGroups();
  }

  applyMaterialGroups() {
    if (!this.mesh) return;
    const groups = this.mesh.geometry.userData.corduroyGroups;
    if (!groups) return;
    this.mesh.geometry.clearGroups();
    if (!this.corduroyMaterials || (!this.corduroyEnabled && !this.plasticEnabled)) {
      this.mesh.geometry.addGroup(0, this.mesh.geometry.getAttribute('position').count, 0);
      return;
    }
    groups.forEach(group => this.mesh.geometry.addGroup(
      group.start,
      group.count,
      group.materialIndex === MATERIAL_INDEX.floor
      ? (this.corduroyEnabled ? MATERIAL_INDEX.floor : MATERIAL_INDEX.rim)
        : (this.plasticEnabled
          ? (group.materialIndex === MATERIAL_INDEX.stair ? MATERIAL_INDEX.stair : MATERIAL_INDEX.plastic)
          : MATERIAL_INDEX.rim)
    ));
  }

  dispose() {
    this.isDisposed = true;
    this.scene?.remove(this.mesh);
    this.mesh?.geometry.dispose();
    const materials = Array.isArray(this.mesh?.material) ? this.mesh.material : [this.mesh?.material];
    new Set(materials.filter(Boolean)).forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.textures = [];
    this.corduroyMaterials = null;
    this.mesh = null;
    this.isReady = false;
  }

  getSurfacePoint(x, z) {
    if (!this.mesh) return null;
    this.mesh.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 120, z), new THREE.Vector3(0, -1, 0), 0, 240);
    return raycaster.intersectObject(this.mesh, false)[0]?.point ?? null;
  }

  getCollisionProfile() {
    const floorY = this.getSurfacePoint(0, 0)?.y ?? FALLBACK_PLAY_SURFACE_Y;
    const surfaceY = (x, z, fallback = floorY) => this.getSurfacePoint(x, z)?.y ?? fallback;
    const leftRimY = surfaceY(-57, 0, 15);
    const rightRimY = surfaceY(57, 0, 15);
    const frontRimY = surfaceY(0, 56, 15);
    const keepBarrierY = surfaceY(0, -32, 13);

    return {
      bounds: { minX: -57, maxX: 57, minZ: -34, maxZ: 57 },
      floor: { minX: -49, maxX: 49, minZ: -29, maxZ: 49, y: floorY },
      ramps: [
        { axis: 'x', from: -49, to: -57, fromY: floorY, toY: leftRimY, min: -29, max: 49 },
        { axis: 'x', from: 49, to: 57, fromY: floorY, toY: rightRimY, min: -29, max: 49 },
        { axis: 'z', from: 49, to: 57, fromY: floorY, toY: frontRimY, min: -49, max: 49 },
        { axis: 'z', from: -29, to: -34, fromY: floorY, toY: keepBarrierY, min: -49, max: 49 } // 킵존 침범 차단 턱
      ],
      wallBottoms: { minX: leftRimY, maxX: rightRimY, minZ: keepBarrierY, maxZ: frontRimY }
    };
  }

  setKeepZoneGlow() {}
  update() {}

  resize() {
    if (!this.mesh) return;
    this.mesh.scale.setScalar(this.getScale());
    this.mesh.updateMatrixWorld();
  }

  getScale() {
    return UNITY_SYNCED_TRAY_SCALE;
  }

  getLayout() {
    const scale = this.getScale();
    const measuredPlayY = this.measuredLayout?.playPoint?.y ?? FALLBACK_PLAY_SURFACE_Y;
    const measuredKeepPoints = this.measuredLayout?.keepPoints ?? Array.from(
      { length: 5 },
      (_, index) => new THREE.Vector3(
        KEEP_LAYOUT.startX + index * KEEP_LAYOUT.spacing,
        FALLBACK_KEEP_SURFACE_Y,
        KEEP_LAYOUT.centerZ
      )
    );
    const outerBounds = this.measuredLayout?.outerBounds ?? FALLBACK_OUTER_BOUNDS;
    const playBounds = {
      minX: PLAY_BOUNDS.minX * scale,
      maxX: PLAY_BOUNDS.maxX * scale,
      minZ: PLAY_BOUNDS.minZ * scale,
      maxZ: PLAY_BOUNDS.maxZ * scale
    };
    const collisionProfile = this.measuredLayout?.collisionProfile ?? this.getCollisionProfile();
    const scaleValue = value => value * scale;
    const keepPoints = measuredKeepPoints.map(point => point.clone().multiplyScalar(scale));
    const playSurfaceY = measuredPlayY * scale;

    return {
      scale,
      playBounds,
      collisionProfile: {
        bounds: Object.fromEntries(Object.entries(collisionProfile.bounds).map(([key, value]) => [key, scaleValue(value)])),
        floor: Object.fromEntries(Object.entries(collisionProfile.floor).map(([key, value]) => [key, scaleValue(value)])),
        ramps: collisionProfile.ramps.map(ramp => Object.fromEntries(Object.entries(ramp).map(([key, value]) => [key, typeof value === 'number' ? scaleValue(value) : value]))),
        wallBottoms: Object.fromEntries(Object.entries(collisionProfile.wallBottoms).map(([key, value]) => [key, scaleValue(value)]))
      },
      outerBounds: {
        minX: outerBounds.minX * scale,
        maxX: outerBounds.maxX * scale,
        minZ: outerBounds.minZ * scale,
        maxZ: outerBounds.maxZ * scale
      },
      playSurfaceY,
      floorY: playSurfaceY,
      rimTopY: (this.measuredLayout?.rimTopY ?? 24) * scale,
      entryEdgeZ: playBounds.maxZ,
      launchOriginZ: (outerBounds.maxZ + SOURCE_LAUNCH_PADDING) * scale,
      activeCenterZ: (((PLAY_BOUNDS.minZ + PLAY_BOUNDS.maxZ) / 2) - 4) * scale,
      keepStartX: KEEP_LAYOUT.startX * scale,
      keepSpacing: KEEP_LAYOUT.spacing * scale,
      keepCenterZ: KEEP_LAYOUT.centerZ * scale,
      keepPoints,
      getKeepDieY: (supportHeight, slotIndex = 0) => {
        const keepSurfaceY = keepPoints[slotIndex]?.y ?? FALLBACK_KEEP_SURFACE_Y * scale;
        return keepSurfaceY + supportHeight + 0.025;
      }
    };
  }
}
