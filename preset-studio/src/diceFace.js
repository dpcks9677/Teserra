const OCT_NORMALS = [
  [1, 1, 1], [1, -1, 1], [1, -1, -1], [1, 1, -1],
  [-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1]
].map(([x, y, z]) => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
});

function inverseRotateWorldUp({ x = 0, y = 0, z = 0, w = 1 }) {
  return {
    x: 2 * (x * y + w * z),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (y * z - w * x)
  };
}

export function getPhysicalFace(quaternion, type = 'normal') {
  const up = inverseRotateWorldUp(quaternion);
  if (type === 'octahedron') {
    let face = 1;
    let best = -Infinity;
    OCT_NORMALS.forEach(([x, y, z], index) => {
      const dot = up.x * x + up.y * y + up.z * z;
      if (dot > best) {
        best = dot;
        face = index + 1;
      }
    });
    return face;
  }
  if (up.y > 0.5) return 1;
  if (up.z > 0.5) return 2;
  if (up.x > 0.5) return 3;
  if (up.x < -0.5) return 4;
  if (up.z < -0.5) return 5;
  return 6;
}

export function getDieValueFromQuaternion(quaternion, config = {}) {
  const face = getPhysicalFace(quaternion, config.type);
  if (config.type === 'heavy') return [4, 4, 5, 5, 6, 6][face - 1];
  if (config.type === 'sevens') return face + 1;
  if (config.type === 'promotion') return Math.min(6, 1 + Math.max(0, Number(config.promotionLevel) || 0));
  if (config.type === 'octahedron') return [1, 2, 3, 4, 4, 5, 5, 6][face - 1];
  return face;
}

const CUBE_FACE_NORMALS = [
  [0, 1, 0], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, -1, 0]
];

const OCT_FACE_NORMALS = OCT_NORMALS;

function valueToPhysicalFace(value, config = {}) {
  if (config.type === 'heavy') return { 4: 1, 5: 3, 6: 5 }[value] || 1;
  if (config.type === 'sevens') return value - 1;
  if (config.type === 'octahedron') return { 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 8 }[value] || 1;
  return value;
}

export function getFaceNormal(value, config = {}) {
  const faceIndex = valueToPhysicalFace(value, config);
  if (config.type === 'octahedron') {
    const n = OCT_FACE_NORMALS[faceIndex - 1] || OCT_FACE_NORMALS[0];
    return { x: n[0], y: n[1], z: n[2] };
  }
  const n = CUBE_FACE_NORMALS[faceIndex - 1] || CUBE_FACE_NORMALS[0];
  return { x: n[0], y: n[1], z: n[2] };
}

export function getQuaternionForValue(value, config = {}) {
  const normal = getFaceNormal(value, config);
  const dot = normal.y;
  if (dot < -0.999) return { x: 1, y: 0, z: 0, w: 0 };
  const cx = -normal.z;
  const cz = normal.x;
  const qw = 1 + dot;
  const len = Math.hypot(cx, 0, cz, qw) || 1;
  return { x: cx / len, y: 0, z: cz / len, w: qw / len };
}
