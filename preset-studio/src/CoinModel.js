import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const DEFAULTS = {
  radius: 1,
  thickness: 0.22,
  segments: 32
};

/** 주사위와 같은 단순한 스타일의 원기둥형 동전 지오메트리 */
export function createCoinGeometry(options = {}) {
  const radius = options.radius || DEFAULTS.radius;
  const thickness = options.thickness || DEFAULTS.thickness;
  const segments = options.segments || DEFAULTS.segments;
  return new THREE.CylinderGeometry(radius, radius, thickness, segments, 1, false);
}

/** 호환용 단순 색상 텍스처. 기본 모델은 평면 재질을 사용함. */
export function generateCoinTexture(side = 'heads', options = {}) {
  if (typeof document === 'undefined') return new THREE.Texture();
  const size = options.size || 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = side === 'heads' ? '#D4AF37' : '#A77B22';
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 복잡한 음각 대신 면별 평면 색상을 반환함. */
export function generateCoinBumpMap() {
  return new THREE.Texture();
}

export function createCoinMaterials() {
  const base = {
    metalness: 0.18,
    roughness: 0.38
  };
  return {
    headsMaterial: new THREE.MeshStandardMaterial({ ...base, color: 0xD4AF37 }),
    tailsMaterial: new THREE.MeshStandardMaterial({ ...base, color: 0xA77B22 }),
    sideMaterial: new THREE.MeshStandardMaterial({ ...base, color: 0x855F1D })
  };
}

export function createCoinMesh(options = {}) {
  const geometry = createCoinGeometry(options);
  const { headsMaterial, tailsMaterial, sideMaterial } = createCoinMaterials(options);

  // CylinderGeometry groups: 측면 0, 위쪽 1, 아래쪽 2
  const coinMesh = new THREE.Group();
  const body = new THREE.Mesh(geometry, [sideMaterial, headsMaterial, tailsMaterial]);
  body.castShadow = true;
  body.receiveShadow = true;
  coinMesh.add(body);

  const radius = options.radius || DEFAULTS.radius;
  const thickness = options.thickness || DEFAULTS.thickness;
  const faceY = thickness / 2 + 0.006;

  // 주사위의 모서리처럼 단순하고 읽기 쉬운 외곽 림
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.94, Math.max(0.035, radius * 0.045), 6, 32),
    new THREE.MeshStandardMaterial({ color: 0x8F681D, metalness: 0.16, roughness: 0.42 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = faceY;
  rim.castShadow = true;
  coinMesh.add(rim);

  const backRim = rim.clone();
  backRim.position.y = -faceY;
  coinMesh.add(backRim);

  const engravingMaterial = new THREE.MeshStandardMaterial({
    color: 0x684817,
    metalness: 0.05,
    roughness: 0.58,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  // 앞면: 럭키 세븐 SVG 경로를 얕은 음각 장식으로 사용함
  const luckySevenSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12C9.5 9 8.5 5.5 12 3.5C15.5 5.5 14.5 9 12 12C15 9.5 18.5 8.5 20.5 12C18.5 15.5 15 14.5 12 12C14.5 15 15.5 18.5 12 20.5C8.5 18.5 9.5 15 12 12C9 14.5 5.5 15.5 3.5 12C5.5 8.5 9 9.5 12 12Z"/></svg>`;
  if (typeof DOMParser !== 'undefined') {
    const svgData = new SVGLoader().parse(luckySevenSvg);
    const luckyShapes = svgData.paths.flatMap(path => path.toShapes());
    const luckyGeometry = new THREE.ShapeGeometry(luckyShapes);
    luckyGeometry.scale(radius * 0.045, radius * 0.045, 1);
    // SVG viewBox(0~24)의 중심을 동전 중심(0, 0)으로 이동함.
    const iconCenter = radius * 0.54;
    luckyGeometry.translate(-iconCenter, -iconCenter, 0);
    luckyGeometry.rotateX(-Math.PI / 2);
    const luckySeven = new THREE.Mesh(luckyGeometry, engravingMaterial);
    luckySeven.position.set(0, faceY, 0);
    luckySeven.castShadow = true;
    coinMesh.add(luckySeven);
  }

  // 뒷면: 좌상단 큰 원과 우하단 작은 원이 겹치는 음각 링
  const largeCircle = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.36, radius * 0.035, 6, 24), engravingMaterial);
  const smallCircle = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.22, radius * 0.03, 6, 24), engravingMaterial);
  [largeCircle, smallCircle].forEach(circle => {
    circle.rotation.x = Math.PI / 2;
    circle.position.y = -faceY;
    circle.castShadow = true;
    coinMesh.add(circle);
  });
  largeCircle.position.x = -radius * 0.12;
  largeCircle.position.z = -radius * 0.1;
  smallCircle.position.x = radius * 0.12;
  smallCircle.position.z = radius * 0.1;

  coinMesh.name = 'CoinMesh';
  return coinMesh;
}

export function getCoinSideFromQuaternion(quaternion) {
  const localUp = new THREE.Vector3(0, 1, 0);
  const worldUp = localUp.applyQuaternion(quaternion);
  return worldUp.y >= 0 ? 'heads' : 'tails';
}
